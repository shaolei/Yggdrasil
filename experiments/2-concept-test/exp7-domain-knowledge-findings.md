# Experiment 7: Domain Knowledge Variance -- Findings

## Overview

Three agents built Yggdrasil graphs for the Medusa PaymentModuleService, each with a different level of domain knowledge:
- **DK-Full**: Source code + complete FAQ (5 domain answers)
- **DK-Partial**: Source code + partial FAQ (2 domain answers: refund ceiling, auto-capture coercion)
- **DK-None**: Source code only (no domain knowledge)

A separate evaluation agent then answered 5 blindfold questions using ONLY the context package from each graph (no source code access).

---

## 1. Structural Comparison

### Raw Metrics

| Metric | DK-Full | DK-Partial | DK-None |
|--------|---------|------------|---------|
| **Total lines (all artifacts)** | 1,063 | 1,283 | 788 |
| **Artifact files** | 8 | 8 | 8 |
| **Decisions documented** | 8 | 13 | 12 |
| **Decisions with real rationale** | 6 (75%) | 2 (15%) | 0 (0%) |
| **Decisions with "rationale unknown"** | 2 (25%) | 11 (85%) | 11 (92%) |
| **Constraints identified** | 12 | 13 | 10 |
| **Aspects (cross-cutting patterns)** | 7 | 10 | 8 |
| **Error scenarios documented** | 17 | 13 | 10 |
| **Domain FAQ references** | 10+ (across decisions, constraints, logic) | 7 (across decisions, constraints, logic) | 0 |
| **Blindfold answer length (lines)** | 134 | 124 | 98 |

### Key Structural Observations

**Surprising: DK-Partial is the longest graph (1,283 lines), not DK-Full (1,063).** The partial-knowledge agent compensated for missing rationale by documenting more structural observations and producing more enumerated items (13 decisions vs 8). However, 85% of those decisions say "rationale unknown." The DK-Partial agent was more verbose at describing WHAT but explicit about not knowing WHY.

**DK-None is significantly shorter (788 lines)** and documents fewer error scenarios (10 vs 17 for Full). The no-knowledge agent documented less edge-case behavior overall.

**DK-Full has the highest density of WHY content.** Despite having fewer total decisions (8 vs 13), 75% include real rationale with explicit "chose X over Y because Z" reasoning. The two marked "rationale unknown" are for minor implementation choices (Intl.NumberFormat selection, provider feature detection via duck typing) where even the FAQ didn't provide answers.

**DK-Full documents the most error scenarios (17).** The domain knowledge helped the agent identify more failure modes and edge cases, including subtle ones like serialization failures and zero-amount currency precision behavior.

### Qualitative Differences

**Decisions.md comparison:**

| Topic | DK-Full | DK-Partial | DK-None |
|-------|---------|------------|---------|
| Status recomputation rationale | Full explanation: combinatorial explosion of states, self-correcting | Not covered (rationale unknown) | Not covered (rationale unknown) |
| Auto-capture coercion rationale | Full: traceability, each capture needs its own idempotency key | Full (had this FAQ answer): same quality as DK-Full | Observable intent only: "normalizes flow" |
| Idempotency key = local ID | Full: crash-resilient, new UUID on restart = duplicate charges | Not covered (rationale unknown) | Not covered (rationale unknown) |
| Dual rollback ordering | Full: reversible-first, irreversible-second deliberate asymmetry | Not covered (rationale unknown) | Not covered (rationale unknown) |
| Refund ceiling rationale | Full: authorization is a hold, not a transfer | Full (had this FAQ answer): same quality | Observable intent: "prevents refunding money never collected" |

The pattern is clear: **domain knowledge answers directly become decision rationale.** Without the FAQ, agents say "rationale unknown" and describe observable intent instead. With the FAQ, agents capture the actual business reasoning.

---

## 2. Blindfold Answer Scoring

### Q1: Partial Capture Ceiling ($100 auth, $60 captured, try $50 more)

**Known-correct answer:** Rejected. Ceiling = authorized - captured = $40. Throws INVALID_DATA. Both amounts rounded to currency precision.

| Level | Score | Assessment |
|-------|-------|------------|
| DK-Full | **2 (CORRECT)** | Exact match. Correct ceiling calculation ($40), correct error type and message, mentions currency precision rounding, explains the constraint rationale (authorization = hold on funds). |
| DK-Partial | **2 (CORRECT)** | Exact match. Correct ceiling, correct error, mentions currency precision rounding, notes provider is never called because validation is local. |
| DK-None | **2 (CORRECT)** | Exact match. Correct ceiling, correct error, mentions currency precision rounding. Slightly less explanatory but all facts correct. |

