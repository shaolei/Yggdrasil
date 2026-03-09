# Entity Permissions Interface

## getEntityPermissions

```typescript
getEntityPermissions<TEntityType>(args: {
  blockReferencesPermissions: BlockReferencesPermissions
  data?: JsonObject
  entity: SanitizedCollectionConfig | SanitizedGlobalConfig
  entityType: 'collection' | 'global'
  fetchData: boolean
  id?: DefaultDocumentIDType
  operations: AllOperations[]
  req: PayloadRequest
}): Promise<CollectionPermission | GlobalPermission>
```

Builds permissions for an entity across specified operations. Two modes:

- **fetchData=false**: Where queries from access functions are NOT evaluated against the database. Where results default to `permission: true` (known issue, may change to false in v4). If `data` is passed, it's forwarded to access functions.
- **fetchData=true**: Where queries are evaluated by checking if the entity doc exists with the combined where constraint. Requires `id` for collections.

Access functions are resolved in parallel. Where queries with identical structure are cached (deep equality check) to avoid duplicate DB calls.

## populateFieldPermissions

```typescript
populateFieldPermissions(args: {
  blockReferencesPermissions: BlockReferencesPermissions
  data: JsonObject | undefined
  fields: Field[]
  id?: DefaultDocumentIDType
  operations: AllOperations[]
  parentPermissionsObject: CollectionPermission | FieldPermissions | GlobalPermission
  permissionsObject: FieldsPermissions
  promises: Promise<void>[]
  req: PayloadRequest
}): void
```

Synchronously traverses field config and evaluates field-level access functions. Async work is collected into the `promises` array for later resolution. Fields without names inherit parent permissions. Handles blocks, tabs, groups, rows, and collapsible fields. Block reference permissions are cached and shared by reference.

## entityDocExists

```typescript
entityDocExists(args: {
  id?: DefaultDocumentIDType; slug: string; entityType: 'collection' | 'global';
  locale?: string; operation?: AllOperations; req: PayloadRequest; where: Where
}): Promise<boolean>
```

Checks if a document exists matching the where constraint. For collections, combines the where with `id: { equals: id }`. For `readVersions`, checks versions table instead. For globals, checks if the global doc matches.
