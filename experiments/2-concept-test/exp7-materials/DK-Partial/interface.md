# Interface -- Medusa Payment Module

## PaymentModuleService (implements IPaymentModuleService)

### Payment Collection Operations

#### createPaymentCollections

```typescript
createPaymentCollections(
  data: CreatePaymentCollectionDTO,
  sharedContext?: Context
): Promise<PaymentCollectionDTO>

createPaymentCollections(
  data: CreatePaymentCollectionDTO[],
  sharedContext?: Context
): Promise<PaymentCollectionDTO[]>
```

Creates one or more payment collections. Accepts single or array input; return type matches input shape.

#### updatePaymentCollections

```typescript
updatePaymentCollections(
  paymentCollectionId: string,
  data: PaymentCollectionUpdatableFields,
  sharedContext?: Context
): Promise<PaymentCollectionDTO>

updatePaymentCollections(
  selector: FilterablePaymentCollectionProps,
  data: PaymentCollectionUpdatableFields,
  sharedContext?: Context
): Promise<PaymentCollectionDTO[]>
```

Updates payment collections by ID or by filter selector. When a selector is used, applies the same update data to all matching collections.

#### upsertPaymentCollections

```typescript
upsertPaymentCollections(
  data: UpsertPaymentCollectionDTO,
  sharedContext?: Context
): Promise<PaymentCollectionDTO>

upsertPaymentCollections(
  data: UpsertPaymentCollectionDTO[],
  sharedContext?: Context
): Promise<PaymentCollectionDTO[]>
```

Creates or updates payment collections. Items with an `id` are updated; items without an `id` are created. Create and update operations run in parallel via `promiseAll`.

#### completePaymentCollections

```typescript
completePaymentCollections(
  paymentCollectionId: string,
  sharedContext?: Context
): Promise<PaymentCollectionDTO>

completePaymentCollections(
  paymentCollectionId: string[],
  sharedContext?: Context
): Promise<PaymentCollectionDTO[]>
```

Sets `completed_at` to the current date on specified collections. Note: the source code contains a TODO comment questioning whether validation checks should be added (e.g., `captured_amount === amount`).

---

### Payment Session Operations

#### createPaymentSession

```typescript
createPaymentSession(
  paymentCollectionId: string,
  input: CreatePaymentSessionDTO,
  sharedContext?: Context
): Promise<PaymentSessionDTO>
```

**Parameters in CreatePaymentSessionDTO:** `provider_id`, `amount`, `currency_code`, `context`, `data`, `metadata`.

Two-phase creation: creates local record, then calls provider. On failure, compensates both sides. Returns the session with merged provider data.

#### updatePaymentSession

```typescript
updatePaymentSession(
  data: UpdatePaymentSessionDTO,
  sharedContext?: Context
): Promise<PaymentSessionDTO>
```

**Parameters in UpdatePaymentSessionDTO:** `id`, `data`, `amount`, `currency_code`, `context`, `status`, `metadata`.

Calls provider to update, then updates local record. Status priority: explicit caller status > provider response status > existing status.

#### deletePaymentSession

```typescript
deletePaymentSession(
  id: string,
  sharedContext?: Context
): Promise<void>
```

Deletes the session at the provider first, then deletes the local record.

---

### Authorization

#### authorizePaymentSession

```typescript
authorizePaymentSession(
  id: string,
  context: Record<string, unknown>,
  sharedContext?: Context
): Promise<PaymentDTO>
```

Authorizes a payment session. Idempotent: if session already has a payment with `authorized_at` set, returns existing payment. Creates a Payment record on success. If provider returns CAPTURED, coerces to AUTHORIZED and auto-captures. On local failure after provider authorization, cancels the provider-side authorization.

---

### Capture

#### capturePayment

```typescript
capturePayment(
  data: CreateCaptureDTO,
  sharedContext?: Context
): Promise<PaymentDTO>
```

**Parameters in CreateCaptureDTO:** `payment_id` (required), `amount?` (defaults to full payment amount), `is_captured?` (flag for auto-capture bypass), `captured_by?`.

Validates capture ceiling, creates a local Capture record, calls provider (unless `is_captured`), updates collection status. On provider failure, deletes the local Capture record.

Note: source code contains a TODO comment stating this method should return a Capture, not a Payment.

---

### Refund

#### refundPayment

```typescript
refundPayment(
  data: CreateRefundDTO,
  sharedContext?: Context
): Promise<PaymentDTO>
```

**Parameters in CreateRefundDTO:** `payment_id` (required), `amount?` (defaults to full payment amount), `created_by?`, `note?`, `refund_reason_id?`.

Validates refund ceiling against captured amount, creates a local Refund record, calls provider, updates collection status. On provider failure, deletes the local Refund record. Returns payment with refunds relation populated.

---

### Cancellation

#### cancelPayment

```typescript
cancelPayment(
  paymentId: string,
  sharedContext?: Context
): Promise<PaymentDTO>
```

Calls provider to cancel, then sets `canceled_at` locally. Returns the updated payment.

---

### Payment Update

#### updatePayment

```typescript
updatePayment(
  data: UpdatePaymentDTO,
  sharedContext?: Context
): Promise<PaymentDTO>
```

Local-only update (no provider call). Source code contains a NOTE comment: "currently there is no update with the provider but maybe data could be updated."

---

### Provider Listing

#### listPaymentProviders

