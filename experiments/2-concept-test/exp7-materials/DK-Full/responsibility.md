# Responsibility -- Medusa Payment Module

## What This Module Does

The Payment Module is the orchestration layer between Medusa's commerce engine and external payment providers (Stripe, PayPal, etc.). It manages the full payment lifecycle: collecting payment intent, creating sessions with providers, authorizing funds, capturing money, issuing refunds, and canceling payments.

### Core Responsibilities

1. **Payment Collection Management** -- Creates, updates, upserts, and completes payment collections. A payment collection groups one or more payment sessions that together cover the total amount owed (e.g., an order total). Status is recomputed from aggregate amounts after every authorize/capture/refund operation.

2. **Payment Session Lifecycle** -- Creates sessions (local record + provider session), updates them, deletes them. A session represents a single payment attempt within a collection, tied to a specific provider.

3. **Authorization** -- Sends authorization requests to external providers. If the provider returns AUTHORIZED or CAPTURED, creates a local Payment record. Handles the auto-capture coercion pattern (provider CAPTURED -> local AUTHORIZED -> explicit capture flow). Idempotent: re-authorizing an already-authorized session returns the existing payment.

4. **Capture** -- Records partial or full captures against authorized payments. Validates capture amounts against the remaining authorized balance. Creates a local Capture record before calling the provider. Handles the already-captured case (auto-capture / `is_captured` flag) by skipping the provider call while still recording locally.

5. **Refund** -- Records partial or full refunds against captured payments. Validates refund amounts against the captured balance (not authorized). Creates a local Refund record before calling the provider.

6. **Cancellation** -- Cancels a payment by calling the provider's cancel endpoint and recording `canceled_at` locally.

7. **Payment Collection Status Recomputation** -- After every authorize, capture, or refund, reloads all sessions/captures/refunds from the database and recomputes the collection's status and aggregate amounts from scratch.

8. **Provider Abstraction** -- The `PaymentProviderService` acts as a thin facade over provider plugins. It resolves provider instances from the DI container and delegates calls, adding no business logic of its own. Gracefully handles providers that do not support optional operations (account holders, payment methods) by logging warnings and returning empty results.

9. **Account Holder Management** -- Creates, updates, and deletes account holders through providers. Account holders represent saved customer identities at the provider level.

10. **Payment Method Management** -- Lists and saves payment methods (e.g., saved cards) by delegating entirely to the provider.

11. **Webhook Processing** -- Accepts incoming webhook payloads, resolves the provider from the event data, and delegates interpretation to the provider.

## What This Module Does NOT Do

- **Does not process actual money transfers.** All real money movement is delegated to external provider plugins. This module only orchestrates the local state and the calls to those providers.
- **Does not define payment provider behavior.** Providers are injected plugins implementing `IPaymentProvider`. The module only calls their interface methods.
- **Does not manage orders, carts, or products.** It receives a `payment_collection_id` from the commerce layer but has no knowledge of what is being paid for.
- **Does not handle payment routing or provider selection.** The caller specifies which `provider_id` to use; the module does not choose.
- **Does not perform currency conversion.** All amounts stay in the currency specified by the caller. It only rounds to currency precision for comparison purposes.
- **Does not persist webhook events.** It interprets them and returns action data, but the caller is responsible for acting on the result.
- **Does not implement retry logic for provider calls.** If a provider call fails, the module rolls back local state and throws. Retry decisions are left to the caller.
- **Does not enforce payment method validation (e.g., card expiry, CVV).** That is the provider's domain.
