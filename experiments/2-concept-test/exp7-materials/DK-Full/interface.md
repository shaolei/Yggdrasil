# Interface -- Medusa Payment Module

## Public API (PaymentModuleService)

The service implements `IPaymentModuleService` and extends `MedusaService` with auto-generated CRUD methods for all entity types. Below are the explicitly implemented methods with their signatures and behaviors.

---

### Payment Collection Operations

#### createPaymentCollections

```typescript
createPaymentCollections(data: CreatePaymentCollectionDTO, sharedContext?: Context): Promise<PaymentCollectionDTO>
createPaymentCollections(data: CreatePaymentCollectionDTO[], sharedContext?: Context): Promise<PaymentCollectionDTO[]>
```

Creates one or more payment collections. Accepts single or array input; returns matching shape.

#### updatePaymentCollections

```typescript
updatePaymentCollections(paymentCollectionId: string, data: PaymentCollectionUpdatableFields, sharedContext?: Context): Promise<PaymentCollectionDTO>
updatePaymentCollections(selector: FilterablePaymentCollectionProps, data: PaymentCollectionUpdatableFields, sharedContext?: Context): Promise<PaymentCollectionDTO[]>
```

Updates by ID (single) or by filter (returns array). When using a selector, first lists matching collections, then updates each.

#### upsertPaymentCollections

```typescript
upsertPaymentCollections(data: UpsertPaymentCollectionDTO, sharedContext?: Context): Promise<PaymentCollectionDTO>
upsertPaymentCollections(data: UpsertPaymentCollectionDTO[], sharedContext?: Context): Promise<PaymentCollectionDTO[]>
```

Creates or updates based on presence of `id` field. Items with `id` are routed to update; items without are routed to create. Both operations run in parallel.

#### completePaymentCollections

```typescript
completePaymentCollections(paymentCollectionId: string, sharedContext?: Context): Promise<PaymentCollectionDTO>
completePaymentCollections(paymentCollectionId: string[], sharedContext?: Context): Promise<PaymentCollectionDTO[]>
```

Sets `completed_at` to now. Note: source code contains a TODO indicating that validation checks (e.g., `captured_amount === amount`) are not yet implemented.

---

### Payment Session Operations

#### createPaymentSession

```typescript
createPaymentSession(paymentCollectionId: string, input: CreatePaymentSessionDTO, sharedContext?: Context): Promise<PaymentSessionDTO>
```

Creates a local session record, calls the provider to initiate, updates the session with provider data. Dual-rollback on failure. Returns the serialized session.

**Input fields (CreatePaymentSessionDTO):** `provider_id`, `amount`, `currency_code`, `context`, `data`, `metadata`.

#### updatePaymentSession

```typescript
updatePaymentSession(data: UpdatePaymentSessionDTO, sharedContext?: Context): Promise<PaymentSessionDTO>
```

Updates session data via the provider and locally. Status priority: `data.status` > `providerData.status` > `session.status`.

**Input fields (UpdatePaymentSessionDTO):** `id`, `amount`, `currency_code`, `data`, `context`, `status`, `metadata`.

#### deletePaymentSession

```typescript
deletePaymentSession(id: string, sharedContext?: Context): Promise<void>
```

Deletes from the provider first, then from the local database.

---

### Authorization

#### authorizePaymentSession

```typescript
authorizePaymentSession(id: string, context: Record<string, unknown>, sharedContext?: Context): Promise<PaymentDTO>
```

Authorizes a session with the provider. Creates a Payment record on success. Handles auto-capture coercion. Idempotent (re-calling returns existing payment). Returns the payment (not the session).

---

### Payment Operations

#### updatePayment

```typescript
updatePayment(data: UpdatePaymentDTO, sharedContext?: Context): Promise<PaymentDTO>
```

Updates a local payment record. Currently does not call the provider (code comment: "currently there is no update with the provider").

#### capturePayment

```typescript
capturePayment(data: CreateCaptureDTO, sharedContext?: Context): Promise<PaymentDTO>
```

Captures funds from an authorized payment. Supports partial captures. Creates a local Capture record, calls the provider (unless already captured), recomputes collection status.

**Input fields (CreateCaptureDTO):** `payment_id`, `amount` (optional, defaults to full), `captured_by`, `is_captured` (internal flag for auto-capture).

Note: Source contains a TODO indicating the return type should be a capture, not a payment.

#### refundPayment

