<context-package node-path="admin/admin-service" node-name="AdminService" token-count="11798">

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

<hierarchy path="admin" aspects="pubsub-events">
### responsibility.md
# Admin

Provides administrative operations for managing the Hoppscotch infrastructure. Admin is the orchestration layer that delegates to domain services (user, team, collections, requests, environments, invitations) to perform privileged operations like user management, team management, and platform statistics.

## In scope

- User management (fetch, invite, delete, update display names)
- Admin role management (promote, demote, bulk operations)
- Team management (create, rename, delete, member operations)
- Platform statistics (user count, team count, collection count, request count)
- Shortcode management
- User history management
- Infra-level user invitation workflow

## Out of scope

- Authentication (handled by auth module)
- Direct database operations (delegates to domain services)
- Business logic for domain entities (implemented in respective services)

</hierarchy>

<own-artifacts aspects="pubsub-events,role-based-access">
### node.yaml
name: AdminService
type: service
aspects: [pubsub-events, role-based-access]

relations:
  - target: user/user-service
    type: calls
    consumes: [fetchAllUsers, fetchAllUsersV2, findUserByEmail, findUserById, findUsersByIds, updateUserDisplayName, deleteUserByUID, makeAdmin, makeAdmins, removeUserAsAdmin, removeUsersAsAdmin, getUsersCount, fetchAdminUsers, deleteUserAccount]
  - target: team/team-service
    type: calls
    consumes: [fetchAllTeams, fetchAllTeamsV2, getCountOfMembersInTeam, updateTeamAccessRole, leaveTeam, addMemberToTeamWithEmail, createTeam, renameTeam, deleteTeam, getTeamWithIDTE, getTeamsCount, getTeamMemberTE]
  - target: team-collections/team-collection-service
    type: calls
    consumes: [totalCollectionsInTeam, getTeamCollectionsCount]
  - target: team-request/team-request-service
    type: calls
    consumes: [totalRequestsInATeam, getTeamRequestsCount]
  - target: team-environments/team-environments-service
    type: calls
    consumes: [totalEnvsInTeam]
  - target: team-invitation/team-invitation-service
    type: calls
    consumes: [getTeamInvitations, revokeInvitation, getTeamInviteByEmailAndTeamID]

mapping:
  paths:
    - packages/hoppscotch-backend/src/admin/admin.service.ts

### constraints.md
# AdminService -- Constraints

## Admin cannot be deleted without demotion

When batch-deleting users, admin users are excluded from deletion and marked with `ADMIN_CAN_NOT_BE_DELETED`. They must be demoted from admin status first before they can be deleted.

## Minimum one admin

The `demoteUsersByAdmin` operation checks that at least one admin would remain after the demotion. If all admins would be removed, the operation is rejected with `ONLY_ONE_ADMIN_ACCOUNT`. The same check exists in the single-user `removeUserAsAdmin`.

## Self-invitation prevention

The `inviteUserToSignInViaEmail` method checks that the invitee email is not the same as the admin's email. Same-email invitations are rejected with `DUPLICATE_EMAIL`.

## No duplicate infra invitations

If a user has already been invited (exists in invitedUsers table), a second invitation to the same email is rejected with `USER_ALREADY_INVITED`.

## Invitation cleanup on team addition

When an admin adds a user to a team via `addUserToTeam`, any existing team invitation for that user's email is automatically revoked. This prevents stale invitations from remaining after the user is directly added.

## Already-member guard on team addition

Before adding a user to a team, the service checks if they are already a member. If so, it returns `TEAM_INVITE_ALREADY_MEMBER` instead of creating a duplicate membership.

## User validation before team creation

`createATeam` verifies the user exists before delegating to TeamService.createTeam. Non-existent users are rejected with `USER_NOT_FOUND`.

## Batch deletion result tracking

`removeUserAccounts` returns a detailed result for each user UID: whether deletion succeeded or failed, and the error message if applicable. Admin users are marked as failed without attempting deletion.

## Invitation revocation after deletion

After batch-deleting users, any infra-level invitations sent to the deleted users' emails are automatically revoked.


### responsibility.md
# AdminService -- Responsibility

The orchestration layer for administrative operations across the Hoppscotch platform. Delegates to domain services (UserService, TeamService, TeamCollectionService, TeamRequestService, TeamEnvironmentsService, TeamInvitationService) to perform privileged operations. Handles user management, team management, platform statistics, and infra-level invitation workflows.

## In scope

