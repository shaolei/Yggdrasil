# Q4: Can a Removed Team Member Still See Their Previously Created Collections?

**Short answer: No.** Once a user is removed from a team, they lose all access to every collection in that team -- including collections they personally created. There is no per-collection ACL, no creator-based access fallback, and no ownership attribution on collections at the data model level.

---

## 1. What Happens When a User Is Removed from a Team

There are two code paths for removing a user from a team:

### Path A: `TeamService.leaveTeam(teamID, userUid)` (self-removal or admin-initiated)

Located in `/workspaces/hoppscotch/packages/hoppscotch-backend/src/team/team.service.ts`, lines 204-240:

1. Counts the number of OWNERs in the team.
2. Looks up the `TeamMember` record for `(teamID, userUid)`.
3. If the user is the sole OWNER, returns `TEAM_ONLY_ONE_OWNER` error (prevents orphan teams).
4. Otherwise, **deletes the `TeamMember` row** from the database:
   ```typescript
   await this.prisma.teamMember.delete({
     where: {
       teamID_userUid: { userUid, teamID },
     },
   });
   ```
5. Publishes a `team/${teamID}/member_removed` PubSub event with the user's UID.
6. **No other side effects.** Collections, requests, environments -- nothing else is touched.

### Path B: `AdminService.removeUserFromTeam(userUid, teamID)`

Located in `/workspaces/hoppscotch/packages/hoppscotch-backend/src/admin/admin.service.ts`, lines 331-336. This simply delegates to `teamService.leaveTeam()` -- identical behavior.

### Path C: Full user deletion (`UserService.deleteUserByUID`)

When a user account is deleted entirely, `TeamService.onUserDelete()` calls `deleteUserFromAllTeams(uid)`, which iterates every `TeamMember` record for that user and calls `leaveTeam()` for each. Again, **no collection cleanup occurs** -- only the membership rows are deleted.

**Key observation:** Removal only deletes the `TeamMember` join-table row. Collections remain untouched and continue to belong to the team.

---

## 2. How Collection Access Is Verified

Every collection operation goes through one of two NestJS guards that enforce team membership at request time:

### Guard 1: `GqlTeamMemberGuard` (team-scoped operations)

Located at `/workspaces/hoppscotch/packages/hoppscotch-backend/src/team/guards/gql-team-member.guard.ts`:

Used for operations that receive a `teamID` argument (e.g., listing root collections, creating collections, importing, searching, exporting). The guard:

1. Extracts `teamID` from GraphQL args.
2. Calls `teamService.getTeamMember(teamID, user.uid)`.
3. If no `TeamMember` record exists, **throws `TEAM_MEMBER_NOT_FOUND`** -- access denied.
4. If found, checks `requireRoles.includes(member.role)` (OWNER, EDITOR, or VIEWER depending on the operation).

### Guard 2: `GqlCollectionTeamMemberGuard` (collection-scoped operations)

Located at `/workspaces/hoppscotch/packages/hoppscotch-backend/src/team-collection/guards/gql-collection-team-member.guard.ts`:

Used for operations that receive a `collectionID` argument (e.g., rename, delete, move, update, reorder). The guard:

1. Extracts `collectionID` from GraphQL args.
2. Looks up the collection to find its `teamID`: `teamCollectionService.getCollection(collectionID)`.
3. Calls `teamService.getTeamMember(collection.right.teamID, user.uid)`.
4. If no `TeamMember` record exists, **throws `TEAM_REQ_NOT_MEMBER`** -- access denied.
5. If found, checks role against `requireRoles`.

### Guard 3: `RESTTeamMemberGuard` (REST API operations)

Located at `/workspaces/hoppscotch/packages/hoppscotch-backend/src/team/guards/rest-team-member.guard.ts`:

Used for the REST collection controller (e.g., search endpoint). Same logic as `GqlTeamMemberGuard` but extracts `teamID` from HTTP route params and throws HTTP errors instead of GraphQL errors.

### The critical chain:

```
User Request
  -> JwtAuthGuard (authenticates user)
  -> GqlTeamMemberGuard OR GqlCollectionTeamMemberGuard
       -> teamService.getTeamMember(teamID, user.uid)
            -> prisma.teamMember.findUnique({ where: { teamID_userUid: { teamID, userUid } } })
            -> Returns null if membership row was deleted
       -> null? => THROW "team/member_not_found" or "team_req/not_member"
  -> Resolver method (only reached if guard passes)
```

Since `leaveTeam()` deletes the `TeamMember` row, `getTeamMember()` will return `null` for any removed user, and **every guard will reject the request**.

---

## 3. Whether Collections Store creatorID or Only teamID

The Prisma schema for `TeamCollection` (in `/workspaces/hoppscotch/packages/hoppscotch-backend/prisma/schema.prisma`, lines 42-57):

