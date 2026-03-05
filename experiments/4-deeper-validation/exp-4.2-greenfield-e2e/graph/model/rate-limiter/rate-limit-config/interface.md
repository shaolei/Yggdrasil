# RateLimitConfig -- Interface

## Types

```typescript
interface EndpointGroupConfig {
  name: string;          // Group identifier: 'auth' | 'api' | 'upload' | 'default'
  limit: number;         // Maximum requests allowed within the window
  windowMs: number;      // Window size in milliseconds
}
```

## Endpoint Group Definitions

| Group     | Limit      | Window   | Matching route prefixes              |
|-----------|------------|----------|--------------------------------------|
| `auth`    | 5 req      | 60,000ms | `/auth/`, `/login`, `/register`      |
| `api`     | 100 req    | 60,000ms | `/api/` (catch-all for API routes)   |
| `upload`  | 10 req     | 60,000ms | `/upload/`, `/import/`               |
| `default` | 60 req     | 60,000ms | Everything not matching above        |

## Methods

### `resolveGroup(path: string): EndpointGroupConfig`

Resolves a route path to its endpoint group configuration. Matching is prefix-based, evaluated in order: `auth` -> `upload` -> `api` -> `default`. The first match wins. If no prefix matches, returns the `default` group.

- **Parameters**: `path` -- the route path from the HTTP request (e.g., `/auth/login`, `/api/users`)
- **Returns**: The `EndpointGroupConfig` for the matched group
- **Never throws**: Always returns a valid config (falls back to `default`)

### `getConfig(group: string): EndpointGroupConfig`

Returns the configuration for a named endpoint group. If the group name is not recognized, returns the `default` group configuration.

- **Parameters**: `group` -- endpoint group name (`'auth'`, `'api'`, `'upload'`, `'default'`)
- **Returns**: The `EndpointGroupConfig` for the specified group
- **Never throws**: Always returns a valid config (falls back to `default`)

### `getAllGroups(): EndpointGroupConfig[]`

Returns all configured endpoint groups. Used for monitoring and admin inspection.

- **Returns**: Array of all `EndpointGroupConfig` objects
