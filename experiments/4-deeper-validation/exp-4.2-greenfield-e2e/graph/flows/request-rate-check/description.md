# Request Rate Check

## Business context

The backend API must protect itself from abuse and ensure fair usage across users. Every authenticated API request is checked against per-user, per-endpoint-group rate limits before reaching business logic. Rate limits are enforced using a sliding window algorithm backed by Redis, with graceful degradation when Redis is unavailable.

## Trigger

An authenticated HTTP request arrives at a route protected by the `@UseGuards(RateLimitGuard)` decorator.

## Goal

Allow requests within the configured rate limit, reject requests that exceed the limit with clear feedback (429 status, rate limit headers), and never block legitimate traffic due to rate-limiting infrastructure failure.

## Participants

- **rate-limiter/rate-limit-guard** -- NestJS CanActivate guard. Entry point for the flow. Extracts userId from the request context, resolves the endpoint group via config, delegates the rate check to the service, and controls the HTTP response (headers and 429 rejection).
- **rate-limiter/rate-limit-service** -- Core rate limiting logic. Performs the sliding window check against Redis, manages counters, and reports remaining quota.
- **rate-limiter/rate-limit-config** -- Configuration provider. Maps route paths to endpoint groups and provides the rate limit and window size for each group.

## Paths

### Happy path: request allowed

1. Guard extracts userId from request (e.g., from JWT payload on `request.user`)
2. Guard resolves route path to an endpoint group via rate-limit-config (`resolveGroup(path)`)
3. Guard calls rate-limit-service `checkRateLimit(userId, group)`
4. Service computes sliding window boundaries (now - windowSize, now)
5. Service executes Redis pipeline: ZREMRANGEBYSCORE (prune expired), ZCARD (count current)
6. Count < limit: service calls `incrementCounter(userId, group)` -- adds current timestamp via ZADD, refreshes EXPIRE
7. Service returns `{ allowed: true, remaining: limit - count - 1, resetMs: windowEnd }`
8. Guard sets response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
9. Guard returns `true` (CanActivate allows the request through)

### Rejection path: rate limit exceeded

1. Steps 1-5 same as happy path
2. Count >= limit: service returns `{ allowed: false, remaining: 0, resetMs: timestamp of oldest entry + windowSize }`
3. Guard sets rate limit headers on the response
4. Guard throws `HttpException(429, 'Too Many Requests')` with body including `retryAfter` in seconds
5. NestJS exception layer returns 429 response to client

### Degraded path: Redis unavailable

1. Steps 1-3 same as happy path
2. Service attempts Redis pipeline, catches connection/command error
3. Service logs structured warning: `{ level: 'warn', message: 'Rate limit check skipped — Redis unavailable', userId, endpointGroup, error, tag: 'rate-limit-degraded' }`
4. Service increments metric `rate_limit.redis_unavailable` with dimension `endpointGroup`
5. Service returns `{ allowed: true, remaining: -1, resetMs: 0 }` (remaining = -1 signals degraded mode)
6. Guard sees allowed = true, sets headers (with remaining = -1 or omits remaining header in degraded mode)
7. Guard returns `true` — request proceeds

## Invariants across all paths

- Every request that passes through the guard gets rate limit response headers (X-RateLimit-Limit at minimum)
- The userId is never undefined — the guard assumes authentication has already occurred (guard ordering: AuthGuard before RateLimitGuard)
- Rate limit state is per-user, per-endpoint-group — never global or per-IP
- The sliding window check and counter increment are near-atomic (Redis pipeline) but not fully transactional — at most one extra request may slip through under high concurrency, which is acceptable
- Redis key TTL equals the window size, ensuring automatic cleanup of inactive user data
- The guard never modifies the request — it only reads from it and sets response headers
