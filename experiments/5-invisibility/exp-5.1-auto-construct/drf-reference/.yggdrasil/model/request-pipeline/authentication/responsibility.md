# Authentication

The authentication module is responsible for:

- Defining the `BaseAuthentication` contract that all authenticators must implement
- Providing built-in authenticator implementations: `BasicAuthentication`, `SessionAuthentication`, `TokenAuthentication`, `RemoteUserAuthentication`
- Extracting credentials from HTTP headers (Authorization header parsing)
- CSRF enforcement for session-based authentication only

## Not responsible for

- Deciding when authentication runs (that is APIView's `perform_authentication` and Request's lazy `user` property)
- Managing user sessions or tokens (that is Django's auth framework and DRF's authtoken app)
- Authorization (checking what the authenticated user can do — that is the permissions module)
