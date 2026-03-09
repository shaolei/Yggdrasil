# Protocol Quality Analysis

## Question Efficiency

| Metric | Value |
|---|---|
| Total questions asked | 18 |
| Graph elements created | 5 nodes + 3 aspects + 1 flow + 4 relations = 13 |
| Elements per question | 0.72 |
| Artifact files created | 20 (5 nodes x 3 artifacts + 3 aspect files + 2 flow files) |
| Artifact files per question | 1.11 |

## Redundancy

| Question | Redundant? | Notes |
|---|---|---|
| A1 | No | Core structural discovery |
| A2 | Partially | File locations could be auto-detected from A1 answers |
| A3 | No | Highest-value single question |
| A4 | No | Discovered infrastructure nodes |
| B1 | No | Core pattern discovery |
| B2 | Yes | Redundant with B1 (more specific version) |
| B3 | No | Critical for exceptions/variations |
| C1 | No | Happy path |
| C2 | No | Failure paths (high value) |
| C3 | Partially | Confirmed ordering already implied by C1/C2 |
| D1 | Partially | Got "I don't know" but produced partial decision |
| D2 | Partially | Got uncertain answer, produced partial decision |
| D3 | No | Excellent: "non-obvious constraints" prompt highly productive |
| D4 | Yes | Developer couldn't answer, produced nothing |
| E1-E4 | No | Targeted gap-filling, all productive |

**Redundancy rate**: 3-4 of 18 questions (17-22%) produced no significant new content.

## Gap Rate

Elements in reference graph NOT discovered by any question:

| Missing Element | Type | Why Missed |
|---|---|---|
| Parent module node (request-pipeline) | Node | Protocol has no question about grouping/hierarchy |
| operator-composition aspect | Aspect | B1/B2 found the pattern but it was folded into permissions node content rather than promoted to aspect |
| Relation failure details (4 instances) | Relation metadata | No question asks "what happens when this interaction fails?" |
| Node type service vs module | Type classification | No guidance on classifying node types |
| clone_request in api-view consumes | Relation detail | Not specifically asked about |
| Content negotiation forced fallback | Internals detail | Too specific for broad questions |
| Form data back-sync | Internals detail | Too specific for broad questions |
| Token lazy import | Internals detail | Too specific |
| select_related optimization | Internals detail | Too specific |
| DefaultRouter workaround | Internals detail | Too specific |
| check_object_permissions not automatic (decision) | Decision | D1-D4 questions too general |
| Django 5.1 LoginRequired (decision) | Decision | Too recent/specific |

**Gap rate by category**:
- Structural elements: ~20% missing (parent node, node types)
- Relations: 80% present but 0% have failure details
- Aspects: 67% direct match (1 of 3 missing as named aspect)
- Decisions: 50% captured (10/20)
- Implementation details: ~60% captured

## ROI by Phase

| Phase | Questions | High-Value Elements Produced | ROI Score |
|---|---|---|---|
| A (Module Discovery) | 4 | 5 nodes, 4 relations, file mappings | HIGH |
| B (Cross-Cutting Patterns) | 3 | 3 aspects (2 directly matching reference) | HIGH |
| C (Business Process) | 3 | 1 flow with 5 paths, invariants | HIGH |
| D (Decision Extraction) | 4 | 6 decisions (but 10 missed in reference) | MEDIUM |
| E (Gap-Filling) | 4 | Enriched 4+ artifacts | MEDIUM-HIGH |

**Phase A** has highest structural ROI: 4 questions produce the entire node/relation skeleton.
**Phase C** has highest per-question ROI: C2 alone produced 4 failure paths + key decisions.
**Phase D** has lowest ROI: 50% "I don't know" rate, and even successful answers were less specific than reference decisions.

## "I Don't Know" Rate

| Phase | Questions | IDK Responses | Rate |
|---|---|---|---|
| A | 4 | 0 | 0% |
| B | 3 | 0 | 0% |
| C | 3 | 0 | 0% |
| D | 4 | 3 (partial) | 75% |
| E | 4 | 0 | 0% |
| **Total** | **18** | **3** | **17%** |

Phase D's 75% IDK rate confirms that "why" questions about historical decisions are the hardest for developers. The extraction protocol should provide alternative strategies when D-phase questions fail.

## Follow-Up Necessity

| Content Type | Discovered in Initial Phases | Required Follow-Up |
|---|---|---|
| Node structure | 100% (Phase A) | 0% |
| Relations | 100% (Phase A) | 0% |
| Aspects | 100% (Phase B) | 0% |
| Flow structure | 100% (Phase C) | 0% |
| Flow failure paths | 100% (Phase C) | 0% |
| Decisions | ~60% (Phase D) | ~40% (Phase E enriched) |
| Interface details | ~70% (Phases A-D) | ~30% (Phase E) |
| Internals depth | ~50% (Phase D) | ~50% (Phase E) |

Phase E (gap-filling) was essential for internals depth. Without it, decision coverage would drop from 50% to ~30%.

## Minimum Viable Question Set

The extraction analysis identified 8 questions capturing ~80% of graph content:

1. **A1** — What are the components (nodes)
2. **A3** — How do they interact (relations)
3. **A4** — Implicit effects (infrastructure nodes)
4. **B1** — Common patterns (aspects)
5. **B3** — Exceptions to patterns (aspect exceptions)
6. **C1** — Happy path (flow)
7. **C2** — Failure paths (flow paths + decisions)
8. **D3** — Non-obvious constraints (constraints + some decisions)

This set:
- Captures all 5 nodes and 4 relations
- Captures all 3 aspects (though operator-composition might be missed without B2)
- Captures the flow with all paths
- Captures ~40% of decisions (vs 50% with full protocol)
- Misses: file mappings (A2), some decisions (D1/D2), gap-filling (E)

**Assessment**: 8 questions is well within the patience threshold. Adding 2 targeted gap-filling questions (E phase) brings it to 10, which captures ~90% of what the full 18-question protocol achieves.

## What Information Was Missing That Protocol Couldn't Extract

### Structurally Missing (Protocol Design Gap)

1. **Relation failure modes**: No question asks "when component A calls component B and it fails, what happens?" This is a protocol gap — add a question to Phase A.

2. **Node hierarchy/grouping**: No question asks about logical grouping of components. The protocol produces flat structure. Add: "Are any of these components part of a larger subsystem?"

3. **Node type classification**: No guidance on distinguishing service vs module vs infrastructure beyond A4. The protocol should provide type definitions.

### Semantically Missing (Developer Knowledge Gap)

1. **Historical design rationale** (D1, D4): Developer didn't know original reasons for wrapper pattern, sliding window choice, etc. This is inherent to the "knows code but not history" developer profile. Protocol cannot fix this.

2. **Rejected alternatives** (D4): Developer couldn't recall debates. This is the highest-value missing content and the hardest to extract.

3. **Implementation micro-details**: Token lazy import, select_related, form data back-sync. These are too specific for broad extraction questions and too numerous for exhaustive questioning.

### Recommendation

The protocol should add 3 questions:

- **A5**: "Are any of these components part of a larger subsystem or logical group?" (captures hierarchy)
- **A3b**: "For each interaction, what happens when it fails? What error does the calling component see?" (captures relation failure modes)
- **D3b**: "For each non-obvious constraint, what was the alternative? What would break without it?" (improves rejected-alternative capture from D3's constraint answers)

This would bring the full protocol to 21 questions and the minimum viable set to 11.
