# Experiment 4.6: Aspect Staleness Prediction — Results

## Setup

**Repository:** Hoppscotch (`/workspaces/hoppscotch/`), 6040 commits, active development
**Graph creation date:** March 3, 2026 (from current HEAD at commit 1119a22, Feb 26 2026)
**Aspects analyzed:** 5 (pessimistic-locking, pubsub-events, retry-on-deadlock, role-based-access, team-ownership)

**Important context:** The Yggdrasil graph was created from the **current** codebase, meaning claims were extracted from the latest code. For staleness analysis, I use a dual approach:

1. **Scenario A (Current):** Verify all claims against current code (should yield ~0% staleness since graph is fresh)
2. **Scenario B (Simulated):** Simulate what would happen if the graph had been created at tag `2025.8.0` (Aug 27, 2025) — about 6 months earlier — and then check which claims would be stale against current code

Scenario B is the scientifically interesting one for testing predictive signals.

---

## 1. Per-Aspect Claim Analysis

### 1.1 Pessimistic Locking

**Nodes carrying this aspect:** team-collection-service, team-request-service
**Mapped files:** `team-collection.service.ts`, `team-request.service.ts`

#### Claims extracted from aspect content

| # | Claim | Status (Current) | Status (at 2025.8.0) |
|---|-------|-------------------|----------------------|
| 1 | Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first | TRUE | **STALE** — used TABLE-LEVEL lock (`lockTableExclusive`) for collections, not row-level |
| 2 | Uses `prisma.$transaction` | TRUE | TRUE |
| 3 | Calls `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` to lock sibling rows | TRUE | **STALE** — used `lockTableExclusive(tx, 'TeamCollection')` and `acquireLocks(tx, ...)` instead |
| 4 | Lock scoped to `(teamID, parentID)` — locks siblings, not the entire team | TRUE | **STALE** — `lockTableExclusive` locked the ENTIRE `TeamCollection` table |
| 5 | Read current state after acquiring lock | TRUE | TRUE |
| 6 | Perform mutations inside transaction | TRUE | TRUE |
| 7 | Transaction commits, releasing locks | TRUE | TRUE |
| 8 | Optimistic locking rejected because reorder touches many siblings | TRUE | UNKNOWN (decision may not have been documented at that point, but the architectural choice existed) |
| 9 | Operations on different subtrees can proceed in parallel | TRUE | **STALE** — table-level lock serialized ALL operations |

**Current staleness: 0/9 = 0%**
**Simulated staleness (from 2025.8.0): 4/9 = 44%**

The key change was commit `18249909` (Jan 22, 2026): "Fixed Row level locking to prevent deadlocks and achieve ~100x performance improvement." This commit replaced the centralized `acquireLocks` and `lockTableExclusive` methods with specific `lockTeamCollectionByTeamAndParent` and `lockTeamRequestByCollections` functions, fundamentally changing the locking granularity from table-level to row-level.

### 1.2 PubSub Events

**Nodes carrying this aspect:** team-collection-service, team-request-service, team-service, team-invitation-service, team-environments-service, admin-service, user-service (7 total)
**Mapped files:** 7 service files

#### Claims extracted from aspect content

| # | Claim | Status (Current) | Status (at 2025.8.0) |
|---|-------|-------------------|----------------------|
| 1 | Every mutation publishes a PubSub event for real-time updates | TRUE | TRUE |
| 2 | Channel naming: `team_coll/${teamID}/coll_added` | TRUE | TRUE |
| 3 | Channel naming: `team_coll/${teamID}/coll_updated` | TRUE | TRUE |
| 4 | Channel naming: `team_coll/${teamID}/coll_removed` | TRUE | TRUE |
| 5 | Channel naming: `team_coll/${teamID}/coll_moved` | TRUE | TRUE |
| 6 | Channel naming: `team_coll/${teamID}/coll_order_updated` | TRUE | TRUE |
| 7 | Events published AFTER transaction commits | TRUE | TRUE |
| 8 | Exception: `deleteCollectionAndUpdateSiblingsOrderIndex` publishes after retry loop | TRUE | TRUE |
| 9 | Added/Updated/Moved payload: full `TeamCollection` model | TRUE | TRUE |
| 10 | Removed payload: just the collection ID string | TRUE | TRUE |
| 11 | Order updated payload: `{ collection, nextCollection }` pair | TRUE | TRUE |

**Current staleness: 0/11 = 0%**
**Simulated staleness (from 2025.8.0): 0/11 = 0%**

