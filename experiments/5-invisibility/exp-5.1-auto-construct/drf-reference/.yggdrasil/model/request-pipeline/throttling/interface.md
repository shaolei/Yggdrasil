# Throttling — Interface

## BaseThrottle (abstract)

### `allow_request(request, view) → bool`

Return True to allow the request, False to reject (throttle). Must be overridden.

### `get_ident(request) → str`

Identify the client by IP address. Handles `X-Forwarded-For` proxy chains: if `NUM_PROXIES` is set, takes the Nth-from-last address. Otherwise uses the full `X-Forwarded-For` (spaces stripped) or falls back to `REMOTE_ADDR`.

### `wait() → float | None`

Recommended seconds to wait before retrying. Used by APIView to set `Retry-After` header. Default returns None.

## SimpleRateThrottle

Cache-backed sliding window implementation. Requires subclasses to implement `get_cache_key()`.

### Class Attributes

| Attribute | Type | Default | Purpose |
|---|---|---|---|
| `cache` | Cache | `django.core.cache.cache` | Cache backend |
| `timer` | callable | `time.time` | Time source (injectable for testing) |
| `cache_format` | str | `'throttle_%(scope)s_%(ident)s'` | Cache key template |
| `scope` | str | None | Rate scope key in `DEFAULT_THROTTLE_RATES` |
| `THROTTLE_RATES` | dict | `DEFAULT_THROTTLE_RATES` | Scope → rate string mapping |
| `rate` | str | auto from scope | Rate string like `'100/hour'` |

### `__init__()`

Resolves `rate` from `scope` via `get_rate()`, then parses into `num_requests` and `duration`.

### `get_cache_key(request, view) → str | None`

Must be overridden. Return a unique cache key for this request, or None to skip throttling.

### `get_rate() → str`

Looks up `self.scope` in `self.THROTTLE_RATES`. Raises `ImproperlyConfigured` if scope is not set or not found in rates.

### `parse_rate(rate) → tuple[int, int]`

Parses `'number/period'` strings. Period: `s`=1s, `m`=60s, `h`=3600s, `d`=86400s. Returns `(None, None)` for None rate.

### `allow_request(request, view) → bool`

Sliding window algorithm:
1. Returns True if `rate` is None (throttling disabled).
2. Gets cache key; returns True if None.
3. Loads request history from cache.
4. Drops entries older than `duration` seconds.
5. If history length >= `num_requests`, calls `throttle_failure()`.
6. Otherwise calls `throttle_success()`.

### `throttle_success() → True`

Inserts current timestamp at position 0, writes history to cache with TTL = duration.

### `throttle_failure() → False`

Returns False. No side effects.

### `wait() → float | None`

Calculates recommended wait: `remaining_duration / available_requests`. Returns None if available_requests <= 0.

## AnonRateThrottle

`scope = 'anon'`. Only throttles unauthenticated requests (returns None key for authenticated users). Key: IP-based via `get_ident()`.

## UserRateThrottle

`scope = 'user'`. Throttles by user PK for authenticated users, by IP for anonymous. Always applies.

## ScopedRateThrottle

View-specific throttling. Reads `throttle_scope` from the view. Defers rate resolution to `allow_request()` time (overrides `__init__` to skip rate resolution). If the view has no `throttle_scope`, allows all requests.

## Failure Modes

| Scenario | Result | Notes |
|---|---|---|
| No scope set and no rate | `ImproperlyConfigured` | In `get_rate()` |
| Scope not in THROTTLE_RATES | `ImproperlyConfigured` | In `get_rate()` |
| Rate exceeded | Returns False → `Throttled` (via APIView) | |
| Cache unavailable | Silently allows (empty history) | Cache returns [] default |