- User management: list users (paginated with search), invite by email, update display names, delete accounts (single/batch), fetch user info
- Admin role management: promote to admin (single/batch), demote from admin (single/batch), list admins
- Team management: list teams, create, rename, delete, get info
- Team member management: add user to team (with invitation cleanup), remove from team, change role
- Platform statistics: user count, team count, collection count, request count
- Team detail stats: member count, collection count, request count, environment count, pending invitations per team
- Infra-level invitations: invite users to sign in, revoke invitations, list pending invitations
- Shortcode management: list and delete shortcodes
- User history management: delete all user histories

## Key operations

- `fetchUsersV2(searchString, pagination)` -- delegates to UserService
- `inviteUserToSignInViaEmail(adminUID, adminEmail, inviteeEmail)` -- validates, sends email, records invitation, publishes event
- `removeUserAccounts(userUIDs)` -- batch delete with admin protection, revokes invitations
- `makeUsersAdmin(userUIDs)` / `demoteUsersByAdmin(userUIDs)` -- batch admin toggle with minimum-one-admin guard
- `addUserToTeam(teamID, userEmail, role)` -- adds member and cleans up existing invitation
- `createATeam(userUid, name)` / `renameATeam(teamID, newName)` / `deleteATeam(teamID)` -- team lifecycle

## Out of scope

- Authentication (handled by auth module)
- Business logic for individual entities (implemented in respective services)
- Direct database operations (always delegates)

</own-artifacts>

<materialization-target paths="packages/hoppscotch-backend/src/admin/admin.service.ts" />

<aspect name="PubSub Events" id="pubsub-events">
### content.md
# PubSub Events

Every mutation to a team collection publishes a PubSub event so that connected clients (GraphQL subscriptions) receive real-time updates.

## Channel naming convention

- `team_coll/${teamID}/coll_added` — new collection created or imported
- `team_coll/${teamID}/coll_updated` — collection title or data changed
- `team_coll/${teamID}/coll_removed` — collection deleted (payload: collection ID, not full object)
- `team_coll/${teamID}/coll_moved` — collection moved to different parent
- `team_coll/${teamID}/coll_order_updated` — sibling order changed (payload includes moved collection + next collection)

## Timing

Events are published AFTER the database transaction commits successfully. This prevents phantom events where the client sees an update but the transaction rolled back. The exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens after the retry loop succeeds.

## Payload shape

- Added/Updated/Moved: full `TeamCollection` model (cast from DB record)
- Removed: just the collection ID string
- Order updated: `{ collection, nextCollection }` pair

</aspect>

<aspect name="Role-Based Access" id="role-based-access">
### content.md
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

</aspect>

<dependency target="user/user-service" type="calls" consumes="fetchAllUsers, fetchAllUsersV2, findUserByEmail, findUserById, findUsersByIds, updateUserDisplayName, deleteUserByUID, makeAdmin, makeAdmins, removeUserAsAdmin, removeUsersAsAdmin, getUsersCount, fetchAdminUsers, deleteUserAccount">
Consumes: fetchAllUsers, fetchAllUsersV2, findUserByEmail, findUserById, findUsersByIds, updateUserDisplayName, deleteUserByUID, makeAdmin, makeAdmins, removeUserAsAdmin, removeUsersAsAdmin, getUsersCount, fetchAdminUsers, deleteUserAccount

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

<dependency target="team/team-service" type="calls" consumes="fetchAllTeams, fetchAllTeamsV2, getCountOfMembersInTeam, updateTeamAccessRole, leaveTeam, addMemberToTeamWithEmail, createTeam, renameTeam, deleteTeam, getTeamWithIDTE, getTeamsCount, getTeamMemberTE">
Consumes: fetchAllTeams, fetchAllTeamsV2, getCountOfMembersInTeam, updateTeamAccessRole, leaveTeam, addMemberToTeamWithEmail, createTeam, renameTeam, deleteTeam, getTeamWithIDTE, getTeamsCount, getTeamMemberTE

### responsibility.md
# TeamService -- Responsibility

The core service for team and team membership operations. Manages the full lifecycle of teams (create, rename, delete) and team members (add, remove, update roles, query). Implements the UserDataHandler interface to participate in user deletion workflows, preventing deletion of sole team owners and cleaning up memberships when a user is removed. Publishes PubSub events for all membership mutations.

## In scope

- Team CRUD: create (with creator as OWNER), rename (with title validation), delete (cascade members first)
- Team member CRUD: add by UID or email, remove (leave), update access role
- Team member queries: get member, get role, list members (paginated), count members
- Team queries: get by ID, list teams for user (paginated), list all teams (paginated with search)
- User deletion coordination: implements UserDataHandler (canAllowUserDeletion, onUserDelete)
- Sole owner protection: prevent leaving or role demotion when user is the only OWNER
- Mismatched user filtering: detect team members whose user accounts no longer exist
- Real-time events: publish member_added, member_updated, member_removed

## Key operations

