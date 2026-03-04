# State

## Entity State Models

### PaymentCollection States

Derived status, recalculated by `maybeUpdatePaymentCollection_` after authorize, capture, and refund operations.

```
NOT_PAID ──[session(s) created]──> AWAITING
AWAITING ──[partial authorization]──> PARTIALLY_AUTHORIZED
AWAITING ──[full authorization]──> AUTHORIZED
PARTIALLY_AUTHORIZED ──[full authorization]──> AUTHORIZED
AUTHORIZED ──[capturedAmount >= collectionAmount]──> COMPLETED
```

**Status derivation logic (not stored transitions -- recalculated each time):**
- `NOT_PAID`: No payment sessions exist on the collection.
- `AWAITING`: Payment sessions exist but authorized amount is zero.
- `PARTIALLY_AUTHORIZED`: Authorized amount > 0 but < collection amount (currency-precision-rounded).
- `AUTHORIZED`: Authorized amount >= collection amount (currency-precision-rounded).
- `COMPLETED`: Captured amount >= collection amount (currency-precision-rounded). Also sets `completed_at`.

**Aggregate fields updated on each recalculation:**
- `authorized_amount` -- sum of amounts from sessions with AUTHORIZED status
- `captured_amount` -- sum of amounts from all captures across all payments
- `refunded_amount` -- sum of amounts from all refunds across all payments
- `completed_at` -- set when status transitions to COMPLETED
- `status` -- derived as above

**Note:** `completePaymentCollections` also sets `completed_at` directly without status recalculation. It is unclear whether this is an alternative completion path or an unfinished feature (see TODO in source).

### PaymentSession States

```
[created] ──> PENDING (default on creation)
PENDING ──[provider authorize succeeds]──> AUTHORIZED
PENDING ──[provider authorize returns captured]──> AUTHORIZED (normalized from CAPTURED)
PENDING ──[provider authorize fails/declines]──> <provider-returned status>
AUTHORIZED ──[exists with authorized_at and payment]──> (terminal for session; payment takes over)
```

**Key fields:**
- `status`: Updated based on provider responses. CAPTURED from provider is normalized to AUTHORIZED.
- `authorized_at`: Set to `new Date()` when authorization succeeds (only if not already set).
- `data`: Provider-specific opaque data, updated on creation, authorization, and update operations.
- `provider_id`: Immutable after creation.
- `payment_collection_id`: Immutable after creation.

### Payment States

```
[created on authorization] ──[capturePayment (full)]──> captured (captured_at set)
[created on authorization] ──[capturePayment (partial)]──> partially captured (no captured_at yet)
[created on authorization] ──[cancelPayment]──> canceled (canceled_at set)
partially captured ──[capturePayment (remaining)]──> captured (captured_at set)
captured ──[refundPayment]──> captured with refund(s)
```

**Key fields:**
- `captured_at`: Set when the payment is fully captured (total captures >= authorized amount).
- `canceled_at`: Set when the payment is canceled.
- `data`: Provider-specific opaque data, updated on capture and refund operations.
- `amount` / `raw_amount`: Set at creation from the session's amount.
- `provider_id`: Carried from the session.
- `payment_collection_id`: Carried from the session.

**Implicit state rules:**
- A payment with `canceled_at` set cannot be captured (enforced by `capturePayment_`).
- A payment with `captured_at` set causes `capturePayment_` to return early (idempotent).
- There is no explicit guard preventing refund on a canceled payment (only the captured amount check applies).
- There is no explicit guard preventing cancellation of an already-captured payment.

### Capture (Immutable Record)

Created by `capturePayment_`. Fields: `payment` (FK), `amount`, `captured_by`. No state transitions -- captures are append-only records.

### Refund (Immutable Record)

Created by `refundPayment_`. Fields: `payment` (FK), `amount`, `created_by`, `note`, `refund_reason_id`. No state transitions -- refunds are append-only records.

### AccountHolder States

```
[created via provider] ──[updateAccountHolder]──> updated
[created via provider] ──[deleteAccountHolder]──> deleted (local record removed, then provider notified)
```

**Key fields:**
- `external_id`: Provider's identifier for the account holder.
- `email`: From customer context at creation time.
- `data`: Provider-specific opaque data.
- `provider_id`: The payment provider this account holder belongs to.
- `metadata`: Updatable metadata field.

**Special creation behavior:** If `input.context.account_holder` is already present, the creation short-circuits and returns the existing account holder without creating a new one.

## Cross-Entity State Relationships

1. **PaymentSession -> Payment:** A Payment is created when a session is successfully authorized. The session's `authorized_at` is set at the same time.
2. **Payment -> Captures:** Each capture operation appends a Capture record. When cumulative capture amounts reach the authorized amount, the Payment's `captured_at` is set.
3. **Payment -> Refunds:** Each refund operation appends a Refund record. Cumulative refund amounts are validated against cumulative capture amounts.
4. **PaymentCollection -> Status:** The collection's status is a derived aggregate of all its sessions' and payments' states. It is recalculated (not stored as a transition) after authorize, capture, and refund operations.
5. **PaymentSession -> PaymentCollection:** Sessions are created within a collection. The collection's status considers the authorization status of all its sessions.

## Consistency Notes

- Payment collection status is eventually consistent -- it is recalculated after each operation but could be stale between operations.
- The `is_captured` flag in capture flow tracks whether the provider already captured the payment (e.g., auto-capture scenarios), skipping the provider call while still recording the local capture state.
- `completePaymentCollections` can set `completed_at` independently of the derived status, which could create inconsistency if the collection's actual captured amount does not meet the threshold.
