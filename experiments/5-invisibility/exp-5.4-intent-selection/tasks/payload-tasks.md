# Payload Tasks — Experiment 5.4

## Graph Summary

**Nodes (5 leaf + 1 parent):**
- `auth-system` (parent module)
- `auth-system/access-control` (module) — executeAccess, getAccessResults
- `auth-system/auth-endpoints` (service) — HTTP endpoint handlers
- `auth-system/auth-infrastructure` (infrastructure) — crypto, JWT, sessions, cookies
- `auth-system/auth-operations` (module) — login, logout, forgot/reset password logic
- `auth-system/entity-permissions` (module) — field-level and entity-level permissions

**Aspects:** brute-force-protection, hook-lifecycle-pattern, timing-safe-comparison, transaction-safety, where-based-access-control
**Flows:** user-login (endpoints, operations, infrastructure), password-reset (endpoints, operations, infrastructure), access-evaluation (access-control, entity-permissions)

---

## Tasks

### T01 — Single-module
**Description:** "Add support for argon2id password hashing as an alternative to pbkdf2."
**Complexity:** single-module
**Expert-selected nodes:** `auth-infrastructure`
**Relevant aspects:** timing-safe-comparison
**Rationale:** Only touches crypto.ts; must maintain timing-safe comparison.

### T02 — Single-module
**Description:** "Add a new access control function type that checks if the current time is within allowed business hours."
**Complexity:** single-module
**Expert-selected nodes:** `access-control`
**Relevant aspects:** where-based-access-control
**Rationale:** New access function variant; must return boolean or Where query.

### T03 — Single-module
**Description:** "Fix a bug where expired sessions are not cleaned up when a user logs in from a new device."
**Complexity:** single-module
**Expert-selected nodes:** `auth-infrastructure`
**Relevant aspects:** (none specific)
**Rationale:** Session management is in auth-infrastructure (sessions.ts).

### T04 — Cross-module
**Description:** "Add rate limiting to the login endpoint that returns a 429 status code with a Retry-After header."
**Complexity:** cross-module
**Expert-selected nodes:** `auth-endpoints`, `auth-operations`
**Relevant aspects:** brute-force-protection
**Rationale:** Endpoints handle HTTP response; operations have the brute-force logic that tracks attempts.

### T05 — Cross-module
**Description:** "When a user resets their password, revoke all existing sessions across all devices."
**Complexity:** cross-module
**Expert-selected nodes:** `auth-operations`, `auth-infrastructure`
**Relevant aspects:** transaction-safety
**Relevant flows:** password-reset
**Rationale:** Reset logic in operations; session revocation in infrastructure.

### T06 — Cross-module
**Description:** "Add field-level access control that restricts which fields are visible in the permission introspection API."
**Complexity:** cross-module
**Expert-selected nodes:** `access-control`, `entity-permissions`
**Relevant aspects:** where-based-access-control
**Relevant flows:** access-evaluation
**Rationale:** Access control invokes entity-permissions for field-level checks.

### T07 — Flow-spanning
**Description:** "Add two-factor authentication (TOTP) as an additional step in the login flow, between password verification and session creation."
**Complexity:** flow-spanning
**Expert-selected nodes:** `auth-endpoints`, `auth-operations`, `auth-infrastructure`
**Relevant aspects:** hook-lifecycle-pattern, transaction-safety
**Relevant flows:** user-login
**Rationale:** Spans the entire login flow: endpoint receives TOTP code, operations validate it, infrastructure verifies the secret.

### T08 — Flow-spanning
**Description:** "Add an audit trail that logs every authentication attempt, password reset, and access check with the user's IP and timestamp."
**Complexity:** flow-spanning
**Expert-selected nodes:** `auth-endpoints`, `auth-operations`, `access-control`
**Relevant aspects:** hook-lifecycle-pattern
**Relevant flows:** user-login, password-reset, access-evaluation
**Rationale:** Spans all three flows; needs hook integration points.

### T09 — Constraint-aware
**Description:** "Add caching to the permission introspection endpoint to avoid re-evaluating access functions on every request."
**Complexity:** constraint-aware
**Expert-selected nodes:** `access-control`, `entity-permissions`
**Relevant aspects:** where-based-access-control
**Rationale:** Must understand that Where queries are context-dependent (user, document) so caching must be per-user and invalidated on data changes.

### T10 — Ambiguous
**Description:** "Improve the security of the authentication system."
**Complexity:** ambiguous
**Expert-selected nodes:** `auth-operations`, `auth-infrastructure`, `auth-endpoints`, `access-control`
**Relevant aspects:** brute-force-protection, timing-safe-comparison, transaction-safety
**Rationale:** Ambiguous — could mean stronger hashing, better brute-force protection, session hardening, or access control improvements. Expert selects broadly.
