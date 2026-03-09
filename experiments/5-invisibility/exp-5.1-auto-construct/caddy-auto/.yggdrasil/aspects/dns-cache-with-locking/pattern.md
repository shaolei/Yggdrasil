# DNS Cache with Double-Check Locking

Both SRVUpstreams and AUpstreams use an identical caching pattern:

1. First, acquire a cheap read-lock and check if cached result is fresh (within refresh interval).
2. If fresh, return the cached result immediately (hot path).
3. If stale, acquire a write-lock.
4. Re-check freshness under the write-lock (another goroutine may have refreshed it).
5. If still stale, perform the DNS lookup and update the cache.

Additional behaviors:
- Cache size is limited to 100 entries; when full, a random entry is evicted before adding a new one.
- SRVUpstreams supports a `grace_period` for returning stale results on lookup failure.
- All returned upstreams are fresh copies (`allNew()`) to prevent mutation of cached state.
- Custom DNS resolvers are supported with random selection from configured resolver addresses.
