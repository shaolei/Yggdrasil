# Phase 5: Semantic Comparison — Payload CMS

## Per-Element Content Depth

### Matching Nodes

| Element Pair | Artifact | Score | Notes |
|---|---|---|---|
| auth-system / auth | responsibility.md | 3 | Both capture identity, boundaries, not-responsible-for. Equivalent content. |
| auth-operations / auth/operations | responsibility.md | 3 | Same scope. Auto version also includes access-control responsibilities (merged). |
| auth-operations / auth/operations | interface.md | 2 | Auto captures loginOperation, executeAccess, defaultAccess, getAccessResults well. Misses logoutOperation, refreshOperation, forgotPasswordOperation, resetPasswordOperation detail. |
| auth-operations / auth/operations | internals.md | 3 | Both capture login flow ordering, username/email flexibility, parallel safety. Auto slightly less detailed on incrementLoginAttempts specifics. |
| auth-infrastructure / auth/strategies | responsibility.md | 2 | Auto covers strategies well but misses JWT/cookie/session/crypto responsibilities (those are in token-management). |
| auth-infrastructure / auth/strategies | interface.md | 3 | Excellent coverage of authenticateLocalStrategy, JWTAuthentication, APIKeyAuthentication. Adds executeAuthStrategies (extra value). |
| auth-infrastructure / auth/strategies | internals.md | 3 | JWT extraction order, API key backward compat, password hashing params all present. |
| auth-infrastructure / auth/token-management | responsibility.md | 2 | Covers JWT signing, cookies, sessions. Misses some framing as "building blocks consumed by operations." |
| auth-infrastructure / auth/token-management | interface.md | 3 | Comprehensive: jwtSign, getFieldsToSign, addSessionToUser, revokeSession, cookies, encrypt/decrypt. Adds parseCookies and getFieldsToSign crash fix. |
| auth-infrastructure / auth/token-management | internals.md | 2 | Captures field traversal, session management, cookie SameSite logic. Misses encrypt/decrypt binding detail and some session invariants. |
| entity-permissions / permissions | responsibility.md | 3 | Equivalent framing and boundaries. |
| entity-permissions / permissions | interface.md | 3 | Same functions documented: getEntityPermissions, populateFieldPermissions, entityDocExists. Same parameter detail. |
| entity-permissions / permissions | internals.md | 3 | Two-phase resolution, Where caching, field recursion, promise drain, block reference caching, fetchData=false behavior — all present. |
| access-control / (merged into auth/operations) | responsibility.md | 2 | Access-control identity is captured within operations responsibility but not as a separate concern. Boundaries are less clear. |
| access-control / (merged into auth/operations) | interface.md | 2 | executeAccess, defaultAccess, getAccessResults are documented in operations interface. accessOperation is missing. |
| access-control / (merged into auth/operations) | internals.md | 2 | Fallback chain is mentioned. Block reference sharing is captured in permissions node instead. canAccessAdmin evaluation is missing. |
| auth-endpoints / (missing) | all | 0 | Entirely absent. All endpoint documentation (10+ handlers, cookie handling pattern, wrapInternalEndpoints) missing. |

### Matching Aspects

| Reference Aspect | Auto Aspect | Score | Notes |
|---|---|---|---|
| brute-force-protection | account-lockout | 3 | Same rules: atomic $inc, lock threshold, expired lock restart, 20-second session revocation. Auto adds code comment quotes. |
| hook-lifecycle-pattern | hook-lifecycle | 2 | Core lifecycle captured. Auto has slightly different ordering (places operation-specific before hooks before core logic, which is wrong — reference has core logic before operation-specific hooks). Misses constraint about hooks receiving full `req` context. |
| timing-safe-comparison | (none) | 0 | Missing as aspect. Content is embedded in strategies interface/internals. |
| transaction-safety | (none) | 0 | Missing as aspect. Transaction pattern mentioned in operations internals but not extracted. |
| where-based-access-control | access-control (broader) | 2 | Where-based behavior is captured within the access-control aspect, but the aspect is broader (covers all access control, not just the Where mechanism). Missing: dual-mode distinction (executeAccess vs getEntityPermissions), detailed Where query evaluation lifecycle. |

### Matching Flows

| Reference Flow | Auto Flow | Score | Notes |
|---|---|---|---|
| user-login | user-authentication | 3 | Excellent match. Same paths (happy, failed password, locked account, session rollback). Same invariants. Auto adds locked account path explicitly. |
| password-reset | (none) | 0 | Missing. Two-phase token flow, email enumeration prevention, implicit login after reset — all absent. |
| access-evaluation | (none) | 0 | Missing. ExecuteAccess vs getEntityPermissions dual-path, field permission evaluation — all absent. |

