# Aspects -- Medusa Payment Module

Cross-cutting patterns identified across 3+ methods or operations.

---

## Aspect 1: Dual Rollback

**Name:** dual-rollback

**Description:** Every operation that coordinates local database state with an external payment provider follows a create-local-first, call-provider-second pattern. On failure, the local record is deleted (and optionally the provider state is reversed).

**Content:**

The dual-rollback pattern ensures consistency between local records and provider-side state in the absence of distributed transactions.

**Ordering invariant:** The local record is always created/modified first (reversible), then the provider is called (irreversible). This asymmetry is deliberate -- you can always delete local records, but you can never undo a provider action (you cannot un-capture money).

**Rollback rules:**
- Provider call fails: delete the local record.
- Provider call succeeds but subsequent local operation fails: call the provider's reverse operation (e.g., cancelPayment), then delete the local record.

**Methods where this pattern appears:**
- `createPaymentSession` -- create session locally, initiate with provider, update locally. Rollback: delete provider session, delete local session.
- `authorizePaymentSession` -- authorize with provider, create payment locally. Rollback: cancel at provider.
- `capturePayment` -- create Capture locally, capture with provider. Rollback: delete local Capture.
- `refundPayment` -- create Refund locally, refund with provider. Rollback: delete local Refund.

**Notable exception:** `deleteAccountHolder` breaks this pattern by deleting the local record first, then calling the provider. If the provider call fails, the local record is already gone with no rollback.

---

## Aspect 2: Idempotency Key = Local Record ID

**Name:** idempotency-keys

**Description:** The idempotency key sent to every provider call is the database ID of the corresponding local record. This ensures crash-resilient retry safety.

**Content:**

Every provider-facing call includes an `idempotency_key` in its context. The key is always derived from a persistent local record that is created before the provider call:

| Operation | Idempotency Key Source |
|---|---|
| `createSession` | `paymentSession.id` |
| `authorizePayment` | `session.id` |
| `capturePayment` | `capture.id` |
| `refundPayment` | `refund.id` |
| `cancelPayment` | `payment.id` |
| `createAccountHolder` | `customer.id` (from context) |

**Why not random UUIDs:** A retry after a crash would generate a new UUID. The provider would treat it as a new operation, causing duplicates (e.g., double charges). Since the local record survives the crash, reusing its ID guarantees the same key on retry.

**Methods where this pattern appears:**
- `createPaymentSession` (line 381: `idempotency_key: paymentSession!.id`)
- `authorizePaymentSession` (line 531: `idempotency_key: session.id`)
- `capturePaymentFromProvider_` (line 789: `idempotency_key: capture?.id`)
- `refundPaymentFromProvider_` (line 913: `idempotency_key: refund.id`)
- `cancelPayment` (line 942: `idempotency_key: payment.id`)
- `createAccountHolder` (line 1109: `idempotency_key: input.context?.customer?.id`)

---

## Aspect 3: Collection Status Recomputation

**Name:** status-recomputation

**Description:** After every state-changing operation (authorize, capture, refund), the owning payment collection's status and aggregate amounts are recomputed from scratch by reloading all related records.

**Content:**

The module does not use incremental state transitions for payment collection status. Instead, `maybeUpdatePaymentCollection_` reloads the entire collection graph (sessions, payments, captures, refunds) and derives:
- `authorized_amount` from authorized sessions
- `captured_amount` from all capture records
- `refunded_amount` from all refund records
- `status` from threshold comparisons against the collection amount

**Why recomputation over state machine:** Partial captures and partial refunds across N sessions create combinatorial explosion in valid state transitions. Recomputation from aggregates is simpler and self-correcting.

**Methods that trigger recomputation:**
- `authorizePaymentSession` (line 573)
- `capturePayment` (line 699)
- `refundPayment` (line 849)

**Methods that do NOT trigger recomputation:**
- `createPaymentSession`, `updatePaymentSession`, `deletePaymentSession`, `cancelPayment`

---

