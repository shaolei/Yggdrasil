# Entity Permissions

## Responsibility

Builds the complete permissions object for an entity (collection or global), including both entity-level and field-level permissions. Evaluates access functions for each operation and recursively processes field permissions for nested structures (groups, tabs, blocks, arrays).

## Not Responsible For

- Defining access functions (user-configured)
- Executing access at request time (that's executeAccess)
- Sanitizing the permissions output (that's sanitizePermissions)
