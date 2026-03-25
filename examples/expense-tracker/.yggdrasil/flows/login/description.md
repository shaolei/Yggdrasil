# Login

## Business context

Returning users need quick, secure access to their expense data.

## Trigger

User navigates to the login page.

## Goal

User is authenticated and redirected to the dashboard.

## Participants

- **web/auth** — Login form (email, password)
- **api/auth** — Validates credentials, issues JWT
- **api/db** — Queries user + subscription for JWT payload

## Paths

### Happy path

1. User enters email and password.
2. Web submits POST /auth/login.
3. API queries user by email (JOIN subscriptions for plan), verifies password with bcrypt.compare.
4. API returns JWT with payload {sub: userId, email, plan}.
5. Web stores token, sets auth context, redirects to /dashboard.

### Invalid credentials

3a. Email not found or password mismatch.
3b. Returns 401 INVALID_CREDENTIALS.
3c. Web displays error on the form.

## Invariants

- Credential verification uses constant-time bcrypt comparison.
- JWT payload includes the subscription plan so protected routes can check limits without extra DB queries.
