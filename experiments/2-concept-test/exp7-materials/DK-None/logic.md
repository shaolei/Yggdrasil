# Logic

## Payment Session Creation (createPaymentSession)

1. Create a local `PaymentSession` record linked to the specified `paymentCollectionId`, storing provider_id, amount, currency_code, context, data, and metadata.
2. Call the external provider's `initiatePayment` with the session ID as an idempotency key, plus the caller-supplied context and data.
3. Update the local session record with the provider-returned data and status (defaulting to `PENDING` if the provider does not return a status).
4. **Compensation on failure:** If the provider call succeeded but a subsequent step fails, delete the provider session. If the local session was created but any step fails, delete the local session. Then re-throw.

## Payment Session Update (updatePaymentSession)

1. Retrieve the existing session (id, status, data, provider_id).
2. Call the provider's `updatePayment` with the new data, amount, currency_code, and context.
3. Update the local session with the new amount, currency_code, provider-returned data, and status. Status resolution follows a precedence chain: caller-supplied `data.status` > provider-returned `providerData.status` > existing `session.status`.

## Payment Session Deletion (deletePaymentSession)

1. Retrieve the session (id, data, provider_id).
2. Call the provider's `deletePayment` with the session data.
3. Delete the local session record.

## Payment Authorization (authorizePaymentSession)

1. Retrieve the session with its payment and payment_collection relations.
2. **Idempotency check:** If the session already has a payment AND an `authorized_at` timestamp, return the existing payment immediately.
3. Call the provider's `authorizePayment` with the session data and an idempotency key (session ID).
4. If the provider returns a status other than AUTHORIZED or CAPTURED, update the session with the returned status/data and throw a NOT_ALLOWED error.
5. **Internal authorization (authorizePaymentSession_):**
   - If the provider returned CAPTURED, treat it as AUTHORIZED but flag `isCaptured = true`.
   - Update the session: set data, status to AUTHORIZED, and `authorized_at` to now (only if not already set).
   - Create a new `Payment` record linked to the session, payment collection, and provider.
   - If `isCaptured` is true, immediately call `capturePayment` for the full amount with `is_captured = true` (indicating the provider already captured, so no provider call needed).
6. **Compensation on failure of step 5:** Call the provider's `cancelPayment` to roll back the authorization, then re-throw.
7. Recalculate the payment collection's aggregate status and amounts via `maybeUpdatePaymentCollection_`.

## Payment Capture (capturePayment)

1. Retrieve the payment with its captures (including raw_amount), plus id, data, provider_id, amount, currency_code, captured_at, canceled_at, and payment_collection_id.
2. Determine `isCaptured` flag: if explicitly passed as true, use it; otherwise check if `payment.captured_at` is set (indicating auto-capture).
3. **Internal capture (capturePayment_):**
   - Throw if the payment is canceled.
   - Return early (isFullyCaptured: true) if the payment is already fully captured (`captured_at` is set).
   - Default the capture amount to the full payment amount if none specified.
   - Calculate: capturedAmount (sum of existing captures), authorizedAmount, remainingToCapture = authorized - captured.
   - Throw if the new capture amount exceeds the remaining capturable amount (both sides rounded to currency precision).
   - Calculate whether this capture makes the payment fully captured (total captured >= authorized, both rounded to currency precision).
   - Create a `Capture` record.
4. **Provider capture (capturePaymentFromProvider_):**
   - If NOT already captured by the provider (`isCaptured` is false): call the provider's `capturePayment`, update the payment's data with the provider response, and set `captured_at` if fully captured.
   - If already captured by the provider but now fully captured: just set `captured_at` on the payment.
5. **Compensation on provider failure:** Delete the locally created Capture record, then re-throw.
6. Recalculate the payment collection's aggregate status and amounts.

## Payment Refund (refundPayment)

