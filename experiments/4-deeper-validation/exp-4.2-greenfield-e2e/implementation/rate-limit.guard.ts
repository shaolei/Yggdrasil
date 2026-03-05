import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitConfig } from './rate-limit-config';

/**
 * NestJS CanActivate guard that intercepts incoming HTTP requests,
 * performs rate limit checking via the RateLimitService, sets rate limit
 * response headers, and rejects requests that exceed the configured
 * limit with HTTP 429.
 *
 * This guard is the ONLY entry point for rate limiting — it bridges the
 * HTTP layer and the rate limit domain logic. It owns HTTP-specific
 * concerns (headers, status codes, request context extraction) while
 * delegating all rate limit logic to the service.
 *
 * Usage:
 * ```typescript
 * @Controller('api')
 * @UseGuards(AuthGuard, RateLimitGuard)
 * export class ApiController { ... }
 * ```
 *
 * Guard ordering: AuthGuard must run before RateLimitGuard because this
 * guard requires `request.user` to be populated.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly rateLimitConfig: RateLimitConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract userId from the authenticated request context
    const userId: string = request.user.uid;

    // Resolve the route path to an endpoint group
    const path: string = request.route?.path || request.url;
    const groupConfig = this.rateLimitConfig.resolveGroup(path);

    // Perform the rate limit check
    const result = await this.rateLimitService.checkRateLimit(
      userId,
      groupConfig.name,
    );

    // Always set the X-RateLimit-Limit header
    response.setHeader('X-RateLimit-Limit', result.limit);

    // Check for degraded mode (remaining === -1 means Redis was unavailable)
    const isDegraded = result.remaining === -1;

    if (!isDegraded) {
      // Normal mode: set Remaining and Reset headers
      response.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, result.remaining),
      );
      response.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(result.resetMs / 1000),
      );
    }
    // In degraded mode: omit X-RateLimit-Remaining and X-RateLimit-Reset
    // (no meaningful values available)

    if (result.allowed) {
      // Only increment the counter if not in degraded mode
      // (Redis is down, so incrementing would also fail — avoids redundant error logging)
      if (!isDegraded) {
        await this.rateLimitService.incrementCounter(userId, groupConfig.name);
      }
      return true;
    }

    // Rate limit exceeded — throw 429 with retryAfter
    const retryAfter = Math.ceil((result.resetMs - Date.now()) / 1000);

    throw new HttpException(
      {
        statusCode: 429,
        message: 'Too Many Requests',
        retryAfter: Math.max(1, retryAfter), // Ensure at least 1 second
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
