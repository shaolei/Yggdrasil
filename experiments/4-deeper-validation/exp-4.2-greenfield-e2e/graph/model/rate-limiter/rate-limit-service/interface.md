# RateLimitService -- Interface

## Types

```typescript
interface RateLimitResult {
  allowed: boolean;      // Whether the request should proceed
  remaining: number;     // Remaining requests in the current window (-1 if degraded mode)
  resetMs: number;       // Unix timestamp in ms when the window resets (0 if degraded mode)
  limit: number;         // The configured limit for this endpoint group
}
```

## Methods

### `checkRateLimit(userId: string, group: string): Promise<RateLimitResult>`

Performs the sliding window log rate limit check for the given user and endpoint group. This is the primary entry point for rate limiting.

1. Retrieves the config for the group via `RateLimitConfig.getConfig(group)`
2. Computes the Redis key: `rate:{userId}:{group}`
3. Executes Redis pipeline: `ZREMRANGEBYSCORE key 0 (now - windowMs)`, then `ZCARD key`
4. If count < limit: returns `{ allowed: true, remaining: limit - count - 1, limit, resetMs: now + windowMs }`
5. If count >= limit: returns `{ allowed: false, remaining: 0, limit, resetMs }` where resetMs = timestamp of oldest entry in the set + windowMs
6. On Redis error: logs warning, emits metric, returns `{ allowed: true, remaining: -1, limit, resetMs: 0 }`

- **Parameters**:
  - `userId` -- the authenticated user's unique identifier
  - `group` -- endpoint group name (as resolved by RateLimitConfig)
- **Returns**: `Promise<RateLimitResult>`
- **Throws**: Never. Redis errors are caught and result in graceful degradation (fail-open).

### `incrementCounter(userId: string, group: string): Promise<void>`

Adds the current timestamp to the user's sliding window sorted set in Redis and refreshes the key TTL. Called by the guard after `checkRateLimit` returns `allowed: true`.

1. Computes the Redis key: `rate:{userId}:{group}`
2. Executes Redis pipeline: `ZADD key now now`, `EXPIRE key windowSizeSeconds`
3. On Redis error: logs warning, does not throw (fire-and-forget semantics — the request was already allowed)

- **Parameters**:
  - `userId` -- the authenticated user's unique identifier
  - `group` -- endpoint group name
- **Returns**: `Promise<void>`
- **Throws**: Never. Redis errors are caught and logged.

Note on atomicity: `checkRateLimit` and `incrementCounter` are separate calls. This means a brief race condition exists where two concurrent requests could both pass the check before either increments. This is acceptable — at most one extra request may slip through, and rate limiting is approximate by nature.

### `getRemainingQuota(userId: string, group: string): Promise<number>`

Returns the number of remaining requests the user can make in the current window for the given endpoint group. Used for informational/admin purposes, not for enforcement.

1. Retrieves config, computes key
2. Prunes expired entries (`ZREMRANGEBYSCORE`), counts remaining (`ZCARD`)
3. Returns `limit - count`
4. On Redis error: returns `-1`

- **Parameters**:
  - `userId` -- the authenticated user's unique identifier
  - `group` -- endpoint group name
- **Returns**: `Promise<number>` -- remaining quota, or -1 if Redis unavailable

### `resetUserLimits(userId: string): Promise<void>`

Deletes all rate limit keys for the given user across all endpoint groups. Used for administrative purposes (e.g., customer support unblocking a user).

1. Scans Redis for keys matching `rate:{userId}:*` pattern
2. Deletes all matched keys via `DEL`
3. On Redis error: logs warning, does not throw

- **Parameters**:
  - `userId` -- the authenticated user's unique identifier
- **Returns**: `Promise<void>`
- **Throws**: Never. Redis errors are caught and logged.

## Redis Key Format

- Pattern: `rate:{userId}:{endpointGroup}`
- Example: `rate:user-123:api`
- TTL: Equal to the window size for the endpoint group (60 seconds for all current groups)
- Value type: Sorted set (ZSET) where both score and member are the request timestamp in milliseconds
