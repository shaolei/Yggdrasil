# Health Checks Interface

## HealthChecks

```go
type HealthChecks struct {
    Active  *ActiveHealthChecks  `json:"active,omitempty"`
    Passive *PassiveHealthChecks `json:"passive,omitempty"`
}
```

Container for both active and passive health check configuration.

## ActiveHealthChecks

```go
type ActiveHealthChecks struct {
    Path             string         // Deprecated: use URI
    URI              string         // Path and query for health check requests
    Upstream         string         // Alternative host:port for health checks
    Port             int            // Alternative port (ignored if Upstream set)
    Headers          http.Header    // Headers to set on health check requests
    Method           string         // HTTP method (default: GET)
    Body             string         // Request body
    FollowRedirects  bool           // Follow HTTP redirects (default: false)
    Interval         caddy.Duration // Check interval (default: 30s)
    Timeout          caddy.Duration // Response timeout (default: 5s)
    Passes           int            // Consecutive passes to mark healthy (default: 1)
    Fails            int            // Consecutive failures to mark unhealthy (default: 1)
    MaxSize          int64          // Max response body to read
    ExpectStatus     int            // Expected HTTP status code
    ExpectBody       string         // Regex for expected response body
}
```

**Key methods:**
- `Provision(ctx caddy.Context, h *Handler) error` — sets defaults, creates HTTP client using handler's transport, compiles body regex
- `IsEnabled() bool` — true if Path, URI, or Port is configured

## PassiveHealthChecks

```go
type PassiveHealthChecks struct {
    FailDuration          caddy.Duration // Window for counting failures (0 = disabled)
    MaxFails              int            // Failures before marking unhealthy (default: 1)
    UnhealthyRequestCount int           // Concurrent request limit (sets MaxRequests on upstreams)
    UnhealthyStatus       []int          // Status codes that count as failures
    UnhealthyLatency      caddy.Duration // Latency threshold for failure
}
```

## CircuitBreaker

```go
type CircuitBreaker interface {
    OK() bool
    RecordMetric(statusCode int, latency time.Duration)
}
```

Experimental interface for external circuit breaker modules. Checked by `Upstream.Healthy()`.

## Handler Methods for Health

```go
func (h *Handler) activeHealthChecker()           // background goroutine, runs on ticker
func (h *Handler) doActiveHealthCheckForAllHosts() // spawns goroutine per upstream
func (h *Handler) doActiveHealthCheck(...)  error  // single upstream check
func (h *Handler) countFailure(upstream *Upstream) // passive failure counting with expiry
```

## Failure Modes

- Active health check panics are recovered and logged (do not crash the server)
- DNS resolution failures in health check addresses are logged and the check is skipped for that upstream
- Invalid dial addresses (port ranges, placeholder errors) cause the check to be skipped
