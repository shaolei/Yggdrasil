# Throttling — Responsibility

## Identity

Provides pluggable rate-limiting policies for API views. Defines the `BaseThrottle` base class, the `SimpleRateThrottle` sliding-window implementation, and three built-in throttle classes: `AnonRateThrottle`, `UserRateThrottle`, and `ScopedRateThrottle`.

## Boundaries

**Responsible for:**
- Defining the throttle interface (`allow_request`, `wait`, `get_ident`)
- Implementing sliding-window rate limiting via Django's cache framework
- Identifying clients by IP address (considering proxy headers) or user ID
- Parsing rate strings (e.g., `"100/day"`)
- Providing per-scope throttling via `ScopedRateThrottle`

**NOT responsible for:**
- Deciding when throttle checks run (controlled by APIView)
- Setting the Retry-After header (done by exception handler in views.py)
- Cache backend selection (uses Django's default cache)
- Blocking or queuing requests (only signals allow/deny)
