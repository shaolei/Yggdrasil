# Layout

Shared layout wrapper for all authenticated pages.

## Responsible for

- Header with navigation links (Dashboard, Expenses, Categories, Budgets, Reports)
- User dropdown menu (Settings, Logout)
- Active route highlighting based on current path
- Wrapping page content via React Router outlet

## Not responsible for

- Page content (rendered by child routes)
- Authentication logic (ProtectedRoute in web parent handles this)
