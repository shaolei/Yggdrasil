# Set Budget

## Business context

Budget limits help users control spending by category. Visual feedback (red highlighting) when over budget creates awareness.

## Trigger

User navigates to the budgets page for a specific month.

## Goal

User has set spending limits per category and can see current spending vs. limits.

## Participants

- **web/budgets** — Budget table with inline limit editing
- **api/budgets** — Upserts budget limits, returns spent totals
- **api/db** — Budget rows with ON CONFLICT upsert, expense aggregation via JOIN

## Paths

### Happy path

1. Web loads budgets for month (GET /budgets?month=YYYY-MM) — returns categories with current_total (spent) and limit_amount.
2. User enters a limit amount for a category and clicks Save.
3. Web sends PUT /budgets with {categoryId, month, limitAmount}.
4. API validates input, upserts budget row (INSERT ... ON CONFLICT(user_id, category_id, month) UPDATE).
5. Web refreshes budget list.

### Over budget

1a. On load, categories where current_total > limit_amount are highlighted in red.
1b. This is informational — no blocking behavior.

## Invariants

- Budget is per user, per category, per month (compound unique key).
- Upsert semantics: setting a budget for an existing month+category updates it.
- Spent totals are computed at query time from expenses, not stored.
