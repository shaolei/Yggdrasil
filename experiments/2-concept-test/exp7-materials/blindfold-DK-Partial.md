# Blindfold Test -- DK-Partial Artifacts

## Q1: A customer authorizes $100, then $60 is captured. Now a request comes in to capture $50 more. What happens and why?

**Answer:** The capture request for $50 is rejected with an `INVALID_DATA` error. The error message is: "You cannot capture more than the authorized amount substracted by what is already captured."

Here is the exact sequence:

1. The system retrieves the payment along with its existing captures.
2. It enters the `capturePayment_` validation method.
3. It calculates the remaining capturable amount: `authorizedAmount - sum(existingCaptures)` = $100 - $60 = $40 (all values run through currency-precision rounding via `roundToCurrencyPrecision`).
4. It compares the new capture amount ($50) against the remaining ($40).
5. Since $50 > $40, the capture ceiling constraint (C1) is violated.
6. The system throws `MedusaError.Types.INVALID_DATA` and no Capture record is created.

The provider is never called because the validation happens locally before the provider call. The maximum additional capture allowed would be $40.

**Artifacts used:** logic.md (Section 4: Capture Flow, steps 3c-3e), constraints.md (C1: Capture ceiling), errors.md (E1: Capture exceeds remaining authorized amount), aspects.md (A4: Currency-Precision Rounding for Financial Comparisons).

---

## Q2: A payment collection has total amount $100. Two payment sessions are created: one for $80 and one for $20. Both are successfully authorized. What is the collection's status after both authorizations?

**Answer:** The collection's status is **AUTHORIZED**.

After each authorization, the system calls `maybeUpdatePaymentCollection_` to reconcile the collection status. Here is what happens after the second authorization completes:

1. The system retrieves the collection with all its payment sessions, payments, captures, and refunds.
2. It computes `authorizedAmount` = sum of amounts from sessions with status AUTHORIZED = $80 + $20 = $100.
3. It evaluates the status determination rules in order:
   - No sessions? No -- sessions exist.
   - Has sessions but no authorized? No -- both are authorized.
   - `authorizedAmount > 0` but `< collection.amount`? No -- $100 is not less than $100.
   - `authorizedAmount >= collection.amount`? Yes -- $100 >= $100.
4. The collection status is set to **AUTHORIZED**.

Note: After only the first session ($80) is authorized, the collection would be in **PARTIALLY_AUTHORIZED** status because $80 < $100. It transitions to AUTHORIZED only after both sessions are authorized, bringing the total to $100. All comparisons use `roundToCurrencyPrecision`.

**Artifacts used:** logic.md (Section 6: Payment Collection Status Reconciliation), state.md (PaymentCollection Status section, transition logic), aspects.md (A9: Collection Status Reconciliation After Mutation, A4: Currency-Precision Rounding).

---

## Q3: A Stripe capture call succeeds (money is taken), but then the local database write fails. What happens? Describe the exact sequence.

**Answer:** This scenario exposes a known limitation in the system's compensation pattern. Here is the exact sequence:

1. The system retrieves the payment with its existing captures.
2. `capturePayment_` runs within a transaction (decorated with `@InjectTransactionManager()`): it validates the capture ceiling, and creates a local Capture record in the database.
3. `capturePaymentFromProvider_` is called, which calls `provider.capturePayment` (the Stripe API call). This **succeeds** -- money is taken from the customer.
4. After the provider call returns successfully, the system attempts to update the payment's `data` field and `captured_at` timestamp locally.
5. **This local database write fails.**

Now, the critical question is what compensation happens. Looking at the capture flow's error handling (F3 in errors.md): when the provider capture call fails, the system deletes the local Capture record. But in this scenario, the provider call **succeeded** -- the failure is in the subsequent local write.

The catch block in `capturePayment` triggers. The compensation action is to **delete the local Capture record** and re-throw the error. However, the money has already been taken at Stripe. The system does NOT call the provider to reverse/refund the capture. There is no compensating provider call for capture failure -- unlike authorization failure, which triggers `provider.cancelPayment`.

The result is an **inconsistent state**: Stripe has captured the money, but the local system has no Capture record (it was deleted in compensation) and `captured_at` is not set. The payment collection status will not reflect this capture either, since `maybeUpdatePaymentCollection_` is never reached.

There is an additional risk noted in the artifacts: if the deletion of the Capture record itself also fails, both the local Capture record AND the provider capture exist, but in a state the system did not intend.

**Artifacts used:** logic.md (Section 4: Capture Flow, steps 3-5), errors.md (F3: Capture provider failure -- local record deletion, and the noted Risk), aspects.md (A1: Compensating Action -- limitation about no handling for compensation failure, A3: Local-First ordering, A7: Transaction Management).

---

## Q4: An authorization call to the payment provider times out. The system retries. But the first call actually succeeded at the provider. What happens?

**Answer:** The system handles this scenario through its idempotency mechanisms, though the outcome depends on at which point the retry occurs.

**Scenario A -- Retry at the `authorizePaymentSession` level (the most common case):**

