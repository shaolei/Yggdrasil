# Auth Infrastructure

## Identity

Low-level authentication primitives: password hashing, JWT operations, session management, cookie generation, token extraction, and authentication strategies. These are building blocks consumed by auth operations.

## Responsibilities

- Password hashing and verification (pbkdf2 with sha256, 25000 iterations, 512-byte key)
- Password salt generation (32 random bytes)
- JWT signing (HS256 via jose library) and verification
- JWT extraction from requests (configurable order: Bearer header, cookie, JWT header)
- Cookie generation with security attributes (HttpOnly, Secure, SameSite, domain, expiry)
- Server-side session lifecycle (add, revoke, remove expired)
- AES-256-CTR encryption/decryption (general-purpose, uses `this.secret` binding)
- Authentication strategies: local (password), JWT (token verification + session check), API key (HMAC index lookup)
- Field-to-JWT mapping (traverses collection fields respecting `saveToJWT` config)

## Not Responsible For

- Orchestrating auth flows (handled by operations)
- Hook execution (handled by operations)
- Transaction management (handled by operations)
- Brute-force tracking logic (handled by operations, though the strategy files contain increment/reset)
- HTTP routing (handled by endpoints)
