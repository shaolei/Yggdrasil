# Experiment 4.1: Flow-Driven Reasoning — Results

## Experiment Setup

**Repo:** Hoppscotch (`/workspaces/hoppscotch/`)
**Flows tested:** Collection Management, Team Member Lifecycle
**Services examined:** TeamCollectionService, TeamService, TeamInvitationService, UserService, AdminService

### Condition Definitions

- **Condition A (Full graph with flows):** Context packages for all 5 participating nodes + both flow description files (collection-management/description.md, team-member-lifecycle/description.md)
- **Condition B (Graph without flows):** Context packages only (node artifacts, aspects, relations, constraints, errors, interface, responsibility) — no flow descriptions
- **Condition C (Raw source code):** The 5 .service.ts source files only, plus Prisma schema for cascade rules

---

## Ground Truth

### Q1: What happens to child collections and requests when a parent collection is deleted?

**Ground truth:** When `deleteCollection(collectionID)` is called, it calls `deleteCollectionAndUpdateSiblingsOrderIndex`, which executes `tx.teamCollection.delete({ where: { id: collection.id } })` within a transaction. The Prisma schema defines `onDelete: Cascade` on both the parent-child relation (`TeamCollection.parent`) and the collection-request relation (`TeamRequest.collection`). Therefore, deleting a parent collection **cascades to all child collections and their requests at the database level** — Prisma/PostgreSQL handles this automatically. The service code does NOT explicitly delete children or requests; it relies entirely on the database cascade. After deletion, sibling orderIndex values are decremented for all siblings with higher orderIndex (fills the gap). The delete uses a retry loop (up to 5 retries with linear backoff) for deadlock handling. A `coll_removed` PubSub event is published for the deleted collection only (not for cascaded children/requests).

### Q2: How does the system prevent circular references when moving a collection?

**Ground truth:** The `moveCollection` method calls `isParent(collection, destCollection, tx)` which performs a recursive walk UP the tree from the destination collection to the root. At each step: (1) if source === destination, return None (invalid, self-move), (2) if destination.parentID === source.id, return None (source IS an ancestor of destination — would create cycle), (3) if destination.parentID is not null, recurse with the parent, (4) if destination.parentID is null (reached root without finding source), return Some(true) (safe). If `isParent` returns `O.none`, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. This is O(depth) not O(subtree_size). The check runs inside the same transaction that performs the move, using the `tx` client.

### Q3: What concurrency mechanism ensures orderIndex consistency when two users reorder simultaneously?

**Ground truth:** The system uses **pessimistic row locking** via `prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`. This is called at the start of every transaction that modifies orderIndex values. The lock scope is `(teamID, parentID)` — it locks the sibling set, not the entire team. All orderIndex mutations (create, delete, move, reorder, import, sort) acquire this lock before reading or modifying orderIndex. Additionally, the delete operation (`deleteCollectionAndUpdateSiblingsOrderIndex`) has a retry loop for transient deadlocks: up to 5 retries with linear backoff (retryCount * 100ms), retrying only on `UNIQUE_CONSTRAINT_VIOLATION`, `TRANSACTION_DEADLOCK`, or `TRANSACTION_TIMEOUT` Prisma error codes. Other mutations do NOT retry — they rely solely on the pessimistic lock.

### Q4: How does collection duplication reuse the import mechanism, and what events are published?

**Ground truth:** `duplicateTeamCollection(collectionID)` works in two steps: (1) calls `exportCollectionToJSONObject(teamID, collectionID)` to recursively export the entire subtree (collections + requests) to a JSON object, (2) modifies the title to append " - Duplicate", then calls `importCollectionsFromJSON(JSON.stringify([...]), teamID, parentID)` to re-import under the same parent. The import method handles locking, orderIndex assignment, and nested creation in a single transaction. Events published: `coll_added` is published for each top-level collection created during import (the `teamCollections.forEach` loop after the transaction). Only top-level collections get individual events, not deeply nested children.

### Q5: What happens to sibling orderIndex values when a collection is moved out of a parent?

**Ground truth:** In `changeParentAndUpdateOrderIndex(tx, collection, newParentID)`: (1) find the last orderIndex under the new parent, (2) decrement orderIndex of all siblings in the ORIGINAL parent that have orderIndex > collection's current orderIndex (fills the gap left behind), (3) update the collection's parentID to the new parent and set its orderIndex to lastOrderIndex + 1 (or 1 if first child). This is a two-parent operation within a single transaction. The source parent's sibling set has its gap filled; the destination parent's sibling set gets a new entry at the end.

### Q6: What prevents deleting a user who is the sole owner of a team?

