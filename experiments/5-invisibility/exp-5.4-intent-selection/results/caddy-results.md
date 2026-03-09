# Caddy Results — Experiment 5.4

## Node Reference

| Short Name | Full Path |
|---|---|
| handler | reverse-proxy/handler |
| health | reverse-proxy/health-checks |
| policies | reverse-proxy/selection-policies |
| transport | reverse-proxy/transport |
| upstreams | reverse-proxy/upstreams |

## Algorithm Execution

### S1: Keyword Matching

| Task | Keywords | Selected (top by score) |
|---|---|---|
| T01 | selection, policy, consistent, hash, client, IP | policies (very high: "selection policy" in resp+iface), handler (low: "selection policy" ref) | policies |
| T02 | TLS, certificate, transport, backend, trusted | transport (very high), handler (low: "transport" ref) | transport |
| T03 | health, check, goroutines, stopped, cleanup | health (very high), handler (med: "health checker") | health, handler |
| T04 | upstreams, unhealthy, handler, 503, failed, fallback | handler (high: "503"), upstreams (high: "unhealthy"), policies (med: "Available") | handler, upstreams, policies |
| T05 | metric, upstream, selected, requests, failed, admin | handler (high: "requests"), upstreams (high: "upstream", "requests") | handler, upstreams |
| T06 | dynamically, adding, removing, upstreams, admin, config | upstreams (very high: "dynamic upstreams"), handler (med: "dynamic_upstreams") | upstreams, handler |
| T07 | backend, 503, unhealthy, passive, health, retry, different | handler (high: "retry"), health (high: "passive", "unhealthy"), upstreams (med: "unhealthy"), policies (med) | handler, health, upstreams, policies |
| T08 | circuit, breaker, consecutive, failures, health, check, probe | health (high: "circuit breaker" in aspect), upstreams (high: "cb.OK()"), handler (med: "circuit breaker" in config) | health, upstreams, handler |
| T09 | request, body, buffering, retried, POST, upstream | handler (very high: "body buffering", "retry"), transport (med: "round-trip") | handler, transport |
| T10 | improve, reliability, reverse, proxy, high, load | handler (med), upstreams (med), health (med), policies (low) | handler, upstreams, health |

### S2: Flow-Based

| Task | Flow Match? | Selected |
|---|---|---|
| T01 | "selection policy" matches request-proxying → participants | handler, policies, upstreams, transport, health |
| T02 | "transport" matches request-proxying → participants | handler, policies, upstreams, transport, health |
| T03 | "health check" matches health-monitoring → participants | health, handler, upstreams |
| T04 | "upstreams unhealthy" matches both flows → union | handler, policies, upstreams, transport, health |
| T05 | "upstream" matches request-proxying → participants | handler, policies, upstreams, transport, health |
| T06 | "upstreams" matches request-proxying → participants | handler, policies, upstreams, transport, health |
| T07 | "health" + "retry" matches both flows → union | handler, policies, upstreams, transport, health |
| T08 | "health check" matches health-monitoring → participants | health, handler, upstreams |
| T09 | "retried" + "body" matches request-proxying → participants | handler, policies, upstreams, transport, health |
| T10 | "reverse proxy" matches request-proxying → participants | handler, policies, upstreams, transport, health |

### S3: Relation Traversal

| Task | Seeds (S1 top-2) | Traversal | Selected (K≤5) |
|---|---|---|---|
| T01 | policies, handler | policies→{upstreams}; handler→{policies, transport, health, upstreams} | policies, handler, upstreams, transport, health |
| T02 | transport, handler | transport→{upstreams}; handler→{policies, transport, health, upstreams} | transport, handler, upstreams, policies, health |
| T03 | health, handler | health→{upstreams, transport}; handler→{policies, transport, health, upstreams} | health, handler, upstreams, transport, policies |
| T04 | handler, upstreams | handler→{policies, transport, health, upstreams}; upstreams→{health} | handler, upstreams, policies, transport, health |
| T05 | handler, upstreams | same as T04 | handler, upstreams, policies, transport, health |
| T06 | upstreams, handler | same as T04 | upstreams, handler, policies, transport, health |
| T07 | handler, health | handler→{policies, transport, health, upstreams}; health→{upstreams, transport} | handler, health, policies, transport, upstreams |
| T08 | health, upstreams | health→{upstreams, transport}; upstreams→{health} | health, upstreams, transport, handler |
| T09 | handler, transport | handler→{policies, transport, health, upstreams}; transport→{upstreams} | handler, transport, policies, health, upstreams |
| T10 | handler, upstreams | same as T04 | handler, upstreams, policies, transport, health |

