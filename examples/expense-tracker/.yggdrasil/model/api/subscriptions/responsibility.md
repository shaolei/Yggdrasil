# Subscriptions

Manages user subscription plans (free/pro) and the upgrade path.

## Responsible for

- Fetching current subscription status (plan + status)
- Processing upgrade from free to pro (idempotent, mock — no payment processing)

## Not responsible for

- Enforcing subscription limits (handled by api/expenses and api/categories)
- Payment processing (not implemented in this example)
