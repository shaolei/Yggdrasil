# Q5: PubSub System Failure Impact Analysis

## 1. Every Service That Publishes PubSub Events

Based on the graph tree and context packages, the following services have the `pubsub-events` aspect and publish PubSub events:

| Service | Aspect Confirmation | Event Types Published |
|---|---|---|
| **TeamCollectionService** | `pubsub-events` (own + hierarchy) | `coll_added`, `coll_updated`, `coll_removed`, `coll_moved`, `coll_order_updated` |
| **TeamRequestService** | `pubsub-events` (own + hierarchy) | `req_created`, `req_updated`, `req_deleted`, `req_moved`, `req_order_updated` |
| **TeamService** | `pubsub-events` (own + hierarchy) | `member_added`, `member_updated`, `member_removed` |
| **TeamInvitationService** | `pubsub-events` (own + hierarchy) | Invitation created, revoked events |
| **TeamEnvironmentsService** | `pubsub-events` (own + hierarchy) | Environment `created`, `updated`, `deleted` events |
| **UserService** | `pubsub-events` (own + hierarchy) | `user/{uid}/deleted`, user session updated, display name updated events |
| **AdminService** | `pubsub-events` (hierarchy) | Infra invitation events (via `inviteUserToSignInViaEmail`) |

**AuthService** does **not** have the `pubsub-events` aspect and does not publish PubSub events.

## 2. Publish Timing: INSIDE vs AFTER the Database Transaction

The PubSub Events aspect explicitly documents the timing rule:

> "Events are published AFTER the database transaction commits successfully. This prevents phantom events where the client sees an update but the transaction rolled back."

This is the system-wide pattern. Specific analysis per service:

| Service | Publish Timing | Evidence |
|---|---|---|
| **TeamCollectionService** | **AFTER** transaction commit | Aspect states explicitly. The one noted exception is `deleteCollectionAndUpdateSiblingsOrderIndex` where the PubSub call happens after the retry loop succeeds -- still after the DB work completes. |
| **TeamRequestService** | **AFTER** transaction commit | Same aspect applies. All mutations (create, update, delete, move, sort) use pessimistic locking transactions, then publish. |
| **TeamService** | **AFTER** DB write | `addMemberToTeam` creates membership then publishes event. `leaveTeam` and `updateTeamAccessRole` do DB work first. No transactional wrapping is documented for the membership mutations themselves (they are single-row operations), but the publish is still after the write. |
| **TeamInvitationService** | **AFTER** DB write | `createInvitation` creates the record, sends email, then publishes event. `revokeInvitation` deletes the record then publishes. |
| **TeamEnvironmentsService** | **AFTER** DB write | Mutations (create, update, delete, clear variables, duplicate) perform the DB operation then publish. |
| **UserService** | **AFTER** DB write | `deleteUserByUID` deletes the user then publishes `user/{uid}/deleted`. `updateUserSessions` and `updateUserDisplayName` update then publish. |
| **AdminService** | **AFTER** DB write | `inviteUserToSignInViaEmail` records the invitation in DB then publishes event. |

**Critical finding: ALL services publish PubSub events AFTER the database transaction/write succeeds. No service publishes INSIDE an open transaction.**

## 3. Classification: Operation Failure vs Graceful Degradation

Because every service publishes **after** the database transaction commits, a PubSub failure will **never cause the core database operation to fail**. The database state is already committed. The question then becomes: does the service code handle a PubSub publish failure gracefully (catch and continue), or does it let the error propagate and cause the API call to return an error to the client?

Based on the architecture (NestJS + PubSub, where `pubSub.publish()` is typically a fire-and-forget call on an in-process or Redis-backed pub/sub system), and the fact that the context packages describe PubSub as a notification mechanism (not a transactional participant), the expected behavior is:

### Operations that DEGRADE GRACEFULLY (database succeeds, notification lost):

**All operations across all services** fall into this category because PubSub publishes happen after successful DB commits. The database mutation has already succeeded. Even if the PubSub publish throws, the data is persisted.

However, there is a nuance: if the PubSub publish call throws an unhandled exception after the DB commit, it could cause the API to return a 500 error to the client **even though the data was actually written**. This creates a misleading failure: the user sees an error, but the data change was actually persisted.

Specifically for each service:

| Service | Operation | DB State on PubSub Failure | Risk |
|---|---|---|---|
| **TeamCollectionService** | Create, rename, update, delete, move, reorder, sort, import, duplicate | **Committed** | Notification loss. Client UI stale. |
| **TeamRequestService** | Create, update, delete, move, sort | **Committed** | Notification loss. Client UI stale. |
| **TeamService** | Add member, leave team, update role | **Committed** | Notification loss. Member list stale on other clients. |
| **TeamInvitationService** | Create invitation, revoke invitation | **Committed** | Notification loss. Invitation list stale on other clients. |
| **TeamEnvironmentsService** | Create, update, delete, clear variables, duplicate | **Committed** | Notification loss. Environment list stale on other clients. |
| **UserService** | Update sessions, update display name, delete user | **Committed** | Notification loss. Other tabs/clients not notified. |
| **AdminService** | Invite user to sign in | **Committed** | Notification loss. Admin panel not updated in real time. |

### No operations FAIL COMPLETELY due to PubSub outage:

No operation has its database transaction coupled to PubSub success. The "AFTER transaction commit" pattern universally decouples data persistence from event publishing.

## 4. User-Visible Symptoms Per Service

