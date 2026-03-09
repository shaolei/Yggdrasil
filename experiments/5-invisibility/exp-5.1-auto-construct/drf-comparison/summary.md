# DRF Comparison Summary

## Key Metrics

| Metric | Value | Threshold | Verdict |
|---|---|---|---|
| Structural coverage | **100%** | INVEST >= 80% | INVEST |
| Semantic coverage | **95.7%** | INVEST >= 60% | INVEST |
| Error rate (fabrication + phantom rationale) | **0%** | INVEST < 5% | INVEST |
| Decision capture rate | **52%** | -- | Moderate |
| "Why NOT" capture rate | **67%** | INVEST >= 40% | INVEST |
| Fabrication rate | **0%** | INVEST < 5% | INVEST |

## Verdict: INVEST

All metrics exceed INVEST thresholds. The auto-constructed graph is structurally complete and semantically rich.

## Strengths of Auto-Constructed Graph

1. **Perfect structural coverage** -- every reference node, relation, aspect, and flow has an auto counterpart
2. **Zero fabrication** -- all claims sourced from code or git history; "rationale: unknown" used appropriately
3. **Bonus content** -- auto graph captures 6 elements not in reference, all verifiable (commit-sourced decisions, additional aspects)
4. **Git history integration** -- commit hashes and PR numbers provide traceability that reference graph lacks
5. **High semantic fidelity** -- 17/18 artifact comparisons scored 3/3 (equivalent)

## Weaknesses of Auto-Constructed Graph

1. **Decision capture at 52%** -- 9 of 21 reference decisions missing, mostly subtle design rationale not in commit messages
2. **Lazy evaluation aspect under-scoped** -- named "lazy-authentication" and misses data/parsing laziness (reference calls it "lazy-evaluation" and covers both)
3. **Node types differ** -- auto uses `module` for all leaf nodes; reference uses `infrastructure` for authentication, permissions, throttling and `service` for api-view and request. This is a categorization difference, not a structural one.
4. **Parent node has no file mappings** -- reference maps all 5 files on parent; auto has empty paths

## Observations

- The auto graph's main advantage over reference is **commit provenance**: decisions cite specific commits, making them traceable
- The auto graph's main gap is **implicit design rationale**: decisions observable only from code structure (not commits or comments) are missed
- The 2 "misattributed" elements (CSRF and sliding window elevated to aspects) are arguably improvements -- they capture cross-cutting patterns the reference placed only in internals
- Node type classification (`module` vs `infrastructure`/`service`) is a judgment call with no impact on context assembly quality