**Ground truth:** The protection is implemented through the UserDataHandler pattern. `TeamService` implements `UserDataHandler` and registers itself via `registerUserDataHandler` during `onModuleInit`. When `UserService.deleteUserByUID(user)` is called, it first calls `getUserDeletionErrors(user)` which iterates all registered handlers and calls `canAllowUserDeletion(user)` on each. `TeamService.canAllowUserDeletion` calls `isUserSoleOwnerInAnyTeam(uid)`, which queries all teams where the user has OWNER role, then for each team counts the total number of OWNERs. If any team has only 1 OWNER (the user being deleted), it returns `TO.some(USER_IS_OWNER)`, which blocks the deletion. The errors are aggregated by `taskEitherValidateArraySeq` and returned as a collected error. Additionally, `AdminService.removeUserAccount` separately checks `user.value.isAdmin` and returns `USER_IS_ADMIN` if the user is an admin (must be demoted first).

### Q7: When an admin directly adds a user who already has a pending invitation, what happens to the invitation?

**Ground truth:** In `AdminService.addUserToTeam(teamID, userEmail, role)`: After successfully adding the member (via `TeamService.addMemberToTeamWithEmail`), the service checks for an existing invitation with `teamInvitationService.getTeamInviteByEmailAndTeamID(userEmail, teamID)`. If an invitation exists (E.isRight), it calls `teamInvitationService.revokeInvitation(userInvitation.right.id)` which deletes the invitation record and publishes an `invite_removed` event. The invitation is automatically cleaned up — it does not remain as a stale record.

### Q8: How many PubSub events are published when accepting an invitation?

**Ground truth:** When `TeamInvitationService.acceptInvitation(inviteID, acceptedBy)` succeeds, the following events are published: (1) `team/${teamID}/member_added` — published by `TeamService.addMemberToTeam` when the membership is created, (2) `team/${teamID}/invite_removed` — published by `TeamInvitationService.revokeInvitation` when the invitation is deleted after acceptance. Total: **2 PubSub events**. Note: `revokeInvitation` also verifies the invitation exists (via `getInvitation`) before deleting. There is no explicit `invite_accepted` event.

### Q9: What is the full chain of checks when a user account is deleted (across all participants)?

**Ground truth:** The full chain:
1. **AdminService.removeUserAccount(userUid):** Finds user by ID. If user is admin (`isAdmin === true`), returns `USER_IS_ADMIN` — must be demoted first. Otherwise proceeds.
2. **UserService.deleteUserByUID(user):** Calls `getUserDeletionErrors(user)` which iterates ALL registered `UserDataHandler` implementations.
3. **TeamService.canAllowUserDeletion(user):** Checks `isUserSoleOwnerInAnyTeam(uid)`. For each team where user is OWNER, counts OWNERs. If any team has exactly 1 OWNER (the user), returns `USER_IS_OWNER` to block.
4. If all handlers approve (no blocking errors), `onUserDelete` is called on each handler.
5. **TeamService.onUserDelete(user):** Calls `deleteUserFromAllTeams(uid)` which finds all team memberships and calls `leaveTeam` for each. Each `leaveTeam` checks sole-owner invariant again (but at this point it passed the pre-check), deletes the membership, and publishes `member_removed`.
6. **UserService:** Deletes the user account from the database (`deleteUserAccount`).
7. **UserService:** Publishes `user/{uid}/deleted` event.

For batch deletion (`removeUserAccounts`): additionally, admin users are skipped (marked `ADMIN_CAN_NOT_BE_DELETED`), and after deletion, infra-level invitations sent to deleted users' emails are revoked.

### Q10: Can an admin remove the last owner of a team? What protection exists?

**Ground truth:** `AdminService.removeUserFromTeam(userUid, teamID)` delegates directly to `TeamService.leaveTeam(teamID, userUid)`. In `leaveTeam`: it counts OWNERs in the team, gets the member record, and if `ownerCount === 1` AND `member.role === TeamAccessRole.OWNER`, returns `E.left(TEAM_ONLY_ONE_OWNER)`. So **no, an admin cannot remove the last owner** — the same sole-owner protection that applies to regular members applies to admin-initiated removals. The admin service does not bypass this check; it directly delegates to TeamService which enforces the invariant.

---

## Condition A Answers (Full graph with flows)

**Available information:** All 5 context packages + Collection Management flow description + Team Member Lifecycle flow description.

### A1: What happens to child collections and requests when a parent collection is deleted?

From the flow description (Collection Management, Delete collection path): "Delete the collection (Prisma cascades to children and requests)" and "Decrement orderIndex of all siblings with higher orderIndex (fills the gap)." The flow invariants state: "Delete cascades to all children and requests (Prisma relation cascade)." The context package's constraints confirm orderIndex contiguity and the retry mechanism. The decisions document explains why delete has retries (concurrent deletes on same sibling set can deadlock).

**Answer:** When a parent collection is deleted, Prisma cascades the deletion to all child collections and their requests at the database level. The service does not explicitly delete children — the database handles it via cascade relations. After deletion, all sibling orderIndex values higher than the deleted collection's are decremented by 1 to maintain contiguity. The delete operation uses a retry loop (up to 5 retries with linear backoff) to handle transient deadlocks. A `coll_removed` PubSub event is published for the deleted collection.

### A2: How does the system prevent circular references when moving a collection?

