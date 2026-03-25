# Sign Up

## Business context

User onboarding is the entry point to the product. A frictionless sign-up with immediate access to the dashboard reduces drop-off.

## Trigger

User visits the landing page and clicks "Get started."

## Goal

User has an account with a free subscription and sees the dashboard.

## Participants

- **web/auth** — Registration form (email, password, confirm)
- **api/auth** — Validates input, creates user + free subscription, issues JWT
- **api/db** — Persists user and subscription rows

## Paths

### Happy path

1. User fills the registration form with email, password, and confirmation.
2. Web submits POST /auth/register with validated fields.
3. API checks email uniqueness, hashes password (bcrypt, 10 rounds), inserts user row.
4. API auto-creates a free subscription (plan=free, status=active).
5. API returns a JWT (7-day expiry, payload: userId, email, plan).
6. Web stores token in localStorage, parses payload, sets auth context.
7. User is redirected to /dashboard.

### Email already taken

2a. API finds existing user with same email.
2b. Returns 409 EMAIL_TAKEN.
2c. Web displays error message on the form.

## Invariants

- Every new user gets exactly one subscription row (free plan).
- Password is never stored in plaintext — always bcrypt hashed.
- JWT is the only session mechanism (no server-side sessions).
