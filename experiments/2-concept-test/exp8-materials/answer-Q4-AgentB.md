# Q4 Answer (Agent B -- TeamCollectionService context only)

## Can a user who was removed from a team still see their previously created collections?

### Short answer

Based on the TeamCollectionService context package alone, the answer is: **No, a removed user cannot access collections through the CLI path** (`getCollectionForCLI`), which performs a team-membership check. However, **the general collection query methods (`getCollection`, `getChildCollections`, `searchByTitle`) do not appear to perform any membership verification at the service level**, meaning access control for those paths is delegated entirely to resolvers and guards -- layers outside this context package's scope.

There is **no evidence of per-collection creator tracking or per-collection ACLs** in this service. Access is team-membership-based, not creator-based.

---

### 1. What happens when a user is removed from a team

The TeamService (consumed dependency) handles team membership lifecycle. From its interface and responsibility documentation:

- `leaveTeam(teamID, userUid)` removes the membership record (with a sole-owner guard).
- `onUserDelete(user)` calls `deleteUserFromAllTeams`, iterating all memberships and leaving each team.
- `addMemberToTeam` / `addMemberToTeamWithEmail` creates memberships.
- Once removed, `getTeamMember(teamID, userUid)` returns `null` for that user.

The key point: removal deletes the **membership record**. There is no "soft delete" or "former member" status mentioned. The user simply no longer appears in the team's member list.

Collections themselves are **not deleted** when a user is removed. The context package makes clear that collections are scoped to teams via `TeamCollection.teamID`, not to individual users. There is no mention of a `creatorID` or `createdBy` field on collections anywhere in the data model, constraints, interface, or logic artifacts.

### 2. How TeamCollectionService verifies access

The service has **two distinct access patterns**:

**Pattern A -- General queries (no membership check at service level):**
- `getCollection(collectionID)` -- retrieves by ID, returns `Either<string, TeamCollection>`. No user parameter. No membership check.
- `getChildCollections(collectionID)` -- returns direct children. No user parameter.
- `searchByTitle(searchTerm, teamID, take, type)` -- searches within a team. No user parameter.
- `getTeamOfCollection(collectionID)` -- resolves team from collection. No user parameter.

These methods delegate access control to the resolver/guard layer, which is explicitly listed as **out of scope** for this service ("Authentication/authorization handled by resolvers and guards").

**Pattern B -- CLI access (membership check at service level):**
- `getCollectionForCLI(collectionID, userUid)` -- takes both a collection ID **and** a user UID. The errors documentation states: `TEAM_MEMBER_NOT_FOUND` is "Returned by CLI access methods when the requesting user is not a member of the collection's team."
- `getCollectionTreeForCLI(collectionID)` -- returns a recursive tree. Notably, this method does **not** take a `userUid` parameter, so it either delegates the membership check to the caller or does not perform one.

The CLI access path likely works as follows (inferred from the dependency relation `calls -> getTeamMember`):
1. Look up the collection by ID to find its `teamID`.
2. Call `TeamService.getTeamMember(teamID, userUid)`.
3. If null (user is not a member), return `E.left(TEAM_MEMBER_NOT_FOUND)`.
4. If found, return the collection.

### 3. Do collections store creatorID or only teamID?

Based on the entire context package, **collections store only `teamID`**. The Team Ownership aspect explicitly enumerates the data model:

> `TeamCollection.teamID` -- collection belongs to team

There is no mention of a `creatorID`, `createdBy`, `ownerUid`, or any per-user ownership field on collections. The `createCollection` interface takes `(title, teamID, parentID?, data?)` -- no creator UID parameter. This strongly indicates that **the system does not track who created a collection**. Collections belong to teams, not to individuals.

This means there is no mechanism by which the system could say "this user created this collection, so they retain access even after leaving the team."

### 4. Per-collection ACL vs team-membership-based access

**There are no per-collection ACLs.** The access model is entirely team-membership-based:

- The Team Ownership aspect states: "There is no cross-team sharing. A collection, request, or environment belongs to exactly one team."
- The TeamService defines three roles: `OWNER`, `EDITOR`, `VIEWER` (from the TeamAccessRole enum). However, "the service does not enforce what each role can do -- that is handled by resolvers and guards."
- Collections have a single `teamID` foreign key. There is no join table for per-collection permissions, no ACL field, and no invitation or sharing mechanism at the collection level.

The access control model is therefore: **if you are a member of the team, you can access the team's collections (subject to your role as enforced by resolvers/guards). If you are not a member, you cannot.**

### 5. CLI access (`getCollectionForCLI`)

`getCollectionForCLI(collectionID: string, userUid: string)` is the **only query method in TeamCollectionService that accepts a user identifier**. It is specifically designed for CLI contexts where there is no resolver/guard layer to perform authorization.

The method:
- Takes both the collection ID and the requesting user's UID.
- Checks team membership (via the dependency on `TeamService.getTeamMember`).
- Returns `TEAM_MEMBER_NOT_FOUND` if the user is not a member of the collection's team.
- Returns the `TeamCollection` if the user is a valid team member.

For a removed user, this method would:
1. Look up the collection, find its `teamID`.
2. Call `getTeamMember(teamID, userUid)` -- which returns `null` because the membership was deleted.
3. Return `E.left(TEAM_MEMBER_NOT_FOUND)`.

**Result: Access denied.** The removed user cannot retrieve the collection through the CLI path, regardless of whether they originally created it.

`getCollectionTreeForCLI(collectionID)` does **not** take a `userUid`, so either the caller is expected to perform the membership check first (e.g., by calling `getCollectionForCLI` as a gate), or this method operates without user-level authorization. This is ambiguous from the available context.

---

## Summary

| Question | Answer |
|---|---|
| Can a removed user see old collections? | **No** (via CLI). **Unknown/depends on resolver layer** (via GraphQL). |
| Does the service check membership? | Only in CLI methods (`getCollectionForCLI`). General queries delegate to guards. |
| Is there a creatorID on collections? | **No.** Only `teamID`. |
| Per-collection ACLs? | **None.** Team-membership-based access only. |
| CLI path for removed user? | Returns `TEAM_MEMBER_NOT_FOUND`. Access denied. |

## Information gaps (not answerable from this context package alone)

- How resolvers/guards enforce access for the GraphQL query path (non-CLI).
- Whether `getCollectionTreeForCLI` has an implicit authorization mechanism not visible in this context.
- Whether there is any audit trail or "created by" metadata stored at the database level but not surfaced in the service layer.
- What specific permissions OWNER vs EDITOR vs VIEWER have regarding collection read/write operations (enforced in the resolver/guard layer).
