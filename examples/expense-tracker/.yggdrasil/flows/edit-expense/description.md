# Edit Expense

## Business context

Users correct mistakes or recategorize expenses after the fact.

## Trigger

User clicks "Edit" on an expense row.

## Goal

Expense is updated with new values.

## Participants

- **web/expenses** — EditExpense form pre-filled with current values
- **api/expenses** — Validates ownership and updates
- **api/categories** — Provides category list for the dropdown
- **api/db** — Updates expense row

## Paths

### Happy path

1. Web fetches expense by ID (GET /expenses/:id) and categories (GET /categories).
2. User modifies fields and submits.
3. API validates input, verifies expense belongs to user (user_id match).
4. API updates expense row.
5. Web navigates to /expenses.

### Not found

3a. Expense ID doesn't exist or belongs to another user.
3b. API returns 404 NOT_FOUND.

## Invariants

- Only the expense owner can edit (user_id check in WHERE clause).
- Edit does not re-check subscription limits (limits apply only to creation).
