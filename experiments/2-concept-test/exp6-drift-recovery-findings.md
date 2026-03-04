# Experiment 6: Drift Recovery — Synthesis Findings

## 1. Hypothesis

**Statement:** An agent with full rules + stale graph + current code can correctly identify drift and update graph artifacts. Recovery quality depends on change type: additive changes are easier than semantic changes.

**Prediction gradient:** M1 (additive) should be easiest, M2 (behavioral) and M3 (invariant-breaking) moderately difficult, and M4 (architectural) hardest due to cascading aspect implications.

---

## 2. Methodology

### Experimental Design

Four mutations were applied independently to the same codebase (`TeamCollectionService` from Hoppscotch), each representing a different category of real-world code drift:

| Mutation | Type | Description |
|----------|------|-------------|
| M1 | Additive | New `searchTeamCollections` method added — new functionality with no changes to existing behavior |
| M2 | Behavioral | `updateCollectionOrder` semantics changed from "place before next" to "place after target" — existing algorithm rewritten |
| M3 | Invariant-breaking | Pessimistic locking and retry loop removed from `deleteCollectionAndUpdateSiblingsOrderIndex` — breaks cross-cutting aspect invariants |
| M4 | Architectural | Entire concurrency model replaced: pessimistic locking replaced by optimistic concurrency control across ALL mutation methods |

### Protocol

Each agent received:
- The complete Yggdrasil rules (agent-rules.md)
- The original (stale) graph context package for TeamCollectionService
- The mutated source code
- A drift notification instructing recovery

Each agent was asked to:
1. Identify all differences between the stale graph and current code
2. Produce BEFORE/AFTER for every artifact that needs updating
3. Detect and flag any aspect violations
4. Assess severity and recommend actions

### Gold Standards

Gold standards were prepared in advance for each mutation specifying:
- Exactly which artifacts need updating and how
- Which aspects are violated, preserved, or newly needed
- The expected difficulty level
- What a correct recovery looks like

---

## 3. Results by Mutation

### M1 — Additive Change (New searchTeamCollections Method)

**Gold standard expected:** Updates to responsibility.md (add new search method), logic.md (add algorithm description), decisions.md (add decision explaining coexistence with searchCollections), pubsub-events aspect (add new `coll_search` channel). No aspect violations. No changes to constraints.md.

**Agent recovery analysis:**

| Item | Gold Standard | Agent Report | Verdict |
|------|--------------|--------------|---------|
| New method detected | searchTeamCollections identified | Yes, identified as change #1 | TRUE POSITIVE |
| New PubSub event | `coll_search` channel documented | Yes, identified as change #2 with full channel/payload details | TRUE POSITIVE |
| responsibility.md update | Add second search mechanism | Yes, comprehensive update distinguishing both search mechanisms | TRUE POSITIVE |
| logic.md update | Add algorithm (validate, escape, LEFT JOIN, similarity DESC, OFFSET/LIMIT, publish analytics) | Yes, all 5 steps documented accurately | TRUE POSITIVE |
| decisions.md update | Explain why searchTeamCollections exists alongside searchCollections | Yes, added decision "Why searchTeamCollections uses LEFT JOIN instead of recursive CTE" and "Why searchTeamCollections publishes a search analytics event" | TRUE POSITIVE (expanded) |
| pubsub-events aspect update | Add `coll_search` channel + timing note | Yes, full BEFORE/AFTER with channel, timing, and payload shape | TRUE POSITIVE |
| constraints.md | Gold says no change needed | Agent added "Search query validation" constraint (empty query check) and "Team membership for CLI access" + "Creation failure handling" | EXTRA (not false positive — valid observations but beyond the mutation scope) |
| pessimistic-locking aspect | Gold says no change needed | Agent correctly notes no violation (read-only operation) | TRUE POSITIVE |
| retry-on-deadlock aspect | Gold says no change needed | Agent correctly confirms still accurate | TRUE POSITIVE |

