# Structural Comparison — Payload CMS Auth

## Node Comparison

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 |
|---|---|---|---|
| Total nodes | 6 (1 parent + 5 children) | 10 (1 parent + 8 children + 1 sibling) | 167% |
| Leaf nodes | 5 | 9 | 180% |
| Node types used | module (4), service (1), infrastructure (1) | module (4), library (5) | different |
| Infrastructure nodes | 1 (auth-infrastructure) | 0 | 0% |

### Node Mapping

| Reference Node | Guided Equivalent | Match Quality |
|---|---|---|
| auth-system (parent) | auth (parent) | equivalent |
| auth-operations | auth/operations | equivalent |
| auth-endpoints | (missing) | MISSING |
| auth-infrastructure | (split into 5 nodes) | split |
| access-control | auth/access-control | equivalent |
| entity-permissions | permissions | equivalent |
| — | auth/strategies | new (was part of auth-infrastructure) |
| — | auth/sessions | new (was part of auth-infrastructure) |
| — | auth/jwt | new (was part of auth-infrastructure) |
| — | auth/cookies | new (was part of auth-infrastructure) |
| — | auth/crypto | new (was part of auth-infrastructure) |
| — | auth/fields-to-sign | new (was part of auth-infrastructure) |

### Key Differences

1. **Granularity mismatch**: The expert bundled all infrastructure primitives (crypto, JWT, sessions, cookies, strategies, fields-to-sign) into a single `auth-infrastructure` node. The guided graph split them into 6 separate library nodes. The guided approach is more granular but loses the "infrastructure" classification.

2. **Missing auth-endpoints**: The guided graph has no node for the HTTP endpoint/handler layer. This is a structural gap — the thin translation layer between HTTP and operations is uncovered.

3. **No infrastructure node type**: The guided graph uses `library` instead of `infrastructure` for the primitive nodes. This loses the semantic signal that these components are invisible in call graphs but affect blast radius.

4. **Permissions location**: Expert placed entity-permissions under auth-system; guided placed it as a sibling (`permissions`). Both map the same files.

## Relation Comparison

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 |
|---|---|---|---|
| Total relations | 4 | 6 | 150% |
| Relations with consumes | 4/4 | 6/6 | — |

| Reference Relation | Guided Equivalent |
|---|---|
| auth-endpoints → auth-operations | MISSING (no endpoints node) |
| auth-endpoints → auth-infrastructure | MISSING |
| auth-operations → auth-infrastructure | Split: operations → strategies, operations → sessions, operations → jwt, operations → fields-to-sign |
| auth-operations → access-control | operations → access-control |
| access-control → entity-permissions | access-control → permissions |

The guided graph has more relations (6 vs 4) because the infrastructure split creates more explicit dependency edges. However, it misses the endpoints layer entirely.

## Aspect Comparison

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 |
|---|---|---|---|
| Total aspects | 5 | 4 | 80% |

| Reference Aspect | Guided Equivalent | Semantic Match |
|---|---|---|
| brute-force-protection | brute-force-protection | equivalent |
| hook-lifecycle-pattern | hook-lifecycle | equivalent |
| transaction-safety | (missing) | MISSING |
| timing-safe-comparison | (missing) | MISSING |
| where-based-access-control | access-control-pattern | partial (covers Where queries but less formally named) |
| — | session-management | NEW (not in reference) |

### Key Differences

1. **Missing transaction-safety**: The guided graph does not capture the transaction commit/rollback pattern as a cross-cutting aspect. Transaction behavior is mentioned in operations internals but not elevated to aspect status.

2. **Missing timing-safe-comparison**: The security requirement for constant-time comparison is not captured as an aspect. It appears in the strategies internals but not as a cross-cutting rule.

3. **New session-management aspect**: The guided graph captured session management as a cross-cutting pattern (sessions on user document, updatedAt=null). The reference graph captured this in auth-infrastructure internals instead.

## Flow Comparison

| Metric | E1 (Expert) | E2 (Guided) | E2/E1 |
|---|---|---|---|
| Total flows | 3 | 1 | 33% |
| Flow participants (avg) | 3.0 | 8 | — |

| Reference Flow | Guided Equivalent |
|---|---|
| user-login | user-authentication (partial — covers login + subsequent request) |
| password-reset | MISSING |
| access-evaluation | MISSING |

### Key Differences

1. **Missing password-reset flow**: The two-phase forgot/reset flow is not captured. This is a significant business process gap.

2. **Missing access-evaluation flow**: The access evaluation process (executeAccess vs getEntityPermissions) is not captured as a flow; some of its content is in the access-control-pattern aspect.

3. **Overly broad single flow**: The guided graph has one large "user-authentication" flow covering login + subsequent requests + failures. This combines what the reference treats as the login flow with JWT strategy behavior, losing the separation of concerns.

4. **Too many participants**: The guided flow lists 8 participants (all nodes) which dilutes the value — a flow where every node participates provides less signal than focused flows.

## File Mapping Coverage

Both graphs map the same core directories:
- `packages/payload/src/auth/` — covered by both
- `packages/payload/src/utilities/getEntityPermissions/` — covered by both

The guided graph has slightly more specific file mappings due to finer-grained nodes. The reference graph uses directory-level mappings more.
