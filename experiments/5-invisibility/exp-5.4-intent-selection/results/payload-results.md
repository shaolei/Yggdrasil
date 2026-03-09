# Payload Results — Experiment 5.4

## Node Reference

| Short Name | Full Path |
|---|---|
| access | auth-system/access-control |
| endpoints | auth-system/auth-endpoints |
| infra | auth-system/auth-infrastructure |
| operations | auth-system/auth-operations |
| entity-perm | auth-system/entity-permissions |

## Algorithm Execution

### S1: Keyword Matching

| Task | Keywords | Selected (top by score) |
|---|---|---|
| T01 | argon2id, password, hashing, pbkdf2, alternative | infra (very high: "pbkdf2", "password", "hashing" in resp+iface), operations (low: "password") | infra |
| T02 | access, control, function, time, business, hours | access (very high: "access control function"), entity-perm (low: "access") | access |
| T03 | expired, sessions, cleanup, login, device | infra (high: "sessions", "removeExpiredSessions"), operations (med: "session") | infra, operations |
| T04 | rate, limiting, login, endpoint, 429, Retry-After | endpoints (high: "login endpoint"), operations (high: "login", "brute-force"), infra (low: "login") | endpoints, operations |
| T05 | password, resets, revoke, sessions, devices | operations (high: "reset-password", "session"), infra (high: "revokeSession", "sessions") | operations, infra |
| T06 | field-level, access, control, permissions, introspection | access (high: "access control"), entity-perm (very high: "field-level permissions") | entity-perm, access |
| T07 | two-factor, TOTP, login, flow, password, verification, session | operations (high: "login", "password verification", "session"), endpoints (high: "login endpoint"), infra (high: "session", "JWT") | operations, endpoints, infra |
| T08 | audit, trail, authentication, attempt, password, reset, access, check, IP, timestamp | operations (high: "authentication attempt"), endpoints (med: "endpoint"), access (high: "access check"), infra (low) | operations, access, endpoints |
| T09 | caching, permission, introspection, endpoint, access, functions | access (high: "access functions"), entity-perm (high: "permission introspection", "caching") | access, entity-perm |
| T10 | improve, security, authentication, system | operations (med: "authentication"), infra (med: "security", "crypto"), endpoints (low), access (low) | operations, infra |

### S2: Flow-Based

| Task | Flow Match? | Selected |
|---|---|---|
| T01 | "password" + "hashing" → no strong flow match → fallback S1 | infra |
| T02 | "access control" matches access-evaluation → participants | access, entity-perm |
| T03 | "sessions" + "login" matches user-login → participants | endpoints, operations, infra |
| T04 | "login" + "endpoint" matches user-login → participants | endpoints, operations, infra |
| T05 | "password resets" + "sessions" matches password-reset → participants | endpoints, operations, infra |
| T06 | "access control" + "permissions" matches access-evaluation → participants | access, entity-perm |
| T07 | "login flow" matches user-login → participants | endpoints, operations, infra |
| T08 | "authentication attempt" matches user-login + "password reset" matches password-reset + "access check" matches access-evaluation → union | endpoints, operations, infra, access, entity-perm |
| T09 | "permission introspection" matches access-evaluation → participants | access, entity-perm |
| T10 | "authentication" matches user-login → participants | endpoints, operations, infra |

### S3: Relation Traversal

| Task | Seeds (S1 top-2) | Traversal | Selected (K≤5) |
|---|---|---|---|
| T01 | infra, operations | infra has no outgoing relations; operations→{infra, access}; endpoints depends on infra (dependent) | infra, operations, access, endpoints |
| T02 | access, entity-perm | access→{entity-perm}; entity-perm has no outgoing; operations depends on access (dependent) | access, entity-perm, operations |
| T03 | infra, operations | operations→{infra, access}; endpoints depends on infra | infra, operations, access, endpoints |
| T04 | endpoints, operations | endpoints→{operations, infra}; operations→{infra, access} | endpoints, operations, infra, access |
| T05 | operations, infra | operations→{infra, access}; endpoints depends on operations | operations, infra, access, endpoints |
| T06 | entity-perm, access | access→{entity-perm}; operations depends on access | entity-perm, access, operations |
| T07 | operations, endpoints | endpoints→{operations, infra}; operations→{infra, access} | operations, endpoints, infra, access |
| T08 | operations, access | operations→{infra, access}; endpoints depends on operations | operations, access, infra, endpoints |
| T09 | access, entity-perm | access→{entity-perm}; operations depends on access | access, entity-perm, operations |
| T10 | operations, infra | operations→{infra, access}; endpoints depends on infra | operations, infra, access, endpoints |

