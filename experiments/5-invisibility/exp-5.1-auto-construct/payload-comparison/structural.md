# Phase 4: Structural Comparison — Payload CMS

## Node Coverage

| Reference Node | Auto Node Match | File Overlap | Match? |
|---|---|---|---|
| auth-system (parent) | auth (parent) | Same root path | Yes |
| auth-system/auth-endpoints | (none) | — | No |
| auth-system/auth-operations | auth/operations | ~80% (operations/ + executeAccess, defaultAccess, getAccessResults, isUserLocked, getLoginOptions shared) | Yes |
| auth-system/auth-infrastructure | auth/strategies + auth/token-management | Split across two auto nodes | Over-split |
| auth-system/access-control | auth/operations (merged) | executeAccess, defaultAccess, getAccessResults mapped into operations | Under-split |
| auth-system/entity-permissions | permissions | Same path (getEntityPermissions/) | Yes |

**Analysis:**

- Reference has 6 nodes (1 parent + 5 children). Auto has 5 nodes (1 parent + 3 children + 1 sibling).
- Direct matches: 3 (parent, operations, entity-permissions)
- Missing: 1 (auth-endpoints — completely absent)
- Over-split: 1 (auth-infrastructure split into strategies + token-management)
- Under-split: 1 (access-control merged into operations)

**Node coverage: 4/5 child nodes have some representation = 80%**

(auth-endpoints is entirely missing; access-control is merged into operations; auth-infrastructure is split but fully covered)

## Relation Coverage

| Reference Relation | Auto Equivalent | Match? |
|---|---|---|
| access-control -> entity-permissions (calls getEntityPermissions) | permissions -> auth/operations (reversed direction, uses executeAccess) | Partial (wrong direction) |
| auth-endpoints -> auth-operations (calls login/logout/etc) | (no auth-endpoints node) | Missing |
| auth-endpoints -> auth-infrastructure (calls cookie generation) | (no auth-endpoints node) | Missing |
| auth-operations -> auth-infrastructure (calls authenticate, hash, jwt, session) | auth/operations -> auth/strategies (calls authenticate, increment, reset) | Partial |
| auth-operations -> auth-infrastructure (continued) | auth/operations -> auth/token-management (calls jwt, session, cookie) | Partial |
| auth-operations -> access-control (calls getAccessResults) | auth/operations -> permissions (calls getAccessResults) | Yes |
| (none) | auth/strategies -> auth/token-management (uses extractJWT) | Extra |

- Reference relations: 5 distinct
- Matched: 2 (operations->infrastructure split into two partial matches, operations->access-control)
- Partially matched: 2 (infrastructure split relations)
- Missing: 2 (all auth-endpoints relations)
- Extra: 1 (strategies->token-management)
- Reversed: 1 (entity-permissions direction is inverted)

**Relation coverage: 3/5 = 60%** (counting partial matches as half)

## Aspect Coverage

| Reference Aspect | Auto Aspect Match | Semantic Match? |
|---|---|---|
| brute-force-protection | account-lockout | Yes (same concern, different name) |
| hook-lifecycle-pattern | hook-lifecycle | Yes |
| timing-safe-comparison | (none — mentioned in strategies internals but not an aspect) | Missing |
| transaction-safety | (none — mentioned in operations internals but not an aspect) | Missing |
| where-based-access-control | access-control | Partial (broader — covers all access control, not just Where-based) |

- Auto also has: parallel-safety (no reference equivalent as standalone aspect — this is covered within brute-force-protection in the reference)

**Aspect coverage: 3/5 = 60%** (counting partial as 0.5)

Actually: brute-force-protection=yes, hook-lifecycle=yes, where-based-access-control=partial → 2.5/5 = 50%

Revised: **Aspect coverage: 2.5/5 = 50%**

## Flow Coverage

| Reference Flow | Auto Flow Match | Match? |
|---|---|---|
| user-login | user-authentication | Yes (same process, broader scope) |
| password-reset | (none) | Missing |
| access-evaluation | (none) | Missing |

**Flow coverage: 1/3 = 33%**

## File Mapping Precision & Recall

**Precision** (% of auto mappings that are correct): All auto file mappings reference real, relevant source paths. Some files are mapped to different nodes than reference (e.g., extractJWT in strategies vs infrastructure). Precision: ~90%

**Recall** (% of reference mappings present in auto): The auto graph maps most files but misses `packages/payload/src/auth/endpoints/` entirely. Also adds files not in reference (ensureUsernameOrEmail.ts, extractAccessFromPermission.ts, executeAuthStrategies.ts). Recall: ~85%

## Node Granularity Match

| Reference Node | Auto Granularity | Match? |
|---|---|---|
| auth-system | auth | Same | Yes |
| auth-endpoints | (missing) | — | No |
| auth-operations | auth/operations (includes access-control files) | Coarser | No |
| auth-infrastructure | auth/strategies + auth/token-management | Finer | No |
| access-control | (merged into operations) | Coarser | No |
| entity-permissions | permissions | Same | Yes |

**Granularity match: 2/6 = 33%**

## Structural Coverage Summary

| Metric | Score |
|---|---|
| Node coverage | 80% |
| Relation coverage | 60% |
| Aspect coverage | 50% |
| Flow coverage | 33% |
| File mapping precision | 90% |
| File mapping recall | 85% |
| Granularity match | 33% |

**Structural coverage (mean of node, relation, aspect, flow) = (80 + 60 + 50 + 33) / 4 = 55.75%**

**Structural precision** (auto elements with reference counterpart):
- Nodes: 4/4 child nodes have some reference basis = 100%
- Aspects: 3/4 have reference basis (parallel-safety is extra but valid) = 75%
- Flows: 1/1 = 100%
- Relations: 4/5 have basis = 80%
- Mean precision: ~89%

## Impact of Shallow Clone (2 commits)

The shallow clone significantly impacted structural quality:

1. **Missing auth-endpoints node**: Without git history showing the endpoint layer evolving separately from operations, the auto-builder likely could not distinguish the thin HTTP layer from the operation layer.
2. **Missing flows**: password-reset and access-evaluation flows require understanding multi-step processes that commit history would reveal. With only 2 commits, the builder had to infer everything from code structure alone.
3. **Missing aspects**: timing-safe-comparison and transaction-safety are patterns whose significance is best understood from commit messages explaining security decisions. Without that history, they were noted in prose but not elevated to aspects.
4. **Over/under-split**: The decomposition differs because git history normally shows which files change together, revealing natural module boundaries. Without it, the builder relied on file organization heuristics.
