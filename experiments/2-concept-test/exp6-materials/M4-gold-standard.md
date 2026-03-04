# M4 Gold Standard — Architectural Change (Optimistic Locking)

## Summary of Change

Replaced the pessimistic locking pattern with optimistic locking using version field checks across ALL mutation operations:

### What was removed:
- All calls to `this.prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` across every method
- The entire retry loop in `deleteCollectionAndUpdateSiblingsOrderIndex` (including `MAX_RETRIES`, `delay()`, and error code checks)
- The `delay` import from utils
- The `MAX_RETRIES` class property

### What was added:
- New error constant import: `TEAM_COLL_STALE_VERSION`
- Two new private helper methods:
  - `readSiblingVersions(tx, teamID, parentID)` — reads all sibling rows' `version` field into a Map
  - `verifySiblingVersions(tx, teamID, parentID, expectedVersions)` — compares current versions against snapshot, throws ConflictException on mismatch
- Every mutation method now follows a new pattern:
  1. Read sibling versions at start of transaction (snapshot)
  2. Perform mutations
  3. Verify sibling versions haven't changed (optimistic check)
  4. If version mismatch: throw ConflictException, caught as `TEAM_COLL_STALE_VERSION`
- No automatic retry on conflict — callers receive the stale version error

### Methods affected:
- `importCollectionsFromJSON` — lock replaced with version read/verify
- `createCollection` — lock replaced with version read/verify
- `deleteCollectionAndUpdateSiblingsOrderIndex` — lock AND retry replaced with version read/verify
- `moveCollection` — locks on BOTH source and dest parents replaced with version reads/verifies for both
- `updateCollectionOrder` (both null and non-null branches) — lock replaced with version read/verify
- `sortTeamCollections` — lock replaced with version read/verify

## Artifacts That Need Updating

### logic.md

**Change needed:** Every algorithm description that mentions "Lock siblings" must be updated.

For the reorder algorithm, change step references from "Lock siblings" to "Read sibling versions":

```
### Move to end (nextCollectionID = null)
1. Read sibling versions (optimistic lock snapshot)
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)
5. Verify sibling versions haven't changed (optimistic lock check)

### Move to specific position (nextCollectionID != null)
1. Read sibling versions (optimistic lock snapshot)
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range [nextCollection.orderIndex, collection.orderIndex - 1]
5. If moving DOWN: decrement all siblings in range [collection.orderIndex + 1, nextCollection.orderIndex - 1]
6. Set collection's orderIndex accordingly
7. Verify sibling versions haven't changed (optimistic lock check)
```

For the move algorithm:
```
## Move collection (changeParentAndUpdateOrderIndex)
1. Read sibling versions for source parent
2. Read sibling versions for destination parent (if moving to non-root)
3. Find last orderIndex under new parent
4. Decrement all siblings after the collection in its ORIGINAL parent
5. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent
6. Verify sibling versions for source parent
7. Verify sibling versions for destination parent
```

Add new section:
```
## Optimistic lock pattern (version check)
1. At transaction start: read `version` field of all sibling rows into a Map<id, version>
2. Perform all mutations within the transaction
3. Before commit: re-read sibling versions, compare against snapshot
4. If any version changed: throw ConflictException (TEAM_COLL_STALE_VERSION)
5. No automatic retry — caller receives the error and must decide whether to retry

This assumes the `TeamCollection` table has a `version` column that auto-increments on every update.
```

### constraints.md

**Change needed:** Add a new constraint about version field requirements.

Add:
```
## Version field requirement

The optimistic locking pattern requires every TeamCollection row to have a `version` integer field that increments on every update. This field must be maintained by the database (e.g., via a Prisma @updatedAt or a trigger). If the version field is not present or not auto-incremented, the optimistic lock check will not detect concurrent modifications.
```

Also update OrderIndex contiguity:
```
## OrderIndex contiguity (updated)

[...existing text...]

Note: Contiguity is now enforced via optimistic locking (version checks) rather than pessimistic locking (row locks). Under high contention, operations will fail with TEAM_COLL_STALE_VERSION rather than blocking. Callers must handle this error (typically by retrying at the application layer).
```

### decisions.md

**Major changes needed.**

Update existing decision:
```
## Why delete has retries but other mutations do not
```
→ Replace with:
```
## Why the retry-on-deadlock pattern was removed

The original delete operation used a retry loop (5 retries, linear backoff) to handle deadlocks from concurrent modifications. This pattern was replaced by optimistic locking (version checks) that detects concurrent modifications without retrying. The rationale: optimistic locking gives the caller control over retry policy rather than burying it inside the service. The caller can decide to retry, fail fast, or queue the operation.
```

Update existing decision:
```
## Why pessimistic, not optimistic (in pessimistic-locking aspect)
```
→ This decision in the aspect content.md is now INVERTED. The code now uses optimistic locking. This must be acknowledged. See aspect changes below.

Add new decision:
```
## Why optimistic locking replaced pessimistic locking

The original pessimistic locking pattern locked all sibling rows before any read-modify cycle. While correct, this serialized ALL operations on a sibling set, reducing throughput. Optimistic locking allows concurrent reads and only fails when a conflict is actually detected. Trade-off: under high contention, more operations fail (requiring caller retry), but under normal load, throughput is higher because no lock acquisition is needed.

Note: This fundamentally changes the error contract. Operations that previously blocked (waiting for locks) now fail immediately with TEAM_COLL_STALE_VERSION. All callers must handle this new error.
```

