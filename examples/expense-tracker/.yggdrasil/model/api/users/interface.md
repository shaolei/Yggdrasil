# Users — Interface

## Routes (all require auth)

### GET /users/me

- **Success:** 200 `{ id, email, createdAt }`

### PUT /users/me/password

- **Body:** `{ currentPassword: string, newPassword: string }`
- **Success:** 200 `{ ok: true }`
- **Errors:** 400 INVALID_PASSWORD, 400 validation
