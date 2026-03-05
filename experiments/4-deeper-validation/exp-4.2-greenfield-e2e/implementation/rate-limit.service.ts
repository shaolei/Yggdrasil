import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { RateLimitConfig, EndpointGroupConfig } from './rate-limit-config';

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request should proceed */
  allowed: boolean;
  /** Remaining requests in the current window (-1 if degraded mode) */
  remaining: number;
  /** Unix timestamp in ms when the window resets (0 if degraded mode) */
  resetMs: number;
  /** The configured limit for this endpoint group */
  limit: number;
}

/**
 * Minimal interface for the metrics service dependency.
 * The actual implementation is provided by the application's metrics infrastructure.
 */
export interface MetricsService {
  increment(metric: string, dimensions: Record<string, string>): void;
}

/**
 * Core rate limiting logic using the sliding window log algorithm.
 *
 * Executes rate limit checks against Redis, manages per-user per-endpoint-group
 * counters, and reports quota status. This service owns all Redis interactions
 * for rate limiting and encapsulates the algorithm — no other component touches
 * Redis rate limit keys.
 *
 * Graceful degradation: when Redis is unavailable, all methods fail-open
 * (allow requests, log warning, emit metric) rather than rejecting traffic.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly rateLimitConfig: RateLimitConfig,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Performs the sliding window log rate limit check for the given user
   * and endpoint group.
   *
   * Algorithm:
   * 1. Retrieves config for the group
   * 2. Computes Redis key: rate:{userId}:{group}
   * 3. Executes pipeline: ZREMRANGEBYSCORE (prune expired), ZCARD (count current)
   * 4. Returns allow/reject decision with remaining quota info
   *
   * Never throws. Redis errors result in graceful degradation (fail-open).
   */
  async checkRateLimit(userId: string, group: string): Promise<RateLimitResult> {
    const config = this.rateLimitConfig.getConfig(group);
    const key = `rate:${userId}:${group}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);
      const results = await pipeline.exec();

      // results is an array of [error, result] tuples
      // results[0] = ZREMRANGEBYSCORE result
      // results[1] = ZCARD result
      if (!results) {
        throw new Error('Pipeline returned null');
      }

      const zcardError = results[1][0];
      if (zcardError) {
        throw zcardError;
      }

      const count = results[1][1] as number;

      if (count >= config.limit) {
        // Rate limit exceeded — compute resetMs from oldest entry
        let resetMs = now + config.windowMs;
        try {
          const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
          if (oldest && oldest.length >= 2) {
            resetMs = parseInt(oldest[1], 10) + config.windowMs;
          }
        } catch {
          // If we can't get the oldest entry, use now + windowMs as fallback
        }

        return {
          allowed: false,
          remaining: 0,
          limit: config.limit,
          resetMs,
        };
      }

      return {
        allowed: true,
        remaining: config.limit - count - 1,
        limit: config.limit,
        resetMs: now + config.windowMs,
      };
    } catch (error) {
      this.logger.warn({
        message: 'Rate limit check skipped — Redis unavailable',
        userId,
        endpointGroup: group,
        error: (error as Error).message,
        tag: 'rate-limit-degraded',
      });
      this.metricsService.increment('rate_limit.redis_unavailable', {
        endpointGroup: group,
      });
      return {
        allowed: true,
        remaining: -1,
        limit: config.limit,
        resetMs: 0,
      };
    }
  }

  /**
   * Adds the current timestamp to the user's sliding window sorted set
   * in Redis and refreshes the key TTL.
   *
   * Called by the guard after checkRateLimit returns allowed: true.
   *
   * Fire-and-forget semantics: Redis errors are caught and logged but
   * never thrown — the request was already allowed.
   */
  async incrementCounter(userId: string, group: string): Promise<void> {
    const config = this.rateLimitConfig.getConfig(group);
    const key = `rate:${userId}:${group}`;
    const now = Date.now();
    const windowSizeSeconds = Math.ceil(config.windowMs / 1000);

    try {
      const pipeline = this.redis.pipeline();
      pipeline.zadd(key, now.toString(), now.toString());
      pipeline.expire(key, windowSizeSeconds);
      await pipeline.exec();
    } catch (error) {
      this.logger.warn({
        message: 'Rate limit increment failed — Redis unavailable',
        userId,
        endpointGroup: group,
        error: (error as Error).message,
        tag: 'rate-limit-degraded',
      });
      this.metricsService.increment('rate_limit.redis_unavailable', {
        endpointGroup: group,
      });
    }
  }

  /**
   * Returns the number of remaining requests the user can make in the
   * current window for the given endpoint group.
   *
   * Used for informational/admin purposes, not for enforcement.
   * Returns -1 if Redis is unavailable.
   */
  async getRemainingQuota(userId: string, group: string): Promise<number> {
    const config = this.rateLimitConfig.getConfig(group);
    const key = `rate:${userId}:${group}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);
      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Pipeline returned null');
      }

      const zcardError = results[1][0];
      if (zcardError) {
        throw zcardError;
      }

      const count = results[1][1] as number;
      return config.limit - count;
    } catch (error) {
      this.logger.warn({
        message: 'Rate limit quota check failed — Redis unavailable',
        userId,
        endpointGroup: group,
        error: (error as Error).message,
        tag: 'rate-limit-degraded',
      });
      return -1;
    }
  }

  /**
   * Deletes all rate limit keys for the given user across all endpoint groups.
   *
   * Used for administrative purposes (e.g., customer support unblocking a user).
   * Uses SCAN (not KEYS) to avoid blocking Redis on large keysets.
   *
   * Never throws. Redis errors are caught and logged.
   */
  async resetUserLimits(userId: string): Promise<void> {
    const pattern = `rate:${userId}:*`;

    try {
      const keysToDelete: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } catch (error) {
      this.logger.warn({
        message: 'Rate limit reset failed — Redis unavailable',
        userId,
        error: (error as Error).message,
        tag: 'rate-limit-degraded',
      });
    }
  }
}
