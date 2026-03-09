# Extraction Analysis — DRF Guided Construction

## Summary Statistics

- **Total questions asked**: 18 (A1-A4: 4, B1-B3: 3, C1-C3: 3, D1-D4: 4, E1-E5: 5 gap-filling, but E4-E5 were a second round = 2 rounds of gap-filling)
- **"I don't know" responses**: 3 partial
  - D1 (Request wrapper vs subclass): "I'm honestly not sure of the original reason"
  - D4 (architecture debates): "I don't really know about specific debates"
  - D2 (lazy vs eager auth): "I'm not 100% sure that was the explicit reasoning"
- **Graph elements created**: 5 nodes, 3 aspects, 1 flow, 4 relations

## Phase Productivity

| Phase | Questions | Graph Elements Created | Highest-Value Output |
|---|---|---|---|
| A (Module Discovery) | 4 | 5 nodes, 4 relations, file mappings | Node structure and relations |
| B (Cross-Cutting Patterns) | 3 | 3 aspects | Policy pattern, lazy evaluation, class-based config |
| C (Business Process) | 3 | 1 flow | Request processing flow with 5 paths |
| D (Decision Extraction) | 4 | Decisions in internals.md (6 decisions) | CSRF split, wrapper vs subclass, 401→403 coercion |
| E (Gap-Filling) | 4 | Enriched existing artifacts | OR composition semantics, auth chain behavior |

## Highest-ROI Questions

1. **A3** (interactions) — Produced all 4 relations plus understanding of the pipeline order. Single most productive question.
2. **B1** (common patterns) — Produced the policy-pattern aspect, the most important cross-cutting concern.
3. **B3** (exceptions to patterns) — Produced aspect exceptions and the key insight about throttle collect-all vs permission short-circuit.
4. **C2** (failure points) — Produced all failure paths in the flow plus the 401→403 coercion logic and 404 information leakage prevention.
5. **D3** (non-obvious constraints) — Produced wrap_attributeerrors constraint, queryset evaluation guard, CSRF location decision, OR composition re-check behavior.

## Least Productive Questions

1. **D4** (debates) — Developer didn't know. Produced nothing new.
2. **A2** (file locations) — Trivially mapped, low information density. Needed for correctness but not for understanding.

## Information MISSING That Developer Couldn't Provide

1. **Original design rationale for Request wrapper pattern** — Developer said "I'm not sure, it was like this when I joined." Recorded as "rationale: unknown."
2. **Historical debates on architecture** — Developer had no knowledge of mailing list or PR discussions.
3. **Why permissions before throttles specifically** — Developer guessed "to avoid wasting throttle budget" but wasn't confident. Recorded as developer's inference.
4. **Why sliding window for throttling** — Developer didn't know; predates current team. Recorded as "rationale: unknown."
5. **Rejected alternatives for composition operators** — Developer knew they were added but not what alternatives were considered.

## Phase Analysis

### Phase A (Module Discovery) — Most Structural Value
The four questions efficiently mapped the entire component structure. A3 (interactions) was the standout — it revealed the pipeline architecture and the asymmetry in how authentication works (indirectly via Request vs direct calls for permissions/throttling). A4 (implicit effects) surfaced the exception handler and CSRF split, which are genuinely non-obvious.

### Phase B (Cross-Cutting Patterns) — Most Aspect Value
B1 and B2 were somewhat redundant (B2 is a more specific version of B1). B3 was essential — it's where the behavioral differences emerged (short-circuit vs collect-all, lazy vs eager). Without B3, the policy pattern would look uniform, which is misleading.

### Phase C (Business Process) — Most Flow Value
C1 gave the happy path. C2 was exceptionally productive — failure paths are where the interesting behavior lives (401→403 coercion, 404 information hiding, set_rollback). C3 confirmed the pipeline ordering constraint.

### Phase D (Decision Extraction) — Highest Miss Rate
2 of 4 questions got "I don't know" responses. D1 and D2 produced partial answers. D3 was excellent — "non-obvious constraints" is a better prompt for developers than "why was it designed this way." D4 was unproductive.

### Phase E (Gap-Filling) — Precision Enrichment
Targeted questions about specific behaviors (OR composition re-check, auth chain exception behavior, ATOMIC_REQUESTS interaction). High precision, low volume. Every answer enriched an existing artifact.

## Minimum Viable Question Set

Based on ROI analysis, the following 8 questions capture ~80% of graph content:

1. A1 (what are the components)
2. A3 (how do they interact)
3. A4 (implicit effects)
4. B1 (common patterns)
5. B3 (exceptions to patterns)
6. C1 (happy path)
7. C2 (failure paths)
8. D3 (non-obvious constraints)

Questions that could be dropped with minimal loss: A2 (file locations — could be auto-detected), B2 (redundant with B1), C3 (mostly confirmed what C1/C2 implied), D1/D2 (specific design questions — hit-or-miss), D4 (rarely productive).

## Observations on Developer Simulation

The simulated developer was most valuable when:
- Describing WHAT (concrete, accurate answers)
- Describing HOW things interact (A3 was excellent)
- Identifying edge cases and exceptions (B3, C2, D3)

The simulated developer was least valuable when:
- Explaining WHY historical decisions were made
- Recalling team debates or alternatives considered
- Providing architectural rationale vs practical observations

This matches expectations for a "knows the code but not the history" developer profile.
