# Access Control

## Identity

The entry point for all access control decisions in Payload CMS. Provides two modes: operation-level access checking (`executeAccess`) and full permission introspection (`getAccessResults`).

## Responsibilities

- Execute a single access function and enforce the result (throw Forbidden or return result)
- Provide the default access function (authenticated = allowed)
- Build a complete permissions map across all collections and globals for admin UI
- Determine `canAccessAdmin` based on the admin user collection's access config

## Not Responsible For

- Field-level permission evaluation (delegated to entity-permissions)
- Where query evaluation against the database (delegated to entity-permissions)
- Defining access functions (defined in collection/global config by the developer)
- JWT verification or user authentication (happens before access is checked)
