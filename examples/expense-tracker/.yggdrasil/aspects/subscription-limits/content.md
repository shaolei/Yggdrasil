# Subscription Limits

## What

Free-plan users have enforced limits: max 50 expenses per calendar month and max 5 custom categories. Pro-plan users have no limits.

## Why

Freemium model: free tier provides enough value to onboard users, limits create upgrade incentive. Limits are enforced server-side in the service layer before INSERT to prevent over-quota data.

## How

- **Expenses:** `expenses.service.create()` counts user's expenses for the current month. If count >= 50 and plan is "free", returns `EXPENSE_LIMIT` error (403).
- **Categories:** `categories.service.create()` counts user's custom categories (user_id IS NOT NULL). If count >= 5 and plan is "free", returns `CATEGORY_LIMIT` error (403).
- **Web:** AddExpense and Categories pages display limit counters for free-plan users. 403 responses show upgrade prompts.
- **Upgrade:** POST /subscriptions/upgrade changes plan to "pro" (idempotent, no payment processing in this example).