```typescript
listPaymentProviders(
  filters?: FilterablePaymentProviderProps,
  config?: FindConfig<PaymentProviderDTO>,
  sharedContext?: Context
): Promise<PaymentProviderDTO[]>
```

#### listAndCountPaymentProviders

```typescript
listAndCountPaymentProviders(
  filters?: FilterablePaymentProviderProps,
  config?: FindConfig<PaymentProviderDTO>,
  sharedContext?: Context
): Promise<[PaymentProviderDTO[], number]>
```

---

### Account Holder Operations

#### createAccountHolder

```typescript
createAccountHolder(
  input: CreateAccountHolderDTO,
  sharedContext?: Context
): Promise<AccountHolderDTO>
```

Short-circuits if `input.context.account_holder` already exists (returns it directly). Otherwise calls provider, and if provider returns a present value, creates local record with `external_id`, `email`, `data`, `provider_id`.

#### updateAccountHolder

```typescript
updateAccountHolder(
  input: UpdateAccountHolderDTO,
  sharedContext?: Context
): Promise<AccountHolderDTO>
```

Requires `input.context.account_holder` to be present (throws INVALID_DATA otherwise). Calls provider, merges provider data if present, always updates metadata.

#### deleteAccountHolder

```typescript
deleteAccountHolder(
  id: string,
  sharedContext?: Context
): Promise<void>
```

Deletes local record first, then calls provider.

---

### Payment Method Operations

#### listPaymentMethods

```typescript
listPaymentMethods(
  filters: FilterablePaymentMethodProps,
  config?: FindConfig<PaymentMethodDTO>,
  sharedContext?: Context
): Promise<PaymentMethodDTO[]>
```

Provider-delegated. Normalizes response to `{ id, data, provider_id }`.

#### listAndCountPaymentMethods

```typescript
listAndCountPaymentMethods(
  filters: FilterablePaymentMethodProps,
  config?: FindConfig<PaymentMethodDTO>,
  sharedContext?: Context
): Promise<[PaymentMethodDTO[], number]>
```

Same as list but also returns count. Count is derived from the result array length.

#### createPaymentMethods

```typescript
createPaymentMethods(
  data: CreatePaymentMethodDTO,
  sharedContext?: Context
): Promise<PaymentMethodDTO>

createPaymentMethods(
  data: CreatePaymentMethodDTO[],
  sharedContext?: Context
): Promise<PaymentMethodDTO[]>
```

Calls `provider.savePaymentMethod` for each input item. Uses `promiseAll` with `aggregateErrors: true`. Normalizes response to `{ id, data, provider_id }`. No local persistence.

---

### Webhook

#### getWebhookActionAndData

```typescript
getWebhookActionAndData(
  eventData: ProviderWebhookPayload,
  sharedContext?: Context
): Promise<WebhookActionResult>
```

Constructs provider ID as `pp_${eventData.provider}` and delegates to the provider's `getWebhookActionAndData` method.

---

## PaymentProviderService

Thin facade between PaymentModuleService and `IPaymentProvider` implementations.

#### retrieveProvider

```typescript
retrieveProvider(providerId: string): IPaymentProvider
```

Resolves provider from DI container. Throws user-friendly error on `AwilixResolutionError`.

#### Core operations (all follow the same pattern: resolve provider, call method)

| Method | Input Type | Output Type |
|---|---|---|
| `createSession(providerId, input)` | `InitiatePaymentInput` | `InitiatePaymentOutput` |
| `updateSession(providerId, input)` | `UpdatePaymentInput` | `UpdatePaymentOutput` |
| `deleteSession(providerId, input)` | `DeletePaymentInput` | `DeletePaymentOutput` |
| `authorizePayment(providerId, input)` | `AuthorizePaymentInput` | `AuthorizePaymentOutput` |
| `getStatus(providerId, input)` | `GetPaymentStatusInput` | `GetPaymentStatusOutput` |
| `capturePayment(providerId, input)` | `CapturePaymentInput` | `CapturePaymentOutput` |
| `cancelPayment(providerId, input)` | `CancelPaymentInput` | `CancelPaymentOutput` |
| `refundPayment(providerId, input)` | `RefundPaymentInput` | `RefundPaymentOutput` |

#### Optional-capability operations (check if method exists, log warning and return empty if not)

| Method | Input Type | Output Type | Fallback |
|---|---|---|---|
| `retrieveAccountHolder(providerId, input)` | `RetrieveAccountHolderInput` | `RetrieveAccountHolderOutput` | `{}` |
| `createAccountHolder(providerId, input)` | `CreateAccountHolderInput` | `CreateAccountHolderOutput` | `{}` |
| `updateAccountHolder(providerId, input)` | `UpdateAccountHolderInput` | `UpdateAccountHolderOutput` | `{}` |
| `deleteAccountHolder(providerId, input)` | `DeleteAccountHolderInput` | `DeleteAccountHolderOutput` | `{}` |
| `listPaymentMethods(providerId, input)` | `ListPaymentMethodsInput` | `ListPaymentMethodsOutput` | `[]` |
| `savePaymentMethod(providerId, input)` | `SavePaymentMethodInput` | `SavePaymentMethodOutput` | `{}` |
| `getWebhookActionAndData(providerId, data)` | `ProviderWebhookPayload["payload"]` | `WebhookActionResult` | N/A (required) |
