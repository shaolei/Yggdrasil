# View Reports

## Business context

Spending visibility is the primary value proposition. Users see where their money goes to make better financial decisions.

## Trigger

User navigates to the dashboard or reports page.

## Goal

User sees total spending, top categories, and detailed per-category breakdown for a given month.

## Participants

- **web/dashboard** — Summary view: total spent, top 5 categories, recent 5 expenses
- **web/reports** — Detailed view: all categories with amounts and percentages
- **api/reports** — Aggregation queries (summary and by-category)
- **api/db** — Expense aggregation with GROUP BY category

## Paths

### Dashboard (summary)

1. Web fetches GET /reports/summary?month=YYYY-MM and GET /expenses?limit=5.
2. Displays total spent, top 5 categories, and 5 most recent expenses.

### Reports page (detailed)

1. Web fetches GET /reports?month=YYYY-MM.
2. Displays all categories with amount and percentage of total.
3. User can change month filter to view different periods.

## Invariants

- All aggregation is computed at query time (no materialized summaries).
- Reports are scoped to the authenticated user's expenses only.
- Month defaults to current month if not specified.
