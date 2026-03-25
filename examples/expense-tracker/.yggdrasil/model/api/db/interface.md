# Database — Interface

## Exports

### db (better-sqlite3 Database instance)

- Synchronous API: `db.prepare(sql).run(params)`, `db.prepare(sql).get(params)`, `db.prepare(sql).all(params)`
- Used by all api/* service modules for query execution

## Schema

| Table | Key Columns | Notes |
| ----- | ----------- | ----- |
| users | id, email, password_hash, created_at | Email unique |
| subscriptions | id, user_id (FK), plan, status | 1:1 with users |
| categories | id, user_id (FK, nullable), name, icon, color | NULL user_id = system default |
| expenses | id, user_id (FK), category_id (FK RESTRICT), amount, date, description | Amount in cents |
| budgets | id, user_id, category_id, month, limit_amount | Compound unique: (user_id, category_id, month) |
