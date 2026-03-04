# Design Decisions -- Medusa Payment Module

## D1: Auto-capture coercion -- treat provider CAPTURED as AUTHORIZED, then explicitly capture

**Decision:** When a provider returns `CAPTURED` during authorization, the system coerces the status to `AUTHORIZED` and then explicitly calls `capturePayment` with the `is_captured=true` flag. This creates a local Capture record without calling the provider again.

**Rejected alternative:** Accept the provider's `CAPTURED` status directly and skip the capture flow.

**Rationale (domain knowledge, Q2):** From the system's perspective, capture is always a separate step with its own local record, its own idempotency key, and its own rollback handling. If the system accepted `CAPTURED` directly, it would skip the capture flow and lose traceability. The provider may have captured, but the internal system needs to go through the proper capture ceremony. The `is_captured` flag tells the capture flow to skip the `provider.capturePayment` call (since the provider already captured) but still creates a local Capture record and updates `payment.captured_at`.

---

## D2: Refund ceiling based on captured amount, not authorized amount

**Decision:** Refund validation uses `capturedAmount >= refundedAmount + newRefundAmount`. The ceiling is the sum of captures, not the authorized amount.

**Rejected alternative:** Use authorized amount as the refund ceiling.

**Rationale (domain knowledge, Q1):** Authorization is a hold, not a transfer. The captured amount represents actual money moved. Refunding more than captured would mean refunding money that was never actually taken from the customer's account. In the real world: you authorize $100, capture $60, the remaining $40 hold is released automatically. You can only refund up to $60.

---

## D3: Two-phase session creation with compensating cleanup

**Decision:** Session creation first creates a local record, then calls the provider. On failure at any point, both sides are cleaned up (provider session deleted, local session deleted).

**Rejected alternative(s):** (a) Create provider-side first, then local; (b) Use a single transaction with no compensation.

**Rationale unknown** -- would need to ask product owner. The code implements a saga/compensation pattern, but the specific failure scenarios that motivated this ordering (local-first vs. provider-first) are not documented.

---

## D4: Authorization failure compensated by provider cancellation

**Decision:** If the local authorization step (creating Payment record, updating session) fails after the provider has authorized, the system calls `provider.cancelPayment` to roll back the provider-side authorization.

**Rejected alternative:** Leave the provider-side authorization in place and retry later.

**Rationale unknown** -- would need to ask product owner. The code prevents authorized-but-untracked payments from persisting at the provider, but whether the choice of immediate cancellation vs. retry was deliberate is not documented.

---

## D5: Capture/refund failure compensated by deleting local record

**Decision:** If the provider capture call fails, the local Capture record is deleted. Same pattern for refunds -- if the provider refund call fails, the local Refund record is deleted.

**Rejected alternative:** Keep the local record and mark it as failed for later retry.

**Rationale unknown** -- would need to ask product owner. The code prioritizes consistency (no local records without provider confirmation), but whether a retry/recovery mechanism was considered is not documented.

---

## D6: Idempotent authorization via session state check

**Decision:** `authorizePaymentSession` checks if the session already has a payment and `authorized_at` is set. If so, it returns the existing payment without re-authorizing.

**Rejected alternative:** Always call the provider and rely on the provider's idempotency.

**Rationale unknown** -- would need to ask product owner. Likely prevents duplicate Payment records and duplicate provider calls, but the contract (e.g., whether it is safe to retry after partial failure at a specific step) is not documented.

---

## D7: Default to full amount for capture and refund when no amount specified

**Decision:** If no amount is provided to `capturePayment` or `refundPayment`, the system defaults to the full `payment.amount`.

**Rejected alternative:** Require an explicit amount always.

**Rationale unknown** -- would need to ask product owner. Likely a convenience default for the common case (full capture / full refund).

---

## D8: Module-level financial validation rather than relying on providers

**Decision:** The module enforces capture ceiling (`authorizedAmount - capturedAmount`) and refund ceiling (`capturedAmount - refundedAmount`) locally, before calling the provider.

**Rejected alternative:** Delegate all financial validation to the provider.

**Rationale unknown** -- would need to ask product owner. Likely for consistency across providers with different enforcement behaviors, but this is not confirmed.

---

## D9: Account holder deletion deletes local record before provider

**Decision:** `deleteAccountHolder` deletes the local record first, then calls `provider.deleteAccountHolder`.

**Rejected alternative:** Delete provider-side first, then local.

**Rationale unknown** -- would need to ask product owner. This ordering means a provider deletion failure leaves the local record already gone. The reason for this ordering (vs. provider-first, which would be safer against partial failure) is not documented.

---

## D10: Payment methods are provider-delegated with no local persistence

**Decision:** `listPaymentMethods` and `createPaymentMethods` (savePaymentMethod) call the provider directly. Results are normalized into `{ id, data, provider_id }` but not stored locally.

**Rejected alternative:** Store payment methods locally with provider synchronization.

**Rationale unknown** -- would need to ask product owner. Likely to avoid stale data issues with sensitive payment method information, but this is not confirmed.

---

## D11: PaymentProviderService uses optional capability checking (duck typing)

**Decision:** For operations like account holders, payment methods, and webhooks, `PaymentProviderService` checks if the method exists on the provider implementation (`if (!provider.createAccountHolder)`). If not, it logs a warning and returns an empty/default response.

**Rejected alternative:** Require all providers to implement every method (throw errors for missing methods).

**Rationale unknown** -- would need to ask product owner. Allows providers of varying capability levels to work with the module without implementing every feature.

---

## D12: Session status update uses priority chain (caller > provider > existing)

**Decision:** When updating a session, the status is resolved as: explicit caller-provided status > provider response status > existing session status.

**Rejected alternative:** Always use the provider response status; or always use the caller status.

**Rationale unknown** -- would need to ask product owner. The priority chain allows webhooks to override provider response status while preserving the existing status as a fallback.

---

## D13: Idempotency keys derived from entity IDs

**Decision:** Idempotency keys are derived from existing entity IDs: `session.id` for authorization and session creation, `capture.id` for capture calls, `refund.id` for refund calls, `customer.id` for account holder creation.

**Rejected alternative:** Generate separate UUID idempotency keys.

**Rationale unknown** -- would need to ask product owner. Using entity IDs as idempotency keys ties retry safety directly to the entity lifecycle, but whether this was a deliberate choice for simplicity or has specific semantics is not documented.
