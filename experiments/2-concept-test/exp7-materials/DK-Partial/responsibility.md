# Responsibility -- Medusa Payment Module

## PaymentModuleService

Orchestrates the full payment lifecycle within the Medusa commerce platform. Acts as the authoritative internal boundary for all payment operations, sitting between the commerce layer (callers) and external payment providers.

### Core responsibilities:

1. **Payment Collection management** -- CRUD and upsert for PaymentCollection aggregates, including status tracking (NOT_PAID, AWAITING, PARTIALLY_AUTHORIZED, AUTHORIZED, COMPLETED).

2. **Payment Session lifecycle** -- Create, update, and delete payment sessions. Sessions are created against a payment collection and linked to a specific provider. Session creation is a two-phase operation: create local record first, then initialize with the provider.

3. **Authorization** -- Authorize a payment session with the provider, transition session status, create a Payment record. Handles the auto-capture coercion case (provider returns CAPTURED but system treats it as AUTHORIZED then explicitly captures). This method is idempotent -- if a session already has a payment and is authorized, it returns immediately.

4. **Capture** -- Capture payments in full or partial amounts. Validates that capture does not exceed authorized amount minus already-captured amount. Tracks each capture as a separate Capture record. Determines when full capture is achieved.

5. **Refund** -- Refund payments against captured amounts. Validates refund ceiling against captured (not authorized) amount. Creates Refund records with metadata (reason, note, created_by).

6. **Cancellation** -- Cancel a payment by notifying the provider and setting `canceled_at` locally.

7. **Payment Collection status reconciliation** -- After authorization, capture, or refund, recalculates aggregate amounts (authorized, captured, refunded) and updates collection status accordingly.

8. **Account Holder management** -- Create, update, delete account holders via the provider, with local record keeping.

9. **Payment Method management** -- List, create (save) payment methods through the provider. These are provider-delegated; no local persistence.

10. **Webhook translation** -- Receive raw webhook payloads and delegate to the provider for action determination.

## PaymentProviderService

Thin adapter/facade between PaymentModuleService and individual payment provider implementations (Stripe, PayPal, etc.).

### Core responsibilities:

1. **Provider resolution** -- Look up the registered `IPaymentProvider` implementation from the dependency injection container using the provider ID (prefixed `pp_`).

2. **Method delegation** -- For each payment operation (initiate, update, delete, authorize, capture, cancel, refund, getStatus), retrieve the provider and call the corresponding interface method. No business logic -- pure delegation.

3. **Optional capability handling** -- For operations not all providers support (account holders, payment methods, webhook), checks if the method exists on the provider. If not, logs a warning and returns an empty/default response. This allows the module to work with providers of varying capability.

4. **Error wrapping** -- Catches container resolution errors (AwilixResolutionError) and provides user-friendly error messages about missing provider configuration.
