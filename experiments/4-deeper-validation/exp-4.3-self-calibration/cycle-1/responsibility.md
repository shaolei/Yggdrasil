# TeamCollectionService

Manages the full lifecycle of team collections within the Hoppscotch backend. Collections are organized as a tree hierarchy (parent-child) within a team, with integer-based ordering among siblings.

## Core Responsibilities

- **CRUD**: Create, read, update, and delete team collections
- **Tree operations**: Move collections between parents (including to/from root), with circular reference prevention
- **Ordering**: Reorder sibling collections, sort by title, maintain orderIndex integrity across concurrent operations
- **Search**: Full-text search across collections and requests with parent tree generation for breadcrumb paths
- **Import/Export**: Serialize collection trees to JSON and reconstruct from JSON strings
- **Duplication**: Deep-copy a collection and all its nested children and requests
- **CLI support**: Provide collection tree retrieval for CLI consumers with team membership verification

## Not Responsible For

- Team membership or role verification (handled by guards at the resolver layer)
- Request-level CRUD (handled by TeamRequestService)
- GraphQL subscription setup (handled by TeamCollectionResolver via PubSubService)
