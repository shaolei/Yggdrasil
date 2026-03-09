# Access Control Pattern

## What

Access control functions can return either:
- `boolean` — grants or denies access immediately
- `Where` query object — enables row-level security by merging the constraint into the database query

If no access function is defined for an operation, `defaultAccess` applies: logged-in users are granted access, anonymous users are denied.

## Why

Where-clause-based access is critical for performance. Instead of loading all documents and filtering in memory, the constraint is pushed to the database. Example: "users can only read their own documents" becomes `{ createdBy: { equals: req.user.id } }`.

## Known Issue

When `fetchData` is false and a Where query is returned, the current code defaults to `permission: true`. A TODO in the codebase notes this should probably default to `false` in v4 for security.

## Constraints

- Access functions receive `{ id, data, req }` as arguments
- When access returns false and `disableErrors` is not set, a `Forbidden` error is thrown
- Field-level access functions follow the same pattern but only support `create`, `read`, `update` (not `delete`, `readVersions`, `unlock`)
