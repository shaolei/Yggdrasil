# Responsibility

API routes: auth (NextAuth, register), orders (create, status update). Handles credentials validation, order creation with mock payment, and barista/owner status transitions.

**Responsible for:** /api/auth/*, /api/orders/*, /api/orders/[id]/status.

**Not responsible for:** Owner product API (owner node), database schema (lib node), payment mock (lib node).
