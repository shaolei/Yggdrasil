<context-package node-path="auth/auth-service" node-name="AuthService" token-count="3165">

<global>
**Project:** Hoppscotch

**Stack:**
- language: TypeScript
- runtime: Node.js
- framework: NestJS

**Standards:**
fp-ts Either/Option for error handling (never throw for business errors).
Prisma ORM for database access. PubSub for real-time event propagation.
Collections form a tree hierarchy (parent-child). OrderIndex is integer-based for sibling ordering.
All mutations that affect sibling order use row locking via lockTeamCollectionByTeamAndParent.


</global>

<hierarchy path="auth">
### responsibility.md
# Auth

Handles authentication for Hoppscotch. Supports magic link (passwordless) sign-in and SSO provider authentication. This module manages the full authentication lifecycle: token generation, verification, refresh, and admin verification.

## In scope

- Magic link sign-in flow (generate token, send email, verify)
- JWT token management (access tokens, refresh tokens)
- Token refresh flow
- SSO provider account verification
- Admin status verification (auto-elevate first user to admin)
- Auth provider listing

## Out of scope

- User account management (delegated to user module)
- Authorization (role checks, guards)
- Team-level access control

</hierarchy>

<own-artifacts>
### node.yaml
name: AuthService
type: service
aspects: []

relations:
  - target: user/user-service
    type: calls
    consumes: [findUserByEmail, findUserById, createUserViaMagicLink, createProviderAccount, updateUserRefreshToken, updateUserLastLoggedOn, makeAdmin, getUsersCount]

mapping:
  paths:
    - packages/hoppscotch-backend/src/auth/auth.service.ts

### constraints.md
# AuthService -- Constraints

## Magic link token expiry

Magic link verification tokens have a configurable validity period (`INFRA.MAGIC_LINK_TOKEN_VALIDITY` in hours). Default is 24 hours if not configured. Expired tokens are rejected with `MAGIC_LINK_EXPIRED`.

## Device identifier as salt

The magic link flow uses a bcrypt-generated salt as the device identifier. The salt complexity is configurable via `INFRA.TOKEN_SALT_COMPLEXITY`.

## Refresh token hashing

Refresh tokens are hashed with argon2 before storage. On refresh, the stored hash is verified against the provided token using `argon2.verify`. Mismatches are rejected with `INVALID_REFRESH_TOKEN`.

## First user auto-admin

When `verifyAdmin` is called and the user is not an admin, but there is only one user in the entire system, that user is automatically elevated to admin. This ensures the first user can access the admin panel without manual intervention.

## Token cleanup after verification

After successfully verifying magic link tokens, the verification token record is deleted from the database. This makes each magic link single-use.

## Origin-based redirect URL

The magic link email contains a redirect URL that varies by origin (APP or ADMIN). Invalid origins default to the base app URL (`VITE_BASE_URL`).

## Email validation

`signInMagicLink` validates the email format before proceeding. Invalid emails are rejected with `INVALID_EMAIL` and HTTP 400.

## RESTError wrapping

Auth errors are wrapped in a RESTError structure with both a message string and an HTTP status code, unlike other services that use plain string errors.


### responsibility.md
# AuthService -- Responsibility

Handles the authentication lifecycle for Hoppscotch. Manages magic link (passwordless) sign-in, JWT token generation and refresh, SSO provider account verification, and admin verification. Acts as the entry point for user authentication, delegating user management to UserService.

## In scope

- Magic link sign-in: validate email, create or find user, generate verification token, send email with magic link
- Magic link verification: validate passwordless tokens, check expiry, generate auth tokens, clean up verification tokens
- JWT token generation: access tokens and refresh tokens with configurable expiry
- Token refresh: verify hashed refresh token, generate new token pair
- SSO provider verification: check if provider account exists for a user
- Admin verification: check if user is admin, auto-elevate first user in the system
- Auth provider listing: delegate to InfraConfigService

## Key operations

- `signInMagicLink(email, origin)` -- creates user if needed, generates magic link tokens, sends email
- `verifyMagicLinkTokens(magicLinkIDTokens)` -- validates tokens, generates auth tokens, cleans up
- `generateAuthTokens(userUid)` -- generates access + refresh token pair
- `refreshAuthTokens(hashedRefreshToken, user)` -- verifies old token, generates new pair
- `checkIfProviderAccountExists(user, SSOUserData)` -- checks for existing provider link
- `verifyAdmin(user)` -- checks admin status, auto-elevates first user

