# Health Checks Interface

## ActiveHealthChecks

### Configuration (JSON)

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | string | - | Deprecated: use `uri` instead |
| `uri` | string | - | URI (path+query) for health check requests |
| `upstream` | string | - | Alternative host:port for health check target |
| `port` | int | 0 | Alternative port (ignored if upstream is set) |
| `headers` | map | - | HTTP headers to send |
| `method` | string | GET | HTTP method |
| `body` | string | - | Request body |
| `follow_redirects` | bool | false | Follow HTTP redirects |
| `interval` | duration | 30s | Check frequency |
| `timeout` | duration | 5s | Response timeout |
| `passes` | int | 1 | Consecutive passes before marking healthy |
| `fails` | int | 1 | Consecutive failures before marking unhealthy |
| `max_size` | int64 | 0 | Max response body to read |
| `expect_status` | int | 0 | Expected HTTP status code (0 = 2xx) |
| `expect_body` | string | - | Regex to match against response body |

### `Provision(ctx caddy.Context, h *Handler) error`

Sets up the active health checker: parses URI, creates HTTP client with the handler's transport, configures health check ports for each upstream.

### `IsEnabled() bool`

Returns true if path, URI, or port is configured.

## PassiveHealthChecks

### Configuration (JSON)

| Field | Type | Default | Description |
|---|---|---|---|
| `fail_duration` | duration | 0 | Window for counting failures (0 = disabled) |
| `max_fails` | int | 1 | Failures in window before marking down |
| `unhealthy_request_count` | int | 0 | Concurrent request limit |
| `unhealthy_status` | []int | - | Status codes that count as failures |
| `unhealthy_latency` | duration | 0 | Latency threshold for failure |

## CircuitBreaker (interface)

- `OK() bool` - Whether the circuit breaker allows requests.
- `RecordMetric(statusCode int, latency time.Duration)` - Record a response metric.

## Failure Modes

- Health check HTTP request fails: upstream is marked unhealthy (after consecutive fail threshold).
- Panic in health checker goroutine: recovered and logged, checker continues on next tick.
- Passive health check state for dynamic upstreams: effectively reset when no concurrent requests refer to the upstream (garbage collected).
