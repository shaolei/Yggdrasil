# PubSub Failure Analysis: Which Operations Fail vs Degrade Gracefully?

## 1. Complete Inventory of PubSub Publish Calls

### TeamService (team.service.ts)
| Line | Topic | Operation | `await`? |
|------|-------|-----------|----------|
| 101 | `team/{id}/member_added` | addMemberToTeam | No (fire-and-forget) |
| 200 | `team/{id}/member_updated` | updateTeamAccessRole | No (fire-and-forget) |
| 237 | `team/{id}/member_removed` | leaveTeam | No (fire-and-forget) |

### TeamCollectionService (team-collection.service.ts)
| Line | Topic | Operation | `await`? |
|------|-------|-----------|----------|
| 264 | `team_coll/{id}/coll_added` | importCollectionsFromJSON (forEach loop) | No |
| 511 | `team_coll/{id}/coll_added` | createCollection | No |
| 537 | `team_coll/{id}/coll_updated` | renameCollection | No |
| 635 | `team_coll/{id}/coll_removed` | deleteCollection | No |
| 776 | `team_coll/{id}/coll_moved` | moveCollection (inside $transaction callback) | No |
| 825 | `team_coll/{id}/coll_moved` | moveCollection (inside $transaction callback) | No |
| 925 | `team_coll/{id}/coll_order_updated` | updateLookUpRequestOrder (after $transaction) | No |
| 1009 | `team_coll/{id}/coll_order_updated` | updateLookUpRequestOrder (after $transaction) | No |
| 1082 | `team_coll/{id}/coll_updated` | updateTeamCollection | No |

### TeamRequestService (team-request.service.ts)
| Line | Topic | Operation | `await`? |
|------|-------|-----------|----------|
| 69 | `team_req/{id}/req_updated` | updateTeamRequest | No |
| 151 | `team_req/{id}/req_deleted` | deleteTeamRequest | No |
| 216 | `team_req/{id}/req_created` | createTeamRequest | No |
| 341 | `team_req/{id}/req_moved` | moveRequest | No |
| 343 | `team_req/{id}/req_order_updated` | moveRequest (updateLookUpRequestOrder variant) | No |

### TeamEnvironmentsService (team-environments.service.ts)
| Line | Topic | Operation | `await`? |
|------|-------|-----------|----------|
| 88 | `team_environment/{id}/created` | createTeamEnvironment | No |
| 112 | `team_environment/{id}/deleted` | deleteTeamEnvironment | No |
| 146 | `team_environment/{id}/updated` | updateTeamEnvironment | No |
| 174 | `team_environment/{id}/updated` | deleteAllVariablesFromTeamEnvironment | No |
| 209 | `team_environment/{id}/created` | createDuplicateEnvironment | No |

### TeamInvitationService (team-invitation.service.ts)
| Line | Topic | Operation | `await`? |
|------|-------|-----------|----------|
| 163 | `team/{id}/invite_added` | createInvitation | No |
| 185 | `team/{id}/invite_removed` | revokeInvitation | No |

### UserService (user.service.ts)
| Line | Topic | Operation | `await`? |
|------|-------|-----------|----------|
| 287 | `user/{uid}/updated` | updateUserSessions | Yes (`await`) |
| 315 | `user/{uid}/updated` | updateUserDisplayName | Yes (`await`) |
| 548 | `user/{uid}/deleted` | deleteUserByUID (via TE.chainFirst) | Effectively awaited (chained in TaskEither pipeline) |

### AdminService (admin.service.ts)
| Line | Topic | Operation | `await`? |
|------|-------|-----------|----------|
| 137 | `admin/{uid}/invited` | inviteUserToSignInViaEmail | Yes (`await`) |

### AuthService (auth.service.ts)
No PubSub usage. Does not inject PubSubService at all.

---

## 2. Transaction Boundary Analysis

### PubSub calls INSIDE a database transaction callback:
- **moveCollection** (lines 776, 825): The `this.pubsub.publish` calls are inside the `this.prisma.$transaction(async (tx) => { ... })` callback. If PubSub throws synchronously, this would propagate up and cause the transaction to be caught by the outer catch, returning an error. However, since the publish is fire-and-forget (no `await`), a rejected promise from pubsub would be an unhandled promise rejection -- it would NOT roll back the transaction.

