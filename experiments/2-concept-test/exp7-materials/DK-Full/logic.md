# Logic -- Medusa Payment Module

## Key Methods and Algorithmic Flow

### createPaymentSession

**Purpose:** Create a new payment session linking a payment collection to an external provider.

**Flow:**
1. Create a local `PaymentSession` record in the database (inside a transaction) with the collection ID, provider ID, amount, currency, context, and data.
2. Call `provider.initiatePayment()` with the session data. Pass `session.id` as the idempotency key in the context.
3. Update the local session with the provider's response data and status (defaulting to `PENDING` if the provider does not return a status).
4. **On provider call failure:** Delete the local session (rollback).
5. **On local update failure after provider success:** Delete the provider session first, then delete the local session (dual rollback).
6. Return the serialized session.

### updatePaymentSession

**Purpose:** Update an existing session's amount, currency, context, or data.

**Flow:**
1. Retrieve the session (id, status, data, provider_id).
2. Call `provider.updatePayment()` with the new data.
3. Update the local session. Status resolution order: caller-provided `data.status` > provider response status > existing session status.
4. Return the serialized updated session.

### deletePaymentSession

**Purpose:** Remove a session from both the provider and locally.

**Flow:**
1. Retrieve the session (id, data, provider_id).
2. Call `provider.deletePayment()` to remove the provider-side session.
3. Delete the local session record.

### authorizePaymentSession

**Purpose:** Authorize a payment session, creating a Payment record on success.

**Flow:**
1. Retrieve the session with its payment relation and payment collection.
2. **Idempotency check:** If `session.payment` exists AND `session.authorized_at` is set, return the existing payment immediately (no provider call).
3. Call `provider.authorizePayment()` with session data and `session.id` as the idempotency key.
4. If the provider returns a status that is NOT `AUTHORIZED` or `CAPTURED`:
   - Update the session with the returned status and data.
   - Throw `NOT_ALLOWED` error indicating authorization failed.
5. **Auto-capture coercion:** If status is `CAPTURED`, coerce it to `AUTHORIZED` and set `isCaptured = true`.
6. In a transaction (`authorizePaymentSession_`):
   a. Update the session: set status to `AUTHORIZED`, set data, set `authorized_at` if not already set.
   b. Create a `Payment` record linked to the session, collection, and provider.
   c. If `isCaptured`, immediately call `capturePayment()` with `is_captured: true` to create a local Capture record without calling the provider again.
7. **On local write failure:** Call `provider.cancelPayment()` to reverse the authorization at the provider, using `payment.id` as idempotency key.
8. Call `maybeUpdatePaymentCollection_()` to recompute collection status.
9. Return the serialized payment.

### capturePayment

**Purpose:** Capture funds (partial or full) from an authorized payment.

**Flow:**
1. Retrieve the payment with its existing captures.
2. Determine if already captured: check `is_captured` flag or `payment.captured_at`.
3. In a transaction (`capturePayment_`):
   a. **Guard:** If payment is canceled, throw `INVALID_DATA`.
   b. **Guard:** If payment already has `captured_at`, return `{ isFullyCaptured: true }` with no new capture (idempotent).
   c. If no amount specified, default to the full payment amount.
   d. Compute `capturedAmount` = sum of all existing capture `raw_amount` values.
   e. Compute `remainingToCapture` = `authorizedAmount - capturedAmount`.
   f. **Guard:** If `newCaptureAmount > remainingToCapture` (after rounding to currency precision), throw `INVALID_DATA` ("cannot capture more than authorized minus already captured").
   g. Compute `isFullyCaptured` = whether `capturedAmount + newCaptureAmount >= authorizedAmount` (after rounding).
   h. Create a local `Capture` record with payment ID, amount, and captured_by.
4. Call provider (`capturePaymentFromProvider_`):
   a. If NOT already captured (`!isCaptured`): call `provider.capturePayment()` with `capture.id` as the idempotency key. Update payment data. If fully captured, set `captured_at`.
   b. If already captured and fully captured but `captured_at` not yet set: update payment with `captured_at = now`.
