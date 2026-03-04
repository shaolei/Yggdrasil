# Advanced Experiments Synthesis: Validating Yggdrasil Through Empirical Testing

**Date:** 2026-03-03

---

## Executive Summary

Six controlled experiments tested Yggdrasil's semantic memory architecture across multiple dimensions: temporal stability, drift recovery, domain knowledge sensitivity, cross-module emergent properties, contradiction detection, and competitive positioning against alternative knowledge representations. The experiments used three real-world open-source repositories (Cal.com, Medusa, Hoppscotch) as substrates and employed blindfold methodology -- agents answered questions using ONLY the knowledge representation being tested, with answers scored against known-correct gold standards.

**Key aggregate findings:**

1. **Yggdrasil graphs retain 79% accuracy after 12 months and 91% after 6 months without maintenance** (Exp 5). Different artifact types decay at dramatically different rates, from ~9-year half-lives (interface, responsibility) to ~2.4-year half-lives (aspects).

2. **Stale graphs can be recovered to 90-100% accuracy** (Exp 6). Agents with the rules, a stale graph, and current code successfully identify drift and propose correct updates -- including cross-cutting aspect violations at a 100% detection rate.

3. **Domain knowledge improves rationale density but not behavioral accuracy** (Exp 7). Graphs built without domain knowledge score 9/10 on blindfold tests; full domain knowledge achieves 10/10. The gap appears only for failure-mode reasoning questions.

4. **Full-graph context enables emergent cross-module reasoning that individual contexts or raw code cannot replicate** (Exp 8). The full graph scored 118/125 vs raw code's 109/125. However, the graph's abstraction layer can actively mislead agents when implementations deviate from aspect-level generalizations.

5. **Agents detect 100% of factual graph-code contradictions but 0% of omissions** (Exp 9). The critical detection gap is missing information, not wrong information.

6. **For single-module analysis, Yggdrasil provides no measurable advantage over simpler representations** (Exp 10). Well-commented source code and READMEs scored 16/16 vs Yggdrasil's 15/16. Yggdrasil's value proposition is cross-module structure.

---

## Experiment Overview

| # | Experiment | Substrate | Key Question | Result |
|---|-----------|-----------|--------------|--------|
| 5 | Time Decay | Cal.com, Medusa, Hoppscotch | How fast do graph artifacts age? | 79% at 12mo, 91% at 6mo; interface most stable, aspects least |
| 6 | Drift Recovery | Hoppscotch (4 mutations) | Can agents recover a stale graph? | 90-100% recovery; aspect violation detection at 100% |
| 7 | Domain Knowledge | Medusa | Does domain knowledge improve graph quality? | 10/10 vs 9/10; only 1/5 questions differentiated |
| 8 | Scale / Emergent Properties | Hoppscotch (16 nodes) | Does a multi-node graph create emergent understanding? | Yes: 118/125 (graph) vs 109/125 (code); but graph misled on Q5 |
| 9 | Contradiction Detection | Hoppscotch (5 planted errors) | Can agents detect graph errors? | 4/5 factual contradictions detected; omissions undetected |
| 10 | Competing Representations | Hoppscotch | Yggdrasil vs ADR vs Comments vs README? | All within 1 point (15-16/16) for single-module questions |

---

## Cross-Cutting Findings

### 1. The Abstraction-Accuracy Tradeoff

The most important finding across all experiments is a fundamental tension in knowledge representation: **abstractions enable reasoning at scale but sacrifice precision, and the precision loss can cause confidently wrong conclusions.**

This manifests in three experiments:

**Exp 8, Q5 (PubSub failure analysis):** The pubsub-events aspect states events are published "AFTER the database transaction commits." Agent A (full graph) trusted this abstraction and concluded "no operations fail completely due to PubSub outage." Agent C (raw code) found 4 out of 28 publish calls use `await` (making them failure-propagating) and 2 are inside `$transaction` callbacks (creating rollback risk). The aspect described the *design intent* (22/28 call sites) but not the *exceptions* (6/28). The graph produced a confidently incorrect answer.

**Exp 10, Q6 (sort feature):** The Yggdrasil context package and ADRs correctly identified which patterns apply to a sort feature but hedged on whether `sortTeamCollections` already exists. Inline comments and README knew immediately that the feature exists and identified its known limitation (missing PubSub event). Abstract representations capture intent and constraints; source-adjacent representations capture implementation state.