### PubSub calls AFTER a database transaction:
- **importCollectionsFromJSON** (line 264): Publish happens after the `$transaction` completes successfully.
- **createCollection** (line 511): After `$transaction`.
- **deleteTeamRequest** (line 151): After `$transaction`.
- **createTeamRequest** (line 216): After `$transaction`.
- **updateLookUpRequestOrder / reorderCollections** (lines 925, 1009): After `$transaction`.
- **moveRequest / reorderRequests** (lines 341, 343): After `$transaction`.

### PubSub calls outside any transaction (simple Prisma operations):
- All TeamService calls (addMemberToTeam, updateTeamAccessRole, leaveTeam)
- renameCollection, deleteCollection, updateTeamCollection
- updateTeamRequest
- All TeamEnvironmentsService calls
- All TeamInvitationService calls
- updateUserSessions, updateUserDisplayName, deleteUserByUID
- inviteUserToSignInViaEmail

---

## 3. Classification: Operation Failure vs Notification Loss

### Operations that FAIL COMPLETELY if PubSub is down:

**Only if PubSub.publish throws synchronously (not just returns a rejected promise):**

1. **UserService.updateUserSessions** -- The `await this.pubsub.publish(...)` at line 287 means a synchronous throw or rejected promise will be caught by the enclosing `try/catch` (lines 266-292), causing the method to return `E.left(USER_UPDATE_FAILED)`. **The database write succeeds but the caller receives an error response.** This is a partial failure: data is saved, but the user gets an error.

2. **UserService.updateUserDisplayName** -- Same pattern. `await this.pubsub.publish(...)` at line 315 is inside a `try/catch`. A PubSub error would be caught, returning `E.left(USER_NOT_FOUND)`. **Database write succeeds, but error returned to caller.**

3. **UserService.deleteUserByUID** -- The pubsub publish is in a `TE.chainFirst` pipeline step. If the publish throws, the TaskEither pipeline short-circuits to the left branch. However, crucially, `deleteUserAccount` has already been called in the preceding `TE.chainW` step. **The user is already deleted from the database, but the caller gets an error response.**

4. **AdminService.inviteUserToSignInViaEmail** -- `await this.pubsub.publish(...)` at line 137. This is NOT inside a try/catch at the point of the publish. The `await` is directly in the method body after the DB write. If it throws, the exception propagates up as an unhandled error, and the caller would see a 500 Internal Server Error. **The invited user record is already written to DB, but the admin gets an error.**

5. **TeamCollectionService.moveCollection** (lines 776, 825) -- These are inside the `$transaction` callback. If pubsub.publish throws synchronously, the exception could propagate out of the transaction callback, causing the transaction to potentially fail (though Prisma interactive transactions have complex error semantics). **Risk: If publish throws synchronously, the entire database move operation could be rolled back.** However, since publish is NOT awaited, only a synchronous throw (not an async rejection) would cause this.

### Operations that DEGRADE GRACEFULLY (notification loss only):

All other operations use fire-and-forget `this.pubsub.publish(...)` without `await`:

- **TeamService**: addMemberToTeam, updateTeamAccessRole, leaveTeam
- **TeamCollectionService**: importCollectionsFromJSON, createCollection, renameCollection, deleteCollection, updateTeamCollection, updateLookUpRequestOrder (both branches)
- **TeamRequestService**: updateTeamRequest, deleteTeamRequest, createTeamRequest, moveRequest
- **TeamEnvironmentsService**: createTeamEnvironment, deleteTeamEnvironment, updateTeamEnvironment, deleteAllVariablesFromTeamEnvironment, createDuplicateEnvironment
- **TeamInvitationService**: createInvitation, revokeInvitation

For all of these, the database operations complete successfully, the method returns a success result, and the PubSub failure is silently ignored (the returned promise rejection becomes an unhandled promise rejection in Node.js).

---

## 4. User-Visible Symptoms Per Service

### TeamService
- **Symptom**: Team member additions, role changes, and departures succeed in the database, but other team members with active real-time subscriptions (e.g., GraphQL subscriptions) would NOT receive live updates. The UI would appear stale until a manual refresh or page reload.
- **Severity**: Low. Data integrity preserved. Real-time sync breaks.

### TeamCollectionService
- **Symptom**: Collections can be created, renamed, deleted, moved, and reordered -- all database operations succeed. However, collaborators viewing the same team would not see changes reflected in real-time. They must reload to see new/moved/deleted collections.
- **Special risk with moveCollection**: If PubSub throws synchronously inside the transaction callback, the move transaction could roll back, causing the move operation to fail entirely. This is the only case where a PubSub failure could cause *data loss* in this service.
- **Severity**: Low to Medium. Mostly real-time sync loss. One edge case of potential operation failure.

