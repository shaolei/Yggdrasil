# Comparison Summary — Payload CMS

## Known Limitation

Payload CMS was cloned with only 2 commits available (shallow clone). This severely constrained the git history signal available to the auto-construction agent. Results should be interpreted with this limitation in mind.

## Metrics

| Metric | Score | Threshold | Verdict |
|---|---|---|---|
| Structural coverage | 55.75% | 60-79% = ITERATE, <60% = ABANDON | ABANDON (borderline) |
| Semantic coverage | 64.0% | >=60% = INVEST | INVEST |
| Fabrication + phantom rationale rate | ~2% | <5% = INVEST | INVEST |
| Decision capture rate | 85.7% | — | Strong |
| "Why NOT" capture rate | 22.2% | 20-39% = ITERATE | ITERATE |

## Structural Coverage Breakdown

| Element | Coverage |
|---|---|
| Nodes | 80% |
| Relations | 60% |
| Aspects | 50% |
| Flows | 33% |
| **Mean** | **55.75%** |

The weakest area is flows (33%) and aspects (50%). Node and relation coverage are acceptable.

## What the Auto Graph Got Right

1. **Core node identification**: The main operational modules (operations, strategies/infrastructure, permissions) were correctly identified and documented with high semantic depth.
2. **Content quality**: Where nodes exist, the artifact content is detailed and accurate. Semantic scores of 2-3 across most artifacts.
3. **Decision capture**: 85.7% of reference decisions were found in the auto graph, mostly from code analysis.
4. **Low fabrication**: Only 1 fabricated claim out of ~50 (2%). The "rationale: unknown" protocol was followed consistently.
5. **Login flow**: The user-authentication flow is comprehensive with multiple paths and invariants.

## What the Auto Graph Got Wrong

1. **Missing auth-endpoints node**: The entire HTTP translation layer was not recognized as a separate concern.
2. **Missing flows**: Password-reset and access-evaluation — two of three reference flows — were not captured.
3. **Missing security aspects**: timing-safe-comparison and transaction-safety were not elevated from implementation detail to cross-cutting requirement.
4. **Granularity mismatch**: Different decomposition of auth-infrastructure (over-split) and access-control (under-split/merged).
5. **Hook lifecycle inaccuracy**: The ordering described in the hook-lifecycle aspect is factually wrong.
6. **Low "Why NOT" rate**: Only 22% of rejected alternatives captured — primarily because git history was unavailable.

## Root Cause Analysis

| Problem | Root Cause | Would Full History Fix? |
|---|---|---|
| Missing auth-endpoints | No commit history showing endpoint/operation separation | Likely yes |
| Missing flows (2/3) | No multi-commit sequences revealing process structure | Likely yes |
| Missing security aspects | No commit messages explaining security rationale | Partially — code analysis could still identify the pattern |
| Low "Why NOT" rate | No PR discussions or commit messages with alternatives | Yes — this is the primary source |
| Hook lifecycle inaccuracy | Misread of code structure | No — this is an analysis error |
| Granularity mismatch | No co-change signals from git history | Likely yes |

**5 of 6 problems would likely be mitigated by full git history.** The hook lifecycle inaccuracy is an independent code analysis error.

## Verdict: ITERATE

Despite the structural coverage falling below 60% (ABANDON threshold), this result is heavily confounded by the shallow clone limitation. The semantic coverage (64%) and low fabrication rate (2%) both meet INVEST thresholds. The decision capture rate (85.7%) is notably strong.

**Recommendation**: Re-run Payload with full git history before drawing conclusions. The current results demonstrate that code-only analysis (minimal history) produces good semantic content but misses architectural decomposition and cross-cutting patterns that require historical signal.

For cross-repo comparison purposes, this data point establishes a **floor** for auto-construction quality: even with virtually no git history, the builder produces a graph with 64% semantic coverage and 2% fabrication rate.
