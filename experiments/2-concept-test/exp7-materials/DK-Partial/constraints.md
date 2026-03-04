# Constraints -- Medusa Payment Module

## Financial Invariants

### C1: Capture ceiling -- cannot capture more than authorized minus already captured

```
newCaptureAmount <= authorizedAmount - sum(existingCaptures)
```

All comparisons use currency-precision rounding (`roundToCurrencyPrecision`).

**Code evidence:** `capturePayment_` method, lines 740-749. Throws `INVALID_DATA` if violated.

**Rationale unknown** -- would need to ask product owner why they chose to enforce this at the module level rather than relying on the provider to reject over-captures. Likely for consistency across providers with different enforcement behaviors, but this is speculation.

### C2: Refund ceiling -- cannot refund more than captured amount

```
capturedAmount >= refundedAmount + newRefundAmount
```

**Code evidence:** `refundPayment_` method, lines 880-886. Throws `INVALID_DATA` if violated.

**Rationale (domain knowledge, Q1):** Authorization is a hold, not a transfer. The captured amount represents actual money moved. Refunding more than captured would mean refunding money that was never actually taken from the customer's account. In the real world: you authorize $100 (bank puts a $100 hold), capture $60 (bank transfers $60), the remaining $40 hold is released automatically. You can only refund up to $60.

### C3: Cannot capture a canceled payment

If `payment.canceled_at` is set, capture throws `INVALID_DATA`.

**Code evidence:** `capturePayment_` method, lines 716-721.

**Rationale unknown** -- would need to ask product owner. Clearly prevents financial operations on canceled payments, but the specific business rule (e.g., whether re-authorization is expected first) is not documented.

### C4: Idempotent authorization

If a session already has a payment and `authorized_at` is set, `authorizePaymentSession` returns the existing payment without re-authorizing.

**Code evidence:** `authorizePaymentSession` method, lines 522-525.

**Rationale unknown** -- would need to ask product owner. Likely to prevent duplicate Payment records and duplicate provider calls, but the idempotency contract (e.g., is it safe to retry after partial failure?) is not documented.

### C5: Default to full amount when no amount specified

- **Capture:** if no amount provided, defaults to `payment.amount` (full authorized amount).
- **Refund:** if no amount provided, defaults to `payment.amount` (full payment amount).

**Code evidence:** `capturePayment_` line 728-729; `refundPayment_` lines 867-869.

**Rationale unknown** -- would need to ask product owner. Likely a convenience default for the common case (full capture / full refund).

## Structural Constraints

### C6: Provider CAPTURED status coercion during authorization

When a provider returns `CAPTURED` status during authorization, the system coerces it to `AUTHORIZED` and then explicitly captures via `capturePayment` with `is_captured=true`.

**Code evidence:** `authorizePaymentSession_` method, lines 588-628.

**Rationale (domain knowledge, Q2):** From the system's perspective, capture is always a separate step with its own local record, idempotency key, and rollback handling. If the system accepted CAPTURED directly, it would skip the capture flow and lose traceability. The provider may have captured, but the internal system needs to go through the proper capture ceremony. The `is_captured` flag tells capture to skip the provider call but still create a local Capture record.

### C7: Session creation is two-phase with compensating cleanup

If session creation fails at any point, compensating actions clean up:
- If provider session was created -> delete it
- If local session was created -> delete it

**Code evidence:** `createPaymentSession` method, lines 398-413.

**Rationale unknown** -- would need to ask product owner. Standard saga/compensation pattern to prevent orphaned resources, but whether there are specific failure scenarios driving this design is not documented.

### C8: Authorization failure triggers provider cancellation

If the local authorization step (creating Payment record, updating session) fails after the provider has authorized, the system calls `provider.cancelPayment` to compensate.

**Code evidence:** `authorizePaymentSession` method, lines 561-571.

**Rationale unknown** -- would need to ask product owner. Prevents authorized-but-untracked payments from persisting at the provider.

### C9: Capture/refund failure triggers local record deletion

If the provider capture call fails, the local Capture record is deleted. Same pattern for refunds.

**Code evidence:** `capturePayment` lines 692-697; `refundPayment` lines 843-847.

**Rationale unknown** -- would need to ask product owner. Prevents local records that do not reflect actual provider state.

### C10: Account holder update requires existing context

`updateAccountHolder` throws `INVALID_DATA` if `input.context.account_holder` is missing.

**Code evidence:** `updateAccountHolder` method, lines 1137-1142.

**Rationale unknown** -- would need to ask product owner.

### C11: Currency precision rounding is used for all financial comparisons

All amount comparisons (capture ceiling, refund ceiling, collection status thresholds) use `roundToCurrencyPrecision` which derives precision from `Intl.NumberFormat`. Unknown currencies keep full precision.

**Code evidence:** `roundToCurrencyPrecision` method, lines 156-173; used throughout capture, refund, and collection reconciliation.

**Rationale unknown** -- would need to ask product owner. Likely to avoid floating-point comparison issues with currency amounts, but the specific choice of `Intl.NumberFormat` as the precision source is not explained.

## Session Status Constraints

### C12: Authorization only succeeds for AUTHORIZED or CAPTURED provider responses

If the provider returns any status other than AUTHORIZED or CAPTURED, the session is updated with the returned status but an error is thrown.

**Code evidence:** `authorizePaymentSession` method, lines 535-551.

**Rationale unknown** -- would need to ask product owner. The module enforces that authorization is a binary outcome from the system's perspective.

### C13: Session status update priority

When updating a session, status is resolved in priority order:
1. Explicit caller-provided status (e.g., from webhook)
2. Provider response status
3. Existing session status

**Code evidence:** `updatePaymentSession` method, line 469.

**Rationale unknown** -- would need to ask product owner. Allows webhooks to override provider response status.
