# CSRF Session Enforcement

## What

DRF applies `csrf_exempt` to all views in `APIView.as_view()`. This is because most authentication methods (token, basic, OAuth) don't use cookies and don't need CSRF protection.

However, `SessionAuthentication` explicitly enforces CSRF by calling `enforce_csrf()` using Django's `CsrfViewMiddleware` internally (via `CSRFCheck` subclass).

## Why

Code comment in `as_view()`: "Note: session based authentication is explicitly CSRF validated, all other authentication is CSRF exempt."

Code comment in `as_view()`: "Note: Views are made CSRF exempt from within `as_view` as to prevent accidental removal of this exemption in cases where `dispatch` needs to be overridden."

Commit `3c8f01b9`: "Explicit CSRF failure message. Fixes #60." — indicates that the original CSRF handling was producing unclear errors.

Commit `fc0be55d`: "Alter CSRF exemption implementation" — the CSRF exemption was moved to `as_view()` rather than `dispatch()` to prevent accidental removal during dispatch overrides.

For Django 5.1+, `view.login_required = False` is set to exempt DRF views from Django's `LoginRequiredMiddleware`. Comment: "Users should set DEFAULT_PERMISSION_CLASSES to 'rest_framework.permissions.IsAuthenticated' instead."

## Constraints

- `CSRFCheck._reject()` returns the failure reason string instead of an HttpResponse, so it can be used to raise a `PermissionDenied` exception with a descriptive message.
- CSRF is only enforced for authenticated sessions — unauthenticated requests skip both authentication and CSRF.
