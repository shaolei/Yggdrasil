# Expenses — Interface

## Routes (all require auth)

### GET /expenses

- **Query:** `month` (YYYY-MM), `categoryId`, `page` (default 1), `limit` (default 20)
- **Success:** 200 `{ expenses: Expense[], total: number }`

### GET /expenses/:id

- **Success:** 200 `Expense`
- **Errors:** 404 NOT_FOUND

### POST /expenses

- **Body:** `{ categoryId: number, amount: number, date: string, description?: string }`
- **Success:** 201 `{ id: number, budgetExceeded?: { categoryId, categoryName } }`
- **Errors:** 403 EXPENSE_LIMIT, 400 validation

### PUT /expenses/:id

- **Body:** `{ categoryId, amount, date, description? }`
- **Success:** 200 `{ ok: true }`
- **Errors:** 404 NOT_FOUND, 400 validation

### DELETE /expenses/:id

- **Success:** 204
- **Errors:** 404 NOT_FOUND
