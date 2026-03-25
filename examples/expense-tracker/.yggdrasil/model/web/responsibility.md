# Web

React SPA serving the expense tracker frontend. Provides routing, authentication context, API communication, and page layout.

## Responsible for

- Application routing (BrowserRouter with protected and public routes)
- Authentication context (AuthContext): user state, token storage in localStorage, login/register/logout/loadUser
- API client: fetch wrapper with /api base URL, automatic Bearer token injection, 401 auto-logout
- Protected route wrapper: redirects to /login when unauthenticated
- Global CSS: dark theme with CSS variables, component classes, responsive layout

## Not responsible for

- Business logic (all data operations go through the API)
- Page-specific UI (delegated to child nodes)