```prisma
model TeamCollection {
  id         String           @id @default(cuid())
  parentID   String?
  teamID     String
  title      String
  orderIndex Int
  createdOn  DateTime         @default(now()) @db.Timestamptz(3)
  updatedOn  DateTime         @updatedAt @db.Timestamptz(3)
  data       Json?
  parent     TeamCollection?  @relation(...)
  children   TeamCollection[] @relation(...)
  team       Team             @relation(...)
  requests   TeamRequest[]

  @@unique([teamID, parentID, orderIndex])
}
```

**There is no `creatorUid`, `createdBy`, or `userUid` field.** Collections are attributed solely to a **team** (`teamID`), not to any individual user. The `createCollection` method in `TeamCollectionService` (lines 452-517) creates collections with `teamID` only -- it does not receive or store a user identifier.

This means:
- It is impossible to query "collections created by user X."
- There is no data-level basis for granting creator-specific access.
- The `TeamCollection` is a pure team-owned resource.

---

## 4. Per-Collection ACL vs. Team-Membership-Based Access

**Hoppscotch uses exclusively team-membership-based access.** There is no per-collection ACL of any kind.

### Evidence:

1. **No ACL table or field:** The schema has no `TeamCollectionPermission`, no `TeamCollectionAccess`, and no per-collection user mappings.

2. **No creator tracking:** As shown above, collections do not record who created them.

3. **Uniform guard enforcement:** Every collection resolver method applies either `GqlTeamMemberGuard` or `GqlCollectionTeamMemberGuard`. Both check only `TeamMember` existence and role. The role is team-wide (OWNER, EDITOR, VIEWER), not collection-specific.

4. **Role granularity is team-wide:** The `requiresTeamRole` decorator sets allowed roles per operation type (e.g., VIEWER can read, EDITOR can create/modify, OWNER can manage). These roles are on the `TeamMember` join table, scoped to the team, not to any collection.

5. **The `isOwnerCheck` in `TeamCollectionService` (line 429)** is misleadingly named -- it checks whether a **collection** belongs to a **team** (not whether a user owns a collection):
   ```typescript
   private async isOwnerCheck(collectionID: string, teamID: string) {
     await this.prisma.teamCollection.findFirstOrThrow({
       where: { id: collectionID, teamID },
     });
   }
   ```

### Access model summary:

| Access question | Determined by |
|---|---|
| Can user see team's collections? | `TeamMember` row exists with VIEWER/EDITOR/OWNER role |
| Can user create/edit collections? | `TeamMember` row exists with EDITOR/OWNER role |
| Can user delete collections? | `TeamMember` row exists with OWNER role |
| Can user see their own collections after removal? | **No** -- `TeamMember` row is deleted, all guards reject |

---

## 5. CLI / API Access Paths

Based on the source code, there are three access paths to team collections, and **all three enforce team membership**:

### GraphQL API (primary path)

The `TeamCollectionResolver` applies guards on every mutation and query:
- Team-scoped queries (root collections, search, import/export): `@UseGuards(GqlAuthGuard, GqlTeamMemberGuard)`
- Collection-scoped mutations (rename, delete, move, update, reorder): `@UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)`

### REST API

The `TeamCollectionController` uses `@UseGuards(JwtAuthGuard, RESTTeamMemberGuard)` for its search endpoint.

### Admin API

Admin operations bypass team membership guards but are protected by `GqlAdminGuard` (requires `isAdmin: true` on the user). The `AdminService` can access team data, collections counts, and manage teams without being a team member -- but this path requires administrator privileges.

### No unguarded service-level access

The `TeamCollectionService` itself has no access control -- it trusts its callers. But it is never exposed directly to users. All user-facing endpoints are protected by guards. There is no backdoor endpoint that could be used by a removed member.

---

## Summary: The Complete Trace

```
1. Admin calls removeUserFromTeam(userUid, teamID)
   -> AdminService.removeUserFromTeam()
   -> TeamService.leaveTeam(teamID, userUid)
   -> DELETE FROM TeamMember WHERE teamID=X AND userUid=Y
   -> Publish "member_removed" event
   -> Collections remain in database, unchanged

2. Removed user tries to access team collections
   -> GraphQL: rootCollectionsOfTeam(teamID)
   -> GqlAuthGuard: passes (user is authenticated)
   -> GqlTeamMemberGuard: teamService.getTeamMember(teamID, user.uid)
   -> SELECT FROM TeamMember WHERE teamID=X AND userUid=Y
   -> Returns NULL (row was deleted in step 1)
   -> Guard throws TEAM_MEMBER_NOT_FOUND
   -> Request rejected -- user sees nothing

3. The collections the user created still exist
   -> They are owned by the team (teamID), not the user
   -> Other team members can still access them
   -> The removed user has zero visibility or access
```

**Conclusion:** Hoppscotch implements a clean team-membership-based access model with no per-collection permissions. Removing a user from a team is an immediate, complete revocation of access to all team resources, including collections the user created. The collections themselves persist and remain available to remaining team members.
