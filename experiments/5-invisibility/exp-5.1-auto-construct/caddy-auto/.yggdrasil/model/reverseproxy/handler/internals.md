# Handler Internals

## Logic

### Proxy Loop

The `ServeHTTP` method runs a retry loop where each iteration calls `proxyLoopIteration()`. This method was factored out so that `defer` statements work correctly per-attempt. Each iteration:

1. Gets upstreams (static or dynamic).
2. Selects one via the load balancing policy.
3. Fills dial info (resolving placeholders in addresses).
4. Applies header operations (transport defaults first, then user config).
5. Calls `reverseProxy()` to perform the actual round-trip.
6. On failure: counts the failure for passive health checks, checks if retry should continue.

### In-Flight Request Tracking

A package-level `sync.Map` with `atomic.Int64` values tracks in-flight requests per upstream address. This was introduced in PR #7517 to replace UsagePool-based tracking, avoiding global lock contention under high RPS. The admin API uses this to expose current request counts.

### Body Handling on Retries

When retries are configured and a request body exists, the body is wrapped in `io.NopCloser` to prevent Go's HTTP transport from closing it on dial errors (since `cloneRequest` does a shallow copy, the cloned and original body share the same `io.ReadCloser`). For fully buffered bodies, a `*bytes.Buffer` reference is kept and replayed via `bytes.NewReader` on each retry attempt.

### WebSocket over HTTP/2-3

Extended CONNECT requests (HTTP/2 `:protocol` header or HTTP/3 `Proto` field = "websocket") are converted to HTTP/1.1 upgrade requests before proxying. The original body is stashed in a context variable for later use by the streaming handler.

## Decisions

- **sync.Map + atomic.Int64 over UsagePool for in-flight tracking**: Chosen to avoid lock contention under high RPS. The previous approach using UsagePool had global locking. A lookup map in the admin API fixed potential O(n^2) iteration over upstreams. Source: commit 88616e8 / PR #7517.
- **NopCloser body wrapping for retries**: Chosen because Go's transport closes the body on dial errors, but shallow-copied request bodies share the same ReadCloser. Without wrapping, the original body would be closed after the first dial failure, breaking subsequent retries. Source: commit a5e7c6e / PR #7547, referencing issues #6259 and #7546.
- **Dynamic upstreams tracked separately with last-seen timestamps**: Instead of reference-counting dynamic upstreams (which caused them to be discarded between requests), dynamic upstreams now persist in a separate map with timestamps so their health state survives across requests. Source: commit db29860 / PR #7539.
- **URL query escaping for proxy protocol host info**: When proxy protocol is enabled, client address info is appended to the host with "->". Without URL escaping, h2 transport constantly creates new connections because it uses the address to determine connection reuse, leading to file descriptor exhaustion. Source: commit 2ab043b / PR #7537, referencing issue #7529.
- **Default try_interval of 250ms**: rationale: unknown -- inferred from code comment "a non-zero try_duration with a zero try_interval will always spin the CPU for try_duration if the upstream is local or low-latency".
