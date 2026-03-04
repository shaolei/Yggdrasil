# Decisions -- Medusa Payment Module

## D1: Status Recomputation Over Incremental State Machine

**Chose:** Recomputing payment collection status from aggregate amounts (total authorized, total captured, total refunded) after every operation.

**Rejected:** Traditional incremental state machine with defined transitions.

**Because:** Partial captures and partial refunds across N sessions create a combinatorial explosion of valid state combinations. With N sessions each potentially partially captured or partially refunded, the number of valid states grows exponentially. A single recomputation function that sums amounts and compares against the collection total eliminates this entire class of bugs. The trade-off is slightly more expensive (requires loading all related records every time), but it is self-correcting -- if any incremental update were ever wrong, the next recomputation would fix it. (Domain FAQ Q2)

## D2: Auto-Capture Coercion (Provider CAPTURED -> Local AUTHORIZED)

**Chose:** When a provider returns `CAPTURED` during authorization, coerce the status to `AUTHORIZED` locally and explicitly run the capture flow with `is_captured: true`.

**Rejected:** Accepting the provider's `CAPTURED` status directly and skipping the capture flow.

**Because:** Accepting CAPTURED directly would skip the capture ceremony, losing traceability. The system requires every capture to have a local Capture record, its own idempotency key, and its own rollback handling. The `is_captured` flag tells the capture flow to skip the `provider.capturePayment` call (since the provider already captured) but still creates the local record and updates `payment.captured_at`. (Domain FAQ Q3)

## D3: Local Record ID as Idempotency Key

**Chose:** Using the local record's database ID (session ID, capture ID, refund ID, etc.) as the idempotency key sent to providers.

**Rejected:** Generating UUIDs at call time.

**Because:** A retry after a crash would not have the same UUID. The process might crash after the provider received the call but before recording the response. On restart, a new UUID would be generated, and the provider would treat it as a new operation -- causing a duplicate charge. By tying the key to the persistent local record, the record survives the crash, and the retry sends the same key. (Domain FAQ Q5)

## D4: Create-Local-First, Rollback-on-Failure (Dual Rollback)

**Chose:** Creating the local record before calling the provider, deleting it on provider failure. If the provider succeeds but local update fails, calling the provider's reverse operation and then deleting the local record.

**Rejected:** Call-provider-first-then-create-local, or two-phase commit.

**Because:** Local records can always be deleted (reversible), but provider actions cannot be undone (you cannot un-capture money). The asymmetric ordering -- reversible first, then irreversible -- ensures the system can always clean up on failure. The invariant: the local record is always created first (to generate the idempotency key), and deleted on failure. The provider is never called without a local record to reference. (Domain FAQ Q4)

## D5: Refund Ceiling Based on Captured Amount, Not Authorized Amount

**Chose:** Limiting refunds to `capturedAmount - refundedAmount`.

**Rejected:** Limiting refunds to `authorizedAmount - refundedAmount`.

**Because:** Authorization is a hold, not a transfer. The captured amount represents actual money moved. Refunding more than captured would mean attempting to return money the merchant never received. (Domain FAQ Q1)

## D6: Currency-Precision Rounding for Amount Comparisons

**Chose:** Rounding amounts to the currency's native decimal precision (via `Intl.NumberFormat`) before performing ceiling and equality comparisons.

**Rejected:** Exact comparison without rounding.

**Because:** Floating-point arithmetic on `BigNumber` values can produce tiny fractional differences that would incorrectly reject valid captures or fail to detect full-capture state. Rounding to currency precision before comparison ensures amounts like $59.999999... are correctly treated as $60.00. Rationale unknown for choice of `Intl.NumberFormat` specifically, but the behavior is correct -- unknown currencies fall back to full precision.

## D7: Provider Feature Detection via Method Existence

**Chose:** Checking whether optional provider methods (`createAccountHolder`, `listPaymentMethods`, `savePaymentMethod`, etc.) exist on the provider instance before calling them, logging a warning and returning empty if absent.

**Rejected:** Requiring all providers to implement all methods, or using a capabilities registry.

**Because:** The `IPaymentProvider` interface has optional methods. Not all providers support account holders or saved payment methods. Rather than forcing providers to implement no-op stubs or maintaining a separate capability manifest, the service checks at runtime. This keeps the provider contract minimal. Rationale unknown for choosing runtime checks over a declarative capabilities approach.

## D8: Session Status Resolution Priority (Update Path)

**Chose:** When updating a payment session, status is resolved in priority order: (1) caller-provided status, (2) provider response status, (3) existing session status.

**Rejected:** Always using the provider's returned status, or always using the caller's status.

**Because:** This allows webhooks and external events to explicitly set status (caller override), while normal updates defer to the provider's assessment, with fallback to the existing status if neither provides one. The code comment states this is explicitly "eg. due to a webhook." Rationale for the specific priority ordering beyond webhook support is unknown.
