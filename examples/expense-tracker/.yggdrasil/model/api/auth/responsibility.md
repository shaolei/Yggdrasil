# Auth

Handles user registration, login, JWT issuance, and request authentication middleware.

## Responsible for

- User registration: email uniqueness check, bcrypt password hashing (10 rounds), user + subscription creation, JWT issuance
- User login: credential verification (bcrypt.compare), JWT issuance
- JWT management: signing with HS256 (7-day expiry), verification, payload extraction (sub, email, plan)
- Auth middleware (`requireAuth`): extracts Bearer token, verifies, attaches user object to request
- JWT_SECRET sourced from environment (dev default: "dev-secret-change-in-production")

## Not responsible for

- Password reset or email verification (not implemented)
- Session management beyond JWT (no server-side sessions)
- Authorization / permission checking (subscription limits handled by respective services)