**Exp 5 (time decay):** Aspects -- the most abstract artifact type -- decay fastest (half-life ~2.4 years) because they describe patterns with binary existence. When a cross-cutting pattern is introduced (pessimistic locking, currency-precision rounding), the aspect is 100% wrong for all prior code. The more abstract the artifact, the more catastrophically it fails when the underlying reality changes.

**The tradeoff quantified:**

| Dimension | Abstract (Graph) | Concrete (Code) |
|-----------|-----------------|-----------------|
| Reasoning speed | Fast (minutes) | Slow (hours for multi-module) |
| Cross-module coherence | High (flows, aspects) | Low (manual tracing) |
| Rationale capture | Strong (decisions, aspects) | Absent |
| Precision on edge cases | Weak (aspect generalizations) | Strong (every line visible) |
| Failure mode confidence | Unreliable (Exp 8 Q5) | Reliable |
| Implementation state awareness | Weak (Exp 10 Q6) | Strong |

**Implication:** Yggdrasil's abstraction layer is most valuable for "should we?" questions (architectural reasoning, design decisions) and least reliable for "what exactly happens?" questions (failure modes, edge cases, exact call-site enumeration).

---

### 2. The Artifact Stability Hierarchy

Experiment 5 established an empirical stability ranking for graph artifact types, which has direct implications for review cadence, required vs optional status, and trust weighting in context packages.

**Empirical stability ranking (weighted accuracy at 12 months):**

| Rank | Artifact Type | T0 Accuracy | Half-Life | Decay Pattern |
|------|--------------|-------------|-----------|---------------|
| 1 | interface.md | 90.6% | ~9 years | Gradual (API surface changes slowly) |
| 2 | responsibility.md | 88.8% | ~9.5 years | Gradual (module purpose rarely changes) |
| 3 | Flow descriptions | 85.9% | ~4.4 years | Mixed (process steps added/changed) |
| 4 | errors.md | 85.7% | ~9 years | Gradual (error handling added, rarely removed) |
| 5 | state.md | 81.8% | ~6.9 years | Gradual (state fields added over time) |
| 6 | decisions.md | 79.2% | ~4 years | Mixed (new features alter decision landscape) |
| 7 | constraints.md | 75.9% | ~2.6 years | Gradual (behavioral changes invalidate rules) |
| 8 | logic.md | 70.8% | ~2.7 years | Mixed (algorithm steps modified/reordered) |
| 9 | Aspects | 67.0% | ~2.4 years | Catastrophic (binary pattern existence) |

**The prediction was wrong.** The hypothesis predicted aspects would be MOST stable ("high-level patterns change slowly"). In reality, aspects are LEAST stable because they describe cross-cutting patterns with binary existence -- a pattern either exists in the code or does not. When a repository introduces pessimistic locking, the corresponding aspect goes from 0% to 100% accuracy at the moment of introduction, and is 100% wrong for all prior code.

**Three decay triggers identified:**

1. **New feature addition (~60% of inaccuracies):** Catastrophic decay in the specific artifact describing the feature. Examples: three-tier slot snapping in Cal.com, currency-precision rounding in Medusa, pessimistic locking in Hoppscotch.
2. **Behavioral refactoring (~25%):** Localized decay in logic.md and constraints.md. Examples: timezone ordering, optimization changes.
3. **Data model evolution (~15%):** Incremental decay in interface.md and state.md. Examples: new fields, methods added.

**Implication for review cadence:**

| Artifact Type | Review Trigger |
|--------------|----------------|
| responsibility.md, interface.md | Every 6-12 months or on scope changes |
| decisions.md, constraints.md | Every 3-6 months or after significant PRs |
| logic.md | Every 1-3 months or after algorithm changes |
| Aspects | On every feature addition (not time-based) |

---

### 3. Agent Capabilities: Strong at Consistency, Weak at Completeness

Experiments 6 and 9 together reveal a sharp asymmetry in agent capabilities:

**What agents do well:**
- Detect factual contradictions between graph and code: **100% detection** (Exp 9: C1, C3, C4)
- Detect aspect violations during drift recovery: **100% detection** (Exp 6: M3, M4)
- Recover stale graphs to high fidelity: **90-100%** (Exp 6: all mutations)
- Produce zero false positives: all "false positives" in C0 control were genuine pre-existing issues
- Correctly assess severity of detected issues: severity ratings tracked actual impact in all cases
- Distinguish "fix the graph" from "flag the violation" (Exp 6: M3, M4 agents correctly escalated aspect violations rather than silently updating)

