# Domain Knowledge FAQ -- Partial Version

These are answers from a domain expert (product owner / senior payment engineer) to a subset of questions about the Medusa payment module's design decisions. This document simulates partial domain knowledge transfer -- the developer only asked the most business-oriented questions.

---

## Q1: Why does refund ceiling use captured amount, not authorized amount?

Authorization is a hold, not a transfer. The captured amount represents actual money moved. Refunding more than captured would mean refunding money that was never actually taken from the customer's account.

In the real world: you authorize $100 (bank puts a $100 hold), capture $60 (bank transfers $60), the remaining $40 hold is released automatically. You can only refund up to $60.

The constraint is: `capturedAmount >= (refundedAmount + newRefund)`. This protects against attempting to return money the merchant never received.

---

## Q2: Why does auto-capture coerce provider CAPTURED to AUTHORIZED?

Some providers report CAPTURED immediately when the system intended to only authorize. We coerce this to AUTHORIZED and then explicitly capture, because from OUR system's perspective, capture is always a separate step with its own local record, its own idempotency key, and its own rollback handling.

If we accepted CAPTURED directly, we would skip the capture flow and lose traceability. The provider may have captured, but we need our internal system to go through the proper capture ceremony.

Specifically, the authorization handler:

1. Detects the provider returned CAPTURED instead of AUTHORIZED
2. Sets the session status to AUTHORIZED (not CAPTURED)
3. Creates the Payment record
4. Immediately calls `capturePayment` internally with an `is_captured: true` flag

The `is_captured` flag tells the capture flow to skip the provider.capturePayment call (since the provider already captured) but still creates a local Capture record and updates `payment.captured_at`. This ensures every capture has a local record regardless of whether the provider initiated it.
