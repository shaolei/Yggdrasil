# APIView

Base class for all views in Django REST Framework. Extends Django's `View` to add a security and content pipeline around HTTP method dispatch.

## Responsibilities

- Wrapping incoming Django HttpRequest into DRF Request via `initialize_request()`
- Running the pre-handler pipeline in `initial()`: content negotiation, versioning, authentication, permission checks, throttle checks — in that fixed order
- Dispatching to the appropriate HTTP method handler (`get`, `post`, etc.)
- Catching exceptions via `handle_exception()` and converting them to API responses
- Finalizing responses with renderer and header setup via `finalize_response()`
- Providing policy instantiation methods (`get_authenticators`, `get_permissions`, `get_throttles`, etc.) that read from class-level attributes defaulting to global settings
- CSRF exemption for all DRF views (applied in `as_view()`)

## NOT Responsible For

- The actual authentication, permission, or throttling logic (delegated to policy classes)
- Request body parsing (delegated to Request and parser classes)
- Rendering responses (delegated to renderer classes)
- Business logic in handler methods (implemented by subclasses)