- `createTeam(name, creatorUid)` -- creates team with creator as OWNER
- `deleteTeam(teamID)` -- deletes all members then the team
- `renameTeam(teamID, newName)` -- validates name length before updating
- `addMemberToTeam(teamID, uid, role)` -- creates membership, publishes event
- `addMemberToTeamWithEmail(teamID, email, role)` -- resolves user by email, then adds
- `leaveTeam(teamID, userUid)` -- removes membership with sole owner guard
- `updateTeamAccessRole(teamID, userUid, newRole)` -- role change with sole owner guard
- `getTeamMember(teamID, userUid)` -- returns TeamMember or null
- `getTeamMembers(teamID)` -- returns filtered list of all members
- `isUserSoleOwnerInAnyTeam(uid)` -- checks if user is sole OWNER in any team
- `deleteUserFromAllTeams(uid)` -- removes user from every team they belong to

## Out of scope

- Authentication and authorization (handled by guards/resolvers)
- Team collections, requests, environments (separate modules)
- Invitation workflow (separate team-invitation module)


### interface.md
# TeamService -- Interface

## Team queries

- `getTeamWithID(teamID: string): Promise<Team | null>` -- find team by ID, returns null if not found
- `getTeamWithIDTE(teamID: string): TaskEither<'team/invalid_id', Team>` -- fp-ts variant returning Either
- `getTeamsOfUser(uid: string, cursor: string | null): Promise<Team[]>` -- paginated teams for a user (page size 10)
- `fetchAllTeams(cursorID: string, take: number): Promise<Team[]>` -- cursor-based team list (deprecated)
- `fetchAllTeamsV2(searchString: string, pagination: OffsetPaginationArgs): Promise<Team[]>` -- offset-paginated with search
- `getTeamsCount(): Promise<number>` -- total team count

## Team mutations

- `createTeam(name: string, creatorUid: string): Promise<Either<string, Team>>` -- creates team with creator as OWNER
- `renameTeam(teamID: string, newName: string): Promise<Either<string, Team>>` -- renames with title validation
- `deleteTeam(teamID: string): Promise<Either<string, boolean>>` -- deletes team and all memberships

## Team member queries

- `getTeamMember(teamID: string, userUid: string): Promise<TeamMember | null>` -- find specific membership
- `getTeamMemberTE(teamID: string, userUid: string): TaskEither<string, TeamMember>` -- fp-ts variant
- `getRoleOfUserInTeam(teamID: string, userUid: string): Promise<TeamAccessRole | null>` -- get role or null
- `getTeamMembers(teamID: string): Promise<TeamMember[]>` -- all members (filtered for mismatches)
- `getMembersOfTeam(teamID: string, cursor: string | null): Promise<TeamMember[]>` -- paginated members
- `getCountOfMembersInTeam(teamID: string): Promise<number>` -- member count
- `getCountOfUsersWithRoleInTeam(teamID: string, role: TeamAccessRole): Promise<number>` -- count by role

## Team member mutations

- `addMemberToTeam(teamID: string, uid: string, role: TeamAccessRole): Promise<TeamMember>` -- add member, publishes event
- `addMemberToTeamWithEmail(teamID: string, email: string, role: TeamAccessRole): Promise<Either<string, TeamMember>>` -- add by email
- `leaveTeam(teamID: string, userUid: string): Promise<Either<string, boolean>>` -- remove with sole-owner guard
- `updateTeamAccessRole(teamID: string, userUid: string, newRole: TeamAccessRole): Promise<Either<string, TeamMember>>` -- change role with sole-owner guard

## User deletion interface (UserDataHandler)

- `canAllowUserDeletion(user: AuthUser): TaskOption<string>` -- blocks if user is sole owner
- `onUserDelete(user: AuthUser): Task<void>` -- removes user from all teams


### constraints.md
# TeamService -- Constraints

## Sole owner protection

A team must always have at least one OWNER. The service prevents:
- Changing the role of the last OWNER to a non-OWNER role (returns `TEAM_ONLY_ONE_OWNER`)
- The last OWNER leaving the team (returns `TEAM_ONLY_ONE_OWNER`)
This is enforced by counting OWNER members before role changes and leave operations.

## Team name minimum length

Team names must be at least 1 character (`TITLE_LENGTH = 1`). Empty or zero-length names are rejected with `TEAM_NAME_INVALID`.

## Creator becomes OWNER

When a team is created, the creator is automatically added as a member with the OWNER role. There is no team without at least one member.

## User deletion guard

The service implements UserDataHandler. Before a user is deleted, `canAllowUserDeletion` checks if the user is the sole owner of any team. If so, it returns `USER_IS_OWNER` to block the deletion. On actual deletion, `onUserDelete` calls `deleteUserFromAllTeams` which iterates all memberships and leaves each team.

