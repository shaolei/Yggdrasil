# Request — Responsibility

## Identity

The `Request` class is a wrapper around Django's `HttpRequest` that provides a richer API for REST framework views. It adds automatic content parsing based on Content-Type, lazy authentication, and transparent proxying to the underlying Django request.

## Boundaries

**Responsible for:**
- Wrapping Django's `HttpRequest` with enhanced properties (`data`, `query_params`, `user`, `auth`)
- Lazy parsing of request content via configurable parsers
- Lazy authentication via configurable authenticators (stores `_user`, `_auth`, `_authenticator`)
- Proxying attribute access to the underlying `HttpRequest` for Django compatibility
- Supporting forced authentication for testing (`ForcedAuthentication`)
- Cloning requests with a different HTTP method (`clone_request`) for permission checking

**NOT responsible for:**
- Implementing specific parsers (delegated to parser classes)
- Implementing specific authentication schemes (delegated to authenticator classes)
- Content negotiation (uses negotiator passed from the view)
- Response handling
