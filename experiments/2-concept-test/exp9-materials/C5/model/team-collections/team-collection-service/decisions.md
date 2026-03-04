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

Integer orderIndex was chosen because the Prisma ORM used by Hoppscotch has poor support for decimal/float columns in PostgreSQL. Prisma's `Decimal` type maps to `@db.Decimal` which introduces significant overhead in serialization and comparison operations, and Prisma's query builder does not support `updateMany` with arithmetic on float columns reliably — rounding errors can cause `WHERE orderIndex > 3.5` to miss or include unexpected rows. Using integers avoids these ORM-layer precision issues entirely and ensures that Prisma's generated SQL produces exact matches. The trade-off (touching multiple rows on every mutation) is acceptable because the sibling sets are typically small.

## Why delete has retries but other mutations do not

Delete+reindex can race with other deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. The pessimistic lock prevents data corruption but can cause deadlocks when lock acquisition order differs. The retry loop handles these transient deadlocks. Create and move operations are less prone to this because they typically modify non-overlapping index ranges (append at end, or shift in one direction).