### responsibility.md

**Change needed:** Update the core responsibility description.

Current:
```
Coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency...
```

Updated:
```
Coordinates Prisma database transactions with optimistic version checking, maintains orderIndex consistency...
```

## Aspects Affected

### pessimistic-locking aspect — FUNDAMENTAL VIOLATION / REPLACEMENT

**This is the most critical change.** The entire pessimistic-locking aspect no longer applies to this service. Every `lockTeamCollectionByTeamAndParent` call has been removed.

**Expected agent behavior:**
1. Flag that the pessimistic-locking aspect is completely violated — not a single operation uses it anymore
2. The aspect itself (in `aspects/pessimistic-locking/`) is now architecturally incompatible with this service
3. Remove `pessimistic-locking` from node.yaml aspects
4. Either:
   a. Create a new `optimistic-locking` aspect describing the version-check pattern, OR
   b. Rename/rewrite the existing pessimistic-locking aspect to become `optimistic-locking`

If creating a new aspect `optimistic-locking`:
```yaml
# aspects/optimistic-locking/aspect.yaml
name: Optimistic Locking
description: >
  Concurrent modification detection via version field comparison.
  No row-level locks are acquired; instead, sibling version snapshots
  are taken at transaction start and verified before commit.
```

```markdown
# aspects/optimistic-locking/content.md

# Optimistic Locking

Every operation that reads and then modifies sibling orderIndex values uses optimistic concurrency control via version field comparison.

## Pattern

1. Open a `prisma.$transaction`
2. Call `readSiblingVersions(tx, teamID, parentID)` — reads all sibling rows' version fields into a Map
3. Read current state (last orderIndex, collection to move, etc.)
4. Perform mutations (create, delete, update orderIndex)
5. Call `verifySiblingVersions(tx, teamID, parentID, expectedVersions)` — re-reads versions and compares
6. If any version changed, throw ConflictException (TEAM_COLL_STALE_VERSION)
7. Transaction commits if no conflict detected

## Why optimistic, not pessimistic

Pessimistic locking (row-level locks via `SELECT ... FOR UPDATE`) serializes all operations on a sibling set. For a real-time collaborative tool, this creates lock contention under concurrent edits. Optimistic locking allows concurrent operations to proceed without blocking, failing only when actual conflicts occur. Under normal load, most operations succeed without retrying. Under high contention, callers receive TEAM_COLL_STALE_VERSION and can implement their own retry policy.

## Scope

The version check covers all siblings under a `(teamID, parentID)` pair. Operations on different subtrees do not conflict.

## No automatic retry

Unlike the previous pessimistic-locking + retry pattern, optimistic locking does NOT automatically retry. The caller (resolver, controller) is responsible for deciding whether to retry, fail, or queue the operation. This pushes retry policy up the stack where it can be customized per use case.
```

### retry-on-deadlock aspect — COMPLETELY REMOVED

The retry loop has been eliminated. The retry-on-deadlock aspect has zero applicability.

**Expected agent behavior:**
1. Remove `retry-on-deadlock` from node.yaml aspects
2. Note that the aspect may need to be deleted from `aspects/` if no other nodes use it

### pubsub-events aspect

**No change needed.** PubSub events are still published after mutations succeed. The timing guarantee is slightly different (no retry loop means events are published once, not potentially after retries), but the fundamental pattern is preserved.

## Aspect Violations

1. **pessimistic-locking: COMPLETELY VIOLATED.** Every lock call removed. The entire concurrency model changed.
2. **retry-on-deadlock: COMPLETELY VIOLATED.** All retry logic removed. No automatic retry exists.

## node.yaml

**Major change needed:**

Current:
```yaml
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock]
```

Updated:
```yaml
aspects: [optimistic-locking, pubsub-events]
```

This requires:
- Removing `pessimistic-locking`
- Removing `retry-on-deadlock`
- Adding new `optimistic-locking` aspect (must be created first)

## Difficulty Assessment

**Very hard recovery.** An agent must:

1. Detect that EVERY `lockTeamCollectionByTeamAndParent` call was removed (across 6+ methods)
2. Detect that two entirely new helper methods were added implementing a different concurrency pattern
3. Understand that this is an architectural replacement, not just a code tweak
4. Recognize that TWO aspects are now violated (pessimistic-locking AND retry-on-deadlock)
5. Understand that a new aspect must be CREATED (optimistic-locking) — not just edit existing ones
6. Rewrite logic.md algorithms to reflect the new lock-read-verify pattern
7. Add new constraints (version field requirement)
8. Rewrite multiple decisions.md entries (the "why pessimistic not optimistic" decision is now inverted)
9. Update responsibility.md description
10. Handle the cascade: the pessimistic-locking aspect's own content.md has a "Why pessimistic, not optimistic" section that directly contradicts the new code

The fundamental challenge is that this mutation changes the ARCHITECTURE, not just behavior. The agent must understand concurrency models (pessimistic vs optimistic) to correctly describe what happened and why it matters. A naive agent would just update the code descriptions without realizing the cross-cutting aspect implications.

Additional subtlety: the new `TEAM_COLL_STALE_VERSION` error changes the API contract. Callers that previously never saw this error must now handle it. The agent should flag this as a breaking change.
