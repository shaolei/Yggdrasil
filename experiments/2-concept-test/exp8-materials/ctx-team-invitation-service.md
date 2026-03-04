<context-package node-path="team-invitation/team-invitation-service" node-name="TeamInvitationService" token-count="6429">

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

<hierarchy path="team-invitation" aspects="pubsub-events">
### responsibility.md
# Team Invitation

Manages the invitation workflow for adding users to teams. Team members can invite others by email, and invitees accept or the invitation is revoked. This module is the entry point for team membership expansion outside of direct admin actions.

## In scope

- Invitation CRUD (create, revoke, fetch by team)
- Invitation acceptance (validate invitee, add to team, clean up invitation)
- Email sending for invitations
- Duplicate and already-member guard checks
- Real-time event publishing for invitation changes

## Out of scope

- Team membership management itself (delegated to team module)
- User lookup beyond email validation (delegated to user module)
- Admin-level team member additions (handled by admin module)

</hierarchy>

<own-artifacts aspects="pubsub-events,role-based-access,team-ownership">
### node.yaml
name: TeamInvitationService
type: service
aspects: [pubsub-events, role-based-access, team-ownership]

relations:
  - target: team/team-service
    type: calls
    consumes: [getTeamWithID, getTeamMember, addMemberToTeam]
  - target: user/user-service
    type: calls
    consumes: [findUserByEmail]

mapping:
  paths:
    - packages/hoppscotch-backend/src/team-invitation/team-invitation.service.ts

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

</own-artifacts>

<materialization-target paths="packages/hoppscotch-backend/src/team-invitation/team-invitation.service.ts" />

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

<aspect name="Team Ownership" id="team-ownership">
### content.md
# Team Ownership

All collaborative resources in Hoppscotch are scoped to a team. Before creating or accessing a resource, the service verifies that it belongs to the expected team.

## Enforcement patterns

- **TeamRequestService**: When creating a request, verifies that the target collection belongs to the specified team via `getTeamOfCollection`. Cross-team request creation is rejected with `TEAM_INVALID_ID`.
- **TeamEnvironmentsService**: The `getTeamEnvironmentForCLI` method verifies the requesting user is a member of the environment's team before returning data. Non-members receive `TEAM_MEMBER_NOT_FOUND`.
- **TeamInvitationService**: Verifies the target team exists before creating an invitation. Verifies the invitation creator is a member of the target team. The invitation itself records the teamID.
- **TeamCollectionService**: Collections store a teamID. Move operations verify source and destination belong to the same team (`TEAM_COLL_NOT_SAME_TEAM`).

## Data model

Resources carry a `teamID` foreign key that establishes ownership:
- `TeamCollection.teamID` -- collection belongs to team
- `TeamRequest.teamID` -- request belongs to team (plus `collectionID`)
- `TeamEnvironment.teamID` -- environment belongs to team
- `TeamInvitation.teamID` -- invitation is for a specific team

## Cross-team isolation

There is no cross-team sharing. A collection, request, or environment belongs to exactly one team. Moving resources between teams is not supported.

</aspect>

<dependency target="team/team-service" type="calls" consumes="getTeamWithID, getTeamMember, addMemberToTeam">
Consumes: getTeamWithID, getTeamMember, addMemberToTeam

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

<dependency target="user/user-service" type="calls" consumes="findUserByEmail">
Consumes: findUserByEmail

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
