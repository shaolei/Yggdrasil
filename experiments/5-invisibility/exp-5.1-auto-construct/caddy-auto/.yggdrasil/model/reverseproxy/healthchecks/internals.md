# Health Checks Internals

## Logic

### Active Health Check Loop

`activeHealthChecker()` runs in a background goroutine started by Handler.Provision(). It:
1. Immediately performs one check for all hosts.
2. Then loops on a ticker at the configured interval.
3. Stops when `h.ctx.Done()` fires (config unload).
4. Has panic recovery to avoid crashing the server.

Each check (`doActiveHealthCheckForAllHosts`) launches a goroutine per upstream (each also with panic recovery). The goroutine:
1. Resolves the dial address (with placeholder support).
2. Determines the health check target (alternative upstream > health port > upstream address).
3. Calls `doActiveHealthCheck()` which builds and executes the HTTP request.

### Active Health Check Decision

The `doActiveHealthCheck` method:
1. Builds a URL with appropriate scheme (HTTP/HTTPS based on transport TLS config).
2. Creates an HTTP request with configured method, headers, body.
3. Evaluates the response: status code match, then body regex match.
4. Calls `markHealthy()` or `markUnhealthy()` closures.
5. These closures increment pass/fail counters and check thresholds.
6. On threshold crossing, `setHealthy()` is called and health events are emitted.

### Passive Health Check (countFailure)

`countFailure()` on the Handler:
1. Returns immediately if passive health checks are not configured or fail_duration is 0.
2. Counts one failure immediately via `upstream.Host.countFail(1)`.
3. Spawns a goroutine that sleeps for `fail_duration`, then decrements the failure count (with panic recovery).

## Decisions

- **Per-handler active health state, global passive health state**: Active health check status is stored per-proxy-handler (allowing different handlers to use different criteria). Passive health check state is shared globally (a failure from one handler is counted by all). Source: code comments in HealthChecks struct. Rationale: unknown -- inferred from code.
- **health_port fix for dial info**: When `health_port` is configured, the dial info upstream must also use the health port address, not just the URL. This was a bug where `health_port` was ignored in the dial info. Source: commit 11b56c6 / PR #7533.
