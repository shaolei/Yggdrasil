# Budgets Page

UI for setting and monitoring monthly spending limits per category.

## Responsible for

- Month filter for selecting budget period
- Table showing categories with spent amount (current_total) vs. limit
- Inline form to set/update limit amounts per category
- Red highlighting when spent exceeds limit

## Not responsible for

- Budget enforcement on expense creation (api/expenses handles this)
- Computing spent totals (api/budgets computes via SQL JOIN)
