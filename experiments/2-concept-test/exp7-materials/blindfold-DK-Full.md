# Blindfold Test -- DK-Full Artifacts

## Q1: A customer authorizes $100, then $60 is captured. Now a request comes in to capture $50 more. What happens and why?

**Answer:** The capture request is rejected with an `INVALID_DATA` error. The message will read: "You cannot capture more than the authorized amount substracted by what is already captured."

Here is the exact sequence:

1. The `capturePayment` method retrieves the payment along with its existing captures.
2. Inside the transactional `capturePayment_` method, the system computes:
   - `capturedAmount` = sum of all existing capture `raw_amount` values = $60
   - `remainingToCapture` = `authorizedAmount - capturedAmount` = $100 - $60 = $40
3. The new capture amount ($50) is compared against `remainingToCapture` ($40), after rounding both to currency precision.
4. Since $50 > $40, the guard throws `MedusaError(INVALID_DATA, "You cannot capture more than the authorized amount substracted by what is already captured.")`.
5. No local Capture record is created, no provider call is made, and no collection status recomputation occurs.

The constraint exists because authorization represents a hold on funds, and you cannot capture more than the total hold minus what has already been drawn from it.

**Artifacts used:** constraints.md (Capture Ceiling), logic.md (capturePayment flow, steps 3d-3f), errors.md (Capture Exceeds Remaining Authorization), aspects.md (Aspect 4: Amount Ceiling Validation).

---

## Q2: A payment collection has total amount $100. Two payment sessions are created: one for $80 and one for $20. Both are successfully authorized. What is the collection's status after both authorizations?

**Answer:** The collection's status is **AUTHORIZED**.

After each authorization, `maybeUpdatePaymentCollection_` is called to recompute the collection status from scratch. After both sessions are authorized, the recomputation proceeds as follows:

1. The system reloads the payment collection with all sessions, payments, captures, and refunds.
2. It computes `authorizedAmount` = sum of `amount` for all sessions with `status === AUTHORIZED` = $80 + $20 = $100.
3. It computes `capturedAmount` = sum of all capture amounts = $0 (no captures yet).
4. It computes `refundedAmount` = sum of all refund amounts = $0.
5. Status determination:
   - Sessions exist, so it starts at `AWAITING`.
   - `authorizedAmount` ($100) > 0, and `round(authorizedAmount)` ($100) >= `round(collectionAmount)` ($100), so status becomes `AUTHORIZED`.
   - `capturedAmount` ($0) is not >= `collectionAmount` ($100), so it does not advance to `COMPLETED`.
6. Final status: **AUTHORIZED**, with `authorized_amount = $100`, `captured_amount = $0`, `refunded_amount = $0`.

Note: after only the first authorization ($80), the intermediate status would have been `PARTIALLY_AUTHORIZED` since $80 < $100. But once the second session is also authorized, the full $100 meets the threshold.

**Artifacts used:** logic.md (maybeUpdatePaymentCollection_ algorithm), state.md (Payment Collection Status, Recomputation Algorithm), decisions.md (D1: Status Recomputation Over Incremental State Machine), aspects.md (Aspect 3: Collection Status Recomputation).

---

## Q3: A Stripe capture call succeeds (money is taken), but then the local database write fails. What happens? Describe the exact sequence.

**Answer:** The system deletes the local Capture record that was created before the provider call, but the money taken at Stripe is **not** reversed. This is a partial inconsistency where the provider has captured funds but no local record of the capture exists.

The exact sequence:

1. `capturePayment` retrieves the payment with its existing captures.
2. Inside the transaction `capturePayment_`:
   - Guards are checked (not canceled, not already fully captured, amount within ceiling).
   - A local **Capture record** is created in the database with the payment ID, amount, and captured_by.
3. Outside the transaction, `capturePaymentFromProvider_` is called:
   - The provider's `capturePayment` method is called with the `capture.id` as the idempotency key.
   - **Stripe successfully captures the money** and returns data.
   - The method then attempts to update the local payment record with the provider's response data and potentially set `captured_at` if fully captured.
   - **This local database write fails.**
4. The error is caught in the `capturePayment` method's error handler.
5. **Rollback:** The local Capture record is deleted via `super.deleteCaptures({ id: capture.id })`.
6. The error propagates to the caller.

Critically, unlike authorization (where the rollback calls `provider.cancelPayment` to reverse the authorization), the capture rollback does **not** call any provider reversal. Money that has been captured at the provider level cannot be "un-captured" -- it can only be refunded through a separate refund operation. The system only deletes the local Capture record.

