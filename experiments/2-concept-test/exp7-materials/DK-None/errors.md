# Errors

## Thrown Errors

### E1: Capture on canceled payment
- **Location:** `capturePayment_` (payment-module.ts, line 717-721)
- **Type:** `MedusaError.Types.INVALID_DATA`
- **Message:** `"The payment: ${payment.id} has been canceled."`
- **Trigger:** Attempting to capture a payment where `canceled_at` is set.
- **Recovery:** None from code. The caller must handle this error.

### E2: Capture exceeds remaining authorized amount
- **Location:** `capturePayment_` (payment-module.ts, lines 740-749)
- **Type:** `MedusaError.Types.INVALID_DATA`
- **Message:** `"You cannot capture more than the authorized amount substracted by what is already captured."` (note: "substracted" is the actual spelling in the source)
- **Trigger:** `newCaptureAmount > (authorizedAmount - alreadyCapturedAmount)` after currency precision rounding.
- **Recovery:** None from code. The caller must request a smaller capture amount.

### E3: Refund exceeds captured amount
- **Location:** `refundPayment_` (payment-module.ts, lines 881-886)
- **Type:** `MedusaError.Types.INVALID_DATA`
- **Message:** `"You cannot refund more than what is captured on the payment."`
- **Trigger:** `(existingRefundTotal + newRefundAmount) > capturedAmount`
- **Recovery:** None from code. The caller must request a smaller refund amount.

### E4: Authorization not granted by provider
- **Location:** `authorizePaymentSession` (payment-module.ts, lines 547-550)
- **Type:** `MedusaError.Types.NOT_ALLOWED`
- **Message:** `"Session: ${session.id} was not authorized with the provider."`
- **Trigger:** Provider returns a status that is neither AUTHORIZED nor CAPTURED.
- **Side effect:** The session's status and data are updated to reflect the provider's response before the error is thrown.
- **Recovery:** None from code. The caller may retry or handle the declined/pending status.

### E5: Missing account holder data on update
- **Location:** `updateAccountHolder` (payment-module.ts, lines 1138-1142)
- **Type:** `MedusaError.Types.INVALID_DATA`
- **Message:** `"Missing account holder data while updating account holder."`
- **Trigger:** `input.context?.account_holder` is falsy.
- **Recovery:** Caller must provide account holder data in the context.

### E6: Provider not found in container
- **Location:** `PaymentProviderService.retrieveProvider` (payment-provider.ts, lines 57-76)
- **Type:** `Error` (plain JavaScript Error, not MedusaError)
- **Message (AwilixResolutionError):** Multi-line message explaining the provider is not registered.
- **Message (other):** `"Unable to retrieve the payment provider with id: ${providerId}, the following error occurred: ${err.message}"`
- **Trigger:** Attempting to resolve a provider that is not registered in the DI container.
- **Side effect:** Full error details are logged before throwing.
- **Recovery:** Configuration fix required -- the provider must be registered in the container.

## Compensation Patterns (Error Handling)

### CP1: Session creation rollback
- **Location:** `createPaymentSession` (payment-module.ts, lines 398-413)
- **Behavior:** On any error during session creation:
  1. If the provider session was created (`providerPaymentSession` is truthy), delete it from the provider.
  2. If the local session was created (`paymentSession` is truthy), delete it from the local database.
  3. Re-throw the original error.
- **Gap:** No handling if the cleanup operations themselves fail.

### CP2: Authorization rollback
- **Location:** `authorizePaymentSession` (payment-module.ts, lines 561-571)
- **Behavior:** On failure of `authorizePaymentSession_` (internal authorization logic):
  1. Call `cancelPayment` on the provider to reverse the authorization.
  2. Re-throw the original error.
- **Gap:** No handling if the provider cancel call itself fails. Also, `payment?.id` is used as the idempotency key for cancel, but `payment` may be undefined if the failure occurred before payment creation (the variable is declared with `let` before the try block).

### CP3: Capture rollback
- **Location:** `capturePayment` (payment-module.ts, lines 692-697)
- **Behavior:** On failure of `capturePaymentFromProvider_`:
  1. Delete the locally created Capture record (via `super.deleteCaptures`).
  2. Re-throw the original error.
- **Gap:** No handling if the delete operation fails.

### CP4: Refund rollback
- **Location:** `refundPayment` (payment-module.ts, lines 844-847)
- **Behavior:** On failure of `refundPaymentFromProvider_`:
  1. Delete the locally created Refund record (via `super.deleteRefunds`).
  2. Re-throw the original error.
- **Gap:** No handling if the delete operation fails.

## Error Propagation

All provider calls (via PaymentProviderService) propagate errors directly. The PaymentProviderService does not wrap or transform errors from the underlying provider implementations, except for the `retrieveProvider` method which catches container resolution errors and re-throws with descriptive messages.

## Warnings (Non-Throwing)

The PaymentProviderService logs warnings (via `this.#logger.warn`) when optional provider methods are not supported:
- `createAccountHolder`, `retrieveAccountHolder`, `updateAccountHolder`, `deleteAccountHolder`
- `listPaymentMethods`, `savePaymentMethod`

These do not throw. They return empty/fallback results.
