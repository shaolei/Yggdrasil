# Constraints

## Monetary Constraints

### C1: Capture amount must not exceed remaining authorized amount
- **Location:** `capturePayment_` (payment-module.ts, lines 740-749)
- **Rule:** `newCaptureAmount <= authorizedAmount - alreadyCapturedAmount` (both sides rounded to currency precision)
- **Error:** `MedusaError.Types.INVALID_DATA` -- "You cannot capture more than the authorized amount substracted by what is already captured."
- **Rationale:** Unknown -- no domain expert available. Observable intent: prevents over-capture relative to what was authorized.

### C2: Refund amount must not exceed total captured amount
- **Location:** `refundPayment_` (payment-module.ts, lines 881-886)
- **Rule:** `existingRefunds + newRefundAmount <= capturedAmount`
- **Error:** `MedusaError.Types.INVALID_DATA` -- "You cannot refund more than what is captured on the payment."
- **Rationale:** Unknown -- no domain expert available. Observable intent: prevents refunding money that was never collected.

### C3: Canceled payments cannot be captured
- **Location:** `capturePayment_` (payment-module.ts, lines 716-721)
- **Rule:** If `payment.canceled_at` is set, capture is rejected.
- **Error:** `MedusaError.Types.INVALID_DATA` -- "The payment: ${payment.id} has been canceled."
- **Rationale:** Unknown -- no domain expert available. Observable intent: prevents financial operations on payments that have already been canceled.

### C4: Default capture/refund amounts to full payment amount
- **Capture:** If `data.amount` is not provided, defaults to `payment.amount` (line 728-729).
- **Refund:** If `data.amount` is not provided, defaults to `payment.amount` (lines 867-869).
- **Rationale:** Unknown -- no domain expert available. Observable intent: convenience default for the most common case (full capture/refund).

### C5: Currency precision rounding in comparisons
- **Location:** `roundToCurrencyPrecision` (lines 156-173), used in capture validation, refund is NOT rounded (only capture uses it), and payment collection status derivation.
- **Rule:** All monetary comparisons in capture logic and collection status derivation are rounded to the currency's standard decimal precision (determined via `Intl.NumberFormat`). Unknown currencies retain full precision.
- **Rationale:** Unknown -- no domain expert available. Observable intent: avoids floating-point mismatches when comparing monetary amounts.

## Authorization Constraints

### C6: Authorization requires AUTHORIZED or CAPTURED status from provider
- **Location:** `authorizePaymentSession` (lines 535-551)
- **Rule:** If the provider returns any status other than AUTHORIZED or CAPTURED, the session is updated with the returned status and a NOT_ALLOWED error is thrown.
- **Error:** `MedusaError.Types.NOT_ALLOWED` -- "Session: ${session.id} was not authorized with the provider."
- **Rationale:** Unknown -- no domain expert available. Observable intent: only transitions to authorized state when the provider explicitly confirms.

### C7: Account holder update requires existing account_holder in context
- **Location:** `updateAccountHolder` (lines 1137-1142)
- **Rule:** If `input.context?.account_holder` is missing, throws.
- **Error:** `MedusaError.Types.INVALID_DATA` -- "Missing account holder data while updating account holder."
- **Rationale:** Unknown -- no domain expert available.

## Structural Constraints

### C8: PaymentCollection is the aggregate root
- **Observable:** Payment sessions, payments, captures, and refunds are all accessed through their relationship to a PaymentCollection. The collection tracks aggregate monetary totals.
- **Rationale:** Unknown -- no domain expert available. Observable intent: provides a single grouping entity for all payment-related records in a transaction.

### C9: Provider ID format convention
- **Location:** `getWebhookActionAndData` (line 1273)
- **Rule:** Provider IDs are prefixed with `pp_` when constructed from webhook event data.
- **Rationale:** Unknown -- no domain expert available.

### C10: Provider operations for account holders and payment methods are optional
- **Location:** PaymentProviderService (lines 150, 165, 179, 195, 210, 225)
- **Rule:** The provider service checks for method existence before calling account holder and payment method operations. If unsupported, logs a warning and returns an empty/fallback result.
- **Rationale:** Unknown -- no domain expert available. Observable intent: supports providers with varying capability levels.
