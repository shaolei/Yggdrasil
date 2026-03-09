# Health Checks

Defines and executes active and passive health checking strategies to determine whether backend servers are available to receive traffic.

## Responsible for

- Active health checks: periodically sending HTTP requests to backends and evaluating responses (status code, body regex)
- Passive health checks: tracking failures during normal proxying (bad status codes, high latency) with time-windowed failure counting
- Configuring thresholds: consecutive passes/fails for active checks, max failures and fail duration for passive checks
- Emitting health events ("healthy", "unhealthy") via Caddy's event system
- Providing the CircuitBreaker interface for external circuit breaker modules

## Not responsible for

- Deciding how health status affects upstream selection (delegated to Upstream.Available())
- Maintaining the Host state struct (defined in upstreams/hosts.go)
- Performing the actual HTTP transport for health checks (uses the Handler's configured transport)