## Semantic Coverage Computation

All element scores:

Nodes (17 artifact comparisons): 3,3,2,3,2,3,3,2,3,2,3,3,3,2,2,2,0 = 38/51
Aspects (5 comparisons): 3,2,0,0,2 = 7/15
Flows (3 comparisons): 3,0,0 = 3/9

Total: 48/75

**Semantic coverage = (48/75) / 3 * 3 = 48/75 = 64.0%**

## Decision Capture Rate

Reference decisions (from internals.md across all nodes):

1. Default missing access functions to "allow authenticated" — **captured** (in operations internals, implicit)
2. Run permission evaluations in parallel via Promise.all — **captured** (in operations internals)
3. Always return success for forgot-password — **captured** (not in a node since auth-endpoints missing, but mentioned in flow)
4. Set-Cookie header over body-only token — **not captured** (auth-endpoints missing)
5. pbkdf2 over bcrypt/argon2 — **captured** (strategies internals)
6. 25000 iterations — **captured** (strategies internals, same "unknown" framing)
7. SHA-256 HMAC for API key indexing — **captured** (strategies internals)
8. Keep SHA-1 backward compatibility — **captured** (strategies internals, with v4 removal note)
9. UUID v4 for session IDs — **not captured**
10. Sessions on user document over separate collection — **captured** (token-management internals, as "sessions stored as array on user document")
11. SameSite=Strict default — **captured** (token-management internals)
12. Iterative promise drain over recursive async — **captured** (permissions internals)
13. Synchronous field traversal with async collection — **captured** (permissions internals)
14. In-place mutation for block reference caching — **captured** (permissions internals)
15. Deep equality for Where cache — **captured** (permissions internals)
16. 100-iteration safety limit — **captured** (permissions internals)
17. Atomic $inc for login attempts — **captured** (operations internals)
18. 20-second session revocation window — **captured** (account-lockout aspect)
19. Re-check lock after auth — **captured** (operations internals)
20. Silent null for unknown users in forgotPassword — **not captured** (no forgot-password detail)
21. updatedAt = null for session ops — **captured** (token-management internals)

**Decision capture rate: 18/21 = 85.7%**

## "Why NOT" Capture Rate

Reference "why NOT" (rejected alternatives with rationale):

1. "allow authenticated" over "deny all" — **not captured** (decision present but alternative not framed)
2. pbkdf2 over bcrypt/argon2 — **captured** (same "unknown" framing)
3. SHA-256 HMAC over storing hashed keys directly — **not captured**
4. SHA-1 compat over requiring key regeneration — **captured** (from TODO)
5. UUID v4 over sequential IDs — **not captured**
6. Sessions on user doc over separate collection — **partially captured** (fact stated, not framed as alternative)
7. SameSite=Strict over SameSite=Lax — **not captured**
8. Iterative drain over recursive async — **captured** (same framing)
9. Sync traversal over fully async — **captured**
10. In-place mutation over immutable — **not captured**
11. Deep equality over reference equality — **not captured**
12. 100-iteration limit over no limit — **not captured**
13. Set-Cookie over body-only token — **not captured** (missing node)
14. Atomic $inc over read-modify-write — **not captured** (decision captured but not framed as "chose X over Y")
15. 20-second window over revoking all sessions — **not captured** (window captured, alternative not)
16. Re-check lock over trusting pre-auth check — **not captured**
17. Silent null over throwing error — **not captured** (missing flow)
18. Session updatedAt=null over allowing update — **not captured** (fact captured, not framed as alternative)

Explicitly framed "chose X over Y": 4/18

**"Why NOT" capture rate: 4/18 = 22.2%**

## Fabrication Rate

Reviewing all auto-graph claims for information NOT in reference AND NOT verifiable from source code:

1. `parallel-safety` as standalone aspect — **not fabricated** (valid pattern, just organized differently in reference)
2. `executeAuthStrategies` documented in strategies interface — **not fabricated** (exists in source, just not in reference scope)
3. `parseCookies` documented in token-management — **not fabricated** (exists in source)
4. `getFieldsToSign` crash fix from commit 9f0c101 — **not fabricated** (from git history)
5. `ensureUsernameOrEmail.ts` mapping — **not fabricated** (real file)
6. Hook lifecycle ordering (operation-specific before hooks listed before core logic) — **potentially fabricated/inaccurate** (reference shows core logic THEN operation-specific hooks for most operations; auto description has a different ordering)
7. permissions -> auth/operations relation with `consumes: [executeAccess]` — **misattributed** (entity-permissions does not call executeAccess; it is called BY access-control)

**Fabrication rate: 1/~50 claims = ~2%** (the hook ordering inaccuracy)

Misattributed: 1 (reversed relation direction)
