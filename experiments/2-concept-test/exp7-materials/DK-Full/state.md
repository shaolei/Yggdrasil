# State -- Medusa Payment Module

## Payment Session Status

Payment sessions use `PaymentSessionStatus` values. The module does not enforce a strict state machine with defined transitions. Instead, status is set directly based on provider responses and internal logic.

### Statuses

- **PENDING** -- Default status when a session is created and the provider does not return a specific status.
- **AUTHORIZED** -- Provider confirmed authorization. Set during `authorizePaymentSession_`. Also set when provider returns CAPTURED (coercion).
- **CAPTURED** -- Provider-side status only. When received during authorization, it is coerced to AUTHORIZED locally.
- Other provider-returned statuses (e.g., `REQUIRES_MORE`, `ERROR`) -- These are stored on the session when authorization fails, before the error is thrown.

### Session Status Transitions (Observed in Code)

```
[created] -> PENDING                  (createPaymentSession: default if provider returns no status)
[created] -> {provider status}        (createPaymentSession: if provider returns a status)
PENDING   -> AUTHORIZED               (authorizePaymentSession_: provider returns AUTHORIZED or CAPTURED)
PENDING   -> {provider status}        (authorizePaymentSession: if provider returns non-AUTHORIZED/CAPTURED, before throwing error)
*         -> {caller|provider|current} (updatePaymentSession: priority-based status resolution)
```

### Session Timestamps

- `authorized_at` -- Set to `new Date()` during `authorizePaymentSession_` if currently null. Only set once.

---

## Payment Status (Implicit via Timestamps)

Payments do not have an explicit status field. Their state is determined by the presence of timestamps:

| State | Condition |
|---|---|
| Active (authorized) | `canceled_at` is null, `captured_at` is null |
| Fully captured | `captured_at` is set |
| Canceled | `canceled_at` is set |

### Payment Timestamp Transitions

```
[created]        -> payment exists, captured_at=null, canceled_at=null
                    (authorizePaymentSession_: creates Payment record)

captured_at=null -> captured_at=Date
                    (capturePaymentFromProvider_: when isFullyCaptured is true)

canceled_at=null -> canceled_at=Date
                    (cancelPayment: after provider cancellation succeeds)
```

### Important: Captured Status vs Capture Records

A payment can have Capture records without `captured_at` being set. `captured_at` is only set when the total captured equals or exceeds the authorized amount (i.e., fully captured). Partial captures create Capture records but leave `captured_at` as null.

---

## Payment Collection Status

Payment collection status is the most complex state in the module, but it is NOT a state machine. It is **recomputed from scratch** every time by `maybeUpdatePaymentCollection_`.

### Statuses (PaymentCollectionStatus)

- **NOT_PAID** -- No payment sessions exist on the collection.
- **AWAITING** -- Payment sessions exist but no authorized amount.
- **PARTIALLY_AUTHORIZED** -- Some amount is authorized but less than the collection total.
- **AUTHORIZED** -- Authorized amount >= collection amount (rounded to currency precision).
- **COMPLETED** -- Captured amount >= collection amount (rounded to currency precision). Also sets `completed_at`.

### Recomputation Algorithm

```
authorizedAmount = SUM(session.amount) WHERE session.status == AUTHORIZED
capturedAmount   = SUM(capture.amount) across all payments in the collection
refundedAmount   = SUM(refund.amount) across all payments in the collection

IF no payment sessions:
    status = NOT_PAID
ELSE:
    status = AWAITING

IF authorizedAmount > 0:
    IF round(authorizedAmount) >= round(collectionAmount):
        status = AUTHORIZED
    ELSE:
        status = PARTIALLY_AUTHORIZED

IF round(capturedAmount) >= round(collectionAmount):
    status = COMPLETED
    completedAt = now
```

### Important Properties of the Recomputation

1. **COMPLETED overrides AUTHORIZED**: If captured amount meets the threshold, status becomes COMPLETED regardless of authorization status.
2. **Refunded amount is tracked but does not affect status**: The collection stores `refunded_amount` for informational purposes, but refunds do not change the collection status (e.g., there is no REFUNDED or PARTIALLY_REFUNDED status).
3. **COMPLETED sets `completed_at`**: This is a side effect of the status recomputation, separate from the `completePaymentCollections` method which also sets `completed_at`.
4. **No CANCELED status for collections**: Even if all payments in a collection are canceled, the collection status is not set to CANCELED. It would revert to AWAITING (if sessions still exist) or NOT_PAID.

### When Recomputation Triggers

`maybeUpdatePaymentCollection_` is called after:
- `authorizePaymentSession` (after creating the Payment record)
- `capturePayment` (after the capture completes)
- `refundPayment` (after the refund completes)

It is NOT called after:
- `createPaymentSession`
- `updatePaymentSession`
- `deletePaymentSession`
- `cancelPayment`
- `completePaymentCollections` (this sets `completed_at` directly)

---

## Entity Lifecycle Summary

```
PaymentCollection:
    created -> [sessions added] -> NOT_PAID/AWAITING -> PARTIALLY_AUTHORIZED ->
    AUTHORIZED -> COMPLETED

PaymentSession:
    created(PENDING) -> AUTHORIZED -> [session is done, Payment record takes over]

Payment:
    created(active) -> [captures accumulate] -> fully captured (captured_at set)
                   \-> canceled (canceled_at set)

Capture:
    created -> [exists permanently, contributes to capturedAmount]

Refund:
    created -> [exists permanently, contributes to refundedAmount]
```
