# Impact Analysis: Changing `getTeamMember` in TeamService

## Question

"If I change the team membership check in TeamService (the `getTeamMember` method), what breaks in TeamCollectionService and other modules?"

## Current Method Signature

```typescript
getTeamMember(teamID: string, userUid: string): Promise<TeamMember | null>
```

Returns `TeamMember` if the user is a member of the team, `null` if not. There is also an fp-ts variant:

```typescript
getTeamMemberTE(teamID: string, userUid: string): TaskEither<string, TeamMember>
```

Which returns `Either.left('TEAM_MEMBER_NOT_FOUND')` on failure.

---

## 1. Services That Directly Consume `getTeamMember`

Based on the graph relation declarations (`consumes` in `node.yaml`):

| Service | Declared Dependency | Consumed Methods |
|---|---|---|
| **TeamCollectionService** | `calls team/team-service` | `getTeamMember` |
| **TeamEnvironmentsService** | `calls team/team-service` | `getTeamMember` |
| **TeamInvitationService** | `calls team/team-service` | `getTeamWithID, getTeamMember, addMemberToTeam` |

Additionally, **AdminService** consumes the fp-ts variant `getTeamMemberTE` (not `getTeamMember` directly), which is a thin wrapper around `getTeamMember` within TeamService itself.

**AuthService** and **TeamRequestService** do NOT consume `getTeamMember`. TeamRequestService only consumes `getTeamWithID` from TeamService.

---

## 2. What Each Consumer Uses the Result For

### TeamCollectionService

**Purpose:** CLI access membership gating.

The `getCollectionForCLI(collectionID, userUid)` method calls `getTeamMember` to verify the requesting user is a member of the team that owns the collection. The flow is:

1. Resolve the collection's team via its `teamID`
2. Call `getTeamMember(teamID, userUid)` to check membership
3. If `null` is returned, reject with `TEAM_MEMBER_NOT_FOUND`
4. If a `TeamMember` is returned, the user is authorized and the collection data is returned

The TeamCollectionService only cares about the **presence/absence** of the result (null check). It does not inspect properties of the `TeamMember` object (role, etc.) -- role enforcement is handled at the resolver/guard level.

### TeamEnvironmentsService

**Purpose:** CLI access membership gating.

The `getTeamEnvironmentForCLI(id, userUid)` method calls `getTeamMember` to verify the requesting user is a member of the environment's team. The flow is:

1. Look up the environment by ID to get its `teamID`
2. Call `getTeamMember(teamID, userUid)` to check membership
3. If `null`, reject with `TEAM_MEMBER_NOT_FOUND`
4. If present, return the environment data

Like TeamCollectionService, this is a pure **existence check** -- the `TeamMember` object's properties are not inspected.

### TeamInvitationService

**Purpose:** Invitation creator authorization and invitee pre-check.

Used in two distinct contexts:

1. **Creator validation during `createInvitation`:** Calls `getTeamMember(teamID, creator.uid)` to verify the invitation creator is a member of the target team. If `null`, rejects with `TEAM_MEMBER_NOT_FOUND`. Per the role-based-access aspect, "TeamInvitationService verifies that the invitation creator is a team member (any role). Does not check specific role levels for invitation creation." So this is an **existence check only**.

2. **Already-member guard during `createInvitation` and `acceptInvitation`:** After resolving the invitee by email to a user, calls `getTeamMember(teamID, inviteeUser.uid)` to check if they are already a team member. If the result is non-null, rejects with `TEAM_INVITE_ALREADY_MEMBER`. This is an **inverse existence check** -- the presence of a result is the error condition.

### AdminService (indirect via `getTeamMemberTE`)

**Purpose:** Already-member guard for admin-driven team additions.

AdminService consumes `getTeamMemberTE` (the fp-ts TaskEither wrapper), not `getTeamMember` directly. However, `getTeamMemberTE` internally delegates to `getTeamMember`. AdminService uses it in `addUserToTeam` to check if a user is already a member before attempting to add them -- if the TaskEither resolves to Right (member found), it returns `TEAM_INVITE_ALREADY_MEMBER`.

---

## 3. What Would Break if the Method Changed

### A. Signature Change (parameters)

**Adding a parameter:**
All three direct callers (TeamCollectionService, TeamEnvironmentsService, TeamInvitationService) and the internal `getTeamMemberTE` wrapper would fail to compile. Every call site passes exactly `(teamID, userUid)`.

**Removing a parameter:**
Same compilation failure. If `userUid` were removed, no caller could express "is this specific user a member."

**Renaming parameters or the method itself:**
All three services import and call `this.teamService.getTeamMember(...)`. Any rename would cause immediate compilation errors across all consumers.

### B. Return Type Change

**Changing from `Promise<TeamMember | null>` to `Promise<TeamMember>` (throwing on not-found):**
- TeamCollectionService and TeamEnvironmentsService would need try/catch instead of null checks. Currently they branch on `null` to produce `TEAM_MEMBER_NOT_FOUND`.
- TeamInvitationService's already-member check would break -- it currently treats non-null as "already a member." If not-found throws, the inverse logic breaks entirely.

**Changing from `Promise<TeamMember | null>` to fp-ts `TaskEither<string, TeamMember>`:**
- All three callers use `await` + null-check pattern. They would need to switch to fp-ts pipe/chain/fold.
- The `getTeamMemberTE` wrapper would become redundant or need reworking.

