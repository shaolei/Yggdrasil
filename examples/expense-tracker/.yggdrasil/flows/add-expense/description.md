# Add Expense

## Business context

Expense recording is the core action of the product. Budget awareness at creation time helps users stay on track.

## Trigger

User clicks "Add expense" from the expenses list.

## Goal

New expense is saved. User is informed if a budget limit was exceeded.

## Participants

- **web/expenses** — AddExpense form (category, amount, date, description)
- **api/expenses** — Validates, checks subscription limit, inserts, checks budget
- **api/categories** — Provides category list for the form
- **api/db** — Persists expense row, queries budget/expense aggregates

## Paths

### Happy path

1. Web fetches categories (GET /categories) to populate the dropdown.
2. User fills category, amount (in display currency, converted to cents), date, optional description.
3. Web submits POST /expenses.
4. API validates input against expenseSchema.
5. API checks free-plan limit (50 expenses/month). Plan is "pro" or count < 50: proceeds.
6. API inserts expense row.
7. API queries budget for this month+category. If budget exists and current_total > limit, returns `{id, budgetExceeded: {categoryId, categoryName}}`.
8. Web shows budget warning alert (2s delay), then navigates to /expenses.

### Subscription limit reached (free plan)

5a. User is on free plan and has >= 50 expenses this month.
5b. API returns 403 EXPENSE_LIMIT.
5c. Web shows limit error with upgrade prompt.

### No budget set

7a. No budget row for this month+category.
7b. Returns `{id}` without budgetExceeded.
7c. Web navigates immediately to /expenses.

## Invariants

- Amounts are stored as positive integers (cents).
- Budget overage is a warning, not a blocker — the expense is always saved if under the subscription limit.
- Expense is always scoped to the authenticated user_id.
