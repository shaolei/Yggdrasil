# Token Management

## Identity

Handles JWT token signing, cookie generation/parsing, session lifecycle (create/revoke/expire), field selection for JWT payload, and AES-256 encryption utilities.

## Boundaries

- IS responsible for: JWT signing (via jose library), cookie string/object generation, session creation/revocation/expiry, determining which user fields go into the JWT, AES encryption/decryption
- IS NOT responsible for: JWT verification during authentication (that's in strategies), access control, user lookup