The PubSub pattern was completely stable across the entire period. No structural changes to channel naming, payload shapes, or timing semantics. The commits that touched these files added new features (mock server, API documentation, alphabetical sort) but preserved the existing PubSub contract.

### 1.3 Retry on Deadlock

**Nodes carrying this aspect:** team-collection-service (only)
**Mapped files:** `team-collection.service.ts`

#### Claims extracted from aspect content

| # | Claim | Status (Current) | Status (at 2025.8.0) |
|---|-------|-------------------|----------------------|
| 1 | Delete+reorder operations use a retry loop | TRUE | TRUE |
| 2 | Retries only for `UNIQUE_CONSTRAINT_VIOLATION` | TRUE | TRUE |
| 3 | Retries only for `TRANSACTION_DEADLOCK` | TRUE | TRUE |
| 4 | Retries only for `TRANSACTION_TIMEOUT` | TRUE | TRUE |
| 5 | Non-matching errors are NOT retried | TRUE | TRUE |
| 6 | Maximum retries: 5 (`MAX_RETRIES`) | TRUE | TRUE |
| 7 | Linear backoff: `retryCount * 100ms` | TRUE | TRUE |
| 8 | On exhaustion: returns `E.left(TEAM_COL_REORDERING_FAILED)` | TRUE | TRUE |
| 9 | Only applies to `deleteCollectionAndUpdateSiblingsOrderIndex` | TRUE | TRUE |
| 10 | Other order mutations rely solely on pessimistic locking | TRUE | TRUE |
| 11 | Rationale: linear backoff sufficient for short lock contention window | TRUE | TRUE |

**Current staleness: 0/11 = 0%**
**Simulated staleness (from 2025.8.0): 0/11 = 0%**

The retry mechanism was completely unchanged between 2025.8.0 and the current code. This is the most stable aspect, with zero claim drift across the 6-month period despite 14 commits touching the team-collection directory.

### 1.4 Role-Based Access

**Nodes carrying this aspect:** team-service, admin-service, team-invitation-service
**Mapped files:** `team.service.ts`, `admin.service.ts`, `team-invitation.service.ts`

#### Claims extracted from aspect content

| # | Claim | Status (Current) | Status (at 2025.8.0) |
|---|-------|-------------------|----------------------|
| 1 | Three roles: OWNER, EDITOR, VIEWER (TeamAccessRole enum) | TRUE | TRUE (enum was renamed from `TeamMemberRole` to `TeamAccessRole` in commit f26d32c4, but the values are the same) |
| 2 | TeamService enforces sole-OWNER invariant before role change or leave | TRUE | TRUE |
| 3 | AdminService checks `isAdmin` flag before admin operations | TRUE | TRUE |
| 4 | Admin users cannot be deleted without removing admin status | TRUE | TRUE |
| 5 | At least one admin must always remain | TRUE | TRUE |
| 6 | TeamInvitationService verifies creator is a team member | TRUE | TRUE |
| 7 | Invitation creation does not check specific role levels | TRUE | TRUE |
| 8 | Most role-based ACL in resolvers/guards, not services | TRUE | TRUE |
| 9 | Admin status (`isAdmin`) separate from team roles | TRUE | TRUE |
| 10 | First user auto-elevated to admin | TRUE | UNKNOWN (cannot verify from service code alone; this is likely in the auth flow) |

**Current staleness: 0/10 = 0%**
**Simulated staleness (from 2025.8.0): 0/10 = 0%**

The role-based access patterns were completely stable. The only change was the enum rename from `TeamMemberRole` to `TeamAccessRole` (commit f26d32c4), which is a naming-only change that does not affect any behavioral claims.

### 1.5 Team Ownership

**Nodes carrying this aspect:** team-collection-service, team-request-service, team-invitation-service, team-environments-service
**Mapped files:** 4 service files

#### Claims extracted from aspect content

| # | Claim | Status (Current) | Status (at 2025.8.0) |
|---|-------|-------------------|----------------------|
| 1 | TeamRequestService verifies target collection belongs to team via `getTeamOfCollection` | TRUE | TRUE |
| 2 | Cross-team request creation rejected with `TEAM_INVALID_ID` | TRUE | TRUE |
| 3 | TeamEnvironmentsService `getTeamEnvironmentForCLI` verifies user is team member | TRUE | TRUE |
| 4 | Non-members receive `TEAM_MEMBER_NOT_FOUND` | TRUE | TRUE |
| 5 | TeamInvitationService verifies target team exists | TRUE | TRUE |
| 6 | TeamInvitationService verifies creator is member of target team | TRUE | TRUE |
| 7 | TeamCollectionService move operations verify same team (`TEAM_COLL_NOT_SAME_TEAM`) | TRUE | TRUE |
| 8 | `TeamCollection.teamID` — collection belongs to team | TRUE | TRUE |
| 9 | `TeamRequest.teamID` — request belongs to team | TRUE | TRUE |
| 10 | `TeamEnvironment.teamID` — environment belongs to team | TRUE | TRUE |
| 11 | `TeamInvitation.teamID` — invitation for specific team | TRUE | TRUE |
| 12 | No cross-team sharing | TRUE | TRUE |

