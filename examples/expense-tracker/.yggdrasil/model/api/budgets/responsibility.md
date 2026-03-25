# Budgets

Manages monthly spending limits per category. Computes current spending via expense aggregation at query time.

## Responsible for

- Listing budgets for a month: returns categories with limit_amount and computed current_total (from expenses JOIN)
- Upserting budgets: INSERT ... ON CONFLICT(user_id, category_id, month) UPDATE — allows setting and updating limits in a single operation

## Not responsible for

- Budget enforcement on expense creation (handled by api/expenses as a warning, not a block)
- Category management (delegated to api/categories)
