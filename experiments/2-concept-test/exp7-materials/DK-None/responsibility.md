# Responsibility

## PaymentModuleService

Orchestrates the full lifecycle of payments within the Medusa commerce platform. It is the public-facing service that implements the `IPaymentModuleService` interface and coordinates between internal persistence services and external payment providers.

### Core Responsibilities

1. **Payment Collection Management** -- CRUD operations (create, update, upsert, complete) on `PaymentCollection` entities. A PaymentCollection groups payment sessions, payments, captures, and refunds under a single aggregate with a status and monetary totals (authorized_amount, captured_amount, refunded_amount).

2. **Payment Session Lifecycle** -- Create, update, and delete payment sessions. Each session is associated with a specific payment provider and a payment collection. Session creation is a two-phase operation: first a local record is created, then the external provider is called; on failure, both are cleaned up.

3. **Payment Authorization** -- Authorize a payment session by calling the external provider, then creating a local `Payment` record linked to the session. If the provider returns a "captured" status, the module auto-captures the payment immediately after authorization.

4. **Payment Capture** -- Capture funds on an authorized payment. Supports partial captures (amounts less than the authorized total) and full captures. Tracks cumulative captured amounts and determines when a payment is fully captured.

5. **Payment Refund** -- Refund previously captured funds. Validates that the refund amount does not exceed the total captured amount. Creates a local `Refund` record and delegates to the external provider.

6. **Payment Cancellation** -- Cancel an authorized payment by delegating to the provider and recording a `canceled_at` timestamp.

7. **Payment Collection Status Derivation** -- After authorization, capture, or refund operations, automatically recalculates the PaymentCollection's aggregate status (NOT_PAID, AWAITING, PARTIALLY_AUTHORIZED, AUTHORIZED, COMPLETED) and monetary totals.

8. **Account Holder Management** -- Create, update, and delete account holders through external providers. Account holders represent a customer identity at the provider level.

9. **Payment Method Listing and Creation** -- List, count, and save payment methods through external providers. These are fully delegated to the provider with no local persistence.

10. **Payment Provider Listing** -- List and count registered payment providers.

11. **Webhook Processing** -- Translate incoming webhook payloads into provider-specific actions by delegating to the provider service.

## PaymentProviderService

Acts as a thin adapter layer between the PaymentModuleService and the pluggable payment provider implementations (`IPaymentProvider` interface).

### Core Responsibilities

1. **Provider Resolution** -- Resolve a payment provider instance from the dependency injection container by provider ID. Provides clear error messages when resolution fails (specifically handling `AwilixResolutionError`).

2. **Session Delegation** -- Delegate session operations (create/initiate, update, delete) to the resolved provider.

3. **Payment Operation Delegation** -- Delegate payment lifecycle operations (authorize, capture, cancel, refund, get status) to the resolved provider.

4. **Account Holder Delegation** -- Delegate account holder operations (create, retrieve, update, delete) to the resolved provider. Gracefully handles providers that do not implement these optional methods by logging a warning and returning empty results.

5. **Payment Method Delegation** -- Delegate payment method operations (list, save) to the resolved provider. Same graceful degradation for unsupported operations.

6. **Webhook Delegation** -- Delegate webhook payload interpretation to the resolved provider.

### Key Relationship

PaymentModuleService owns the business logic, state transitions, and persistence. PaymentProviderService owns the mapping from provider IDs to provider implementations, and gracefully handles the optionality of provider capabilities. The module service never accesses providers directly -- it always goes through the provider service.