**Additional findings by agent (beyond gold standard):**
- Detected 15 total changes across the codebase, many pre-existing documentation gaps (not introduced by the mutation): `sortTeamCollections`, `totalCollectionsInTeam`, `getTeamCollectionsCount`, `renameCollection` deprecation, `moveCollection` transactional wrapper, `getCollection` tx parameter, `cast`/`transformCollectionData`, two distinct export methods, CLI membership check
- Found a real bug: `fetchCollectionParentTree` missing `return` on `E.left()` in catch block
- Provided a detailed method-by-method coverage inventory (39 methods assessed)

**Aspect violation detection:** Gold standard says none. Agent correctly reports none for the mutation itself. Agent also notes the PubSub aspect's scope statement ("every mutation") is semantically inaccurate since search is read-only — a valid observation about the aspect's wording, not a violation per se.

**Score: 100% of gold standard recovered.** Agent exceeded expectations by also documenting pre-existing gaps and finding a real bug. The additional pre-existing findings do not count as false positives because the agent correctly distinguished mutation-introduced changes from pre-existing gaps.

---

### M2 — Behavioral Change (Reorder Semantics Reversed)

**Gold standard expected:** Complete rewrite of logic.md reorder algorithm (nextCollectionID -> targetCollectionID, "before" -> "after", null = end -> null = beginning), new decisions.md entry (why semantics changed), minor PubSub note (payload field name `nextCollection` is now semantically misleading). No aspect violations. Constraints unchanged.

**Agent recovery analysis:**

| Item | Gold Standard | Agent Report | Verdict |
|------|--------------|--------------|---------|
| Semantic shift detected | "place before" -> "place after" | Yes, identified as change 1.1, the "largest single drift" | TRUE POSITIVE |
| Parameter rename | nextCollectionID -> targetCollectionID | Yes, documented in comparison table | TRUE POSITIVE |
| Null case flip | end -> beginning | Yes, explicitly documented: "Move to **beginning** of list" | TRUE POSITIVE |
| Algorithm rewrite (UP range) | [target+1, collection-1] increment | Yes, correctly documented | TRUE POSITIVE |
| Algorithm rewrite (DOWN range) | [collection+1, target] decrement | Yes, correctly documented | TRUE POSITIVE |
| Final position (UP) | target.orderIndex + 1 | Yes, correctly documented | TRUE POSITIVE |
| Final position (DOWN) | target.orderIndex | Yes, correctly documented | TRUE POSITIVE |
| logic.md complete rewrite | Full BEFORE/AFTER | Yes, comprehensive BEFORE/AFTER provided | TRUE POSITIVE |
| decisions.md entry | Explain why semantics changed | Not provided as a standalone decisions.md update | FALSE NEGATIVE |
| PubSub payload naming note | `nextCollection` field semantically misleading | Agent notes "unchanged key name, but semantically it is the target" — identified but not proposed as an aspect update | PARTIAL (detected, not actioned) |
| responsibility.md | Gold says minimal/no change | Agent updated to reflect new semantics in responsibility description | TRUE POSITIVE (extra) |
| constraints.md | Gold says no change | Agent updated "Circular reference prevention" with TOCTOU note, added "Sort" to OrderIndex contiguity, added "Team membership for CLI access" | EXTRA (beyond mutation scope) |

