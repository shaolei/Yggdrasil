# Throttling — Interface

## BaseThrottle

### allow_request(request, view) → bool
Return True if the request should be allowed, False if throttled.

### wait() → float | None
Return recommended seconds to wait before next request. Used for Retry-After header.

### get_ident(request) → str
Identify the client. Uses X-Forwarded-For with NUM_PROXIES setting, falling back to REMOTE_ADDR.

## SimpleRateThrottle

Extends BaseThrottle with sliding-window implementation using Django's cache.

### get_cache_key(request, view) → str | None
Must be overridden. Return unique cache key, or None to skip throttling.

### Configuration
- `scope` — lookup key in `DEFAULT_THROTTLE_RATES`
- `rate` — string like "100/day", parsed to (num_requests, duration_seconds)
- `cache` — Django cache instance (defaults to `default_cache`)
- `cache_format` — `throttle_%(scope)s_%(ident)s`

## Built-in Classes

- **AnonRateThrottle** — scope "anon", throttles by IP. Returns None (skip) for authenticated users.
- **UserRateThrottle** — scope "user", throttles by user PK (or IP for anonymous).
- **ScopedRateThrottle** — throttles by `view.throttle_scope` attribute. Defers rate determination to request time.

## Failure Modes
- `ImproperlyConfigured` — missing `scope` or no rate set for scope in `DEFAULT_THROTTLE_RATES`
- Throttle denial results in `Throttled` exception with `Retry-After` header (raised by APIView)
