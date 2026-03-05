# Sliding Window Log Algorithm

## Overview

The sliding window log algorithm tracks individual request timestamps within a rolling time window. Unlike fixed-window counters (which allow burst at window boundaries) or token bucket (which requires periodic refill), sliding window provides precise, smooth rate limiting.

## Algorithm

For each rate limit check:

1. **Compute window boundaries**: `windowStart = now - windowSizeMs`, `windowEnd = now`
2. **Remove expired entries**: Delete all entries with timestamp < windowStart from the sorted set
3. **Count current entries**: Count remaining entries in the sorted set — this is the current request count within the window
4. **Decision**: If count >= limit, REJECT. Otherwise, ALLOW and add the current timestamp to the sorted set.
5. **Set TTL**: Set expiry on the sorted set key equal to the window size, so Redis automatically cleans up keys for inactive users.

## Redis Data Structure

Uses Redis sorted sets (ZSET) where:
- **Key**: `rate:{userId}:{endpointGroup}` (no windowStart in key — the sorted set contains timestamps across the rolling window)
- **Member**: The request timestamp in milliseconds (as both score and member)
- **Score**: Same as member (timestamp in ms) — enables ZRANGEBYSCORE for window queries

## Redis Commands (per check)

Executed as an atomic pipeline (MULTI/EXEC) to prevent race conditions:

```
ZREMRANGEBYSCORE key 0 windowStart     # Remove expired entries
ZCARD key                               # Count remaining
ZADD key now now                        # Add current timestamp (only if allowing)
EXPIRE key windowSizeSeconds            # Refresh TTL
```

Important: The ZADD must only execute if the request is allowed (count < limit). This requires either: (a) a Lua script for true atomicity, or (b) a two-phase approach: pipeline ZREMRANGEBYSCORE + ZCARD first, then conditionally ZADD + EXPIRE. Option (b) is acceptable because a brief race (two concurrent requests both seeing count = limit-1) results in at most one extra request — tolerable for rate limiting.

## Why sliding window log over alternatives

- **Fixed window counter**: Allows 2x burst at window boundaries (e.g., 100 requests in last second of window + 100 in first second of next). Rejected because burst protection is a primary requirement.
- **Sliding window counter** (weighted average of current + previous window): Approximation that can under-count by up to 50%. Rejected because accuracy matters for low-limit endpoints like `auth` (5 req/min).
- **Token bucket**: Requires periodic refill and more complex state. Better for smoothing bursty traffic, but our use case is strict per-window enforcement. Rejected for added complexity without benefit.
- **Leaky bucket**: Similar to token bucket but processes at fixed rate. Not appropriate because we want to allow bursts within the limit, not enforce spacing.

## Trade-offs of this choice

- **Memory**: O(n) per user per endpoint group where n = number of requests in window. For high-limit endpoints (100 req/min), this means up to 100 sorted set members per user. Acceptable for expected user counts.
- **Precision**: Exact count within the window — no approximation.
- **Performance**: O(log n) for ZADD, O(log n + k) for ZREMRANGEBYSCORE where k = expired entries. Acceptable.
