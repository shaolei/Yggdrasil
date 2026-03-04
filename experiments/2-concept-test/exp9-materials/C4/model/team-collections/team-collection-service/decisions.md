# TeamCollectionService — Decisions

## Why duplication uses export + import

Rather than implementing a separate deep-copy method, duplication exports the collection to JSON, modifies the title (appending " - Duplicate"), then re-imports. This reuses the existing recursive import logic (which handles nested children, requests, locking, and orderIndex assignment) without duplicating it. Trade-off: slightly more overhead (serialization round-trip) but eliminates a separate code path that would need to maintain parity with import logic.

## Why search uses raw SQL instead of Prisma query builder

The search requires PostgreSQL-specific features: `ILIKE` for case-insensitive matching, `similarity()` function for fuzzy ranking, and `escapeSqlLikeString` for safe wildcard injection. Prisma's query builder doesn't expose `similarity()` or custom ordering by a function result. Raw SQL is the only option for this query pattern.

## Why parent tree reconstruction uses recursive CTE

After finding search matches, the UI needs to display breadcrumb paths (e.g., "Team > Parent Collection > Child Collection > Match"). Rather than making N queries to walk up the tree per result, a single `WITH RECURSIVE` CTE efficiently fetches the entire ancestor chain in one query. This is critical for performance when search returns many results.

## Why `isParent` walks up, not down

To check if Collection_A is an ancestor of Collection_D, the code walks UP from D to root (following parentID links), checking if any parent is A. The alternative — walking DOWN from A through all descendants — would require loading the entire subtree. Walking up follows a single chain of parentID pointers, which is O(depth) not O(subtree_size).

## Why orderIndex is integer-based, not fractional

Integer orderIndex with gap-filling (decrement on delete, shift on reorder) requires touching multiple rows on every mutation but guarantees contiguous, predictable indexes. Fractional ordering (assigning values between existing items) avoids touching siblings but eventually requires rebalancing when precision is exhausted. For a real-time collaborative tool where consistency matters more than write throughput, integer ordering is simpler to reason about.

## Why create/move/reorder have retries but delete does not

Create, move, and reorder operations modify overlapping orderIndex ranges on the same sibling set and can race with each other. Two concurrent creates may both read the same "last orderIndex" and attempt to assign the same value; two concurrent reorders may shift overlapping ranges. The retry loop handles these transient conflicts. Delete does not need retries because it is inherently idempotent — removing a row that is already gone is a no-op, and the subsequent gap-filling reindex operates on a strictly smaller set, reducing the chance of conflict.
