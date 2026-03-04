# Aspect: role-based-access
# Role-Based Access

Team membership uses three roles: OWNER, EDITOR, and VIEWER (defined in the TeamAccessRole enum). Some service-level operations enforce role-based invariants directly, while others delegate role enforcement to resolvers and guards.

## Service-level role enforcement

- **TeamService**: Enforces the sole-OWNER invariant. Before allowing a role change or a member to leave, it checks whether the member is the last OWNER. This is the only role check performed at the service level for team operations.
- **AdminService**: Checks the `isAdmin` flag before allowing admin operations. Admin users cannot be deleted without first removing their admin status. At least one admin must always remain.
- **TeamInvitationService**: Verifies that the invitation creator is a team member (any role). Does not check specific role levels for invitation creation.

## Resolver/guard-level role enforcement

Most role-based access control (e.g., only OWNERs can delete a team, only EDITORs and above can modify collections) is implemented in GraphQL resolvers and NestJS guards, not in the services themselves. The services trust that the caller has already been authorized.

## Admin status

Admin status (`isAdmin` boolean on User) is separate from team roles. An admin can perform cross-team operations regardless of team membership. The first user in the system is auto-elevated to admin.

