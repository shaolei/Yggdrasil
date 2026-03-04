# Q4: Can a removed team member still see their previously created collections?

## Short answer

**No.** A user who has been removed from a team loses all access to that team's collections immediately, including collections they personally created. There is no per-collection creator tracking or per-collection ACL in the system. Access is purely team-membership-based.

---

## Detailed trace

### 1. What happens when a user is removed from a team (what gets deleted, what persists)

When a member is removed, either via `TeamService.leaveTeam` (self-removal) or `AdminService.removeUserFromTeam` (admin-initiated, which delegates to `TeamService.leaveTeam`):

- **Deleted:** The `TeamMember` record linking the user to the team is deleted from the database. This is the sole artifact of membership.
- **Persisted:** All team resources remain untouched. Collections, requests, and environments belonging to the team are **not** deleted or modified. The team itself continues to exist with its remaining members.
- **Event published:** A `member_removed` PubSub event is published so connected clients update their UI in real-time.

Critically, the sole-owner protection invariant applies: if the departing user is the last OWNER of the team, the removal is rejected with `TEAM_ONLY_ONE_OWNER`. This prevents orphaned teams with no owner.

When the user's entire account is deleted (via `UserService.deleteUserByUID`), the flow is:
1. `TeamService.canAllowUserDeletion` checks if they are a sole owner of any team -- blocks if so.
2. If approved, `TeamService.onUserDelete` calls `deleteUserFromAllTeams`, which iterates every team membership and leaves each one.
3. `member_removed` events are published for each team.
4. The user account is then deleted from the database.

In neither scenario are any collections, requests, or environments deleted. The team's data persists intact.

### 2. How TeamCollectionService verifies access (what checks happen on read operations)

TeamCollectionService has two distinct access patterns:

**Standard (GraphQL resolver) access:**
Most collection query methods -- `getCollection`, `getChildCollections`, `searchByTitle`, `getTeamOfCollection` -- do **not** perform membership checks themselves. The TeamCollectionService responsibility document explicitly states: "Authentication/authorization (handled by resolvers and guards)" is out of scope. The services trust that the caller has already been authorized by NestJS guards and GraphQL resolvers at the resolver/guard layer.

**CLI access (explicit membership check):**
The `getCollectionForCLI(collectionID, userUid)` method performs an inline membership verification:
1. Fetches the collection by ID.
2. Resolves which team owns the collection (via `teamID` foreign key on the collection).
3. Calls `TeamService.getTeamMember(teamID, userUid)` to verify the requesting user is a current member of that team.
4. If `getTeamMember` returns null (no membership record found), the method returns `TEAM_MEMBER_NOT_FOUND`.
5. Only if the membership check passes does it return the collection data.

This is the same pattern used by `TeamEnvironmentsService.getTeamEnvironmentForCLI` -- the team-ownership aspect documents this explicitly.

### 3. Do collections store a creatorID or only a teamID?

Based on the context packages, collections store only a **teamID** foreign key. The team-ownership aspect's data model section enumerates the ownership fields:

- `TeamCollection.teamID` -- collection belongs to team

There is **no mention** of a `creatorID`, `createdBy`, or any per-user ownership field on collections. The data model treats the team as the sole owner of all collections within it. There is no concept of "this user created this collection" at the data layer.

### 4. Is there any per-collection ACL or is it purely team-membership-based?

Access control is **purely team-membership-based**. The evidence:

- The **team-ownership aspect** states: "There is no cross-team sharing. A collection, request, or environment belongs to exactly one team." There is no mention of per-resource ACLs, sharing links, or individual permission grants.
- The **role-based-access aspect** describes three roles (OWNER, EDITOR, VIEWER) that operate at the **team level**, not the collection level. Role enforcement for specific actions (e.g., "only EDITORs and above can modify collections") is handled by resolvers and guards, but the granularity is team-role-based, not collection-based.
- The TeamCollectionService's own artifacts make no reference to any ACL table, permission check, or user-level access control on individual collections.

The access model is: if you are a member of the team, you can see all collections in that team (subject to your role for mutations). If you are not a member, you cannot see any.

### 5. What about CLI access specifically (getCollectionForCLI)?

`getCollectionForCLI(collectionID, userUid)` is the most explicit access-control-aware method in the service. The access path is:

1. Look up the collection by `collectionID`.
2. If not found, return `TEAM_INVALID_COLL_ID`.
3. Determine the collection's `teamID`.
4. Call `TeamService.getTeamMember(teamID, userUid)` -- this queries the `TeamMember` table for a record matching both the team and the user.
5. If no membership record exists (user was removed, or was never a member), return `TEAM_MEMBER_NOT_FOUND`.
6. If membership exists, return the collection.

For a removed user, step 4 will find no `TeamMember` record (it was deleted during removal), and step 5 will reject the request. The fact that the user originally created the collection is irrelevant -- there is no creator field to check, and no fallback access path.

`getCollectionTreeForCLI(collectionID)` is notable in that it does **not** take a `userUid` parameter and therefore does **not** appear to perform a membership check itself. This suggests the caller (resolver/guard) is expected to have already verified authorization before invoking it.

### 6. Team deletion vs. member removal

**Member removal (user leaves or is removed from team):**
- The user's `TeamMember` record is deleted.
- All team collections, requests, and environments persist and remain accessible to the remaining team members.
- The removed user loses all access immediately. No collections are deleted.

**Team deletion (`TeamService.deleteTeam` or `AdminService.deleteATeam`):**
- All `TeamMember` records for the team are deleted first (the service "deletes all members then the team").
- The team record itself is deleted.
- The context packages do not explicitly describe cascade deletion of collections/requests/environments on team deletion, but since these resources carry a `teamID` foreign key, they would either be cascade-deleted by the database (if FK constraints are configured with `ON DELETE CASCADE`) or become orphaned. The graph does not specify which behavior applies at the database constraint level.
- Regardless, no user retains access because: (a) the team no longer exists, (b) no membership records exist, and (c) collection queries that require team membership will fail.

---

## Summary of the access control path (traced end-to-end)

```
User removed from team
  --> TeamMember record deleted from DB
  --> Collections unchanged (no creatorID, only teamID)

Removed user requests collection (e.g., via CLI):
  getCollectionForCLI(collectionID, userUid)
    --> Fetch collection --> found (still exists)
    --> Resolve teamID from collection
    --> TeamService.getTeamMember(teamID, userUid)
      --> Query TeamMember table for (teamID, userUid)
      --> No record found (was deleted on removal)
      --> Returns null
    --> Service returns E.left(TEAM_MEMBER_NOT_FOUND)
    --> ACCESS DENIED

Removed user requests collection (via GraphQL):
  --> NestJS guard / resolver checks team membership
  --> Same TeamService.getTeamMember check
  --> No membership record
  --> Request rejected at guard/resolver layer before reaching service
```

**Conclusion:** The system provides no mechanism for a removed team member to access collections they previously created. Access control is entirely team-membership-based with no per-collection ownership, no creator tracking, and no individual ACLs. Once the membership record is gone, all access is revoked.
