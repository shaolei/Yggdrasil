# Requires Authentication

## What

All API routes (except /health, /auth/register, /auth/login) must be protected by the `requireAuth` middleware. All web pages (except Landing, Login, Register) must be wrapped in `ProtectedRoute`.

## Why

User data is isolated per account. Every request must identify the user via JWT so the service layer can scope queries to the correct user_id. Unauthenticated access would expose or corrupt other users' data.

## How

- **API:** Fastify `preHandler` hook calls `requireAuth`, which extracts the Bearer token from the Authorization header, verifies it with `jsonwebtoken`, and attaches `{userId, email, plan}` to `request.user`. Returns 401 if missing or invalid.
- **Web:** `ProtectedRoute` component checks for a token in localStorage and loads user state on mount. Redirects to `/login` if no token. The API client auto-clears token and redirects on 401 responses.
