# RateLimitConfig -- Responsibility

Provides static rate limit configuration and endpoint group resolution. Acts as the single source of truth for rate limit parameters — no other node defines or overrides limits.

## In scope

- Definition of endpoint groups with their rate limits and window sizes
- Resolution of route paths to endpoint groups via prefix matching
- Providing limit and window size for a given endpoint group
- Exporting type definitions for rate limit configuration

## Out of scope

- Dynamic configuration (no hot-reload, no database-backed config)
- Rate limit enforcement or checking (that is the service's job)
- Redis key format or storage concerns
- Authentication or request context
