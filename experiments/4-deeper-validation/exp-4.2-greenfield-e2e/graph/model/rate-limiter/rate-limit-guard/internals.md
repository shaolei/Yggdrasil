# RateLimitGuard -- Internals

## Request Processing Flow

```
canActivate(context)
  │
  ├── Extract request, response from ExecutionContext
  ├── Read userId = request.user.uid
  ├── Read path = request.route?.path || request.url
  │
  ├── config = rateLimitConfig.resolveGroup(path)
  ├── result = await rateLimitService.checkRateLimit(userId, config.name)
  │
  ├── Set headers on response:
  │     X-RateLimit-Limit: result.limit
  │     X-RateLimit-Remaining: Math.max(0, result.remaining)  [skip if remaining === -1]
  │     X-RateLimit-Reset: Math.ceil(result.resetMs / 1000)   [skip if resetMs === 0]
  │
  ├── If result.allowed:
  │     await rateLimitService.incrementCounter(userId, config.name)
  │     return true
  │
  └── If !result.allowed:
        retryAfter = Math.ceil((result.resetMs - Date.now()) / 1000)
        throw new HttpException(
          { statusCode: 429, message: 'Too Many Requests', retryAfter },
          HttpStatus.TOO_MANY_REQUESTS
        )
```

## Degraded Mode Handling

When the service returns `remaining === -1` (Redis unavailable), the guard:
- Still returns `true` (allows the request per graceful-degradation aspect)
- Sets `X-RateLimit-Limit` header (always available from config)
- Omits `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers (no meaningful values)
- Does NOT call `incrementCounter` (Redis is down, so incrementing would also fail — avoids redundant error logging)

## Constructor Dependencies

- `RateLimitService` — injected via NestJS DI
- `RateLimitConfig` — injected via NestJS DI

## Decisions

### Why incrementCounter is called after check, not atomically

See RateLimitService internals for the full rationale. From the guard's perspective: the guard needs the check result before deciding to increment. The guard does NOT increment for rejected requests — only allowed ones. Calling increment after check is the natural flow.

### Why the guard reads route path, not a custom decorator

Chose path-based group resolution over a custom decorator (e.g., `@RateLimit('auth')`) because: path-based resolution requires zero changes to existing controllers — just add the guard. A decorator approach would require annotating every route or controller. The trade-off: path-based resolution is less explicit and depends on URL structure, but since endpoint groups map to well-defined URL prefixes (`/auth/`, `/api/`, `/upload/`), the implicit mapping is clear and maintainable.

Rejected alternative: Reflector-based metadata (NestJS `@SetMetadata`) — would allow per-route overrides but adds boilerplate to every controller and fragments the rate limit configuration across the codebase instead of centralizing it in RateLimitConfig.

### Why retryAfter is in seconds, not milliseconds

The `Retry-After` HTTP header (RFC 7231) specifies seconds. Following the standard even though internal timestamps are millisecond-based. Conversion: `Math.ceil((resetMs - now) / 1000)`.
