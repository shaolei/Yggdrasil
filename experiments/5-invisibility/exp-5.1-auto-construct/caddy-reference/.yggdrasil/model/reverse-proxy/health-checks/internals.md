# Health Checks Internals

## Logic

### Active Health Check Loop

`activeHealthChecker()` runs as a background goroutine started during Provision:
1. Performs immediate check on all hosts
2. Enters ticker loop at configured interval (default 30s)
3. Stops when handler context is cancelled (config reload or shutdown)
4. Panic recovery wraps the entire function

`doActiveHealthCheckForAllHosts()` spawns a separate goroutine for each upstream (parallel checking). Each goroutine also has panic recovery.

### Active Health Check Evaluation

`doActiveHealthCheck()` per-upstream:
1. Builds health check URL: scheme from transport (HTTP/HTTPS), host from upstream or override, path/query from URI config
2. Creates request with handler's context, replacer, and dial info
3. Sets custom headers (with placeholder replacement), including special Host header handling
4. Sends request using handler's transport via a dedicated `http.Client` with configured timeout
5. Evaluates response:
   - If `ExpectStatus` configured: check against it; otherwise require 2xx
   - If `ExpectBody` configured: read body (up to MaxSize) and match regex
6. On failure: call `markUnhealthy()` which increments `activeFails` and checks threshold
7. On success: call `markHealthy()` which increments `activePasses` and checks threshold
8. Threshold reached: call `setHealthy()` (atomic compare-and-swap), emit event, reset counters

The `setHealthy()` method returns true only if the status actually changed, preventing duplicate event emissions.

### Passive Health Check: Failure Counting with Expiry

`countFailure()` implements a time-windowed failure counter:
1. Immediately increment `Host.fails` via atomic add
2. Spawn a goroutine that sleeps for `FailDuration`
3. After sleep, decrement `Host.fails` by 1

This creates a sliding window: each failure adds 1 and schedules its own removal. At any point, `Host.Fails()` reflects the count of failures within the most recent `FailDuration` window. The goroutine has panic recovery and respects context cancellation.

### Health Check Scheme Override

Active health checks inherit the transport's TLS configuration. If the transport has TLS enabled and the port isn't in the `ExceptPorts` list, the health check URL scheme is changed to "https". This is done via the `HealthCheckSchemeOverriderTransport` interface.

### State: Active vs Passive

Active health check state is **per-handler**: each reverse proxy handler independently determines whether an upstream is healthy based on its own active checks. This is stored in `Upstream.unhealthy` (atomic int32).

Passive health check state is **global**: `Host.fails` is shared across all handlers because the Host is stored in the global UsagePool. A failure counted by one handler is visible to all handlers.

## Decisions

- Chose goroutine-per-upstream for active checks over sequential checking because health check timeouts should not delay checks of other upstreams. rationale: unknown — inferred from code.
- Chose goroutine-based sliding window for passive failure counting over a fixed time-bucket approach because the goroutine approach is simpler and gives exact timing: each failure expires at exactly `FailDuration` after it occurred, rather than at a bucket boundary. rationale: unknown — inferred from code.
- Chose per-handler active health state over global because different handlers may have different health check criteria (different paths, thresholds, timeouts). What is unhealthy for one handler's configuration may be healthy for another's. This is explicitly documented in the `HealthChecks` struct comment.
- Chose global passive health state over per-handler because passive failures reflect actual request failures, which are objective facts about the backend regardless of handler configuration. This is explicitly documented in the `HealthChecks` struct comment.