## Mismatched user cleanup

`filterMismatchedUsers` checks each team member against the user service. If a member's user account no longer exists, they are excluded from results. There is a TODO in the code about whether to also delete the orphan membership record.

## Access roles

Three roles exist: OWNER, EDITOR, VIEWER. These are defined in the TeamAccessRole enum. The service does not enforce what each role can do -- that is handled by resolvers and guards. The service only enforces sole-owner invariants.

## Cursor-based pagination

Team and member list queries use cursor-based pagination with a fixed page size of 10. The v2 variant (`fetchAllTeamsV2`) uses offset pagination with search support.


### errors.md
# TeamService -- Errors

## TEAM_NAME_INVALID

Returned when team name fails length validation (must be at least 1 character). Applies to createTeam and renameTeam.

## TEAM_ONLY_ONE_OWNER

Returned when attempting to change the role of the last OWNER or when the last OWNER tries to leave. Applies to updateTeamAccessRole and leaveTeam.

## TEAM_INVALID_ID

Returned when team is not found by ID. Applies to deleteTeam, renameTeam, getTeamWithIDTE.

## TEAM_INVALID_ID_OR_USER

Returned when a team member is not found for the given teamID and userUid combination. Applies to leaveTeam.

## TEAM_MEMBER_NOT_FOUND

Returned when a specific team membership record is not found. Applies to updateTeamAccessRole, getTeamMemberTE.

## USER_NOT_FOUND

Returned when resolving email to user fails during addMemberToTeamWithEmail.

## USER_IS_OWNER

Returned by canAllowUserDeletion when the user is the sole owner of any team, blocking user deletion.
</dependency>

<dependency target="team-collections/team-collection-service" type="calls" consumes="totalCollectionsInTeam, getTeamCollectionsCount">
Consumes: totalCollectionsInTeam, getTeamCollectionsCount

### responsibility.md
# TeamCollectionService — Responsibility

The central service for all team collection operations. Coordinates Prisma database transactions with pessimistic row locking, maintains orderIndex consistency across sibling sets, prevents circular tree structures, and publishes real-time PubSub events after every mutation.

## In scope

- Collection CRUD: create, rename, update (title/data), delete with sibling reindexing
- Tree operations: move collection (to root or into another collection), reorder siblings, sort siblings
- Tree integrity: recursive ancestor check (`isParent`) to prevent circular moves
- Import/export: recursive JSON serialization and deserialization of entire collection subtrees
- Search: raw SQL queries with `ILIKE` + `similarity()` fuzzy matching, plus recursive CTE for parent tree reconstruction
- Duplication: export-then-import with title modification
- CLI support: `getCollectionForCLI` and `getCollectionTreeForCLI` for command-line access

## Out of scope

- Authentication/authorization (handled by resolvers and guards)
- Individual request CRUD within collections
- Team membership management (delegated to TeamService)
- PubSub infrastructure (delegated to PubSubService)


### interface.md
# TeamCollectionService -- Interface

## Collection queries

- `getCollection(collectionID: string): Promise<Either<string, TeamCollection>>` -- get by ID
- `getTeamOfCollection(collectionID: string): Promise<Either<string, Team>>` -- resolve team from collection
- `getChildCollections(collectionID: string): Promise<TeamCollection[]>` -- direct children
- `searchByTitle(searchTerm: string, teamID: string, take: number, type: string): Promise<CollectionSearchNode[]>` -- fuzzy search with breadcrumbs
- `getCollectionForCLI(collectionID: string, userUid: string): Promise<Either<string, TeamCollection>>` -- CLI access with membership check
- `getCollectionTreeForCLI(collectionID: string): Promise<Either<RESTError, CollectionFolder>>` -- full recursive tree for CLI
- `totalCollectionsInTeam(teamID: string): Promise<number>` -- count per team
- `getTeamCollectionsCount(): Promise<number>` -- total count

## Collection mutations

- `createCollection(title: string, teamID: string, parentID?: string, data?: string): Promise<Either<string, TeamCollection>>` -- create with ordering
- `renameCollection(collectionID: string, newTitle: string): Promise<Either<string, TeamCollection>>` -- rename
- `updateCollectionData(collectionID: string, data: string): Promise<Either<string, TeamCollection>>` -- update metadata
- `deleteCollection(collectionID: string): Promise<Either<string, boolean>>` -- delete with sibling reindexing and retry
- `moveCollection(srcCollID: string, destCollID?: string): Promise<Either<string, TeamCollection>>` -- move to root or into another collection
- `updateCollectionOrder(collectionID: string, nextCollectionID?: string): Promise<Either<string, TeamCollection>>` -- reorder siblings
- `sortCollection(teamID: string, collectionID?: string, sortBy: SortOptions): Promise<Either<string, boolean>>` -- sort children

