# Access Control

## Responsibility

Executes access control functions and assembles full permission maps for the current user.

- `executeAccess`: Runs a single access function, throws `Forbidden` on denial (unless `disableErrors` is true). If no access function is provided, falls back to checking `req.user` existence.
- `getAccessResults`: Builds the complete permissions object across all collections and globals by calling `getEntityPermissions` for each. Used by the `/access` endpoint.
- `defaultAccess`: Simple function that returns `true` if `req.user` exists.

## Not Responsible For

- Defining access functions (user-configured)
- Field-level permission computation (delegated to permissions module)
