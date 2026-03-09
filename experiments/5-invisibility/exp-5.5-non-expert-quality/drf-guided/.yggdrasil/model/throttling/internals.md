# Throttling — Internals

## Logic

### Sliding Window Algorithm (SimpleRateThrottle)
1. Get request history from cache (list of timestamps, newest first)
2. Remove timestamps older than `now - duration`
3. If remaining count >= `num_requests`, deny (throttle_failure)
4. Otherwise, insert current timestamp at position 0 and update cache

### ScopedRateThrottle Init Override
ScopedRateThrottle overrides `__init__` to do nothing — it cannot determine the rate at init time because it depends on `view.throttle_scope`, which is only available when `allow_request` is called. Rate parsing happens inside `allow_request` instead.

### Wait Time Calculation
`remaining_duration / available_requests` — distributes remaining time evenly across remaining request slots.

## Constraints

- Cache backend must support storing Python lists via `get`/`set`
- History list is stored newest-first (prepend on success)
- Cache TTL is set to `duration` (the throttle window), so entries auto-expire

## Decisions

- **Sliding window over fixed window**: Uses a sliding window (track individual request timestamps) rather than a fixed window (reset counter every period). Sliding window is more accurate but stores more data. Rationale: unknown — predates current team, but sliding window prevents burst-at-boundary attacks.

- **Cache-based over database**: Uses Django cache for throttle state instead of database. Chose cache because: high write frequency (every request), acceptable to lose state on cache clear (throttle resets are not catastrophic), performance critical path.
