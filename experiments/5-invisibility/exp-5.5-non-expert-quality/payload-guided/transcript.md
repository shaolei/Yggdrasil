# Guided Extraction Transcript — Payload CMS Auth

## Phase A: Module Discovery

### A1: Main Components

**Extraction Agent:** What are the main components/modules in the auth area (`packages/payload/src/auth/` and `packages/payload/src/utilities/getEntityPermissions/`)? For each one, describe in 1-2 sentences what it does.

**Simulated Developer:** Okay, let me think about this. There are a few main pieces:

1. **Operations** (`auth/operations/`) — These are the main auth actions: login, logout, refresh token, forgot password, reset password, verify email, unlock user, register first user, and "me" (get current user). Each one is its own file.

2. **Strategies** (`auth/strategies/`) — These handle how authentication actually works. There's a JWT strategy (checks JWT tokens from headers/cookies), an API key strategy (checks API key headers), and a local strategy (`strategies/local/`) that does password hashing and verification with pbkdf2.

3. **Sessions** (`auth/sessions.ts`) — Manages user sessions. Sessions are stored on the user document. It handles adding sessions, revoking them, removing expired ones.

4. **Cookies** (`auth/cookies.ts`) — Generates auth cookies with the right security settings (httpOnly, sameSite, secure, etc.). Also parses cookies from request headers.

5. **JWT helpers** (`auth/jwt.ts`) — Signs JWT tokens using jose library with HS256.

6. **Crypto** (`auth/crypto.ts`) — AES-256-CTR encryption/decryption. I think it's used for things like password reset tokens.

7. **Access control execution** (`auth/executeAccess.ts`) — Runs an access control function and throws Forbidden if access is denied.

8. **Auth strategy executor** (`auth/executeAuthStrategies.ts`) — Loops through all registered auth strategies and returns the first one that successfully authenticates a user.

9. **Entity permissions** (`utilities/getEntityPermissions/`) — Builds up the full permissions object for a collection or global. It checks access functions for each operation (create, read, update, delete) and also does field-level permissions recursively.

10. **Supporting utilities** — Things like `extractJWT.ts` (extracts JWT from headers using configurable order: cookie, Bearer, JWT header), `getFieldsToSign.ts` (picks which user fields go into the JWT), `isUserLocked.ts` (checks lock timestamp), `getLoginOptions.ts` (figures out if you can login with email, username, or both).

### A2: File Mappings

**Extraction Agent:** For each component you listed, what files contain its implementation?

**Simulated Developer:**

1. **Operations**: `auth/operations/login.ts`, `auth/operations/logout.ts`, `auth/operations/refresh.ts`, `auth/operations/forgotPassword.ts`, `auth/operations/resetPassword.ts`, `auth/operations/verifyEmail.ts`, `auth/operations/unlock.ts`, `auth/operations/registerFirstUser.ts`, `auth/operations/me.ts`, `auth/operations/access.ts`, `auth/operations/auth.ts`, `auth/operations/init.ts`, and there's a `local/` subfolder with `auth/operations/local/authenticate.ts`
2. **Strategies**: `auth/strategies/jwt.ts`, `auth/strategies/apiKey.ts`, `auth/strategies/local/authenticate.ts`, `auth/strategies/local/generatePasswordSaltHash.ts`, `auth/strategies/local/incrementLoginAttempts.ts`, `auth/strategies/local/resetLoginAttempts.ts`, `auth/strategies/local/register.ts`
3. **Sessions**: `auth/sessions.ts`
4. **Cookies**: `auth/cookies.ts`
5. **JWT**: `auth/jwt.ts`
6. **Crypto**: `auth/crypto.ts`
7. **Access execution**: `auth/executeAccess.ts`
8. **Strategy executor**: `auth/executeAuthStrategies.ts`
9. **Entity permissions**: `utilities/getEntityPermissions/getEntityPermissions.ts`, `utilities/getEntityPermissions/populateFieldPermissions.ts`, `utilities/getEntityPermissions/entityDocExists.ts`
10. **Supporting**: `auth/extractJWT.ts`, `auth/getFieldsToSign.ts`, `auth/isUserLocked.ts`, `auth/getLoginOptions.ts`, `auth/defaultAccess.ts`, `auth/types.ts`, `auth/getAccessResults.ts`, `auth/extractAccessFromPermission.ts`, `auth/ensureUsernameOrEmail.ts`

