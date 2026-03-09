# Gold Standard Answers — Caddy Reverse Proxy

## F1: What are the 12 load balancing selection policies available, and what algorithm does each use?

1. **RandomSelection** (`random`): Reservoir sampling over available hosts in a single pass. O(n) with no allocation.
2. **RandomChoiceSelection** (`random_choose`): "Power of two choices" — selects `Choose` (default 2) random available hosts via reservoir sampling, then picks the one with least active requests.
3. **LeastConnSelection** (`least_conn`): Finds the host with fewest active requests (`NumRequests()`). Ties broken by reservoir sampling for uniform random among tied hosts.
4. **RoundRobinSelection** (`round_robin`): Atomic counter (`atomic.AddUint32`) modulo pool size. Skips unavailable hosts, tries up to `len(pool)` positions.
5. **WeightedRoundRobinSelection** (`weighted_round_robin`): Atomic counter modulo total weight. Maps counter position to weight buckets to select corresponding upstream. Zero-weight upstreams excluded.
6. **FirstSelection** (`first`): Returns the first available host in pool order. Useful for prioritized failover with `MultiUpstreams`.
7. **IPHashSelection** (`ip_hash`): Hashes `req.RemoteAddr` (remote IP extracted via `net.SplitHostPort`) using Rendezvous/HRW hashing with xxhash.
8. **ClientIPHashSelection** (`client_ip_hash`): Same as IPHashSelection but uses the client IP from Caddy's trusted proxy settings (`caddyhttp.ClientIPVarKey`), which respects X-Forwarded-For from trusted proxies.
9. **URIHashSelection** (`uri_hash`): Hashes `req.RequestURI` using Rendezvous/HRW hashing.
10. **QueryHashSelection** (`query`): Hashes a specific query parameter's value(s) joined by comma. Falls back to configurable policy (default: random) if key absent.
11. **HeaderHashSelection** (`header`): Hashes a specific header field value. Special case: Host header read from `req.Host` (not `req.Header`). Falls back to configurable policy (default: random) if header absent.
12. **CookieHashSelection** (`cookie`): Sticky sessions. On first request, selects via fallback policy, sets cookie with HMAC-SHA256 of upstream address. Subsequent requests with matching cookie go to same upstream. Falls back when cookie's upstream is unavailable.

All hash-based policies (7-12) use `hostByHashing()` which implements Highest Random Weight (Rendezvous) hashing: for each available upstream, computes `xxhash(upstream.String() + input)` and selects the upstream with the highest hash value.

---

## F2: What happens during handleUpgradeResponse for WebSocket?

1. **Validation**: Verify the upgrade type in the response matches the request (case-insensitive ASCII compare). Verify the response upgrade type is printable ASCII.
2. **Backend connection**: Extract `io.ReadWriteCloser` from `res.Body` (the raw backend connection after 101).
3. **Copy response headers** to the client ResponseWriter, normalize WebSocket header casing (e.g., `Sec-Websocket-Accept` -> `Sec-WebSocket-Accept`).
4. **Branch on HTTP version**:
   - **HTTP/2+ Extended CONNECT**: Retrieve the saved body from context. Send 200 OK (not 101). Remove Upgrade/Connection/Sec-WebSocket-Accept headers. Create `h2ReadWriteCloser` wrapping request body (read side) and ResponseWriter (write side, with flush after each write). Use minimal 1-byte bufio buffers.
   - **HTTP/1.1**: Write 101 status code to client. Hijack the client connection via `ResponseController.Hijack()` to get raw `io.ReadWriteCloser` and `*bufio.ReadWriter`.
5. **Flush** any buffered data from the hijack's `*bufio.ReadWriter`.
6. **Write buffered data**: If the bufio reader has buffered bytes (read ahead), write them to the backend connection.
7. **Register connections** for graceful shutdown: both client and backend connections are registered in `h.connections` map. If WebSocket, register a `gracefulClose` function that sends a Close control frame (opcode 8, status 1001 "Going Away"). Client-side messages are masked per RFC 6455.
8. **Bidirectional copy**: Create `switchProtocolCopier` with two goroutines:
   - `copyToBackend`: `io.Copy(backend, client)`
   - `copyFromBackend`: `io.Copy(client, backend)`
9. **Wait** for either: first error from either copy goroutine, stream timeout (if configured), or request context cancellation triggers backend close.
10. **Cleanup**: Close both connections, log duration. Deferred `deleteBackConn()` and `deleteFrontConn()` remove connections from the registration map.

---

## F3: How does SRVUpstreams.GetUpstreams handle concurrent access and DNS failures?

