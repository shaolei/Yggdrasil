# Database

SQLite database setup and schema management. Exports the `db` instance used by all service modules.

## Responsible for

- Opening SQLite database file (data.db or DB_PATH env var) via better-sqlite3
- Executing DDL: 5 tables (users, subscriptions, categories, expenses, budgets) with foreign keys and indexes
- Seeding 6 predefined system categories (Food, Transport, Entertainment, Shopping, Health, Other) with icons and colors
- Enabling WAL mode and foreign key enforcement

## Not responsible for

- Business logic or query construction (each service builds its own queries)
- Migrations (schema is applied on every startup, idempotent via IF NOT EXISTS)
