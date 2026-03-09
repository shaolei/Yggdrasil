# Upstream Availability

## What

All selection policies must call `upstream.Available()` before selecting an upstream. `Available()` is defined as `Healthy() && !Full()` where:

- **Healthy()**: Combines three signals:
  1. Active health check status (`atomic.LoadInt32(&u.unhealthy) == 0`)
  2. Passive health check: `Host.Fails() < healthCheckPolicy.MaxFails`
  3. Circuit breaker: `cb.OK()` (if configured)
- **Full()**: `MaxRequests > 0 && Host.NumRequests() >= MaxRequests`

Host state is stored atomically in the `Host` struct (numRequests, fails, activePasses, activeFails). Static upstream hosts are stored in a global `UsagePool` that persists across config reloads. Dynamic upstream hosts are tracked in a separate map with last-seen timestamps and idle eviction.

## Why

Centralizing availability in `Available()` ensures consistent behavior across all 12 selection policies. No policy can accidentally skip health checks or capacity limits. The atomic operations on Host fields enable lock-free request counting on the hot path.
