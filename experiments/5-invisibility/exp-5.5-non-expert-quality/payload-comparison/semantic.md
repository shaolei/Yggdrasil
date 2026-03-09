# Semantic Comparison — Payload CMS Auth

## Artifact Depth Comparison

Scale: **equivalent** (captures same information), **partial** (captures some but misses key details), **minimal** (surface-level only)

### Matching Nodes

#### Auth Operations (core node in both graphs)

| Artifact | E1 Depth | E2 Depth | Rating |
|---|---|---|---|
| responsibility.md | Detailed, 10 operations listed | Shorter, 3 operations detailed | partial |
| interface.md | 6 operations with full signatures, failure modes | 3 operations with signatures, failure modes | partial |
| internals.md | 5 sections, 20-step login flow, detailed parallel safety | 3 sections, 20-step login flow, 3 decisions | equivalent |

The guided operations node captures the most important content (login flow, decisions) at comparable depth but covers fewer operations (missing forgotPassword, resetPassword, verifyEmail, unlock in interface).

#### Access Control

| Artifact | E1 Depth | E2 Depth | Rating |
|---|---|---|---|
| responsibility.md | 4 responsibilities, clear boundaries | 3 responsibilities, clear boundaries | equivalent |
| interface.md | 4 functions with full signatures | 2 functions with signatures | partial |
| internals.md | 4 sections (executeAccess fallback, operations, canAccessAdmin, block refs) | (missing) | minimal |

The guided graph is missing internals for access-control entirely.

#### Entity Permissions

| Artifact | E1 Depth | E2 Depth | Rating |
|---|---|---|---|
| responsibility.md | 6 responsibilities | 3 responsibilities | partial |
| interface.md | 3 functions with full detail | 3 functions with full detail | equivalent |
| internals.md | 5 sections, promise drain, block caching, fetchData behavior | 3 sections, 2 decisions | partial |

#### Auth Infrastructure / Strategy+Primitives (structural mismatch)

The reference has one deep infrastructure node. The guided graph has 6 shallow library nodes. Comparing aggregate content:

| Content Area | E1 | E2 | Rating |
|---|---|---|---|
| Password hashing details | In interface.md + internals.md | In strategies internals | equivalent |
| JWT extraction order | In interface.md + internals.md | In jwt responsibility | partial |
| Session management | In interface.md + internals.md | In sessions interface + session-management aspect | equivalent |
| Cookie generation | In interface.md | In cookies responsibility | partial |
| API key dual-hash | In internals.md | In strategies internals | equivalent |
| getFieldsToSign traversal | In internals.md | In fields-to-sign responsibility | minimal |
| encrypt/decrypt | In interface.md + internals.md | In crypto responsibility | minimal |
| Auth strategies pipeline | In interface.md | In strategies interface + internals | equivalent |

The guided graph's 6 library nodes collectively cover most of the same content but at shallower depth per node. The expert's single node with deep internals captures more implementation nuances.

### Aspects

| Aspect | E1 Depth | E2 Depth | Rating |
|---|---|---|---|
| brute-force-protection | Parallel safety, re-check, 20s window, 5 behaviors | Concurrency model, parallel attack, re-check, 20s window | equivalent |
| hook-lifecycle | 5-step lifecycle, constraint on sequential, falsy pattern | 6-step lifecycle, sequential constraint, falsy pattern | equivalent |
| transaction-safety | init/commit/kill pattern, shouldCommit, incrementLoginAttempts bypass | (missing) | — |
| timing-safe-comparison | What, why, where applied | (missing) | — |
| where-based-access-control / access-control-pattern | Boolean vs Where modes, fetchData, caching, known issue | Boolean vs Where, fetchData, known issue, field-level | equivalent |
| session-management (guided only) | — | Sessions on user doc, updatedAt=null, participants | — |

### Flows

| Flow | E1 Depth | E2 Depth | Rating |
|---|---|---|---|
| user-login | 15-step happy path, failed password, error recovery, 5 invariants | Merged into user-authentication: 10-step login, 10-step subsequent request, 2 failure paths, 5 invariants | partial |
| password-reset | Happy path, silent failure, token expired, 4 invariants | (missing) | — |
| access-evaluation | 3 paths (operation, introspection, field), 4 invariants | (missing) | — |

## Decision Coverage

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 |
|---|---|---|---|
| Total decisions captured | 19 | 6 | 32% |
| Decisions with rationale known | 7 | 5 | 71% |
| Decisions with "rationale: unknown" | 12 | 1 | 8% |

The reference graph captures 19 decisions across 5 internals.md files. The guided graph captures 6 decisions across 3 internals files. The guided graph's decisions are higher quality per decision (5/6 have known rationale vs 7/19 for reference) but covers far fewer.

### Decisions in Reference but Missing from Guided

- pbkdf2 over bcrypt/argon2
- 25000 iterations choice
- SHA-256 HMAC for API key indexing
- UUID v4 for session IDs
- Sessions on user document vs separate collection
- SameSite=Strict default
- Promise.all for parallel permission evaluation
- Iterative promise drain vs recursive async
- Synchronous field traversal with async collection
- In-place mutation for permission objects
- Deep equality for Where cache
- 100-iteration safety limit
- Set-Cookie header over body-only token

### "Why NOT" Coverage

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 |
|---|---|---|---|
| Explicit rejected alternatives | 5 | 3 | 60% |

Reference rejected alternatives:
1. Full-operation transaction (rejected for login)
2. Revoking all sessions on lock (rejected for 20s window)
3. Trusting pre-auth lock check (rejected for re-check)
4. Throwing error for unknown users in forgotPassword (rejected for silent null)
5. Key regeneration on upgrade (rejected for SHA-1 backward compat)

Guided rejected alternatives:
1. Full-operation transaction (rejected for login) -- matches
2. Trusting initial lock check (rejected for re-check) -- matches
3. Leaving orphaned sessions (rejected for revoke-on-error) -- new, valid

## Constraint Coverage

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 |
|---|---|---|---|
| Non-obvious constraints documented | 14 | 8 | 57% |

Key constraints in reference but missing from guided:
- Hook falsy return preserves existing value (the `|| user` pattern)
- `blockReferencesPermissions` shared cache semantics
- `shouldCommit` nested transaction flag
- 100-iteration promise drain safety limit
- encrypt/decrypt `this.secret` binding requirement
- `siblingData`/`blockData` exclusion from field access calls