### A3: Interactions

**Extraction Agent:** Which of these components interact with each other? For each interaction, who calls whom and why?

**Simulated Developer:** Let me trace through the main ones:

- **Login operation** calls: local strategy's `authenticateLocalStrategy` (to verify password), `incrementLoginAttempts` / `resetLoginAttempts` (brute force protection), `getFieldsToSign` (to build JWT payload), `jwtSign` (to create the token), `addSessionToUser` (to create a session), `isUserLocked` (to check if account is locked). It also calls collection hooks (beforeLogin, afterLogin, beforeOperation, afterOperation, afterRead).

- **Refresh operation** calls: `getFieldsToSign`, `jwtSign` (to issue new token), `removeExpiredSessions` (to clean up). It also checks sessions.

- **Logout operation** removes sessions from the user document in the database.

- **JWT strategy** calls: `extractJWT` (to get token from request), then verifies the JWT, looks up the user, and checks sessions if enabled. Falls back to `autoLogin` if configured.

- **API key strategy** hashes the provided API key with HMAC (sha1 and sha256 for backward compat) and queries the database for a matching user.

- **Strategy executor** (`executeAuthStrategies`) loops through all strategies and calls each one's `authenticate` method until one returns a user.

- **executeAccess** is called from various operations to check if the current user has permission for an action.

- **getAccessResults** calls `getEntityPermissions` for every collection and global to build the full permissions map. It's used for the `/access` endpoint.

- **getEntityPermissions** calls `populateFieldPermissions` recursively for field-level access checks, and `entityDocExists` when it needs to evaluate where-clause-based access results against the database.

### A4: Invisible Components

**Extraction Agent:** Are there any components that affect multiple other components without being explicitly called? (Examples: middleware, guards, interceptors, decorators, plugins, event handlers)

**Simulated Developer:** Yeah, a few things:

- **Collection hooks** — beforeOperation, afterOperation, beforeLogin, afterLogin, beforeRead, afterRead, afterRefresh, afterLogout. These are configured per collection and get called at various points in the operations. They can modify the user object or the result. They're not in the auth code itself — they're defined by the user in their Payload config.

- **Access functions** — These are defined per collection/global/field in the Payload config. They're functions the user writes that return `true`, `false`, or a `Where` query. They silently control who can do what. The auth system just executes them.

- **The auth strategy pipeline** — `executeAuthStrategies` runs on every request (via middleware). It determines `req.user` which then affects everything else. Custom strategies can be injected via config.

- **`defaultAccess`** — If no access function is defined, this kicks in. It just checks if `req.user` exists — so by default, logged-in users have access and anonymous users don't.

---

## Phase B: Cross-Cutting Pattern Extraction

### B1: Common Patterns

**Extraction Agent:** I see that login, refresh, and logout all deal with sessions and transactions. Is there a common pattern or rule they all follow when doing this?

**Simulated Developer:** Yeah, there's a transaction pattern. Login, refresh, and logout all:
1. Call `initTransaction` at the start
2. Do their work in a try/catch
3. Call `commitTransaction` if successful
4. Call `killTransaction` in the catch block

For sessions specifically — login creates a session via `addSessionToUser`, refresh extends the session expiry, and logout removes the session. They all set `user.updatedAt = null` when only touching sessions, to prevent the updatedAt timestamp from changing just because of a session update.

### B2: Rules Across Components

**Extraction Agent:** Are there any rules that apply to MULTIPLE components? For example: error handling patterns, concurrency rules, data validation rules, security/authorization patterns, event publishing patterns?

**Simulated Developer:**

