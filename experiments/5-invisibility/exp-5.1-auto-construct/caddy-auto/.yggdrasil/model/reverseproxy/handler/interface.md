# Handler Interface

## Public API

### `ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error`

Main entry point. Prepares the request, runs the proxy loop with retries, returns nil on success or an HTTP error.

### `Provision(ctx caddy.Context) error`

Sets up the handler: loads transport, selection policy, circuit breaker, dynamic upstream modules. Provisions health checks, parses trusted proxy CIDRs, starts active health checker goroutine if configured.

### `Cleanup() error`

Cleans up hijacked connections (immediately or after StreamCloseDelay) and removes upstream hosts from the global pool.

## Configuration (JSON)

| Field | Type | Default | Description |
|---|---|---|---|
| `transport` | module | HTTPTransport | The round-trip transport |
| `upstreams` | []Upstream | - | Static backend list |
| `dynamic_upstreams` | module | - | Dynamic upstream source |
| `load_balancing` | LoadBalancing | random | Selection policy + retry config |
| `health_checks` | HealthChecks | - | Active and passive health checks |
| `headers` | HeaderHandler | - | Request/response header manipulation |
| `flush_interval` | duration | 0 | Response flush interval |
| `request_buffers` | int64 | 0 | Max request body buffer size |
| `response_buffers` | int64 | 0 | Max response body buffer size |
| `stream_timeout` | duration | 0 | Force-close streaming connections after this |
| `stream_close_delay` | duration | 0 | Delay closing streams on config reload |
| `rewrite` | Rewrite | - | Rewrite request method/URI before proxying |
| `handle_response` | []ResponseHandler | - | Custom response processing routes |
| `trusted_proxies` | []string | - | CIDR ranges for trusted proxy headers |
| `verbose_logs` | bool | false | Enable detailed debug logging |

## Placeholders Set

- `{http.reverse_proxy.upstream.address}` - Full upstream address
- `{http.reverse_proxy.upstream.hostport}` - Host:port
- `{http.reverse_proxy.upstream.host}` - Host only
- `{http.reverse_proxy.upstream.port}` - Port only
- `{http.reverse_proxy.upstream.requests}` - Current request count
- `{http.reverse_proxy.upstream.max_requests}` - Max request limit
- `{http.reverse_proxy.upstream.fails}` - Recent failure count
- `{http.reverse_proxy.upstream.latency}` - Response header latency
- `{http.reverse_proxy.upstream.duration}` - Total proxy duration
- `{http.reverse_proxy.retries}` - Retry count
- `{http.reverse_proxy.duration}` - Total duration including retries

## Failure Modes

- No available upstream: returns 503 Service Unavailable.
- All retries exhausted: returns the last proxy error as an HTTP status.
- Request body close on dial error: mitigated by wrapping body in NopCloser when retries are configured (see commit #7547).
- Unlimited buffering: logs a warning if request_buffers or response_buffers is set to -1 (risk of OOM).
