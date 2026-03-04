# State Machine -- Medusa Payment Module

## PaymentSession Status

The session status is driven by `PaymentSessionStatus` enum values. The module does not enforce a strict state machine with forbidden transitions at the code level; instead, status changes are dictated by the flow logic. The following transitions are observable from the code.

### States

- **PENDING** -- Initial status. Set as fallback when provider does not return a status during session creation.
- **AUTHORIZED** -- Provider confirmed authorization (or coerced from CAPTURED, see D1).
- **CAPTURED** -- Provider reported captured. Note: this status is never persisted on the session by the module itself during authorization; it is coerced to AUTHORIZED. However, it may exist if set directly by a webhook or external update.
- **REQUIRES_MORE** -- Provider requires additional action (e.g., 3DS verification). Inferred from the code pattern that non-AUTHORIZED/non-CAPTURED statuses are written back to the session.
- **ERROR** -- Provider reported an error. Same inference as above.
- Other provider-specific statuses may be written to the session via `updatePaymentSession` or the authorization failure path.

### Transitions

```
[Session Created]
    |
    v
  PENDING  (default on creation if provider returns no status)
    |
    |-- updatePaymentSession --> [any status: caller > provider > existing]
    |
    |-- authorizePaymentSession (provider returns AUTHORIZED) --> AUTHORIZED
    |-- authorizePaymentSession (provider returns CAPTURED) --> AUTHORIZED (coerced)
    |-- authorizePaymentSession (provider returns other) --> [that status] + error thrown
    |
    v
  AUTHORIZED
    |
    (no further session status transitions defined in module code;
     subsequent operations act on Payment, not session)
```

### Key observations

- The session status can be set to any value via `updatePaymentSession` with an explicit `status` parameter (e.g., from a webhook). The module does not validate transitions on update.
- The AUTHORIZED status triggers `authorized_at` being set (only if not already set).
- Once a session has a Payment record and `authorized_at` is set, the authorization flow short-circuits (idempotency).

---

## Payment Lifecycle (implicit, no enum)

Payments do not have an explicit status field. Instead, their state is inferred from timestamp fields:

### State indicators

| Field | Meaning |
|---|---|
| `payment` exists | Payment has been created (authorization succeeded) |
| `captured_at` is null | Not yet fully captured |
| `captured_at` is set | Fully captured (all authorized amount captured) |
| `canceled_at` is null | Active |
| `canceled_at` is set | Canceled |

### Implicit states and transitions

```
[Payment Created] (via authorizePaymentSession)
    |
    |-- capturePayment (partial) --> captures[] grows, captured_at remains null
    |-- capturePayment (full or final partial) --> captured_at set
    |-- capturePayment (with is_captured flag) --> captured_at set if fully captured
    |
    |-- cancelPayment --> canceled_at set
    |
    |-- refundPayment --> refunds[] grows (only valid if captures exist, per refund ceiling)
```

### Constraints on transitions

- **Cannot capture after cancel:** If `canceled_at` is set, capture throws INVALID_DATA (see E2).
- **Cannot capture beyond authorized:** Capture ceiling enforced (see C1).
- **Cannot refund beyond captured:** Refund ceiling enforced (see C2).
- **Idempotent full capture:** If `captured_at` is already set, `capturePayment_` returns `{ isFullyCaptured: true }` without creating a new record.
- **No explicit constraint preventing refund after cancel**, or cancel after capture. These combinations are not guarded in the code.

---

## PaymentCollection Status

Driven by `PaymentCollectionStatus` enum. Automatically reconciled after each authorization, capture, or refund via `maybeUpdatePaymentCollection_`.

### States

- **NOT_PAID** -- No payment sessions exist.
- **AWAITING** -- Sessions exist but none are authorized.
- **PARTIALLY_AUTHORIZED** -- Some sessions authorized, but `authorizedAmount < collection.amount`.
- **AUTHORIZED** -- `authorizedAmount >= collection.amount` (after currency-precision rounding).
- **COMPLETED** -- `capturedAmount >= collection.amount` (after currency-precision rounding). Sets `completed_at`.

### Transition logic (deterministic, computed from aggregate amounts)

```
[Collection Created]
    |
    v
  NOT_PAID  (no sessions)
    |
    |-- session created --> AWAITING
    |
    v
  AWAITING  (sessions exist, none authorized)
    |
    |-- session authorized (partial) --> PARTIALLY_AUTHORIZED
    |-- session authorized (full) --> AUTHORIZED
    |
    v
  PARTIALLY_AUTHORIZED  (authorizedAmount > 0 but < collection.amount)
    |
    |-- more sessions authorized (reaching full) --> AUTHORIZED
    |
    v
  AUTHORIZED  (authorizedAmount >= collection.amount)
    |
    |-- captures reach collection.amount --> COMPLETED
    |
    v
  COMPLETED  (capturedAmount >= collection.amount, completed_at set)
```

### Key observations

- Status is always recomputed from scratch (not incremented). Every call to `maybeUpdatePaymentCollection_` recalculates all amounts from the current session, capture, and refund records.
- The `refunded_amount` is tracked on the collection but does not influence the status transitions. There is no REFUNDED status.
- All amount comparisons use `roundToCurrencyPrecision` for the collection's currency.
- There is no explicit status for "partially captured" at the collection level. The system transitions directly from AUTHORIZED to COMPLETED when the capture threshold is met.
- `completePaymentCollections` can set `completed_at` directly without going through the status reconciliation logic. This is a separate code path from the automatic COMPLETED transition.

---

## Account Holder (no formal state machine)

Account holders have a simple CRUD lifecycle with no status field. States are implicitly:

- **Exists locally + at provider** -- Normal state after creation.
- **Exists locally only** -- If provider deletion fails after local deletion succeeds (see D9 for ordering concern).
- **Does not exist** -- After successful deletion of both local and provider records.
