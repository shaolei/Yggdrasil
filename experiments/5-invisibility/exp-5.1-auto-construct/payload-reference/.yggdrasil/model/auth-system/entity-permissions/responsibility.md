# Entity Permissions

## Identity

Builds detailed permission objects for a single entity (collection or global), including entity-level operation permissions and recursive field-level permissions with block reference caching.

## Responsibilities

- Invoke access functions for each operation on an entity
- Process boolean and Where-based access results
- Cache and evaluate Where queries against the database (when fetchData is true)
- Recursively build field-level permissions respecting inheritance from parent
- Handle block reference permission caching across entities
- Support both sync and async access function results

## Not Responsible For

- Iterating over all collections/globals (handled by access-control/getAccessResults)
- Defining access functions (defined in collection/global/field config)
- Executing the database query for Where evaluation (delegates to entityDocExists)
- Admin access evaluation (handled by access-control)
