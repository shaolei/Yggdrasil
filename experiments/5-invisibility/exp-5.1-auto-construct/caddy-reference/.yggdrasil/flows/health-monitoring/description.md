# Health Monitoring

## Business context

Backend servers may become unavailable or degraded. The system continuously monitors backend health to avoid sending requests to backends that cannot serve them, and to restore backends that have recovered.

## Trigger

- Active: Timer fires at configured interval (default 30s)
- Passive: Each proxied request completes (success or failure)

## Goal

Maintain accurate knowledge of which backends are healthy and available, so the load balancer can route traffic only to backends that can serve requests.

## Participants

- **Health Checks** (reverse-proxy/health-checks): Defines active and passive health check configuration and runs the active checker goroutine
- **Handler** (reverse-proxy/handler): Invokes passive health checks after each round-trip; starts active health checker on provision
- **Upstreams** (reverse-proxy/upstreams): Host state (fails, numRequests, activePasses, activeFails) is stored atomically on the Host struct

## Paths

### Active health check path

1. Background goroutine ticks at configured interval
2. For each static upstream, a goroutine performs an HTTP request to the health check endpoint
3. Response is evaluated: status code checked (default: 2xx), optional body regex matched
4. On failure: increment `activeFails` counter. If `activeFails >= Fails` threshold, mark upstream unhealthy, emit "unhealthy" event, reset counters
5. On success: increment `activePasses` counter. If `activePasses >= Passes` threshold, mark upstream healthy, emit "healthy" event, reset counters

### Passive health check path

1. After each proxy round-trip, evaluate response
2. If status code matches any `unhealthy_status` codes, count a failure
3. If response latency exceeds `unhealthy_latency`, count a failure
4. Failure counting: increment `Host.fails`, schedule a goroutine to decrement after `fail_duration`
5. On subsequent requests, `Healthy()` checks `Host.Fails() < MaxFails`

### Capacity-based path

1. `UnhealthyRequestCount` sets `MaxRequests` on upstreams without explicit limits
2. On each request, `Full()` checks `NumRequests() >= MaxRequests`
3. Full upstreams are excluded by `Available()` in selection policies

## Invariants across all paths

- Active health checks only run for static upstreams (not dynamic)
- Passive health check state is global (shared across handlers) via the Host struct
- Active health check state is per-handler (each handler has its own healthy/unhealthy determination)
- Health state for static upstreams persists across config reloads via the global UsagePool
- Health state for dynamic upstreams persists via the dynamicHosts map with idle eviction
- All Host field mutations use atomic operations for thread safety
