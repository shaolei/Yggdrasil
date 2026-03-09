# Throttling — Internals

## Logic

### Sliding window algorithm

`SimpleRateThrottle` uses a sliding window implemented as a list of timestamps stored in cache:

1. Load history list from cache (default: empty list `[]`).
2. Remove all entries where `timestamp <= now - duration` (expired).
3. If `len(history) >= num_requests`: deny.
4. Otherwise: insert `now` at position 0, write back to cache with TTL = duration.

The list is ordered newest-first (insert at 0). The cleanup loop pops from the end (oldest entries). This means the list is always sorted in descending order of time.

### Wait time calculation

`wait()` computes: `remaining_duration / available_requests`, where:
- `remaining_duration = duration - (now - history[-1])` — time until the oldest entry in the window expires
- `available_requests = num_requests - len(history) + 1` — how many slots open after the oldest expires

Returns None if `available_requests <= 0` (edge case during config changes, see note in APIView's `check_throttles`).

### Proxy-aware client identification

`get_ident()` has two modes based on `NUM_PROXIES`:
- **NUM_PROXIES is not None**: Takes the `(NUM_PROXIES)`th-from-last address in `X-Forwarded-For`. If NUM_PROXIES is 0 or no XFF header, uses `REMOTE_ADDR`.
- **NUM_PROXIES is None**: Uses the entire `X-Forwarded-For` (spaces stripped) or `REMOTE_ADDR`. This is less secure but works without proxy configuration.

### ScopedRateThrottle deferred initialization

`ScopedRateThrottle.__init__()` is overridden to do nothing — it skips the parent's rate resolution. This is because the scope comes from the view, which isn't available at init time. Rate resolution happens inside `allow_request()` after reading `view.throttle_scope`.

## State

All state is in the cache. Instance attributes (`self.history`, `self.now`, `self.key`) are set during `allow_request()` and used by `throttle_success()`, `throttle_failure()`, and `wait()`. These are NOT thread-safe between calls, but this is fine because each request gets fresh throttle instances (per the class-based-policy aspect).

## Decisions

### Sliding window over fixed window — rationale: unknown — inferred from code

Uses a sliding window (list of timestamps) rather than a fixed window (counter with expiry). The sliding window prevents burst-at-boundary attacks where a client sends N requests at 11:59 and N more at 12:00. Rationale for this specific choice is not documented in code.

### Cache-backed over in-memory — rationale: unknown — inferred from code

Uses Django's cache framework (typically memcached/Redis) rather than in-memory storage. This works across multiple server processes/workers but adds network latency to every throttled request. Rationale not documented, but in-memory would not work with multi-process deployments.

### Timestamps list over counter — rationale: inferred from code

Stores individual timestamps rather than a count. This enables the sliding window behavior and accurate wait-time calculation, but uses more memory per client than a simple counter would.

### AnonRateThrottle skips authenticated users — rationale: inferred from code

Returns None cache key for authenticated users, effectively disabling throttling. This separates anon and user throttling: use `AnonRateThrottle` for public rate limits and `UserRateThrottle` for per-user limits. They can coexist (both checked, most restrictive wins).

### ScopedRateThrottle overrides __init__ — rationale: observable from code comment

The comment says "Override the usual SimpleRateThrottle, because we can't determine the rate until called by the view." This is because the scope comes from `view.throttle_scope`, which isn't available during class instantiation.