## Import/export

- `importCollectionsFromJSON(jsonString: string, teamID: string, parentCollID?: string): Promise<Either<string, boolean>>` -- import from JSON
- `exportCollectionsToJSON(teamID: string, collectionID?: string): Promise<Either<string, string>>` -- export to JSON
- `duplicateCollection(teamID: string, collectionID: string): Promise<Either<string, boolean>>` -- export + reimport with title change


### constraints.md
# TeamCollectionService — Constraints

## Circular reference prevention

A collection cannot be moved into its own descendant. The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. This prevents infinite loops in the tree structure.

## OrderIndex contiguity

Within a sibling set (same teamID + parentID), orderIndex values must be contiguous starting from 1. Every delete decrements all higher siblings. Every create appends at `lastIndex + 1`. Reorder shifts affected ranges up or down by 1. This invariant ensures no gaps and no duplicates, which is critical for predictable cursor-based pagination and drag-and-drop UI.

## Same-team constraint

A collection can only be moved to a parent that belongs to the same team. Cross-team moves are rejected with `TEAM_COLL_NOT_SAME_TEAM`.

## Self-move prevention

A collection cannot be moved into itself (`TEAM_COLL_DEST_SAME`) or reordered next to itself (`TEAM_COL_SAME_NEXT_COLL`).

## Already-root guard

Moving a root collection to root (parentID null → null) is rejected with `TEAM_COL_ALREADY_ROOT`. This is a no-op prevention, not a business rule.

## Title minimum length

Collection titles must be at least 1 character (`TITLE_LENGTH = 1`). Empty titles are rejected with `TEAM_COLL_SHORT_TITLE`.

## Data field validation

The optional `data` field (collection metadata/headers) must be valid JSON if provided. Empty string is explicitly rejected (not treated as null). Invalid JSON is rejected with `TEAM_COLL_DATA_INVALID`.


### errors.md
# TeamCollectionService -- Errors

## TEAM_COLL_SHORT_TITLE

Collection title must be at least 1 character. Empty titles are rejected.

## TEAM_COLL_DATA_INVALID

The optional data field must be valid JSON. Empty strings are explicitly rejected (not treated as null).

## TEAM_INVALID_COLL_ID

Collection not found by ID.

## TEAM_COLL_NOT_SAME_TEAM

Attempted to move a collection to a parent belonging to a different team. Cross-team moves are forbidden.

## TEAM_COLL_IS_PARENT_COLL

Attempted to move a collection into its own descendant, which would create a circular reference.

## TEAM_COLL_DEST_SAME

Attempted to move a collection into itself.

## TEAM_COL_SAME_NEXT_COLL

Attempted to reorder a collection next to itself (no-op).

## TEAM_COL_ALREADY_ROOT

Attempted to move a root collection to root (parentID null to null).

## TEAM_COLL_CREATION_FAILED

Transaction failure during collection creation or import.

## TEAM_MEMBER_NOT_FOUND

Returned by CLI access methods when the requesting user is not a member of the collection's team.
</dependency>

<dependency target="team-request/team-request-service" type="calls" consumes="totalRequestsInATeam, getTeamRequestsCount">
Consumes: totalRequestsInATeam, getTeamRequestsCount

### responsibility.md
# TeamRequestService -- Responsibility

Manages API request entities within team collections. Handles request CRUD with pessimistic row locking for orderIndex management, cross-collection request moves with multi-collection locking, search, sorting, and real-time event publishing. Requests are ordered within collections using integer-based orderIndex values.

## In scope

- Request CRUD: create (with orderIndex at end), update (title and/or request body), delete (with sibling reindexing)
- Request ordering: moveRequest (same or cross-collection), reorder with direction detection (up/down)
- Request search: search by title within a team
- Request sorting: sort requests within a collection by title (asc/desc) using locked transactions
- Request queries: get by ID, get by collection (paginated), count per team, count total
- Team/collection resolution: resolve team and collection from request context
- Pessimistic locking: lock request rows by collection before any order-modifying operation
- Real-time events: publish req_created, req_updated, req_deleted, req_moved, req_order_updated

## Key operations

- `createTeamRequest(collectionID, teamID, title, request)` -- validate team ownership, lock, assign orderIndex, create
- `updateTeamRequest(requestID, title, request)` -- update title and/or JSON request body
- `deleteTeamRequest(requestID)` -- lock, delete, decrement sibling orderIndexes
- `moveRequest(srcCollID, requestID, destCollID, nextRequestID, callerFunction)` -- validate, find positions, reorder with locking
- `sortTeamRequests(teamID, collectionID, sortBy)` -- lock, fetch sorted, reassign orderIndexes
- `searchRequest(teamID, searchTerm, cursor, take)` -- title contains search
- `getRequestsInCollection(collectionID, cursor, take)` -- paginated, ordered by orderIndex