## Aspect 4: Amount Ceiling Validation

**Name:** amount-ceiling-validation

**Description:** Both capture and refund operations enforce ceiling constraints that prevent over-capturing or over-refunding, using currency-precision-aware comparisons.

**Content:**

Before creating a Capture or Refund record, the module computes the remaining capacity:

**Capture ceiling:**
```
remainingToCapture = authorizedAmount - sum(existing captures)
newCaptureAmount <= remainingToCapture  (after rounding to currency precision)
```

**Refund ceiling:**
```
capturedAmount = sum(existing captures)
refundedAmount = sum(existing refunds)
capturedAmount >= refundedAmount + newRefundAmount
```

Both comparisons use `roundToCurrencyPrecision` to avoid floating-point edge cases.

**Default behavior:** If no amount is specified, both operations default to the full payment amount.

**Methods where this pattern appears:**
- `capturePayment_` (lines 728-749)
- `refundPayment_` (lines 867-886)

---

## Aspect 5: Event Emission Decoration

**Name:** event-emission

**Description:** All public-facing methods that mutate state are decorated with `@EmitEvents()`, enabling the framework to publish domain events after successful operations.

**Content:**

The `@EmitEvents()` decorator is applied to every public method that creates, updates, or deletes data. Combined with `@InjectManager()`, this ensures events are emitted after the operation completes successfully (not during the transaction).

**Methods decorated with @EmitEvents():**
- `createPaymentCollections`
- `updatePaymentCollections`
- `upsertPaymentCollections`
- `completePaymentCollections`
- `createPaymentSession`
- `updatePaymentSession`
- `deletePaymentSession`
- `authorizePaymentSession`
- `updatePayment`
- `capturePayment`
- `refundPayment`
- `cancelPayment`
- `createAccountHolder`
- `updateAccountHolder`
- `deleteAccountHolder`
- `createPaymentMethods`

**Methods NOT decorated (read-only or internal):**
- `listPaymentProviders`, `listAndCountPaymentProviders`
- `listPaymentMethods`, `listAndCountPaymentMethods`
- `getWebhookActionAndData`
- All protected/private methods

---

## Aspect 6: Singleton/Array Polymorphism

**Name:** singleton-array-polymorphism

**Description:** Multiple public methods accept both single-item and array inputs, returning the matching shape. The internal implementation always works with arrays.

**Content:**

The pattern:
1. Public method accepts `T | T[]`
2. Normalizes to `T[]` internally
3. Processes the array
4. Returns `T` if input was singular, `T[]` if input was an array

**Methods following this pattern:**
- `createPaymentCollections` (single DTO or array)
- `updatePaymentCollections` (ID or selector)
- `upsertPaymentCollections` (single DTO or array)
- `completePaymentCollections` (single ID or array)
- `createPaymentMethods` (single DTO or array)

This keeps the internal code uniform (always arrays) while providing a convenient API for callers who often operate on single items.

---

## Aspect 7: Provider Feature Detection

**Name:** provider-feature-detection

**Description:** Optional provider capabilities (account holders, payment methods) are detected at runtime by checking method existence, with graceful degradation via warning logs and empty returns.

**Content:**

The `PaymentProviderService` checks whether the provider instance has optional methods before calling them:

```typescript
if (!provider.someOptionalMethod) {
    this.#logger.warn(`Provider ${providerId} does not support <operation>`)
    return emptyResult
}
```

**Operations with feature detection:**
- `retrieveAccountHolder`
- `createAccountHolder`
- `updateAccountHolder`
- `deleteAccountHolder`
- `listPaymentMethods`
- `savePaymentMethod`

**Operations without feature detection (assumed always present):**
- `initiatePayment`, `updatePayment`, `deletePayment`
- `authorizePayment`, `capturePayment`, `refundPayment`, `cancelPayment`
- `getPaymentStatus`, `getWebhookActionAndData`

This split reflects the difference between core payment operations (mandatory for all providers) and extended features (optional per provider).
