# Auth Pages

Landing page, login form, and registration form — the unauthenticated entry points to the application.

## Responsible for

- Landing page: marketing CTA directing to register/login
- Login form: email/password fields, client-side validation, error display, calls AuthContext.login()
- Register form: email/password/confirm fields, password match validation, calls AuthContext.register()
- Redirecting to /dashboard on successful authentication

## Not responsible for

- Token management (delegated to AuthContext in web parent)
- Password reset (not implemented)
