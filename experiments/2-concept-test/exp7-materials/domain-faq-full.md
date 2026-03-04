# Domain Knowledge FAQ -- Full Version

These are answers from a domain expert (product owner / senior payment engineer) to questions about the Medusa payment module's design decisions. This document simulates complete domain knowledge transfer.

---

## Q1: Why does refund ceiling use captured amount, not authorized amount?

Authorization is a hold, not a transfer. The captured amount represents actual money moved. Refunding more than captured would mean refunding money that was never actually taken from the customer's account.

In the real world: you authorize $100 (bank puts a $100 hold), capture $60 (bank transfers $60), the remaining $40 hold is released automatically. You can only refund up to $60.

The constraint is: `capturedAmount >= (refundedAmount + newRefund)`. This protects against attempting to return money the merchant never received.

---

## Q2: Why is payment collection status recomputed from scratch instead of state transitions?

We chose recomputation over incremental state machine because partial captures and partial refunds create complex intermediate states. If you have 3 sessions, 2 captured, 1 refunded -- tracking transitions for each combination is error-prone.

Recomputing from aggregate amounts (total authorized, total captured, total refunded) is simpler and self-correcting. After every capture or refund, the system reloads ALL sessions, captures, and refunds from the database and derives the status from scratch.

We considered a traditional state machine but rejected it because of the combinatorial explosion of valid states. With N sessions, each potentially partially captured or partially refunded, the number of valid state combinations grows exponentially. A single recomputation function that sums amounts and compares against the collection total eliminates this entire class of bugs.

The trade-off: recomputation is slightly more expensive (requires loading all related records every time), but it is self-correcting -- if any incremental update were ever wrong, the next recomputation would fix it.

---

## Q3: Why does auto-capture coerce provider CAPTURED to AUTHORIZED?

Some providers report CAPTURED immediately when the system intended to only authorize. We coerce this to AUTHORIZED and then explicitly capture, because from OUR system's perspective, capture is always a separate step with its own local record, its own idempotency key, and its own rollback handling.

If we accepted CAPTURED directly, we would skip the capture flow and lose traceability. The provider may have captured, but we need our internal system to go through the proper capture ceremony.

Specifically, the authorization handler:

1. Detects the provider returned CAPTURED instead of AUTHORIZED
2. Sets the session status to AUTHORIZED (not CAPTURED)
3. Creates the Payment record
4. Immediately calls `capturePayment` internally with an `is_captured: true` flag

The `is_captured` flag tells the capture flow to skip the provider.capturePayment call (since the provider already captured) but still creates a local Capture record and updates `payment.captured_at`. This ensures every capture has a local record regardless of whether the provider initiated it.

---

## Q4: What is the dual-rollback pattern and why?

Every operation that touches both our database and an external payment provider follows a specific order: create local record first, then call provider. If the provider call fails, we delete the local record (rollback). If the provider call succeeds but something else fails later, we now have both a local record and a provider-side state that need cleanup.

The key insight: we can always delete our own records, but we can NEVER undo a provider action (you cannot un-capture money). So we create locally first (reversible), then call provider (irreversible). This is asymmetric by design.

The specific patterns per operation:

- **createPaymentSession**: Create local session, call provider.createSession, update local with provider data. On provider failure: delete local session. On local update failure: delete provider session, then delete local session.
- **authorizePaymentSession**: Call provider.authorizePayment, create local payment + update session. On local write failure: call provider.cancelPayment to reverse authorization.
- **capturePayment**: Create local capture record, call provider.capturePayment. On provider failure: delete local capture.
- **refundPayment**: Create local refund record, call provider.refundPayment. On provider failure: delete local refund.

The invariant: the local record is ALWAYS created first (to generate the idempotency key), and deleted on failure. The provider is NEVER called without a local record to reference.

---

## Q5: Why do idempotency keys equal local record IDs?

The idempotency key for each provider call is the ID of the corresponding local record (capture ID for capture calls, refund ID for refund calls, session ID for session creation and authorization). This means:

1. **We always create the local record first** -- guaranteeing the key exists before the provider call
2. **If we retry, we send the same key** -- preventing duplicate charges, captures, or refunds
3. **The key is deterministic and traceable** -- you can always look up which local record corresponds to which provider operation

We considered using UUIDs generated at call time, but rejected it because a retry after a crash would not have the same UUID. The process might crash after the provider received the call but before recording the response. On restart, a new UUID would be generated, and the provider would treat it as a new operation -- resulting in a duplicate charge.

By tying the key to the persistent local record, we ensure crash-resilient idempotency. The local record survives the crash (it was written to the database before the provider call), so on retry, the same record ID is sent as the idempotency key, and the provider recognizes the duplicate.

The specific key assignments:
- `createSession`: `idempotency_key = paymentSession.id`
- `authorizePayment`: `idempotency_key = session.id`
- `capturePayment`: `idempotency_key = capture.id`
- `refundPayment`: `idempotency_key = refund.id`
- `cancelPayment`: `idempotency_key = payment.id`
- `createAccountHolder`: `idempotency_key = customer.id`
