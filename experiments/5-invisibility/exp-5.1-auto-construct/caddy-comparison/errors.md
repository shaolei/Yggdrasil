# Error Analysis: Caddy Reverse Proxy

## Error Classification

### Missing (reference element absent from auto)

| Element | Type | Impact |
|---|---|---|
| `hop-by-hop-header-stripping` aspect | Aspect | High — RFC-mandated behavior invisible in auto graph |
| `upstream-availability` aspect | Aspect | High — core architectural invariant (Available = Healthy + !Full) not captured as cross-cutting concern |
| `health-monitoring` flow | Flow | Medium — active health checking lifecycle not modeled as business process |
| upstreams/internals.md | Artifact | Medium — DNS caching logic, host state management, dynamic hosts eviction not documented at node level (partially captured in aspect) |
| 8 relations (see structural.md) | Relations | High — dependency structure between leaf nodes is largely missing or reversed |
| reverse-proxy parent yg-node.yaml | Node config | Low — auto has no explicit parent node definition |

### Over-Split (auto created more granular nodes than reference)

| Element | Notes |
|---|---|
| `streaming` node | Reference includes streaming.go in handler's mapping. Auto split it into a separate node. The code is methods on Handler struct, so the reference approach (keeping it in handler) is more accurate. However, the auto approach is defensible given the file-per-node heuristic. |

### Misattributed (correct information in wrong location)

| Element | Notes |
|---|---|
| DNS caching details | Reference captures in upstreams/internals.md. Auto elevated to a cross-cutting aspect (`dns-cache-with-locking`). Both are valid placements — the pattern does appear in 2 types (SRV, A). Auto's choice is arguably better per Yggdrasil's aspect rules (pattern in 2+ nodes = aspect candidate). |
| Relation directionality | Auto systematically reversed dependency arrows. Reference has `handler -> upstreams`, `health-checks -> upstreams`, `selection-policies -> upstreams`. Auto has `healthchecks -> handler`, `http-transport -> handler`, `selection-policies -> handler`, `upstreams -> handler`. The reference is correct: handler depends on the others, and the others depend on upstreams for Host/Upstream types. Auto appears to have interpreted "uses" as "is used by". |

### Phantom Rationale

No fabricated rationale detected. All decisions recorded in the auto graph are either:
- Verifiable from code/comments
- Marked with appropriate hedging

### Fabricated

No fabricated elements detected. All auto-graph content describes real code behavior.

## Systematic Patterns

### Pattern 1: Relation Direction Reversal

The most significant systematic error. Auto reversed ~67% of relations, making leaf nodes depend on handler instead of handler depending on leaf nodes. This suggests the builder agent interpreted the `uses` relation as "is called by" rather than "calls/depends on".

**Impact**: An agent using `yg impact` on the auto graph would get incorrect blast radius analysis. Changing `upstreams` would not show `handler` as affected, when in reality handler is the primary consumer.

### Pattern 2: Aspect Identification Gaps

Auto identified 2 valid aspects not in reference (`dns-cache-with-locking`, `retry-with-health-tracking`) but missed 2 reference aspects (`hop-by-hop-header-stripping`, `upstream-availability`). The missed aspects represent:
- A protocol-level requirement (RFC compliance) — invisible in commit messages
- An architectural invariant (availability gate) — embedded in code structure

This suggests git history surfaces *implementation patterns* (caching, retry) better than *architectural invariants* (header stripping rules, availability contracts).

### Pattern 3: Decision Capture Decay

Auto captured 53% of reference decisions and only 30% of rejected alternatives. The missing decisions tend to be:
- Performance-motivated choices (dial timeouts, connection pool sizes)
- Architectural constraints (exclusive HTTP/3, PROXY protocol ordering)

Git history provides commit messages explaining WHAT changed but rarely WHY alternatives were rejected.

## Error Summary

| Category | Count | Severity |
|---|---|---|
| Missing aspects | 2 | High |
| Missing flow | 1 | Medium |
| Missing artifact | 1 | Medium |
| Relation errors (reversed) | 8 | High |
| Over-split | 1 | Low |
| Misattributed | 1 | Low |
| Fabricated | 0 | — |
| Phantom rationale | 0 | — |
