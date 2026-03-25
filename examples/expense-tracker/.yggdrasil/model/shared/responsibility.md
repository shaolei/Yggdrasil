# Shared

Shared package providing domain types and validation schemas consumed by both the API and web apps.

## Responsible for

- Domain types: User, Subscription (plan: free|pro), Category, Expense, Budget
- Zod validation schemas: registerSchema, loginSchema, expenseSchema, categorySchema, budgetSchema, changePasswordSchema
- TypeScript type inference from Zod schemas (z.infer)
- Re-exporting all types and schemas from index.ts

## Not responsible for

- Business logic (types are data shapes only)
- API-specific or web-specific concerns
