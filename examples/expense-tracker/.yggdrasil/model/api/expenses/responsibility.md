# Expenses

Full CRUD for expense records with subscription limit enforcement and budget monitoring.

## Responsible for

- Listing expenses filtered by month, category, with pagination (default: 20 per page)
- Creating expenses: validates input, enforces free-plan limit (50/month), checks budget overage after insert
- Updating expenses: validates ownership (user_id), updates fields
- Deleting expenses: validates ownership, permanent delete
- Budget overage detection: on create, queries budget for month+category and returns warning if exceeded

## Not responsible for

- Budget management (delegated to api/budgets)
- Category management (delegated to api/categories)
- Authentication (uses requireAuth middleware from api/auth)
