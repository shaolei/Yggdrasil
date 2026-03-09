# Throttling — Internals

## Logic

### Sliding Window Algorithm
`SimpleRateThrottle.allow_request()`:
1. If `rate` is None, allow (no limit configured).
2. Get cache key; if None, allow (throttle doesn't apply to this request).
3. Fetch history list from cache (default: empty list).
4. Pop entries from end of list that are older than `now - duration`.
5. If `len(history) >= num_requests`, call `throttle_failure()`.
6. Otherwise, call `throttle_success()` which inserts `now` at position 0 and writes to cache with TTL = duration.

History is stored newest-first (insert at 0, pop from end).

### Client Identification (`get_ident`)
With `NUM_PROXIES` set:
- `NUM_PROXIES = 0` or no `X-Forwarded-For` → use `REMOTE_ADDR`
- `NUM_PROXIES > 0` → take the Nth-from-last entry in `X-Forwarded-For`

Without `NUM_PROXIES` (None): concatenate all `X-Forwarded-For` entries (spaces removed) or use `REMOTE_ADDR`.

Commit `2d5e14a8`: "Throttles now use HTTP_X_FORWARDED_FOR, falling back to REMOTE_ADDR to identify anonymous requests."
Commit `d6d08db0`: "Fix ident format when using HTTP_X_FORWARDED_FOR."
Commit `cc13ee05`: "Fix error when NUM_PROXIES is greater than one."

### ScopedRateThrottle Deferred Init
`ScopedRateThrottle.__init__` is a no-op (`pass`). Rate parsing is deferred to `allow_request()` because the scope is determined by `view.throttle_scope`, which isn't available at throttle construction time.

## Decisions

- **List over deque for history**: Commit `72c155d8` (#7872) reverted commit `ebcb8d53` (#7849) which changed from list to deque. Rationale: unknown — the revert commit does not explain why.
- **All throttles checked, not short-circuited**: Commit `afb67843` (#6711): "Always call all throttling classes on the view when checking throttles." The view's `check_throttles()` collects all wait times and uses the maximum. This ensures all throttle counters are updated even if an earlier one denies.
- **Retry-After header**: Commit `19b8f779`: "Throttles now use Retry-After header and no longer support the custom style." Standardized on HTTP `Retry-After` header.
- **Cache-backed, not in-memory**: Uses Django's cache framework, allowing shared state across processes/servers. Rationale: unknown — inferred from code, but clearly necessary for multi-process deployments.