5. **On provider failure:** Delete the local capture record (rollback).
6. Call `maybeUpdatePaymentCollection_()` to recompute collection status.
7. Return the serialized payment.

### refundPayment

**Purpose:** Refund funds (partial or full) from captured payments.

**Flow:**
1. Retrieve the payment with captures and refunds (including `raw_amount` for both).
2. In a transaction (`refundPayment_`):
   a. If no amount specified, default to the full payment amount.
   b. Compute `capturedAmount` = sum of capture `raw_amount` values.
   c. Compute `refundedAmount` = sum of existing refund `raw_amount` values.
   d. Compute `totalRefundedAmount` = `refundedAmount + newRefundAmount`.
   e. **Guard:** If `capturedAmount < totalRefundedAmount`, throw `INVALID_DATA` ("cannot refund more than captured").
   f. Create a local `Refund` record with payment ID, amount, created_by, note, and refund_reason_id.
3. Call `provider.refundPayment()` with `refund.id` as the idempotency key. Update payment data with provider response.
4. **On provider failure:** Delete the local refund record (rollback).
5. Call `maybeUpdatePaymentCollection_()` to recompute collection status.
6. Re-retrieve and return the payment with refunds.

### cancelPayment

**Purpose:** Cancel a payment by notifying the provider and recording locally.

**Flow:**
1. Retrieve the payment (id, data, provider_id).
2. Call `provider.cancelPayment()` with `payment.id` as the idempotency key.
3. Update the local payment record with `canceled_at = now`.
4. Re-retrieve and return the payment.

### maybeUpdatePaymentCollection_ (Status Recomputation)

**Purpose:** Recompute a payment collection's status and aggregate amounts from scratch.

**Algorithm:**
1. Retrieve the payment collection with all payment sessions, payments with their captures and refunds.
2. Compute `authorizedAmount` = sum of `amount` for all sessions with `status === AUTHORIZED`.
3. Compute `capturedAmount` = sum of `amount` from all captures across all payments.
4. Compute `refundedAmount` = sum of `amount` from all refunds across all payments.
5. Determine status:
   - If no payment sessions exist: `NOT_PAID`
   - If sessions exist but no authorized amount: `AWAITING`
   - If `authorizedAmount > 0` and `authorizedAmount >= collectionAmount` (rounded): `AUTHORIZED`
   - If `authorizedAmount > 0` but `< collectionAmount`: `PARTIALLY_AUTHORIZED`
   - If `capturedAmount >= collectionAmount` (rounded): `COMPLETED` (overrides authorization status), also set `completedAt`.
6. Update the collection with: status, authorized_amount, captured_amount, refunded_amount, completed_at.

### roundToCurrencyPrecision

**Purpose:** Round a numeric amount to the correct decimal precision for a given currency code.

**Algorithm:**
1. Use `Intl.NumberFormat` to determine the currency's decimal precision (e.g., 2 for USD, 0 for JPY).
2. If the currency code is unknown, keep full precision (no rounding).
3. Convert the amount using `MathBN.convert(amount, precision)`.

### createAccountHolder

**Purpose:** Create a customer identity at the provider level.

**Flow:**
1. If `input.context.account_holder` already exists, return it immediately (short circuit).
2. Call `provider.createAccountHolder()` with `customer.id` as idempotency key.
3. If the provider returns data (`isPresent(providerAccountHolder)`), create a local `AccountHolder` record with the external_id, email, data, and provider_id.
4. Return the serialized account holder.

### PaymentProviderService (Facade Layer)

**Pattern:** Every method follows the same structure:
1. `retrieveProvider(providerId)` -- resolve the provider from the DI container by its `pp_`-prefixed key.
2. Call the corresponding method on the provider instance.
3. For optional methods (account holders, payment methods, saving methods): check if the method exists on the provider. If not, log a warning and return an empty result.

**Error handling in retrieveProvider:**
- If the error is `AwilixResolutionError` (DI container cannot find the provider): log the full error and throw a user-friendly message instructing them to check configuration.
- For all other errors: log and rethrow with provider ID context.
