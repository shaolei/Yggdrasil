# RateLimitService -- Responsibility

Core rate limiting logic. Executes the sliding window log algorithm against Redis, manages per-user per-endpoint-group counters, and reports quota status. This service owns all Redis interactions for rate limiting and encapsulates the algorithm — no other node touches Redis rate limit keys.

## In scope

- Sliding window log rate limit check (prune expired, count current, decide allow/reject)
- Counter increment for allowed requests (ZADD timestamp to sorted set)
- Remaining quota calculation
- Per-user rate limit reset (delete all keys for a user)
- Redis key format and TTL management
- Graceful degradation when Redis is unavailable (fail-open with warning log and metric)

## Out of scope

- HTTP request/response handling (that is the guard's job)
- Endpoint group resolution or configuration (delegated to RateLimitConfig)
- Setting response headers (guard's responsibility)
- Authentication or user identity extraction
