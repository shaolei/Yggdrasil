# Interface

## PaymentModuleService -- Public API

Implements `IPaymentModuleService`. All public methods accept an optional `@MedusaContext() sharedContext?: Context` parameter for transaction propagation.

### Payment Collection Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `createPaymentCollections(data)` | `CreatePaymentCollectionDTO \| CreatePaymentCollectionDTO[]` | `PaymentCollectionDTO \| PaymentCollectionDTO[]` | Polymorphic: single returns single, array returns array |
| `updatePaymentCollections(id, data)` | `string, PaymentCollectionUpdatableFields` | `PaymentCollectionDTO` | Update by ID |
| `updatePaymentCollections(selector, data)` | `FilterablePaymentCollectionProps, PaymentCollectionUpdatableFields` | `PaymentCollectionDTO[]` | Update by filter |
| `upsertPaymentCollections(data)` | `UpsertPaymentCollectionDTO \| UpsertPaymentCollectionDTO[]` | `PaymentCollectionDTO \| PaymentCollectionDTO[]` | Routes items with `id` to update, without to create |
| `completePaymentCollections(id)` | `string \| string[]` | `PaymentCollectionDTO \| PaymentCollectionDTO[]` | Sets `completed_at` to now |

### Payment Session Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `createPaymentSession(collectionId, input)` | `string, CreatePaymentSessionDTO` | `PaymentSessionDTO` | Two-phase: local + provider |
| `updatePaymentSession(data)` | `UpdatePaymentSessionDTO` | `PaymentSessionDTO` | Updates local + delegates to provider |
| `deletePaymentSession(id)` | `string` | `void` | Deletes from provider then local |

### Payment Lifecycle Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `authorizePaymentSession(id, context)` | `string, Record<string, unknown>` | `PaymentDTO` | Idempotent; creates Payment from session |
| `updatePayment(data)` | `UpdatePaymentDTO` | `PaymentDTO` | Local-only update, no provider call |
| `capturePayment(data)` | `CreateCaptureDTO` | `PaymentDTO` | Supports partial captures; validates amounts |
| `refundPayment(data)` | `CreateRefundDTO` | `PaymentDTO` | Validates against captured total |
| `cancelPayment(paymentId)` | `string` | `PaymentDTO` | Delegates to provider, sets canceled_at |

### Account Holder Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `createAccountHolder(input)` | `CreateAccountHolderDTO` | `AccountHolderDTO` | Short-circuits if context.account_holder exists |
| `updateAccountHolder(input)` | `UpdateAccountHolderDTO` | `AccountHolderDTO` | Requires context.account_holder |
| `deleteAccountHolder(id)` | `string` | `void` | Deletes local first, then provider |

### Payment Method Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `listPaymentMethods(filters, config)` | `FilterablePaymentMethodProps, FindConfig<PaymentMethodDTO>` | `PaymentMethodDTO[]` | Provider-delegated, no local persistence |
| `listAndCountPaymentMethods(filters, config)` | `FilterablePaymentMethodProps, FindConfig<PaymentMethodDTO>` | `[PaymentMethodDTO[], number]` | Provider-delegated |
| `createPaymentMethods(data)` | `CreatePaymentMethodDTO \| CreatePaymentMethodDTO[]` | `PaymentMethodDTO \| PaymentMethodDTO[]` | Provider-delegated, parallel execution |

### Provider Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `listPaymentProviders(filters, config)` | `FilterablePaymentProviderProps, FindConfig<PaymentProviderDTO>` | `PaymentProviderDTO[]` | Lists registered providers |
| `listAndCountPaymentProviders(filters, config)` | `FilterablePaymentProviderProps, FindConfig<PaymentProviderDTO>` | `[PaymentProviderDTO[], number]` | Lists and counts providers |

### Webhook Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `getWebhookActionAndData(eventData)` | `ProviderWebhookPayload` | `WebhookActionResult` | Constructs provider ID as `pp_${eventData.provider}` |

### Inherited CRUD Methods (from MedusaService)

The class extends `MedusaService` with generated methods for: PaymentCollection, PaymentSession, Payment, Capture, Refund, RefundReason, AccountHolder. This provides standard `retrieve*`, `list*`, `listAndCount*`, `delete*` methods for each entity.

---

## PaymentProviderService -- Internal API

Not part of the public module interface. Used internally by PaymentModuleService.

### Provider Resolution

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `retrieveProvider(providerId)` | `string` | `IPaymentProvider` | Resolves from DI container; throws on failure |

### Session Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `createSession(providerId, input)` | `string, InitiatePaymentInput` | `InitiatePaymentOutput` | Delegates to `provider.initiatePayment` |
| `updateSession(providerId, input)` | `string, UpdatePaymentInput` | `UpdatePaymentOutput` | Delegates to `provider.updatePayment` |
| `deleteSession(providerId, input)` | `string, DeletePaymentInput` | `DeletePaymentOutput` | Delegates to `provider.deletePayment` |

### Payment Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `authorizePayment(providerId, input)` | `string, AuthorizePaymentInput` | `AuthorizePaymentOutput` | Required provider method |
| `capturePayment(providerId, input)` | `string, CapturePaymentInput` | `CapturePaymentOutput` | Required provider method |
| `refundPayment(providerId, input)` | `string, RefundPaymentInput` | `RefundPaymentOutput` | Required provider method |
| `cancelPayment(providerId, input)` | `string, CancelPaymentInput` | `CancelPaymentOutput` | Required provider method |
| `getStatus(providerId, input)` | `string, GetPaymentStatusInput` | `GetPaymentStatusOutput` | Required provider method |

### Account Holder Operations (Optional)

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `createAccountHolder(providerId, input)` | `string, CreateAccountHolderInput` | `CreateAccountHolderOutput` | Optional; returns empty if unsupported |
| `retrieveAccountHolder(providerId, input)` | `string, RetrieveAccountHolderInput` | `RetrieveAccountHolderOutput` | Optional; returns empty if unsupported |
| `updateAccountHolder(providerId, input)` | `string, UpdateAccountHolderInput` | `UpdateAccountHolderOutput` | Optional; returns empty if unsupported |
| `deleteAccountHolder(providerId, input)` | `string, DeleteAccountHolderInput` | `DeleteAccountHolderOutput` | Optional; returns empty if unsupported |

### Payment Method Operations (Optional)

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `listPaymentMethods(providerId, input)` | `string, ListPaymentMethodsInput` | `ListPaymentMethodsOutput` | Optional; returns `[]` if unsupported |
| `savePaymentMethod(providerId, input)` | `string, SavePaymentMethodInput` | `SavePaymentMethodOutput` | Optional; returns empty if unsupported |

### Webhook Operations

| Method | Input | Output | Notes |
|--------|-------|--------|-------|
| `getWebhookActionAndData(providerId, data)` | `string, ProviderWebhookPayload["payload"]` | `WebhookActionResult` | Required provider method |

---

## Key Data Types (Observable from Imports)

### Entities
- `PaymentCollection` -- aggregate root; has payment_sessions, payments
- `PaymentSession` -- represents a payment attempt with a provider
- `Payment` -- created upon authorization; has captures, refunds
- `Capture` -- partial or full capture of a payment
- `Refund` -- partial or full refund of a payment
- `RefundReason` -- categorization for refunds
- `AccountHolder` -- customer identity at a provider

### Statuses
- `PaymentCollectionStatus`: NOT_PAID, AWAITING, PARTIALLY_AUTHORIZED, AUTHORIZED, COMPLETED
- `PaymentSessionStatus`: PENDING, AUTHORIZED, CAPTURED (and others implied)
