# M1 Gold Standard — Additive Change (searchTeamCollections method)

## Summary of Change

Added a new public method `searchTeamCollections(teamID, query, take, skip)` that:
- Searches collections by title within a team using raw SQL with ILIKE + similarity()
- Returns matching collections with parent info (parentID, parentTitle) via LEFT JOIN
- Publishes a `team_coll/${teamID}/coll_search` PubSub event for search analytics
- Does NOT use pessimistic locking (intentional — read-only operation)
- Does NOT use retry-on-deadlock (no mutations, no locking)

## Artifacts That Need Updating

### responsibility.md

**Change:** Add the new search method to the "In scope" list.

Current:
```
- Search: raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction
```

Updated:
```
- Search: raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction
- Collection search with parent context: `searchTeamCollections` returns matches with parent title for breadcrumb display
```

### logic.md

**Change:** Add a section describing the new method's algorithm.

Add:
```
## searchTeamCollections (collection search with parent context)

1. Validate query is non-empty (reject empty/whitespace-only queries)
2. Escape query for SQL LIKE injection safety
3. Execute raw SQL: LEFT JOIN TeamCollection with its parent to get parentTitle
4. Filter by teamID and ILIKE match on title
5. Order by similarity() DESC, then orderIndex ASC for stable ordering
6. Apply LIMIT/OFFSET for pagination
7. Publish analytics event to `team_coll/${teamID}/coll_search` with query, resultCount, and timestamp
8. Return matched collections with parent info
```

### constraints.md

**No change needed.** The new method is read-only and does not affect any existing constraints.

### decisions.md

**Change:** Add a decision explaining why this method exists alongside the existing `searchCollections` private method.

Add:
```
## Why searchTeamCollections exists alongside searchCollections

The existing `searchCollections` is a private method used internally by `searchByTitle` — it returns bare search results (id, title, type) that are then enriched with parent tree data via recursive CTE. The new `searchTeamCollections` is a public method that returns collections with immediate parent info (parentTitle) via a simple LEFT JOIN. This is more efficient for use cases that only need one level of parent context (e.g., autocomplete dropdowns) rather than the full breadcrumb path.
```

## Aspects Affected

### pubsub-events aspect

**Change needed:** The new PubSub event `team_coll/${teamID}/coll_search` should be documented in the aspect's content.md.

Current channel naming convention does not include search events. Add:
```
- `team_coll/${teamID}/coll_search` — search analytics event (payload: query, resultCount, timestamp)
```

Also note under "Timing":
```
Search events are published after the query completes. Since search is read-only (no transaction), there is no commit-ordering concern.
```

### pessimistic-locking aspect

**No change needed.** The new method deliberately does not use locking because it is read-only. This is consistent with the aspect's scope ("Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first").

### retry-on-deadlock aspect

**No change needed.** The new method has no retry loop and does not need one.

## Aspect Violations

**None.** The new method is read-only. The pessimistic-locking aspect only requires locking for operations that "read and then modify sibling orderIndex values." A pure read operation is not in scope.

## node.yaml

**No change needed.** The node already maps the correct file and has the correct aspects.

## Difficulty Assessment

**Easy recovery.** An agent should:
1. Detect that a new public method was added
2. Update responsibility.md and logic.md to document it
3. Add a decisions.md entry explaining the relationship to existing search
4. Update the pubsub-events aspect with the new channel
5. Correctly identify that no locking aspect changes are needed (read-only)
