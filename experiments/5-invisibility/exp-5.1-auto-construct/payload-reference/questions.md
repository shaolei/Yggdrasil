# Diagnostic Questions — Payload CMS Auth System

## Factual

**F1:** What hashing algorithm and parameters does Payload use for password storage, and how is the hash verified during login?

**F2:** What are the three JWT extraction methods supported by `extractJWT`, and in what order are they tried?

**F3:** What happens when `getEntityPermissions` is called with `fetchData: false` and an access function returns a Where query object?

## Structural

**S1:** Trace the data flow from when a user submits credentials to the login endpoint to when they receive a JWT token. Which modules are involved and what does each contribute?

**S2:** How does the `blockReferencesPermissions` cache work across the access evaluation flow — where is it created, how is it shared, and what problem does it solve?

**S3:** How do auth operations and auth infrastructure divide responsibility for session management? Which module creates sessions, which stores them, and which revokes them?

## Rationale

**R1:** Why does `incrementLoginAttempts` deliberately operate outside the request transaction (not using `req` in its DB calls)?

**R2:** Why does the `forgotPasswordOperation` silently return null when the user is not found, rather than throwing an error?

**R3:** Why does Payload set `user.updatedAt = null` when adding or removing sessions?

## Impact

**I1:** What would break if the `authenticateLocalStrategy` function's pbkdf2 parameters (iterations, key length, digest) were changed?

**I2:** What components are affected if the structure of the JWT payload (fields included in the token) changes?

**I3:** What happens if `getEntityPermissions`'s Where query cache (using `isDeepStrictEqual`) is removed?

## Counterfactual

**C1:** What would go wrong if password verification used `===` string comparison instead of `crypto.timingSafeEqual`?

**C2:** What would happen if `incrementLoginAttempts` used the request transaction (via `req`) instead of operating outside it?

**C3:** What would break if sessions were stored in a separate database collection instead of as an array field on the user document?
