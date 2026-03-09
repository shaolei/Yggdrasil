# Handler Internals

## Logic

### Proxy Loop

The core of ServeHTTP is a retry loop (`for { ... }`) where each iteration calls `proxyLoopIteration()`. This separation into its own method exists to enable `defer` cleanup per iteration.

Each iteration:
1. Gets upstream pool (static `h.Upstreams` or dynamic via `DynamicUpstreams.GetUpstreams()`)
2. Calls `SelectionPolicy.Select()` to choose an upstream
3. If no upstream: check `tryAgain()`, retry or break
4. Fill dial info from upstream (with placeholder replacement)
5. Apply header operations (transport defaults first, then user config)
6. Call `reverseProxy()` for the actual round-trip
7. On success or context.Canceled: break
8. On `roundtripSucceededError`: break (error happened after successful round-trip)
9. On failure: count failure via passive health check, check `tryAgain()`, retry or break

### Request Preparation

`prepareRequest()` is called once before the retry loop:
- Clones request (shallow copy + deep clone of headers, URL, trailer)
- Sanitizes URL (removes scheme and host to prevent override)
- Applies request rewrite if configured
- Buffers request body if configured
- Strips hop-by-hop headers, preserving Upgrade for protocol switches
- Sets X-Forwarded-For/Proto/Host (with trusted proxy awareness)
- Sets Early-Data header if TLS handshake incomplete
- Adds Via header
- Prepares PROXY protocol info from client IP

### WebSocket/Extended CONNECT Handling

HTTP/2 and HTTP/3 WebSocket support uses Extended CONNECT (RFC 8441):
- Detected by: `r.Method == CONNECT && header[:protocol] == "websocket"` (H2) or `r.Proto == "websocket"` (H3)
- Converted to HTTP/1.1-style upgrade: method changed to GET, Upgrade/Connection headers set, Sec-WebSocket-Key generated
- Original body saved in context for later use by `handleUpgradeResponse()`

### Response Finalization

`finalizeResponse()` handles two cases:
1. **101 Switching Protocols**: delegates to `handleUpgradeResponse()` for bidirectional streaming
2. **Normal response**: strips hop-by-hop headers, applies response header ops, copies headers to client, streams body via `copyResponse()`, handles trailers

If body copy errors occur after headers are written, the handler panics with `http.ErrAbortHandler` to abort the stream cleanly (cannot return error to error handler since headers already sent).

### Streaming and Flush Behavior

`flushInterval()` determines flush strategy based on response type:
- `text/event-stream` (SSE): flush immediately (returns -1)
- `Content-Length == -1` (unknown length): flush immediately
- Bidirectional H2 stream (H2 request + H2 response + unknown length + identity encoding): flush immediately
- Otherwise: use configured `FlushInterval`

`copyResponse()` uses a `maxLatencyWriter` that batches writes and flushes on a timer. Buffer pool (`streamingBufPool`) provides reusable 32KB buffers.

### Connection Management for Graceful Shutdown

Hijacked connections (WebSocket, protocol upgrades) are registered in `h.connections` map. On handler cleanup:
- If `StreamCloseDelay == 0`: close all connections immediately
- If `StreamCloseDelay > 0`: set a timer to close connections after delay (prevents thundering herd on config reload)
- WebSocket connections get a graceful close frame (RFC 6455 close control message with code 1001 "Going Away")
- Client-side messages are masked per RFC 6455 section 5.3

### Retry Logic (`tryAgain`)

Retries are gated by multiple conditions:
1. `TryDuration > 0` and elapsed time < TryDuration
2. `Retries > 0` and attempts < Retries
3. Error type check: dial errors always retryable; non-dial errors require idempotency check
4. Idempotency: GET requests retryable by default; other methods require matching `retry_match` matchers
5. Sleep for `TryInterval` between retries (default 250ms when retries enabled)

### Body Buffering

`bufferedBody()` reads up to `limit` bytes into a `bytes.Buffer` from the pool:
- If limit reached before EOF: return MultiReader(buffer + original body) — partial buffering
- If EOF reached: close original body, return buffer only — full buffering
- Fully buffered bodies enable retry replay: on each retry iteration, body is reset to `bytes.NewReader(bufferedReqBody.Bytes())`
- Body wrapped in `io.NopCloser` during retries to prevent Go's transport from closing it on dial errors

## State

- `inFlightRequests`: global `sync.Map` with `atomic.Int64` values, tracks per-address request counts for metrics
- `hosts`: global `caddy.UsagePool` for static upstream Host state persistence across config reloads
- `dynamicHosts`: global map with last-seen timestamps, evicted after 1 hour of inactivity
- `connections`: per-handler map of hijacked connections for graceful shutdown
- `connectionsCloseTimer`: per-handler timer for delayed connection cleanup

## Decisions

- Chose to clone requests (shallow + deep headers/URL) over modifying in place because the retry loop needs each attempt to start from the same base state. Placeholders in header values depend on the selected upstream, so headers must be re-applied from the original on each retry.
- Chose `panic(http.ErrAbortHandler)` for mid-stream errors over returning error because once response headers are written to the client, no error handler can modify the response. The panic cleanly aborts the HTTP/2 stream. rationale: unknown — inferred from code comment referencing issue #5951.
- Chose 499 status for client cancellation over 502 because 5xx errors trigger alerting and retries in many monitoring setups, but client-initiated cancellation is not a server-side failure. rationale: unknown — inferred from code comment referencing issue #3748 and noting "historical reasons."
- Chose to use `io.NopCloser` wrapper for retry bodies over other approaches because Go's `http.Transport` closes the request body on dial errors, which would prevent subsequent retry attempts from having a body to send. This was discovered via issues #6259 and #7546.
- Chose separate `dynamicHosts` map with time-based eviction over the reference-counted `UsagePool` for dynamic upstreams because dynamic upstreams are allocated and discarded on every request, so reference counting would constantly create and destroy Host state, losing passive health check history.
