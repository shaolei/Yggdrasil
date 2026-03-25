# Auth — Interface

## Routes

### POST /auth/register

- **Body:** `{ email: string, password: string }`
- **Success:** 201 `{ token: string }`
- **Errors:** 409 `{ error: "EMAIL_TAKEN" }`, 400 validation errors

### POST /auth/login

- **Body:** `{ email: string, password: string }`
- **Success:** 200 `{ token: string }`
- **Errors:** 401 `{ error: "INVALID_CREDENTIALS" }`, 400 validation errors

## Middleware

### requireAuth (Fastify preHandler)

- Extracts `Authorization: Bearer <token>` header
- Verifies JWT, attaches `request.user = { userId, email, plan }` on success
- Returns 401 `{ error: "Unauthorized" }` on missing/invalid token

## Service Methods

### authService.register(email, password) -> { token }

### authService.login(email, password) -> { token }

### authService.verifyToken(token) -> { sub, email, plan }
