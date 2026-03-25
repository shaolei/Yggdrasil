# Subscriptions — Interface

## Routes (all require auth)

### GET /subscriptions/me

- **Success:** 200 `{ plan: "free" | "pro", status: "active" }`

### POST /subscriptions/upgrade

- **Success:** 200 `{ ok: true, plan: "pro" }`
- Idempotent — safe to call if already on pro plan
