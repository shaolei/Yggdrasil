# Access Control Interface

## executeAccess

```typescript
executeAccess(
  { id, data, disableErrors, isReadingStaticFile, req }: OperationArgs,
  access: Access
): Promise<AccessResult>
```

Runs the provided access function. If it returns a falsy value and `disableErrors` is false, throws `Forbidden`. If no access function is provided, returns `true` if `req.user` exists, otherwise throws `Forbidden`.

## getAccessResults

```typescript
getAccessResults({ req }): Promise<SanitizedPermissions>
```

Builds the full permissions object for the current user across all collections and globals. Resolves access functions in parallel using `Promise.all`. Returns `{ canAccessAdmin, collections, globals }` where each entity has per-operation permissions and field-level permissions.

Also determines `canAccessAdmin` based on the user's collection having an `admin` access function.
