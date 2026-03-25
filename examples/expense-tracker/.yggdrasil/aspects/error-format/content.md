# Consistent Error Format

## What

All API error responses follow a consistent JSON structure with an `error` string code and appropriate HTTP status.

## Why

Clients can rely on a predictable error shape for display and branching logic. Error codes are stable identifiers (not user-facing messages), allowing the web app to map them to UI behavior.

## Error Codes

| Code | HTTP Status | Meaning |
| ---- | ----------- | ------- |
| `EMAIL_TAKEN` | 409 | Registration with existing email |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `EXPENSE_LIMIT` | 403 | Free plan monthly expense limit reached |
| `CATEGORY_LIMIT` | 403 | Free plan custom category limit reached |
| `NOT_FOUND` | 404 | Resource does not exist or not owned by user |
| `INVALID_PASSWORD` | 400 | Current password verification failed |
| Validation errors | 400 | `{ error: "Validation failed", details: fieldErrors }` |
