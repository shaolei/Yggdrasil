# Experiment 7 -- Domain Knowledge Variance

## Hypothesis

Graph quality varies with the level of domain knowledge available to the graph-building agent. An agent with full domain FAQ answers will produce a graph that captures more WHY (decisions, rationale, constraints) and thus performs better on blindfold questions than an agent with partial or no domain knowledge.

## Experimental Design

Three agent levels build a Yggdrasil graph for the Medusa `PaymentModuleService`. Each starts with the same source code but receives different levels of domain knowledge. After graph-building, a separate evaluation agent receives ONLY the context package (no code access) and answers 5 blindfold questions.

### What Each Agent Level Receives

**Level A -- No Domain Knowledge (Code Only)**

- Source code: `packages/modules/payment/src/services/payment-module.ts`
- Source code: `packages/modules/payment/src/services/payment-provider.ts`
- No FAQ document
- Instructions: Build the graph from code analysis alone

**Level B -- Partial Domain Knowledge**

- Source code: `packages/modules/payment/src/services/payment-module.ts`
- Source code: `packages/modules/payment/src/services/payment-provider.ts`
- FAQ document: `domain-faq-partial.md` (2 of 5 questions answered)
  - Covers: refund ceiling rationale, auto-capture coercion rationale
  - Does NOT cover: status recomputation rationale, dual-rollback pattern, idempotency key design
- Instructions: Build the graph from code analysis supplemented by the FAQ

**Level C -- Full Domain Knowledge**

- Source code: `packages/modules/payment/src/services/payment-module.ts`
- Source code: `packages/modules/payment/src/services/payment-provider.ts`
- FAQ document: `domain-faq-full.md` (all 5 questions answered)
  - Covers: refund ceiling, status recomputation, auto-capture coercion, dual-rollback, idempotency keys
- Instructions: Build the graph from code analysis supplemented by the FAQ

## Graph-Building Task Prompt

The following prompt is given to each graph-building agent (with the appropriate FAQ document or none):

---

You are building a Yggdrasil semantic graph for the Medusa payment module. Your goal is to create a complete context package that would allow another agent -- with NO access to source code -- to accurately answer questions about behavior, edge cases, failure scenarios, and design trade-offs.

**Source files to analyze:**
- `packages/modules/payment/src/services/payment-module.ts` (PaymentModuleService)
- `packages/modules/payment/src/services/payment-provider.ts` (PaymentProviderService)

**[Level B/C only] Domain expert FAQ:**
The attached FAQ document contains answers from the product owner about design decisions. Incorporate these explanations into the appropriate graph artifacts (decisions.md, constraints.md, etc.). These represent authoritative WHY knowledge that cannot be derived from code alone.

**Deliverables:**
Create the following Yggdrasil artifacts for the `payment/payment-module` node:
1. `node.yaml` -- name, type, aspects, relations, file mappings
2. `responsibility.md` -- what this service does (in scope / out of scope)
3. `constraints.md` -- business rules, ceilings, invariants
4. `decisions.md` -- WHY decisions were made (not just WHAT)
5. `state.md` -- state machines and lifecycle descriptions
6. `interface.md` -- key public methods (optional if time-constrained)

Also create:
- Parent node `payment/` with `responsibility.md` describing the module scope
- Child node `payment/payment-provider` with `responsibility.md` and `interface.md`
- Any aspects (cross-cutting patterns) you identify
- Any flows (business processes) you identify

**Quality standard:** Another agent should be able to answer edge-case questions about capture ceilings, refund limits, failure recovery, status computation, and design trade-offs using ONLY your context package output.

---

## Blindfold Evaluation Questions

After each graph is built, a separate evaluation agent receives ONLY the `yg build-context --node payment/payment-module` output. The evaluation agent has NO access to source code. It must answer these 5 questions:

### Question 1: Partial Capture Ceiling

A payment is authorized for $100. The merchant captures $60 successfully. Now the merchant tries to capture $50 more. What happens and why?

### Question 2: Collection Status with Multiple Sessions

A PaymentCollection has amount=$100 and two sessions: Session A for $80 and Session B for $20. Both sessions are authorized. What is the collection status and why?

### Question 3: Provider-Succeeds-Local-Fails Scenario

A Stripe capture call succeeds (money is taken from the customer), but then the local database write fails. What happens? Walk through the error handling step by step.

