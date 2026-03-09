# Entity Permissions

## Identity

Builds the complete permissions object for a single entity (collection or global). Evaluates per-operation access functions, resolves Where-query results against the database when document data is available, and recursively populates field-level permissions including blocks and tabs.

## Boundaries

- IS responsible for: building the hierarchical permissions tree (entity -> fields -> blocks/tabs), Where-query caching and deduplication, field permission inheritance from parent, block reference permission caching
- IS NOT responsible for: defining access functions (user-defined), executing individual access checks (uses the access function directly), sanitizing the final permissions output (done by `sanitizePermissions` elsewhere)