1. The first call to `provider.authorizePayment` times out. This is treated as an error.
2. The authorization flow's catch block fires (F2): since the provider may have authorized, the system calls `provider.cancelPayment` as compensation, passing `idempotency_key = payment.id`. However, if the timeout occurred before the local Payment record was created, the compensation may not trigger (the catch block compensates for failures after provider authorization but during local record creation).
3. The caller retries `authorizePaymentSession` with the same session.
4. The idempotency check (C4/D6) fires: if the first call partially completed and created a Payment record with `authorized_at` set, the system returns the existing payment immediately without re-authorizing. The retry is safe.
5. If the first call did NOT get far enough to create the local Payment record, the system calls the provider again. The provider receives the same `idempotency_key = session.id` (A2). A well-behaved provider (like Stripe) will recognize the duplicate request via the idempotency key and return the same authorization result without charging twice.

**Scenario B -- The first call's timeout triggered compensation (cancelPayment):**

If the system's error handling canceled the provider-side authorization before the retry, the retry would attempt a fresh authorization against a canceled payment at the provider. The outcome depends on the provider's behavior for authorizing a canceled payment.

The key safeguards are:
- **Local idempotency** (D6): if the session already has a payment with `authorized_at`, the existing payment is returned.
- **Provider idempotency** (A2): the idempotency key (`session.id`) is the same on retry, so the provider can deduplicate.
- **Compensation** (F2): the system attempts to cancel the provider-side authorization on failure, which may or may not have completed before the retry.

The most likely outcome with a provider like Stripe: the idempotency key ensures the retry is recognized as a duplicate, and either the existing authorization is returned or the local idempotency check short-circuits the call entirely.

**Artifacts used:** logic.md (Section 3: Authorization Flow, steps 2-3, 9), constraints.md (C4: Idempotent authorization, C8: Authorization failure triggers provider cancellation), decisions.md (D6: Idempotent authorization, D13: Idempotency keys derived from entity IDs), errors.md (F2: Authorization failure after provider success), aspects.md (A2: Idempotency Key Propagation).

---

## Q5: A colleague proposes changing the refund ceiling from "captured amount" to "authorized amount." Argue AGAINST this change. Give at least 3 reasons.

**Answer:** Here are the arguments against raising the refund ceiling from captured amount to authorized amount:

**Reason 1: Authorization is a hold, not a transfer -- you cannot refund money that was never taken.**

An authorization places a temporary hold on funds in the customer's account, but no money actually moves. Only capture transfers funds from the customer to the merchant. If you authorize $100 and capture $60, the remaining $40 hold is released automatically by the issuing bank. Allowing a refund of up to $100 would mean attempting to refund $40 that was never in the merchant's possession. The provider would either reject this (causing an error) or, worse, the merchant would be sending $40 of their own money to the customer -- effectively a gift, not a refund. The current constraint (`capturedAmount >= refundedAmount + newRefundAmount`) ensures refunds only apply to actual money movement.

*(Artifacts: decisions.md D2, constraints.md C2, logic.md Section 5 domain knowledge note)*

**Reason 2: It breaks the financial invariant chain and introduces inconsistency with the capture ceiling.**

The system's financial integrity rests on a chain of constraints: you cannot capture more than authorized (C1), and you cannot refund more than captured (C2). These constraints form a consistent hierarchy: `authorized >= captured >= refunded`. Changing the refund ceiling to authorized amount breaks this chain -- you could have `refunded > captured`, which means the local accounting (aggregate amounts on the payment collection) would show more money refunded than was ever received. The collection reconciliation logic (`maybeUpdatePaymentCollection_`) tracks `captured_amount` and `refunded_amount` separately. If `refunded_amount` exceeds `captured_amount`, downstream business logic, reporting, and any system that reads these aggregates would see nonsensical financial data.

*(Artifacts: constraints.md C1 and C2, logic.md Section 6, state.md PaymentCollection Status)*

**Reason 3: Providers will reject over-refunds, causing cascading errors and orphaned local records.**

Payment providers (Stripe, PayPal, etc.) enforce their own refund limits based on the captured amount. Even if the module allowed a refund of $100 against a $60 capture, the provider would reject the call. When the provider call fails, the system's compensation pattern (F4) deletes the local Refund record. But the module would have already validated and allowed the request, creating a confusing user experience: the request passes local validation only to fail at the provider. Additionally, the module-level validation (D8) exists precisely to provide consistent behavior across providers with different enforcement behaviors. Removing this local check would re-introduce provider-specific inconsistencies that the current design deliberately avoids.

*(Artifacts: decisions.md D8, errors.md F4, aspects.md A1)*

**Reason 4: It undermines the traceability and auditability of the capture-refund lifecycle.**

Each Capture record represents real money received; each Refund record represents real money returned. The constraint that refunds cannot exceed captures ensures a clean audit trail where every refund dollar can be traced to a corresponding capture dollar. If refunds could exceed captures, auditors and reconciliation systems would need to distinguish between "refunds of captured funds" and "refunds of authorized-but-uncaptured funds" (which are economically meaningless). The current design keeps the financial model simple: captures in, refunds out, and the math always balances.

*(Artifacts: logic.md Section 5, decisions.md D2, aspects.md A9)*

**Reason 5: Partial capture scenarios become financially dangerous.**

Consider: authorize $100, capture $30, then refund $100 (under the proposed rule). The customer gets $100 back but the merchant only received $30. The $70 difference comes from the merchant's own funds. In multi-capture scenarios (which the system explicitly supports via partial captures with Capture records), this problem compounds. The current design safely handles partial captures by tying refunds to the actual captured total, ensuring the merchant can never be forced to pay out more than they received.

*(Artifacts: logic.md Section 4, constraints.md C1 and C2, state.md Payment Lifecycle)*
