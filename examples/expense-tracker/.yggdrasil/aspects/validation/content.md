# Input Validation

## What

All API endpoints that accept user input validate the request body against a Zod schema from the shared package before any service logic runs.

## Why

Prevents invalid data from reaching the database. Centralizing schemas in the shared package ensures API and web can share the same validation rules and inferred TypeScript types.

## How

- Schemas defined in `packages/shared/src/validation.ts` using Zod.
- Routes call `schema.safeParse(request.body)`. On failure, return 400 with `{ error: "Validation failed", details: result.error.flatten().fieldErrors }`.
- Schemas: `registerSchema`, `loginSchema`, `expenseSchema`, `categorySchema`, `budgetSchema`, `changePasswordSchema`.
- Amount fields are validated as positive integers (cents, not decimal).