### TeamCollectionService
- **Symptom:** When User A creates, renames, deletes, moves, or reorders a collection, other team members with open browsers will NOT see the change in real time. Their UI remains stale until they manually refresh.
- **Impact:** Drag-and-drop reordering, new collection appearance, and deletion disappearance all fail to propagate live.
- **Severity:** Medium-High for collaborative teams. Users may make conflicting edits not knowing another user already changed the structure.

### TeamRequestService
- **Symptom:** When User A creates, edits, deletes, or reorders a request within a collection, other team members do not see the update live. The request list appears frozen to other users.
- **Impact:** Concurrent editing becomes dangerous -- two users might edit the same request without seeing each other's changes.
- **Severity:** Medium-High.

### TeamService
- **Symptom:** When a member is added, removed, or has their role changed, other members viewing the team member list do not see the change. A member who was just removed might still appear to have access in another user's UI.
- **Impact:** Role changes (e.g., demoting someone from OWNER to VIEWER) do not reflect immediately for other admins/owners monitoring the team.
- **Severity:** Medium. The database is authoritative, so actual access is correct -- only the displayed state is stale.

### TeamInvitationService
- **Symptom:** When an invitation is created or revoked, the invitation list in the team management UI does not update for other administrators viewing it. Duplicate invitations might appear to be sent because the UI doesn't reflect the first one.
- **Impact:** Low. Invitations are email-based; the email still gets sent regardless of PubSub.
- **Severity:** Low.

### TeamEnvironmentsService
- **Symptom:** When environments are created, updated, deleted, or their variables cleared, other team members do not see the change. Users might run requests with outdated environment variables.
- **Impact:** Medium. Using stale environment variables could cause API requests to fail or hit wrong endpoints.
- **Severity:** Medium.

### UserService
- **Symptom:** Session updates and display name changes do not propagate to other open tabs or clients. User deletion events are not broadcast, so services relying on the `user/{uid}/deleted` event for cache invalidation may serve stale data.
- **Impact:** Stale user profiles in UI. Multi-tab session synchronization breaks.
- **Severity:** Low-Medium.

### AdminService
- **Symptom:** The admin panel does not update in real time when invitations are sent. Other admins viewing the panel do not see new infra-level invitations.
- **Impact:** Minimal. Admin operations are infrequent and typically performed by a single admin.
- **Severity:** Low.

## 5. Data Loss Risk vs Notification Loss

### There is NO data loss risk.

Every service writes to the PostgreSQL database via Prisma **before** attempting to publish PubSub events. The database transaction is the system of record, and it commits independently of PubSub. Even if PubSub is completely down:

- All collections, requests, environments, invitations, team memberships, and user records are correctly persisted.
- All orderIndex values are correctly maintained (pessimistic locking ensures this at the DB level, independent of PubSub).
- All business invariants (sole owner protection, circular reference prevention, etc.) are enforced at the database transaction level.

### The risk is NOTIFICATION LOSS only.

What is lost:
- **Real-time updates** to connected GraphQL subscription clients
- **Live UI synchronization** between team members
- **Multi-tab awareness** for individual users (session/profile events)

What is NOT lost:
- The actual data mutations (all persisted in PostgreSQL)
- Business rule enforcement (all checked before commit)
- Email notifications (TeamInvitationService sends emails independently of PubSub)

### Potential misleading error risk:

If the PubSub publish call throws an **unhandled** exception after the DB commit succeeds, the NestJS framework might return a 500 error to the calling client. The user would see "operation failed" even though the data was actually written. On retry, they might see errors like "duplicate" or "already exists." This is not data loss but is a **user experience** risk that could cause confusion and unnecessary retry attempts.

## 6. Critical Operations to Keep Working During PubSub Outage

Ranked by business criticality:

### Tier 1 -- Must keep working (and they DO keep working)
1. **TeamCollectionService mutations** (create, delete, move, reorder) -- These are the core collaborative operations. The pessimistic locking and transaction integrity ensure data consistency even without PubSub. Users just need to refresh manually.
2. **TeamRequestService mutations** (create, update, delete, move) -- API request management is the primary user workflow. Data integrity is maintained by DB transactions.
3. **TeamService membership operations** (add member, leave, role changes) -- Access control mutations must persist correctly. They do, because enforcement is at the DB level.

### Tier 2 -- Important but less frequent
4. **TeamEnvironmentsService mutations** -- Environment changes affect API testing accuracy but are less frequent than collection/request operations.
5. **UserService deletion cascade** -- User deletion is a critical administrative operation. The `user/{uid}/deleted` event is used for downstream notification, but the actual deletion and handler cascade (via UserDataHandler pattern) is synchronous and database-driven, not PubSub-driven.

### Tier 3 -- Low urgency during outage
6. **TeamInvitationService operations** -- Invitations are asynchronous by nature (email-based). PubSub loss only affects real-time UI updates in the team management panel.
7. **AdminService operations** -- Administrative operations are infrequent and typically do not require real-time collaboration.
8. **AuthService operations** -- AuthService does not use PubSub at all, so it is completely unaffected.

## Summary

| Dimension | Assessment |
|---|---|
| Operations that fail completely | **None** -- all DB operations are decoupled from PubSub |
| Operations that degrade gracefully | **All mutation operations across all 7 PubSub-enabled services** |
| Data at risk | **None** -- all data is committed to PostgreSQL before PubSub publish |
| Notification at risk | **All real-time GraphQL subscription updates** across all services |
| Primary user impact | Stale UIs requiring manual refresh; potential false "operation failed" errors if PubSub throws unhandled exceptions post-commit |
| Most critical operations | Collection and request mutations (core collaboration workflow) -- these continue to work correctly at the data level |
