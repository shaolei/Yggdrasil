# Categories — Interface

## Routes (all require auth)

### GET /categories

- **Success:** 200 `Category[]` (system categories where user_id IS NULL + user's custom categories)

### POST /categories

- **Body:** `{ name: string }`
- **Success:** 201 `{ id: number }`
- **Errors:** 403 CATEGORY_LIMIT, 400 validation

### PUT /categories/:id

- **Body:** `{ name: string }`
- **Success:** 200 `{ ok: true }`
- **Errors:** 404 NOT_FOUND (if not user-owned)

### DELETE /categories/:id

- **Success:** 204
- **Errors:** 404 NOT_FOUND, FK constraint error if expenses exist
