# M1 Drift Recovery Report — TeamCollectionService

## Drift Analysis

### Changes Detected

| # | Change description | Affects which artifacts |
|---|---|---|
| 1 | New method `searchTeamCollections` added (lines 1560-1633) — a second, distinct collection search endpoint with LEFT JOIN for parent title, `DESC` ordering by similarity, offset-based pagination (not cursor-based), and a new PubSub analytics event | responsibility.md, logic.md, decisions.md, constraints.md, pubsub-events aspect |
| 2 | New PubSub event channel `team_coll/${teamID}/coll_search` publishing search analytics data (query, resultCount, timestamp) | pubsub-events aspect |
| 3 | New error codes imported: `TEAM_MEMBER_NOT_FOUND`, `TEAM_COLL_CREATION_FAILED` — not mentioned in graph | constraints.md |
| 4 | `sortTeamCollections` method exists in code but is not mentioned in any graph artifact | responsibility.md, logic.md |
| 5 | `getCollectionForCLI` performs team membership check via `TeamService.getTeamMember` — an authorization-adjacent concern not captured in graph | responsibility.md, decisions.md |
| 6 | `moveCollection` wraps the entire operation in a single `$transaction` (including both source lock and destination lock) — the graph's `changeParentAndUpdateOrderIndex` description does not mention this transactional wrapper or the dual-locking pattern in `moveCollection` | logic.md |
| 7 | `totalCollectionsInTeam` and `getTeamCollectionsCount` methods exist but are not documented | responsibility.md |
| 8 | `exportCollectionsToJSON` (export ALL team collections) is a distinct method from `exportCollectionToJSONObject` (export single) — graph mentions export but does not distinguish the two entry points | responsibility.md |
| 9 | `updateTeamCollection` is the modern replacement for `renameCollection` (which is `@deprecated`) — the graph does not mention the deprecation or the dual-method situation | responsibility.md, decisions.md |
| 10 | `searchTeamCollections` uses `LEFT JOIN` to fetch parent title in a single query instead of recursive CTE — a fundamentally different approach from the existing `searchByTitle` method | decisions.md |
| 11 | `searchTeamCollections` validates empty/whitespace queries before executing SQL | constraints.md |
| 12 | `searchTeamCollections` uses simple `OFFSET`/`LIMIT` pagination rather than cursor-based | logic.md |
| 13 | `searchTeamCollections` sorts results by `similarity DESC, orderIndex ASC` — different from old `searchCollections` which sorts by `similarity` alone (implicit ASC) | logic.md |
| 14 | `getCollection` accepts optional `tx` (transaction client) parameter — this allows it to be called within a transaction, which is used by `moveCollection` and `isParent` | logic.md |
| 15 | Graph says `cast()` returns `{ id, title, parentID, data }` but code confirms exactly this — however the `data` field goes through `transformCollectionData()` which is not documented in graph | logic.md |

### Artifact Updates

### responsibility.md

BEFORE:
```markdown
# TeamCollectionService — Responsibility

The central service for all team collection operations. Coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency across sibling sets, prevents circular tree structures, and publishes real-time PubSub events after every mutation.

## In scope

- Collection CRUD: create, rename, update (title/data), delete with sibling reindexing
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings
- Tree integrity: recursive ancestor check (`isParent`) to prevent circular moves
- Import/export: recursive JSON serialization and deserialization of entire collection subtrees
- Search: raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction
- Duplication: export-then-import with title modification
- CLI support: `getCollectionForCLI` and `getCollectionTreeForCLI` for command-line access

## Out of scope

- Authentication/authorization (handled by resolvers and guards)
- Individual request CRUD within collections
- Team membership management (delegated to TeamService)
- PubSub infrastructure (delegated to PubSubService)
```

AFTER:
```markdown
# TeamCollectionService — Responsibility

The central service for all team collection operations. Coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency across sibling sets, prevents circular tree structures, and publishes real-time PubSub events after every mutation.

## In scope

- Collection CRUD: create, rename (deprecated), update (title/data via `updateTeamCollection`), delete with sibling reindexing
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings alphabetically (`sortTeamCollections`)
- Tree integrity: recursive ancestor check (`isParent`) to prevent circular moves
- Import/export: recursive JSON serialization of single collection subtrees (`exportCollectionToJSONObject`) and entire team collections (`exportCollectionsToJSON`); deserialization and creation from JSON (`importCollectionsFromJSON`)
- Search (two mechanisms):
  - `searchByTitle`: raw SQL with `ILIKE` + `similarity()`, plus recursive CTE for parent tree reconstruction (searches both collections and requests)
  - `searchTeamCollections`: raw SQL with `ILIKE` + `similarity()` DESC + LEFT JOIN for parent title in a single query (collections only, offset pagination, publishes search analytics event)
- Duplication: export-then-import with title modification
- CLI support: `getCollectionForCLI` (with team membership verification via TeamService) and `getCollectionTreeForCLI` for command-line access
- Statistics: `totalCollectionsInTeam` (count per team) and `getTeamCollectionsCount` (global count)

## Out of scope

- Authentication/authorization (handled by resolvers and guards, except CLI team membership check)
- Individual request CRUD within collections
- Team membership management (delegated to TeamService)
- PubSub infrastructure (delegated to PubSubService)
```

