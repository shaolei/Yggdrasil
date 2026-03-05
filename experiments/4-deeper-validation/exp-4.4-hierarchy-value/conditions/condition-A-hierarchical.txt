<context-package node-path="team-collections/team-collection-service" node-name="TeamCollectionService" token-count="6380">

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

<hierarchy path="team-collections" aspects="pessimistic-locking,pubsub-events">
### responsibility.md
# Team Collections

Manages the hierarchical collection tree for teams in Hoppscotch. Collections organize API requests into a tree structure with arbitrary nesting depth, integer-based sibling ordering, and real-time collaboration via PubSub events.

## In scope

- Collection CRUD (create, read, update, delete)
- Tree operations (move between parents, reorder siblings, sort)
- Tree integrity (circular reference prevention, orderIndex consistency)
- Import/export (JSON serialization of entire subtrees)
- Search with parent tree reconstruction (breadcrumb paths)
- Duplication (export + re-import pattern)
- Real-time event publishing for all mutations

## Out of scope

- User authentication and authorization (handled by guards/resolvers)
- Request-level CRUD (separate TeamRequest service)
- Team management (delegated to TeamService)

</hierarchy>

<own-artifacts aspects="pessimistic-locking,pubsub-events,retry-on-deadlock,team-ownership">
### node.yaml
name: TeamCollectionService
type: service
aspects: [pessimistic-locking, pubsub-events, retry-on-deadlock, team-ownership]

relations:
  - target: team/team-service
    type: calls
    consumes: [getTeamMember]

mapping:
  paths:
    - packages/hoppscotch-backend/src/team-collection/team-collection.service.ts

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


### decisions.md
# TeamCollectionService — Decisions

## Why duplication uses export + import

Rather than implementing a separate deep-copy method, duplication exports the collection to JSON, modifies the title (appending " - Duplicate"), then re-imports. This reuses the existing recursive import logic (which handles nested children, requests, locking, and orderIndex assignment) without duplicating it. Trade-off: slightly more overhead (serialization round-trip) but eliminates a separate code path that would need to maintain parity with import logic.

## Why search uses raw SQL instead of Prisma query builder

The search requires PostgreSQL-specific features: `ILIKE` for case-insensitive matching, `similarity()` function for fuzzy ranking, and `escapeSqlLikeString` for safe wildcard injection. Prisma's query builder doesn't expose `similarity()` or custom ordering by a function result. Raw SQL is the only option for this query pattern.

## Why parent tree reconstruction uses recursive CTE

After finding search matches, the UI needs to display breadcrumb paths (e.g., "Team > Parent Collection > Child Collection > Match"). Rather than making N queries to walk up the tree per result, a single `WITH RECURSIVE` CTE efficiently fetches the entire ancestor chain in one query. This is critical for performance when search returns many results.

## Why `isParent` walks up, not down

To check if Collection_A is an ancestor of Collection_D, the code walks UP from D to root (following parentID links), checking if any parent is A. The alternative — walking DOWN from A through all descendants — would require loading the entire subtree. Walking up follows a single chain of parentID pointers, which is O(depth) not O(subtree_size).

## Why orderIndex is integer-based, not fractional

Integer orderIndex with gap-filling (decrement on delete, shift on reorder) requires touching multiple rows on every mutation but guarantees contiguous, predictable indexes. Fractional ordering (assigning values between existing items) avoids touching siblings but eventually requires rebalancing when precision is exhausted. For a real-time collaborative tool where consistency matters more than write throughput, integer ordering is simpler to reason about.

## Why delete has retries but other mutations do not

Delete+reindex can race with other deletes on the same sibling set. Two concurrent deletes each start a transaction, lock, then try to decrement overlapping ranges. The pessimistic lock prevents data corruption but can cause deadlocks when lock acquisition order differs. The retry loop handles these transient deadlocks. Create and move operations are less prone to this because they typically modify non-overlapping index ranges (append at end, or shift in one direction).


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


### logic.md
# TeamCollectionService — Logic

## Reorder algorithm (updateCollectionOrder)

Two cases based on `nextCollectionID`:

### Move to end (nextCollectionID = null)

1. Lock siblings
2. Re-read collection's current orderIndex inside transaction (race condition guard)
3. Decrement all siblings with orderIndex > current (fills the gap)
4. Set collection's orderIndex = total count of siblings (puts it at the end)