---

## Metrics

### Per-Task Precision / Recall / F1

| Task | Expert | S1 Sel | S1 P | S1 R | S1 F1 | S2 Sel | S2 P | S2 R | S2 F1 | S3 Sel | S3 P | S3 R | S3 F1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T01 | infra | infra | 1.00 | 1.00 | 1.00 | infra | 1.00 | 1.00 | 1.00 | 4 | 0.25 | 1.00 | 0.40 |
| T02 | access | access | 1.00 | 1.00 | 1.00 | access, ep | 1.00 | 1.00 | 1.00 | 3 | 0.33 | 1.00 | 0.50 |
| T03 | infra | infra, ops | 0.50 | 1.00 | 0.67 | endp, ops, infra | 0.33 | 1.00 | 0.50 | 4 | 0.25 | 1.00 | 0.40 |
| T04 | endp, ops | endp, ops | 1.00 | 1.00 | 1.00 | endp, ops, infra | 0.67 | 1.00 | 0.80 | 4 | 0.50 | 1.00 | 0.67 |
| T05 | ops, infra | ops, infra | 1.00 | 1.00 | 1.00 | endp, ops, infra | 0.67 | 1.00 | 0.80 | 4 | 0.50 | 1.00 | 0.67 |
| T06 | access, ep | ep, access | 1.00 | 1.00 | 1.00 | access, ep | 1.00 | 1.00 | 1.00 | 3 | 0.67 | 1.00 | 0.80 |
| T07 | endp, ops, infra | ops, endp, infra | 1.00 | 1.00 | 1.00 | endp, ops, infra | 1.00 | 1.00 | 1.00 | 4 | 0.75 | 1.00 | 0.86 |
| T08 | endp, ops, access | ops, access, endp | 1.00 | 1.00 | 1.00 | all 5 | 0.60 | 1.00 | 0.75 | 4 | 0.75 | 1.00 | 0.86 |
| T09 | access, ep | access, ep | 1.00 | 1.00 | 1.00 | access, ep | 1.00 | 1.00 | 1.00 | 3 | 0.67 | 1.00 | 0.80 |
| T10 | ops, infra, endp, access | ops, infra | 1.00 | 0.50 | 0.67 | endp, ops, infra | 0.75 | 0.75 | 0.75 | 4 | 0.75 | 0.75 | 0.75 |

**Legend:** access=access-control, endp=auth-endpoints, infra=auth-infrastructure, ops=auth-operations, ep=entity-permissions

### Aggregate Metrics

| Algorithm | Mean Precision | Mean Recall | Mean F1 |
|---|---|---|---|
| **S1** | **0.95** | **0.95** | **0.93** |
| **S2** | **0.80** | **0.98** | **0.86** |
| **S3** | **0.54** | **0.98** | **0.67** |

### By Task Type

| Type | S1 P / R / F1 | S2 P / R / F1 | S3 P / R / F1 |
|---|---|---|---|
| Single-module (T01-T03) | 0.83 / 1.00 / 0.89 | 0.78 / 1.00 / 0.83 | 0.28 / 1.00 / 0.43 |
| Cross-module (T04-T06) | 1.00 / 1.00 / 1.00 | 0.78 / 1.00 / 0.87 | 0.56 / 1.00 / 0.71 |
| Flow-spanning (T07-T08) | 1.00 / 1.00 / 1.00 | 0.80 / 1.00 / 0.88 | 0.75 / 1.00 / 0.86 |
| Constraint-aware (T09) | 1.00 / 1.00 / 1.00 | 1.00 / 1.00 / 1.00 | 0.67 / 1.00 / 0.80 |
| Ambiguous (T10) | 1.00 / 0.50 / 0.67 | 0.75 / 0.75 / 0.75 | 0.75 / 0.75 / 0.75 |

### Observations

- **S1 wins clearly** with 0.95/0.95 precision/recall.
- **S2 shows strong performance** (0.80/0.98) — Payload's 3 distinct flows provide good discrimination. S2 matches the right flow for most tasks.
- **S3 over-selects** because operations is a hub node connected to most other nodes.
- **S1's weakness** is the ambiguous task (T10) where it missed 2 of 4 expert nodes.
- **S2 handles ambiguous tasks better** than S1 by selecting the login flow participants.
- Payload's richer flow structure (3 flows with distinct participants) makes it the best discriminator between S1 and S2.