## Out of scope

- User profile management (delegated to UserService)
- Authorization and guards
- SSO provider callback handling (separate strategies)

</own-artifacts>

<materialization-target paths="packages/hoppscotch-backend/src/auth/auth.service.ts" />

<dependency target="user/user-service" type="calls" consumes="findUserByEmail, findUserById, createUserViaMagicLink, createProviderAccount, updateUserRefreshToken, updateUserLastLoggedOn, makeAdmin, getUsersCount">
Consumes: findUserByEmail, findUserById, createUserViaMagicLink, createProviderAccount, updateUserRefreshToken, updateUserLastLoggedOn, makeAdmin, getUsersCount

### responsibility.md
# UserService -- Responsibility

The central service for user account management. Handles user creation (via magic link or SSO), profile updates, session management, admin status, and user deletion with a plugin-style data handler pattern. Other services register as UserDataHandler implementations to participate in user deletion checks and cleanup.

## In scope

- User lookup: find by email (case-insensitive), find by ID, find by multiple IDs
- User creation: via magic link (email only), via SSO (with profile data)
- Provider account management: create provider accounts for SSO linking
- Profile updates: display name, photo URL, last logged on, last active on
- Session management: update and validate REST/GQL sessions (JSON stored in DB)
- Admin management: make admin (single/batch), remove admin (single/batch), fetch admins
- User deletion orchestration: register data handlers, check deletion eligibility, cascade to handlers, delete account, publish event
- Refresh token management: update hashed refresh token
- Workspace queries: fetch user's team workspaces with role counts
- Bulk queries: fetch all users with cursor or offset pagination and search

## Key operations

- `findUserByEmail(email)` -- case-insensitive lookup, returns Option
- `findUserById(userUid)` -- returns Option
- `createUserViaMagicLink(email)` -- creates user with magic provider account
- `createUserSSO(accessToken, refreshToken, profile)` -- creates user from SSO data
- `updateUserSessions(user, session, sessionType)` -- validates JSON, updates, publishes event
- `updateUserDisplayName(userUID, displayName)` -- validates non-empty, publishes event
- `deleteUserByUID(user)` -- checks handlers, cascades deletion, publishes event
- `getUserDeletionErrors(user)` -- aggregates errors from all registered handlers
- `makeAdmin(userUID)` / `removeUserAsAdmin(userUID)` -- toggle isAdmin flag
- `fetchUserWorkspaces(userUid)` -- returns teams with role counts

## Out of scope

- Authentication flow (auth module)
- Team membership CRUD (team module, but registers as UserDataHandler)
- Authorization guards


### interface.md
# UserService -- Interface

## User queries

- `findUserByEmail(email: string): Promise<Option<AuthUser>>` -- case-insensitive email lookup
- `findUserById(userUid: string): Promise<Option<AuthUser>>` -- lookup by UID
- `findUsersByIds(userUIDs: string[]): Promise<AuthUser[]>` -- bulk lookup
- `fetchAllUsers(cursorID: string, take: number): Promise<User[]>` -- cursor-paginated (deprecated)
- `fetchAllUsersV2(searchString: string, pagination: OffsetPaginationArgs): Promise<User[]>` -- offset-paginated with search
- `getUsersCount(): Promise<number>` -- total user count
- `fetchAdminUsers(): Promise<User[]>` -- all admin users
- `fetchUserWorkspaces(userUid: string): Promise<Either<string, GetUserWorkspacesResponse[]>>` -- user's team workspaces with role counts

## User creation

- `createUserViaMagicLink(email: string): Promise<User>` -- creates with magic provider
- `createUserSSO(accessToken: string, refreshToken: string, profile): Promise<User>` -- creates from SSO data
- `createProviderAccount(user: AuthUser, accessToken: string, refreshToken: string, profile): Promise<Account>` -- links SSO provider

## User mutations

