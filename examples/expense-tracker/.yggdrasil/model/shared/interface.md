# Shared — Interface

## Types

- `User` — { id, email, createdAt }
- `Subscription` — { id, userId, plan: "free" | "pro", status: "active" }
- `Category` — { id, userId (nullable), name, icon, color }
- `Expense` — { id, userId, categoryId, amount (cents), date, description? }
- `Budget` — { id, userId, categoryId, month, limitAmount }

## Validation Schemas (Zod)

- `registerSchema` — { email: email, password: min 6 }
- `loginSchema` — { email: email, password: string }
- `expenseSchema` — { categoryId: number, amount: positive int, date: YYYY-MM-DD, description?: string }
- `categorySchema` — { name: min 1 }
- `budgetSchema` — { categoryId: number, month: YYYY-MM, limitAmount: positive int }
- `changePasswordSchema` — { currentPassword: string, newPassword: min 6 }

Each schema exports an inferred TypeScript type via `z.infer<typeof schema>`.
