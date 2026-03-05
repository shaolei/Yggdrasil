# TeamCollectionService Internals

## Circular Reference Prevention (moveCollection)

The `isParent` method prevents circular moves by recursively walking UP the ancestor chain of the destination collection, checking at each step whether the source collection is encountered.

### Algorithm

```
isParent(source, destination, tx):
  if source === destination: return None (invalid -- same collection)
  if destination.parentID === source.id: return None (source IS parent of destination -- would create cycle)
  if destination.parentID === null: return Some(true) (reached root without finding source -- safe to move)
  else: get parent of destination, call isParent(source, parent, tx) recursively
```

If `isParent` returns `None`, moveCollection returns `TEAM_COLL_IS_PARENT_COLL` error. If it returns `Some(true)`, the move is safe.

### Other moveCollection validations (in order)

1. Get source collection (fail with TEAM_COLL_NOT_FOUND if missing)
2. Lock source collection's sibling set
3. If destCollectionID is null: check source is not already root (TEAM_COL_ALREADY_ROOT)
4. If destCollectionID is not null:
   a. Check source != destination (TEAM_COLL_DEST_SAME)
   b. Get destination collection (TEAM_COLL_NOT_FOUND)
   c. Check same team (TEAM_COLL_NOT_SAME_TEAM)
   d. Run isParent check (TEAM_COLL_IS_PARENT_COLL)
   e. Lock destination's sibling set
5. Call changeParentAndUpdateOrderIndex: decrement orderIndexes of source's old siblings, set source's parentID and orderIndex to end of new parent's children

## Retry Logic (deleteCollectionAndUpdateSiblingsOrderIndex)

Private method used by `deleteCollection`. Implements a retry loop for handling database concurrency errors.

### Mechanism

- **MAX_RETRIES**: 5
- **Backoff**: Linear -- `delay(retryCount * 100)` milliseconds (100ms, 200ms, 300ms, 400ms, 500ms)
- **Retryable errors** (Prisma error codes):
  - `UNIQUE_CONSTRAINT_VIOLATION` -- sibling orderIndex collision
  - `TRANSACTION_DEADLOCK` -- concurrent transaction deadlock
  - `TRANSACTION_TIMEOUT` -- transaction took too long
- **Non-retryable errors**: Any other database error immediately returns `TEAM_COL_REORDERING_FAILED`
- **Max retries exceeded**: Returns `TEAM_COL_REORDERING_FAILED`

### Important distinction

This retry pattern is ONLY in `deleteCollectionAndUpdateSiblingsOrderIndex`, NOT in `updateCollectionOrder` or `moveCollection`. Those methods catch transaction errors and return `TEAM_COL_REORDERING_FAILED` immediately without retrying.

## Search Algorithm

### Query structure

Two separate raw SQL queries are executed: one for collections, one for requests.

**Collections query:**
```sql
SELECT id, title, 'collection' AS type
FROM "TeamCollection"
WHERE "TeamCollection"."teamID" = $teamID
  AND title ILIKE '%<escapedQuery>%'
ORDER BY similarity(title, $searchQuery)
LIMIT $take
OFFSET $calculated_offset
```

**Requests query:**
```sql
SELECT id, title, request->>'method' as method, 'request' AS type
FROM "TeamRequest"
WHERE "TeamRequest"."teamID" = $teamID
  AND title ILIKE '%<escapedQuery>%'
ORDER BY similarity(title, $searchQuery)
LIMIT $take
OFFSET $calculated_offset
```

### Key details

- **Filtering**: Case-insensitive substring match via `ILIKE '%query%'`. The query is escaped for SQL LIKE special characters using `escapeSqlLikeString()`.
- **Ranking**: PostgreSQL `similarity()` function (from pg_trgm extension) -- trigram-based similarity score. Higher similarity = earlier in results. This is NOT true fuzzy matching -- ILIKE filters must match first, then similarity ranks the matches.
- **Pagination offset**: `skip === 0 ? 0 : (skip - 1) * take` -- the skip parameter is page-based, not row-based.
- **Results combination**: Collections and requests are searched independently with separate limits, then concatenated (collections first, then requests).
- **Parent tree generation**: For each search result, a recursive CTE SQL query walks up the parent chain to build breadcrumb paths. Collections and requests use different CTEs (collection_tree vs request_collection_tree).

## OrderIndex Management

### updateCollectionOrder algorithm

Two cases handled within a transaction:

**Move to end (nextCollectionID is null):**
1. Lock siblings
2. Re-fetch collection's orderIndex within transaction
3. Decrement all siblings with orderIndex > current
4. Set collection's orderIndex to total sibling count

**Move to specific position (nextCollectionID is not null):**
1. Lock siblings
2. Re-fetch both collection and nextCollection orderIndexes within transaction
3. Determine direction: isMovingUp = nextCollection.orderIndex < collection.orderIndex
4. Calculate range to update:
   - Moving up: update range [nextCollection.orderIndex, collection.orderIndex - 1] -> increment
   - Moving down: update range [collection.orderIndex + 1, nextCollection.orderIndex - 1] -> decrement
5. Set collection's orderIndex:
   - Moving up: nextCollection.orderIndex
   - Moving down: nextCollection.orderIndex - 1

### Race condition handling

Both updateCollectionOrder paths re-fetch orderIndex values WITHIN the locked transaction to prevent stale reads. If either collection was deleted between the initial fetch and the transaction, the operation is silently skipped.

## Duplication Strategy

`duplicateTeamCollection` implements deep copy as export-then-import:
1. Export the source collection to JSON (via `exportCollectionToJSONObject`)
2. Modify the name to append " - Duplicate"
3. Import the JSON under the same parent (via `importCollectionsFromJSON`)

This reuses existing import/export logic and preserves the full tree structure including nested requests.
