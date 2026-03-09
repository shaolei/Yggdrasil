# Health Checks

## Identity

Provides active and passive health checking for reverse proxy upstreams. Not a standalone Caddy module, but configuration structs (`ActiveHealthChecks`, `PassiveHealthChecks`) embedded in the Handler's `HealthChecks` field.

## Responsibilities

- **Active health checks**: Run background HTTP probes against each static upstream on a configurable interval (default 30s). Mark upstreams healthy/unhealthy based on HTTP status codes, response body regex matching, and consecutive pass/fail thresholds.
- **Passive health checks**: Track failures during normal proxy operations. Count failures with a configurable expiry duration. Mark upstreams down when failure count exceeds threshold.
- **CircuitBreaker interface**: Define the experimental interface for early-warning circuit breakers.
- **Event emission**: Emit "healthy" and "unhealthy" events when upstream status changes.

## Not responsible for

- Selecting which upstream to route to (that is the selection policy's job).
- Managing the retry loop (that is the Handler's job).
- DNS-based health (dynamic upstream modules should only return healthy backends).
- Active health checks on dynamic upstreams (by design, active checks only run on static upstreams).