**Current staleness: 0/12 = 0%**
**Simulated staleness (from 2025.8.0): 0/12 = 0%**

Team ownership patterns were completely stable. The data model invariants (teamID foreign keys, membership checks) were not affected by any of the feature additions.

---

## 2. Git Signal Data

### Scenario A: Signals from full 2-year window (since 2024-03-04)

| Aspect | Staleness% (Current) | Commits(2y) | Commits(1y) | Commits(6m) | Churn(+/-) | Feat | Fix | Refactor | NewFiles |
|--------|---------------------|-------------|-------------|-------------|------------|------|-----|----------|----------|
| pessimistic-locking | 0% | 27 | 15 | 10 | 1412/792 | 13 | 12 | 6 | 7 |
| pubsub-events | 0% | 43 | 19 | 11 | 1723/896 | 26 | 14 | 8 | 8 |
| retry-on-deadlock | 0% | 25 | 14 | 10 | 1159/668 | 13 | 10 | 6 | 7 |
| role-based-access | 0% | 17 | 7 | 3 | 152/70 | 11 | 5 | 2 | 6 |
| team-ownership | 0% | 31 | 16 | 10 | 1465/811 | 15 | 13 | 7 | 7 |

**Aspect definition files:** Never committed to git (created in working tree during experiments). AspectFileUpdated = N/A for all.

### Scenario B: Signals since 2025.8.0 (simulated graph creation point)

| Aspect | Staleness% (Simulated) | Commits(since) | Feat | Fix | Refactor | Churn(+/-) |
|--------|----------------------|----------------|------|-----|----------|------------|
| pessimistic-locking | **44%** | 13 | 6 | 3 | 2 | 557/399 |
| pubsub-events | 0% | 13 | 8 | 3 | 0 | 621/417 |
| retry-on-deadlock | 0% | 13* | 6 | 3 | 2 | 557/399* |
| role-based-access | 0% | 4 | 2 | 0 | 0 | 56/13 |
| team-ownership | 0% | 11 | 6 | 3 | 0 | 563/402 |

*retry-on-deadlock uses same files as pessimistic-locking at the directory level, but its specific mechanism was untouched.

---

## 3. Correlation Analysis

### 3.1 Do git signals predict staleness?

**Commit count: NO.**

- pessimistic-locking (13 commits, 44% stale) and pubsub-events (13 commits, 0% stale) have identical commit counts but vastly different staleness.
- team-ownership (11 commits, 0% stale) has nearly as many commits as the stale aspect.
- Commit count alone has no predictive power.

**Feature commits: NO.**

- pubsub-events has MORE feature commits (8) than pessimistic-locking (6) but zero staleness.
- Features were additive and did not change existing PubSub contracts.

**Fix commits: WEAK SIGNAL, but misleading.**

- pessimistic-locking has 3 fix commits since 2025.8.0 (and team-ownership also has 3 fix commits, with 0% staleness).
- One specific fix commit (18249909) is responsible for ALL the staleness. But fix commits in other aspects (team-ownership) did not cause staleness.
- The signal is not "fix commits exist" but rather "a fix commit touched the specific mechanism the aspect describes." This requires semantic understanding, not just counting.

**Churn rate: NO.**

- pessimistic-locking (557 added / 399 deleted) and pubsub-events (621 added / 417 deleted) have similar churn, with opposite staleness outcomes.
- Churn measures volume of change, not whether the change affected the specific pattern an aspect describes.

**New files: NO.**

- All aspects had similar numbers of new files (6-8). No correlation.

**Refactoring commits: NO.**

- pessimistic-locking has 2 refactor commits (one of which is relevant), but so do other stable aspects.

### 3.2 Why do no signals correlate?

The fundamental problem is that **aspects describe cross-cutting behavioral patterns**, not files. Git signals are file-level. A commit can:

1. **Touch an aspect-covered file without changing the aspect's pattern** — Most common case. Adding alphabetical sort (81fe98f2) touches team-collection.service.ts heavily but does not change locking, PubSub, retry, or ownership patterns.

