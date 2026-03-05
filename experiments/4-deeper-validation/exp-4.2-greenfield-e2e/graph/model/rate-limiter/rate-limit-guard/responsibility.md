# RateLimitGuard -- Responsibility

NestJS CanActivate guard that intercepts incoming HTTP requests, performs rate limit checking via the RateLimitService, sets rate limit response headers, and rejects requests that exceed the configured limit with HTTP 429.

This guard is the ONLY entry point for rate limiting — it is the bridge between the HTTP layer and the rate limit domain logic. It owns the HTTP-specific concerns (headers, status codes, request context extraction) while delegating all rate limit logic to the service.

## In scope

- Extracting userId from the request context (`request.user.uid` or equivalent)
- Resolving the request route to an endpoint group via RateLimitConfig
- Calling RateLimitService.checkRateLimit and acting on the result
- Calling RateLimitService.incrementCounter for allowed requests
- Setting response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Throwing HttpException(429) for rejected requests with retryAfter information
- Handling degraded mode (remaining = -1): still allowing request, adjusting headers accordingly

## Out of scope

- Rate limit algorithm or Redis interaction (delegated to service)
- Configuration of limits or endpoint groups (delegated to config)
- Authentication (assumes AuthGuard has already run and populated request.user)
- Any modification to the request body or query parameters
