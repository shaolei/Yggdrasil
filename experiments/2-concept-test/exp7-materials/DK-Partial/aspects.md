# Cross-Cutting Patterns -- Medusa Payment Module

## A1: Compensating Action (Saga Compensation)

**Pattern:** When a multi-step operation fails partway through, previously completed steps are rolled back via compensating actions.

**Occurrences:**

1. **Session creation** (`createPaymentSession`) -- On failure: delete provider session (if created), delete local session (if created).
2. **Authorization** (`authorizePaymentSession`) -- On failure after provider authorization: call `provider.cancelPayment` to release the authorization.
3. **Capture** (`capturePayment`) -- On provider failure: delete the local Capture record.
4. **Refund** (`refundPayment`) -- On provider failure: delete the local Refund record.

**Implementation:** Try/catch blocks wrapping the provider call, with explicit cleanup in the catch block. The original error is always re-thrown after compensation.

**Limitation:** No handling for compensation failure itself. If the compensating action fails (e.g., provider.deletePayment throws during session creation cleanup), the system may be left in an inconsistent state. No retry, no dead-letter queue, no manual reconciliation flag.

---

## A2: Idempotency Key Propagation

**Pattern:** Idempotency keys are passed to every provider call to enable safe retries. The key is always derived from an existing entity ID.

**Occurrences:**

1. **Session creation** -- `idempotency_key = session.id` (passed in context to `provider.initiatePayment`).
2. **Authorization** -- `idempotency_key = session.id` (passed in context to `provider.authorizePayment`).
3. **Capture** -- `idempotency_key = capture.id` (passed in context to `provider.capturePayment`).
4. **Refund** -- `idempotency_key = refund.id` (passed in context to `provider.refundPayment`).
5. **Cancellation** -- `idempotency_key = payment.id` (passed in context to `provider.cancelPayment`).
6. **Account holder creation** -- `idempotency_key = customer.id` (passed in context to `provider.createAccountHolder`).
7. **Authorization cancellation (compensation)** -- `idempotency_key = payment.id` (passed in context to `provider.cancelPayment`).

**Implementation:** The key is always placed in the `context` object as `context.idempotency_key`. Providers are expected to use this to deduplicate requests.

---

## A3: Local-First, Then Provider (Write Path Ordering)

**Pattern:** For create/mutate operations, the system creates/updates the local record first, then calls the provider. This establishes a local record of intent before external side effects.

**Occurrences:**

1. **Session creation** -- Local PaymentSession created, then `provider.initiatePayment` called.
2. **Authorization** -- Local session updated + Payment created, then auto-capture may call provider.
3. **Capture** -- Local Capture record created via `capturePayment_`, then `provider.capturePayment` called via `capturePaymentFromProvider_`.
4. **Refund** -- Local Refund record created via `refundPayment_`, then `provider.refundPayment` called via `refundPaymentFromProvider_`.
5. **Account holder creation** -- Exception: provider is called first, then local record created only if provider returns a present value. This is the reverse of the typical pattern.

**Exception -- Delete operations use the reverse order:**
- **Session deletion** -- Provider delete first, then local delete.
- **Account holder deletion** -- Local delete first, then provider delete (note: this differs from session deletion).

**Rationale unknown** -- would need to ask product owner why the ordering differs between creation and deletion, and why account holder deletion reverses the typical delete pattern (session deletion deletes provider first; account holder deletion deletes local first).

---

## A4: Currency-Precision Rounding for Financial Comparisons

**Pattern:** All financial amount comparisons use `roundToCurrencyPrecision` which derives decimal precision from `Intl.NumberFormat` for the given currency code.

**Occurrences:**

1. **Capture ceiling validation** -- `newCaptureAmount > remainingToCapture` (in `capturePayment_`).
2. **Full capture detection** -- `totalCaptured >= authorizedAmount` (in `capturePayment_`).
3. **Collection authorized threshold** -- `authorizedAmount >= collection.amount` (in `maybeUpdatePaymentCollection_`).
4. **Collection completed threshold** -- `capturedAmount >= collection.amount` (in `maybeUpdatePaymentCollection_`).

**Not used in:** Refund ceiling comparison. The refund validation (`capturedAmount < totalRefundedAmount`) uses raw `MathBN.lt` without currency-precision rounding. This may be an inconsistency or a deliberate choice.

**Implementation:** `roundToCurrencyPrecision(amount, currencyCode)` calls `Intl.NumberFormat` with the currency, extracts decimal places from a formatted sample, and converts via `MathBN.convert`. Unknown currencies keep full precision.

---

## A5: Serialization Boundary

**Pattern:** All public methods serialize entity instances to DTOs via `baseRepository_.serialize()` before returning. Internal methods work with entity instances.