2. **Change the aspect's pattern without the commit message revealing it** — The critical commit (18249909) was titled "fix: add teamID/userUid filter to updateMany queries, Fixed Row level locking..." — the locking change was a secondary part of a larger fix. Its commit message does not contain keywords like "lock" in a way distinguishable from other fix commits.

3. **Have identical file-level signals for different semantic outcomes** — pessimistic-locking and retry-on-deadlock share the same mapped files (team-collection-service) and thus identical file-level git signals. Yet one became 44% stale while the other stayed at 0%.

This demonstrates that **aspect staleness is semantically invisible at the file level**. The staleness is about whether a specific behavioral invariant (e.g., "locks are row-level, scoped to teamID+parentID") still holds, not whether the file was modified.

### 3.3 Threshold analysis

No threshold can be established because:

- **Sensitivity is 100% at threshold 0** — All aspects with 0 commits since graph creation have 0% staleness (trivially true)
- **False positive rate is unacceptably high at any commit-count threshold** — At threshold > 0, all 5 aspects are flagged (100% false positive rate for the 4 that are stable)
- **The only aspect with actual staleness (pessimistic-locking at 44%) cannot be distinguished from the others by any available signal**

### 3.4 What about commit message analysis?

Searching for keywords specific to each aspect's pattern:

