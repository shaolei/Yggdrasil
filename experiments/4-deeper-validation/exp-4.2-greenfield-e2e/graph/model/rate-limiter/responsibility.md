# Rate Limiter

Provides per-user, per-endpoint-group API rate limiting for the NestJS backend. Enforces configurable request quotas using a sliding window log algorithm backed by Redis, with graceful degradation when Redis is unavailable.

## In scope

- Rate limit enforcement via NestJS guard (CanActivate)
- Sliding window log algorithm for precise rate counting
- Redis-backed counters with automatic key expiry
- Configurable rate limits per endpoint group (auth, api, upload, default)
- Rate limit response headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- 429 Too Many Requests rejection when limit exceeded
- Fail-open behavior when Redis is unavailable
- Per-user rate limit reset capability

## Out of scope

- Authentication and user identity extraction (assumes AuthGuard runs first)
- IP-based rate limiting (all limits are per authenticated user)
- Global rate limiting (no aggregate cross-user limits)
- Rate limit storage other than Redis (no in-memory fallback, no database)
- Rate limit dashboards or admin UI
- Dynamic rate limit configuration (limits are static per deployment)
