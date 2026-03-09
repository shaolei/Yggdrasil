# Semantic Comparison: Caddy Reverse Proxy

## Scoring Scale

- 1 = Minimal: mentions the component but lacks meaningful detail
- 2 = Partial: covers main concepts but misses important details or decisions
- 3 = Equivalent: comparable depth, captures same key information

## Node-by-Node Comparison

### handler

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Both cover request proxying orchestration, retry logic, header manipulation, buffering. Auto adds detail about response copying modes. |
| interface.md | 2 | Both cover ServeHTTP and key config fields. Reference covers `cloneRequest`/`prepareRequest`/`finalizeResponse` internal pipeline in more detail. Auto covers more config fields but misses some method signatures. |
| internals.md | 3 | Both cover retry loop, request cloning, header manipulation, buffering. Auto covers streaming detail (split into own node). Reference covers hop-by-hop stripping detail (captured as aspect). Roughly equivalent depth. |

**Mean: 2.67**

### health-checks

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Both cover active and passive health checking. Nearly identical scope. |
| interface.md | 2 | Reference has more structured method signatures. Auto covers config fields well but less formal API documentation. |
| internals.md | 2 | Both cover active checker goroutine, passive fail counting, circuit breaker. Reference captures more decisions (e.g., "chose per-request fail counting over sliding window"). Auto captures the event-driven circuit breaker logic well. |

**Mean: 2.33**

### selection-policies

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Both cover the role: choosing an upstream from a pool. |
| interface.md | 3 | Both enumerate all policy types (random, round_robin, least_conn, etc.) with their Select behavior. Auto adds cookie_hash and IP_hash detail. |
| internals.md | 2 | Reference captures more decisions and algorithmic details (e.g., power-of-2 choices, weighted random with int conversion). Auto covers algorithms but fewer decisions. |

**Mean: 2.67**

### transport

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Both describe building/configuring http.Transport with TLS, PROXY protocol, HTTP versions. |
| interface.md | 2 | Reference has structured method signatures. Auto has config-focused documentation. Both cover same scope. |
| internals.md | 2 | Reference captures critical decisions (3s dial timeout rationale, 32 max idle conns, exclusive HTTP/3 rationale, PROXY protocol before TLS). Auto covers transport construction but fewer decisions. |

**Mean: 2.33**

### upstreams

| Artifact | Score | Notes |
|---|---|---|
| responsibility.md | 3 | Both cover static + dynamic upstreams, DNS resolution, host state management. |
| interface.md | 2 | Reference has full type definitions (Upstream, Host, UpstreamPool) with method signatures. Auto covers SRV/A/Multi but less structured on core types. Auto lacks internals.md entirely. |
| internals.md | 1 | Reference has detailed internals (DNS caching, host state management, dynamic hosts eviction, allNew() rationale). Auto has NO internals.md for upstreams. DNS caching captured as aspect instead. |

**Mean: 2.00**

## Aspect Comparison

### caddy-module-pattern (matched)

| Dimension | Score | Notes |
|---|---|---|
| Content | 3 | Both cover same 6 lifecycle steps. Auto adds JSON config and Caddyfile points (items 7-8). |
| Rationale | 2 | Both explain plugin architecture motivation. Reference has explicit "Why" section. |

**Mean: 2.5**

### hop-by-hop-header-stripping (reference only)

Not present in auto graph. Score: 0.

### upstream-availability vs retry-with-health-tracking (partial match)

| Dimension | Score | Notes |
|---|---|---|
| Content | 1 | Different focus: reference describes Available() as unified gate (Healthy + Full); auto describes retry loop with health tracking. Overlap exists but core concern differs. |
| Rationale | 1 | Reference explains why Available() is single source of truth. Auto explains retry mechanics. |

**Mean: 1.0**

## Aggregate Semantic Scores

### Node artifacts (5 matched pairs)

| Node | responsibility | interface | internals | Mean |
|---|---|---|---|---|
| handler | 3 | 2 | 3 | 2.67 |
| health-checks | 3 | 2 | 2 | 2.33 |
| selection-policies | 3 | 3 | 2 | 2.67 |
| transport | 3 | 2 | 2 | 2.33 |
| upstreams | 3 | 2 | 1 | 2.00 |
| **Mean** | **3.0** | **2.2** | **2.0** | **2.40** |

### Aspect content (3 reference aspects)

| Aspect | Score |
|---|---|
| caddy-module-pattern | 2.5 |
| hop-by-hop-header-stripping | 0 |
| upstream-availability | 1.0 |
| **Mean** | **1.17** |

### Overall Semantic Coverage

Node semantic coverage: 2.40 / 3.0 = **80.0%**

Aspect semantic coverage: 1.17 / 3.0 = **38.9%**

**Combined semantic coverage** = mean(80.0%, 38.9%) = **59.4%**

## Decision Capture Analysis

### Reference decisions (explicit "Chose X over Y" entries)

Reference captures ~15 explicit decisions across internals.md files:
- handler: 5 decisions (retry semantics, buffering defaults, header ordering, etc.)
- health-checks: 3 decisions (per-request fail counting, circuit breaker threshold)
- selection-policies: 2 decisions (power-of-2, weighted random int conversion)
- transport: 5 decisions (3s dial timeout, 32 idle conns, exclusive HTTP/3, custom DialTLS, ProxyFromEnvironment)
- upstreams: 4 decisions (double-checked locking, random eviction, separate dynamicHosts, allNew())

### Auto decisions captured

Auto captures ~8 decisions across internals.md files:
- handler: 3 decisions (retry loop structure, shallow clone, X-Forwarded headers)
- health-checks: 2 decisions (event-driven circuit breaker, per-request counting)
- selection-policies: 2 decisions (power-of-2 choices, cookie hashing)
- transport: 1 decision (custom DialTLS for PROXY protocol)
- upstreams: 0 decisions (no internals.md)

**Decision capture rate**: ~8/15 = **53%**

### "Why NOT" capture rate

Reference has explicit "why not" / rejected alternatives in ~10 decisions.
Auto has explicit rejected alternatives in ~3 decisions.

**"Why NOT" capture rate**: ~3/10 = **30%**

### Fabrication rate

Reviewing all auto-graph claims against reference:
- No factually incorrect claims found in artifact content
- Relation directionality is systematically reversed (structural error, not fabrication)
- `dns-cache-with-locking` aspect content is accurate (verified in reference internals)
- `retry-with-health-tracking` aspect content is accurate
- Node type assignments differ but are defensible interpretations

**Fabrication rate**: **0%**
