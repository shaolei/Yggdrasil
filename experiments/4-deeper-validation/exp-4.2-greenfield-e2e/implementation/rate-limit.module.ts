import { Module } from '@nestjs/common';
import { RateLimitConfig } from './rate-limit-config';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * NestJS module that provides rate limiting functionality.
 *
 * Exports RateLimitGuard for use with @UseGuards() in controllers,
 * and RateLimitService for administrative operations (resetUserLimits,
 * getRemainingQuota).
 *
 * Requires:
 * - A Redis module to be imported in the parent module (provides Redis client)
 * - A MetricsService provider to be available in the DI container
 */
@Module({
  providers: [RateLimitConfig, RateLimitService, RateLimitGuard],
  exports: [RateLimitGuard, RateLimitService],
})
export class RateLimitModule {}