### TeamRequestService
- **Symptom**: Requests can be created, updated, deleted, and reordered successfully. Collaborators won't see real-time updates. Must reload.
- **Severity**: Low. Data integrity preserved.

### TeamEnvironmentsService
- **Symptom**: Environments can be created, updated, deleted, duplicated, and cleared. Collaborators won't see changes in real-time. Must reload.
- **Severity**: Low. Data integrity preserved.

### TeamInvitationService
- **Symptom**: Invitations can be created and revoked. Team owners viewing the invitations panel won't see real-time updates. The invitation email (sent via MailerService before the pubsub call in createInvitation) still goes out.
- **Severity**: Low. Data and email delivery preserved.

### UserService
- **Symptom**:
  - **updateUserSessions**: User saves their REST/GQL session, database writes succeed, but the method returns an error (`USER_UPDATE_FAILED`). **The user sees an error toast/message even though their session was actually saved.** On next load, the session is there. Confusing UX.
  - **updateUserDisplayName**: User changes display name, database writes succeed, but method returns an error (`USER_NOT_FOUND`). **User sees error but name actually changed.** Confusing UX.
  - **deleteUserByUID**: User account is deleted from database, but the pipeline returns an error. In the admin context (`removeUserAccount` / `removeUserAccounts`), the admin would see the deletion as failed even though it succeeded. **Ghost error on successful deletion.**
- **Severity**: Medium. Misleading error messages. No data loss, but false negatives to users.

### AdminService
- **Symptom**: Admin invites a user. Email is sent, database record created. But if PubSub fails, the `await` causes an unhandled exception that could result in a 500 error response. **Admin sees invitation as failed despite email being sent and DB record being created.** They might re-invite, hitting the `USER_ALREADY_INVITED` guard.
- **Severity**: Medium. False failure with potential for duplicate invite attempts.

### AuthService
- **No impact.** AuthService does not use PubSub at all.

---

## 5. Data Loss Risk vs Notification Loss

### Data at Risk (potential data integrity issues):

1. **TeamCollectionService.moveCollection** -- If `pubsub.publish` throws synchronously inside the `$transaction` callback (lines 776, 825), the Prisma interactive transaction could roll back. The collection move would NOT be persisted. The user would see a reordering failure error. **No data corruption, but the operation fails when it shouldn't.** The probability is low since most PubSub implementations return promises rather than throwing synchronously.

2. **UserService.deleteUserByUID false error** -- The user IS deleted from the database, but the error response could cause upstream code to behave as if deletion failed. In `AdminService.removeUserAccounts`, this could cause the deletion to be reported as failed in `UserDeletionResult` even though the user was actually deleted. The subsequent `revokeUserInvitations` step (line 510 of admin.service.ts) would still run for users that reported success. **Users whose deletion was falsely reported as failed would not have their invitations cleaned up.** This is a minor data consistency issue: orphaned invitation records for deleted users.

### Notification Loss Only (no data impact):

Everything else. The vast majority of PubSub usage (24 out of 28 call sites) is fire-and-forget. The pattern is:

```
// 1. Database operation (completes successfully)
const result = await this.prisma.someModel.create/update/delete(...);

// 2. Publish notification (fire-and-forget, failure is silent)
this.pubsub.publish(`topic`, data);

// 3. Return success
return E.right(result);
```

**What is lost**: Real-time GraphQL subscription notifications. Clients connected via WebSocket subscriptions would not receive push updates for the affected operation. The data is consistent in the database; the only impact is that other connected clients must manually refresh to see changes.

---

## Summary Table

| Category | Count | Call Sites |
|----------|-------|------------|
| **Fails completely (awaited, in try/catch)** | 3 | updateUserSessions, updateUserDisplayName, deleteUserByUID |
| **Fails completely (awaited, no try/catch)** | 1 | inviteUserToSignInViaEmail |
| **Risk of transaction rollback (inside $transaction)** | 2 | moveCollection (both branches) |
| **Degrades gracefully (fire-and-forget)** | 22 | All remaining pubsub calls |

| Risk Type | Scenarios |
|-----------|-----------|
| **Actual data loss** | None -- database writes always complete before pubsub |
| **Operation falsely reported as failed** | updateUserSessions, updateUserDisplayName, deleteUserByUID, inviteUserToSignInViaEmail |
| **Orphaned data from false failure** | Invitation records for deleted users not cleaned up (via removeUserAccounts path) |
| **Transaction rollback risk** | moveCollection if pubsub throws synchronously |
| **Real-time notification loss** | All 28 call sites -- subscribers miss live updates |
