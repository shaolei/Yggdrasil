# Cycle 1 Answers

Answers derived from cycle-1 context package (config + enriched responsibility + interface.md + 2 aspects).

## Q1: What are all the public methods of TeamCollectionService and their return types?

From the interface.md, the public methods are:

**Collection Retrieval:**
- `getCollection(collectionID, tx?)` -> `Promise<Either<string, DBTeamCollection>>`
- `getTeamOfCollection(collectionID)` -> `Promise<Either<string, Team>>`
- `getParentOfCollection(collectionID)` -> `Promise<TeamCollection | null>`
- `getChildrenOfCollection(collectionID, cursor, take)` -> `Promise<TeamCollection[]>`
- `getTeamRootCollections(teamID, cursor, take)` -> `Promise<TeamCollection[]>`
- `getCollectionCount(collectionID, teamID, tx?)` -> `Promise<number>`
- `totalCollectionsInTeam(teamID)` -> `Promise<number>`
- `getTeamCollectionsCount()` -> `Promise<number>`

**Mutations:**
- `createCollection(teamID, title, data, parentID)` -> `Promise<Either<string, TeamCollection>>`
- `renameCollection(collectionID, newTitle)` -> `Promise<Either<string, TeamCollection>>` (deprecated)
- `updateTeamCollection(collectionID, collectionData?, newTitle?)` -> `Promise<Either<string, TeamCollection>>`
- `deleteCollection(collectionID)` -> `Promise<Either<string, boolean>>`
- `moveCollection(collectionID, destCollectionID)` -> `Promise<Either<string, TeamCollection>>`
- `updateCollectionOrder(collectionID, nextCollectionID)` -> `Promise<Either<string, boolean>>`
- `sortTeamCollections(teamID, parentID, sortBy)` -> `Promise<Either<string, boolean>>`

**Import/Export:**
- `importCollectionsFromJSON(jsonString, teamID, parentID)` -> `Promise<Either<string, DBTeamCollection[]>>`
- `exportCollectionsToJSON(teamID)` -> `Promise<Either<string, string>>`
- `exportCollectionToJSONObject(teamID, collectionID)` -> `Promise<Either<string, CollectionFolder>>`

**Duplication:**
- `duplicateTeamCollection(collectionID)` -> `Promise<Either<string, boolean>>`

**Search:**
- `searchByTitle(searchQuery, teamID, take?, skip?)` -> `Promise<Either<RESTError, { data: CollectionSearchNode[] }>>`

**CLI:**
- `getCollectionForCLI(collectionID, userUid)` -> `Promise<Either<string, GetCollectionResponse>>`

**Score: 5/5** - Complete list of all public methods with accurate signatures and return types.

## Q2: How does moveCollection prevent circular parent-child references?

The interface.md states that moveCollection "Validates: not already root (if moving to root), not same source and destination, same team, no circular reference (source is not ancestor of destination)." The error TEAM_COLL_IS_PARENT_COLL is returned when a circular reference would occur.

So the prevention mechanism is: before allowing a move, it checks whether the source collection is an ancestor of the destination collection. If it is, moving the source into the destination would create a cycle, so it returns an error.

However, the interface does not explain the ALGORITHM -- how does it walk the tree to determine ancestry? Is it recursive? Does it use a CTE query? I know it checks "source is not ancestor of destination" but not HOW.

**Score: 3/5** - Correctly identifies that circular references are prevented by checking if source is an ancestor of destination, and names the error code. Missing: the actual tree-walking algorithm (recursive `isParent` method that walks up from destination to root checking for the source at each step).

## Q3: What happens when a database deadlock occurs during reorderTeamCollection?

The interface.md mentions that `deleteCollection` "uses pessimistic locking with retry loop" and `updateCollectionOrder` "uses pessimistic locking." The pessimistic-locking aspect describes the lock pattern. The pubsub aspect mentions a "retry loop" in `deleteCollectionAndUpdateSiblingsOrderIndex`.

However, the interface does not describe what happens during deadlocks specifically for updateCollectionOrder/reorder. It mentions the error `TEAM_COL_REORDERING_FAILED` but not the retry mechanism, max retries, backoff strategy, or which Prisma error codes trigger retries vs. immediate failure.

**Score: 1.5/5** - Knows there is pessimistic locking and a retry loop exists (from aspect hint) and the final error code. Missing: MAX_RETRIES=5, linear backoff (retryCount * 100ms), specific Prisma error codes that trigger retry (UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, TRANSACTION_TIMEOUT), and that this retry pattern is only in deleteCollectionAndUpdateSiblingsOrderIndex, NOT in updateCollectionOrder (which just catches and returns error).

## Q4: How does the search feature rank results (fuzzy matching algorithm)?

The interface.md says searchByTitle "Uses SQL ILIKE for filtering and PostgreSQL similarity() function for ranking."

This tells me:
1. Filtering: SQL ILIKE with the search query (case-insensitive substring match)
2. Ranking: PostgreSQL's `similarity()` function (which is the pg_trgm trigram similarity function)

But I don't know whether the ILIKE uses wildcards (%query%), the exact SQL structure, or how results from collections and requests are combined.

**Score: 3/5** - Correctly identifies ILIKE for filtering and similarity() for ranking. Missing: the exact SQL structure (both use `%escapedQuery%` wildcard pattern with ILIKE, ORDER BY similarity(title, query)), the SQL LIKE string escaping, that collections and requests are searched separately with separate raw SQL queries then combined, and the pagination pattern (OFFSET calculation).

## Q5: What events are published for each mutation and what data do they carry?

From the interface.md combined with the pubsub aspect:

- `createCollection` -> publishes `coll_added` with full TeamCollection model
- `renameCollection` -> publishes `coll_updated` with full TeamCollection model
- `updateTeamCollection` -> publishes `coll_updated` with full TeamCollection model
- `deleteCollection` -> publishes `coll_removed` with collection ID string
- `moveCollection` -> publishes `coll_moved` with full TeamCollection model
- `updateCollectionOrder` -> publishes `coll_order_updated` with { collection, nextCollection }
- `importCollectionsFromJSON` -> publishes `coll_added` for each top-level created collection
- `duplicateTeamCollection` -> triggers import internally, so `coll_added` events fire for the duplicated collections
- `sortTeamCollections` -> no event published (not mentioned in interface)

Channel format: `team_coll/${teamID}/channel_name`

Timing: events published AFTER transaction commit.

**Score: 5/5** - Complete mapping of mutations to events with payload shapes, timing, and the observation that sortTeamCollections does not publish events.

## Summary

| Question | Score |
|----------|-------|
| Q1: Public methods and return types | 5 |
| Q2: Circular reference prevention | 3 |
| Q3: Deadlock handling in reorder | 1.5 |
| Q4: Search ranking algorithm | 3 |
| Q5: Events per mutation | 5 |
| **Mean** | **3.5** |

## Changes from Cycle 0

- **Added**: interface.md (full public API documentation)
- **Enriched**: responsibility.md (expanded from 1 sentence to structured sections with "not responsible for")
- **Added**: team-service relation in node.yaml
- **Chars added**: ~5,200 chars (interface.md ~4,500 + responsibility.md expansion ~700)
- **Score improvement**: 1.2 -> 3.5 (+2.3)
