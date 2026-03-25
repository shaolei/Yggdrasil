# API

Fastify application serving the REST API for the expense tracker. Configures CORS, registers all route modules, and provides a health endpoint.

## Responsible for

- Application bootstrap: Fastify instance creation, CORS setup, route registration
- Health check endpoint (GET /health)
- Server lifecycle (listen on PORT, default 3000, host 0.0.0.0)

## Not responsible for

- Business logic (delegated to service modules via child nodes)
- Authentication middleware (delegated to api/auth)
- Database setup (delegated to api/db)