**Occurrences:** Every public method in `PaymentModuleService` that returns data (`createPaymentCollections`, `updatePaymentCollections`, `createPaymentSession`, `updatePaymentSession`, `authorizePaymentSession`, `capturePayment`, `refundPayment`, `cancelPayment`, `updatePayment`, `completePaymentCollections`, `upsertPaymentCollections`, `listPaymentProviders`, `createAccountHolder`, `updateAccountHolder`).

**Implementation:** Methods decorated with `@InjectManager()` call `this.baseRepository_.serialize<DtoType>(entity)` as their final step. Internal methods (suffixed with `_`) return raw entity instances.

---

## A6: Event Emission via Decorator

**Pattern:** Public mutating methods are decorated with `@EmitEvents()` to emit domain events after successful completion.

**Occurrences:** `createPaymentCollections`, `updatePaymentCollections`, `upsertPaymentCollections`, `completePaymentCollections`, `createPaymentSession`, `updatePaymentSession`, `deletePaymentSession`, `authorizePaymentSession`, `capturePayment`, `refundPayment`, `cancelPayment`, `updatePayment`, `createAccountHolder`, `updateAccountHolder`, `deleteAccountHolder`, `createPaymentMethods`.

**Not decorated:** Read-only methods (`listPaymentProviders`, `listAndCountPaymentProviders`, `listPaymentMethods`, `listAndCountPaymentMethods`, `getWebhookActionAndData`).

**Implementation:** The `@EmitEvents()` decorator is from `@medusajs/framework/utils`. The specific events emitted are determined by the framework infrastructure, not visible in this source file.

---

## A7: Transaction Management via Decorators

**Pattern:** Public methods use `@InjectManager()` for request-scoped entity manager injection. Internal write methods use `@InjectTransactionManager()` for transactional boundaries.

**Occurrences:**

- `@InjectManager()`: all public methods.
- `@InjectTransactionManager()`: `createPaymentCollections_`, `updatePaymentCollections_`, `upsertPaymentCollections_`, `createPaymentSession_`, `authorizePaymentSession_`, `capturePayment_`, `refundPayment_`.

**Pattern detail:** The public method (e.g., `capturePayment`) orchestrates the full flow including provider calls and compensation. The transactional internal method (e.g., `capturePayment_`) handles only the local database writes that must be atomic.

---

## A8: Optional Capability Check (Provider Feature Detection)

**Pattern:** `PaymentProviderService` checks if the provider implementation supports optional methods before calling them. If the method does not exist, a warning is logged and an empty/default value is returned.

**Occurrences:**

1. `retrieveAccountHolder` -- checks `provider.retrieveAccountHolder`, returns `{}` if missing.
2. `createAccountHolder` -- checks `provider.createAccountHolder`, returns `{}` if missing.
3. `updateAccountHolder` -- checks `provider.updateAccountHolder`, returns `{}` if missing.
4. `deleteAccountHolder` -- checks `provider.deleteAccountHolder`, returns `{}` if missing.
5. `listPaymentMethods` -- checks `provider.listPaymentMethods`, returns `[]` if missing.
6. `savePaymentMethod` -- checks `provider.savePaymentMethod`, returns `{}` if missing.

**Not optional (always required on provider):** `initiatePayment`, `updatePayment`, `deletePayment`, `authorizePayment`, `getPaymentStatus`, `capturePayment`, `cancelPayment`, `refundPayment`, `getWebhookActionAndData`.

**Implementation:** Simple `if (!provider.methodName)` check followed by `this.#logger.warn(...)` and early return.

---

## A9: Collection Status Reconciliation After Mutation

**Pattern:** After any operation that changes financial state (authorization, capture, refund), the parent PaymentCollection's status and aggregate amounts are recomputed.

**Occurrences:**

1. After `authorizePaymentSession` succeeds.
2. After `capturePayment` succeeds.
3. After `refundPayment` succeeds.

**Implementation:** `maybeUpdatePaymentCollection_(paymentCollectionId)` recomputes `authorized_amount`, `captured_amount`, `refunded_amount`, and `status` from scratch every time. The status is derived deterministically from the aggregate amounts (see state.md for the full logic).

**Not triggered by:** `cancelPayment`, `deletePaymentSession`, `updatePaymentSession`, `completePaymentCollections`. These operations may leave the collection status stale.

---

## A10: Array/Single Input Polymorphism

**Pattern:** Several public methods accept either a single DTO or an array of DTOs, and return the matching shape (single DTO or array).

**Occurrences:**

1. `createPaymentCollections(data | data[])` -- returns `DTO | DTO[]`.
2. `upsertPaymentCollections(data | data[])` -- returns `DTO | DTO[]`.
3. `completePaymentCollections(id | id[])` -- returns `DTO | DTO[]`.
4. `createPaymentMethods(data | data[])` -- returns `DTO | DTO[]`.

**Implementation:** Input is normalized to array internally (`Array.isArray(data) ? data : [data]`), processed uniformly, then the return value is unwrapped if the original input was not an array.
