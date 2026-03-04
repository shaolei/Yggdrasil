# Constraints -- Medusa Payment Module

## Business Rules

### Refund Ceiling (Domain FAQ Q1)

**Rule:** `capturedAmount >= (refundedAmount + newRefund)`

You can only refund up to the total captured amount, not the authorized amount. Authorization is a hold, not a transfer. The captured amount represents actual money moved. Refunding more than captured would mean refunding money that was never taken from the customer's account.

**Example:** Authorize $100 (bank holds $100), capture $60 (bank transfers $60), remaining $40 hold is released. Maximum refundable: $60.

**Code evidence:** `refundPayment_` computes `totalRefundedAmount = refundedAmount + data.amount` and throws `INVALID_DATA` if `capturedAmount < totalRefundedAmount` (payment-module.ts, lines 879-886).

### Capture Ceiling

**Rule:** `newCaptureAmount <= (authorizedAmount - alreadyCapturedAmount)`

You cannot capture more than the remaining authorized balance. The check is performed after rounding both sides to the currency's decimal precision.

**Code evidence:** `capturePayment_` computes `remainingToCapture = authorizedAmount - capturedAmount` and throws `INVALID_DATA` if the new capture exceeds it (payment-module.ts, lines 738-749).

### Canceled Payments Cannot Be Captured

**Rule:** If `payment.canceled_at` is set, capture is rejected.

**Code evidence:** `capturePayment_` checks `payment.canceled_at` before any capture logic and throws `INVALID_DATA` (payment-module.ts, lines 716-721).

### Full Capture Idempotency

**Rule:** If `payment.captured_at` is already set (meaning the payment was previously fully captured), attempting to capture again returns `{ isFullyCaptured: true }` without creating a new Capture record.

**Code evidence:** `capturePayment_` returns early if `payment.captured_at` is truthy (payment-module.ts, lines 723-725).

### Authorization Idempotency

**Rule:** If a session already has both a `payment` relation and an `authorized_at` timestamp, re-authorizing returns the existing payment without calling the provider.

**Code evidence:** `authorizePaymentSession` checks `session.payment && session.authorized_at` and returns early (payment-module.ts, lines 523-525).

### Default to Full Amount

**Rule:** If no amount is specified for a capture or refund, it defaults to the full payment amount.

**Code evidence:**
- Capture: `if (!data.amount) { data.amount = payment.amount }` (payment-module.ts, lines 728-729)
- Refund: `if (!data.amount) { data.amount = payment.amount }` (payment-module.ts, lines 867-869)

### Authorization Requires AUTHORIZED or CAPTURED Status

**Rule:** If the provider returns any status other than `AUTHORIZED` or `CAPTURED`, the session is updated with the returned status and a `NOT_ALLOWED` error is thrown.

**Code evidence:** `authorizePaymentSession` checks the returned status and throws if neither `AUTHORIZED` nor `CAPTURED` (payment-module.ts, lines 535-551).

### Currency Precision Rounding for Comparisons

**Rule:** All amount comparisons (capture ceiling, full-capture detection, collection status thresholds) are performed after rounding to the currency's native precision (e.g., 2 decimal places for USD, 0 for JPY). This prevents floating-point precision issues from causing incorrect rejections or status determinations.

**Code evidence:** `roundToCurrencyPrecision` uses `Intl.NumberFormat` to detect precision, and is called in `capturePayment_` (lines 742-743, 757-758) and `maybeUpdatePaymentCollection_` (lines 1009-1019, 1023-1032).

## Invariants

### Local Record Always Created Before Provider Call

Every operation that touches an external payment provider creates the local record first, then calls the provider. This ensures the idempotency key (local record ID) exists before the external call. (Domain FAQ Q4)

### Idempotency Keys Equal Local Record IDs

The idempotency key for each provider call is always the ID of the corresponding local record:
- `createSession`: `paymentSession.id`
- `authorizePayment`: `session.id`
- `capturePayment`: `capture.id`
- `refundPayment`: `refund.id`
- `cancelPayment`: `payment.id`
- `createAccountHolder`: `customer.id`

This ensures crash-resilient idempotency: the local record survives crashes and retries use the same key. (Domain FAQ Q5)

### Collection Status is Always Recomputed, Never Incremented

After every authorize, capture, or refund, the collection status is recomputed from aggregate amounts by reloading all related records. There is no incremental state machine. (Domain FAQ Q2)

### Auto-Capture Coercion

When a provider returns `CAPTURED` during authorization, the status is coerced to `AUTHORIZED` locally, and the capture flow is run explicitly with `is_captured: true`. This ensures every capture has a local record regardless of provider behavior. (Domain FAQ Q3)

## Validation Rules

- `paymentCollectionId` must be a valid collection ID (enforced by the underlying service's retrieve/create).
- `provider_id` must resolve to a registered provider in the DI container (enforced by `PaymentProviderService.retrieveProvider`).
- Capture and refund amounts must be positive and within their respective ceilings.
- Account holder updates require `context.account_holder` to be present; otherwise `INVALID_DATA` is thrown.
