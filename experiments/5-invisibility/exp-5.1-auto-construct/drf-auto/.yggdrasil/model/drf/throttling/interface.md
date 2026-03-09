# Throttling — Interface

## Base Class

### `BaseThrottle`

#### `allow_request(request, view) -> bool`
Returns True if the request should be allowed.

#### `get_ident(request) -> str`
Identifies the client. Uses `HTTP_X_FORWARDED_FOR` with `NUM_PROXIES` setting to extract the correct client IP behind reverse proxies. Falls back to `REMOTE_ADDR`.

#### `wait() -> float | None`
Returns recommended seconds to wait before the next request.

## `SimpleRateThrottle`

### Class Attributes
- `cache` — Django cache instance (default: `default_cache`)
- `timer` — time function (default: `time.time`)
- `cache_format` — `'throttle_%(scope)s_%(ident)s'`
- `scope` — throttle scope name (used to look up rate in `DEFAULT_THROTTLE_RATES`)
- `THROTTLE_RATES` — rate configuration dict from settings

### Methods

#### `get_cache_key(request, view) -> str | None`
Must be overridden. Returns cache key for this request, or `None` to skip throttling.

#### `get_rate() -> str`
Looks up `self.scope` in `THROTTLE_RATES`. Raises `ImproperlyConfigured` if scope not set or rate not found.

#### `parse_rate(rate) -> (num_requests, duration_seconds)`
Parses `"N/period"` string. Period prefix: s=1, m=60, h=3600, d=86400.

#### `allow_request(request, view) -> bool`
Sliding window check. Pops expired entries, checks count vs limit.

#### `throttle_success() -> True`
Inserts current timestamp into history, updates cache.

#### `throttle_failure() -> False`
Returns False (hook for subclasses).

#### `wait() -> float | None`
Calculates remaining window time / available requests.

## Built-in Throttle Classes

### `AnonRateThrottle` (scope: `'anon'`)
Throttles unauthenticated requests by IP. Returns `None` for authenticated users (skips throttling).

### `UserRateThrottle` (scope: `'user'`)
Throttles by user ID (authenticated) or IP (anonymous).

### `ScopedRateThrottle`
Defers rate determination to `allow_request()` because scope comes from `view.throttle_scope`.
- If view has no `throttle_scope`, always allows.
- Overrides `__init__` to `pass` (no rate parsing at construction time).

## Failure Modes

- No `scope` and no `rate` set → `ImproperlyConfigured`
- Scope not in `THROTTLE_RATES` → `ImproperlyConfigured`
