# Caddy Tasks — Experiment 5.4

## Graph Summary

**Nodes (5 leaf + 1 parent):**
- `reverse-proxy` (parent module)
- `reverse-proxy/handler` (module) — orchestrates proxy flow, retry loop
- `reverse-proxy/health-checks` (module) — active/passive health monitoring
- `reverse-proxy/selection-policies` (module) — load balancing algorithms
- `reverse-proxy/transport` (module) — HTTP round-trip to backends
- `reverse-proxy/upstreams` (module) — backend pool, Host state

**Aspects:** caddy-module-pattern, hop-by-hop-header-stripping, upstream-availability
**Flows:** request-proxying (all 5 nodes), health-monitoring (handler, health-checks, upstreams)

---

## Tasks

### T01 — Single-module
**Description:** "Add a new selection policy that routes requests based on a consistent hash of the client IP."
**Complexity:** single-module
**Expert-selected nodes:** `selection-policies`
**Relevant aspects:** caddy-module-pattern, upstream-availability
**Rationale:** New policy module; must follow CaddyModule pattern and check Available().

### T02 — Single-module
**Description:** "Add TLS client certificate pinning to the HTTP transport so only backends presenting a specific certificate are trusted."
**Complexity:** single-module
**Expert-selected nodes:** `transport`
**Relevant aspects:** caddy-module-pattern
**Rationale:** Only touches transport configuration.

### T03 — Single-module
**Description:** "Fix a bug where active health check goroutines are not stopped when the handler is cleaned up."
**Complexity:** single-module
**Expert-selected nodes:** `health-checks`
**Relevant aspects:** caddy-module-pattern
**Rationale:** Lifecycle issue within health checks; Cleanup pattern.

### T04 — Cross-module
**Description:** "When all upstreams are unhealthy, the handler should try the least-recently-failed upstream instead of returning 503."
**Complexity:** cross-module
**Expert-selected nodes:** `handler`, `upstreams`, `selection-policies`
**Relevant aspects:** upstream-availability
**Rationale:** Handler gets nil from selection policy; needs fallback that queries upstream health state.

### T05 — Cross-module
**Description:** "Add a metric that tracks how many times each upstream was selected and how many requests failed, exposed via Caddy's admin API."
**Complexity:** cross-module
**Expert-selected nodes:** `handler`, `upstreams`
**Relevant aspects:** upstream-availability
**Rationale:** Handler counts requests; upstreams store Host state with atomic counters.

### T06 — Cross-module
**Description:** "Add support for dynamically adding and removing upstreams via an admin API endpoint without reloading config."
**Complexity:** cross-module
**Expert-selected nodes:** `upstreams`, `handler`
**Relevant aspects:** caddy-module-pattern
**Rationale:** Upstreams manage the pool; handler provisions them.

### T07 — Flow-spanning
**Description:** "When a backend returns a 503, mark it as unhealthy for passive health checks and retry on a different backend."
**Complexity:** flow-spanning
**Expert-selected nodes:** `handler`, `health-checks`, `upstreams`, `selection-policies`
**Relevant aspects:** upstream-availability
**Relevant flows:** request-proxying, health-monitoring
**Rationale:** Spans both flows: proxying (retry) and health monitoring (passive failure counting).

### T08 — Flow-spanning
**Description:** "Add circuit breaker support that opens after N consecutive failures and closes after a successful health check probe."
**Complexity:** flow-spanning
**Expert-selected nodes:** `handler`, `health-checks`, `upstreams`
**Relevant aspects:** upstream-availability
**Relevant flows:** health-monitoring
**Rationale:** Circuit breaker state lives on Host (upstreams), triggered by handler failures, reset by health checks.

### T09 — Constraint-aware
**Description:** "Add request body buffering so that retried POST requests send the same body to the next upstream."
**Complexity:** constraint-aware
**Expert-selected nodes:** `handler`, `transport`
**Relevant aspects:** hop-by-hop-header-stripping
**Rationale:** Must understand retry semantics (body consumed on first attempt) and that buffering only makes sense when retries are configured.

### T10 — Ambiguous
**Description:** "Improve reliability of the reverse proxy under high load."
**Complexity:** ambiguous
**Expert-selected nodes:** `handler`, `upstreams`, `health-checks`, `selection-policies`
**Relevant aspects:** upstream-availability
**Rationale:** Ambiguous — could mean better load balancing, faster health detection, or capacity limits. Expert selects broadly.
