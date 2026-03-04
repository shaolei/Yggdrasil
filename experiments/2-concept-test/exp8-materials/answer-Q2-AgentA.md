# End-to-End Flow: Invitation Acceptance to First Collection Creation

## Overview

This answer traces the complete path a user follows from receiving a team invitation through to creating their first collection in that team within the Hoppscotch platform. The flow crosses four services (TeamInvitationService, TeamService, UserService, TeamCollectionService) and is governed by three cross-cutting aspects (role-based-access, team-ownership, pubsub-events).

---

## Phase 1: Invitation Acceptance

### Services involved

- **TeamInvitationService** (primary) -- orchestrates the acceptance workflow
- **TeamService** (delegate) -- performs the actual membership creation
- **UserService** (delegate) -- used during invitation creation for email lookup; indirectly relevant as the accepting user must be a registered user

### What happens step by step

1. **Precondition:** An invitation already exists. It was created earlier by a team member via `TeamInvitationService.createInvitation(creator, teamID, inviteeEmail, inviteeRole)`. During creation, the following validations were performed:
   - Email format validated (rejects `INVALID_EMAIL`)
   - Team existence verified via `TeamService.getTeamWithID` (rejects `TEAM_INVALID_ID`)
   - Creator verified as a team member via `TeamService.getTeamMember` (rejects `TEAM_MEMBER_NOT_FOUND`)
   - Invitee checked to not already be a member (rejects `TEAM_INVITE_ALREADY_MEMBER`)
   - No duplicate invitation for the same email+team (rejects `TEAM_INVITE_MEMBER_HAS_INVITE`)
   - An email was sent, and an `invite_added` PubSub event was published

2. **The user calls `acceptInvitation(inviteID, acceptedBy: AuthUser)`**. This is the entry point. The accepting user has received the invitation email and clicked the link.

3. **Validation chain within `acceptInvitation`:**
   - **Invitation existence check:** The invitation is looked up by ID. If not found, returns `TEAM_INVITE_NO_INVITE_FOUND`.
   - **Email matching:** The accepting user's email is compared (case-insensitive) against the invitation's `inviteeEmail`. If they do not match, returns `TEAM_INVITE_EMAIL_DO_NOT_MATCH`. This prevents one user from accepting another user's invitation.
   - **Already-member re-check (idempotency guard):** Even though this was checked at invitation creation time, the service re-verifies that the accepting user is not already a member of the team. This guards against race conditions where the user may have been added between invitation creation and acceptance. If already a member, returns `TEAM_INVITE_ALREADY_MEMBER`.

### Role constraints at this step

- **Invitation creation** requires the creator to be a team member of **any role** (OWNER, EDITOR, or VIEWER). The TeamInvitationService does not check specific role levels -- it only verifies membership. More granular role checks (e.g., restricting invitation creation to OWNERs or EDITORs) are enforced at the resolver/guard layer, not in the service.
- The invitation carries an `inviteeRole` (a `TeamAccessRole` value: OWNER, EDITOR, or VIEWER) that was specified at creation time. This role will be assigned to the new member upon acceptance.

### Events published

- At this point in the acceptance flow, no events have been published yet -- the events come in Phase 2 below, as part of the same `acceptInvitation` call.

---

## Phase 2: Team Membership Creation

### Services involved

- **TeamInvitationService** (orchestrator) -- still executing within `acceptInvitation`
- **TeamService** (delegate) -- performs `addMemberToTeam`

### What happens step by step

4. **TeamInvitationService delegates to `TeamService.addMemberToTeam(teamID, acceptedBy.uid, inviteeRole)`**. This is the core membership creation call.

5. **Inside `addMemberToTeam`:**
   - A `TeamMember` record is created in the database via Prisma, linking the user's UID to the team with the specified role (OWNER, EDITOR, or VIEWER, as carried by the invitation).
   - A **`member_added` PubSub event** is published immediately after the record is created. This notifies all connected clients (via GraphQL subscriptions) that a new member has joined.

6. **Back in `acceptInvitation`, the invitation is cleaned up:**
   - The invitation record is revoked (deleted) by calling the internal revocation logic.
   - An **`invite_removed` PubSub event** is published to notify clients that the pending invitation no longer exists.