**What agents do poorly:**
- Detect missing information (omissions): **0% detection** (Exp 9: C2, missing timing invariant was not noticed)
- Explain WHY behavioral changes were made: **gap in M2** (Exp 6: agent described the reorder semantics change perfectly but did not produce a decisions.md entry explaining the rationale)
- Calibrate after finding one fabricated rationale: **over-flagging** (Exp 9: C5, finding one planted fabrication caused 3 genuine rationales to be flagged as suspicious)

**The omission blind spot is the most dangerous.** An agent reviewing a graph naturally checks "does the graph accurately describe the code?" (consistency). It does not naturally check "does the graph capture everything important?" (completeness). The C2 experiment removed the PubSub timing invariant -- a critical constraint about when events fire relative to transactions. No agent noticed it was gone.

This has a direct connection to Exp 8 Q5: the pubsub-events aspect described the fire-and-forget pattern but OMITTED the exceptions (awaited calls, in-transaction calls). This omission caused Agent A to reach the wrong conclusion about PubSub failure impact. The experiment shows that omissions are both the hardest to detect AND the most likely to cause downstream reasoning errors.

**The consistency vs completeness matrix:**

| Check Type | Agent Effectiveness | Automation Feasibility |
|-----------|-------------------|----------------------|
| Graph claim contradicts code | 100% | High (can be CI check) |
| Graph describes wrong algorithm | 100% | High |
| Graph inverts scope/attribution | 100% | High |
| Graph has fabricated rationale | ~80% (noisy) | Moderate (needs human review) |
| Graph omits important behavior | ~0% | Low (requires separate prompt) |
| Graph omits important constraint | ~0% | Low (requires separate prompt) |

---

### 4. Domain Knowledge: Targeted, High-Impact, Low-Coverage

Experiment 7 tested three domain knowledge levels (Full, Partial, None) on the Medusa PaymentModuleService. The results challenge the assumption that domain knowledge is broadly important for graph quality.

**Quantitative result:** DK-Full scored 10/10, DK-Partial 9/10, DK-None 9/10. The predicted 3-5 point gap was only 1 point.

**Why the gap was so small:** 80% of test questions (4/5) tested behavioral knowledge -- WHAT the system does in specific scenarios. This information is fully derivable from code analysis alone. All three graphs documented the algorithms, error conditions, and state transitions with sufficient precision.

**Where domain knowledge mattered:** Q3 (provider succeeds, local fails) was the ONLY differentiating question. It tested what happens on RETRY after a local Capture record is deleted -- specifically, that the idempotency key (tied to the local record ID) is destroyed, so a retry creates a new capture with a new key. DK-Full captured this nuance because the FAQ explained the idempotency key design rationale. DK-Partial and DK-None documented the mechanism but missed the implication of its destruction on retry.

**The asymmetry in value delivery:**

| Knowledge Type | Domain Knowledge Needed? | Why |
|---------------|------------------------|-----|
| Algorithm mechanics | No | Code analysis sufficient |
| State transitions | No | Code analysis sufficient |
| Design rationale | Yes | Intent not in code |
| Failure mode implications | Sometimes | Edge cases need WHY to predict WHAT |
| Business semantics | Yes | "Authorization is a hold, not a transfer" |

**Key metric:** Domain knowledge improves rationale density dramatically (75% of decisions have real rationale with DK-Full vs 0% with DK-None). But rationale only mattered for 20% of the test questions. The implication: domain knowledge has **high marginal value per fact** but **low coverage impact** on the total question space.

**The "rationale unknown" pattern is valuable.** DK-Partial and DK-None agents explicitly marked decisions as "rationale unknown" rather than inventing explanations. This honesty prevented the evaluation agents from being misled by fabricated rationale. Yggdrasil should encourage this pattern -- visible knowledge boundaries are more useful than appearing comprehensive while containing invented explanations. This directly connects to the Exp 9 finding about fabricated rationale detection (C5): agents WILL generate plausible-but-wrong rationale if not constrained, and detecting such fabrications is noisy.

---

### 5. The Guard/Resolver Blind Spot

Experiment 8 revealed Yggdrasil's most significant structural gap: the graph models services but not the infrastructure that connects services to user-facing APIs.

**The evidence:** Agent C (raw code) found 18 call sites for `getTeamMember`, including **8 guard classes**: GqlTeamMemberGuard, RESTTeamMemberGuard, GqlCollectionTeamMemberGuard, GqlRequestTeamMemberGuard, GqlTeamEnvTeamGuard, TeamInviteViewerGuard, TeamInviteTeamOwnerGuard, MockRequestGuard. Agent A (full graph) found 4 service consumers. The graph captures 22% of the actual blast radius.

