# Users

User profile and account management operations.

## Responsible for

- Fetching authenticated user's profile (GET /users/me)
- Password change with current password verification (bcrypt.compare + bcrypt.hash)

## Not responsible for

- User creation (handled by api/auth during registration)
- Subscription management (delegated to api/subscriptions)
