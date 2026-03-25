# Reports — Interface

## Routes (all require auth)

### GET /reports/summary

- **Query:** `month` (YYYY-MM, defaults to current)
- **Success:** 200 `{ total: number, topCategories: { name, icon, color, total }[] }`

### GET /reports

- **Query:** `month` (YYYY-MM, defaults to current)
- **Success:** 200 `{ categories: { name, icon, color, total, percentage }[] }`
