# APIView — Responsibility

## Identity

`APIView` is the base class for all views in Django REST Framework. It extends Django's `View` class and serves as the orchestrator for the entire request processing pipeline: initializing the enhanced request, running the policy pipeline (authentication, permissions, throttling), dispatching to handler methods, handling exceptions, and finalizing responses.

The module also provides standalone utility functions: `exception_handler` (default exception handling), `get_view_name`/`get_view_description` (for the browsable API and OPTIONS responses), and `set_rollback` (transaction rollback on error).

## Boundaries

**Responsible for:**
- Orchestrating the request lifecycle (dispatch → initialize → initial → handler → finalize)
- Instantiating policy classes per-request via `get_*()` methods
- Running policy checks in the correct order (auth → permissions → throttles)
- Exception handling and mapping Django exceptions to DRF exceptions
- Content negotiation coordination
- API versioning determination
- CSRF exemption of all views
- Providing the OPTIONS handler via metadata class

**NOT responsible for:**
- Implementing specific authentication schemes (delegated to authentication classes)
- Implementing specific permission logic (delegated to permission classes)
- Implementing specific throttle algorithms (delegated to throttle classes)
- Request parsing (delegated to Request and parser classes)
- Response rendering (delegated to Response and renderer classes)
- URL routing (handled by Django and DRF routers)