REASON: Multiple methods were missing from the responsibility description: `searchTeamCollections` (entirely new search endpoint), `sortTeamCollections`, `totalCollectionsInTeam`, `getTeamCollectionsCount`, the deprecation of `renameCollection`, the two distinct export entry points, and the CLI membership check. These are all in-scope behaviors that the graph must capture for accurate context.

---

### constraints.md

BEFORE:
```markdown
# TeamCollectionService — Constraints

## Circular reference prevention
...
## OrderIndex contiguity
...
## Same-team constraint
...
## Self-move prevention
...
## Already-root guard
...
## Title minimum length
...
## Data field validation
...
```

AFTER:
```markdown
# TeamCollectionService — Constraints

## Circular reference prevention

A collection cannot be moved into its own descendant. The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. This prevents infinite loops in the tree structure.

## OrderIndex contiguity

Within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1. Every delete decrements all higher siblings. Every create appends at `lastIndex + 1`. Reorder shifts affected ranges up or down by 1. This invariant ensures no gaps and no duplicates, which is critical for predictable cursor-based pagination and drag-and-drop UI.

## Same-team constraint

A collection can only be moved to a parent that belongs to the same team. Cross-team moves are rejected with `TEAM_COLL_NOT_SAME_TEAM`. Similarly, reordering validates that the collection and the next-collection belong to the same team.

## Self-move prevention

A collection cannot be moved into itself (`TEAM_COLL_DEST_SAME`) or reordered next to itself (`TEAM_COL_SAME_NEXT_COLL`).

## Already-root guard

Moving a root collection to root (parentID null → null) is rejected with `TEAM_COL_ALREADY_ROOT`. This is a no-op prevention, not a business rule.

## Title minimum length

Collection titles must be at least 1 character (`TITLE_LENGTH = 1`). Empty titles are rejected with `TEAM_COLL_SHORT_TITLE`.

## Data field validation

The optional `data` field (collection metadata/headers) must be valid JSON if provided. Empty string is explicitly rejected (not treated as null). Invalid JSON is rejected with `TEAM_COLL_DATA_INVALID`.

## Search query validation

The `searchTeamCollections` method rejects empty or whitespace-only queries with `TEAM_COL_SEARCH_FAILED` before executing any SQL. This prevents meaningless full-table scans.

## Team membership for CLI access

`getCollectionForCLI` verifies that the requesting user is a member of the team that owns the collection (via `TeamService.getTeamMember`). If not found, returns `TEAM_MEMBER_NOT_FOUND`. This is a service-level authorization guard, distinct from the resolver-level guards used elsewhere.

## Creation failure handling

Both `createCollection` and `importCollectionsFromJSON` catch transaction errors and return `TEAM_COLL_CREATION_FAILED` rather than propagating the exception. This provides a clean error boundary for callers.
```

REASON: Three new constraint patterns exist in the code that were not captured: search query validation (empty check in `searchTeamCollections`), team membership verification for CLI access (`TEAM_MEMBER_NOT_FOUND`), and the `TEAM_COLL_CREATION_FAILED` error boundary. These are enforced invariants that must be documented.

---

### decisions.md

BEFORE:
```markdown
# TeamCollectionService — Decisions

## Why duplication uses export + import
...
## Why search uses raw SQL instead of Prisma query builder
...
## Why parent tree reconstruction uses recursive CTE
...
## Why `isParent` walks up, not down
...
## Why orderIndex is integer-based, not fractional
...
## Why delete has retries but other mutations do not
...
```

