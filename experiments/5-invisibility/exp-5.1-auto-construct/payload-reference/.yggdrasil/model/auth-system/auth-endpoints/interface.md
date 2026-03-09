# Auth Endpoints — Interface

All handlers conform to `PayloadHandler = (req: PayloadRequest) => Promise<Response>`.

## loginHandler

`POST /<collection>/login`

**Request body:** `{ email?: string; username?: string; password: string }`
**Query params:** `depth` (optional number)
**Response:** `{ message, exp, token?, user }` with `Set-Cookie` header
**Status:** 200 OK

If `removeTokenFromResponses` is configured, `token` is omitted from JSON body but still set in cookie.

## logoutHandler

`POST /<collection>/logout`

**Response:** `{ message }` with expired `Set-Cookie` header
**Status:** 200 OK

Supports `allSessions` in request data to revoke all sessions.

## refreshHandler

`POST /<collection>/refresh-token`

**Response:** `{ message, exp, refreshedToken?, user }` with updated `Set-Cookie` header
**Status:** 200 OK

## forgotPasswordHandler

`POST /<collection>/forgot-password`

**Request body:** `{ email?: string; username?: string }`
**Response:** `{ message }` — always returns success message regardless of whether user exists
**Status:** 200 OK

## resetPasswordHandler

`POST /<collection>/reset-password`

**Request body:** `{ token: string; password: string }`
**Response:** `{ message, token?, user }` with `Set-Cookie` header
**Status:** 200 OK

## accessHandler

`GET /access`

**Response:** `SanitizedPermissions` — full permission map for current user
**Status:** 200 OK

## Other Endpoints

- `GET /<collection>/init` — returns `{ initialized: boolean }` (whether any users exist)
- `GET /<collection>/me` — returns current user or null
- `POST /<collection>/first-register` — creates first user with admin privileges
- `POST /<collection>/unlock` — unlocks a locked account (requires unlock permission)
- `POST /<collection>/verify/:id` — verifies email with token
