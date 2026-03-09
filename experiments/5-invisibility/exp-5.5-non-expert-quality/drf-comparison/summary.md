# Comparison Summary: DRF Reference vs Guided Graph

## Headline Results

| Metric | Value | Threshold | Verdict |
|---|---|---|---|
| Structural coverage | 78% | - | Good |
| Semantic depth (avg) | 75% | - | Good |
| Decision coverage | 50% (10/20) | INVEST: >=60%, ITERATE: 40-59% | ITERATE |
| "Why NOT" coverage | 67% (~10/15) | INVEST: >=40% | INVEST |
| Predicted blindfold score | 90% of reference | INVEST: >=80% | INVEST |
| Minimum viable question set | 8 questions (10 with gap-fill) | INVEST: <=15 | INVEST |

## What the Guided Graph Does Well

1. **Responsibility capture is perfect** (100%). The extraction protocol reliably captures WHAT each component does and does not do. Every responsibility.md is equivalent to or more detailed than the reference.

2. **Infrastructure node identification is perfect** (100%). Question A4 ("components that affect others without being called") correctly identified all three infrastructure nodes.

3. **Flow capture is excellent** (~83%). The flow covers happy path, all failure paths, and key invariants. C2 (failure paths) was the single most productive question for capturing behavioral nuance.

4. **Rationale and counterfactual answering is strong** (6/6 PASS predicted). The graph captures enough "why" to answer reasoning questions correctly, even with only 50% of reference decisions captured.

5. **Aspect identification is solid** (100% semantic coverage, though structurally different). The policy pattern, lazy evaluation, and configuration hierarchy are all captured.

## What the Guided Graph Misses

1. **Decision depth** (50%). Half the reference decisions are missing. Phase D questions had 75% "I don't know" rate. The protocol needs better strategies for extracting historical rationale.

2. **Relation failure details** (0%). No relation has a `failure` field. The protocol has no question about interaction failure modes. This is a protocol design gap.

3. **Interface exhaustiveness** (73%). The guided graph captures key methods but misses utility methods, helper functions, and secondary properties. This matters for structural trace questions (S2, S3).

4. **Hierarchy** (0% of parent nodes). The protocol produces flat structure. No question asks about logical grouping.

5. **Operator-composition not promoted to aspect**. The pattern is captured in node content but not as a named, cross-referenceable aspect. This reduces its visibility in context packages for other nodes.

## Protocol Improvements Needed

### High Priority (would fix identified gaps)

1. **Add A3b**: "For each interaction, what happens when it fails?" -- fixes 0% relation failure coverage
2. **Add A5**: "Are these components part of a larger subsystem?" -- fixes missing hierarchy
3. **Improve D-phase fallback**: When developer says "I don't know why," prompt with "What would break if this were done differently?" -- converts WHY gaps into constraint observations

### Medium Priority

4. **Add node type guidance** in protocol instructions: define when to use service vs module vs infrastructure
5. **Promote cross-cutting patterns to aspects** explicitly in protocol instructions (extraction agent folded operator-composition into node content instead)

### Low Priority

6. **Drop B2** (redundant with B1) and **D4** (rarely productive)
7. **Add D3b**: "For each constraint, what was the alternative?" -- improves rejected-alternative capture

## Minimum Viable Protocol

**10 questions** capture ~90% of graph quality:

| # | Question | Phase | What It Produces |
|---|---|---|---|
| 1 | What are the components? | A1 | Nodes |
| 2 | How do they interact? | A3 | Relations |
| 3 | What happens when interactions fail? | A3b (NEW) | Relation failure modes |
| 4 | Any implicit-effect components? | A4 | Infrastructure nodes |
| 5 | Common patterns across components? | B1 | Aspects |
| 6 | Exceptions to those patterns? | B3 | Aspect exceptions |
| 7 | Happy path user journey? | C1 | Flow happy path |
| 8 | What can go wrong? | C2 | Flow failure paths + decisions |
| 9 | Non-obvious constraints? | D3 | Constraints + some decisions |
| 10 | What would break without each constraint? | D3b (NEW) | Rejected alternatives |

Plus 1-2 targeted gap-filling questions (Phase E) for a total of 11-12.

## Assessment Against Success Criteria

| Criterion | Measured | Threshold | Result |
|---|---|---|---|
| Predicted blindfold vs reference | ~90% | INVEST >=80% | **INVEST** |
| Decision capture | 50% | INVEST >=60% | **ITERATE** |
| "Why NOT" capture | 67% | INVEST >=40% | **INVEST** |
| Min viable question set | 8-10 | INVEST <=15 | **INVEST** |

**Overall**: 3/4 metrics hit INVEST, 1 hits ITERATE. Decision capture is the weak link, driven by the inherent difficulty of extracting historical rationale from developers who didn't make the original decisions.

## Recommendation

**INVEST with targeted protocol improvements.** The extraction protocol produces a graph that answers 90% of diagnostic questions correctly from only 18 questions (10 minimum viable). The 50% decision gap is addressable by:
1. Adding constraint-counterfactual questions (D3b) that extract "why NOT" from observable constraints rather than requiring historical memory
2. Accepting that some decisions will have "rationale: unknown" -- this is still more valuable than no record at all
3. Using auto-construct (exp 5.1) to build initial structure, then guided extraction for WHY -- combining the strengths of both approaches