From the flow description (Move collection path): "Recursive `isParent` check: walk up from destination to root, ensuring source is not an ancestor." The context package's constraints.md states: "The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`." The decisions document adds: "Walking up follows a single chain of parentID pointers, which is O(depth) not O(subtree_size)."

**Answer:** The system uses the `isParent` method which recursively walks UP from the destination collection to the root, following parentID links. At each step, it checks if the source collection is an ancestor of the destination. If found, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. This is O(depth), not O(subtree_size). The check runs within the same transaction as the move operation. Additionally, self-move is rejected with `TEAM_COLL_DEST_SAME`, and same-team membership is verified.

### A3: What concurrency mechanism ensures orderIndex consistency when two users reorder simultaneously?

From the flow description (invariants): "Every sibling-order mutation acquires a pessimistic row lock before reading orderIndex values." The pessimistic-locking aspect describes the full pattern: open transaction, call `lockTeamCollectionByTeamAndParent`, read, mutate, commit. The retry-on-deadlock aspect adds: delete operations retry up to 5 times with linear backoff for UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, or TRANSACTION_TIMEOUT.

**Answer:** Pessimistic row locking via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` is acquired at the start of every sibling-modifying transaction. The lock scope is `(teamID, parentID)`, locking the sibling set so different subtrees can proceed in parallel. Delete operations additionally use a retry loop (5 retries, linear backoff: retryCount * 100ms) for transient deadlocks. Other mutations (create, move, reorder) rely solely on the pessimistic lock without retries, because they typically modify non-overlapping index ranges.

### A4: How does collection duplication reuse the import mechanism, and what events are published?

From the flow description (Duplicate collection path): "Export collection to JSON (recursive), Append ' - Duplicate' to title, Import the modified JSON under the same parent. Reuses import flow, which handles locking and ordering." The decisions document explains: "Rather than implementing a separate deep-copy method, duplication exports the collection to JSON, modifies the title, then re-imports."

**Answer:** Duplication uses an export-then-import pattern. First, `exportCollectionToJSONObject` recursively serializes the entire subtree (collections + requests) to JSON. The title is modified to append " - Duplicate." Then `importCollectionsFromJSON` is called to re-import under the same parent, which handles pessimistic locking, orderIndex assignment, and nested creation in a single transaction. Events published: `coll_added` for each top-level imported collection. This reuse eliminates a separate code path that would need to maintain parity with import logic.

### A5: What happens to sibling orderIndex values when a collection is moved out of a parent?

From the flow description (Move collection path, steps 5-6): "Decrement orderIndex of source's former siblings" and "Assign source to new parent with orderIndex = last + 1 under new parent." The logic.md artifact describes `changeParentAndUpdateOrderIndex`: find last orderIndex under new parent, decrement all siblings in ORIGINAL parent with orderIndex > current, update collection with new parentID and orderIndex.

**Answer:** When a collection moves out of a parent, the service performs a two-parent operation within a single transaction: (1) decrements orderIndex of all siblings in the ORIGINAL parent that had orderIndex > the moved collection's orderIndex (fills the gap), (2) assigns the moved collection to the new parent with orderIndex = last + 1 under the new parent (or 1 if first child). Both source and destination sibling sets maintain contiguous orderIndex values.

### A6: What prevents deleting a user who is the sole owner of a team?

From the flow description (Team Member Lifecycle, User account deletion path): "TeamService.canAllowUserDeletion checks if user is sole owner of any team — if so, returns error to block deletion." The context packages describe the UserDataHandler pattern: TeamService registers as a handler, `canAllowUserDeletion` checks `isUserSoleOwnerInAnyTeam`, which queries all teams where user is OWNER and counts OWNERs per team.

**Answer:** The UserDataHandler pattern coordinates deletion checks. TeamService registers as a UserDataHandler during module initialization. When UserService.deleteUserByUID is called, it collects errors from all handlers. TeamService.canAllowUserDeletion calls isUserSoleOwnerInAnyTeam(uid), which finds all teams where the user is an OWNER, then counts OWNERs per team. If any team has exactly 1 OWNER (the user), it returns USER_IS_OWNER to block the deletion. Additionally, AdminService checks if the user is an admin (isAdmin flag) and blocks with USER_IS_ADMIN if so.

### A7: When an admin directly adds a user who already has a pending invitation, what happens to the invitation?

From the flow description (Admin direct addition path): "If an existing invitation exists for that email and team, it is automatically revoked." The AdminService constraints confirm: "Invitation cleanup on team addition: When an admin adds a user to a team via `addUserToTeam`, any existing team invitation for that user's email is automatically revoked."

**Answer:** The invitation is automatically revoked. After AdminService.addUserToTeam successfully adds the member (via TeamService.addMemberToTeamWithEmail), it checks for a pending invitation using getTeamInviteByEmailAndTeamID. If one exists, revokeInvitation is called, which deletes the invitation record and publishes an `invite_removed` PubSub event. The invitation does not remain as a stale record.

### A8: How many PubSub events are published when accepting an invitation?

From the flow description (Invite and accept path, steps 6-7): "TeamService.addMemberToTeam creates the membership with the invited role. `member_added` event published, invitation is revoked, `invite_removed` event published."

**Answer:** Two PubSub events are published: (1) `team/${teamID}/member_added` when TeamService.addMemberToTeam creates the membership, and (2) `team/${teamID}/invite_removed` when the invitation is revoked via revokeInvitation after acceptance. There is no explicit `invite_accepted` event.

### A9: What is the full chain of checks when a user account is deleted (across all participants)?

From the flow description (User account deletion path): The full 7-step chain is explicitly documented: (1) deletion initiator calls UserService.deleteUserByUID, (2) UserService collects errors from all UserDataHandler implementations, (3) TeamService.canAllowUserDeletion checks sole owner, (4) if approved, TeamService.onUserDelete calls deleteUserFromAllTeams, (5) member_removed events published, (6) user account deleted, (7) user/{uid}/deleted event published.

**Answer:** The full chain: (1) AdminService.removeUserAccount checks user is not admin (blocks with USER_IS_ADMIN if so). (2) UserService.deleteUserByUID calls getUserDeletionErrors, iterating all registered UserDataHandler implementations. (3) TeamService.canAllowUserDeletion checks isUserSoleOwnerInAnyTeam — blocks with USER_IS_OWNER if user is sole owner of any team. (4) If all handlers approve, onUserDelete is called on each handler. (5) TeamService.onUserDelete calls deleteUserFromAllTeams, which leaves each team (publishing member_removed events). (6) User account is deleted from database. (7) user/{uid}/deleted PubSub event is published. For batch deletion, admin users are additionally excluded and infra invitations are revoked.

### A10: Can an admin remove the last owner of a team? What protection exists?

From the flow description (Admin removes member path): "Delegates to TeamService.leaveTeam (same sole-owner protection applies)." The constraints describe the sole owner protection in detail.

**Answer:** No. AdminService.removeUserFromTeam delegates directly to TeamService.leaveTeam, which enforces the sole-owner invariant: it counts OWNERs, and if the member being removed is the last OWNER (ownerCount === 1 and member.role === OWNER), returns TEAM_ONLY_ONE_OWNER. The admin service does not bypass this protection — it uses the same code path as regular member departure.

---

## Condition B Answers (Graph without flows)

**Available information:** All 5 context packages (node artifacts, aspects, relations, constraints, errors, interface, responsibility) — NO flow descriptions.

### B1: What happens to child collections and requests when a parent collection is deleted?

The context package describes `deleteCollection(collectionID)` in the interface as "delete with sibling reindexing and retry." The constraints mention orderIndex contiguity: "Every delete decrements all higher siblings." The decisions document mentions delete retries for concurrent races. However, there is no explicit mention of Prisma cascade behavior for children and requests in the context packages.

**Answer:** When a collection is deleted, the service deletes the collection record and decrements the orderIndex of all siblings with higher orderIndex to maintain contiguity. The delete operation uses a retry loop (up to 5 retries) for handling concurrent deadlocks. A `coll_removed` PubSub event is published. Regarding child collections and requests, the context package does not explicitly describe what happens to them, but given Prisma ORM usage and standard relational patterns, it is likely that children and requests are either cascade-deleted or must be handled separately. The interface does not mention explicit child deletion, suggesting a database-level cascade.

### B2: How does the system prevent circular references when moving a collection?

The context package's constraints.md explicitly describes: "The `isParent` method walks up the tree from the destination to the root. If it encounters the source collection on that path, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`." The logic.md describes the recursive algorithm. The decisions document explains why walking up is preferred over walking down.