7. **The method returns `Either.right(TeamMember)`** -- the newly created team member record with the assigned role.

### Role constraints at this step

- The new member receives exactly the role specified in the invitation (`inviteeRole`). There is no further role negotiation or validation at this point.
- TeamService does not enforce role-specific restrictions on the `addMemberToTeam` operation itself. It simply creates the membership record with whatever role is passed in.
- The sole-owner invariant is not relevant here since we are adding a member, not removing or demoting one.

### Events published (cumulative for Phases 1-2)

| Event | Channel/Pattern | Payload | When |
|---|---|---|---|
| `member_added` | PubSub team membership channel | Full `TeamMember` model | After membership record committed |
| `invite_removed` | PubSub invitation channel | Invitation details | After invitation record deleted |

---

## Phase 3: Collection Creation

### Services involved

- **TeamCollectionService** (primary) -- handles collection creation
- (Resolver/guard layer, not a service) -- handles authorization before the service call

### Prerequisites

Before the user can create a collection, the following must be true:
- The user must be an authenticated user (enforced by auth guards, outside service scope).
- The user must be a member of the target team (enforced at the resolver/guard level, which calls `TeamService.getTeamMember` or similar to verify membership).
- The user must have a role that permits collection modification. Per the role-based-access aspect: **only EDITORs and above (EDITOR or OWNER) can modify collections**. This is enforced at the GraphQL resolver and NestJS guard layer, not within `TeamCollectionService` itself. A VIEWER cannot create collections.

### What happens step by step

8. **The user calls the GraphQL mutation to create a collection.** The resolver layer:
   - Verifies the user is authenticated.
   - Verifies the user is a team member with at least EDITOR role for the target team.
   - If the user was invited with the VIEWER role, this operation would be **rejected by the guard** before reaching the service. The user would need their role upgraded to EDITOR or OWNER first.

9. **If authorized, the resolver calls `TeamCollectionService.createCollection(title, teamID, parentID?, data?)`.**

10. **Validation within `createCollection`:**
    - **Title minimum length:** The title must be at least 1 character (`TITLE_LENGTH = 1`). Empty titles are rejected with `TEAM_COLL_SHORT_TITLE`.
    - **Data field validation:** If the optional `data` field (collection metadata/headers) is provided, it must be valid JSON. Empty strings are explicitly rejected (not treated as null). Invalid JSON returns `TEAM_COLL_DATA_INVALID`.
    - **Parent validation (if parentID is provided):** If creating a subcollection under an existing parent, the parent collection must exist. If not found, returns `TEAM_INVALID_COLL_ID`.

11. **OrderIndex assignment within a pessimistic-locking transaction:**
    - A `prisma.$transaction` is opened.
    - `lockTeamCollectionByTeamAndParent(tx, teamID, parentID)` acquires a pessimistic row lock on all sibling collections under the target parent. This prevents concurrent creates from assigning duplicate orderIndex values.
    - The last (highest) orderIndex among existing siblings is determined.
    - The new collection is assigned `orderIndex = lastIndex + 1`, placing it at the end of the sibling list.
    - The collection record is created in the database with the `teamID`, `title`, `parentID` (null for root), `data`, and the computed `orderIndex`.
    - The transaction commits, releasing locks.

12. **PubSub event publication:**
    - After the transaction commits successfully, a **`team_coll/${teamID}/coll_added`** PubSub event is published.
    - The payload is the full `TeamCollection` model (cast from the DB record).
    - This notifies all connected team members' clients in real-time that a new collection exists.

13. **The method returns `Either.right(TeamCollection)`** -- the newly created collection.

### Role constraints at this step

- **OWNER:** Can create collections (authorized at guard level).
- **EDITOR:** Can create collections (authorized at guard level).
- **VIEWER:** Cannot create collections. The guard/resolver rejects the request before it reaches the service layer.

### Team ownership enforcement

- The new collection is stamped with the `teamID` passed to `createCollection`. Per the team-ownership aspect, `TeamCollection.teamID` is the foreign key that establishes team ownership.
- There is no cross-team collection creation -- the collection belongs to exactly one team.
- If a `parentID` is specified, the parent collection must also belong to the same team. The same-team constraint (`TEAM_COLL_NOT_SAME_TEAM`) is enforced on move operations, and at creation the teamID is set explicitly on the record.