### Move to specific position (nextCollectionID != null)

1. Lock siblings
2. Re-read BOTH collection and nextCollection orderIndex inside transaction
3. Determine direction: `isMovingUp = nextCollection.orderIndex < collection.orderIndex`
4. If moving UP: increment all siblings in range `[nextCollection.orderIndex, collection.orderIndex - 1]`
5. If moving DOWN: decrement all siblings in range `[collection.orderIndex + 1, nextCollection.orderIndex - 1]`
6. Set collection's orderIndex to: if moving up → `nextCollection.orderIndex`, if moving down → `nextCollection.orderIndex - 1`

The "next collection" semantics mean: "place me just before this collection."

## isParent (circular reference check)

Recursive walk from destination UP to root:
1. If source === destination → return None (invalid, means self-move)
2. If destination.parentID === source.id → return None (source IS an ancestor)
3. If destination.parentID !== null → recurse with destination = destination.parent
4. If destination.parentID === null → reached root without finding source → return Some(true) (safe to move)

None = invalid (would create cycle), Some(true) = valid.

## Move collection (changeParentAndUpdateOrderIndex)

1. Find last orderIndex under new parent
2. Decrement all siblings after the collection in its ORIGINAL parent (fills the gap left behind)
3. Update collection: set parentID = new parent, orderIndex = last + 1 under new parent

This is a two-parent operation: it modifies sibling indexes in BOTH the source and destination parents within a single transaction.


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

</own-artifacts>

<materialization-target paths="packages/hoppscotch-backend/src/team-collection/team-collection.service.ts" />

<aspect name="Pessimistic Locking" id="pessimistic-locking">
### content.md
# Pessimistic Locking

Every operation that reads and then modifies sibling orderIndex values must acquire a row lock first. Without this, two concurrent reorder/create/delete operations on siblings under the same parent could read stale orderIndex values and produce duplicates or gaps.

## Pattern

1. Open a `prisma.$transaction`
2. Call `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` — this locks all sibling rows under the given parent
3. Read current state (last orderIndex, collection to move, etc.)
4. Perform mutations (create, delete, update orderIndex)
5. Transaction commits, releasing locks

## Why pessimistic, not optimistic

Optimistic locking (version columns + retry on conflict) would require every collection row to carry a version field and every read to include it. Since reorder operations often touch MANY siblings (updateMany with range conditions), optimistic locking would be impractical — a single conflicting row would invalidate the entire batch. Pessimistic locking serializes access to the sibling set, which is the correct granularity.

## Scope

The lock is scoped to `(teamID, parentID)` — it locks siblings, not the entire team's collections. This means operations on different subtrees can proceed in parallel.

</aspect>

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

<aspect name="Retry on Deadlock" id="retry-on-deadlock">
### content.md
# Retry on Deadlock

Delete+reorder operations use a retry loop because concurrent modifications to sibling orderIndexes can cause transient database errors.

## Retry conditions

The retry loop continues ONLY for these specific Prisma error codes:
- `UNIQUE_CONSTRAINT_VIOLATION` — two operations assigned the same orderIndex
- `TRANSACTION_DEADLOCK` — two transactions locked rows in conflicting order
- `TRANSACTION_TIMEOUT` — lock wait exceeded timeout

Any other database error is NOT retried — it indicates a non-transient problem (bad data, missing record, etc.).

## Strategy

- Maximum retries: 5 (`MAX_RETRIES`)
- Delay: linear backoff `retryCount * 100ms` (100ms, 200ms, 300ms, 400ms, 500ms)
- On exhaustion: returns `E.left(TEAM_COL_REORDERING_FAILED)`

## Why linear, not exponential

The lock contention window is short (sibling set under one parent). Linear backoff provides sufficient jitter without the long delays of exponential backoff. The maximum total wait is 1.5 seconds, acceptable for a real-time collaboration tool.

## Where this applies

Currently only `deleteCollectionAndUpdateSiblingsOrderIndex`. Other order mutations (create, move, reorder) do NOT retry — they rely solely on pessimistic locking. The delete operation needs retries because it can race with concurrent deletes on the same sibling set (the lock is per-transaction, and two deletes may each start a transaction before either acquires the lock).

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
