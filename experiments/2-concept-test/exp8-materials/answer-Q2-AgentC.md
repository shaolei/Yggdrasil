# End-to-End Flow: Team Invitation to First Collection Creation

## Overview

This answer traces the complete path through four backend services -- `TeamInvitationService`, `TeamService`, `TeamCollectionService`, and `UserService` -- from the moment a user receives and accepts a team invitation through to creating their first collection in that team.

---

## 1. Invitation Acceptance

### Entry Point: `TeamInvitationService.acceptInvitation(inviteID, acceptedBy)`

**Services involved:** `TeamInvitationService`, `TeamService`, `UserService` (indirectly via earlier invitation creation)

**Validation sequence (three checks, all must pass):**

1. **Invitation existence check** -- Calls `this.getInvitation(inviteID)`, which queries `prisma.teamInvitation.findUniqueOrThrow({ where: { id: inviteID } })`. If the invitation does not exist, returns `E.left(TEAM_INVITE_NO_INVITE_FOUND)`.

2. **Already-a-member check** -- Calls `this.teamService.getTeamMember(invitation.value.teamID, acceptedBy.uid)`. This queries the `teamMember` table using the composite unique key `teamID_userUid`. If a membership record exists, returns `E.left(TEAM_INVITE_ALREADY_MEMBER)`.

3. **Email match check** -- Compares `acceptedBy.email.toLowerCase()` against `invitation.value.inviteeEmail.toLowerCase()`. This is a case-insensitive exact string comparison. If they do not match, returns `E.left(TEAM_INVITE_EMAIL_DO_NOT_MATCH)`. This prevents one authenticated user from accepting another user's invitation.

**Key point:** The `acceptedBy` parameter is of type `AuthUser`, meaning the user must already be authenticated. There is no check here that the user has any particular role -- any authenticated user whose email matches the invitation can accept it.

---

## 2. Team Membership Creation

### Delegation: `TeamService.addMemberToTeam(teamID, uid, role)`

Once all three validations pass, `acceptInvitation` calls `this.teamService.addMemberToTeam(invitation.value.teamID, acceptedBy.uid, invitation.value.inviteeRole)`.

**What happens inside `addMemberToTeam`:**

1. **Prisma insert** -- Creates a `teamMember` record:
   ```typescript
   this.prisma.teamMember.create({
     data: {
       userUid: uid,
       team: { connect: { id: teamID } },
       role: role,  // the inviteeRole from the invitation
     },
   })
   ```

2. **Model mapping** -- Maps the DB record to a `TeamMember` model with fields: `membershipID`, `userUid`, `role` (converted from DB enum via `TeamAccessRole[teamMember.role]`).

3. **Event published:** `team/${teamID}/member_added` with the `TeamMember` payload.

**Role assignment:** The new member gets exactly the role specified in the original invitation (`invitation.value.inviteeRole`). The `TeamAccessRole` enum includes `OWNER`, `EDITOR`, and `VIEWER`. The role was set by the invitation creator (who must themselves be a team member, validated during `createInvitation`).

**Error handling:** If `addMemberToTeam` throws (e.g., unique constraint violation from a race condition), `acceptInvitation` catches the error and returns `E.left(TEAM_INVITE_ALREADY_MEMBER)`.

### Post-Membership Cleanup

After successful membership creation, `acceptInvitation` calls `this.revokeInvitation(inviteID)`, which:

1. Deletes the `teamInvitation` record from the database.
2. Publishes event: `team/${invitation.value.teamID}/invite_removed` with the invitation ID.

### Return Value

`acceptInvitation` returns `E.right(teamMember)` -- the newly created `TeamMember` object.

---

## 3. Collection Creation

### Entry Point: `TeamCollectionService.createCollection(teamID, title, data, parentID)`

**Prerequisites:**

- The user must already be a team member (established in step 2).
- The service itself does NOT enforce role-based access control. There are no checks for `TeamAccessRole` within `createCollection`. Role authorization is expected to be enforced at the resolver/controller layer (GraphQL guards), not in this service method.

**Validation sequence:**

1. **Title length validation** -- `isValidLength(title, this.TITLE_LENGTH)` where `TITLE_LENGTH = 1`. The title must be at least 1 character. Failure returns `E.left(TEAM_COLL_SHORT_TITLE)`.

2. **Parent ownership check (if nested)** -- If `parentID` is not null, calls `this.isOwnerCheck(parentID, teamID)` which verifies the parent collection belongs to the specified team via `prisma.teamCollection.findFirstOrThrow({ where: { id: parentID, teamID } })`. Failure returns `E.left(TEAM_NOT_OWNER)`.

3. **Data validation (if provided)** -- If `data` is an empty string, returns `E.left(TEAM_COLL_DATA_INVALID)`. If `data` is non-null, it must be valid JSON (parsed via `stringToJson`). Invalid JSON returns `E.left(TEAM_COLL_DATA_INVALID)`.

