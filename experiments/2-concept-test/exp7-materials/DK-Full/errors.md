# Errors -- Medusa Payment Module

## Error Conditions

### Capture Exceeds Remaining Authorization

**Trigger:** `capturePayment_` when `newCaptureAmount > (authorizedAmount - capturedAmount)`, after rounding to currency precision.

**Error:** `MedusaError(INVALID_DATA, "You cannot capture more than the authorized amount substracted by what is already captured.")`

**Context:** The caller attempted to capture more money than is available. The comparison accounts for partial captures already recorded.

### Capture on Canceled Payment

**Trigger:** `capturePayment_` when `payment.canceled_at` is truthy.

**Error:** `MedusaError(INVALID_DATA, "The payment: ${payment.id} has been canceled.")`

**Context:** Once a payment is canceled, no further captures are allowed. The canceled state is terminal for the capture path.

### Refund Exceeds Captured Amount

**Trigger:** `refundPayment_` when `capturedAmount < (refundedAmount + newRefundAmount)`.

**Error:** `MedusaError(INVALID_DATA, "You cannot refund more than what is captured on the payment.")`

**Context:** Refund ceiling is based on captured amount, not authorized amount. The check compares total refunded (existing + new) against total captured.

### Authorization Not Granted by Provider

**Trigger:** `authorizePaymentSession` when the provider returns a status that is neither `AUTHORIZED` nor `CAPTURED`.

**Error:** `MedusaError(NOT_ALLOWED, "Session: ${session.id} was not authorized with the provider.")`

**Side effect:** The session is updated with the provider's returned status and data before the error is thrown. This means the session reflects the provider's actual status (e.g., `REQUIRES_MORE`, `ERROR`, `PENDING`).

### Missing Account Holder Context on Update

**Trigger:** `updateAccountHolder` when `input.context?.account_holder` is falsy.

**Error:** `MedusaError(INVALID_DATA, "Missing account holder data while updating account holder.")`

**Context:** The update flow requires the existing account holder context to be passed in for the provider to identify which account to update.

### Provider Not Found (DI Resolution Failure)

**Trigger:** `PaymentProviderService.retrieveProvider` when the DI container cannot resolve the provider ID.

**Error (AwilixResolutionError):** `Error("Unable to retrieve the payment provider with id: ${providerId}\nPlease make sure that the provider is registered in the container and it is configured correctly in your project configuration file.")`

**Error (other):** `Error("Unable to retrieve the payment provider with id: ${providerId}, the following error occurred: ${err.message}")`

**Side effect:** The full error is logged before throwing a user-friendly message.

## Failure Modes and Rollback Behaviors

### createPaymentSession -- Provider Failure

**Scenario:** Local session record was created, but the provider's `initiatePayment` call failed.

**Rollback:** Delete the local session record. The provider was never touched successfully, so no provider cleanup is needed.

### createPaymentSession -- Local Update Failure After Provider Success

**Scenario:** Local session was created, provider returned data successfully, but updating the local session with provider data failed.

**Rollback:** Delete the provider-side session first (`deleteSession`), then delete the local session. Both sides are cleaned up.

### authorizePaymentSession -- Local Write Failure

**Scenario:** Provider authorized the payment, but creating the local Payment record or updating the session failed.

**Rollback:** Call `provider.cancelPayment` to reverse the authorization at the provider level. The idempotency key is `payment.id` (which may be undefined if the payment creation itself failed).

### capturePayment -- Provider Failure

**Scenario:** Local Capture record was created, but the provider's `capturePayment` call failed.

**Rollback:** Delete the local Capture record via `super.deleteCaptures({ id: capture.id })`.

### refundPayment -- Provider Failure

**Scenario:** Local Refund record was created, but the provider's `refundPayment` call failed.

**Rollback:** Delete the local Refund record via `super.deleteRefunds({ id: refund.id })`.

### deleteAccountHolder -- Partial Failure Risk

**Scenario:** Local account holder record is deleted successfully, but the subsequent provider `deleteAccountHolder` call fails.

**Observation:** Unlike other operations, `deleteAccountHolder` deletes the local record first, then calls the provider. If the provider call fails, the local record is already gone. There is no rollback for this case -- the error propagates but the local record is lost. This is an asymmetry compared to the typical create-local-first pattern. The provider-side account holder would remain orphaned.

### General -- Serialization Failure

**Scenario:** The database operation succeeds but `baseRepository_.serialize` fails.

**Impact:** The operation completed successfully at the data level, but the caller receives an error. Since serialization happens outside the transaction, the data changes are committed. This is generally safe because serialization failures are rare and the data is consistent.

## Edge Cases

### Zero-Amount Currency Precision

**Case:** A currency code that `Intl.NumberFormat` does not recognize.

**Behavior:** The `roundToCurrencyPrecision` method catches the error silently and returns the amount without rounding (full precision). Comparisons proceed with unrounded values. This means unknown currencies get exact-match comparisons rather than precision-adjusted ones.

### Provider Returns Empty for Account Holder Creation

**Case:** The provider does not support `createAccountHolder` or returns an empty result.

**Behavior:** `PaymentProviderService.createAccountHolder` returns `{}` with a warning log. In `PaymentModuleService.createAccountHolder`, `isPresent({})` is falsy, so no local record is created. The serialized return value for `undefined` is returned.

### Re-authorization of Already Authorized Session

**Case:** `authorizePaymentSession` is called on a session that already has a payment and `authorized_at`.

**Behavior:** Returns the existing payment immediately without any provider call. This is the explicit idempotency mechanism.

### Capture of Already Fully-Captured Payment

**Case:** `capturePayment` is called when `payment.captured_at` is already set.

**Behavior:** Returns `{ isFullyCaptured: true }` with no new Capture record created. The provider is not called. The collection status may still be recomputed.
