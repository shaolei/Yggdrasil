# RateLimitGuard -- Interface

## Guard Contract (NestJS CanActivate)

```typescript
@Injectable()
class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): Promise<boolean>;
}
```

### `canActivate(context: ExecutionContext): Promise<boolean>`

Called by the NestJS framework for every request on routes decorated with `@UseGuards(RateLimitGuard)`.

**Flow:**
1. Extracts the HTTP request from the execution context via `context.switchToHttp().getRequest()`
2. Reads `userId` from `request.user.uid` (populated by a preceding AuthGuard)
3. Reads the route path from `request.route.path` or `request.url`
4. Calls `rateLimitConfig.resolveGroup(path)` to get the endpoint group config
5. Calls `rateLimitService.checkRateLimit(userId, group.name)` to get the rate limit result
6. Sets response headers on `context.switchToHttp().getResponse()`:
   - `X-RateLimit-Limit`: the configured limit for this group
   - `X-RateLimit-Remaining`: remaining requests (omitted or set to 0 in degraded mode)
   - `X-RateLimit-Reset`: Unix timestamp in seconds when the window resets
7. If `result.allowed === true`: calls `rateLimitService.incrementCounter(userId, group.name)`, returns `true`
8. If `result.allowed === false`: throws `HttpException` with status 429 and body:
   ```json
   {
     "statusCode": 429,
     "message": "Too Many Requests",
     "retryAfter": <seconds until reset>
   }
   ```

**Returns**: `true` if the request is allowed to proceed
**Throws**: `HttpException(429)` if the rate limit is exceeded

## Response Headers Set

| Header                  | Value                              | Always present |
|-------------------------|------------------------------------|----------------|
| `X-RateLimit-Limit`    | Configured limit for the group     | Yes            |
| `X-RateLimit-Remaining`| Remaining requests in window       | Yes (0 if exceeded, omitted if degraded) |
| `X-RateLimit-Reset`    | Window reset time (Unix seconds)   | Yes (omitted if degraded) |

## Usage

```typescript
@Controller('api')
@UseGuards(AuthGuard, RateLimitGuard)
export class ApiController {
  // All routes in this controller are rate-limited
}
```

Guard ordering matters: `AuthGuard` must run before `RateLimitGuard` because the rate limit guard requires `request.user` to be populated.
