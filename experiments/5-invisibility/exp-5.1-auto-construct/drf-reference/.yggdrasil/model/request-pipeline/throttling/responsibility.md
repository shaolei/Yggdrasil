# Throttling

The throttling module is responsible for:

- Defining the `BaseThrottle` contract for rate limiting
- Providing cache-backed sliding window rate limiting via `SimpleRateThrottle`
- Identifying clients by IP address (with proxy-aware X-Forwarded-For parsing)
- Providing built-in throttle classes: `AnonRateThrottle`, `UserRateThrottle`, `ScopedRateThrottle`
- Calculating wait times for `Retry-After` headers

## Not responsible for

- Deciding when throttling is checked (that is APIView's `check_throttles`)
- Managing the cache backend (that is Django's cache framework)
- Raising the HTTP response (returns True/False; APIView translates to exceptions)
