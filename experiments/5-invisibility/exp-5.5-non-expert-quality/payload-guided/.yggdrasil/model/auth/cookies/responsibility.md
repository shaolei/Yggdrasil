# Cookies

## Responsibility

Generates auth cookies with proper security attributes (httpOnly, secure, sameSite, domain, path, expiration). Provides both string and object cookie formats. Also parses cookies from request headers.

## Key Behaviors

- `generatePayloadCookie`: creates a cookie with the auth token, named `{cookiePrefix}-token`
- `generateExpiredPayloadCookie`: creates an expired cookie (for logout)
- Cookie is always httpOnly and path `/`
- `sameSite` can be string ('Lax', 'None', 'Strict') or boolean (true = 'Strict')
- If `sameSite` is 'None', `secure` is forced to true
- `parseCookies`: MIT-licensed implementation from Vercel edge-runtime
