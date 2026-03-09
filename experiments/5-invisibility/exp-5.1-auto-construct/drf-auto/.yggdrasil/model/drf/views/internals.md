# APIView — Internals

## Logic

### Dispatch Flow
`dispatch()` sets `self.args`, `self.kwargs`, initializes the request, stores default response headers, then enters a try block. Inside the try: `initial()` runs the pipeline, then the handler is resolved by matching `request.method.lower()` to a method attribute. On any exception, `handle_exception()` produces an error response. Finally, `finalize_response()` is always called.

### 401 vs 403 Decision
`handle_exception()` distinguishes between 401 and 403:
- If the exception is `NotAuthenticated` or `AuthenticationFailed`, and the first authenticator provides an `authenticate_header`, the response is 401 with WWW-Authenticate.
- Otherwise, the status is coerced to 403.

`permission_denied()` makes a related decision: if authenticators exist but none succeeded, it raises `NotAuthenticated` (401) instead of `PermissionDenied` (403). This prevents exposing the existence of resources to unauthenticated users.

From commit `873a142a`: "Implementing 401 vs 403 responses" and `870f1048`: "Fix incorrect 401 vs 403 response, if lazy authentication has not taken place."

### Exception Handler
The default `exception_handler` converts Django's `Http404` and `PermissionDenied` to their DRF equivalents (preserving exception messages per commit `56946fac` #8051), then handles all `APIException` subclasses uniformly. Unhandled exceptions return `None`, causing re-raise.

Commit `c2ee1b30`: "Use overridden settings exception handler. Instead of using the api_settings exception handler, we use the overridden settings attribute to find the correct handler. Closes #5054." Per-view custom exception handlers were added in commit `ebe174c0` (#4753).

## Decisions

- **CSRF exemption in `as_view()` not `dispatch()`**: Code comment explains: "to prevent accidental removal of this exemption in cases where `dispatch` needs to be overridden." Moved in commit `fc0be55d`.
- **Content negotiator is cached** (`_negotiator`): Unlike other policy objects, which are instantiated fresh per-request. Rationale: unknown — inferred from code.
- **Queryset evaluation guard**: Commit `bdeb2894`: "Use RuntimeError, not AssertionError when guarding against direct View.queryset evaluation. Refs #3180." Changed from AssertionError to RuntimeError to make it clearer this is a programming error, not a debug assertion.
- **Vary header patching** (commit `9ebd5a29`): "Previously, any existing vary headers would simply be wiped out by DRF. Using patch_vary_headers assures that existing headers remain."
- **Reorder of `initial()` pipeline** (commit `03270431`): "Determining the version and performing content negotiation should be done before ensuring the permission of the request. The reason is that these information might be needed for the permission." — versioning and content negotiation were moved before authentication/permissions.
- **set_rollback for atomic transactions** (commit `c2d24172`): "Tell default error handler to doom the transaction on error" — ensures database changes within a failed request's atomic block are rolled back. Multi-database support added in commit `de7468d0` (#7739).