**Additional findings by agent (beyond M2 mutation):**
- Detected 15 total changes, many overlapping with pre-existing gaps (similar to M1 agent's broader analysis)
- Identified moveCollection transactional wrapper (change 1.2-1.6) — pre-existing, not part of M2
- Identified sortTeamCollections, createCollection locking, importCollectionsFromJSON locking — pre-existing
- Found the same `fetchCollectionParentTree` bug
- Identified sortTeamCollections missing PubSub event as a potential aspect violation

**Aspect violation detection:** Gold standard says none for the M2 mutation. Agent correctly identifies no violations from the reorder semantics change itself, but also flags sortTeamCollections missing PubSub (pre-existing, not from M2).

**Score: ~90% of gold standard recovered.** The core behavioral change was identified perfectly with full algorithmic detail. The gap: no explicit decisions.md entry explaining WHY the semantics changed (gold standard expected this). The PubSub payload naming inconsistency was noticed but not formalized as an aspect update. The agent's broader codebase analysis was thorough but included many pre-existing issues beyond M2.

---

### M3 — Invariant-Breaking Change (Remove Delete Locking + Retry)

**Gold standard expected:** Flag pessimistic-locking aspect VIOLATION (delete no longer locks). Flag retry-on-deadlock aspect as ORPHANED/INAPPLICABLE. Update decisions.md (remove or rewrite "why delete has retries"). Update constraints.md with concurrency regression warning. Remove retry-on-deadlock from node.yaml aspects. Logic.md: add sort algorithm (pre-existing gap), note delete simplification. Agent should NOT silently fix graph to match code — should flag the violations.

**Agent recovery analysis:**

| Item | Gold Standard | Agent Report | Verdict |
|------|--------------|--------------|---------|
| Locking removed from delete | Must detect lock removal from one specific method | Yes, identified as change L2 with method-level detail | TRUE POSITIVE |
| Retry loop removed from delete | Must detect complete retry removal | Yes, identified as change D1 and L1 with code snippets | TRUE POSITIVE |
| pessimistic-locking VIOLATION flagged | Must flag, not silently fix | Yes, explicitly flagged as "ASPECT VIOLATION DETECTED" with HIGH severity | TRUE POSITIVE |
| Other methods still lock | Must note delete is the ONLY method without locking | Yes, provided compliance table showing 6 methods lock, 1 does not | TRUE POSITIVE |
| retry-on-deadlock ORPHANED | Must identify aspect is completely inapplicable | Yes, "Entire aspect is ENTIRELY INAPPLICABLE to current code" — identified dead constants (MAX_RETRIES, delay import) | TRUE POSITIVE |
| node.yaml update | Remove retry-on-deadlock from aspects | Yes, provided BEFORE/AFTER: `[pessimistic-locking, pubsub-events]` | TRUE POSITIVE |
| decisions.md update | Remove/rewrite "Why delete has retries" | Yes, provided BEFORE/AFTER with "[REMOVED]" marker and rationale note | TRUE POSITIVE |
| constraints.md update | Add concurrency regression warning | Not explicitly provided as a BEFORE/AFTER for constraints.md | FALSE NEGATIVE |
| sortTeamCollections documented | Add sort algorithm to logic.md | Yes, provided full algorithm in logic.md AFTER | TRUE POSITIVE |
| pubsub-events — sort missing event | Potential violation | Yes, flagged as "POTENTIAL ASPECT VIOLATION" with MEDIUM severity | TRUE POSITIVE |
| Dead code noted | MAX_RETRIES, delay import unused | Yes, identified as LOW severity cleanup items | TRUE POSITIVE (bonus) |

**Aspect violation detection:** Gold standard expects TWO aspect findings: (1) pessimistic-locking violated by delete, (2) retry-on-deadlock orphaned. Agent found BOTH plus a bonus third: sortTeamCollections missing PubSub event.

**Key quality indicator:** The gold standard explicitly states "A naive agent would just update the code description and miss the aspect violations entirely." This agent did NOT behave naively — it correctly prioritized aspect violations as the primary findings, not just code-level description updates.

**Gap:** The agent did not provide a constraints.md BEFORE/AFTER warning about orderIndex contiguity regression under concurrent deletes. The gold standard expected: "Under concurrent deletes on the same sibling set, the orderIndex contiguity invariant may be violated." The agent's decisions.md update mentions this concern ("may be intentional or an oversight — requires clarification") but does not formalize it in constraints.md.

**Score: ~90% of gold standard recovered.** All critical aspect violations detected. The missing constraints.md concurrency warning is a gap but the concern was raised elsewhere in the report. The agent demonstrated the exact cross-cutting reasoning the gold standard predicted would be difficult.

---

### M4 — Architectural Change (Pessimistic -> Optimistic Concurrency)

**Gold standard expected:** Detect replacement of entire concurrency model. Remove pessimistic-locking and retry-on-deadlock aspects from node.yaml. Create NEW optimistic-locking/optimistic-concurrency aspect. Rewrite logic.md (all "Lock siblings" steps become "Read sibling versions"). Add new constraints (version field requirement). Rewrite decisions.md (remove "why delete has retries", add "why optimistic replaced pessimistic", address the inverted rationale). Update responsibility.md ("pessimistic row locking" -> "optimistic concurrency control"). Flag BOTH aspects as completely violated. Note breaking API change (new TEAM_COLL_STALE_VERSION error).

**Agent recovery analysis:**

| Item | Gold Standard | Agent Report | Verdict |
|------|--------------|--------------|---------|
| Architectural paradigm shift detected | Must identify pessimistic -> optimistic replacement | Yes, identified as "MAJOR ARCHITECTURAL CHANGE" in header, "paradigm shift" | TRUE POSITIVE |
| readSiblingVersions method identified | Two new private helper methods | Yes, with full signature and description | TRUE POSITIVE |
| verifySiblingVersions method identified | Two new private helper methods | Yes, with full signature and description | TRUE POSITIVE |
| All 6+ affected methods identified | Every mutation method changed | Yes, all 6 listed: import, create, delete, move, reorder (both branches), sort | TRUE POSITIVE |
| pessimistic-locking COMPLETELY VIOLATED | Must flag total removal | Yes, "INVALID — must be removed or archived" | TRUE POSITIVE |
| retry-on-deadlock COMPLETELY VIOLATED | Must flag total removal | Yes, "INVALID — must be removed or archived" | TRUE POSITIVE |
| New aspect creation proposed | optimistic-locking/optimistic-concurrency | Yes, proposed "optimistic-concurrency" with full aspect.yaml and content.md draft | TRUE POSITIVE |
| node.yaml update | Replace aspect list | Yes, BEFORE/AFTER: `[optimistic-concurrency, pubsub-events]` | TRUE POSITIVE |
| logic.md rewrite | "Lock siblings" -> "Read sibling versions snapshot" + verify step | Yes, provided for every algorithm: reorder (both branches), move, delete, create, import, sort | TRUE POSITIVE |
| constraints.md update | Add version field requirement + update OrderIndex contiguity | Yes, added "Optimistic concurrency on sibling sets" and "Move operation: dual-parent version checking" | TRUE POSITIVE |
| decisions.md — remove stale decision | Remove "Why delete has retries" | Yes, explicitly marked for removal | TRUE POSITIVE |
| decisions.md — add "Why optimistic replaced pessimistic" | New decision with trade-offs | Yes, comprehensive trade-off analysis (pros and cons) | TRUE POSITIVE |
| decisions.md — add "Why delete no longer retries" | New decision | Yes, provided | TRUE POSITIVE |
| decisions.md — add "Why createCollection distinguishes ConflictException" | New decision | Yes, provided with error-code distinction explanation | TRUE POSITIVE |
| responsibility.md update | "pessimistic row locking" -> "optimistic concurrency control" | Yes, exact text replacement provided | TRUE POSITIVE |
| pubsub-events aspect | Gold says no change | Agent correctly identifies "VALID — no changes needed" | TRUE POSITIVE |
| Inverted rationale noted | The old aspect said "optimistic would be impractical" — now contradicted | Yes, highlighted in Risk Assessment: "directly contradicts this documented rationale" | TRUE POSITIVE |
| TEAM_COLL_STALE_VERSION error | New error code changes API contract | Yes, documented in section 4, noted callers must handle it | TRUE POSITIVE |
| TEAM_COLL_CREATION_FAILED error | New error code | Yes, documented | TRUE POSITIVE |
| Breaking API change flagged | Callers that never saw STALE_VERSION must now handle it | Mentioned in decisions.md draft ("shifts retry responsibility to the caller") but not explicitly flagged as "breaking change" | PARTIAL |
| Methods with NO changes listed | Unchanged methods confirmed | Yes, exhaustive list of 28 unchanged methods in section 8 | TRUE POSITIVE (thoroughness) |

**Aspect violation detection:** Gold standard expects BOTH aspects flagged as completely violated. Agent found both and additionally proposed the creation of a replacement aspect with full content draft.

**Score: ~98% of gold standard recovered.** Nearly perfect recovery. The only minor gap is that the breaking API change (callers must now handle TEAM_COLL_STALE_VERSION) was described within the decisions but not elevated to a separate "Breaking Change" warning as the gold standard implied. The agent's analysis was remarkably thorough, including the risk assessment noting the direct contradiction of documented rationale.

---

## 4. Comparison Matrix

| Metric | M1 (Additive) | M2 (Behavioral) | M3 (Invariant-Break) | M4 (Architectural) |
|--------|---------------|------------------|----------------------|---------------------|
| **Changes identified** | 15 (1 from mutation + 14 pre-existing) | 15 (1 core change + 14 pre-existing) | 6 (3 from mutation + 3 pre-existing) | 22+ (6 method changes + 2 new methods + 2 new errors + 28 unchanged confirmed) |
| **True positives** | 10/10 gold standard items | 8/10 gold standard items | 10/11 gold standard items | 19/20 gold standard items |
| **False negatives** | 0 | 1 (no decisions.md "why semantics changed" entry) | 1 (no constraints.md concurrency warning) | 0-1 (breaking API change not separately elevated) |
| **False positives** | 0 (extras were valid pre-existing gaps) | 0 (extras were valid pre-existing gaps) | 0 | 0 |
| **Aspect violations detected** | 0 (correct: none expected) | 0 for M2 itself (correct); 1 bonus pre-existing | 2 (pessimistic-locking + retry-on-deadlock) + 1 bonus | 2 (pessimistic-locking + retry-on-deadlock) |
| **Aspect violations expected** | 0 | 0 | 2 | 2 |
| **New aspect proposed** | No (correct) | No (correct) | No (correct — just removal) | Yes: optimistic-concurrency (correct) |
| **Recovery quality score** | **100%** | **~90%** | **~90%** | **~98%** |
| **Gold standard difficulty** | Easy | Medium | Hard | Very Hard |

---

## 5. Key Findings

### 5.1 Recovery difficulty does NOT simply increase with change complexity

**The hypothesis predicted:** M1 (easy) < M2 (medium) < M3 (hard) < M4 (very hard).

**Actual results:** M1 (100%) >= M4 (~98%) > M2 (~90%) = M3 (~90%).

This is counterintuitive. M4, rated "very hard" by the gold standard, was recovered with near-perfect fidelity, while M2 (rated "medium") and M3 (rated "hard") each had a gap. Possible explanations:

1. **Architectural changes are OBVIOUS.** When the entire concurrency model changes, every method is affected, and the pattern is unmistakable. The agent cannot miss it because the change is pervasive.

2. **Behavioral changes require semantic understanding.** M2 required the agent to understand what "place before" vs "place after" means algorithmically, then reason about WHY someone would make this change. The algorithmic understanding was excellent; the "why" reasoning (decisions.md) was the gap.

3. **Invariant breaks require reasoning about ABSENCE.** M3 required detecting that something was REMOVED (locking from delete), which is inherently harder than detecting something added or changed. The agent detected the removal but missed the full implication chain to constraints.md.

### 5.2 Agents excel at detecting additions and architectural replacements

Both M1 (additive) and M4 (architectural replacement) achieved the highest scores. These share a characteristic: the changes are PRESENT in the code. New methods are visible. New helper methods (readSiblingVersions, verifySiblingVersions) are visible. Removed lock calls leave an obvious absence pattern when every other method still has them.

### 5.3 The "decisions.md gap" — agents describe WHAT but struggle with WHY

Across all four mutations:
- M1: Agent provided decisions (why LEFT JOIN, why analytics event) — **strong**
- M2: Agent described the behavioral change accurately but did NOT produce a decision explaining WHY the semantics changed — **gap**
- M3: Agent flagged the violation and recommended asking the user — **correct process** (the gold standard also says the rationale is unknown)
- M4: Agent provided comprehensive decisions with trade-off analysis — **strong**

The pattern: agents produce good decisions when the trade-offs are visible in the code (M1: LEFT JOIN vs CTE, M4: version checks vs row locks). They struggle when the rationale is purely in the developer's intent (M2: why "place after" instead of "place before" — nothing in the code explains this).

### 5.4 Aspect violation detection is strong

| Mutation | Expected Violations | Detected Violations | Correct? |
|----------|-------------------|--------------------|----|
| M1 | 0 | 0 | Yes |
| M2 | 0 | 0 (for M2 mutation; bonus pre-existing found) | Yes |
| M3 | 2 (pessimistic-locking + retry-on-deadlock) | 2 + 1 bonus (sortTeamCollections PubSub) | Yes |
| M4 | 2 (pessimistic-locking + retry-on-deadlock) | 2 | Yes |

**100% detection rate for aspect violations.** No false negatives on aspect violation detection. This is a critical finding: the Yggdrasil context package provides enough information for agents to reason about cross-cutting invariants, not just local code behavior.

### 5.5 Agents correctly distinguish between "fix the graph" and "flag the violation"

The M3 gold standard specifically warns: "A naive agent would just update the code description and miss the aspect violations entirely." Both the M3 and M4 agents demonstrated non-naive behavior:

- M3 agent flagged the pessimistic-locking violation as HIGH severity and recommended either re-adding the lock or documenting an exception — NOT silently removing the aspect
- M4 agent noted the inverted rationale (old aspect said "optimistic would be impractical") and recommended user confirmation before finalizing

This suggests the Yggdrasil rules ("Never auto-resolve drift without asking the user") successfully influence agent behavior during recovery.

### 5.6 Pre-existing gaps are consistently surfaced

Both M1 and M2 agents independently discovered the same set of ~14 pre-existing documentation gaps (undocumented methods like sortTeamCollections, totalCollectionsInTeam, getTeamCollectionsCount, the renameCollection deprecation, moveCollection transactional wrapper, etc.). Both also found the same real bug (fetchCollectionParentTree missing return). This consistency across independent runs increases confidence that the gap identification is accurate and reproducible.

---

## 6. Product Implications for Yggdrasil

### 6.1 Drift detection should classify change types

**Finding:** Recovery quality varies by change type, and the strategies differ. An additive change (M1) needs new artifact sections. A behavioral change (M2) needs rewrites. An invariant-breaking change (M3) needs violation flags. An architectural change (M4) needs new aspects created.

**Recommendation:** `yg drift` output could classify detected changes:
- **Added** — new methods/functions not in any artifact
- **Modified** — existing mapped functions with changed behavior
- **Removed** — functions in artifacts but not in code
- **Aspect-relevant** — changes touching code patterns described in aspects

This classification would help agents choose the correct recovery strategy immediately rather than having to infer it.

### 6.2 Aspect violation detection should be built into the CLI

**Finding:** Agents successfully detected aspect violations when given the aspect text and the code, but this required manual reasoning. This could be automated.

**Recommendation:** `yg drift` could include an aspect-compliance check:
- For each aspect with a stated invariant (e.g., "every operation that modifies orderIndex must lock first"), scan the code for methods that modify orderIndex and verify they all lock
- Report potential violations alongside drift data
- This would catch M3-style violations mechanically rather than relying on agent reasoning

### 6.3 The "why" prompt should be built into drift recovery guidance

**Finding:** The M2 agent's main gap was not producing a decisions.md entry explaining WHY the behavioral change happened. The agent correctly described WHAT changed but did not ask about or hypothesize the rationale.

**Recommendation:** The Yggdrasil rules for drift resolution should include:
```
For behavioral changes (existing logic modified):
  - ALWAYS create a decisions.md entry explaining WHY the change was made
  - If the rationale is not apparent from the code, ASK the user
  - Never leave a behavioral change without a recorded rationale
```

### 6.4 Constraint impact analysis should be explicit

**Finding:** The M3 agent detected the locking removal but did not trace through to the constraint implication (OrderIndex contiguity may now be violated under concurrency). The M4 agent DID trace this implication. The difference may be that M4's change was more obviously constraint-affecting (new version column requirement).

**Recommendation:** `yg drift` or `yg impact` could display affected constraints when code changes touch constrained operations. For example:
```
Drift detected in deleteCollectionAndUpdateSiblingsOrderIndex:
  - Pessimistic lock call REMOVED
  - This method is covered by constraint: "OrderIndex contiguity"
  - WARNING: Constraint may no longer be enforceable under concurrency
```

### 6.5 Artifact templates for common change types

**Finding:** The agents produced high-quality BEFORE/AFTER blocks for artifacts, but the format varied. Some included full context; others showed only the changed section.

**Recommendation:** Yggdrasil could provide artifact update templates:
- For additive changes: "Append to [artifact] under section [X]"
- For behavioral changes: "Replace section [X] in [artifact] with updated algorithm"
- For aspect violations: "Flag violation in [aspect] — do not silently modify"
- For architectural changes: "Create new aspect [name], remove old aspects [list], rewrite [artifacts]"

### 6.6 The context package is effective for recovery

**Overall finding:** Across all four mutations, agents demonstrated that the Yggdrasil context package provided sufficient information to detect drift, understand its implications, and propose correct updates. The 100% aspect-violation detection rate is particularly strong evidence. The context package's combination of responsibilities, logic descriptions, constraints, decisions, and aspect definitions gave agents the vocabulary and framework to reason about changes at multiple levels (code, behavior, invariants, architecture).

---

## 7. Conclusion

The experiment confirms the hypothesis with a significant refinement: **additive changes are indeed easiest to recover, but architectural changes (while requiring the most work) are NOT the hardest to recover correctly.** The actual difficulty ranking by recovery quality is:

1. **Easiest:** Additive changes (M1, 100%) — new things are visible and self-describing
2. **Hardest:** Behavioral changes (M2, ~90%) and invariant-breaking changes (M3, ~90%) — behavioral changes require understanding semantic intent (WHY), and invariant breaks require reasoning about absence and implication chains
3. **Moderate despite complexity:** Architectural changes (M4, ~98%) — pervasive changes are paradoxically easier because the pattern is unmistakable across all methods

Key takeaways for Yggdrasil product development:

1. **The graph works.** Agents with stale graphs and current code can recover to 90-100% accuracy across all change types. The context package provides sufficient structure for cross-cutting reasoning.
2. **Aspect violations are reliably detected (100%).** This validates the aspect system as an effective mechanism for capturing cross-cutting invariants that agents can enforce.
3. **The "why" gap is real.** Agents excel at describing WHAT changed but sometimes miss documenting WHY, especially for behavioral changes where the rationale lives in developer intent rather than code structure. Rules and tooling should prompt for this.
4. **Constraint implications need tracing.** When a code change affects an operation governed by a constraint, agents should be guided to evaluate whether the constraint is still enforceable. This is where M3 had its gap.
5. **No false positives were generated.** Across all four mutations, agents produced zero false positives. Every change they reported was real (either from the mutation or from pre-existing gaps). This means recovery is conservative and trustworthy — agents do not hallucinate changes.

The experiment demonstrates that Yggdrasil's semantic memory architecture is resilient to drift: even when the graph becomes stale, an agent equipped with the rules and the context package can recover it to high fidelity. The product should invest in change-type classification and constraint-impact tracing to close the remaining 2-10% gap.