```typescript
refundPayment(data: CreateRefundDTO, sharedContext?: Context): Promise<PaymentDTO>
```

Refunds funds from captured payments. Supports partial refunds. Creates a local Refund record, calls the provider, recomputes collection status.

**Input fields (CreateRefundDTO):** `payment_id`, `amount` (optional, defaults to full), `created_by`, `note`, `refund_reason_id`.

#### cancelPayment

```typescript
cancelPayment(paymentId: string, sharedContext?: Context): Promise<PaymentDTO>
```

Cancels a payment at the provider and sets `canceled_at` locally.

---

### Provider Operations

#### listPaymentProviders

```typescript
listPaymentProviders(filters?: FilterablePaymentProviderProps, config?: FindConfig<PaymentProviderDTO>, sharedContext?: Context): Promise<PaymentProviderDTO[]>
```

Lists registered payment providers.

#### listAndCountPaymentProviders

```typescript
listAndCountPaymentProviders(filters?: FilterablePaymentProviderProps, config?: FindConfig<PaymentProviderDTO>, sharedContext?: Context): Promise<[PaymentProviderDTO[], number]>
```

Lists registered payment providers with total count.

---

### Account Holder Operations

#### createAccountHolder

```typescript
createAccountHolder(input: CreateAccountHolderDTO, sharedContext?: Context): Promise<AccountHolderDTO>
```

Creates a customer identity at the provider. Short-circuits if `input.context.account_holder` already exists. If the provider does not support account holders or returns empty, no local record is created.

#### updateAccountHolder

```typescript
updateAccountHolder(input: UpdateAccountHolderDTO, sharedContext?: Context): Promise<AccountHolderDTO>
```

Updates an account holder. Requires `input.context.account_holder`; throws `INVALID_DATA` if missing. Updates local metadata regardless of whether the provider returned data.

#### deleteAccountHolder

```typescript
deleteAccountHolder(id: string, sharedContext?: Context): Promise<void>
```

Deletes locally first, then from the provider (reverse of most other operations -- the local delete happens before the provider call).

---

### Payment Method Operations

#### listPaymentMethods

```typescript
listPaymentMethods(filters: FilterablePaymentMethodProps, config?: FindConfig<PaymentMethodDTO>, sharedContext?: Context): Promise<PaymentMethodDTO[]>
```

Lists payment methods from the provider. Returns normalized objects with `id`, `data`, and `provider_id`.

#### listAndCountPaymentMethods

```typescript
listAndCountPaymentMethods(filters: FilterablePaymentMethodProps, config?: FindConfig<PaymentMethodDTO>, sharedContext?: Context): Promise<[PaymentMethodDTO[], number]>
```

Lists payment methods from the provider with count.

#### createPaymentMethods

```typescript
createPaymentMethods(data: CreatePaymentMethodDTO, sharedContext?: Context): Promise<PaymentMethodDTO>
createPaymentMethods(data: CreatePaymentMethodDTO[], sharedContext?: Context): Promise<PaymentMethodDTO[]>
```

Saves payment methods via the provider. Runs saves in parallel. Returns normalized objects.

---

### Webhook Operations

#### getWebhookActionAndData

```typescript
getWebhookActionAndData(eventData: ProviderWebhookPayload, sharedContext?: Context): Promise<WebhookActionResult>
```

Resolves the provider from `eventData.provider` (prefixed with `pp_`), delegates webhook interpretation to the provider.

---

## Auto-Generated CRUD Methods (via MedusaService)

The class extends `MedusaService` with models: `PaymentCollection`, `PaymentSession`, `Payment`, `Capture`, `Refund`, `RefundReason`, `AccountHolder`. This generates standard CRUD operations (`retrieve*`, `list*`, `listAndCount*`, `delete*`, `create*`, `update*`) for each entity.

---

## Internal/Protected Methods

| Method | Purpose |
|---|---|
| `createPaymentSession_` | Transactional local session creation |
| `authorizePaymentSession_` | Transactional authorization: update session, create payment, optional auto-capture |
| `capturePayment_` | Transactional capture: validate, create Capture record |
| `capturePaymentFromProvider_` | Non-transactional provider capture call and payment update |
| `refundPayment_` | Transactional refund: validate, create Refund record |
| `refundPaymentFromProvider_` | Non-transactional provider refund call and payment update |
| `maybeUpdatePaymentCollection_` | Recompute collection status from aggregate amounts |
| `roundToCurrencyPrecision` | Round amount to currency's native decimal precision |
