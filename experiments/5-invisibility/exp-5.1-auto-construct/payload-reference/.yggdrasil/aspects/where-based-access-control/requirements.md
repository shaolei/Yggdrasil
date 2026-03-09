# Where-Based Access Control

## What

Payload's access control functions can return:
- `true` — full access granted
- `false` — access denied
- A `Where` query object — access is granted only for documents matching the query

This creates two distinct access evaluation modes:
1. **Boolean mode** (`executeAccess`): For operation-level checks (can this user perform this action?). Returns the access result directly; throws `Forbidden` if falsy and errors not disabled.
2. **Where mode** (`getEntityPermissions`): For permission introspection. Calls all access functions, collects Where queries, and optionally evaluates them against the database.

## Where Query Evaluation

When `fetchData` is true in `getEntityPermissions`:
- Where queries are executed against the DB using `entityDocExists` to determine if the specific document matches
- Results are cached: identical Where objects (deep equality) reuse the same DB query promise

When `fetchData` is false:
- Where queries are stored but NOT evaluated
- The permission is set to `true` with the Where attached (the consumer must filter at query time)
- NOTE: There is a known concern (TODO in code) about whether this should default to `false` for security

## Why

Boolean access is simple but cannot express row-level security. Where-based access enables patterns like "users can only read their own documents" without loading all documents into memory. The dual mode exists because permission introspection (admin UI) needs to check many operations at once efficiently, while operation execution needs a definitive allow/deny.
