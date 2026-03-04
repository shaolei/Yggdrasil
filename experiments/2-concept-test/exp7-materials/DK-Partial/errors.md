# Errors and Failure Modes -- Medusa Payment Module

## Explicit Error Throws

### E1: Capture exceeds remaining authorized amount

**Condition:** `newCaptureAmount > (authorizedAmount - sum(existingCaptures))` after currency-precision rounding.

**Error:** `MedusaError.Types.INVALID_DATA` -- "You cannot capture more than the authorized amount substracted by what is already captured."

**Code location:** `capturePayment_` method.

**Trigger scenario:** Attempting a partial capture where the amount exceeds the remaining uncaptured authorization, or attempting to capture after the full amount has already been captured via multiple partial captures.

---

### E2: Capture on canceled payment

**Condition:** `payment.canceled_at` is set (truthy).

**Error:** `MedusaError.Types.INVALID_DATA` -- "The payment: {payment.id} has been canceled."

**Code location:** `capturePayment_` method.

**Trigger scenario:** Attempting to capture a payment that was previously canceled via `cancelPayment`.

---

### E3: Refund exceeds captured amount

**Condition:** `capturedAmount < (refundedAmount + newRefundAmount)`.

**Error:** `MedusaError.Types.INVALID_DATA` -- "You cannot refund more than what is captured on the payment."

**Code location:** `refundPayment_` method.

**Trigger scenario:** Attempting to refund more than the sum of all captures (not the authorized amount). See domain FAQ Q1 for the business rationale.

---

### E4: Authorization denied by provider

**Condition:** Provider returns a status that is neither `AUTHORIZED` nor `CAPTURED`.

**Error:** `MedusaError.Types.NOT_ALLOWED` -- "Session: {session.id} was not authorized with the provider."

**Code location:** `authorizePaymentSession` method.

**Side effect before throw:** The session's status and data are updated to reflect the provider's response (e.g., status may be set to `REQUIRES_MORE`, `ERROR`, etc.).

**Trigger scenario:** Provider declines the authorization (insufficient funds, fraud check failure, 3DS required, etc.).

---

### E5: Missing account holder context on update

**Condition:** `input.context?.account_holder` is falsy when calling `updateAccountHolder`.

**Error:** `MedusaError.Types.INVALID_DATA` -- "Missing account holder data while updating account holder."

**Code location:** `updateAccountHolder` method.

**Trigger scenario:** Calling `updateAccountHolder` without including the existing account holder data in the context.

---

### E6: Provider not found (resolution error)

**Condition:** DI container cannot resolve the provider ID (prefixed `pp_`).

**Error (AwilixResolutionError):** Custom message -- "Unable to retrieve the payment provider with id: {providerId}. Please make sure that the provider is registered in the container and it is configured correctly in your project configuration file."

**Error (other):** "Unable to retrieve the payment provider with id: {providerId}, the following error occurred: {err.message}"

**Code location:** `PaymentProviderService.retrieveProvider` method.

**Side effect:** Full error is logged before the user-friendly message is thrown.

**Trigger scenario:** Provider not installed, misconfigured, or provider ID is incorrect.

---

## Compensating Actions on Failure (Error Recovery Patterns)

### F1: Session creation failure -- dual compensation

**Trigger:** Any error during the two-phase session creation.

**Recovery:**
1. If provider session was created (providerPaymentSession is truthy) -> call `provider.deletePayment` to remove the provider-side session.
2. If local session was created (paymentSession is truthy) -> call `paymentSessionService_.delete` to remove the local record.
3. Original error is re-thrown.

**Code location:** `createPaymentSession` catch block.

**Risk:** If the compensating deletion itself fails, the original error is still thrown but orphaned resources may remain. No explicit handling for compensation failure.

---

### F2: Authorization failure after provider success -- provider cancellation

**Trigger:** Error during local authorization steps (creating Payment record, updating session status) after the provider has already authorized.

**Recovery:** Call `provider.cancelPayment` with the payment data and idempotency key. Original error is re-thrown.

**Code location:** `authorizePaymentSession` catch block.

**Risk:** If the cancellation call fails, both the provider-side authorization and the local error state may be inconsistent. No explicit handling for cancellation failure.

---

### F3: Capture provider failure -- local record deletion

**Trigger:** Provider `capturePayment` call fails after a local Capture record has been created.

**Recovery:** Delete the local Capture record (`super.deleteCaptures`). Original error is re-thrown.

**Code location:** `capturePayment` catch block.

**Risk:** If the capture record deletion fails, the local record exists without corresponding provider state.

---

### F4: Refund provider failure -- local record deletion

**Trigger:** Provider `refundPayment` call fails after a local Refund record has been created.

**Recovery:** Delete the local Refund record (`super.deleteRefunds`). Original error is re-thrown.

**Code location:** `refundPayment` catch block.

**Risk:** If the refund record deletion fails, the local record exists without corresponding provider state.

---

## Silent Failure Modes (No Error Thrown)

### S1: Provider does not support optional capability

**Condition:** Provider implementation does not have methods for account holders, payment methods, or other optional features.

**Behavior:** `PaymentProviderService` logs a warning and returns an empty/default response (`{}` or `[]`).

**Affected operations:** `createAccountHolder`, `updateAccountHolder`, `deleteAccountHolder`, `retrieveAccountHolder`, `listPaymentMethods`, `savePaymentMethod`.

**Risk:** Callers may receive empty responses without knowing the operation was not actually performed. The warning is only visible in logs.

---

### S2: Unknown currency in precision rounding

**Condition:** `Intl.NumberFormat` throws for an unrecognized currency code.

**Behavior:** The error is caught silently and the amount retains full precision (no rounding applied).

**Risk:** Financial comparisons (capture ceiling, refund ceiling, collection status thresholds) may behave differently for unknown currencies vs. known currencies, potentially allowing or rejecting operations at slightly different thresholds.

---

### S3: Already-captured payment on subsequent capture call

**Condition:** `payment.captured_at` is already set when `capturePayment_` is called.

**Behavior:** Returns `{ isFullyCaptured: true }` with no new Capture record created. No error thrown.

**Note:** This is an intentional idempotency guard, not a failure mode. But callers receive a successful response without any new capture actually occurring.
