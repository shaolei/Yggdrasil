# Comparison Summary: Caddy Reverse Proxy

## Scores

| Metric | Score | Threshold |
|---|---|---|
| Structural coverage | 59.4% | H1 requires >= 80% |
| Semantic coverage | 59.4% | H1 requires >= 60% |
| Fabrication rate | 0% | H1 requires < 5% |
| Decision capture rate | 53% | — |
| "Why NOT" capture rate | 30% | — |

## Hypothesis Assessment

- **Structural coverage (59.4%)**: BELOW the 80% threshold. Node identification is excellent (100%) but relation accuracy is poor (37.5%), dragging the score down. Aspect and flow coverage at 50% each.
- **Semantic coverage (59.4%)**: BORDERLINE at the 60% threshold. Node artifact depth is strong (80%) but aspect semantic coverage is weak (38.9%).
- **Fabrication rate (0%)**: PASSES the <5% threshold. No fabricated information detected.

**H1 is NOT supported** for this repo. Structural coverage fails. Semantic coverage is borderline.

## Key Findings

### Strengths of Auto-Construction

1. **Node identification is perfect** (100%). The builder correctly identified all logical components at appropriate granularity.
2. **Zero fabrication**. Every claim in the auto graph is factually accurate.
3. **Responsibility artifacts are excellent** (3.0/3.0 average). The builder understands WHAT each component does.
4. **Novel valid aspects**. `dns-cache-with-locking` is arguably better placed as an aspect than in internals.md (it crosses 2 types).

### Weaknesses of Auto-Construction

1. **Relation directionality is systematically wrong**. The builder reversed most dependency arrows, making the graph misleading for impact analysis.
2. **Architectural invariants are missed**. `upstream-availability` (the Available() gate) and `hop-by-hop-header-stripping` (RFC compliance) were not identified as cross-cutting concerns. These are invisible in git history.
3. **Decision capture is incomplete** (53%) and rejected-alternatives capture is poor (30%). Git history tells you WHAT changed, not WHY alternatives were rejected.
4. **Flow coverage is incomplete**. Health monitoring as a distinct business process was not identified.

### Implications for `yg auto-init`

1. **Node structure**: Auto-init can reliably identify components. This is the easy part.
2. **Relations**: Auto-init MUST NOT infer relation direction from git history alone. A post-construction validation step (or user confirmation) is needed.
3. **Aspects**: Auto-init finds implementation patterns but misses protocol/architectural invariants. A checklist or prompt asking about RFC compliance, invariants, and contracts would help.
4. **Decisions**: Auto-init cannot recover rejected alternatives from git history. This is inherently a human-knowledge gap that auto-init should flag for manual enrichment rather than attempt to fill.

## Comparison to Hypothesis Thresholds

| Dimension | Auto Score | H1 Threshold | Pass? |
|---|---|---|---|
| Structural coverage | 59.4% | >= 80% | No |
| Semantic coverage | 59.4% | >= 60% | Borderline |
| Fabrication rate | 0% | < 5% | Yes |

The primary failure mode is **relations**, not nodes or content. If relations were correct, structural coverage would be ~75% (still below 80% due to missing aspects/flows, but much closer). This suggests that relation inference is the critical problem to solve for auto-init viability.
