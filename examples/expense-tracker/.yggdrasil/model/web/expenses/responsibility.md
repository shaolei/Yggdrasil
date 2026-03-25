# Expense Pages

UI for expense management: listing, creating, editing, and deleting expenses.

## Responsible for

- Expense list: month filter, paginated table with Edit/Delete actions, optimistic delete from local state
- Add expense form: category dropdown (fetched from API), amount (display currency → cents), date, description. Shows budget overage warning (2s delay before navigation)
- Edit expense form: pre-filled with current values, supports update and delete
- Handling 403 EXPENSE_LIMIT errors with upgrade prompts

## Not responsible for

- Budget management UI (delegated to web/budgets)
- Category management UI (delegated to web/categories)