**Verdict:** All three get full marks. This question tests WHAT behavior, which code analysis alone captures well.

---

### Q2: Collection Status with Multiple Sessions ($80 + $20, both authorized)

**Known-correct answer:** AUTHORIZED. Recomputed from scratch. Sum of authorized sessions = $100 >= collection amount $100. Not COMPLETED because capturedAmount = $0.

| Level | Score | Assessment |
|-------|-------|------------|
| DK-Full | **2 (CORRECT)** | Exact match. Correctly explains recomputation algorithm, shows intermediate state (PARTIALLY_AUTHORIZED after first), final AUTHORIZED. Mentions it does NOT reach COMPLETED. References decision D1 (recomputation over state machine). |
| DK-Partial | **2 (CORRECT)** | Exact match. Same quality as Full. Shows intermediate PARTIALLY_AUTHORIZED, final AUTHORIZED, mentions currency precision rounding. |
| DK-None | **2 (CORRECT)** | Exact match. Shows intermediate state, final AUTHORIZED, explains why not COMPLETED. |

**Verdict:** All three get full marks. The recomputation algorithm is well-documented from code analysis in all three graphs.

---

### Q3: Provider Succeeds, Local Fails (Critical Question)

**Known-correct answer:** This is the dual-rollback pattern. Key nuance: local Capture record is deleted on failure. On retry, a NEW capture record with a NEW ID = NEW idempotency key. The provider treats it as a new request. This is a known asymmetry -- the system prioritizes local state consistency over preventing duplicate provider operations.

| Level | Score | Assessment |
|-------|-------|------------|
| DK-Full | **2 (CORRECT)** | Excellent answer. Correctly identifies: (1) local Capture record deleted, (2) money not reversed at provider, (3) explicitly notes "the idempotency key (the capture record's ID) has been deleted, so a retry would create a new Capture record with a new ID." Captures the asymmetry. Also notes that if the provider honors the *original* idempotency key, retry might work -- this is actually a nuance beyond the known-correct answer. |
| DK-Partial | **1 (PARTIALLY CORRECT)** | Correctly identifies the inconsistent state and that the Capture record is deleted. Correctly notes no provider reversal for captures (unlike authorization). But **misses the critical idempotency key nuance** -- does not discuss what happens on retry with a new capture ID generating a new idempotency key. The answer stops at describing the immediate failure without addressing the retry implications. |
| DK-None | **1 (PARTIALLY CORRECT)** | Same quality as DK-Partial. Correctly describes the inconsistent state, the Capture record deletion, and the asymmetry with authorization compensation. Also misses the idempotency key implication on retry. Does not discuss the new-ID-means-new-key problem. |

**Verdict:** DK-Full captures the idempotency key nuance that the other two miss. This is a direct benefit of domain knowledge about idempotency design -- the Full FAQ explained WHY idempotency keys are tied to local record IDs (crash resilience), which made the evaluation agent realize that deleting the local record destroys the idempotency key.

---

### Q4: Authorization Timeout and Retry

**Known-correct answer:** IDEMPOTENT. The `authorizePaymentSession` method checks if session.payment exists and authorized_at is set. If the first request completed locally, retry returns existing payment immediately. The idempotency key is session.id (stable across retries).

| Level | Score | Assessment |
|-------|-------|------------|
| DK-Full | **2 (CORRECT)** | Comprehensive answer covering both scenarios: (1) if local writes completed, idempotency short-circuit fires; (2) if local writes didn't complete, provider idempotency via session.id handles it. Correctly identifies the risk that the error handler's cancelPayment call might have canceled the authorization before retry. Good identification that payment.id might be undefined during compensation. |
| DK-Partial | **2 (CORRECT)** | Also covers both layers (module-level and provider-level idempotency). Correctly identifies the session.id as the stable idempotency key. Discusses the edge case where compensation (cancelPayment) might have already run before retry. Quality comparable to DK-Full. |
| DK-None | **2 (CORRECT)** | Covers both idempotency layers. Correctly identifies session.id as the key. Notes the compensation edge case. Despite having "rationale unknown" for idempotency in its decisions.md, the evaluation agent could still reason correctly from the structural documentation of the idempotency mechanism. |

