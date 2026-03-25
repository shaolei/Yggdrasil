# Categories

Manages expense categories: system defaults (seeded at DB init) and user-created custom categories.

## Responsible for

- Listing all categories visible to a user (system + custom)
- Creating custom categories with subscription limit enforcement (free: max 5)
- Updating custom categories (name only, user-owned)
- Deleting custom categories (blocked if expenses exist via FK RESTRICT)

## Not responsible for

- System category seeding (handled by api/db on startup)
- Expense management (delegated to api/expenses)
