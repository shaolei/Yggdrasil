# Gold Standard Answers — Payload CMS Auth System

## F1: Password hashing algorithm and verification

Payload uses **pbkdf2** with the following parameters:
- **Iterations:** 25,000
- **Key length:** 512 bytes
- **Digest:** sha256
- **Salt:** 32 random bytes, stored as hex string

During login, `authenticateLocalStrategy` extracts `hash` and `salt` from the user document, then calls `crypto.pbkdf2()` with the submitted password and stored salt using the same parameters. The resulting hash buffer is compared to the stored hash using `crypto.timingSafeEqual()`. Before comparison, both buffers are verified to have equal length (`hashBuffer.length === storedHashBuffer.length`). If either the salt/hash fields are missing or not strings, the function returns `null`. All exceptions are caught and return `null` (silent failure).

## F2: JWT extraction methods and order

The three extraction methods are:

1. **Bearer** — Checks the `Authorization` header for `Bearer <token>` (RFC6750 OAuth 2.0 compliant)
2. **cookie** — Reads the `<cookiePrefix>-token` cookie from the `Cookie` header. Includes CSRF protection: if an `Origin` header is present and `config.csrf` has entries, the origin must be in the allowed list. Returns null if CSRF check fails.
3. **JWT** — Checks the `Authorization` header for `JWT <token>` (Payload's legacy format)

The order is configurable via `payload.config.auth.jwtOrder` (an array). The system tries each method in order and returns the first non-null result.

## F3: fetchData=false with Where query result

When `fetchData` is false and an access function returns a Where query object, `getEntityPermissions` stores the Where object but does NOT evaluate it against the database. The permission is set to `{ permission: true, where: accessResult }`. This means the system optimistically grants permission and attaches the Where query for the consumer to apply at query time (typically as a filter in the database query).

There is a TODO comment in the code questioning whether this should default to `false` instead of `true` for security reasons. The current behavior means that when fetching permission summaries without document context (e.g., for the admin UI), Where-based access rules appear as "has permission" rather than "unknown."

## S1: Login data flow

1. **Auth Endpoints (loginHandler):** Receives HTTP POST, extracts `email`/`username`/`password` from request body, extracts `depth` from query params. Calls `loginOperation`.

2. **Auth Operations (loginOperation):**
   - Checks `disableLocalStrategy`
   - Runs `buildBeforeOperation` hooks
   - Sanitizes email (lowercase, trim) and username
   - Determines login mode via `getLoginOptions` (email-only, username-only, or both)
   - Builds Where query with cross-field matching (username can match email field and vice versa)
   - Appends non-trashed filter
   - Finds user via `payload.db.findOne`
   - Calls `checkLoginPermission` (checks null + lock status)
   - Delegates password verification to infrastructure

3. **Auth Infrastructure (authenticateLocalStrategy):** Verifies password via pbkdf2 + timingSafeEqual, returns doc or null

4. **Auth Operations (continued):**
   - On failure: increments login attempts, re-checks permissions, throws AuthenticationError
   - On success: checks email verification, starts transaction, re-reads lock status (parallel safety), delegates session creation and JWT signing to infrastructure

5. **Auth Infrastructure (addSessionToUser + jwtSign):** Creates session (UUID, expiry), saves to DB. Signs JWT with HS256 including user fields from `getFieldsToSign`.

6. **Auth Operations (continued):** Resets login attempts, runs beforeLogin/afterLogin/afterRead hooks, commits transaction

7. **Auth Endpoints (continued):** Calls `generatePayloadCookie` from infrastructure, sets `Set-Cookie` header, optionally removes token from body, returns JSON response with token/exp/user.

## S2: Block reference permissions cache

The `blockReferencesPermissions` cache is:

1. **Created** in `getAccessResults` (access-control module) as an empty object `{}`
2. **Shared** by being passed as a parameter to every `getEntityPermissions` call for all collections and globals
3. **Populated** in `populateFieldPermissions` (entity-permissions module): when a block reference string is encountered for the first time, its permissions are computed and stored with the block slug as key. On subsequent encounters (even in different collections), the cached permission object is reused directly.

**Problem it solves:** Block types defined via `blockReferences` (string references to shared blocks in `req.payload.blocks`) can appear in multiple collections. Without caching, the same block's permissions would be re-computed for every collection that references it. The cache ensures each block type's permissions are computed once.

**Key implementation detail:** The caching works because permission objects are mutated in-place via `setPermission`. Even if the cached reference is stored before async access functions resolve, the promise `.then()` callback mutates the `.permission` property on the shared object, so all consumers see the final value.

## S3: Session management division of responsibility

**Auth Operations** orchestrates session lifecycle:
- `loginOperation` calls `addSessionToUser` after successful authentication and `revokeSession` on error rollback
- `refreshOperation` extends session expiry and cleans expired sessions
- `logoutOperation` removes the current session (or all sessions if `allSessions` is true)
- `incrementLoginAttempts` revokes recent sessions (20-second window) when locking an account

**Auth Infrastructure** provides the primitives:
- `addSessionToUser` (sessions.ts): generates UUID session ID, calculates expiry, removes expired sessions, writes to DB via `payload.db.updateOne`
- `revokeSession` (sessions.ts): filters out a specific session by ID, writes to DB
- `removeExpiredSessions` (sessions.ts): pure function that filters sessions by expiry date

**Storage:** Sessions are stored as an array field on the user document itself (not a separate collection). The DB adapter handles persistence through `payload.db.updateOne`.

## R1: Why incrementLoginAttempts operates outside the request transaction

The code deliberately does not pass `req` to its database update calls. The comment in the source code states: "we want those to be visible in parallel requests that are on a different transaction. At the same time, we want updates from parallel requests to be visible here."

This is critical for brute-force protection: if login attempt increments were scoped to the request transaction, parallel login attempts would each see stale attempt counts (isolated by transaction). An attacker could send 1000 parallel requests, all seeing `loginAttempts: 0`, and none would trigger the lock. By operating outside the transaction, increments are immediately visible across all concurrent requests, and the `$inc` atomic operation prevents lost updates.

## R2: Why forgotPassword silently returns null

The code contains an explicit comment: "We don't want to indicate specifically that an email was not found, as doing so could lead to the exposure of registered emails. Therefore, we prefer to fail silently."

This is a standard security practice to prevent **email enumeration attacks**. If the endpoint returned different responses for "user exists" vs "user doesn't exist," an attacker could probe the system with email addresses to determine which ones have accounts. The silent null return makes the response indistinguishable regardless of whether the user exists.

## R3: Why updatedAt is set to null during session operations

The code comments state: "Prevent updatedAt from being updated when only adding a session" (and similarly for logout and refresh).

Sessions change frequently (login, refresh, logout) but represent authentication state, not content changes. If `updatedAt` were updated on every session change, it would:
1. Misrepresent when the user's actual data was last modified
2. Trigger unnecessary cache invalidation or sync operations that depend on `updatedAt`
3. Make it impossible to distinguish between "user updated their profile" and "user logged in"

Setting `updatedAt = null` causes the DB adapter to skip updating that field, preserving the timestamp of the last meaningful content change.

## I1: Impact of changing pbkdf2 parameters

Changing the pbkdf2 parameters (iterations, key length, or digest) would:

1. **Break all existing passwords:** Every stored hash was computed with the current parameters (25000 iterations, 512-byte key, sha256). New parameters would produce different hashes from the same password+salt, causing `authenticateLocalStrategy` to fail `timingSafeEqual` for all existing users.
2. **Affect `generatePasswordSaltHash`:** New passwords and password resets would use the new parameters.
3. **Create a split:** Users who reset their password after the change would have new-format hashes, while existing users would have old-format hashes. Without a migration strategy, existing users would be permanently locked out.
4. **Impact `resetPasswordOperation`:** It calls `authenticateLocalStrategy` to verify the newly set password, so it must use consistent parameters.

**Components affected:** `authenticateLocalStrategy`, `generatePasswordSaltHash`, `loginOperation`, `resetPasswordOperation`.

## I2: Impact of changing JWT payload structure

Changing which fields are included in the JWT affects:

1. **JWTAuthentication strategy:** Reads `collection`, `id`, and `sid` from the decoded JWT. If any of these are removed or renamed, user lookup and session validation break.
2. **refreshOperation:** Reads `_sid` from `req.user` (populated from JWT) to find the existing session.
3. **logoutOperation:** Reads `req.user._sid` to identify which session to revoke.
4. **getFieldsToSign:** This is where the JWT payload is constructed. Changes here affect all token consumers.
5. **All downstream consumers of `req.user`:** Middleware and application code may depend on fields from the JWT being present on `req.user`.
6. **Existing tokens:** Any tokens already issued with the old structure would decode to different shapes, potentially breaking session validation or user identification.

## I3: Impact of removing Where query cache

Removing the `isDeepStrictEqual` cache in `getEntityPermissions` would:

1. **Cause duplicate database queries:** When multiple operations (create, read, update, delete) have access functions that return identical Where queries, each would trigger a separate `entityDocExists` DB call instead of sharing one.
2. **Performance degradation:** For the `/access` endpoint which evaluates all collections and globals, the number of DB queries could multiply by the number of operations per entity (up to 6).
3. **No functional breakage:** The results would be identical — the cache is purely a performance optimization.
4. **The magnitude depends on access function patterns:** If most access functions return simple booleans, the impact is minimal. If they return complex Where queries (common for row-level security), the impact could be significant.

## C1: What if password comparison used === instead of timingSafeEqual

Using `===` string comparison would make the system vulnerable to **timing attacks**:

1. String comparison in JavaScript (and most languages) short-circuits: it returns false as soon as it finds a mismatched character.
2. An attacker can measure the response time to determine how many characters matched.
3. By iterating through possible characters at each position, the attacker can reconstruct the hash one byte at a time.
4. This reduces the brute-force space from 2^(512*8) (the full hash) to 512*256 (linear in hash length), making the attack feasible.

Additionally, the buffer length check before `timingSafeEqual` is critical — without it, `timingSafeEqual` would throw if buffer lengths differ, which would itself leak information.

The brute-force protection (account locking) provides a secondary defense, but timing attacks can be executed with very few requests per attempt, potentially staying below the lock threshold.

## C2: What if incrementLoginAttempts used the request transaction

If `incrementLoginAttempts` used `req` in its DB calls (scoping them to the request transaction):

1. **Brute-force protection would fail under parallel attacks:** Each concurrent login request would be in its own transaction, seeing the login attempt count as it was at transaction start. 100 parallel requests would all see `loginAttempts: 0` and none would trigger locking.
2. **The `$inc` atomic operation would still be atomic** within each transaction, but the reads would be isolated — the increment from request A wouldn't be visible to request B until A commits.
3. **The re-read after successful auth would also be scoped:** The parallel safety check where the login operation re-reads `lockUntil` after authentication would see its own transaction's state, missing locks set by other requests.
4. **Session revocation on lock would be ineffective:** The 20-second window session cleanup relies on seeing sessions created by parallel requests, which would be invisible in a different transaction.

The net effect: an attacker could bypass brute-force protection entirely by parallelizing login attempts.

## C3: What if sessions were stored in a separate collection

Moving sessions to a separate collection would:

1. **Break the current session management code:** `addSessionToUser`, `revokeSession`, logout, and refresh all read/write sessions as a field on the user document via `payload.db.updateOne`. These would need to be rewritten to use a separate collection's CRUD operations.
2. **Break the JWT strategy session check:** `JWTAuthentication` looks for sessions in `user.sessions`. With a separate collection, an additional query would be needed.
3. **Break incrementLoginAttempts session revocation:** The lock handler fetches `user.sessions` to find and remove recently-created sessions. With a separate collection, this would require a query + batch delete.
4. **Change the updatedAt semantics:** The `updatedAt = null` pattern exists specifically because sessions are on the user document. With a separate collection, session changes wouldn't affect the user's `updatedAt` at all.
5. **Potential benefits:** Separate storage would allow more efficient queries (finding sessions across users), avoid growing user documents, and enable session-specific indexes. But these benefits aren't needed at Payload's current scale/use case.
6. **Authentication depth impact:** The `auth.depth` config controls how deep to populate the user document during authentication. With sessions embedded, they come for free. With a separate collection, they'd need explicit population or additional queries.
