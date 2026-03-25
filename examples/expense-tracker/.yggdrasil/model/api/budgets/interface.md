# Budgets — Interface

## Routes (all require auth)

### GET /budgets

- **Query:** `month` (YYYY-MM, defaults to current month)
- **Success:** 200 `Budget[]` with `current_total` computed from expenses

### PUT /budgets

- **Body:** `{ categoryId: number, month: string, limitAmount: number }`
- **Success:** 200 `{ ok: true }`
- **Errors:** 400 validation