**Verdict:** All three get full marks. The structural documentation of idempotency behavior (the check at the top of authorizePaymentSession) is sufficient to answer this question correctly even without understanding WHY idempotency keys are designed this way. The WHAT is well-captured by code analysis alone.

---

### Q5: Argue Against Changing Refund Ceiling

**Known-correct answer:** (1) Authorization is a hold, not a transfer -- refunding more than captured means refunding money never received. (2) The remaining hold is released by the bank -- there's nothing to refund. (3) Providers would reject the refund calls, causing failed calls and inconsistent state.

| Level | Score | Assessment |
|-------|-------|------------|
| DK-Full | **2 (CORRECT)** | Five strong arguments. (1) Authorization is a hold, not a transfer -- captures the core insight. (2) Uncaptured portion released automatically by bank. (3) Breaks the status recomputation model. (4) Providers will reject over-refunds. (5) Breaks authorized >= captured >= refunded chain. All grounded in artifacts. Demonstrates deep understanding of business rationale. |
| DK-Partial | **2 (CORRECT)** | Five strong arguments. (1) Authorization is a hold -- same quality as Full (had this FAQ answer). (2) Financial invariant chain. (3) Providers will reject. (4) Traceability/auditability. (5) Partial capture scenarios are dangerous. High quality, though less of the "bank releases the hold" insight. |
| DK-None | **2 (CORRECT)** | Five arguments. (1) Cannot refund money never collected. (2) Collection status derivation inconsistency. (3) Provider delegation would break. (4) Partial capture ambiguity. (5) Violates append-only financial record design. While correct, the first argument uses the weaker framing "cannot refund money never collected" rather than the stronger "authorization is a hold, not a transfer." The bank-release mechanism is not mentioned. Still, the arguments are valid and well-reasoned. |

**Verdict:** All three score well. DK-Full and DK-Partial have the strongest first argument (authorization = hold, not transfer) because they had the FAQ answer. DK-None arrives at a similar conclusion through inference ("cannot refund money never collected") but lacks the precise domain language. The difference is subtle enough that all three earn full marks, though the qualitative depth varies.

---

## 3. Scoring Matrix

| Question | DK-Full | DK-Partial | DK-None |
|----------|---------|------------|---------|
| Q1: Partial capture ceiling | 2 | 2 | 2 |
| Q2: Collection status | 2 | 2 | 2 |
| Q3: Provider succeeds, local fails | **2** | **1** | **1** |
| Q4: Authorization timeout/retry | 2 | 2 | 2 |
| Q5: Argue against refund ceiling change | 2 | 2 | 2 |
| **TOTAL** | **10/10** | **9/10** | **9/10** |

---

## 4. Comparison Against Hypothesis

### Hypothesis
- DK-Full: 9-10/10
- DK-Partial: 7-8/10
- DK-None: 5-7/10

### Actual Results
- DK-Full: 10/10
- DK-Partial: 9/10
- DK-None: 9/10

### Was the hypothesis confirmed?

**Partially -- but the expected gap was much larger than the actual gap.**

DK-Full performed as expected (10/10, top of the predicted range). But DK-Partial (9) and DK-None (9) both significantly exceeded expectations. The predicted 3-5 point gap between Full and None was only 1 point.

### Why the gap was smaller than expected

**1. LLMs can infer WHAT from code structure alone, and most questions test WHAT.**

Four of the five questions (Q1, Q2, Q4, Q5) primarily test behavioral knowledge -- what the system does in specific scenarios. This information is fully derivable from code analysis. All three graphs documented the algorithms, error conditions, and state transitions with sufficient precision for correct answers.

**2. Q5 (argue against) rewards reasoning ability, not just knowledge.**

The argument question was expected to differentiate strongly, but all three agents produced valid 5-point arguments. Even without domain knowledge, the DK-None agent could reason from structural facts (providers will reject, financial aggregates become inconsistent) to construct compelling arguments. The DK-Full agent had better domain language ("authorization is a hold") but the DK-None agent arrived at functionally equivalent conclusions through inference.

**3. Only Q3 truly tested domain knowledge depth.**

The provider-succeeds-local-fails scenario was the only question where knowing WHY idempotency keys are tied to local record IDs (and what happens when the local record is deleted) made a material difference. DK-Full's graph captured this asymmetry explicitly because the FAQ explained the idempotency key design rationale. DK-Partial and DK-None knew the mechanism but not the implication of its destruction on retry.

**4. The DK-Partial and DK-None graphs were honest about gaps.**

