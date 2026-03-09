# Auth Strategies Internals

## Strategy Pipeline Behavior

- Strategies are tried in order from `payload.authStrategies` array
- First strategy returning a non-null user wins
- Errors are caught and logged, not propagated — the pipeline continues
- Response headers are merged across all strategies (even failing ones)
- The `strategyName` from config is passed to each strategy so the user object gets tagged with `_strategy`

## JWT Strategy Autologin

If no JWT is found and the `DisableAutologin` header is not set, the JWT strategy falls back to `autoLogin`. This looks up a user by `payload.config.admin.autoLogin.email` or `username`. It's a development convenience — not for production. If `prefillOnly` is set, autoLogin is disabled.

## API Key Backward Compatibility

API keys stored before v3.46.0 used SHA-1 HMAC for `apiKeyIndex`. Current code generates both SHA-1 and SHA-256 hashes and queries with `OR`. Marked as TODO for removal in v4.

## Decisions

- **Chose `timingSafeEqual` for password comparison** over simple `===` because timing attacks could reveal password hash information through response time differences.

- **Chose to operate incrementLoginAttempts outside transaction** over using the request transaction because parallel login attempts need to see each other's increments immediately. Transaction isolation would hide concurrent increments, breaking the brute force counter.

- **Chose 20-second session purge window** over other durations — rationale: unknown. Appears to be a heuristic judgment. Long enough for parallel HTTP requests to complete, short enough to not affect legitimate sessions.
