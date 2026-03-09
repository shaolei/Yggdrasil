# Sliding Window Throttle

## What

`SimpleRateThrottle` implements a sliding window rate limiter:
1. Request timestamps are stored as a list in Django's cache.
2. On each request, expired timestamps (older than the window duration) are popped from the end.
3. If remaining timestamps exceed the allowed count, the request is throttled.
4. The `wait()` method calculates recommended retry time from the remaining window.

Rate strings follow the format `"N/period"` where period starts with s/m/h/d.

## Why

Rationale: unknown — inferred from code. The sliding window approach provides smoother rate limiting than fixed windows. The choice to use Django's cache framework allows the throttle state to be shared across processes and servers without additional infrastructure.

Commit `72c155d8` (#7872) reverted a change from list to deque (#7849), suggesting the list-based implementation was preferred. Rationale: unknown — the revert commit does not explain why deque was rejected.

## Constraints

- Cache key format: `throttle_%(scope)s_%(ident)s`.
- `ScopedRateThrottle` defers `__init__` logic to `allow_request` because the scope comes from the view, which is not available at construction time.
- `wait()` can return `None` when `available_requests <= 0`, handled by commit `5a8736ae` (#6837).
- Thread `#1438` (referenced in code comment) notes that `None` values in throttle durations can occur from config/rate changes.
