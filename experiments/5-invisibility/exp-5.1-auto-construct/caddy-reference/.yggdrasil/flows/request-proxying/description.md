# Request Proxying

## Business context

When an HTTP request arrives that matches a reverse proxy route, the system must forward it to an appropriate backend server, relay the response back to the client, and handle failures gracefully with retries.

## Trigger

An incoming HTTP request is routed to the reverse proxy handler by Caddy's HTTP server.

## Goal

Deliver the client's request to a healthy, available backend, relay the response (or upgraded connection) back to the client, and update health state based on the outcome.

## Participants

- **Handler** (reverse-proxy/handler): Orchestrates the entire proxy flow, owns the retry loop
- **Selection Policies** (reverse-proxy/selection-policies): Choose which backend receives each attempt
- **Upstreams** (reverse-proxy/upstreams): Provide the pool of backends (static or dynamic via DNS)
- **Transport** (reverse-proxy/transport): Performs the actual HTTP round-trip to the backend
- **Health Checks** (reverse-proxy/health-checks): Passive checks update fail counts after each attempt

## Paths

### Happy path

1. Handler receives request, clones and prepares it (strips hop-by-hop headers, sets X-Forwarded-* headers, buffers body if configured)
2. Handler enters proxy loop: gets upstream pool (static or dynamic)
3. Selection policy chooses an available upstream from the pool
4. Handler fills dial info, sets upstream placeholders, applies header operations
5. Handler calls `reverseProxy()`: increments request count, directs request URL to upstream, performs round-trip via transport
6. Response is received: passive health checks evaluate status code and latency
7. Response handlers are evaluated (if configured); otherwise response is finalized
8. `finalizeResponse()` strips hop-by-hop headers from response, copies headers and body to client, handles trailers
9. Request count is decremented

### Protocol upgrade path (WebSocket)

1. Same as happy path through step 5
2. Response has status 101 Switching Protocols
3. `handleUpgradeResponse()` hijacks the client connection (or uses h2 extended CONNECT)
4. Bidirectional copy between client and backend via `switchProtocolCopier`
5. Connections are registered for graceful shutdown handling

### Retry path

1. Round-trip fails (dial error, bad status, timeout)
2. Passive health check counts the failure for the upstream
3. `tryAgain()` checks: retry duration not exceeded, retry count not exceeded, request is retryable (GET by default, or matches retry_match)
4. If retryable: wait `try_interval`, re-enter proxy loop at step 2 (new upstream selected)
5. If not retryable: return error (502 Bad Gateway, 504 Gateway Timeout, or 499 Client Closed)

### No upstream available path

1. Selection policy returns nil (all backends unavailable)
2. If retries configured, retry with backoff
3. If retries exhausted, return 503 Service Unavailable

## Invariants across all paths

- Hop-by-hop headers are always stripped from both requests and responses
- X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host are always set (respecting trusted proxy config)
- Request count on the Host is always incremented before and decremented after each attempt
- The original request is never modified; a clone is used for proxying
- Body buffering for retries only happens when retries are configured and body is available
- Dial errors are always safe to retry; non-dial errors require idempotency check