### Events published

| Event | Channel/Pattern | Payload | When |
|---|---|---|---|
| `team_coll/${teamID}/coll_added` | PubSub collection channel | Full `TeamCollection` model | After transaction commits |

---

## Complete Event Timeline

Here is the full chronological sequence of events published across the entire flow:

| Step | Event | Published By | Channel/Pattern |
|---|---|---|---|
| 1 | `invite_added` | TeamInvitationService (at invitation creation time, prior to acceptance) | Invitation PubSub channel |
| 2 | `member_added` | TeamService (via addMemberToTeam, during acceptInvitation) | Team membership PubSub channel |
| 3 | `invite_removed` | TeamInvitationService (invitation cleanup, during acceptInvitation) | Invitation PubSub channel |
| 4 | `team_coll/${teamID}/coll_added` | TeamCollectionService (after createCollection transaction commits) | `team_coll/${teamID}/coll_added` |

All events are published AFTER the corresponding database transaction commits. This prevents phantom events where clients see updates that were rolled back.

---

## Role Constraint Summary Across All Steps

| Step | Required Role | Enforced By | Notes |
|---|---|---|---|
| Invitation creation | Any team member (OWNER, EDITOR, or VIEWER) | TeamInvitationService (service level) | Only checks membership, not specific role. Resolver/guards may impose stricter checks. |
| Invitation acceptance | N/A (invitee, not yet a member) | TeamInvitationService (email matching) | The accepting user's email must match the invitation's inviteeEmail. |
| Membership assigned role | Determined by invitation's `inviteeRole` | Set at invitation creation time | Could be OWNER, EDITOR, or VIEWER. |
| Collection creation | EDITOR or OWNER | Resolver/guard layer (not service level) | VIEWERs are rejected before the service is called. |

---

## Key Constraints and Guards Along the Path

1. **Email matching on acceptance:** The accepting user's email must match the invitation (case-insensitive). A different user cannot accept someone else's invitation (`TEAM_INVITE_EMAIL_DO_NOT_MATCH`).

2. **Race condition guard:** The acceptance re-checks that the user is not already a member, even though this was checked at invitation time. This prevents duplicates from concurrent operations.

3. **Sole-owner invariant:** Not directly relevant to this flow (we are adding a member, not removing one), but it is a background invariant that ensures every team always has at least one OWNER.

4. **Pessimistic locking on collection creation:** Prevents concurrent collection creations under the same parent from producing duplicate or gapped orderIndex values. Lock scope is `(teamID, parentID)`, so operations on different subtrees can proceed in parallel.

5. **VIEWER cannot create collections:** If the invitation specified the VIEWER role, the user would be able to join the team but would be blocked at the resolver/guard layer from creating collections. They would need a role upgrade (to EDITOR or OWNER) via `TeamService.updateTeamAccessRole` before they could create collections.

---

## Service Dependency Chain

```
User clicks "Accept Invitation"
  |
  v
TeamInvitationService.acceptInvitation(inviteID, acceptedBy)
  |-- validates invitation exists
  |-- validates email match (case-insensitive)
  |-- validates not already a member
  |-- calls TeamService.addMemberToTeam(teamID, uid, inviteeRole)
  |     |-- creates TeamMember DB record
  |     |-- publishes "member_added" event
  |     \-- returns TeamMember
  |-- revokes invitation (deletes DB record)
  |-- publishes "invite_removed" event
  \-- returns TeamMember

User creates first collection (some time later)
  |
  v
GraphQL Resolver / Guard layer
  |-- verifies authentication
  |-- verifies team membership
  |-- verifies role >= EDITOR
  |
  v
TeamCollectionService.createCollection(title, teamID, parentID?, data?)
  |-- validates title length >= 1
  |-- validates data is valid JSON (if provided)
  |-- opens transaction with pessimistic lock on (teamID, parentID)
  |     |-- determines lastIndex among siblings
  |     |-- creates TeamCollection record (orderIndex = lastIndex + 1)
  |     \-- commits transaction
  |-- publishes "team_coll/${teamID}/coll_added" event
  \-- returns TeamCollection
```