**Answer:** The system uses the `isParent` method which recursively walks UP from the destination collection to the root via parentID links. At each step, if the source collection is found to be an ancestor, the move is rejected with `TEAM_COLL_IS_PARENT_COLL`. This is O(depth) rather than O(subtree_size). Walking up is preferred over walking down because it follows a single chain of pointers rather than loading an entire subtree. Self-move is also prevented (TEAM_COLL_DEST_SAME) and same-team validation ensures no cross-team moves.

### B3: What concurrency mechanism ensures orderIndex consistency when two users reorder simultaneously?

The pessimistic-locking aspect explains the full pattern. The retry-on-deadlock aspect describes the delete retry mechanism. The constraints describe the lock scope.

**Answer:** Pessimistic row locking via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`. Every operation that reads and modifies sibling orderIndex values acquires this lock first within a Prisma transaction. The lock is scoped to (teamID, parentID), so operations on different subtrees can proceed in parallel. Delete operations additionally use a retry loop (5 retries, linear backoff retryCount * 100ms) for UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, and TRANSACTION_TIMEOUT. Other mutations rely solely on the lock.

### B4: How does collection duplication reuse the import mechanism, and what events are published?

The decisions document explicitly explains: "duplication exports the collection to JSON, modifies the title (appending ' - Duplicate'), then re-imports." The interface shows `duplicateCollection` and `importCollectionsFromJSON`. The pubsub-events aspect describes `coll_added` events.

**Answer:** Duplication uses export-then-import: the collection is exported to JSON via `exportCollectionToJSONObject` (recursive serialization of the subtree), the title is modified to append " - Duplicate", and `importCollectionsFromJSON` re-imports it under the same parent. This reuses the import logic which handles locking, orderIndex assignment, and nested creation. Events: `coll_added` is published for imported collections. The trade-off is slightly more overhead (serialization round-trip) but eliminates a separate code path.

### B5: What happens to sibling orderIndex values when a collection is moved out of a parent?

The logic.md artifact describes `changeParentAndUpdateOrderIndex` explicitly: find last orderIndex under new parent, decrement all siblings after the collection in its ORIGINAL parent, update collection with new parentID and orderIndex.

**Answer:** A two-parent operation within a single transaction: (1) find the last orderIndex under the new parent, (2) decrement orderIndex of all siblings in the ORIGINAL parent with orderIndex > the collection's current orderIndex (fills the gap), (3) update the collection's parentID and set orderIndex to last + 1 under the new parent (or 1 if first child). Both source and destination sibling sets maintain contiguous indexes.

### B6: What prevents deleting a user who is the sole owner of a team?

The TeamService constraints describe the UserDataHandler pattern and sole owner protection. The UserService constraints describe the deletion cascade steps. The AdminService constraints mention admin check.

**Answer:** The UserDataHandler pattern. TeamService implements UserDataHandler and registers itself during module initialization. When UserService.deleteUserByUID is called, it collects errors from all handlers. TeamService.canAllowUserDeletion checks isUserSoleOwnerInAnyTeam — if the user is the sole owner of any team, it returns USER_IS_OWNER to block. AdminService additionally checks if the user is an admin (USER_IS_ADMIN). The deletion is blocked if any handler returns an error.

### B7: When an admin directly adds a user who already has a pending invitation, what happens to the invitation?

The AdminService constraints explicitly state: "Invitation cleanup on team addition: When an admin adds a user to a team via `addUserToTeam`, any existing team invitation for that user's email is automatically revoked."

**Answer:** The invitation is automatically revoked. After adding the member, AdminService.addUserToTeam checks for an existing invitation via getTeamInviteByEmailAndTeamID. If found, revokeInvitation is called to delete it and publish an `invite_removed` event. This prevents stale invitations.

### B8: How many PubSub events are published when accepting an invitation?

The interface for TeamInvitationService describes acceptInvitation as "validate, add member, clean up." The interface for TeamService shows addMemberToTeam "publishes event." The interface for revokeInvitation shows it also publishes an event. But the exact count requires understanding the acceptance flow chain.

**Answer:** Examining the interfaces: (1) TeamService.addMemberToTeam publishes a `member_added` event, (2) acceptInvitation calls revokeInvitation to clean up the invitation, which publishes an `invite_removed` event. So 2 PubSub events total. However, the graph does not explicitly state that acceptInvitation calls revokeInvitation — the responsibility.md says "accept (which triggers member addition)" and the interface says "validate, add member, clean up" where "clean up" implies invitation removal. The exact number of 2 can be inferred but requires piecing together multiple artifacts.

### B9: What is the full chain of checks when a user account is deleted (across all participants)?

The UserService constraints describe the 5-step cascade. TeamService constraints describe the UserDataHandler implementation. AdminService constraints describe admin protection. But the cross-participant chain must be reconstructed from individual node artifacts.

**Answer:** Reconstructing from individual services: (1) AdminService.removeUserAccount checks if user is admin — blocks with USER_IS_ADMIN. (2) UserService.deleteUserByUID collects errors from all UserDataHandler implementations. (3) TeamService.canAllowUserDeletion checks isUserSoleOwnerInAnyTeam — blocks with USER_IS_OWNER if sole owner. (4) If approved, handlers' onUserDelete is called. (5) TeamService.onUserDelete removes user from all teams via deleteUserFromAllTeams. (6) User account deleted from database. (7) user/{uid}/deleted event published. The chain can be reconstructed from the individual nodes but requires assembling pieces from 3-4 different context packages.

### B10: Can an admin remove the last owner of a team? What protection exists?

The AdminService interface shows `removeUserFromTeam` delegates to TeamService.leaveTeam. TeamService constraints describe the sole-owner protection.

**Answer:** No. AdminService.removeUserFromTeam delegates to TeamService.leaveTeam, which enforces sole-owner protection: counts OWNERs, and if the member is the last OWNER, returns TEAM_ONLY_ONE_OWNER. The admin path uses the same protection as the regular member departure path.

---

## Condition C Answers (Raw source code only)

**Available information:** 5 source files (team-collection.service.ts, team.service.ts, team-invitation.service.ts, user.service.ts, admin.service.ts) + Prisma schema.

### C1: What happens to child collections and requests when a parent collection is deleted?

Reading `deleteCollection`: calls `getCollection` then `deleteCollectionAndUpdateSiblingsOrderIndex`. Inside the latter, within a transaction: locks rows, calls `tx.teamCollection.delete({ where: { id: collection.id } })`, then updateMany to decrement siblings. The Prisma schema shows `onDelete: Cascade` on both `TeamCollection.parent` and `TeamRequest.collection`.

**Answer:** The service calls `teamCollection.delete` on the target collection within a transaction. The Prisma schema defines `onDelete: Cascade` on the parent-child self-relation and on the collection-request relation, so PostgreSQL automatically cascades the deletion to all child collections and their requests. The service does not explicitly handle child deletion — it relies on database cascades. After the delete, sibling orderIndex values above the deleted collection are decremented. The operation retries up to 5 times on deadlock/timeout/unique constraint errors. A `coll_removed` PubSub event is published for the top-level deleted collection.

### C2: How does the system prevent circular references when moving a collection?

Reading `moveCollection`: calls `this.isParent(collection.right, destCollection.right, tx)`. Reading `isParent`: recursive method that walks up from destCollection via parentID. If `destCollection.parentID === collection.id` returns `O.none` (invalid). If reaches root (parentID null) returns `O.some(true)` (safe). If `O.isNone(checkIfParent)` then returns `TEAM_COLL_IS_PARENT_COLL`.

**Answer:** The `isParent` method recursively walks UP from the destination collection to the root following parentID pointers. At each level: if destination.parentID === source.id, returns O.none (source is an ancestor — would create cycle). If parentID is null (reached root without finding source), returns O.some(true) (safe to move). If O.isNone is returned, moveCollection rejects with TEAM_COLL_IS_PARENT_COLL. Also checks: self-move (TEAM_COLL_DEST_SAME), same-team (TEAM_COLL_NOT_SAME_TEAM), already-root (TEAM_COL_ALREADY_ROOT).

### C3: What concurrency mechanism ensures orderIndex consistency when two users reorder simultaneously?

Reading the code: every transaction that modifies orderIndex starts with `this.prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)`. In deleteCollectionAndUpdateSiblingsOrderIndex: retry loop with `MAX_RETRIES = 5`, checks for PrismaError codes, delay of `retryCount * 100`.

**Answer:** Pessimistic row locking via `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` at the start of every sibling-modifying transaction. The lock is scoped to (teamID, parentID). Delete operations have a retry loop: up to 5 retries, linear backoff (retryCount * 100ms), only for UNIQUE_CONSTRAINT_VIOLATION, TRANSACTION_DEADLOCK, or TRANSACTION_TIMEOUT error codes. Other mutations (create, move, reorder, sort) do not retry.

### C4: How does collection duplication reuse the import mechanism, and what events are published?

Reading `duplicateTeamCollection`: calls `exportCollectionToJSONObject(teamID, collectionID)`, modifies the result to add " - Duplicate" to the name, then calls `importCollectionsFromJSON(JSON.stringify([...]), teamID, parentID)`. Reading `importCollectionsFromJSON`: publishes `coll_added` for each entry in `teamCollections` array after the transaction.

**Answer:** `duplicateTeamCollection` exports the collection subtree to JSON via `exportCollectionToJSONObject`, appends " - Duplicate" to the title in the JSON, then calls `importCollectionsFromJSON` to re-import under the same parent. The import handles locking, orderIndex, and nested creation. Events: `coll_added` is published for each top-level collection in the teamCollections array (the direct results of the create operations within the transaction). Nested children do not get individual events.

### C5: What happens to sibling orderIndex values when a collection is moved out of a parent?

Reading `changeParentAndUpdateOrderIndex`: (1) find last collection under new parent, (2) decrement orderIndex of all siblings in original parent with orderIndex > collection's orderIndex, (3) update collection with new parentID and orderIndex = last + 1 (or 1).

**Answer:** Two-parent operation in a single transaction: (1) find last orderIndex under new parent, (2) decrement orderIndex of all siblings in original parent where orderIndex > moved collection's orderIndex, (3) set moved collection's parentID to new parent and orderIndex to last + 1 under new parent (or 1 if no children). Both parent sibling sets remain contiguous.

### C6: What prevents deleting a user who is the sole owner of a team?

Reading `user.service.ts`: `deleteUserByUID` calls `getUserDeletionErrors` which maps over `userDataHandlers` and calls `canAllowUserDeletion`. Reading `team.service.ts`: implements `UserDataHandler`, registers in `onModuleInit`, `canAllowUserDeletion` calls `isUserSoleOwnerInAnyTeam`. That method finds all teams where user is OWNER, counts OWNERs per team, returns true if any team has 1. Reading `admin.service.ts`: `removeUserAccount` checks `user.value.isAdmin`.

**Answer:** UserDataHandler pattern. TeamService implements it and registers during onModuleInit. UserService.deleteUserByUID calls getUserDeletionErrors which iterates all handlers. TeamService.canAllowUserDeletion calls isUserSoleOwnerInAnyTeam — finds all OWNER memberships, counts OWNERs per team, returns USER_IS_OWNER if any team has count 1. AdminService.removeUserAccount also checks isAdmin flag first (USER_IS_ADMIN). Deletion is blocked if any handler returns an error.

### C7: When an admin directly adds a user who already has a pending invitation, what happens to the invitation?

Reading `admin.service.ts` `addUserToTeam`: after adding member, calls `teamInvitationService.getTeamInviteByEmailAndTeamID(userEmail, teamID)`, and if E.isRight, calls `teamInvitationService.revokeInvitation(userInvitation.right.id)`.

**Answer:** The pending invitation is automatically revoked. After successfully adding the member, AdminService.addUserToTeam looks up any existing invitation for that email and team. If found, revokeInvitation is called, which deletes the invitation record and publishes an `invite_removed` event.

### C8: How many PubSub events are published when accepting an invitation?

Reading `team-invitation.service.ts` `acceptInvitation`: calls `teamService.addMemberToTeam` (which in team.service.ts publishes `team/${teamID}/member_added`), then calls `this.revokeInvitation(inviteID)` (which publishes `team/${teamID}/invite_removed`).

**Answer:** 2 PubSub events: (1) `team/${teamID}/member_added` from TeamService.addMemberToTeam, (2) `team/${teamID}/invite_removed` from revokeInvitation. No explicit invite_accepted event exists.

### C9: What is the full chain of checks when a user account is deleted (across all participants)?

Tracing through the code across all 5 files:

**Answer:** (1) AdminService.removeUserAccount: finds user, checks isAdmin (returns USER_IS_ADMIN if admin). (2) UserService.deleteUserByUID: calls getUserDeletionErrors — iterates all UserDataHandler implementations via taskEitherValidateArraySeq. (3) TeamService.canAllowUserDeletion: calls isUserSoleOwnerInAnyTeam — queries OWNER memberships, counts per team, blocks with USER_IS_OWNER if sole owner anywhere. (4) If no errors, sequentially calls onUserDelete on each handler. (5) TeamService.onUserDelete: calls deleteUserFromAllTeams — finds all memberships, calls leaveTeam for each (which checks sole-owner again, deletes membership, publishes member_removed). (6) UserService: calls deleteUserAccount (prisma.user.delete). (7) UserService: publishes `user/${uid}/deleted` event. For batch: admin users excluded (ADMIN_CAN_NOT_BE_DELETED), infra invitations revoked afterward.

### C10: Can an admin remove the last owner of a team? What protection exists?

Reading `admin.service.ts` `removeUserFromTeam`: calls `this.teamService.leaveTeam(teamID, userUid)`. Reading `team.service.ts` `leaveTeam`: counts owners, checks if sole owner.

**Answer:** No. AdminService.removeUserFromTeam delegates to TeamService.leaveTeam, which checks: count OWNERs, and if ownerCount === 1 AND member.role === OWNER, returns TEAM_ONLY_ONE_OWNER. The admin does not bypass this protection.

---

## Score Matrix

Scoring each answer 0-5 against ground truth:

| Question | Condition A | Condition B | Condition C |
|----------|-------------|-------------|-------------|
| Q1 (cascade delete) | 5 | 3 | 5 |
| Q2 (circular ref) | 5 | 5 | 5 |
| Q3 (concurrency) | 5 | 5 | 5 |
| Q4 (duplication) | 5 | 5 | 5 |
| Q5 (sibling reindex on move) | 5 | 5 | 5 |
| Q6 (sole owner delete block) | 5 | 5 | 5 |
| Q7 (invitation cleanup) | 5 | 5 | 5 |
| Q8 (accept events count) | 5 | 4 | 5 |
| Q9 (full deletion chain) | 5 | 4 | 5 |
| Q10 (admin remove last owner) | 5 | 5 | 5 |
| **Mean** | **5.00** | **4.60** | **5.00** |

### Scoring Rationale

**Q1 — Condition B scored 3:** The context package does NOT explicitly mention Prisma cascade behavior for children and requests. The answer had to hedge ("likely cascade-deleted") and could not confirm this critical detail. The flow description explicitly states "Prisma cascades to children and requests" and the flow invariants confirm "Delete cascades to all children and requests (Prisma relation cascade)." This is the clearest flow advantage — the graph artifacts describe the deleteCollection interface as "delete with sibling reindexing and retry" but do not mention the cascade. The flow fills this gap.

**Q1 — Condition C scored 5:** The raw source code combined with the Prisma schema makes the cascade behavior completely clear from the `onDelete: Cascade` annotations.

**Q8 — Condition B scored 4:** The answer correctly identified 2 events but had to reason indirectly ("clean up" implies revocation → implies event). The flow description makes the chain explicit. Minor deduction for uncertainty.

**Q9 — Condition B scored 4:** The full chain was reconstructed correctly but required piecing together 4 different context packages. The answer acknowledged the assembly effort. The flow description provides the chain as a single narrative. Minor deduction for the higher cognitive load and slight hedging.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Mean score — Condition A (full graph + flows) | **5.00** |
| Mean score — Condition B (graph without flows) | **4.60** |
| Mean score — Condition C (raw source code) | **5.00** |
| Delta A-B (flow value-add) | **+0.40** |
| Delta A-C (total graph value-add) | **+0.00** |
| Delta B-C (graph-only vs raw code) | **-0.40** |

### Questions with largest flow advantage (A vs B delta)

1. **Q1 (cascade delete): A=5, B=3, delta=+2** — Flow explicitly documents cascade behavior that is absent from node-level artifacts
2. **Q8 (accept events): A=5, B=4, delta=+1** — Flow provides explicit event sequence; graph requires inference
3. **Q9 (deletion chain): A=5, B=4, delta=+1** — Flow provides complete cross-service narrative; graph requires assembly

---

## Analysis and Conclusions

### 1. Flows provide marginal value in this configuration

The delta between Condition A and Condition B is only **+0.40 points** (5.00 vs 4.60). This is a modest improvement. The node-level artifacts (constraints, decisions, logic, interface, responsibility, aspects) already capture most of the information needed to answer cross-module questions correctly.

### 2. Raw source code matches full graph performance

Condition C (raw source code) scored **5.00**, identical to Condition A. This is a striking result that requires interpretation:

- **This experiment measures a single agent reading ALL relevant source files.** In real-world usage, agents do NOT read all 5 service files simultaneously. They typically have one or two files in context. Flows and graphs provide value precisely because they pre-assemble cross-module knowledge that would otherwise require reading 3-5 files.
- **The source code is well-structured and relatively small.** Each service file is 250-1550 lines. For larger services or more complex interactions, raw code comprehension would degrade.
- **The Prisma schema is a cheat code.** Q1's cascade behavior is visible in the schema but not in the node artifacts. This specific piece of information benefits Condition C but penalizes Condition B unfairly.

### 3. Where flows clearly help

**Q1 (cascade delete)** is the most revealing question. The flow description explicitly states "Prisma cascades to children and requests" — a critical implementation detail that is NOT captured in any node-level artifact (constraints, interface, logic, or decisions). The node artifacts describe `deleteCollection` as "delete with sibling reindexing and retry" but say nothing about what happens to children. This is an artifact **omission** — the cascade behavior should arguably be in `internals.md` or `constraints.md` but was missed. The flow caught it because flows describe end-to-end paths.

**Q8 and Q9** show that flows reduce assembly effort for cross-service chains. The graph has all the pieces, but the agent must assemble them from multiple packages. Flows provide the pre-assembled narrative.

### 4. Why flows did NOT help for 7 out of 10 questions

Seven questions scored identically across all conditions. This is because:

- **Q2, Q3, Q4, Q5** are primarily single-service questions about TeamCollectionService internals. The node-level artifacts (constraints, logic, decisions) cover them thoroughly. Flows add no new information.
- **Q6, Q7, Q10** are cross-service but the relevant information is well-captured in individual service constraints (sole-owner protection in TeamService.constraints, invitation cleanup in AdminService.constraints).

### 5. The real value proposition of flows

Flows did not dramatically improve scores because:

1. **The Hoppscotch graph is high-quality.** The constraints, decisions, and logic artifacts are thorough. In a lower-quality graph, flows would provide much more value.
2. **The questions tested were answerable from individual node artifacts.** Flows would show more value for questions like "What is the full sequence of events when a new user signs up, gets invited to a team, and the team is later deleted?" — questions that span multiple flows.
3. **Flows primarily reduce cognitive load, not accuracy.** An agent CAN piece together the answer from multiple context packages, but it takes more steps and introduces more opportunity for error. In a token-constrained environment (e.g., 128k context window with many nodes), flows would provide a pre-assembled summary that saves tokens.

### 6. Graph without flows UNDERPERFORMED raw source code

The most surprising result: Condition B (4.60) scored **lower** than Condition C (5.00). This happened because:

- The graph artifacts have an **omission** in cascade behavior (Q1 lost 2 points)
- The raw source code plus Prisma schema contains ALL information including implementation details
- The graph is an abstraction layer — and abstractions can omit details that the source code retains

**This validates Experiment 3's finding** that aspect-level omissions are the primary failure mode of graphs. The graph's value is proportional to its completeness. An incomplete graph is WORSE than raw code for the specific details it omits.

### 7. Recommendations

1. **Flows are worth creating** for multi-participant processes, but their value is primarily in **cognitive load reduction** and **gap detection** (as Q1 shows — the flow author noticed the cascade behavior when writing the end-to-end path).
2. **Node-level artifacts need audit for cascade/side-effect completeness.** The Q1 gap (missing cascade in constraints/internals) suggests adding a checklist item: "For every delete operation, document what happens to related entities."
3. **Flow descriptions should capture cross-service implementation details** that individual nodes might miss — such as database cascades, event chains, and multi-step transaction boundaries.
4. **Do not assume flows replace careful node-level documentation.** 7 of 10 questions were answered identically without flows. The node artifacts do the heavy lifting.
