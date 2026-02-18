# Responsibility

Shared library: database (Drizzle schema, client), auth config (NextAuth), cart context (React), mock Stripe. Provides infrastructure used by customer, barista, owner, and api nodes.

**Responsible for:** lib/db/, lib/auth.ts, lib/cart-context.tsx, lib/stripe-mock.ts.

**Not responsible for:** API route handlers (api node), UI components (customer, barista, owner).
