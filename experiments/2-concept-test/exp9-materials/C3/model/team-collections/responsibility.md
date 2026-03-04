# Team Collections

Manages the hierarchical collection tree for teams in Hoppscotch. Collections organize API requests into a tree structure with arbitrary nesting depth, integer-based sibling ordering, and real-time collaboration via PubSub events.

## In scope

- Collection CRUD (create, read, update, delete)
- Tree operations (move between parents, reorder siblings, sort)
- Tree integrity (circular reference prevention, orderIndex consistency)
- Import/export (JSON serialization of entire subtrees)
- Search with parent tree reconstruction (breadcrumb paths)
- Duplication (export + re-import pattern)
- Real-time event publishing for all mutations

## Out of scope

- User authentication and authorization (handled by guards/resolvers)
- Request-level CRUD (separate TeamRequest service)
- Team management (delegated to TeamService)
