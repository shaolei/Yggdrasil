# Blindfold Test Answers -- DK-None (No Domain Knowledge)

Answered using only the semantic graph artifacts in `/workspaces/memory2/exp7-materials/DK-None/`.

---

## Q1: A customer authorizes $100, then $60 is captured. Now a request comes in to capture $50 more. What happens and why?

**Answer:** The second capture request for $50 is rejected with an `INVALID_DATA` error. The error message is: *"You cannot capture more than the authorized amount substracted by what is already captured."*

Here is the exact sequence:

1. The `capturePayment` method retrieves the payment along with its existing captures.
2. Inside `capturePayment_`, the system checks that the payment is not canceled (it is not), and that it is not already fully captured (`captured_at` is not set since only $60 of $100 has been captured).
3. The system calculates: `authorizedAmount = $100`, `alreadyCapturedAmount = $60`, `remainingToCapture = $100 - $60 = $40`.
4. The requested capture amount ($50) is compared against the remaining capturable amount ($40). Both values are rounded to currency precision for the comparison.
5. Since $50 > $40, the constraint is violated and the system throws `MedusaError.Types.INVALID_DATA`.
6. No Capture record is created. No provider call is made. The payment state is unchanged.

The caller would need to request $40 or less to succeed.

**Artifacts cited:** `logic.md` (Payment Capture, steps 3-5), `constraints.md` (C1, C5), `errors.md` (E2).

---

## Q2: A payment collection has total amount $100. Two payment sessions are created: one for $80 and one for $20. Both are successfully authorized. What is the collection's status after both authorizations?

**Answer:** The collection's status is `AUTHORIZED`.

Here is the reasoning:

1. After the first session ($80) is authorized, `maybeUpdatePaymentCollection_` is triggered. It sums the authorized amounts from all sessions with status AUTHORIZED. At this point, `authorized_amount = $80`. Since $80 > 0 but $80 < $100 (the collection amount), the status is set to `PARTIALLY_AUTHORIZED`.

2. After the second session ($20) is authorized, `maybeUpdatePaymentCollection_` is triggered again. Now both sessions are AUTHORIZED, so `authorized_amount = $80 + $20 = $100`. Since $100 >= $100 (the collection amount, with currency-precision rounding), the status is set to `AUTHORIZED`.

The collection's aggregate fields after both authorizations:
- `status`: `AUTHORIZED`
- `authorized_amount`: $100
- `captured_amount`: $0
- `refunded_amount`: $0

Note: The status does not become `COMPLETED` because that requires `captured_amount >= collection amount`, which has not happened yet. Authorization alone moves the collection to `AUTHORIZED`; capture is needed to reach `COMPLETED`.

**Artifacts cited:** `logic.md` (Payment Collection Status Derivation, steps 2 and 5), `state.md` (PaymentCollection States, status derivation logic), `aspects.md` (A6: Payment Collection Aggregate Recalculation).

---

## Q3: A Stripe capture call succeeds (money is taken), but then the local database write fails. What happens? Describe the exact sequence.

**Answer:** This scenario exposes a gap in the compensation pattern. Here is the exact sequence:

1. `capturePayment` is called. The payment record (with its existing captures) is retrieved.
2. `capturePayment_` runs inside a transaction: it validates the payment is not canceled, checks the capture amount does not exceed the remaining authorized amount, and creates a local `Capture` record in the database.
3. `capturePaymentFromProvider_` is called. Since the payment was not already captured by the provider (`isCaptured` is false), it calls the provider's `capturePayment` method. The Stripe call succeeds -- money is taken from the customer.
4. The method then attempts to update the local Payment record's `data` field with the provider response and (if fully captured) set `captured_at`. This is the local database write that fails.
5. The error triggers the compensation path (CP3): the system attempts to delete the locally created Capture record, then re-throws the error.

**The critical problem:** The money has already been taken at Stripe (step 3), but the local state does not reflect this. The Capture record is deleted (or may not have been committed depending on transaction boundaries), and the Payment's `data` field is not updated with the provider response. The system is now inconsistent: Stripe has captured the funds, but the Medusa database shows no capture occurred.

Furthermore, the compensation pattern (CP3) only deletes the local Capture record -- it does NOT attempt to reverse the capture at the provider (unlike the authorization compensation pattern CP2 which cancels the provider authorization). There is no provider-side reversal for a successful capture.

Additionally, the artifact notes that the compensation patterns have a further gap: there is no handling if the cleanup operations themselves fail (i.e., the Capture record deletion could also fail).

**Artifacts cited:** `logic.md` (Payment Capture, steps 3-5), `errors.md` (CP3: Capture rollback), `aspects.md` (A2: Compensation on Failure), `decisions.md` (D6).

---

## Q4: An authorization call to the payment provider times out. The system retries. But the first call actually succeeded at the provider. What happens?

