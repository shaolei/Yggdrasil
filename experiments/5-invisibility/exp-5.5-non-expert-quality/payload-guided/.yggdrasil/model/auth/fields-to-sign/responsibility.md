# Fields To Sign

## Responsibility

Determines which user fields should be included in the JWT payload. Always includes `id`, `collection`, and `email`. Optionally includes the session ID (`sid`). Traverses the collection's field config to find fields with `saveToJWT: true` (or a custom key name). Supports nested field types: groups, tabs, collapsible, and row fields.

Fields with `saveToJWT: false` are explicitly excluded from the JWT payload.