Rather than inventing rationale, the partial and no-knowledge agents explicitly marked decisions as "rationale unknown." This honesty meant their graphs were accurate -- they didn't contain incorrect WHY information that would lead to wrong answers. The evaluation agents were able to reason correctly from structural facts alone.

---

## 5. Key Finding: Where Domain Knowledge Actually Helps

### Domain knowledge improves graph quality in a specific, measurable way:

**It captures WHY, which matters for edge cases and design trade-off questions.**

The difference is not in the number of artifacts or their structural completeness. DK-Partial actually produced MORE decisions and aspects than DK-Full. The difference is in the **density of rationale**:

- DK-Full: 75% of decisions have real rationale
- DK-Partial: 15% of decisions have real rationale
- DK-None: 0% of decisions have real rationale

**But this ratio only mattered for 1 of 5 blindfold questions (20% of the test).**

The implication is that domain knowledge is most valuable for:
- Questions about **failure mode implications** (what happens AFTER the immediate failure)
- Questions about **design asymmetries** (why X works differently than Y)
- Questions about **business semantics** (what does authorization mean in the real world)

Domain knowledge is less valuable for:
- Questions about **behavioral correctness** (what does the code do in scenario X)
- Questions about **state transitions** (what status will result from action Y)
- Questions about **structural patterns** (what cross-cutting concerns exist)

### The asymmetry in value delivery

Domain knowledge has **high value per fact but low coverage impact**. Each FAQ answer directly improved one or two decision rationales, which occasionally proved decisive (Q3). But the vast majority of useful information for the blindfold test came from structural code analysis that all three agents performed equally well.

---

## 6. Product Implications for Yggdrasil

### Implication 1: Graphs built without domain knowledge are surprisingly useful

An agent with only source code can build a graph that answers 90% of behavioral questions correctly. This validates Yggdrasil's value proposition even for repositories where no domain expert is available. The "reverse engineering" workflow (code-only) produces graphs that are significantly better than no graph at all.

### Implication 2: The "rationale unknown" pattern is a feature, not a bug

The DK-Partial and DK-None agents' practice of explicitly marking "rationale unknown" was correct and valuable. It prevented the evaluation agent from being misled by fabricated rationale. Yggdrasil should encourage this pattern -- it makes the graph's knowledge boundaries visible, which is more useful than appearing comprehensive while containing invented explanations.

### Implication 3: Domain knowledge has targeted, high-impact value

The FAQ answers directly determined whether the graph captured the idempotency key deletion nuance (Q3). This suggests Yggdrasil should:
- Prioritize capturing domain knowledge for **failure modes and error recovery** -- these are the scenarios where code-derived knowledge breaks down
- Provide tooling to identify decisions marked "rationale unknown" and flag them for domain expert review
- Consider a "knowledge gap" report that lists undocumented rationale, making it easy for a domain expert to fill in the gaps

### Implication 4: Question design matters more than expected

The blindfold test questions were heavily weighted toward WHAT questions (4/5). A test with more WHY questions (e.g., "Why does the system use recomputation instead of a state machine?", "Why is the refund ceiling based on captured rather than authorized amount?") would likely show a larger gap between levels. Future experiments should include more rationale-testing questions.

### Implication 5: Graph size does not correlate with graph quality

DK-Partial (1,283 lines) > DK-Full (1,063 lines) > DK-None (788 lines), but DK-Full scored highest. The DK-Partial agent compensated for missing knowledge with verbosity. This suggests that graph quality metrics should focus on rationale density (% of decisions with real WHY) rather than raw size.

---

## 7. Summary

| Dimension | DK-Full | DK-Partial | DK-None |
|-----------|---------|------------|---------|
| Blindfold score | 10/10 | 9/10 | 9/10 |
| Predicted score | 9-10 | 7-8 | 5-7 |
| Decisions with rationale | 75% | 15% | 0% |
| Total graph size | 1,063 lines | 1,283 lines | 788 lines |
| Distinguishing question | Q3 (idempotency key nuance) | -- | -- |

**Bottom line:** Domain knowledge improves graph quality, but the improvement is concentrated in edge-case reasoning about failure modes and design asymmetries. For behavioral questions about what the system does, code analysis alone is sufficient. The hypothesis predicted a 3-5 point gap; the actual gap was 1 point because 80% of the test questions were answerable from code-derived knowledge alone. The experiment confirms that domain knowledge has high marginal value per fact, but only matters when the question probes into WHY territory.