**Why this matters:**

1. **Guards are the real authorization enforcement layer.** Services themselves largely trust their callers. Guards are where team membership and role verification happen for GraphQL and REST endpoints.

2. **Guards use return values differently than services.** Services do null-checks (existence verification). Guards read `teamMember.role` for RBAC decisions. A change that preserves null/non-null semantics but modifies the role field would break guards silently while appearing safe from graph-only analysis.

3. **The gap affects multiple experiment questions.** Q1 (impact analysis): graph missed 78% of call sites. Q4 (removed user visibility): graph could not name the specific guard classes enforcing access control. Q5 (PubSub failure): guards are not PubSub consumers, so this gap didn't affect that question, but the principle -- infrastructure layers outside the graph cause blind spots -- is the same.

**Connection to Exp 10:** The competing representations experiment showed that source-adjacent representations (comments, README) beat abstract representations on "does this feature exist?" questions. The guard blind spot is a specific instance of the general finding that abstract representations lose touch with concrete implementation details.

---

### 6. Recovery Resilience

Experiment 6 provides the strongest validation of Yggdrasil's practical utility: even when the graph becomes stale, an agent equipped with the rules and context package can recover it effectively.

**Recovery quality by change type:**

| Change Type | Recovery | Difficulty Rating | Actual Difficulty |
|------------|----------|-------------------|-------------------|
| Additive (new method) | 100% | Easy | Easiest |
| Behavioral (semantics reversed) | ~90% | Medium | Hardest (tie) |
| Invariant-breaking (lock removed) | ~90% | Hard | Hardest (tie) |
| Architectural (entire model replaced) | ~98% | Very Hard | Moderate |

**Counterintuitive finding:** Architectural changes (M4, rated "very hard") were recovered with near-perfect fidelity, while behavioral changes (M2, rated "medium") had a larger gap. The explanation: architectural changes are *pervasive* -- when every method changes, the pattern is unmistakable. Behavioral changes require semantic understanding of developer intent ("why place-after instead of place-before?"), which is harder than detecting structural patterns.

**The "why" gap in recovery:** Agents excel at describing WHAT changed but sometimes miss documenting WHY. This gap appeared in M2 (no decisions.md entry for the semantics change) and connects directly to the Exp 7 finding about domain knowledge -- rationale is the one dimension that code analysis alone cannot supply.

**Connection to Exp 5 (time decay):** The stability hierarchy determines WHICH artifacts are most likely to be stale, and Exp 6 shows HOW well agents recover them:

- **Stable artifacts (interface, responsibility):** Rarely stale, easy to verify
- **Moderately stable (decisions, constraints):** Stale after 3-6 months, recoverable at ~90%
- **Volatile artifacts (logic, aspects):** Stale after 1-3 months, recoverable at 90-100% for code-visible changes, gap for rationale

---

### 7. When Yggdrasil Adds Value vs When It's Overkill

Experiments 8 and 10 together provide the clearest answer to "when should you use Yggdrasil?"

**Exp 10 (single module, 8 questions):** All four representations scored within 1 point (15-16/16). For questions about a single, well-scoped module, a well-written README or well-commented source code captures the same knowledge.

**Exp 8 (16-node system, 5 cross-node questions):** The full graph scored 118/125 vs single node's 86/125 vs raw code's 109/125. For cross-module questions, the graph provides genuine emergent value.

**The value inflection point:**

| Scenario | Best Approach | Why |
|----------|--------------|-----|
| Single module, behavioral questions | Any format works (README, comments, ADR, Yggdrasil all equivalent) | Well-defined behavior is easily documented in any format |
| Single module, rationale questions | Any format works | All formats captured "why" decisions equally |
| Cross-module impact analysis | Full graph essential | Declared relations + aspect propagation enable blast radius estimation |
| Cross-module flow tracing | Full graph essential | Flow descriptions with participant roles create coherent narratives |
| Architectural what-if questions | Full graph strongly preferred | Aspects contain recorded rationale that code does not |
| Failure mode analysis | Raw code essential | Error handling, await patterns, transaction boundaries are code-level |
| Access control analysis | Raw code essential (graph has guard blind spot) | Guards/resolvers not modeled in current graph architecture |
| Implementation state verification | Source-adjacent preferred | Comments/README know what exists NOW |

**Size thresholds (from Exp 10 implications):**

