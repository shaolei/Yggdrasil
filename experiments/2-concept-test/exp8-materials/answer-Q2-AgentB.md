# Q2 Answer (Agent B -- TeamInvitationService context only)

## End-to-End Flow: From Receiving a Team Invitation to Creating a First Collection

### What this context package covers

This answer is based solely on the context package for `TeamInvitationService`. It provides strong detail on steps 1 and 2 (invitation acceptance and team membership creation), partial information on steps 3-5 (collection creation, role constraints, and events), and essentially no direct information about the collection creation flow itself.

---

## 1. Invitation Acceptance Process

The invitation acceptance flow is well-documented in this context package. Here is the detailed sequence:

**Entry point:** `acceptInvitation(inviteID: string, acceptedBy: AuthUser): Promise<Either<string, TeamMember>>`

**Validation chain (in order):**

1. **Invitation existence check** -- The service looks up the invitation by `inviteID`. If not found, returns error `TEAM_INVITE_NO_INVITE_FOUND`.

2. **Email matching** -- The accepting user's email (`acceptedBy.email`) must match the invitation's `inviteeEmail`. This comparison is case-insensitive. If mismatched, returns error `TEAM_INVITE_EMAIL_DO_NOT_MATCH`. This prevents a different user from accepting someone else's invitation.

3. **Idempotency / race condition guard** -- Even at acceptance time, the service re-checks that the accepting user is not already a member of the target team. This guards against a race condition where the user might have been added between invitation creation and acceptance. If already a member, returns `TEAM_INVITE_ALREADY_MEMBER`.

**Upon successful validation:**

4. The service delegates to `TeamService.addMemberToTeam(teamID, uid, role)` to create the actual team membership (see step 2 below).

5. The invitation record is cleaned up -- the service revokes (deletes) the invitation after the user has been added to the team.

**Result:** Returns `Either<string, TeamMember>` -- on success, the newly created `TeamMember` record.

---

## 2. Team Membership Creation

This is handled by `TeamService.addMemberToTeam(teamID, uid, role)`, which the invitation service calls during acceptance.

**Key details from the TeamService dependency context:**

- `addMemberToTeam(teamID: string, uid: string, role: TeamAccessRole): Promise<TeamMember>` -- creates the membership record in the database.
- The role assigned to the new member is whatever `inviteeRole` was specified when the invitation was originally created. The three possible roles are: **OWNER**, **EDITOR**, or **VIEWER** (from the `TeamAccessRole` enum).
- After creating the membership, TeamService publishes a **`member_added`** PubSub event for real-time notification to connected clients.

**Important note on who sets the role:** The role is determined at invitation creation time, not acceptance time. The `createInvitation` method takes `inviteeRole: TeamAccessRole` as a parameter, and this role is stored on the invitation record. At acceptance, the stored role is passed through to `addMemberToTeam`.

---

## 3. Collection Creation

**This context package does not contain sufficient information to describe the collection creation flow.** The TeamInvitationService has no direct relationship to any collection service.

What can be inferred from surrounding context:

- **Collections are team-scoped.** From the `team-ownership` aspect: "TeamCollection.teamID -- collection belongs to team." Collections carry a `teamID` foreign key establishing ownership.
- **Collections form a tree hierarchy** (parent-child structure). From the global standards: "Collections form a tree hierarchy (parent-child). OrderIndex is integer-based for sibling ordering."
- **Cross-team isolation:** "There is no cross-team sharing. A collection, request, or environment belongs to exactly one team. Moving resources between teams is not supported."
- **Row locking for ordering:** "All mutations that affect sibling order use row locking via lockTeamCollectionByTeamAndParent."
- **PubSub events for collections** are published on channels like `team_coll/${teamID}/coll_added` when a new collection is created or imported.
- The `TeamCollectionService` exists (referenced in the `team-ownership` aspect) but is NOT a dependency of TeamInvitationService, so no interface or responsibility details are available here.

**Gap:** The actual `createCollection` method signature, its validation steps, and its exact flow are not available in this context package.

---

## 4. Role Constraints

Role information is well-covered across multiple aspects:

### At invitation creation time
- **Any team member** (regardless of role) can create an invitation. The service verifies the creator is a member but does NOT check the creator's specific role. From the constraints: "The service does not check the creator's role -- any member can invite."

### At invitation acceptance time
- No role check is performed on the accepting user -- they simply need to match the invitee email.
- The role assigned is whatever was specified at invitation creation time.

### For collection creation (inferred, not directly documented here)
- From the `role-based-access` aspect: "Most role-based access control (e.g., only OWNERs can delete a team, only EDITORs and above can modify collections) is implemented in GraphQL resolvers and NestJS guards, not in the services themselves."
- This implies that **only EDITORs and OWNERs can create/modify collections**, while VIEWERs cannot. However, the exact enforcement is in the resolver/guard layer, not the service layer.
- **Implication for the end-to-end flow:** If a user is invited as a VIEWER, they would join the team successfully but would NOT be able to create a collection. Only users invited as EDITOR or OWNER can proceed to create their first collection.

### Sole owner protection
- TeamService enforces that a team must always have at least one OWNER. This is relevant if the new member is added as OWNER (protects against demotion later), but not directly relevant to the invitation-to-collection flow.

---

## 5. Events Published

Events published across the documented flow:

### During invitation acceptance
1. **No specific "invitation accepted" event is explicitly documented** in this context, though the invitation revocation that occurs as cleanup during acceptance publishes its own event (see below).
2. **Invitation revocation event** -- When the invitation is cleaned up after acceptance, `revokeInvitation` publishes a PubSub event (the specific channel is not named in this context, but the responsibility doc says "Sends invitation emails and publishes PubSub events for invitation changes").

### During team membership creation
3. **`member_added`** -- Published by TeamService when `addMemberToTeam` completes. This enables real-time notification to other team members that a new member has joined.

### During collection creation (inferred)
4. **`team_coll/${teamID}/coll_added`** -- Published after a new collection is created (from the `pubsub-events` aspect). The payload is the full `TeamCollection` model. Events are published AFTER the database transaction commits successfully.

---

## Summary: End-to-End Flow (as far as this context can trace)

```
User receives invitation email
        |
        v
acceptInvitation(inviteID, acceptedBy)
        |
        +-- Validate: invitation exists
        +-- Validate: email matches (case-insensitive)
        +-- Validate: user not already a member
        |
        v
TeamService.addMemberToTeam(teamID, uid, inviteeRole)
        |
        +-- Creates TeamMember record in DB
        +-- Publishes "member_added" event
        |
        v
Invitation record is revoked/deleted
        |
        +-- Publishes invitation revocation event
        |
        v
User is now a team member with assigned role
        |
        v
[CONTEXT BOUNDARY -- below is inferred, not directly documented]
        |
        +-- If role is EDITOR or OWNER:
        |       User can create a collection via TeamCollectionService
        |       Collection is scoped to teamID
        |       "coll_added" event published
        |
        +-- If role is VIEWER:
                User CANNOT create collections (blocked at resolver/guard level)
```

### Key gaps in this single-node context
- The actual collection creation API and its full validation chain
- The exact PubSub channel names for invitation events
- How the invitation email is delivered and what link/action it contains for the user
- The UI/API flow the user follows between "accepting invitation" and "creating a collection"
