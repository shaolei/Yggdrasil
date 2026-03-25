# Reports

Read-only aggregation service for spending analysis. Provides summary and per-category breakdowns.

## Responsible for

- Monthly summary: total spent + top 5 categories for a given month
- Category breakdown: all categories with amounts, computed at query time via GROUP BY

## Not responsible for

- Data modification (read-only)
- Expense or budget management
