# Graceful Degradation

When the backing store (Redis) is unavailable or returns an error, the system must not reject user requests due to rate-limiting infrastructure failure. The rate limiter exists to protect the system, not to become a single point of failure itself.

## Requirements

1. **Fail-open policy**: If Redis is unreachable (connection refused, timeout, command error), treat the rate limit check as "allowed" and let the request proceed.
2. **Warning log**: Every fail-open event must emit a structured warning log with: timestamp, userId, endpointGroup, error message, and the string `"rate-limit-degraded"` as a log tag for alerting.
3. **Metric emission**: Every fail-open event must increment a counter metric `rate_limit.redis_unavailable` with dimensions `{endpointGroup}` so that operational dashboards can detect sustained degradation.
4. **No cached fallback**: Do not attempt to serve stale rate-limit data from memory. Either Redis responds or the check is skipped entirely. Rationale: stale counters could either over-count (blocking legitimate users) or under-count (failing to protect), and both are worse than fail-open for a rate limiter.
5. **Recovery is automatic**: When Redis becomes available again, the next request resumes normal rate-limiting with no manual intervention. No circuit-breaker state machine is needed — each request independently attempts Redis.

## Why fail-open, not fail-closed

Fail-closed (reject requests when Redis is down) would mean a Redis outage causes a complete service outage — the rate limiter becomes a harder dependency than the services it protects. For a rate limiter, the cost of letting some extra requests through during a brief Redis outage is far lower than the cost of rejecting all requests. If the system needs protection during Redis outages, that should be handled at a different layer (e.g., load balancer connection limits).

Rejected alternative: circuit-breaker pattern — adds complexity (state machine, half-open probing) for minimal benefit when the degradation behavior is simply "skip the check." Each request already independently attempts Redis, so recovery is instant.