AFTER:
```markdown
# TeamCollectionService — Decisions

## Why duplication uses export + import

Rather than implementing a separate deep-copy method, duplication exports the collection to JSON, modifies the title (appending " - Duplicate"), then re-imports. This reuses the existing recursive import logic (which handles nested children, requests, locking, and orderIndex assignment) without duplicating it. Trade-off: slightly more overhead (serialization round-trip) but eliminates a separate code path that would need to maintain parity with import logic.

## Why search uses raw SQL instead of Prisma query builder

The search requires PostgreSQL-specific features: `ILIKE` for case-insensitive matching, `similarity()` function for fuzzy ranking, and `escapeSqlLikeString` for safe wildcard injection. Prisma's query builder doesn't expose `similarity()` or custom ordering by a function result. Raw SQL is the only option for this query pattern.

## Why parent tree reconstruction uses recursive CTE

After finding search matches, the UI needs to display breadcrumb paths (e.g., "Team > Parent Collection > Child Collection > Match"). Rather than making N queries to walk up the tree per result, a single `WITH RECURSIVE` CTE efficiently fetches the entire ancestor chain in one query. This is critical for performance when search returns many results.

## Why `searchTeamCollections` uses LEFT JOIN instead of recursive CTE

The newer `searchTeamCollections` method only needs the immediate parent's title (one level up), not the full ancestor chain. A LEFT JOIN fetching `parent.title` in a single query is simpler and more performant than a recursive CTE when only one level of parent context is needed. This method also sorts by `similarity DESC` (best match first) with `orderIndex ASC` as tiebreaker, producing more intuitive search results than the original `searchByTitle` which used implicit ascending similarity.

## Why `searchTeamCollections` publishes a search analytics event

Unlike other search methods, `searchTeamCollections` publishes a `coll_search` PubSub event with query, resultCount, and timestamp. This is a read-only analytics concern — no locking is needed. This decision couples search with analytics, but the PubSub fire-and-forget pattern means it does not affect search latency or correctness.

## Why `renameCollection` is deprecated in favor of `updateTeamCollection`

`renameCollection` only updates the title. `updateTeamCollection` handles both title and data fields in a single call, reducing the number of API operations needed and ensuring both fields can be atomically updated. The old method is kept for backward compatibility but marked `@deprecated`.

## Why `isParent` walks up, not down

To check if Collection_A is an ancestor of Collection_D, the code walks UP from D to root (following parentID links), checking if any parent is A. The alternative — walking DOWN from A through all descendants — would require loading the entire subtree. Walking up follows a single chain of parentID pointers, which is O(depth) not O(subtree_size).

## Why orderIndex is integer-based, not fractional

Integer orderIndex with gap-filling (decrement on delete, shift on reorder) requires touching multiple rows on every mutation but guarantees contiguous, predictable indexes. Fractional ordering (assigning values between existing items) avoids touching siblings but eventually requires rebalancing when precision is exhausted. For a real-time collaborative tool where consistency matters more than write throughput, integer ordering is simpler to reason about.

## Why delete has retries but other mutations do not

Delete+reindex can race with other deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. The pessimistic lock prevents data corruption but can cause deadlocks when lock acquisition order differs. The retry loop handles these transient deadlocks. Create and move operations are less prone to this because they typically modify non-overlapping index ranges (append at end, or shift in one direction).

## Why moveCollection acquires two locks in one transaction

`moveCollection` locks BOTH the source parent's siblings and the destination parent's siblings within a single `$transaction`. This ensures that the gap-fill in the source parent and the append in the destination parent happen atomically, preventing concurrent moves from corrupting orderIndex in either sibling set.
```

REASON: Three new decisions needed documentation: (1) the LEFT JOIN vs CTE choice in `searchTeamCollections`, (2) the search analytics PubSub event, (3) the `renameCollection` deprecation, and (4) the dual-lock pattern in `moveCollection`. These are architectural choices with trade-offs that future developers need to understand.

---

### logic.md

BEFORE:
```markdown
# TeamCollectionService — Logic

## Reorder algorithm (updateCollectionOrder)
...
## isParent (circular reference check)
...
## Move collection (changeParentAndUpdateOrderIndex)
...
```

AFTER:
```markdown
# TeamCollectionService — Logic

## Reorder algorithm (updateCollectionOrder)

Two cases based on `nextCollectionID`:

### Move to end (nextCollectionID = null)

1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)

### Move to specific position (nextCollectionID != null)

1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[nextCollection.orderIndex, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, nextCollection.orderIndex - 1]`
6. Set collection's orderIndex to: if moving up → `nextCollection.orderIndex`, if moving down → `nextCollection.orderIndex - 1`

The "next collection" semantics mean: "place me just before this collection."

## isParent (circular reference check)

Recursive walk from destination UP to root:
1. If source === destination → return None (invalid, means self-move)
2. If destination.parentID === source.id → return None (source IS an ancestor)
3. If destination.parentID !== null → recurse with destination = destination.parent
4. If destination.parentID === null → reached root without finding source → return Some(true) (safe to move)

None = invalid (would create cycle), Some(true) = valid.