## Out of scope

- Collection management (delegates to TeamCollectionService)
- Team membership checks (handled by resolvers)
- Request execution


### interface.md
# TeamRequestService -- Interface

## Request queries

- `getRequest(reqID: string): Promise<Option<TeamRequest>>` -- get request by ID
- `getRequestsInCollection(collectionID: string, cursor: string, take?: number): Promise<TeamRequest[]>` -- paginated, ordered by orderIndex
- `searchRequest(teamID: string, searchTerm: string, cursor: string, take?: number): Promise<TeamRequest[]>` -- title search within a team
- `getTeamOfRequest(req: TeamRequest): Promise<Either<string, Team>>` -- resolve team from request
- `getCollectionOfRequest(req: TeamRequest): Promise<Either<string, TeamCollection>>` -- resolve collection from request
- `getTeamOfRequestFromID(reqID: string): Promise<Option<Team>>` -- resolve team by request ID
- `totalRequestsInATeam(teamID: string): Promise<number>` -- count per team
- `getTeamRequestsCount(): Promise<number>` -- total count

## Request mutations

- `createTeamRequest(collectionID: string, teamID: string, title: string, request: string): Promise<Either<string, TeamRequest>>` -- create with team validation, locking, and orderIndex assignment
- `updateTeamRequest(requestID: string, title: string, request: string): Promise<Either<string, TeamRequest>>` -- update title and/or body
- `deleteTeamRequest(requestID: string): Promise<Either<string, boolean>>` -- delete with locking and sibling reindexing
- `moveRequest(srcCollID: string, requestID: string, destCollID: string, nextRequestID: string, callerFunction: string): Promise<Either<string, TeamRequest>>` -- move/reorder with multi-collection locking
- `sortTeamRequests(teamID: string, collectionID: string, sortBy: SortOptions): Promise<Either<string, boolean>>` -- sort with locking and orderIndex reassignment


### constraints.md
# TeamRequestService -- Constraints

## OrderIndex contiguity

Within a collection, request orderIndex values are contiguous starting from 1. Every delete decrements all higher siblings. Every create assigns `lastIndex + 1`. Reorder operations shift affected ranges by +1 or -1. This mirrors the same invariant used in TeamCollectionService.

## Pessimistic row locking

All order-modifying operations (create, delete, move, sort) acquire pessimistic row locks via `lockTeamRequestByCollections` before reading or modifying orderIndex values. This prevents race conditions when multiple users modify the same collection concurrently.

## Multi-collection locking for moves

Cross-collection moves lock both the source and destination collection rows in a single transaction. Within the transaction, the request and next-request records are re-fetched to ensure they have not been deleted or moved by a concurrent operation.

## Team ownership validation on create

When creating a request, the service verifies that the target collection belongs to the specified team by calling `getTeamOfCollection`. Mismatched team IDs are rejected with `TEAM_INVALID_ID`.

## Request body JSON validation

The request body field must be valid JSON if provided. Invalid JSON is rejected via `stringToJson` utility which returns Either.left.

## Move direction detection

Reorder within the same collection detects whether the move is upward or downward by comparing the nextRequest's orderIndex with the request's current orderIndex. This determines whether to increment or decrement the affected range.

## Sort no-op for root

Sorting is skipped (returns success) when collectionID is falsy, which corresponds to root-level requests.

## ConflictException wrapping

Locking errors within transactions are wrapped in NestJS ConflictException, which is caught at the outer level and mapped to the appropriate error code.


### errors.md
# TeamRequestService -- Errors

## TEAM_REQ_NOT_FOUND

Request not found by ID. Applies to updateTeamRequest, deleteTeamRequest, and moveRequest (for both source and next request).

## TEAM_INVALID_ID

Team ID mismatch: the target collection does not belong to the specified team. Applies to createTeamRequest.

## TEAM_INVALID_COLL_ID

Collection not found when resolving a request's collection.

## TEAM_REQ_INVALID_TARGET_COLL_ID

During moveRequest, the next request does not belong to the destination collection, or the source and next request belong to different teams.

## TEAM_REQ_REORDERING_FAILED

Transaction failure during reorder or sort operations. Typically caused by locking conflicts.

## TEAM_COLL_CREATION_FAILED

Transaction failure during request creation (wraps ConflictException from locking).

## JSON parsing errors

Invalid JSON in the request body field is rejected via the stringToJson utility, which returns Either.left with the parse error message.
</dependency>

