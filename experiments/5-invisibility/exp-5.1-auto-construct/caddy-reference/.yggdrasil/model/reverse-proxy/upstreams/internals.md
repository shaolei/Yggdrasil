# Upstreams Internals

## Logic

### DNS Caching

Both SRVUpstreams and AUpstreams use the same double-checked locking pattern for DNS caches:
1. Acquire read lock, check if cached result is fresh
2. If fresh: return cached result (fast path)
3. Acquire write lock, re-check freshness (another goroutine may have refreshed)
4. If still stale: perform DNS lookup, update cache
5. Cache eviction: when adding a new entry and cache has 100+ entries, delete one random entry

SRV grace period: on lookup failure, if `GracePeriod > 0`, extend the freshness of the existing cached result by `GracePeriod - Refresh` duration. This allows continued operation with stale data during DNS outages.

`allNew()` helper creates fresh `*Upstream` pointers from cached `[]Upstream` values on each call, ensuring callers get independent upstream instances that won't interfere with each other's Host state.

### Host State Management

Static upstreams use `caddy.UsagePool` (reference-counted concurrent map). The pool persists across config reloads: when a new config provisions the same upstream address, it gets the existing Host with its accumulated health state.

Dynamic upstreams use a separate `dynamicHosts` map because reference counting doesn't work for objects that are created and destroyed on every request. Instead:
- Each `fillDynamicHost()` call updates the `lastSeen` timestamp
- A background goroutine (started once via `sync.Once`) runs every 5 minutes and evicts entries idle for >1 hour
- This preserves passive health check state across requests to the same dynamic backend

### In-Flight Request Tracking

Global `inFlightRequests` (`sync.Map` with `atomic.Int64`) tracks per-address request counts. This is separate from `Host.numRequests` and is used for metrics/observability. Lock-free design using `LoadOrStore` + `atomic.Add` on the hot path.

## Decisions

- Chose double-checked locking (RLock then WLock) for DNS cache over simpler mutex because DNS lookups should not block concurrent requests that can use cached results. The read-lock fast path avoids contention under normal operation.
- Chose random eviction for DNS cache overflow over LRU because the cache is small (100 entries) and random eviction is simpler with similar performance characteristics for this size. rationale: unknown — inferred from code.
- Chose separate dynamicHosts map with time-based eviction over UsagePool for dynamic upstreams because dynamic upstreams are created per-request and would cause constant churn in a reference-counted pool, losing health state between requests. The 1-hour idle timeout balances memory cleanup with state preservation.
- Chose `allNew()` to return fresh Upstream pointers on each cache hit over returning cached pointers because the caller (Handler) mutates Upstream fields (fills Host, sets circuit breaker, sets healthCheckPolicy). Shared pointers would cause data races.