Note: `isParent` accepts an optional `tx` (transaction client) parameter so it can read consistent data within the `moveCollection` transaction.

## Move collection (moveCollection + changeParentAndUpdateOrderIndex)

`moveCollection` wraps the entire operation in a single `$transaction`:

1. Fetch collection inside transaction
2. Lock source parent's siblings
3. If moving to root: validate not already root, call `changeParentAndUpdateOrderIndex(tx, collection, null)`
4. If moving into another collection: validate not self-move, fetch destination, validate same team, check circular reference via `isParent`, lock destination parent's siblings, call `changeParentAndUpdateOrderIndex(tx, collection, destCollection.id)`
5. Publish `coll_moved` PubSub event

`changeParentAndUpdateOrderIndex` (called within the transaction):

1. Find last orderIndex under new parent
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

This is a two-parent operation: it modifies sibling indexes in BOTH the source and destination parents within a single transaction.

## Sort siblings (sortTeamCollections)

1. Lock siblings under the given parent
2. Fetch all collections sorted by the requested criteria (`TITLE_ASC`, `TITLE_DESC`, or default `orderIndex ASC`)
3. Re-assign orderIndex 1..N based on sorted position
4. Uses `Promise.all` for parallel index updates within the transaction

## searchTeamCollections algorithm

1. Validate query is non-empty (trim + length check)
2. Escape special SQL LIKE characters in query
3. Execute raw SQL: `SELECT` with `LEFT JOIN` on parent for `parentTitle`, `ILIKE` filter, `ORDER BY similarity DESC, orderIndex ASC`, `LIMIT`/`OFFSET`
4. Publish search analytics event (`coll_search` channel) with query, result count, and timestamp
5. Return mapped results with `id, title, parentID, parentTitle, teamID, orderIndex`

## getCollection (transactional variant)

`getCollection` accepts an optional `tx: Prisma.TransactionClient` parameter. When provided, it uses the transaction client instead of `this.prisma`, allowing it to read consistent snapshots within enclosing transactions (used by `moveCollection` and `isParent`).

## Data transformation (cast helper)

The private `cast` method transforms DB records to model objects. The `data` field passes through `transformCollectionData()` (from `src/utils`) which handles the DB-to-model conversion of collection metadata.
```

REASON: Multiple logic sections were missing or incomplete: `sortTeamCollections` algorithm, `searchTeamCollections` algorithm, the `moveCollection` transactional wrapper with dual locking, the `getCollection` transactional variant, and the `cast`/`transformCollectionData` pattern. The `changeParentAndUpdateOrderIndex` section was also updated to show it operates within `moveCollection`'s transaction context.

---

### pubsub-events aspect (content.md)

BEFORE:
```markdown
# PubSub Events

Every mutation to a team collection publishes a PubSub event so that connected clients (GraphQL subscriptions) receive real-time updates.

## Channel naming convention

- `team_coll/${teamID}/coll_added` — new collection created or imported
- `team_coll/${teamID}/coll_updated` — collection title or data changed
- `team_coll/${teamID}/coll_removed` — collection deleted (payload: collection ID, not full object)
- `team_coll/${teamID}/coll_moved` — collection moved to different parent
- `team_coll/${teamID}/coll_order_updated` — sibling order changed (payload includes moved collection + next collection)

## Timing

Events are published AFTER the database transaction commits successfully. This prevents phantom events where the client sees an update but the transaction rolled back. The exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens after the retry loop succeeds.

## Payload shape

- Added/Updated/Moved: full `TeamCollection` model (cast from DB record)
- Removed: just the collection ID string
- Order updated: `{ collection, nextCollection }` pair
```

AFTER:
```markdown
# PubSub Events

Every mutation to a team collection publishes a PubSub event so that connected clients (GraphQL subscriptions) receive real-time updates. Additionally, search operations publish analytics events.

## Channel naming convention

- `team_coll/${teamID}/coll_added` — new collection created or imported
- `team_coll/${teamID}/coll_updated` — collection title or data changed
- `team_coll/${teamID}/coll_removed` — collection deleted (payload: collection ID, not full object)
- `team_coll/${teamID}/coll_moved` — collection moved to different parent
- `team_coll/${teamID}/coll_order_updated` — sibling order changed (payload includes moved collection + next collection)
- `team_coll/${teamID}/coll_search` — search analytics event (published by `searchTeamCollections`)

## Timing

Events are published AFTER the database transaction commits successfully. This prevents phantom events where the client sees an update but the transaction rolled back. The exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens after the retry loop succeeds. The `coll_search` event is published after the raw SQL query succeeds (no transaction involved — read-only operation).

