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
