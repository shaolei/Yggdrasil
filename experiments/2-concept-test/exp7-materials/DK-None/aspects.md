# Aspects

Cross-cutting patterns observed across 3 or more methods in the payment module.

---

## A1: Provider Delegation with Local State Synchronization

**Pattern:** The module creates or verifies a local record, delegates an operation to the external payment provider, then updates the local record with the provider's response data.

**Observed in:**
1. `createPaymentSession` -- create local session, call provider `initiatePayment`, update local session with provider data/status.
2. `updatePaymentSession` -- retrieve local session, call provider `updatePayment`, update local session with provider response.
3. `authorizePaymentSession` -- retrieve local session, call provider `authorizePayment`, update local session and create Payment.
4. `capturePayment` / `capturePaymentFromProvider_` -- create local Capture, call provider `capturePayment`, update local Payment data.
5. `refundPayment` / `refundPaymentFromProvider_` -- create local Refund, call provider `refundPayment`, update local Payment data.
6. `cancelPayment` -- retrieve local payment, call provider `cancelPayment`, update local payment.
7. `createAccountHolder` -- call provider `createAccountHolder`, create local record with provider response.
8. `updateAccountHolder` -- call provider `updateAccountHolder`, update local record with provider response.

**Structural observation:** The module always maintains its own record of state and treats the provider as an external system whose response data must be synced back to the local model. Provider data is stored in opaque `data` fields.

---

## A2: Compensation on Failure (Manual Rollback)

**Pattern:** When a multi-step operation fails partway through, the module explicitly cleans up previously created records in a catch block, then re-throws.

**Observed in:**
1. `createPaymentSession` -- on failure: delete provider session (if created), delete local session (if created).
2. `authorizePaymentSession` -- on failure of internal authorization: call provider `cancelPayment`.
3. `capturePayment` -- on failure of provider capture: delete locally created Capture record.
4. `refundPayment` -- on failure of provider refund: delete locally created Refund record.

**Structural observation:** Every operation that spans local persistence and a provider call has a corresponding compensation path. The compensation always cleans up in reverse order. However, no operation handles failure of the compensation itself (the cleanup calls are not wrapped in try/catch).

---

## A3: Idempotency Key Propagation

**Pattern:** Every provider call includes an `idempotency_key` in the `context` parameter, derived from the ID of the local entity being operated on.

**Observed in:**
1. `createPaymentSession` -- `idempotency_key: paymentSession.id`
2. `authorizePaymentSession` -- `idempotency_key: session.id`
3. `cancelPayment` -- `idempotency_key: payment.id`
4. `capturePaymentFromProvider_` -- `idempotency_key: capture.id`
5. `refundPaymentFromProvider_` -- `idempotency_key: refund.id`
6. `createAccountHolder` -- `idempotency_key: input.context?.customer?.id`

**Structural observation:** The local entity ID (session, payment, capture, refund) serves as the idempotency key for the corresponding provider operation. The exception is account holder creation, which uses the customer ID instead. This pattern enables safe retries of provider calls.

---

## A4: Polymorphic Input/Output (Single or Array)

**Pattern:** Public methods accept either a single item or an array, and return the corresponding shape (single DTO or array of DTOs). The internal implementation always works with arrays, and the result is unwrapped for single-item calls.

**Observed in:**
1. `createPaymentCollections` -- `CreatePaymentCollectionDTO | CreatePaymentCollectionDTO[]` -> `PaymentCollectionDTO | PaymentCollectionDTO[]`
2. `updatePaymentCollections` -- `string | FilterablePaymentCollectionProps` -> `PaymentCollectionDTO | PaymentCollectionDTO[]`
3. `upsertPaymentCollections` -- `UpsertPaymentCollectionDTO | UpsertPaymentCollectionDTO[]` -> `PaymentCollectionDTO | PaymentCollectionDTO[]`
4. `completePaymentCollections` -- `string | string[]` -> `PaymentCollectionDTO | PaymentCollectionDTO[]`
5. `createPaymentMethods` -- `CreatePaymentMethodDTO | CreatePaymentMethodDTO[]` -> `PaymentMethodDTO | PaymentMethodDTO[]`

**Structural observation:** This polymorphism is implemented via TypeScript overloads, with the implementation checking `Array.isArray(data)` at input and output boundaries. The pattern is not applied to session, authorization, capture, refund, or cancel operations (which are single-item only).

---

## A5: Decorator-Driven Transaction and Event Management