## Payload shape

- Added/Updated/Moved: full `TeamCollection` model (cast from DB record)
- Removed: just the collection ID string
- Order updated: `{ collection, nextCollection }` pair
- Search: `{ query, resultCount, timestamp }` — analytics data, not a collection model
```

REASON: A new PubSub channel `coll_search` was added by `searchTeamCollections`. This is a fundamentally different kind of event — analytics rather than mutation notification — and its payload shape differs from all other events. The aspect must capture this to maintain accuracy.

---

### Aspect Assessment

**Aspect violations:**

1. **pubsub-events**: The new `coll_search` event partially violates the aspect's stated scope ("Every mutation to a team collection publishes a PubSub event"). Search is NOT a mutation — it is a read-only query. The aspect wording needs updating to acknowledge that PubSub is now used for analytics events too, not just mutation notifications. This is a semantic expansion of the aspect's scope. (Updated in the AFTER above.)

2. **pessimistic-locking**: `searchTeamCollections` correctly does NOT use locking (it is read-only), but `sortTeamCollections` DOES use locking and is not mentioned anywhere in the pessimistic-locking aspect's "Where this applies" equivalent. No direct violation, but a completeness gap.

3. **retry-on-deadlock**: The aspect states retry applies "Currently only `deleteCollectionAndUpdateSiblingsOrderIndex`". The code confirms this is still accurate. No violation.

**New aspects needed:**

- None strictly required. However, a **search-analytics** aspect could be considered if the `coll_search` PubSub pattern is expected to expand to other search methods. Currently it is localized to one method, so a local artifact note suffices.

### Summary

- Total artifacts needing update: **5** (responsibility.md, constraints.md, decisions.md, logic.md, pubsub-events aspect content.md)
- Severity: **moderate** — The core tree-mutation logic is accurately described. The drift is primarily additive: a new search method with different architectural choices (LEFT JOIN vs CTE, analytics PubSub, empty-query validation), plus several undocumented utility methods and the `renameCollection` deprecation. No existing descriptions are factually wrong, but they are incomplete.

### Detailed Change Inventory

| Method in code | Status in graph |
|---|---|
| `generatePrismaQueryObjForFBCollFolder` | Covered (implicitly, via import logic) |
| `exportCollectionToJSONObject` | Covered |
| `exportCollectionsToJSON` | Not distinguished from single-collection export |
| `importCollectionsFromJSON` | Covered |
| `cast` | Not documented |
| `getTeamOfCollection` | Not documented (minor read helper) |
| `getParentOfCollection` | Not documented (minor read helper) |
| `getChildrenOfCollection` | Not documented (minor read helper) |
| `getTeamRootCollections` | Not documented (minor read helper) |
| `getCollection` | Not documented (transactional variant not captured) |
| `isOwnerCheck` | Not documented (minor validation helper) |
| `createCollection` | Covered |
| `renameCollection` | Covered but deprecation not noted |
| `deleteCollectionAndUpdateSiblingsOrderIndex` | Covered |
| `deleteCollection` | Covered |
| `changeParentAndUpdateOrderIndex` | Covered |
| `isParent` | Covered |
| `moveCollection` | Partially covered (transactional wrapper not detailed) |
| `getCollectionCount` | Not documented |
| `updateCollectionOrder` | Covered |
| `totalCollectionsInTeam` | **Not documented** |
| `getTeamCollectionsCount` | **Not documented** |
| `updateTeamCollection` | Not documented as replacement for renameCollection |
| `searchByTitle` | Covered |
| `searchCollections` | Covered (implicitly) |
| `searchRequests` | Covered (implicitly) |
| `fetchParentTree` | Covered (implicitly) |
| `fetchCollectionParentTree` | Covered |
| `fetchRequestParentTree` | Covered |
| `generateParentTree` | Covered (implicitly) |
| `getAllRequestsInCollection` | Not documented (minor helper) |
| `getCollectionTreeForCLI` | Covered |
| `getCollectionForCLI` | Covered (membership check not noted) |
| `duplicateTeamCollection` | Covered |
| `sortTeamCollections` | **Not documented** |
| `searchTeamCollections` | **Not documented — NEW method** |

### Bug Found During Analysis

**`fetchCollectionParentTree` (line 1278):** The `catch` block has `E.left(TEAM_COLL_PARENT_TREE_GEN_FAILED)` without a `return` statement. This means errors are silently swallowed and the method returns `undefined` instead of a proper Left value. Compare with `fetchRequestParentTree` (line 1368) which correctly has `return E.left(...)`. This is a pre-existing bug, not introduced by the new code, but worth noting.
