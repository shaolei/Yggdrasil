# Delete Expense

## Business context

Users remove incorrect or duplicate expense entries.

## Trigger

User clicks "Delete" on an expense row or from the edit page.

## Goal

Expense is permanently removed.

## Participants

- **web/expenses** — Delete button with optimistic removal from list state
- **api/expenses** — Verifies ownership and deletes
- **api/db** — Deletes expense row

## Paths

### Happy path

1. User clicks Delete on an expense.
2. Web sends DELETE /expenses/:id.
3. API verifies expense belongs to user, deletes row.
4. API returns 204 No Content.
5. Web removes expense from local state (optimistic).

### Not found

3a. Expense doesn't exist or belongs to another user.
3b. API returns 404 NOT_FOUND.

## Invariants

- Only the expense owner can delete (user_id check).
- Deletion is permanent (no soft-delete).
