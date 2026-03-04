# Logic -- Medusa Payment Module

## 1. Payment Session Creation (two-phase with compensating cleanup)

```
Input: paymentCollectionId, CreatePaymentSessionDTO (provider_id, amount, currency_code, context, data)

1. Create local PaymentSession record (payment_collection_id, provider_id, amount, currency_code, context, data, metadata)
2. Call provider.initiatePayment with:
   - context.idempotency_key = session.id
   - data merged with session_id
   - amount, currency_code
3. Update local session with:
   - data merged from input + provider response
   - status from provider response (fallback: PENDING)
4. On ANY error:
   a. If provider session was created -> call provider.deletePayment (compensate provider side)
   b. If local session was created -> delete local session (compensate local side)
   c. Re-throw the error
```

## 2. Payment Session Update

```
Input: UpdatePaymentSessionDTO (id, data, amount, currency_code, context, status, metadata)

1. Retrieve session (id, status, data, provider_id)
2. Call provider.updatePayment with data, amount, currency_code, context
3. Update local session:
   - amount, currency_code from input
   - data from provider response
   - status priority: explicit caller status > provider response status > existing status
   - metadata from input
```

## 3. Authorization Flow

```
Input: session_id, context

1. Retrieve session with relations (payment, payment_collection)
2. IDEMPOTENCY CHECK: if session already has a payment AND authorized_at is set -> return existing payment immediately
3. Call provider.authorizePayment with:
   - data from session
   - context with idempotency_key = session.id
4. If provider status is NOT AUTHORIZED and NOT CAPTURED:
   a. Update session status and data
   b. Throw NOT_ALLOWED error
5. AUTO-CAPTURE COERCION (see domain FAQ Q2 for rationale):
   If provider returned CAPTURED:
   a. Set status to AUTHORIZED (coerce)
   b. Set isCaptured = true
6. Update session: data, status (AUTHORIZED), authorized_at = now (only if not already set)
7. Create Payment record: amount, currency_code, session reference, collection reference, provider_id, data
8. If isCaptured: immediately call capturePayment with is_captured=true flag
   (This creates a local Capture record without calling the provider again)
9. On error in step 6-8: call provider.cancelPayment to compensate, re-throw
10. Call maybeUpdatePaymentCollection_ to reconcile collection status
11. Return payment
```

**Why auto-capture coercion works this way (domain knowledge, Q2):**
Some providers report CAPTURED immediately when the system intended to only authorize. The system coerces this to AUTHORIZED and then explicitly captures because from the system's perspective, capture is always a separate step with its own local record, its own idempotency key, and its own rollback handling. If the system accepted CAPTURED directly, it would skip the capture flow and lose traceability. The `is_captured` flag tells the capture flow to skip the provider.capturePayment call (since the provider already captured) but still creates a local Capture record and updates `payment.captured_at`.

## 4. Capture Flow

```
Input: CreateCaptureDTO (payment_id, amount?, is_captured?, captured_by?)

1. Retrieve payment with relations (captures with raw_amount)
2. Determine isCaptured:
   a. If is_captured flag is set in input -> isCaptured = true
   b. Else if payment already has captured_at -> isCaptured = true (auto-captured)
3. Call capturePayment_ to validate and create local capture record:
   a. If payment.canceled_at is set -> throw INVALID_DATA
   b. If payment.captured_at is set -> return { isFullyCaptured: true } (already fully captured, no new capture record)
   c. If no amount specified -> default to full payment amount
   d. Calculate remaining = authorizedAmount - sum(existing captures)
   e. If new capture amount > remaining (after currency rounding) -> throw INVALID_DATA
   f. Calculate total captured after this capture
   g. isFullyCaptured = (totalCaptured >= authorizedAmount) after currency rounding
   h. Create Capture record (payment, amount, captured_by)
4. Call capturePaymentFromProvider_:
   a. If NOT isCaptured -> call provider.capturePayment, update payment data and captured_at (if fully captured)
   b. If isCaptured AND isFullyCaptured AND not already captured_at -> update captured_at only
5. On provider error: delete the capture record, re-throw
6. Call maybeUpdatePaymentCollection_ to reconcile
7. Return payment
```

## 5. Refund Flow

```
Input: CreateRefundDTO (payment_id, amount?, created_by?, note?, refund_reason_id?)

1. Retrieve payment with relations (captures.raw_amount, refunds.raw_amount)
2. Call refundPayment_ to validate and create local refund:
   a. If no amount specified -> default to full payment amount
   b. capturedAmount = sum(all captures)
   c. refundedAmount = sum(all existing refunds)
   d. totalRefundedAmount = refundedAmount + new refund amount
   e. If capturedAmount < totalRefundedAmount -> throw INVALID_DATA
   f. Create Refund record (payment, amount, created_by, note, refund_reason_id)
3. Call refundPaymentFromProvider_:
   a. Call provider.refundPayment with data, amount, idempotency_key = refund.id
   b. Update payment data from provider response
4. On provider error: delete the refund record, re-throw
5. Call maybeUpdatePaymentCollection_ to reconcile
6. Return payment with refunds relation
```

**Why refund ceiling uses captured amount (domain knowledge, Q1):**
Authorization is a hold, not a transfer. The captured amount represents actual money moved. Refunding more than captured would mean refunding money that was never actually taken from the customer's account. The constraint is: `capturedAmount >= (refundedAmount + newRefund)`.

## 6. Payment Collection Status Reconciliation (maybeUpdatePaymentCollection_)

```
Input: paymentCollectionId

1. Retrieve collection with relations: payment_sessions, payments.captures, payments.refunds
2. Compute:
   - authorizedAmount = sum of amounts from sessions with status AUTHORIZED
   - capturedAmount = sum of all capture amounts
   - refundedAmount = sum of all refund amounts
3. Determine status:
   - No sessions -> NOT_PAID
   - Has sessions but no authorized -> AWAITING
   - authorizedAmount > 0 but < collection.amount -> PARTIALLY_AUTHORIZED
   - authorizedAmount >= collection.amount -> AUTHORIZED
   - capturedAmount >= collection.amount -> COMPLETED (also sets completedAt)
4. Update collection with: status, authorized_amount, captured_amount, refunded_amount, completed_at
```

All amount comparisons use currency-precision rounding via `roundToCurrencyPrecision`.

## 7. Currency Precision Rounding

```
Input: amount (BigNumberInput), currencyCode (string)

1. Use Intl.NumberFormat to determine the decimal precision for the currency
2. If currency is unknown (Intl throws) -> keep full precision
3. Convert amount to that precision via MathBN.convert
```

## 8. Account Holder Management

### Create:
```
1. If context already contains an account_holder -> return it directly (short-circuit / reuse)
2. Call provider.createAccountHolder with idempotency_key = customer.id
3. If provider returns a present value -> create local AccountHolder record (external_id, email, data, provider_id)
4. Return serialized account holder
```

### Update:
```
1. If context.account_holder is missing -> throw INVALID_DATA
2. Call provider.updateAccountHolder
3. Update local record: merge provider data if present, always update metadata
```

### Delete:
```
1. Retrieve local account holder
2. Delete local record FIRST
3. Then call provider.deleteAccountHolder
```

## 9. Payment Method Operations (provider-delegated, no local persistence)

- **List**: call provider.listPaymentMethods, normalize response to { id, data, provider_id }
- **Create (save)**: call provider.savePaymentMethod for each input, normalize response
