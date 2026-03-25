# Manage Categories

## Business context

Custom categories let users organize expenses according to their personal spending patterns beyond the 6 system defaults.

## Trigger

User navigates to the categories page.

## Goal

User can view all categories and create/delete custom ones.

## Participants

- **web/categories** — Category list and creation form
- **api/categories** — CRUD with subscription limit enforcement
- **api/db** — Persists category rows

## Paths

### Happy path (create)

1. Web loads categories (GET /categories) — shows system + custom categories.
2. User fills name for a new custom category and submits.
3. API validates input, checks free-plan limit (5 custom categories).
4. API inserts category row with user_id.
5. Web refreshes list.

### Delete custom category

1. User clicks Delete on a custom category (system categories cannot be deleted).
2. Web sends DELETE /categories/:id.
3. API verifies category is user-owned (user_id IS NOT NULL) and deletes.
4. Returns 204.

### Subscription limit reached

3a. Free plan user has >= 5 custom categories.
3b. API returns 403 CATEGORY_LIMIT.
3c. Web shows limit error.

### Category has expenses (delete blocked)

3a. Category has associated expenses (FK RESTRICT).
3b. Delete fails at DB level.
3c. API returns error.

## Invariants

- System categories (user_id IS NULL) are immutable — seeded at DB init, cannot be modified or deleted.
- A category with existing expenses cannot be deleted (RESTRICT foreign key).
- Free plan: max 5 custom categories.
