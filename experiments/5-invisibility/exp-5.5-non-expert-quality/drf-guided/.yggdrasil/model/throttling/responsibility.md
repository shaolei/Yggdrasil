# Throttling

Provides pluggable rate-limiting policies to control how frequently clients can make API requests.

## Responsibilities

- Defining the `BaseThrottle` interface (`allow_request`, `wait`, `get_ident`)
- Providing `SimpleRateThrottle` with sliding-window rate limiting using Django's cache backend
- Providing built-in throttle classes: AnonRateThrottle (by IP), UserRateThrottle (by user ID), ScopedRateThrottle (by view scope)
- Client identification via IP address or X-Forwarded-For header (with NUM_PROXIES configuration)
- Rate string parsing (e.g., "100/day" → 100 requests per 86400 seconds)

## NOT Responsible For

- Enforcing throttling (done by APIView's `check_throttles`)
- Cache backend management
- Authentication (relies on `request.user` for user-based throttling)
