# Entity Permissions — Interface

## getEntityPermissions

```typescript
getEntityPermissions<TEntityType extends 'collection' | 'global'>(args: {
  blockReferencesPermissions: BlockReferencesPermissions;
  data?: JsonObject;
  entity: SanitizedCollectionConfig | SanitizedGlobalConfig;
  entityType: TEntityType;
  operations: AllOperations[];
  req: PayloadRequest;
} & ({ fetchData: false } | { fetchData: true; id: DefaultDocumentIDType })
): Promise<CollectionPermission | GlobalPermission>
```

Builds the complete permission object for one entity.

**Parameters:**
- `blockReferencesPermissions` — shared cache for block reference permissions (mutated)
- `data` — optional pre-loaded document data (avoids DB fetch)
- `entity` — the collection or global config
- `fetchData` — if true, Where queries are evaluated against DB; if false, stored but not evaluated
- `id` — required when fetchData is true and entityType is 'collection'
- `operations` — which operations to evaluate (CRUD, unlock, readVersions)
- `req` — contains user, locale, payload

**Return:** Permission object with per-operation permissions and nested `fields` object.

**Failure:** Throws if fetchData is true, entityType is 'collection', and id is missing. Throws after 100 promise iterations (infinite loop safety).

## populateFieldPermissions

```typescript
populateFieldPermissions(args: {
  blockReferencesPermissions: BlockReferencesPermissions;
  data: JsonObject | undefined;
  fields: Field[];
  id?: DefaultDocumentIDType;
  operations: AllOperations[];
  parentPermissionsObject: CollectionPermission | FieldPermissions | GlobalPermission;
  permissionsObject: FieldsPermissions;
  promises: Promise<void>[];
  req: PayloadRequest;
}): void
```

Synchronous function that populates field permissions and collects async work into the `promises` array. Handles named fields, unnamed groups, tabs (named and unnamed), blocks, and block references.

**Key behavior:**
- Skips `delete`, `readVersions`, `unlock` operations for fields
- Fields with access functions: invokes them (sync or async)
- Fields without access functions: inherits from parent permission
- Block references are cached via `blockReferencesPermissions` — first encounter computes, subsequent reuse
- Recursive for nested field structures