- **Hook lifecycle**: Almost all operations follow the same pattern — `beforeOperation` hook, do the main work, then operation-specific hooks (like `beforeLogin`/`afterLogin`), then `afterRead` field hooks, then collection `afterRead` hooks, then `afterOperation`. The order is consistent.

- **Access control**: Every operation that touches data checks access. The pattern is: call the configured access function, if it returns false and errors aren't disabled, throw `Forbidden`. If there's no access function, fall back to `defaultAccess` (just checks if user is logged in).

- **Brute force protection**: Login uses `maxLoginAttempts` and `lockTime`. After each failed attempt, `incrementLoginAttempts` is called. When max is reached, the user gets locked. There's special handling for parallel login attempts — the code re-checks the lock status after incrementing because another request might have locked the account in the meantime.

- **Email verification**: Both login and JWT strategy check `_verified`. If verification is required and the user isn't verified, login throws `UnverifiedEmail` and the JWT strategy rejects the token.

- **Input sanitization**: Email and username are lowercased and trimmed before use in login.

### B3: Exceptions to Patterns

**Extraction Agent:** For each pattern you described: are there any components that follow it DIFFERENTLY or have exceptions?

**Simulated Developer:**

- **Transaction pattern**: Login is a bit different. It does the credential verification *outside* the transaction, and only starts the transaction after authentication succeeds. The comment says "Authentication successful - start transaction for remaining operations." So the password check is not transactional but the session creation and hook execution is. Also, if the session was already created but something fails later, login revokes the session in the catch block.

- **Hook lifecycle**: The `access` and `me` operations are simpler — they don't run the full hook lifecycle. `logout` only runs `afterLogout` hooks, not the full before/after pattern.

- **Brute force protection / parallel safety**: The `incrementLoginAttempts` function deliberately does NOT use `req` in its database calls. There's a comment: "this function does not use req in its updates, as we want those to be visible in parallel requests." So it opts out of the transaction isolation to handle concurrent login attempts correctly. It also has a special 20-second session purge — if brute force is detected, it removes any sessions created in the last 20 seconds to invalidate sessions from a correct guess that happened in parallel with the attack.

- **JWT extraction order**: The order that JWT is extracted from headers is configurable via `payload.config.auth.jwtOrder`. So the cookie vs Bearer vs JWT header priority can be changed.

---

## Phase C: Business Process Extraction

### C1: User Journey

**Extraction Agent:** Describe a typical user journey through the auth area. What happens from the user's perspective, step by step?

**Simulated Developer:** Okay, the main flow is login:

1. User sends email/username + password to the login endpoint
2. System validates the input (email or username required, password required)
3. System looks up the user by email/username (excluding trashed users)
4. Checks if the user exists and isn't locked
5. Verifies the password using pbkdf2
6. If wrong password — increments login attempts, may lock the account
7. If right password — checks email verification if required
8. Creates a session (if sessions enabled)
9. Runs beforeLogin hooks
10. Signs a JWT with the user's fields
11. Runs afterLogin hooks
12. Returns the token, expiration, and user data

Then on subsequent requests:
1. The auth strategy pipeline runs (middleware)
2. JWT strategy extracts the token from cookie/header
3. Verifies the JWT signature
4. Looks up the user from the database
5. Checks verification status and session validity
6. Sets `req.user`

For token refresh:
1. User hits refresh endpoint while authenticated
2. System verifies the current session exists
3. Extends the session expiry
4. Signs a new JWT
5. Returns new token

For logout:
1. User hits logout endpoint
2. System removes the session (or all sessions if `allSessions` is true)
3. Returns success

### C2: Failure Points

**Extraction Agent:** What can go wrong during this process? For each failure point, what happens to the user and to the data?

**Simulated Developer:**

- **Invalid credentials**: User gets an `AuthenticationError`. Login attempts are incremented. After max attempts, the account is locked for `lockTime` milliseconds.

- **Account locked**: User gets a `LockedAuth` error. They have to wait until `lockUntil` expires. There's no unlock endpoint exposed by default — it requires the `unlock` operation which has its own access control.