**Concurrent access** uses double-checked locking:
1. Acquire read lock (`srvsMu.RLock()`), check if cached result is fresh (`time.Since(freshness) < Refresh`)
2. If fresh: return `allNew(cached.upstreams)` (fresh copies) and release read lock
3. If stale: release read lock, acquire write lock (`srvsMu.Lock()`)
4. Re-check freshness under write lock (another goroutine may have refreshed)
5. If still stale: perform DNS lookup, update cache, release write lock

`allNew()` creates new `*Upstream` pointers from cached `[]Upstream` values, ensuring callers get independent instances.

**DNS lookup failure handling**:
- If `LookupSRV` returns error AND zero records: check `GracePeriod`
  - If `GracePeriod > 0`: log error, extend cached result's freshness by `GracePeriod - Refresh`, return cached results
  - If `GracePeriod == 0`: return error to caller
- If `LookupSRV` returns error BUT some records: log warning, use the returned records (Go's resolver filters invalid names but returns remaining valid results)

**Cache eviction**: When adding a new entry (not replacing stale) and cache has >= 100 entries, delete one random entry.

---

## S1: Data flow from ServeHTTP to response

1. **Handler.ServeHTTP**: Gets `*caddy.Replacer` from context. Calls `prepareRequest()` to clone and prepare the request (strips hop-by-hop headers, sets X-Forwarded-*, buffers body). Detects HTTP/2-3 Extended CONNECT for WebSocket and converts to HTTP/1.1 upgrade. Wraps body in `io.NopCloser` if retries configured.

2. **Proxy retry loop** (`for { proxyLoopIteration() }`):
   a. **Upstreams**: Gets pool — either static `h.Upstreams` or dynamic via `DynamicUpstreams.GetUpstreams(r)`. Dynamic upstreams are provisioned with `provisionUpstream(dUp, true)`.
   b. **Selection Policy** (`h.LoadBalancing.SelectionPolicy.Select()`): Chooses one available upstream. Returns nil if none available.
   c. **Dial Info**: `upstream.fillDialInfo(repl)` resolves placeholders, parses network address.
   d. **Header Operations**: Transport-provided ops applied first (e.g., Host header for TLS), then user-configured ops.
   e. **Handler.reverseProxy()**: Increments request count on Host. Calls `directRequest()` to set `req.URL.Host`. Sets up 1xx response forwarding via `httptrace`. Calls `h.Transport.RoundTrip(req)`.
   f. **Transport.RoundTrip**: Sets URL scheme. Delegates to `http.Transport` (or `http3.Transport`). The custom `dialContext` extracts `DialInfo` from context, dials the connection, optionally sends PROXY protocol header, wraps in timeout conn.
   g. **Response evaluation**: Passive health checks evaluate status code and latency. Circuit breaker records metrics.
   h. **Response handlers**: If `handle_response` routes are configured and match, response is passed to them.
   i. **Handler.finalizeResponse()**: For 101: delegates to `handleUpgradeResponse()`. Otherwise: strips hop-by-hop headers, applies response header ops, copies headers to client, writes status code, streams body via `copyResponse()` (using `maxLatencyWriter` for flush control), handles trailers.

3. **Error handling**: On failure, `countFailure()` updates passive health. `tryAgain()` decides retry. On final failure, `statusError()` maps to 502/504/499.

---

## S2: Active vs passive health check interaction

**Active health checks**:
- Run in a background goroutine on a timer (default 30s)
- Perform HTTP requests to each static upstream independently (parallel goroutines)
- State: `Upstream.unhealthy` (atomic int32) — **per-handler**. Each handler has its own set of Upstream objects with their own unhealthy flag.
- Threshold-based: consecutive fails >= `Fails` threshold marks unhealthy; consecutive passes >= `Passes` threshold marks healthy. Counters reset on state transition.
- Only for static upstreams (not dynamic)

**Passive health checks**:
- Run inline during normal request proxying (no background process)
- Count failures triggered by: matching unhealthy_status codes, exceeding unhealthy_latency
- State: `Host.fails` (atomic int64) — **global** via the shared `Host` object in the `UsagePool`
- Sliding window: each failure increments count immediately, then a goroutine decrements after `FailDuration`
- `Healthy()` checks `Host.Fails() < MaxFails`

**Why different scopes**:
- Active health state is per-handler because different handlers may have different health check criteria (different URI paths, expected status codes, thresholds). What one handler considers unhealthy may be fine for another.
- Passive health state is global because passive failures reflect objective facts about the backend (it returned a 500, or it timed out). This information is equally relevant to all handlers proxying to that backend.

**Interaction in `Upstream.Healthy()`**:
```
healthy = u.healthy()                          // active: atomic load of unhealthy flag
if healthy && u.healthCheckPolicy != nil:
    healthy = u.Host.Fails() < MaxFails        // passive: global fail count
if healthy && u.cb != nil:
    healthy = u.cb.OK()                        // circuit breaker
```

All three must pass for the upstream to be considered healthy.

---

## S3: Selection policy and upstream availability interaction

Every selection policy calls `upstream.Available()` before selecting an upstream (this is enforced by convention, not by the interface). The chain:

1. **Policy.Select(pool, req, w)**: Iterates pool, checks `upstream.Available()` for each
2. **Upstream.Available()**: Returns `u.Healthy() && !u.Full()`
3. **Upstream.Healthy()**: Three checks in sequence:
   a. `u.healthy()` — `atomic.LoadInt32(&u.unhealthy) == 0` (active health check status, set by `setHealthy()`)
   b. If healthCheckPolicy set: `u.Host.Fails() < u.healthCheckPolicy.MaxFails` (passive fail count vs threshold)
   c. If circuit breaker set: `u.cb.OK()` (external circuit breaker module)
4. **Upstream.Full()**: `u.MaxRequests > 0 && u.Host.NumRequests() >= u.MaxRequests` (request count limit)

The `NumRequests()` used by `Full()` and by `LeastConnSelection` is the same atomic counter incremented by `Host.countRequest(1)` in `reverseProxy()` and decremented in its defer.

The `MaxRequests` field is set either directly on the upstream config or copied from `PassiveHealthChecks.UnhealthyRequestCount` during provisioning (if the upstream doesn't have its own limit).

---

## R1: Why io.NopCloser for retry bodies?

Go's `http.Transport` closes the request body when a dial error occurs (the connection could not be established). Since `cloneRequest()` does a shallow copy, `clonedReq.Body` and `r.Body` share the same `io.ReadCloser`. If the transport closes the body on a dial failure, subsequent retry attempts would have a closed body and fail.

Wrapping in `io.NopCloser` makes the `Close()` call a no-op, keeping the underlying reader accessible for retry attempts. The real body is closed by the HTTP server when the handler returns.

**Buffered vs unbuffered**: When the body was fully buffered (via `request_buffers`), the `bytes.Buffer` is extracted from the `bodyReadCloser` wrapper. On each retry iteration, a new `bytes.NewReader(bufferedReqBody.Bytes())` is created so the body can be replayed from the beginning. This is necessary because the backend may have partially or fully read the body before producing an error. For unbuffered bodies, only `io.NopCloser` wrapping is done — the body can only be read once (retries work only if the body hasn't been consumed, which is typically the case for dial errors where no data was sent). This design was driven by issues #6259 and #7546.

---

## R2: Why custom DialTLSContext for PROXY protocol?

PROXY protocol headers must be written to the raw TCP connection *before* the TLS handshake begins. Go's standard `http.Transport` combines connection establishment and TLS handshake into a single operation — there is no hook between "TCP connection established" and "TLS handshake begins."

The custom `DialTLSContext` separates these steps:
1. Call the regular `dialContext()` which establishes the TCP connection AND writes the PROXY protocol header
2. Create a `tls.Client` on top of the already-connected (and PROXY-protocol-initialized) connection
3. Perform the TLS handshake manually with timeout

Additionally, `DialTLSContext` is needed when TLS `ServerName` contains placeholders (e.g., `{http.request.host}`), because the server name must be resolved per-request using the replacer from the request context, but the standard transport's TLS config is shared across all connections.

---

## R3: Why join multiple query values with comma?

This prevents a client from controlling which upstream receives their request. If only the first value were used, a client could send the same query key multiple times (e.g., `?key=a&key=b`) and the proxy would hash only "a", while the backend might use a different value (e.g., the last one, "b"). The client could craft specific values to target a particular backend.

By joining all values with comma, the hash input includes all values, making the result less predictable and harder to manipulate. The code comment explicitly notes: "we'll join them to avoid a problem where the user can control the upstream that the request goes to by sending multiple values for the same key, when the upstream only considers the first value." However, it also acknowledges that changing the order of values may affect upstream selection, but this is semantically a different request since order is significant.

---

## I1: Impact of removing or changing Available() to not check Full()

**Direct impact on selection policies**: All 12 selection policies call `Available()` to filter the pool. Without `Full()` check:
- Upstreams with `MaxRequests` configured would receive traffic beyond their capacity limit
- `PassiveHealthChecks.UnhealthyRequestCount` would stop working entirely (it sets `MaxRequests` on upstreams during provisioning, and `Full()` is the only consumer of `MaxRequests`)
- Backends with limited connection capacity (e.g., embedded devices, single-threaded servers) would be overwhelmed

**Indirect impact**:
- `LeastConnSelection` still calls `NumRequests()` separately, so it would tend to spread load, but it would not hard-cap at `MaxRequests`
- `RandomChoiceSelection` also uses `NumRequests()` to pick among candidates, but without `Available()` filtering, all upstreams (including full ones) would be candidates
- The `first` selection policy with `MultiUpstreams` would no longer properly failover when the primary is at capacity

---

## I2: Impact of changing hostByHashing from HRW to modulo hashing

**Stability loss**: Rendezvous/HRW hashing guarantees that when the upstream list changes (backend added or removed), only traffic for the changed backend is redistributed. Simple modulo hashing (`hash(input) % len(pool)`) would redistribute almost ALL traffic when the pool size changes, because the modulo changes for every input.

**Affected policies**: IPHashSelection, ClientIPHashSelection, URIHashSelection, QueryHashSelection, HeaderHashSelection, CookieHashSelection — all 6 hash-based policies.

**User-visible impact**:
- Cache invalidation storms when backends are added/removed (all sticky sessions break)
- Cookie-based sticky sessions would all fail simultaneously when a backend goes down (all users get new cookies)
- Session affinity for IP-hash and URI-hash would be disrupted globally instead of only for the affected backend's share
- This would be especially damaging during rolling deployments or blue-green transitions

---

## I3: Impact of changing Host atomics to mutex

**Hot path impact**: `Host.NumRequests()` and `Host.countRequest()` are called on every proxied request (in `reverseProxy()` and its defer). `Host.Fails()` is checked on every upstream selection via `Healthy()`. These are the hottest paths in the proxy.

**Contention**: Under high concurrency (many goroutines proxying to the same backend), a mutex would create contention where none exists today. Atomic operations are wait-free on modern CPUs. A mutex would serialize all goroutines incrementing/decrementing request counts for the same upstream.

**Selection policy impact**: `LeastConnSelection` and `RandomChoiceSelection` read `NumRequests()` for every upstream in the pool on every request. With a mutex, reading N upstream request counts would acquire/release N mutexes. With atomics, these are simple memory loads.

**Passive health check impact**: `countFail` and `countFailure`'s background goroutines would need to hold the mutex while sleeping is not practical, so the mutex design would need to be more complex (lock/unlock around the delta, not around the sleep).

Overall: significant performance regression under load, especially for backends with many concurrent requests.

---

## C1: Why not LRU cache for DNS results?

The DNS cache in `SRVUpstreams` and `AUpstreams` uses random eviction when the cache exceeds 100 entries. An LRU would provide better eviction decisions (evicting least recently used entries).

However, the cache is small (100 entries) and the eviction case is rare (most deployments have far fewer than 100 distinct upstream domain lookups). At this scale, the difference between LRU and random eviction is negligible. Random eviction is simpler: no linked list, no move-to-front operations, just `for k := range map { delete(map, k); break }` (which iterates to a random map key in Go).

rationale: unknown — inferred from code. No comments or git history explain the choice. The simplicity argument is the most plausible explanation given the small cache size.

---

## C2: Why not HTTP/3 fallback alongside HTTP/1.1 and HTTP/2?

The code explicitly requires HTTP/3 to be the sole version: `if len(h.Versions) > 1 && slices.Contains(h.Versions, "3")` returns an error. The code comment explains:

> "this does not automatically fall back to lower versions like most web browsers do (that'd add latency and complexity, besides, we expect that site owners control the backends), so it must be exclusive"

The rationale is:
1. **Latency**: Browsers probe for HTTP/3 support using Alt-Svc headers and fall back to TCP if QUIC fails. This probing adds latency to the first connection. For a reverse proxy, where connection establishment time directly impacts request latency, this is undesirable.
2. **Complexity**: Maintaining parallel TCP and QUIC connection pools, implementing fallback logic, and handling mixed-version responses would significantly increase code complexity.
3. **Control**: Unlike browsers connecting to arbitrary internet servers, reverse proxies connect to backends controlled by the same operator. The operator knows which protocol their backend supports and can configure it explicitly.

---

## C3: Why separate dynamicHosts map instead of UsagePool?

Dynamic upstreams are created fresh on every request via `GetUpstreams()` and are not reference-counted. If they used the `UsagePool`:
1. Each request would call `LoadOrStore` (increment refcount) and then the Host would be dereferenced when the temporary `*Upstream` is garbage collected — but there's no automatic decrement on GC.
2. Even with explicit decrement, between requests there might be moments with zero references, causing the UsagePool to delete the Host entry. The next request would get a fresh Host with zeroed health counters.
3. For busy proxies, this churn would constantly reset passive health check state (fail counts) between requests.

The `dynamicHosts` map with time-based eviction (1-hour idle timeout) solves this:
- Health state persists across requests to the same dynamic backend
- No reference counting needed — just update `lastSeen` timestamp on each request
- Background goroutine (every 5 minutes) evicts entries not seen in over 1 hour
- Memory is bounded: idle backends are eventually cleaned up

This design preserves the important property that passive health check state (fail counts) survives across sequential requests to the same dynamic backend, while still cleaning up entries for backends that are no longer returned by the dynamic upstream source.
