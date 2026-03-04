# Team Member Lifecycle

## Business context

Hoppscotch teams are collaborative workspaces where users share collections, requests, and environments. Users become team members through invitations or direct admin additions. Members have roles (OWNER, EDITOR, VIEWER) that determine their access level. Members can leave, be removed, or have their roles changed. The lifecycle must maintain invariants such as "every team has at least one OWNER."

## Trigger

A team member invites someone by email, an admin adds a user directly, a member leaves, an admin removes a member, or a user account is deleted.

## Goal

Manage the complete lifecycle of team membership from entry to exit, ensuring role invariants are maintained and all participants are notified in real-time.

## Participants

- **team-invitation/team-invitation-service** -- Manages the invitation workflow: create invitations with validation, send emails, accept (which triggers member addition), and revoke.
- **team/team-service** -- Core membership operations: add member, remove member, update role. Enforces sole-owner protection. Implements UserDataHandler to block deletion of sole owners and clean up memberships on user deletion.
- **user/user-service** -- Provides user lookup by email/ID for invitation validation and member addition. Orchestrates user deletion by collecting approval from all UserDataHandler implementations (including TeamService).
- **admin/admin-service** -- Orchestrates privileged member operations: add user to team (with invitation cleanup), remove user from team, change role, and bulk user deletion (which cascades to team membership cleanup).

## Paths

### Invite and accept

1. Team member creates an invitation via TeamInvitationService.createInvitation
2. Service validates: email format, team exists, creator is a member, invitee not already a member, no duplicate invitation
3. Invitation record is created, email is sent, `invite_added` event published
4. Invitee clicks the email link and calls acceptInvitation
5. Service verifies: invitation exists, accepting user's email matches invitee email, user not already a member
6. TeamService.addMemberToTeam creates the membership with the invited role
7. `member_added` event published, invitation is revoked, `invite_removed` event published

### Admin direct addition

1. Admin calls AdminService.addUserToTeam with teamID, userEmail, and role
2. Service validates email, finds user, checks they are not already a member
3. TeamService.addMemberToTeamWithEmail creates the membership
4. If an existing invitation exists for that email and team, it is automatically revoked
5. `member_added` event published

### Role change

1. Admin or authorized user calls TeamService.updateTeamAccessRole
2. Service counts current OWNERs in the team
3. If changing the last OWNER to a non-OWNER role, operation is rejected with `TEAM_ONLY_ONE_OWNER`
4. Otherwise, membership record is updated
5. `member_updated` event published

### Member leaves

1. Member calls TeamService.leaveTeam
2. Service counts current OWNERs
3. If member is the last OWNER, operation is rejected with `TEAM_ONLY_ONE_OWNER`
4. Otherwise, membership record is deleted
5. `member_removed` event published

### Admin removes member

1. Admin calls AdminService.removeUserFromTeam
2. Delegates to TeamService.leaveTeam (same sole-owner protection applies)
3. `member_removed` event published

### User account deletion

1. Deletion initiator calls UserService.deleteUserByUID
2. UserService collects errors from all registered UserDataHandler implementations
3. TeamService.canAllowUserDeletion checks if user is sole owner of any team -- if so, returns error to block deletion
4. If all handlers approve, TeamService.onUserDelete calls deleteUserFromAllTeams (leaves each team)
5. `member_removed` events published for each team left
6. User account is deleted from database
7. `user/{uid}/deleted` event published

## Invariants across all paths

- Every team must have at least one member with the OWNER role at all times
- A user cannot be added to a team they already belong to
- An invitation can only be accepted by the user whose email matches the invitation
- All membership mutations publish PubSub events for real-time UI updates
- All business errors return fp-ts Either.left, never throw
- Admin users cannot be deleted without first removing their admin status

---

name: Team Member Lifecycle
aspects: [role-based-access, pubsub-events]

participants:
  - node: team-invitation/team-invitation-service
    role: Manages the invitation workflow from creation through acceptance or revocation
  - node: team/team-service
    role: Handles membership CRUD, role management, and sole-owner enforcement
  - node: user/user-service
    role: Provides user lookup and coordinates user deletion across team memberships
  - node: admin/admin-service
    role: Orchestrates admin-level team member additions, removals, and role changes