**Changing the `TeamMember` shape (e.g., removing `userUid` or `role` field):**
- Direct callers currently only check for null/non-null, so they would not break on field removal.
- However, AdminService's `addUserToTeam` flow and TeamInvitationService's `acceptInvitation` pass the membership result downstream or use it in subsequent operations (e.g., TeamInvitationService uses the member result from `addMemberToTeam` as the return value of `acceptInvitation`). If the `TeamMember` shape changed, downstream GraphQL resolvers that serialize the result would break.

**Returning an empty object `{}` instead of `null` for not-found:**
- All callers check `=== null` or truthiness. An empty object is truthy, so all callers would incorrectly conclude the user IS a member when they are not. This would silently break authorization:
  - TeamCollectionService CLI: would allow non-members to access collections
  - TeamEnvironmentsService CLI: would allow non-members to access environments
  - TeamInvitationService: would block all invitations because every invitee would appear to be "already a member"

### C. Behavior Change

**Returning membership even for deleted/deactivated users:**
- Currently, `getTeamMember` performs a direct Prisma lookup on the `TeamMember` table. If the behavior changed to also return members whose user accounts have been deleted (orphan records), TeamCollectionService and TeamEnvironmentsService would grant CLI access to phantom users. TeamInvitationService would block invitations to users who have been deleted.

**Adding role-based filtering (e.g., only returning members with EDITOR+ role):**
- TeamInvitationService's already-member guard would become incomplete: VIEWERs would not be detected as existing members, allowing duplicate memberships.
- TeamInvitationService's creator validation would reject VIEWERs from creating invitations, changing the current behavior where any role can invite.
- TeamCollectionService and TeamEnvironmentsService CLI access would reject VIEWERs, breaking read-only CLI access.

**Adding team-existence validation (returning error if team does not exist):**
- Callers currently handle `null` uniformly (user not a member). A new error path for "team not found" would not be caught, potentially surfacing as unhandled errors or confusing `TEAM_MEMBER_NOT_FOUND` responses when the real issue is an invalid team ID.

---

## 4. Indirect and Cascading Effects

### Through `getTeamMemberTE` (fp-ts wrapper)

`getTeamMemberTE` wraps `getTeamMember` and is consumed by:
- **AdminService** for the already-member check in `addUserToTeam`

Any change to `getTeamMember` cascades through `getTeamMemberTE` to AdminService. Since `getTeamMemberTE` maps `null` to `Either.left('TEAM_MEMBER_NOT_FOUND')` and non-null to `Either.right(teamMember)`, a return type change in `getTeamMember` would break this mapping logic.

### Through the Team Member Lifecycle Flow

The `team-member-lifecycle` flow documents six paths that involve membership checks:

1. **Invite and Accept path:** TeamInvitationService uses `getTeamMember` at step 2 (creator validation) and step 5 (already-member re-check). If `getTeamMember` behavior changes, the invitation accept flow could allow duplicate members or block legitimate invitations.

2. **Admin direct addition path:** AdminService uses `getTeamMemberTE` (wrapping `getTeamMember`) to check if the user is already a member before adding. A behavior change could allow duplicate members.

3. **User account deletion path:** While TeamService's `canAllowUserDeletion` does not call `getTeamMember` directly (it queries memberships differently), the overall integrity of the membership model is shared.

### Through the Team Ownership Aspect

The `team-ownership` aspect documents that TeamEnvironmentsService and TeamInvitationService use membership verification as their team-ownership enforcement mechanism. If `getTeamMember` becomes unreliable:
- **Cross-team isolation breaks:** Non-members could access environments or create invitations for teams they don't belong to.
- **The team-ownership invariant is violated** for the CLI access paths of both TeamCollectionService and TeamEnvironmentsService.

### Through the Role-Based Access Aspect

The `role-based-access` aspect notes that TeamInvitationService "verifies that the invitation creator is a team member (any role)" using `getTeamMember`. If the method starts filtering by role or changes what constitutes a "valid member," invitation creation access control changes silently.

### Resolver/Guard Layer (Outside Graph but Affected)

The context packages note that "most role-based access control is implemented in GraphQL resolvers and NestJS guards, not in the services themselves." Resolvers likely call `getTeamMember` or `getRoleOfUserInTeam` to check permissions. While resolvers are not modeled as nodes in the graph, changing `getTeamMember` could break:
- GraphQL mutation resolvers that gate operations on team membership
- NestJS guards that verify team access before allowing requests through

---

## Summary Table

| Affected Service | Call Path | What It Uses `getTeamMember` For | Break Severity |
|---|---|---|---|
| **TeamCollectionService** | Direct call | CLI collection access gating (null check) | HIGH -- non-members access collections |
| **TeamEnvironmentsService** | Direct call | CLI environment access gating (null check) | HIGH -- non-members access environments |
| **TeamInvitationService** | Direct call | Creator auth + already-member guard (null/non-null) | HIGH -- invitation system breaks in both directions |
| **AdminService** | Via `getTeamMemberTE` | Already-member guard for admin team additions | MEDIUM -- duplicate memberships possible |
| **GraphQL resolvers/guards** | Likely direct (not in graph) | Role-based access enforcement | HIGH -- authorization bypass |
| **Team Member Lifecycle flow** | Transitive | Integrity of invite-accept, admin-add, leave paths | HIGH -- flow invariants violated |

The method is a **critical junction point** in the authorization layer. Any change to its signature, return type, or behavior has the potential to silently break security-relevant access checks across the entire collaborative workspace system.
