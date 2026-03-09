# Handler Interface

## ServeHTTP

```go
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error
```

Entry point for the reverse proxy. Prepares the request, enters the proxy retry loop, and returns an error if all attempts fail.

**Parameters:**
- `w`: ResponseWriter to write the proxied response to
- `r`: Incoming HTTP request
- `next`: Next handler in the middleware chain (used by response handler routes)

**Returns:** `error` — nil on success; `caddyhttp.HandlerError` with appropriate status code on failure (502, 504, 499, 503)

**Failure modes:**
- 502 Bad Gateway: upstream returned error or connection failed after retries exhausted
- 504 Gateway Timeout: upstream timed out (net.Error with Timeout() == true)
- 499 Client Closed: client canceled the request (context.Canceled)
- 503 Service Unavailable: no upstreams available

## Provision

```go
func (h *Handler) Provision(ctx caddy.Context) error
```

Sets up the handler: loads sub-modules (transport, selection policy, circuit breaker, dynamic upstreams), provisions health checks, starts active health checker goroutine if enabled, parses trusted proxy CIDRs.

## Cleanup

```go
func (h *Handler) Cleanup() error
```

Closes hijacked streaming connections (immediately or after `StreamCloseDelay`) and removes upstream hosts from the global pool.

## Key Configuration Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `transport` | module (http.RoundTripper) | HTTPTransport | Transport for backend round-trips |
| `load_balancing` | LoadBalancing | random selection | Load balancing config including selection policy, retries, try_duration |
| `health_checks` | HealthChecks | nil | Active and passive health check configuration |
| `upstreams` | UpstreamPool | nil | Static list of backend addresses |
| `dynamic_upstreams` | module (UpstreamSource) | nil | Dynamic upstream source |
| `flush_interval` | duration | 0 | Response buffer flush interval; negative = immediate; 0 = no periodic flush |
| `request_buffers` | int64 | 0 | Buffer request body up to this size; -1 = unlimited (dangerous) |
| `response_buffers` | int64 | 0 | Buffer response body up to this size; -1 = unlimited (dangerous) |
| `stream_timeout` | duration | 0 | Force-close streaming connections after this duration |
| `stream_close_delay` | duration | 0 | Delay closing streams on config reload to prevent thundering herd |
| `trusted_proxies` | []string | nil | CIDR ranges of trusted proxies for X-Forwarded-* handling |
| `headers` | HeaderHandler | nil | Request/response header manipulation |
| `rewrite` | Rewrite | nil | Rewrite request method/URI before proxying |
| `handle_response` | []ResponseHandler | nil | Conditional response processing routes |

## Key Interfaces Defined

```go
type Selector interface {
    Select(UpstreamPool, *http.Request, http.ResponseWriter) *Upstream
}

type UpstreamSource interface {
    GetUpstreams(*http.Request) ([]*Upstream, error)
}

type CircuitBreaker interface {
    OK() bool
    RecordMetric(statusCode int, latency time.Duration)
}
```

## Exported Types

- `DialInfo`: Contains network, address, host, port for dialing an upstream
- `GetDialInfo(ctx) (DialInfo, bool)`: Retrieves dial info from request context
- `DialError`: Wraps errors that occurred during dialing (used for retry decisions)
- `LoadBalancing`: Configuration for selection policy, retries, try_duration, try_interval, retry_match
- `ProxyProtocolInfo`: Contains AddrPort for PROXY protocol header generation
