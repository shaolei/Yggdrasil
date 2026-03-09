# Token Management — Internals

## Logic

### Field Traversal for JWT

`getFieldsToSign` recursively traverses collection fields to build the JWT payload:
- Regular fields: included if `saveToJWT` is truthy, excluded if `false`
- `saveToJWT: "string"` — field value is stored under the custom key name
- Groups: if `saveToJWT`, group data is nested; group fields are then traversed within that context
- Tabs: named tabs work like groups; unnamed tabs merge into parent
- Collapsible/row: transparent — fields within are traversed in parent context

### Session Management

Sessions are stored as an array on the user document. Each session has `{ id (UUID), createdAt, expiresAt }`. On login, expired sessions are cleaned up and the new session is appended. The `updatedAt` field is set to null before the DB write to prevent the session-add operation from changing the user's visible last-modified timestamp.

### Cookie SameSite Logic

If `sameSite` config is a string ('Lax', 'None', 'Strict'), it's used directly. If boolean `true`, it becomes 'Strict'. If `false`/undefined, omitted. When `sameSite === 'None'`, `secure` is forced to `true` (browser requirement).

## Decisions

- **Chose jose over jsonwebtoken for JWT**: rationale: unknown — inferred from code. jose is a modern, standards-compliant library that works in edge runtimes (no native dependencies).
- **Session updatedAt = null trick**: Prevents session add/remove from updating the user's visible modification timestamp. rationale: unknown — likely to avoid confusing API consumers who expect `updatedAt` to reflect meaningful user data changes.
- **AES-256-CTR for encryption**: rationale: unknown. Used for API key encryption. Uses `this.secret` binding pattern which is unusual — marked with `@ts-expect-error` comments.