**Pattern:** Public methods are decorated with `@InjectManager()` and `@EmitEvents()`. Internal transactional methods are decorated with `@InjectTransactionManager()`.

**Observed in:**
1. `@InjectManager()` + `@EmitEvents()`: `createPaymentCollections`, `updatePaymentCollections`, `upsertPaymentCollections`, `completePaymentCollections`, `createPaymentSession`, `updatePaymentSession`, `deletePaymentSession`, `authorizePaymentSession`, `updatePayment`, `capturePayment`, `refundPayment`, `cancelPayment`, `createAccountHolder`, `updateAccountHolder`, `deleteAccountHolder`, `createPaymentMethods`.
2. `@InjectManager()` only (no events): `listPaymentProviders`, `listAndCountPaymentProviders`, `listPaymentMethods`, `listAndCountPaymentMethods`, `getWebhookActionAndData`, `maybeUpdatePaymentCollection_`, `capturePaymentFromProvider_`, `refundPaymentFromProvider_`.
3. `@InjectTransactionManager()`: `createPaymentCollections_`, `updatePaymentCollections_`, `upsertPaymentCollections_`, `createPaymentSession_`, `authorizePaymentSession_`, `capturePayment_`, `refundPayment_`.

**Structural observation:** Write operations that modify state emit events. Read-only and internal helper operations use `@InjectManager()` without events. The separation between the public method (manager-scoped) and the internal `_` suffixed method (transaction-scoped) is consistent throughout.

---

## A6: Payment Collection Aggregate Recalculation

**Pattern:** After operations that change the financial state of payments within a collection, `maybeUpdatePaymentCollection_` is called to recalculate aggregate totals and derived status.

**Observed in:**
1. `authorizePaymentSession` -- after successful authorization (line 573).
2. `capturePayment` -- after successful capture (line 699).
3. `refundPayment` -- after successful refund (line 849).

**Not observed in:**
- `cancelPayment` -- does NOT trigger collection recalculation.
- `deletePaymentSession` -- does NOT trigger collection recalculation.
- `completePaymentCollections` -- sets `completed_at` directly without recalculation.

**Structural observation:** The recalculation is triggered after any operation that affects authorized, captured, or refunded amounts. The absence of recalculation after cancel and delete may be intentional or may be a gap -- rationale unknown, no domain expert available.

---

## A7: Serialization at Public Boundaries

**Pattern:** Every public method that returns entity data passes the result through `this.baseRepository_.serialize<DTO>()` before returning.

**Observed in:** All public methods that return DTOs: `createPaymentCollections`, `updatePaymentCollections`, `upsertPaymentCollections`, `completePaymentCollections`, `createPaymentSession`, `updatePaymentSession`, `authorizePaymentSession`, `updatePayment`, `capturePayment`, `createAccountHolder`, `updateAccountHolder`, `listPaymentProviders`, `listAndCountPaymentProviders`.

**Exceptions:** `listPaymentMethods`, `listAndCountPaymentMethods`, and `createPaymentMethods` manually construct DTOs instead of serializing from entities (because payment methods have no local persistence). `refundPayment` calls `this.retrievePayment()` which presumably serializes internally.

**Structural observation:** The serialize call ensures that internal entity representations (ORM objects) are converted to clean DTOs before crossing the module boundary. This is a framework-level pattern.

---

## A8: Optional Provider Capability Checking

**Pattern:** Before calling optional provider methods, the PaymentProviderService checks whether the method exists on the provider instance. If absent, it logs a warning and returns an empty/fallback result.

**Observed in (PaymentProviderService):**
1. `createAccountHolder` -- checks `provider.createAccountHolder`
2. `retrieveAccountHolder` -- checks `provider.retrieveAccountHolder`
3. `updateAccountHolder` -- checks `provider.updateAccountHolder`
4. `deleteAccountHolder` -- checks `provider.deleteAccountHolder`
5. `listPaymentMethods` -- checks `provider.listPaymentMethods`
6. `savePaymentMethod` -- checks `provider.savePaymentMethod`

**Not applied to:** `initiatePayment`, `updatePayment`, `deletePayment`, `authorizePayment`, `capturePayment`, `cancelPayment`, `refundPayment`, `getPaymentStatus`, `getWebhookActionAndData` -- these are presumed to be required provider methods.

**Structural observation:** The `IPaymentProvider` interface has required methods (core payment operations) and optional methods (account holders, payment methods). The provider service enforces this distinction at runtime.