**Note:** Like DRF, Caddy's graph is highly connected through handler. S3 typically selects all 5 nodes.

---

## Metrics

### Per-Task Precision / Recall / F1

| Task | Expert | S1 Sel | S1 P | S1 R | S1 F1 | S2 Sel | S2 P | S2 R | S2 F1 | S3 Sel | S3 P | S3 R | S3 F1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T01 | pol | pol | 1.00 | 1.00 | 1.00 | 5 | 0.20 | 1.00 | 0.33 | 5 | 0.20 | 1.00 | 0.33 |
| T02 | trn | trn | 1.00 | 1.00 | 1.00 | 5 | 0.20 | 1.00 | 0.33 | 5 | 0.20 | 1.00 | 0.33 |
| T03 | hlt | hlt, hnd | 0.50 | 1.00 | 0.67 | 3 | 0.33 | 1.00 | 0.50 | 5 | 0.20 | 1.00 | 0.33 |
| T04 | hnd, ups, pol | hnd, ups, pol | 1.00 | 1.00 | 1.00 | 5 | 0.60 | 1.00 | 0.75 | 5 | 0.60 | 1.00 | 0.75 |
| T05 | hnd, ups | hnd, ups | 1.00 | 1.00 | 1.00 | 5 | 0.40 | 1.00 | 0.57 | 5 | 0.40 | 1.00 | 0.57 |
| T06 | ups, hnd | ups, hnd | 1.00 | 1.00 | 1.00 | 5 | 0.40 | 1.00 | 0.57 | 5 | 0.40 | 1.00 | 0.57 |
| T07 | hnd, hlt, ups, pol | hnd, hlt, ups, pol | 1.00 | 1.00 | 1.00 | 5 | 0.80 | 1.00 | 0.89 | 5 | 0.80 | 1.00 | 0.89 |
| T08 | hnd, hlt, ups | hlt, ups, hnd | 1.00 | 1.00 | 1.00 | 3 | 1.00 | 1.00 | 1.00 | 4 | 0.75 | 1.00 | 0.86 |
| T09 | hnd, trn | hnd, trn | 1.00 | 1.00 | 1.00 | 5 | 0.40 | 1.00 | 0.57 | 5 | 0.40 | 1.00 | 0.57 |
| T10 | hnd, ups, hlt, pol | hnd, ups, hlt | 0.67 | 0.75 | 0.71 | 5 | 0.80 | 1.00 | 0.89 | 5 | 0.80 | 1.00 | 0.89 |

**Legend:** hnd=handler, hlt=health-checks, pol=selection-policies, trn=transport, ups=upstreams

### Aggregate Metrics

| Algorithm | Mean Precision | Mean Recall | Mean F1 |
|---|---|---|---|
| **S1** | **0.92** | **0.98** | **0.94** |
| **S2** | **0.51** | **1.00** | **0.64** |
| **S3** | **0.48** | **1.00** | **0.60** |

### By Task Type

| Type | S1 P / R / F1 | S2 P / R / F1 | S3 P / R / F1 |
|---|---|---|---|
| Single-module (T01-T03) | 0.83 / 1.00 / 0.89 | 0.24 / 1.00 / 0.39 | 0.20 / 1.00 / 0.33 |
| Cross-module (T04-T06) | 1.00 / 1.00 / 1.00 | 0.47 / 1.00 / 0.63 | 0.47 / 1.00 / 0.63 |
| Flow-spanning (T07-T08) | 1.00 / 1.00 / 1.00 | 0.90 / 1.00 / 0.95 | 0.78 / 1.00 / 0.88 |
| Constraint-aware (T09) | 1.00 / 1.00 / 1.00 | 0.40 / 1.00 / 0.57 | 0.40 / 1.00 / 0.57 |
| Ambiguous (T10) | 0.67 / 0.75 / 0.71 | 0.80 / 1.00 / 0.89 | 0.80 / 1.00 / 0.89 |

### Observations

- **S1 dominates** with 0.92 precision and 0.98 recall.
- **S2 shows value for flow-spanning tasks** (T08: perfect precision when health-monitoring flow matches exactly).
- **S3 over-selects** due to handler being a hub node connected to everything.
- **S1's only weakness** is the ambiguous task (T10) where it missed selection-policies.
- Caddy's two distinct flows give S2 some discriminating power (T03, T08 match health-monitoring only).