1. Retrieve the payment with captures and refunds (both with raw_amount), plus id, data, provider_id, amount, raw_amount, payment_collection_id.
2. **Internal refund (refundPayment_):**
   - Default the refund amount to the full payment amount if none specified.
   - Calculate capturedAmount (sum of captures) and refundedAmount (sum of existing refunds).
   - Throw if (existing refunds + new refund) exceeds capturedAmount.
   - Create a `Refund` record with payment_id, amount, created_by, note, and refund_reason_id.
3. **Provider refund (refundPaymentFromProvider_):**
   - Call the provider's `refundPayment` with the payment data, refund amount, and refund ID as idempotency key.
   - Update the payment's data with the provider response.
4. **Compensation on provider failure:** Delete the locally created Refund record, then re-throw.
5. Recalculate the payment collection's aggregate status and amounts.

## Payment Cancellation (cancelPayment)

1. Retrieve the payment (id, data, provider_id).
2. Call the provider's `cancelPayment` with the payment data and payment ID as idempotency key.
3. Set `canceled_at` to now on the payment.

## Payment Collection Status Derivation (maybeUpdatePaymentCollection_)

Triggered after authorize, capture, and refund operations. Recalculates aggregate amounts and status:

1. Retrieve the payment collection with all payment_sessions (amounts), payments.captures (amounts), and payments.refunds (amounts).
2. Sum authorized amounts from sessions with status AUTHORIZED.
3. Sum captured amounts from all captures.
4. Sum refunded amounts from all refunds.
5. Derive status:
   - No sessions: `NOT_PAID`
   - Sessions exist but no authorizations: `AWAITING`
   - authorizedAmount > 0 but < collection amount (currency-precision-rounded): `PARTIALLY_AUTHORIZED`
   - authorizedAmount >= collection amount: `AUTHORIZED`
   - capturedAmount >= collection amount: `COMPLETED` (also sets `completed_at`)
6. Update the collection with new status, authorized_amount, captured_amount, refunded_amount, and completed_at.

## Payment Collection Completion (completePaymentCollections)

Sets `completed_at` to the current date. Note: the source code contains a TODO comment indicating that validation checks (e.g., whether captured_amount equals amount) have not yet been implemented.

## Currency Precision Rounding (roundToCurrencyPrecision)

Uses `Intl.NumberFormat` to determine the decimal precision for a given currency code. Falls back to full precision for unknown currencies. Applied in capture and refund amount comparisons and in payment collection status derivation.

## Account Holder Creation (createAccountHolder)

1. If the input context already contains an `account_holder`, return it immediately (short-circuit).
2. Call the provider's `createAccountHolder` with the customer ID as idempotency key plus the full context.
3. If the provider returns a non-empty result, create a local `AccountHolder` record with external_id, email (from customer context), data, and provider_id.

## Account Holder Update (updateAccountHolder)

1. Throw if `context.account_holder` is missing.
2. Call the provider's `updateAccountHolder` with the context.
3. Update the local account holder: set data from provider response (if present), and metadata from input.

## Account Holder Deletion (deleteAccountHolder)

1. Retrieve the local account holder.
2. Delete the local record first.
3. Then call the provider's `deleteAccountHolder` with the account holder data in context.

## Payment Method Operations

- **List/ListAndCount:** Delegate to provider's `listPaymentMethods`, then normalize the response to `{id, data, provider_id}` objects.
- **Create (save):** Delegate each item to provider's `savePaymentMethod` in parallel using `promiseAll` with `aggregateErrors: true`, then normalize the response.

## Webhook Processing (getWebhookActionAndData)

Constructs the provider ID as `pp_${eventData.provider}` and delegates to the provider's `getWebhookActionAndData`.

## Provider Resolution (PaymentProviderService.retrieveProvider)

Resolves providers from the DI container by ID. Catches `AwilixResolutionError` specifically for a targeted error message, and provides a generic error message for other failures. Both paths log the full error.

## Optional Provider Capabilities

PaymentProviderService checks whether optional methods exist on the provider before calling them. The optional methods are: `createAccountHolder`, `retrieveAccountHolder`, `updateAccountHolder`, `deleteAccountHolder`, `listPaymentMethods`, `savePaymentMethod`. When missing, a warning is logged and an empty result is returned.