- **Email not verified**: User gets `UnverifiedEmail` error. They need to verify their email first.

- **Disabled local strategy**: If `disableLocalStrategy` is true, login throws `Forbidden` immediately. This is for when you're using only custom auth strategies.

- **Parallel brute force**: This is interesting. If someone sends 100 login attempts in parallel — 99 wrong and 1 correct — the correct one might succeed first (it's faster, no extra DB update). But then the failed attempts trigger the brute force protection, which purges sessions created in the last 20 seconds, effectively killing the legitimate session. So the system is paranoid — it would rather kill a valid session than risk a brute force succeeding.

- **Session not found on refresh**: If the session ID in the JWT doesn't match any session on the user, the refresh throws `Forbidden`.

- **Transaction failure**: If anything fails after the transaction starts, the transaction is killed and the error propagated. For login specifically, the session is revoked in the catch block if it was already created.

### C3: Ordering Requirements

**Extraction Agent:** Are there any ordering requirements? Things that MUST happen before other things, or things that MUST NOT happen at the same time?

**Simulated Developer:**

- Password verification MUST happen before session creation. The transaction only starts after the password is verified.

- Login attempts MUST be incremented before the authentication error is thrown, so the lock check after incrementing can catch parallel updates.

- After incrementing login attempts, the login function re-checks `checkLoginPermission` to see if the account was locked by a parallel request.

- The 20-second session purge MUST happen after detecting max login attempts, to clean up sessions from parallel correct logins.

- `beforeLogin` hooks run AFTER password verification but BEFORE the JWT is signed.

- `afterLogin` hooks run AFTER the JWT is signed but BEFORE afterRead hooks.

- For JWT strategy: session validation MUST happen after user lookup. If `useSessions` is enabled and no matching session is found, the user is rejected even if the JWT is valid.

---

## Phase D: Decision Extraction

### D1: Transaction Outside Password Verification

**Extraction Agent:** I notice that the login operation starts the transaction AFTER password verification, not before. Why was it done this way? Was anything else considered?

**Simulated Developer:** I think it's a performance thing. Password verification with pbkdf2 is slow on purpose (25,000 iterations). If you hold a transaction open during that, you're blocking other database operations unnecessarily. The password check doesn't modify any data, so there's no need for it to be transactional. Only the session creation and login attempt tracking actually need transaction protection.

I'm not 100% sure if there was a discussion about it, but it makes sense from a performance perspective. You don't want to hold a transaction lock while doing expensive crypto.

### D2: Dual Hash for API Keys

**Extraction Agent:** I notice the API key strategy checks both SHA-1 and SHA-256 hashes. The simpler approach would be to just use SHA-256. Is there a reason both are checked?

**Simulated Developer:** Oh yeah, there's actually a TODO comment about that. It says "V4 remove extra algorithm check." API keys saved before version 3.46.0 used SHA-1 for the `apiKeyIndex`. They upgraded to SHA-256 at some point but kept backward compatibility with the old keys. So they check both. It's supposed to be removed in v4.

### D3: 20-Second Session Purge Window

**Extraction Agent:** The `incrementLoginAttempts` function purges sessions created in the last 20 seconds when brute force is detected. Why 20 seconds specifically? Was anything else considered?

**Simulated Developer:** I'm not sure about the exact reasoning for 20 seconds. The code comment explains the scenario: if someone sends 99 bad + 1 correct login in parallel, the correct one finishes first and creates a session. Then this code (from one of the failed attempts) detects max attempts reached and kills recent sessions to invalidate that potentially-brute-forced session.

20 seconds is probably just a reasonable window — long enough to catch parallel requests but short enough to not kill legitimate sessions from minutes ago. I'd have to look at the PR discussion to know if they considered other values. It feels like a judgment call.

### D4: Access Functions Returning Where Clauses

**Extraction Agent:** I notice that access functions can return either a boolean OR a Where query object. The simpler approach would be just booleans. Is there a reason for the Where clause support?

**Simulated Developer:** Yeah, the Where clause thing is how Payload does row-level security. Instead of loading every document and checking access on each one, you can return a Where query that gets merged into the database query. So like, you could say "users can only read documents they created" by returning `{ createdBy: { equals: req.user.id } }`. That way the database does the filtering, which is way more efficient than loading all docs and filtering in memory.

There's actually an interesting edge case in the permissions code — there's a TODO comment that says when `fetchData` is false and a Where query is returned, it currently defaults to `permission: true`, but they're thinking about changing that to `false` in v4 because it seems more secure to deny when you can't actually evaluate the Where clause.

---

## Phase E: Gap-Filling (Round 1)

### E1: updatedAt null Pattern

**Extraction Agent:** I noticed that sessions, refresh, and logout all set `user.updatedAt = null` when modifying sessions. Can you explain why?

**Simulated Developer:** Yeah, so Payload tracks `updatedAt` on documents automatically. When you add or remove a session, the user document gets updated in the database. But from the user's perspective, they didn't actually edit their profile — they just logged in or refreshed. So setting `updatedAt = null` prevents the timestamp from changing. Otherwise, every login would look like the user's profile was updated, which would be confusing in the admin UI and in any audit logs.

### E2: Strategy Pipeline Order

**Extraction Agent:** When `executeAuthStrategies` loops through strategies, it stops at the first successful one. What happens if a strategy throws an error vs returning null?

**Simulated Developer:** If a strategy throws an error, it's caught and logged via `logError`, but the loop continues to the next strategy. So errors are swallowed. Only if a strategy returns a user object does it stop. If no strategy returns a user, the result is `{ user: null }` — meaning the request is anonymous.

Also, response headers from each strategy are merged together, so even if a strategy doesn't return a user, its headers can still affect the response.

### E3: Field-Level Permissions Recursion

**Extraction Agent:** The `populateFieldPermissions` function seems to handle blocks, tabs, groups, and other nested structures. Is there anything tricky about the recursion?

**Simulated Developer:** Yeah, a few things. Block references can be shared across multiple fields, so there's a `blockReferencesPermissions` cache to avoid recalculating the same block permissions. The permissions for a cached block are shared by reference, so when the promise resolves, all references see the update.

There's also a loop detection mechanism — the main `getEntityPermissions` function processes the promises array in a while loop, and each iteration can add more promises (because nested fields recursively add to the same array). It caps at 100 iterations and throws an error to prevent infinite loops.

Fields without names (unnamed groups, unnamed tabs) use the parent's permissions object, so their permissions flow through to the parent level. Named fields get their own permissions entry.

### Gap-Filling (Round 2)

### E4: CSRF Protection in Cookie Extraction

**Extraction Agent:** I noticed `extractJWT` checks the Origin header against a CSRF whitelist when extracting from cookies. Can you explain the logic?

**Simulated Developer:** When extracting from cookies, the code checks if the request's Origin header is in `payload.config.csrf` array. If the origin isn't whitelisted and CSRF protection is enabled (the array is non-empty), the cookie token is rejected. This prevents cross-site request forgery — a malicious site can't use the auth cookie because its Origin won't be whitelisted.

If there's no Origin header at all (like server-to-server requests), the token is accepted. And if the CSRF list is empty, all origins are accepted. The Bearer and JWT header extraction methods don't have this check because those tokens can't be automatically sent by a browser the way cookies can.

### E5: Login Attempt Concurrency Model

**Extraction Agent:** You mentioned `incrementLoginAttempts` doesn't use `req` for its DB calls. Can you explain what that means practically?

**Simulated Developer:** In Payload, the `req` object carries the transaction context. When you pass `req` to a database operation, it runs within that request's transaction. By not passing `req`, the `incrementLoginAttempts` updates run outside any transaction — they're immediately visible to other concurrent requests.

This is intentional. If two login attempts happen in parallel, both need to see each other's attempt count increments. If they ran inside separate transactions, each would only see its own increments and the brute force counter wouldn't work correctly. The atomic `$inc` operator is used instead of read-modify-write to avoid race conditions on the counter itself.