This means: Stripe has the money, but the local database has no record of it. The idempotency key (the capture record's ID) has been deleted, so a retry would create a new Capture record with a new ID. However, if the provider (Stripe) honors the idempotency key from the original call, the retry would return the same successful result without double-charging. The local state would then be consistent again upon successful retry.

**Artifacts used:** logic.md (capturePayment flow, steps 4-5), errors.md (capturePayment -- Provider Failure), aspects.md (Aspect 1: Dual Rollback), decisions.md (D4: Create-Local-First, Rollback-on-Failure), aspects.md (Aspect 2: Idempotency Key = Local Record ID).

---

## Q4: An authorization call to the payment provider times out. The system retries. But the first call actually succeeded at the provider. What happens?

**Answer:** The retry succeeds safely without creating a duplicate authorization, thanks to the idempotency key mechanism.

Here is the detailed sequence:

1. **First attempt:** `authorizePaymentSession` is called.
   - The system retrieves the session (which already exists in the database with a stable `session.id`).
   - The idempotency check finds no existing `session.payment` or `session.authorized_at`, so it proceeds.
   - The system calls `provider.authorizePayment()` with `session.id` as the idempotency key.
   - The provider receives the call and successfully authorizes the payment.
   - The response times out before reaching the Medusa system.
   - The local write (creating the Payment record, updating the session) never executes.
   - The error handler calls `provider.cancelPayment()` to reverse the authorization, using `payment.id` as the idempotency key. However, since the Payment record was never created (the local write didn't happen), `payment.id` may be undefined. This cancel attempt may or may not succeed depending on provider behavior.

2. **Retry attempt:** `authorizePaymentSession` is called again for the same session.
   - The system retrieves the session again. Since the first attempt's local writes never completed, `session.payment` is still null and `session.authorized_at` is still null -- the idempotency short-circuit does NOT fire.
   - The system calls `provider.authorizePayment()` again with the **same** `session.id` as the idempotency key.
   - Because the provider received the same idempotency key, it recognizes this as a duplicate request and returns the result of the original authorization (AUTHORIZED or CAPTURED) without performing a second hold on the customer's funds.
   - The system receives AUTHORIZED (or CAPTURED, which gets coerced to AUTHORIZED).
   - The local Payment record is created, the session is updated with `authorized_at`, and collection status is recomputed.

The key insight is that the idempotency key is the **session ID** -- a persistent local record that was created before the authorization call. Even though the first call's local writes failed, the session ID is stable across retries, so the provider deduplicates correctly.

There is one risk: if the rollback's `provider.cancelPayment()` call from step 1 succeeded (despite `payment.id` possibly being undefined), the authorization may have been canceled at the provider, and the retry would encounter a canceled payment. The exact outcome depends on the provider's handling of the cancel call with a potentially undefined idempotency key.

**Artifacts used:** constraints.md (Authorization Idempotency, Idempotency Keys Equal Local Record IDs), logic.md (authorizePaymentSession flow, steps 2-7), decisions.md (D3: Local Record ID as Idempotency Key), aspects.md (Aspect 2: Idempotency Key = Local Record ID), errors.md (authorizePaymentSession -- Local Write Failure).

---

## Q5: A colleague proposes changing the refund ceiling from "captured amount" to "authorized amount." Argue AGAINST this change. Give at least 3 reasons.

**Answer:** This change should be rejected for the following reasons:

### Reason 1: Authorization is a hold, not a transfer -- you would be refunding money you never received

An authorization places a temporary hold on the customer's funds at their bank, but no money actually moves to the merchant. Only a capture transfers funds. If you authorize $100 and capture $60, the merchant only has $60. Changing the ceiling to the authorized amount would allow attempting to refund up to $100, meaning you would try to return $40 the merchant never received. Payment providers would reject such refund requests, or worse, the merchant would lose money from their own balance.

**(Artifacts: constraints.md -- Refund Ceiling, decisions.md -- D5: Refund Ceiling Based on Captured Amount)**

### Reason 2: The uncaptured portion of an authorization is released back to the customer automatically

When a partial capture occurs (e.g., capture $60 of a $100 authorization), the remaining $40 hold is eventually released by the bank back to the customer. The customer already gets that money back without any refund. Allowing a refund against the authorized amount would mean the customer could receive the uncaptured portion twice -- once through the automatic hold release, and once through the refund.

**(Artifacts: constraints.md -- Refund Ceiling example: "remaining $40 hold is released")**

### Reason 3: It breaks the self-correcting status recomputation model and introduces semantic inconsistency

The collection status recomputation tracks `captured_amount` and `refunded_amount` as separate aggregates. The system's invariant is that `refunded_amount` is a subset of `captured_amount` -- it represents money returned from money that was taken. If refunds could exceed captured amounts, the `refunded_amount` would become semantically incoherent: it would no longer represent "money returned" but rather a mix of captured-money-returned and authorized-money-voided. This would corrupt the meaning of the aggregate amounts stored on the payment collection and make the status recomputation unreliable. Any downstream system or reporting relying on `refunded_amount <= captured_amount` would break.

**(Artifacts: logic.md -- maybeUpdatePaymentCollection_, state.md -- Recomputation Algorithm, decisions.md -- D1: Status Recomputation Over Incremental State Machine)**

### Reason 4: Payment providers will reject over-refund requests at the API level

External payment providers (Stripe, PayPal, etc.) enforce their own refund ceilings based on actual money transferred (captured). Even if the local system allowed requesting a refund of $100 against a $60 capture, the provider call would fail. The system would then delete the local Refund record as part of the dual-rollback pattern (provider failure -> delete local record), resulting in a wasted round-trip and a confusing error for the caller. The current ceiling check prevents this by failing fast with a clear error message before any provider call is made.

**(Artifacts: responsibility.md -- "All real money movement is delegated to external provider plugins", aspects.md -- Aspect 1: Dual Rollback, errors.md -- Refund Exceeds Captured Amount)**

### Reason 5: It would violate the existing capture ceiling symmetry

The system has a deliberate symmetry: capture is capped by authorization, refund is capped by capture. This forms a clean pipeline: `authorized >= captured >= refunded`. Changing the refund ceiling to authorized amount breaks this chain, creating `authorized >= refunded` while `captured` floats independently. This makes it impossible to reason about the financial state of a payment by examining the chain of amounts, and opens the door to logically impossible states (e.g., refunded $90 but only captured $60).

**(Artifacts: constraints.md -- Capture Ceiling + Refund Ceiling, aspects.md -- Aspect 4: Amount Ceiling Validation)**
