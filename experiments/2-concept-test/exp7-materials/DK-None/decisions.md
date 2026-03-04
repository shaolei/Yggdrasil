# Decisions

## D1: Two-phase session creation with manual compensation

**What was chosen:** Payment session creation follows a two-phase approach -- create the local record first, then call the external provider. On failure, manually clean up both the provider session and the local record in a catch block.

**Observable alternative patterns:** Could use a saga/orchestrator pattern, database-level transactions wrapping both operations, or an outbox pattern. None of these were chosen.

**Why:** Rationale unknown -- no domain expert available. The code shows explicit try/catch cleanup rather than relying on transactional rollback for the provider call, which cannot participate in a database transaction.

## D2: Idempotency via session/payment/refund/capture IDs

**What was chosen:** The session ID is used as an idempotency key when calling the provider for session creation and authorization. The payment ID is used as the idempotency key for cancellation. The capture ID is used for capture calls. The refund ID is used for refund calls.

**Why:** Rationale unknown -- no domain expert available. Observable intent: prevents duplicate provider operations on retry.

## D3: Authorization idempotency at the module level

**What was chosen:** `authorizePaymentSession` checks if `session.payment` and `session.authorized_at` are both set. If so, it returns the existing payment without calling the provider again (line 523-525).

**Why:** Rationale unknown -- no domain expert available. The code contains an explicit comment: "this method needs to be idempotent."

## D4: CAPTURED status from provider treated as AUTHORIZED + auto-capture

**What was chosen:** When the provider returns `PaymentSessionStatus.CAPTURED` during authorization, the module normalizes it to AUTHORIZED on the session, then triggers an immediate full capture with `is_captured = true` (which skips the provider capture call since the provider already captured).

**Why:** Rationale unknown -- no domain expert available. Observable intent: handles providers that capture immediately upon authorization, normalizing the flow to always go through the standard authorize-then-capture pipeline internally.

## D5: Compensation strategy -- cancel provider on authorization failure

**What was chosen:** If the internal `authorizePaymentSession_` call fails after the provider successfully authorized, `cancelPayment` is called on the provider (lines 562-568).

**Why:** Rationale unknown -- no domain expert available. Observable intent: prevents orphaned authorizations at the provider when local processing fails.

## D6: Compensation strategy -- delete local records on provider failure for capture and refund

**What was chosen:** If `capturePaymentFromProvider_` fails, the locally created Capture record is deleted (line 694). If `refundPaymentFromProvider_` fails, the locally created Refund record is deleted (line 845).

**Why:** Rationale unknown -- no domain expert available. Observable intent: keeps local records consistent with provider state.

## D7: Account holder deletion -- local first, then provider

**What was chosen:** `deleteAccountHolder` deletes the local record before calling the provider (lines 1183-1190). This is the opposite order of what the session creation compensation pattern uses.

**Why:** Rationale unknown -- no domain expert available. There is no compensation if the provider deletion fails, which means a provider-side orphan could exist.

## D8: Payment methods have no local persistence

**What was chosen:** Payment methods (list, create/save) are fully delegated to the provider. The module normalizes the response into a DTO shape but does not store anything locally.

**Why:** Rationale unknown -- no domain expert available. Observable intent: payment methods are owned by the provider, not the Medusa payment module.

## D9: `maybeUpdatePaymentCollection_` is called after authorize, capture, and refund

**What was chosen:** After each of these operations, the payment collection's aggregate status and amounts are recalculated from all constituent records.

**Why:** Rationale unknown -- no domain expert available. Observable intent: keeps the collection's aggregate state consistent as individual payment operations occur.

## D10: Module extends MedusaService with generated CRUD methods

**What was chosen:** `PaymentModuleService` extends `ModulesSdkUtils.MedusaService` with entity-to-DTO mappings, which auto-generates standard CRUD methods (retrieve, list, listAndCount, delete, etc.) for PaymentCollection, PaymentSession, Payment, Capture, Refund, RefundReason, and AccountHolder.

**Why:** Rationale unknown -- no domain expert available. Observable intent: follows a framework convention to avoid boilerplate CRUD implementations.

## D11: `completePaymentCollections` has unimplemented validation

**What was chosen:** The method sets `completed_at` without any validation checks. The source code contains two explicit comments: "Should we remove this and use `updatePaymentCollections` instead?" (line 334) and "TODO: what checks should be done here? e.g. captured_amount === amount?" (line 349).

**Why:** Rationale unknown -- no domain expert available. This appears to be an incomplete or deferred design decision.

## D12: Status update precedence in updatePaymentSession

**What was chosen:** When updating a session, the status resolution follows: `data.status` (caller-supplied) > `providerData.status` (provider response) > `session.status` (existing). The code has an explicit comment: "Allow the caller to explicitly set the status (eg. due to a webhook), fallback to the update response, and finally to the existing status."

**Why:** The comment explains the immediate intent. Deeper rationale (e.g., why webhooks need to override provider response) is unknown -- no domain expert available.

## Unresolved Questions from Code Comments

1. Line 334: "Should we remove this and use `updatePaymentCollections` instead?" -- regarding `completePaymentCollections`.
2. Line 349: "TODO: what checks should be done here? e.g. captured_amount === amount?" -- regarding completion validation.
3. Line 646: "TODO: This method should return a capture, not a payment" -- regarding `capturePayment` return type.
4. Line 640: "NOTE: currently there is no update with the provider but maybe data could be updated" -- regarding `updatePayment`.