- `updateUserRefreshToken(refreshTokenHash: string, userUid: string): Promise<Either<string, User>>` -- update stored refresh token hash
- `updateUserDetails(user: AuthUser, profile): Promise<Either<string, User>>` -- update display name and photo from SSO
- `updateUserSessions(user: AuthUser, currentSession: string, sessionType: string): Promise<Either<string, User>>` -- update REST/GQL session, publishes event
- `updateUserDisplayName(userUID: string, displayName: string): Promise<Either<string, User>>` -- update name, publishes event
- `updateUserLastLoggedOn(userUid: string): Promise<Either<string, boolean>>` -- timestamp update
- `updateUserLastActiveOn(userUid: string): Promise<Either<string, boolean>>` -- timestamp update

## Admin management

- `makeAdmin(userUID: string): Promise<Either<string, User>>` -- set isAdmin=true
- `makeAdmins(userUIDs: string[]): Promise<Either<string, boolean>>` -- batch promote
- `removeUserAsAdmin(userUID: string): Promise<Either<string, User>>` -- set isAdmin=false
- `removeUsersAsAdmin(userUIDs: string[]): Promise<Either<string, boolean>>` -- batch demote

## User deletion

- `deleteUserByUID(user: AuthUser): TaskEither<string, Either<string, boolean>>` -- full deletion cascade with handler checks
- `getUserDeletionErrors(user: AuthUser): TaskOption<string[]>` -- collect errors from all handlers
- `deleteUserAccount(uid: string): Promise<Either<string, boolean>>` -- direct DB delete

## UserDataHandler registration

- `registerUserDataHandler(handler: UserDataHandler): void` -- register a handler for user deletion coordination


### constraints.md
# UserService -- Constraints

## Display name minimum length

Display names must be non-empty (length > 0). Empty or null display names are rejected with `USER_SHORT_DISPLAY_NAME`.

## Session validation

REST and GQL session data must be valid JSON strings. Invalid JSON is rejected during `updateUserSessions`. The session type must be either `REST` or `GQL`; unknown types return `USER_UPDATE_FAILED`.

## User deletion cascade

User deletion follows a multi-step process:
1. Collect errors from all registered UserDataHandler implementations (e.g., TeamService blocks if user is sole owner)
2. If any handler returns an error, deletion is blocked with the collected error messages
3. If all handlers approve, call `onUserDelete` on each handler (cleanup)
4. Delete the user account from the database
5. Publish a `user/{uid}/deleted` event

## Email case-insensitive matching

User lookup by email uses case-insensitive matching (`mode: 'insensitive'`). This prevents duplicate accounts with different email casing.

## UserDataHandler pattern

Services that hold user-dependent data implement the UserDataHandler interface with:
- `canAllowUserDeletion(user)` -- returns TaskOption of error message (Some = blocked, None = allowed)
- `onUserDelete(user)` -- performs cleanup when deletion proceeds

Handlers register themselves via `registerUserDataHandler` during module initialization (`OnModuleInit`).

## Admin flag

The `isAdmin` boolean flag on the user record determines admin status. The service provides toggle operations but does not enforce minimum admin count -- that is handled by AdminService.

## Batch operations

`makeAdmins` and `removeUsersAsAdmin` use `updateMany` for efficient batch updates. `removeUsersAsAdmin` returns error if no matching records are found.


### errors.md
# UserService -- Errors

## USER_NOT_FOUND

Returned when a user cannot be found by UID or email. Applies to findUserById, updateUserRefreshToken, updateUserDetails, updateUserLastLoggedOn, updateUserLastActiveOn, makeAdmin, removeUserAsAdmin, deleteUserAccount, fetchUserWorkspaces.

## USER_SHORT_DISPLAY_NAME

Returned when display name is empty or null during updateUserDisplayName.

## USER_UPDATE_FAILED

Returned when session update fails (invalid session type or DB error) during updateUserSessions. Also returned on batch admin operations if the update fails.

## USERS_NOT_FOUND

Returned by removeUsersAsAdmin when no matching user records are found for the given UIDs (count = 0).

## UserDataHandler blocking errors

deleteUserByUID aggregates error strings from all registered UserDataHandler implementations. If any handler returns a blocking error (e.g., USER_IS_OWNER from TeamService), the deletion is blocked and the collected error messages are returned as a concatenated string.
</dependency>

</context-package>Budget status: ok
