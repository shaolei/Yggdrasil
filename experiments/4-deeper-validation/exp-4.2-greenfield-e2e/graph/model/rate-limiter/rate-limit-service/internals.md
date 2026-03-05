# RateLimitService -- Internals

## Sliding Window Log Algorithm

The service implements the sliding window log algorithm as described in the `sliding-window` aspect. The core sequence for `checkRateLimit`:

```
now = Date.now()
windowStart = now - config.windowMs
key = `rate:${userId}:${group}`

Redis pipeline:
  ZREMRANGEBYSCORE key 0 windowStart    // Remove entries outside the window
  ZCARD key                              // Count entries inside the window

count = ZCARD result
if count >= config.limit:
  return { allowed: false, remaining: 0, limit: config.limit, resetMs: <oldest_entry_timestamp> + config.windowMs }
else:
  return { allowed: true, remaining: config.limit - count - 1, limit: config.limit, resetMs: now + config.windowMs }
```

The `-1` in `remaining` calculation accounts for the request that will be recorded by the subsequent `incrementCounter` call.

## Separation of Check and Increment

The rate limit check (`checkRateLimit`) and counter increment (`incrementCounter`) are intentionally separate methods rather than a single atomic operation. This design decision was made because:

**Chose separation over atomic check-and-increment because:**
1. The guard needs the check result to decide whether to set headers or throw 429 BEFORE recording the request
2. In the rejection path, we must NOT increment — rejected requests should not count against the limit
3. A combined atomic operation would require a Lua script for conditional increment, adding operational complexity (Lua script deployment, debugging difficulty)

**Trade-off accepted:** A brief race window exists between check and increment. Two concurrent requests could both see count = limit - 1 and both be allowed. At most one extra request slips through. This is acceptable because:
- Rate limiting is inherently approximate
- The window is measured in microseconds under normal conditions
- The alternative (Lua script) adds deployment and debugging complexity disproportionate to the problem

## Redis Error Handling (Graceful Degradation)

Every Redis operation is wrapped in a try-catch. On any Redis error:

```typescript
try {
  // Redis operation
} catch (error) {
  this.logger.warn({
    message: 'Rate limit check skipped — Redis unavailable',
    userId,
    endpointGroup: group,
    error: error.message,
    tag: 'rate-limit-degraded',
  });
  // Increment metric
  this.metricsService.increment('rate_limit.redis_unavailable', { endpointGroup: group });
  return { allowed: true, remaining: -1, limit: config.limit, resetMs: 0 };
}
```

No retry logic. No circuit breaker. Each request independently attempts Redis. Recovery is automatic when Redis comes back. See `graceful-degradation` aspect for full rationale.

## resetUserLimits Implementation

Uses Redis SCAN (not KEYS) to find matching keys:

```
SCAN cursor MATCH rate:{userId}:* COUNT 100
```

SCAN is used instead of KEYS to avoid blocking Redis on large keysets. The SCAN may require multiple iterations. All found keys are deleted with a single DEL command (variadic).

## Constructor Dependencies

- `Redis` client — injected via NestJS DI (e.g., `@InjectRedis()` or custom provider)
- `RateLimitConfig` — injected for config lookups
- `Logger` — NestJS Logger for structured logging
- `MetricsService` — for counter metric emission (increment `rate_limit.redis_unavailable`)

## Decisions

### Why ZREMRANGEBYSCORE before ZCARD, not ZCOUNT with range

Chose ZREMRANGEBYSCORE + ZCARD over ZCOUNT(key, windowStart, +inf) because ZREMRANGEBYSCORE actively cleans up expired entries, preventing memory growth. ZCOUNT would leave expired entries in the set until the key TTL expires, meaning memory usage would be O(total_requests_in_TTL) rather than O(requests_in_window). For high-traffic endpoints, the difference is significant.

### Why pipeline, not Lua script

Chose Redis pipeline (MULTI/EXEC) over Lua scripting for the check operation because: pipelines are simpler to deploy, debug, and monitor; the race condition from non-atomic check+increment is acceptable (at most 1 extra request); Lua scripts require separate deployment, versioning, and complicate Redis Cluster setups. If exact precision becomes a requirement, migration to Lua is straightforward since the commands are the same.

### Why EXPIRE per operation, not EXPIREAT

Chose `EXPIRE key windowSizeSeconds` (relative) over `EXPIREAT key timestamp` (absolute) because the relative approach automatically adjusts to the most recent access time. If a user is continuously active, the key stays alive. If they stop, it expires after one window. EXPIREAT would require computing the exact expiry time, adding complexity without benefit.