**Answer:** The system handles this safely through two layers of idempotency protection:

**Layer 1 -- Module-level idempotency (D3):** When `authorizePaymentSession` is called the second time (the retry), it first retrieves the session with its payment and payment_collection relations. It checks: does the session already have a `payment` AND an `authorized_at` timestamp? If the first call's internal processing completed before the timeout was raised, both would be set and the method returns the existing payment immediately without calling the provider again. Retry is fully safe.

**Layer 2 -- Provider-level idempotency (A3):** If the first call timed out before local processing completed (so no payment record exists locally yet), the retry proceeds to call the provider's `authorizePayment` again. Critically, the session ID is passed as the `idempotency_key` in the provider call context. Because the same session ID is used for both the original and retry calls, the payment provider (assuming it honors idempotency keys, as Stripe does) recognizes this as a duplicate request and returns the same successful authorization result without charging the customer twice.

The retry then proceeds through the normal flow: the provider returns AUTHORIZED (or CAPTURED), the session is updated with `authorized_at`, a Payment record is created, and the collection's aggregate status is recalculated.

**However, there is a potential edge case in the compensation path:** If the first call succeeded at the provider but then the internal `authorizePaymentSession_` step partially failed (triggering compensation pattern CP2), the system would have attempted to cancel the authorization at the provider. If the cancel succeeded, the retry would find no existing payment locally and would call the provider again -- but the authorization was already canceled. The provider would need to create a new authorization. The behavior here depends on whether the provider treats the idempotency key as producing a new authorization or returning the canceled one.

**Artifacts cited:** `decisions.md` (D2, D3), `aspects.md` (A3: Idempotency Key Propagation), `logic.md` (Payment Authorization, step 2), `errors.md` (CP2).

---

## Q5: A colleague proposes changing the refund ceiling from "captured amount" to "authorized amount." Argue AGAINST this change. Give at least 3 reasons.

**Answer:** Here are the arguments against raising the refund ceiling from captured amount to authorized amount:

**Reason 1 -- You cannot refund money you never collected.** The current constraint (C2) ensures that `existingRefunds + newRefundAmount <= capturedAmount`. This reflects a fundamental financial invariant: a refund is a return of funds that were actually taken from the customer. Authorization merely reserves funds; it does not transfer them. Allowing refunds up to the authorized amount would mean the system could attempt to send money to a customer that was never actually collected, creating a net loss. The error message in the code makes this explicit: *"You cannot refund more than what is captured on the payment."*

**Reason 2 -- The Payment Collection status derivation would become inconsistent.** The `maybeUpdatePaymentCollection_` recalculation (A6) tracks `captured_amount` and `refunded_amount` as separate aggregate fields. The collection reaches `COMPLETED` status when `capturedAmount >= collectionAmount`. If refunds could exceed captured amounts, the `refunded_amount` could exceed `captured_amount`, creating a nonsensical financial state on the collection. Downstream consumers of these aggregate fields (order management, accounting, reporting) would encounter data that violates basic accounting principles: you cannot refund more than you received.

**Reason 3 -- The provider delegation pattern would break.** The module delegates refund calls to the external payment provider (A1). Payment providers like Stripe enforce their own refund limits based on what was actually captured. Even if the Medusa module allowed a refund of $100 against only $60 captured, the provider call would fail because the provider knows only $60 was collected. This would trigger the compensation pattern (CP4) -- the local Refund record would be created, the provider call would fail, the local record would be deleted, and the error would propagate. The change would be functionally inoperative against any real provider, while introducing misleading validation behavior in the module layer.

**Reason 4 -- Partial capture scenarios would create dangerous ambiguity.** The system supports partial captures (capturing less than the authorized amount). Consider: $100 authorized, $40 captured. Under the proposed change, a refund of up to $100 would be permitted. But only $40 was captured. Refunding $100 would require the provider to somehow return $60 that was never collected. The remaining $60 of authorization is just a hold on the customer's funds that will eventually expire -- it is not money the merchant possesses. Conflating "held" funds with "collected" funds is a category error that would lead to real financial discrepancies.

**Reason 5 -- It violates the append-only financial record design.** Captures and Refunds are immutable, append-only records (as documented in `state.md`). The system sums all capture records to determine captured amount and all refund records to determine refunded amount. If refunds could exceed captures, the running totals would represent an impossible financial state -- the merchant would have a negative balance on that payment. The current constraint preserves the integrity of these financial ledger records.

**Artifacts cited:** `constraints.md` (C1, C2), `logic.md` (Payment Refund, Payment Collection Status Derivation), `errors.md` (E3, CP4), `state.md` (Capture and Refund as immutable records, Payment Collection aggregate fields), `aspects.md` (A1, A2, A6), `decisions.md` (D6).
