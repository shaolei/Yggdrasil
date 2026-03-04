<context-package node-path="team-environments/team-environments-service" node-name="TeamEnvironmentsService" token-count="4021">

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

<hierarchy path="team-environments" aspects="pubsub-events">
### responsibility.md
# Team Environments

Manages shared environment variable sets for teams. Environments hold key-value variable pairs that team members use in API requests. This module handles environment CRUD, variable management, and duplication.

## In scope

- Environment CRUD (create, update, delete)
- Variable management (update variables, clear all variables)
- Environment duplication
- Environment listing per team
- CLI-specific access with team membership verification
- Real-time event publishing for environment changes

## Out of scope

- Team management (delegated to team module)
- Personal/user-level environments
- Variable resolution during request execution

</hierarchy>

<own-artifacts aspects="pubsub-events,team-ownership">
### node.yaml
name: TeamEnvironmentsService
type: service
aspects: [pubsub-events, team-ownership]

relations:
  - target: team/team-service
    type: calls
    consumes: [getTeamMember]

mapping:
  paths:
    - packages/hoppscotch-backend/src/team-environments/team-environments.service.ts

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

</own-artifacts>

<materialization-target paths="packages/hoppscotch-backend/src/team-environments/team-environments.service.ts" />

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

<dependency target="team/team-service" type="calls" consumes="getTeamMember">
Consumes: getTeamMember

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

</context-package>Budget status: ok
