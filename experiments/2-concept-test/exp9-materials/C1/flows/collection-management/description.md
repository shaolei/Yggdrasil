# Collection Management

## Business context

Hoppscotch organizes API requests into hierarchical collections. Teams collaborate on these collections in real-time. Collections can be nested (parent-child), reordered among siblings, moved between parents, searched, imported/exported as JSON, and duplicated.

## Trigger

A team member performs a collection operation via the GraphQL API (create, rename, delete, move, reorder, sort, search, import, export, duplicate).

## Goal

Maintain a consistent, ordered tree of collections per team, with real-time updates to all connected team members.

## Participants

- **team-collections/team-collection-service** — The single service that handles all collection operations. Coordinates Prisma transactions, PubSub events, and tree integrity validation.

## Paths

### Create collection

1. Validate title length (minimum 1 character)
2. If parent specified: verify parent belongs to the same team
3. Lock sibling rows under the target parent
4. Find the last orderIndex among siblings
5. Create collection with orderIndex = last + 1 (or 1 if first)
6. Publish `coll_added` event

### Delete collection

1. Fetch collection details
2. Lock sibling rows under the same parent
3. Delete the collection (Prisma cascades to children and requests)
4. Decrement orderIndex of all siblings with higher orderIndex (fills the gap)
5. If deadlock/conflict: retry up to 5 times with linear backoff
6. Publish `coll_removed` event

### Move collection

1. Validate: source != destination, same team, not moving into own descendant (circular reference check)
2. Lock source's current sibling set
3. Lock destination's sibling set (if moving into a collection)
4. Recursive `isParent` check: walk up from destination to root, ensuring source is not an ancestor
5. Decrement orderIndex of source's former siblings
6. Assign source to new parent with orderIndex = last + 1 under new parent
7. Publish `coll_moved` event

### Reorder collection (move to position)

Two sub-paths:

**Move to end:** Lock siblings → decrement all after current position → set orderIndex to count of siblings

**Move to specific position:** Lock siblings → determine direction (up/down) → shift affected range by +1 or -1 → set collection to target position

8. Publish `coll_order_updated` event

### Search

1. Execute two raw SQL queries: one for collections, one for requests (both use `ILIKE` and `similarity()` for fuzzy matching)
2. For each result: reconstruct the parent tree using recursive CTE (WITH RECURSIVE)
3. Return results with breadcrumb path

### Import from JSON

1. Parse and validate JSON array
2. Lock sibling rows under target parent
3. Find last orderIndex
4. Recursively create collections, requests, and nested children in a single transaction
5. Publish `coll_added` for each top-level created collection

### Duplicate collection

1. Export collection to JSON (recursive)
2. Append " - Duplicate" to title
3. Import the modified JSON under the same parent
4. Reuses import flow, which handles locking and ordering

## Invariants across all paths

- OrderIndex is 1-based, contiguous, and unique within a sibling set (same teamID + parentID)
- Every sibling-order mutation acquires a pessimistic row lock before reading orderIndex values
- A collection cannot be moved into its own descendant (prevents circular trees)
- Every successful mutation publishes a PubSub event for real-time clients
- All business errors return fp-ts Either.left, never throw
- Delete cascades to all children and requests (Prisma relation cascade)