- **Small projects (< 10 modules):** README + comments sufficient. Yggdrasil adds overhead without proportional benefit.
- **Medium projects (10-50 modules):** ADRs + README for foundations. Yggdrasil valuable when cross-cutting concerns multiply.
- **Large projects (50+ modules):** Yggdrasil's structured graph provides value no amount of READMEs can substitute -- machine-traversable aspect propagation, flow participant tracking, automated drift detection.

---

## The Fundamental Insight: Complementary, Not Competing

The six experiments converge on a single insight: **Yggdrasil and source code are complementary knowledge sources, each strong where the other is weak.** The graph excels at WHY, SHOULD-WE, and WHAT-ELSE; code excels at WHAT-EXACTLY, WHAT-BREAKS, and DOES-IT-EXIST.

**The knowledge coverage matrix:**

| Question | Graph | Code | Best Strategy |
|----------|-------|------|---------------|
| "Why was X designed this way?" | Strong | Absent | Graph only |
| "What modules are affected by X?" | Strong (service level) | Strong (all levels) | Graph first, code to verify |
| "Should we change X to Y?" | Strong (rationale + aspects) | Moderate (trade-offs visible) | Graph for decision, code for feasibility |
| "What exactly happens when X fails?" | Weak (aspect generalizations) | Strong (error handling visible) | Code essential |
| "Does feature X exist?" | Weak (may hedge) | Strong (definitive) | Code or source-adjacent docs |
| "What are the edge cases of X?" | Weak | Strong | Code essential |
| "How does business process X work end-to-end?" | Strong (flow descriptions) | Laborious but accurate | Graph for narrative, code for precision |

**The recommended hybrid approach:**

1. Use Yggdrasil for cross-module structure, architectural rationale, and business process documentation
2. Supplement with inline comments for implementation-specific details and known limitations
3. Use `yg build-context` as the STARTING point for understanding, then verify critical details against source code
4. For failure mode analysis and exact call-site enumeration, always consult raw code regardless of graph quality

---

## Aggregated Product Implications

### Priority 1: Close the Abstraction-Accuracy Gap

**Problem:** The graph's aspect-level generalizations can cause confidently wrong conclusions (Exp 8 Q5).

**Recommendations:**
- **Aspect exception tracking:** Add per-node "aspect overrides" or "aspect exceptions" to record deviations from the pattern. Example: "Node X follows pubsub-events EXCEPT that it awaits the publish call."
- **Aspect validation:** A validation rule that compares aspect claims against actual implementations. If the pubsub-events aspect says "after commit" but code publishes inside a transaction, flag it.
- **Confidence scores:** Each artifact in `yg build-context` output could carry a decay-weighted confidence score based on the artifact type's half-life and the file's commit frequency.

### Priority 2: Model the Guard/Resolver Layer

**Problem:** The graph captures 22% of actual blast radius because guards and resolvers are unmodeled (Exp 8).

**Recommendations:**
- Minimum: allow service nodes to declare `consumed_by` relations to guard files
- Better: map guard files to the service node that implements the protected logic
- Best: new node type `guard` or `infrastructure` with its own artifacts

### Priority 3: Separate Consistency Checking from Completeness Checking

**Problem:** Agents detect 100% of factual contradictions but 0% of omissions (Exp 9).

**Recommendations:**
- Add `yg review --node <path>` command that runs both checks:
  1. **Consistency:** "Does the graph accurately describe the code?" (agents excel at this)
  2. **Completeness:** "Does the graph capture all important behavior, invariants, and constraints?" (requires a separate, explicit prompt)
- In drift recovery guidance, add: "For each major code behavior, check whether it is represented in the graph"

### Priority 4: Tiered Review Cadence Based on Decay Profiles

**Problem:** All artifacts are treated equally for review, but they decay at vastly different rates (Exp 5).

**Recommendations:**
- Aspects: validate on every feature addition (catastrophic binary decay)
- logic.md: review every 1-3 months or after algorithm changes
- decisions.md, constraints.md: review every 3-6 months
- interface.md, responsibility.md: review every 6-12 months
- `yg drift` could use file churn metrics to flag nodes above a staleness threshold

### Priority 5: Rationale Provenance and the "Rationale Unknown" Pattern

**Problem:** Agents generate plausible-but-wrong rationale if not constrained (Exp 7, Exp 9 C5). When an agent finds one fabrication, it over-flags genuine rationales (Exp 9 C5).