### Ordering Mechanism

Collection creation uses a **transactional, ordered-index system**:

1. **Row locking** -- `this.prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` acquires a lock on sibling collections to prevent race conditions.

2. **Order index calculation** -- Queries the last collection under the same parent:
   ```typescript
   tx.teamCollection.findFirst({
     where: { teamID, parentID },
     orderBy: { orderIndex: 'desc' },
     select: { orderIndex: true },
   })
   ```
   The new collection gets `lastCollection.orderIndex + 1`, or `1` if no siblings exist.

3. **Record creation** -- Creates the collection with `title`, `teamID`, `parentID` (if applicable), `data` (if applicable), and the computed `orderIndex`.

The entire operation runs inside a `prisma.$transaction`. If the transaction fails (e.g., deadlock, conflict), it returns `E.left(TEAM_COLL_CREATION_FAILED)`.

### Event Published

On success: `team_coll/${teamID}/coll_added` with the cast `TeamCollection` payload (fields: `id`, `title`, `parentID`, `data`).

---

## 4. Role Constraints at Each Step

| Step | Role Constraint | Where Enforced |
|------|----------------|----------------|
| **Invitation creation** (`createInvitation`) | Creator must be a team member (any role) | `TeamInvitationService` -- checks `teamService.getTeamMember(team.id, creator.uid)` |
| **Invitation acceptance** (`acceptInvitation`) | No role required -- only email match against invitation | `TeamInvitationService` -- email comparison |
| **Role assigned on join** | Determined by `inviteeRole` field on the invitation | Set at invitation creation time; passed through to `addMemberToTeam` |
| **Collection creation** (`createCollection`) | **No role check in the service layer** | Expected to be enforced by GraphQL resolver guards (not visible in the service code) |
| **CLI collection access** (`getCollectionForCLI`) | Must be a team member (any role) | `TeamCollectionService` -- checks `teamService.getTeamMember(collection.teamID, userUid)` |

Notable: The `TeamCollectionService.createCollection` method accepts a `teamID` but does NOT accept a `userUid` parameter and does NOT verify team membership or role. The authorization boundary is entirely at the API layer above the service.

---

## 5. Events Published (Complete Sequence)

The following PubSub events are published in chronological order during this flow:

| Order | Event Topic | Payload | Published By |
|-------|------------|---------|-------------|
| 1 | `team/${teamID}/invite_added` | `TeamInvitation` object | `TeamInvitationService.createInvitation` (when the invitation was originally created) |
| 2 | `team/${teamID}/member_added` | `TeamMember` { membershipID, userUid, role } | `TeamService.addMemberToTeam` (during acceptance) |
| 3 | `team/${teamID}/invite_removed` | Invitation ID (string) | `TeamInvitationService.revokeInvitation` (cleanup after acceptance) |
| 4 | `team_coll/${teamID}/coll_added` | `TeamCollection` { id, title, parentID, data } | `TeamCollectionService.createCollection` |

Additionally, when the invitation was originally created, `MailerService.sendEmail` was called with template `team-invitation` containing an `action_url` pointing to `${VITE_BASE_URL}/join-team?id=${inviteID}`.

---

## Summary: Complete Sequence Diagram

```
User receives email with join-team link
  |
  v
acceptInvitation(inviteID, authenticatedUser)
  |-- Validate invitation exists (DB lookup)
  |-- Validate user is not already a member (TeamService.getTeamMember)
  |-- Validate user email matches invitation email (case-insensitive)
  |
  v
TeamService.addMemberToTeam(teamID, uid, inviteeRole)
  |-- INSERT into teamMember table with role from invitation
  |-- PUBLISH: team/${teamID}/member_added
  |
  v
revokeInvitation(inviteID)
  |-- DELETE invitation from DB
  |-- PUBLISH: team/${teamID}/invite_removed
  |
  v
Return TeamMember to caller
  |
  v
[User is now a team member with assigned role]
  |
  v
createCollection(teamID, title, data?, parentID?)
  |-- Validate title length >= 1
  |-- If parentID: validate parent belongs to team
  |-- If data: validate JSON
  |-- BEGIN TRANSACTION
  |    |-- Lock sibling rows
  |    |-- Find max orderIndex among siblings
  |    |-- INSERT collection with orderIndex = max + 1 (or 1 if first)
  |-- END TRANSACTION
  |-- PUBLISH: team_coll/${teamID}/coll_added
  |
  v
Return TeamCollection { id, title, parentID, data }
```

**Critical architectural observation:** The `createCollection` service method has no authentication or authorization logic. It trusts that the caller (resolver/controller) has already verified the user is a team member with sufficient permissions (likely OWNER or EDITOR). A VIEWER role would presumably be blocked at the resolver layer, but this constraint is invisible from the service code alone.