<dependency target="team-environments/team-environments-service" type="calls" consumes="totalEnvsInTeam">
Consumes: totalEnvsInTeam

### responsibility.md
# TeamEnvironmentsService -- Responsibility

Manages shared environment variable sets for teams. Environments store key-value variable pairs as JSON arrays. The service handles environment CRUD, variable clearing, duplication, and provides CLI-specific access with team membership verification.

## In scope

- Environment CRUD: create (with name validation), update (name + variables), delete
- Variable management: clear all variables from an environment
- Environment duplication: create a copy with " - Duplicate" suffix
- Environment queries: get by ID, list all for a team, count per team
- CLI access: get environment with team membership verification
- Real-time events: publish created, updated, deleted events

## Key operations

- `createTeamEnvironment(name, teamID, variables)` -- validate name length, parse JSON variables, create
- `updateTeamEnvironment(id, name, variables)` -- validate name, update name and variables
- `deleteTeamEnvironment(id)` -- delete and publish event
- `deleteAllVariablesFromTeamEnvironment(id)` -- set variables to empty array
- `createDuplicateEnvironment(id)` -- copy environment with modified name
- `fetchAllTeamEnvironments(teamID)` -- list all environments for a team
- `getTeamEnvironmentForCLI(id, userUid)` -- get with team membership check
- `totalEnvsInTeam(teamID)` -- count environments in a team

## Out of scope

- Team management (delegates to TeamService)
- Variable resolution during request execution
- Personal/user-level environments


### interface.md
# TeamEnvironmentsService -- Interface

## Environment queries

- `getTeamEnvironment(id: string): Promise<Either<string, TeamEnvironment>>` -- get by ID
- `fetchAllTeamEnvironments(teamID: string): Promise<TeamEnvironment[]>` -- list all for a team
- `totalEnvsInTeam(teamID: string): Promise<number>` -- count per team
- `getTeamEnvironmentForCLI(id: string, userUid: string): Promise<Either<string, TeamEnvironment>>` -- get with membership verification

## Environment mutations

- `createTeamEnvironment(name: string, teamID: string, variables: string): Promise<Either<string, TeamEnvironment>>` -- create with name validation
- `updateTeamEnvironment(id: string, name: string, variables: string): Promise<Either<string, TeamEnvironment>>` -- update name and variables
- `deleteTeamEnvironment(id: string): Promise<Either<string, boolean>>` -- delete and publish event
- `deleteAllVariablesFromTeamEnvironment(id: string): Promise<Either<string, TeamEnvironment>>` -- clear variables (keeps environment)
- `createDuplicateEnvironment(id: string): Promise<Either<string, TeamEnvironment>>` -- copy with " - Duplicate" suffix


### constraints.md
# TeamEnvironmentsService -- Constraints

## Environment name minimum length

Environment names must be at least 1 character (`TITLE_LENGTH = 1`). Shorter names are rejected with `TEAM_ENVIRONMENT_SHORT_NAME`.

## Variables stored as JSON array

Environment variables are stored as a Prisma JSON field. The service serializes them via `JSON.stringify` for the API response and deserializes via `JSON.parse` on input. Variables are expected to be an array of key-value objects.

## CLI access requires team membership

The `getTeamEnvironmentForCLI` method verifies that the requesting user is a member of the team that owns the environment. Non-members receive `TEAM_MEMBER_NOT_FOUND`. This is the only method in this service that checks membership -- other methods rely on upstream authorization.

## Duplication naming

Duplicated environments are named `{originalName} - Duplicate`. No uniqueness check is performed on environment names within a team.

## Clear variables vs delete

`deleteAllVariablesFromTeamEnvironment` sets variables to an empty array but does not delete the environment record. This preserves the environment name and team association while removing all variable data. It publishes an "updated" event, not a "deleted" event.


### errors.md
# TeamEnvironmentsService -- Errors

## TEAM_ENVIRONMENT_NOT_FOUND

Environment not found by ID. Applies to getTeamEnvironment, updateTeamEnvironment, deleteTeamEnvironment, deleteAllVariablesFromTeamEnvironment, createDuplicateEnvironment, and getTeamEnvironmentForCLI.

## TEAM_ENVIRONMENT_SHORT_NAME

Environment name fails length validation (must be at least 1 character). Applies to createTeamEnvironment and updateTeamEnvironment.

## TEAM_MEMBER_NOT_FOUND

Requesting user is not a member of the environment's team. Only applies to getTeamEnvironmentForCLI.
</dependency>

<dependency target="team-invitation/team-invitation-service" type="calls" consumes="getTeamInvitations, revokeInvitation, getTeamInviteByEmailAndTeamID">
Consumes: getTeamInvitations, revokeInvitation, getTeamInviteByEmailAndTeamID