| Aspect | Keyword | Commit hits (since 2025.8.0) | True positive? |
|--------|---------|------------------------------|----------------|
| pessimistic-locking | "lock" | 1 (18249909) | YES |
| retry-on-deadlock | "retry" OR "deadlock" | 1 (18249909) | FALSE (commit mentioned deadlock in title but didn't change retry mechanism) |
| pubsub-events | "pubsub" OR "event" OR "publish" | 0 | N/A |
| role-based-access | "role" OR "access" | 0 | N/A |
| team-ownership | "team" OR "ownership" | Many false positives | N/A |

Keyword matching on commit messages gives a weak signal for pessimistic-locking (1 true positive, but "deadlock" in the same commit creates a false positive for retry-on-deadlock). The approach is fragile and depends on developers using aspect-relevant keywords in commit messages.

---

## 4. Predictive Heuristics Assessment

### 4.1 Tested heuristics

| Heuristic | Prediction accuracy | False positive rate | False negative rate |
|-----------|-------------------|--------------------|--------------------|
| Commits > N threshold | Cannot distinguish 44% stale from 0% stale | 80% (4/5 flagged wrongly) | 0% |
| Feature commits > N | Cannot distinguish | 60-80% | 0% |
| Fix commits > N | Cannot distinguish | 40-60% | Depends on threshold |
| Churn > N lines | Cannot distinguish | 80% | 0% |
| Commit message keywords | 1 true positive out of 1 | 1 false positive (retry-on-deadlock) | 0% |
| New files added | Cannot distinguish | 80% | 0% |

### 4.2 Conclusion on predictive power

**No file-level git signal reliably predicts aspect staleness.**

The core reason: aspects describe *behavioral invariants* that cross-cut file boundaries. File-level changes may or may not affect a behavioral invariant. The only way to detect aspect staleness is to:

1. **Diff the specific aspect-pattern code** — e.g., search for changes to locking calls specifically, not just any change to the file. This requires knowing what code implements the aspect, which is essentially a semantic diff.

2. **Parse commit content (diffs), not just metadata** — The commit that caused staleness modified `acquireLocks` to `lockTeamCollectionByTeamAndParent`. Only by inspecting the diff content could this be detected.

---

## 5. Aspect Stability Spectrum

From this experiment, aspects fall into a clear stability spectrum:

| Stability tier | Aspect | Staleness (6 months) | Why |
|---------------|--------|---------------------|-----|
| **High stability** | pubsub-events | 0% | Pattern is additive (new channels added, existing ones preserved). PubSub contracts are append-only by nature. |
| **High stability** | team-ownership | 0% | Data model invariants (FK relationships) are structurally enforced. Changing them would require schema migration. |
| **High stability** | role-based-access | 0% | Role system is deeply embedded in data model and auth flow. Changes would be massive and deliberate. |
| **High stability** | retry-on-deadlock | 0% | Narrow scope (single method), mature implementation, no reason to change unless retry logic becomes a problem. |
| **Low stability** | pessimistic-locking | 44% | Implementation-specific (lock mechanism API calls), subject to performance optimization. A single fix commit changed 44% of claims. |

### Key insight: Aspect stability correlates with WHERE the pattern is enforced

- **Schema/data-model patterns** (team-ownership, role-based-access) are the most stable because changing them requires deliberate migration effort.
- **Protocol patterns** (pubsub-events) are stable because they form contracts between components. Breaking them causes visible failures.
- **Implementation-detail patterns** (pessimistic-locking) are the least stable because they can be changed for performance reasons without affecting external behavior.

This matches the theoretical prediction from Experiment 5 (time-decay): aspects that describe HOW something is done decay faster than aspects describing WHAT must be true.

---

## 6. Recommendations for Aspect Maintenance Strategy

### 6.1 Aspect staleness cannot be predicted from git signals

**This is a negative result.** File-level git metadata (commit counts, churn, commit types, new files) does not reliably predict whether an aspect's behavioral claims are still accurate. The experiment shows that:

- An aspect can be 44% stale with the same git signals as a 0% stale aspect
- The same files can host multiple aspects with different staleness rates
- Commit messages rarely contain aspect-relevant keywords

### 6.2 Recommended maintenance approach (instead of prediction)

Since staleness cannot be predicted, it must be **actively checked**:

1. **Aspect-pattern-aware diff detection.** Instead of counting commits, parse diffs for changes to specific code patterns that implement each aspect. For pessimistic-locking, watch for changes to `lockTeam*`, `acquireLocks`, `lockTable*`, or `FOR UPDATE` calls. This is a semantic diff, not a file-level one.

2. **Aspect stability tiers.** Classify aspects by enforcement mechanism:
   - **Tier 1 (Schema-enforced):** Check on data model migration only. Examples: team-ownership, foreign keys.
   - **Tier 2 (Protocol/contract):** Check when consumers are modified. Examples: pubsub-events, API contracts.
   - **Tier 3 (Implementation-detail):** Check on every change to covered files. Examples: pessimistic-locking, retry strategies.

3. **Proactive review triggers.** Instead of predicting staleness, use aspect metadata to decide WHEN to review:
   - After any `fix:` commit touching aspect-covered files (fixes often change implementation details)
   - After any commit touching the infrastructure code that implements the aspect (e.g., prisma.service.ts for locking aspects)
   - After any performance-related commit (these frequently change locking/concurrency strategies)

4. **Aspect-specific code anchors.** Record in aspect metadata the specific function names, patterns, or identifiers that implement the aspect. Example: `pessimistic-locking` could record `anchors: [lockTeamCollectionByTeamAndParent, lockTeamRequestByCollections, FOR UPDATE]`. When any anchor changes in a diff, flag the aspect for review.

### 6.3 Product implications

For the Yggdrasil product, this experiment suggests:

1. **Do NOT implement git-signal-based aspect staleness prediction** — it would produce too many false positives (80%) with no useful signal differentiation.

2. **DO implement aspect code anchors** — a lightweight metadata addition (`anchors` field in `aspect.yaml`) that lists function names, patterns, or identifiers. A simple `git diff | grep anchor` would give a much better signal than commit counting.

3. **DO implement aspect stability tiers** — allow aspect authors to classify aspects by stability tier. Tier 3 aspects get flagged for review more aggressively.

4. **The existing drift detection mechanism (hash-based) is the correct approach** — it detects ALL changes, not just aspect-relevant ones, which means false positives, but it has ZERO false negatives. The improvement would be to add aspect-pattern-aware filtering to reduce false positive rate.

---

## 7. Conclusions

1. **Aspect staleness is semantically invisible at the file level.** Git signals (commits, churn, commit types) operate on files. Aspects describe behavioral invariants. The two levels do not correlate.

2. **No tested heuristic predicts staleness > 20% with acceptable accuracy.** The false positive rate at any threshold is 60-100%, making git-signal-based prediction practically useless.

3. **Aspect stability correlates with enforcement mechanism, not file activity.** Schema-enforced patterns are stable (0% over 6 months). Implementation-detail patterns are fragile (44% from a single commit).

4. **Staleness must be detected, not predicted.** The most effective approach is aspect-specific code anchors combined with diff analysis, not statistical heuristics on git metadata.

5. **Binary decay confirmed.** The pessimistic-locking aspect went from 0% stale to 44% stale in a single commit. This confirms the "binary decay" model from the agent rules: "a pattern either exists or it doesn't." For pessimistic-locking, the pattern (row-level vs table-level) flipped entirely.

6. **Existing hash-based drift detection is correct in principle.** The improvement opportunity is not in prediction but in **aspect-aware filtering** — helping distinguish which file changes are aspect-relevant and which are not.