### Question 4: Authorization Timeout and Retry

An authorization request times out. The caller retries. But the first request actually succeeded at the provider. What happens on retry?

### Question 5: Argue Against Changing Refund Ceiling

A junior developer proposes changing the refund ceiling from captured amount to authorized amount, arguing "it gives merchants more flexibility." Make a 3-sentence argument against this change.

## Known-Correct Answers

These answers were verified against the actual source code in Experiment B.

### Answer 1: Partial Capture Ceiling

**REJECTED.** The capture ceiling is `authorizedAmount - capturedAmount`. After capturing $60, the remaining capturable amount is $100 - $60 = $40. The new capture of $50 exceeds $40. The system throws a `MedusaError` with type `INVALID_DATA` and message: "You cannot capture more than the authorized amount substracted by what is already captured." Both the new capture amount ($50) and the remaining amount ($40) are rounded to currency precision before comparison using `roundToCurrencyPrecision`.

### Answer 2: Collection Status with Multiple Sessions

**AUTHORIZED.** The `maybeUpdatePaymentCollection_` method recomputes status from scratch. It sums all AUTHORIZED session amounts: $80 + $20 = $100. It compares `roundToCurrencyPrecision(authorizedAmount=$100) >= roundToCurrencyPrecision(collectionAmount=$100)`, which is true. Since the authorized amount meets or exceeds the collection amount, the status is `AUTHORIZED`. It is NOT `COMPLETED` because no captures have been made yet -- `COMPLETED` requires `capturedAmount >= collectionAmount`.

### Answer 3: Provider-Succeeds-Local-Fails Scenario

This is the dual-rollback pattern. For `capturePayment`:
1. A local Capture record is created FIRST (to generate the idempotency key)
2. The provider capture call is made with `idempotency_key = capture.id`
3. The provider succeeds (money is taken)
4. If something fails after the provider call, the local capture record is deleted (rolled back)

The critical nuance: the money has been taken by the provider, but the local record is cleaned up. On retry, a NEW local capture record is created with a NEW id, which means a NEW idempotency key. The provider treats this as a new request. This is a known gap -- the dual-rollback is asymmetric. The system prioritizes consistency of local state over preventing duplicate provider-side operations. In practice, payment providers have their own deduplication mechanisms, and the payment can be reconciled via webhooks.

Note: The context package from Experiment B described the provider-fail scenario well but was slightly imprecise about this specific failure direction (provider succeeds, local fails). A complete graph should explicitly document this asymmetry.

### Answer 4: Authorization Timeout and Retry

**IDEMPOTENT -- returns existing payment.** The `authorizePaymentSession` method checks at the top: if `session.payment` exists and `session.authorized_at` is set, it returns the existing payment immediately without calling the provider again. This is explicitly documented in decisions.md as "Why authorizePaymentSession is idempotent." The first request succeeded (created the Payment record, set authorized_at), so the retry finds the existing state and returns it. No duplicate payment is created.

### Answer 5: Argue Against Changing Refund Ceiling

Authorization is a hold, not a transfer -- the bank reserves funds on the customer's card but no money actually moves. Only captured amounts represent real money that was taken from the customer. If you refund against the authorized amount, you would be attempting to return money that was never actually received by the merchant. In the real world: authorize $100, capture $60, the remaining $40 hold is released automatically by the bank -- there is no $40 to refund. Changing the ceiling would create a situation where the system attempts refunds the payment provider cannot fulfill, leading to failed refund calls and inconsistent state.

## Evaluation Criteria

For each answer, score on a 3-point scale:

- **CORRECT** (2 points): Answer is factually correct and demonstrates understanding of the underlying design decision
- **PARTIALLY CORRECT** (1 point): Answer identifies the right behavior but misses the rationale or gets a detail wrong
- **INCORRECT** (0 points): Answer is wrong about the behavior or reasoning

Maximum score per level: 10 points (5 questions x 2 points).

## Expected Outcome

- Level C (full FAQ) should score 9-10/10 -- the FAQ provides all the WHY knowledge needed
- Level B (partial FAQ) should score 7-8/10 -- missing rationale for dual-rollback, idempotency, and recomputation
- Level A (no FAQ) should score 5-7/10 -- can derive WHAT from code but struggles with WHY

The gap between levels quantifies the value of domain knowledge in graph quality.