### responsibility.md
# TeamInvitationService -- Responsibility

Manages the invitation lifecycle for adding users to teams. Handles creating invitations (with validation), revoking them, accepting them (which adds the user to the team), and querying invitations for a team. Sends invitation emails and publishes PubSub events for real-time updates.

## In scope

- Invitation creation: validate email, verify team exists, check creator is a member, check invitee is not already a member, check no duplicate invite, create record, send email, publish event
- Invitation revocation: check invite exists, delete record, publish event
- Invitation acceptance: verify invite exists, verify accepting user matches invitee email, verify not already a member, add to team, revoke invitation
- Invitation queries: get by ID, get by email+teamID, list all for a team
- Email notifications: send invitation email with join link

## Key operations

- `createInvitation(creator, teamID, inviteeEmail, inviteeRole)` -- full validation chain then create
- `revokeInvitation(inviteID)` -- delete and publish event
- `acceptInvitation(inviteID, acceptedBy)` -- validate, add member, clean up invite
- `getInvitation(inviteID)` -- returns Option
- `getTeamInviteByEmailAndTeamID(email, teamID)` -- lookup for duplicate checking
- `getTeamInvitations(teamID)` -- list all invitations for a team

## Out of scope

- Team membership management (delegates to TeamService.addMemberToTeam)
- User account management (delegates to UserService)
- Mailer infrastructure (delegates to MailerService)


### interface.md
# TeamInvitationService -- Interface

## Invitation queries

- `getInvitation(inviteID: string): Promise<Option<TeamInvitation>>` -- get invitation by ID
- `getTeamInviteByEmailAndTeamID(inviteeEmail: string, teamID: string): Promise<Either<string, TeamInvitation>>` -- lookup by email and team
- `getTeamInvitations(teamID: string): Promise<TeamInvitation[]>` -- all invitations for a team

## Invitation mutations

- `createInvitation(creator: AuthUser, teamID: string, inviteeEmail: string, inviteeRole: TeamAccessRole): Promise<Either<string, TeamInvitation>>` -- create with full validation, email sending, and event publishing
- `revokeInvitation(inviteID: string): Promise<Either<string, boolean>>` -- delete invitation and publish event
- `acceptInvitation(inviteID: string, acceptedBy: AuthUser): Promise<Either<string, TeamMember>>` -- validate, add member, clean up


### constraints.md
# TeamInvitationService -- Constraints

## Email validation

All invitation operations that accept an email validate it first. Invalid emails are rejected with `INVALID_EMAIL`.

## Creator must be a team member

The invitation creator must be a member of the target team. If not, the operation is rejected with `TEAM_MEMBER_NOT_FOUND`. The service does not check the creator's role -- any member can invite.

## No duplicate invitations

If an invitation already exists for the same email and team, creating a new one is rejected with `TEAM_INVITE_MEMBER_HAS_INVITE`.

## Invitee must not already be a member

If the invitee (by email) is already a registered user who is already a member of the team, the invitation is rejected with `TEAM_INVITE_ALREADY_MEMBER`.

## Email matching on acceptance

When accepting an invitation, the accepting user's email must match the invitation's inviteeEmail (case-insensitive comparison). Mismatched emails are rejected with `TEAM_INVITE_EMAIL_DO_NOT_MATCH`.

## Acceptance idempotency guard

Even during acceptance, the service re-checks that the user is not already a team member. This guards against race conditions where the user might have been added between the invitation creation and acceptance.

## Team validity

The target team must exist. Non-existent team IDs are rejected with `TEAM_INVALID_ID`.


### errors.md
# TeamInvitationService -- Errors

## INVALID_EMAIL

Email format validation failed. Applies to createInvitation and getTeamInviteByEmailAndTeamID.

## TEAM_INVALID_ID

Team not found by ID during invitation creation.

## TEAM_MEMBER_NOT_FOUND

Invitation creator is not a member of the target team. Only members can create invitations.

## TEAM_INVITE_ALREADY_MEMBER

The invitee is already a member of the team. Applies to both createInvitation (pre-check) and acceptInvitation (re-check).

## TEAM_INVITE_MEMBER_HAS_INVITE

A pending invitation already exists for this email and team combination.

## TEAM_INVITE_NO_INVITE_FOUND

Invitation not found by ID. Applies to revokeInvitation and acceptInvitation.

## TEAM_INVITE_EMAIL_DO_NOT_MATCH

The accepting user's email does not match the invitation's inviteeEmail (case-insensitive comparison). Prevents a different user from accepting someone else's invitation.
</dependency>

</context-package>Budget status: warning
