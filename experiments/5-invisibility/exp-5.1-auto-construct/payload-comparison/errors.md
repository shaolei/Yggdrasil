# Phase 7: Error Analysis — Payload CMS

## Error Classification

### Missing (Medium severity)

| # | Element | Description |
|---|---|---|
| M1 | Node: auth-endpoints | Entire HTTP endpoint layer missing. 10+ handlers, cookie handling pattern, wrapInternalEndpoints — all absent. This is a service node with 2 relations in the reference. |
| M2 | Aspect: timing-safe-comparison | Security-critical pattern (timingSafeEqual for password comparison) not extracted as aspect. Content exists in strategies internals but not elevated. |
| M3 | Aspect: transaction-safety | Cross-cutting transaction pattern (initTransaction/commitTransaction/killTransaction) not extracted as aspect. Mentioned in operations internals prose. |
| M4 | Flow: password-reset | Two-phase password reset process (forgot + reset) missing entirely. Includes email enumeration prevention, token lifecycle, implicit re-login. |
| M5 | Flow: access-evaluation | Permission introspection flow (executeAccess vs getEntityPermissions dual-path) missing. |
| M6 | Decision: UUID v4 for session IDs | Not captured anywhere. |
| M7 | Decision: Set-Cookie over body-only token | Not captured (consequence of missing auth-endpoints). |
| M8 | Interface: accessOperation | Thin wrapper with telemetry tracking not documented (consequence of missing auth-endpoints). |
| M9 | Internals: canAccessAdmin evaluation | Logic for determining admin panel access missing from any node. |

### Fabricated (Critical severity)

| # | Element | Description |
|---|---|---|
| F1 | Hook lifecycle ordering | Auto describes operation-specific before hook (e.g., beforeLogin) as step 2, before core logic (step 3). Reference and source code show core logic runs THEN operation-specific after hooks. The before hooks like beforeLogin run AFTER user lookup and password verification, not before. This is a factual inaccuracy in the aspect description. |

**Note:** This is the only fabrication identified. The auto graph generally follows the "rationale: unknown" protocol correctly, avoiding phantom rationale.

### Misattributed (Low severity)

| # | Element | Description |
|---|---|---|
| MA1 | permissions -> auth/operations relation | Direction is reversed. In reference, access-control calls entity-permissions. In auto, permissions `uses` auth/operations. The dependency flows the wrong way. |
| MA2 | Access control content in operations node | executeAccess, defaultAccess, getAccessResults are documented as part of auth/operations rather than as a separate access-control node. The content is correct but located in the wrong node. |
| MA3 | extractJWT mapped to strategies | Reference maps extractJWT to auth-infrastructure. Auto maps it to strategies. Both are defensible, but the reference considers it infrastructure (it extracts tokens for any strategy to use). |
| MA4 | Brute-force functions in strategies vs operations | incrementLoginAttempts/resetLoginAttempts are in auth-infrastructure in reference, but the auto graph maps them as consumed from auth/strategies by auth/operations. The source files are in strategies/ directory, so the auto mapping follows file location while the reference groups by concern. |

### Over-split (Low severity)

| # | Element | Description |
|---|---|---|
| OS1 | auth-infrastructure -> strategies + token-management | Reference has one auth-infrastructure node. Auto splits into auth/strategies (credential verification) and auth/token-management (JWT/cookies/sessions). The split is actually reasonable — these are distinct concerns — but it doesn't match the reference. |

### Under-split (Medium severity)

| # | Element | Description |
|---|---|---|
| US1 | access-control merged into operations | Reference has access-control as a separate node with its own interface (executeAccess, defaultAccess, getAccessResults) and internals (canAccessAdmin, block reference sharing). Auto merges these files into the operations node, losing the clear separation between "checking access for one operation" and "orchestrating auth flows." |
| US2 | auth-endpoints absent (collapsed) | The entire endpoint layer is missing — it may have been conceptually absorbed into operations (the auto builder may not have distinguished HTTP handlers from business logic). |

### Phantom Rationale (Critical severity)

**None identified.** The auto graph consistently uses "rationale: unknown — inferred from code" when it cannot find explicit reasoning. This is the correct protocol behavior. Even in areas where the auto graph provides rationale (e.g., "PBKDF2 is built into Node.js crypto, avoiding native dependencies"), the same speculation appears in the reference graph, making it a shared inference rather than a fabrication.

## Error Summary

| Category | Count | Severity |
|---|---|---|
| Missing | 9 | Medium |
| Fabricated | 1 | Critical |
| Misattributed | 4 | Low |
| Over-split | 1 | Low |
| Under-split | 2 | Medium |
| Phantom rationale | 0 | Critical |

**Total errors: 17**
**Critical errors: 1** (hook lifecycle ordering inaccuracy)
**Fabrication + phantom rationale rate: 1/~50 claims = ~2%** (below 5% threshold)

## Impact of Shallow Clone (2 commits)

The shallow clone (only 2 commits available) had the following measurable effects:

1. **Missing flows (2/3)**: Password-reset and access-evaluation flows require understanding multi-step processes. With full git history, commit sequences like "add forgot-password endpoint" -> "add reset-password operation" -> "connect to email service" would reveal the flow structure. With 2 commits, only code structure analysis was possible.

2. **Missing aspects (2/5)**: timing-safe-comparison and transaction-safety are patterns whose importance is typically signaled by commit messages ("add timing-safe comparison to prevent side-channel attacks") or PR descriptions. Without that signal, the builder treated them as implementation details rather than cross-cutting requirements.

3. **Missing auth-endpoints node**: The endpoint layer is architecturally thin (translates HTTP to operations). Its separation from operations is a design decision that git history would reveal through separate commits touching only endpoint files.

4. **Low "Why NOT" capture rate (22%)**: Rejected alternatives almost always come from PR discussions, commit messages explaining trade-offs, or code review comments. With only 2 commits, the builder had virtually no access to this information. The 22% that was captured came from code comments and TODO annotations.

5. **Positive note**: Despite the severe history limitation, the builder achieved 85.7% decision capture rate by extracting decisions from code structure and inline comments. This suggests that code-only analysis captures WHAT decisions were made but not WHY or what alternatives were considered.
