# Auth Strategies

## Identity

Implements the pluggable authentication strategy system. Contains three built-in strategies (local password, JWT token, API key) and the strategy executor that iterates through configured strategies until one succeeds.

## Boundaries

- IS responsible for: credential verification (password hashing, JWT verification, API key HMAC lookup), strategy iteration, auto-login for development
- IS NOT responsible for: session management, token issuance (uses token-management), hook execution, account lockout tracking