**Recommendations:**
- Encourage "rationale unknown" over invented explanations (Exp 7: DK-None's honesty prevented misleading answers)
- Track rationale provenance: `source: inferred` vs `source: developer`
- When a decision has `source: developer`, mark it as verified and reduce agent suspicion
- Provide tooling to identify decisions marked "rationale unknown" for domain expert review

### Priority 6: Drift Classification

**Problem:** Recovery strategies differ by change type, but drift output does not classify changes (Exp 6).

**Recommendations:**
- `yg drift` could classify detected changes: Added, Modified, Removed, Aspect-relevant
- For behavioral changes, prompt for decisions.md entry (the "why" gap)
- For invariant-breaking changes, display affected constraints
- For aspect-relevant changes, show aspect compliance status

---

## Experimental Methodology Notes

### Strengths

- **Blindfold methodology:** Agents answered questions using ONLY the representation being tested, preventing knowledge leakage across conditions. This is the gold standard for evaluating knowledge representations.
- **Real-world substrates:** All experiments used active open-source repositories (Cal.com, Medusa, Hoppscotch) with real commit histories, not synthetic examples.
- **Gold standard scoring:** Expected answers were prepared BEFORE agent runs, preventing post-hoc rationalization.
- **Multiple dimensions:** Each experiment tested a different failure mode, providing orthogonal evidence.

### Limitations

- **Single evaluator:** All scoring was performed by a single evaluation agent. Inter-rater reliability was not assessed.
- **Small question sets:** Exp 7 used 5 questions, Exp 10 used 8 questions. Larger question sets might reveal more differentiation.
- **Question bias toward WHAT:** Experiments 7 and 10 were heavily weighted toward behavioral questions (WHAT the code does). More WHY questions would likely increase the domain knowledge and graph advantages.
- **Snapshot evaluation:** Exp 5 extrapolates decay curves from two time points. The actual decay function may not be exponential.
- **NestJS/TypeScript bias:** All codebases use NestJS/TypeScript. Results may differ for other frameworks, languages, or architectural patterns (e.g., microservices, event-driven architectures).
- **Exp 10 best-case scenario:** All representations were created by the same agent with access to the same source material. In practice, documentation quality varies dramatically. Yggdrasil's drift detection provides maintenance guardrails that READMEs and comments lack.

### Reproducibility

All experiment materials are preserved in `/workspaces/memory2/`:
- Per-experiment findings: `exp{5,6,7,8,9,10}-*-findings.md`
- Exp 8 context packages: `exp8-materials/ctx-*.md`
- Exp 8 blindfold answers: `exp8-materials/answer-Q*-Agent*.md`
- Exp 7 graph variants: `exp7-materials/dk-{full,partial,none}/`
- Exp 9 contradiction manifests: `exp9-materials/c{0,1,2,3,4,5}-*/`
- Exp 10 representations: `exp10-materials/rep-{a,b,c,d}/`

---

## Conclusion

Yggdrasil's semantic memory architecture is empirically validated as a valuable tool for AI agent reasoning about codebases, with measurable advantages for cross-module analysis, architectural rationale, and business process understanding. Its primary value proposition is NOT single-module knowledge (where simpler representations are equally effective) but cross-module structural reasoning -- the emergent properties that arise from connecting nodes through aspects, flows, and relations.

The architecture has three identified weaknesses that the experiments quantify:

1. **Abstraction can mislead** (Exp 8 Q5): Aspect-level generalizations that mask implementation exceptions can cause agents to reach confidently wrong conclusions. The fix is aspect exception tracking and validation.

2. **Infrastructure layers are invisible** (Exp 8 guards): The graph models services but not the guards, resolvers, and middleware that form the actual authorization and routing layer. The fix is extending the relation model or adding infrastructure node types.

3. **Omissions are undetectable** (Exp 9 C2): Missing information in the graph cannot be caught by consistency checking. The fix is a dedicated completeness-checking workflow separate from consistency checking.

These weaknesses are addressable through targeted product enhancements. The strengths -- 100% aspect violation detection during drift recovery, 90-100% recovery quality across all change types, multi-year artifact half-lives, and genuine cross-module emergent reasoning -- validate the core architectural thesis: persistent semantic memory structured as a graph with cross-cutting aspects and business process flows enables AI agents to reason about codebases with a depth and coherence that raw code analysis alone cannot achieve.

**The bottom line:** Use Yggdrasil when you need agents to understand WHY the system is designed as it is and WHAT ELSE is affected by a change. Supplement with raw code analysis when you need to know WHAT EXACTLY happens in edge cases. The two approaches are complementary, not competing.
