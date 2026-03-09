# Request

The `Request` class wraps Django's `HttpRequest` to provide:

- Lazy authentication: `request.user` and `request.auth` trigger authentication on first access
- Unified data access: `request.data` provides parsed request body regardless of content type (replacing Django's split between `request.POST` and `request.body`)
- Transparent proxy: attributes not found on `Request` are proxied to the underlying `HttpRequest`
- Forced authentication support for testing via `ForcedAuthentication`

## Not responsible for

- Deciding which authenticators, parsers, or negotiator to use (those are injected by APIView)
- Permission checking or throttle enforcement (those are APIView's concern)
- Rendering responses
