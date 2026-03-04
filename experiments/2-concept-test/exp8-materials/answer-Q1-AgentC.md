# Impact Analysis: Changing `TeamService.getTeamMember`

## Current Method Signature and Return Type

```typescript
// file: /workspaces/hoppscotch/packages/hoppscotch-backend/src/team/team.service.ts (line 350)
async getTeamMember(
  teamID: string,
  userUid: string,
): Promise<TeamMember | null>
```

Returns a `TeamMember` object (`{ membershipID: string, userUid: string, role: TeamAccessRole }`) or `null` if the user is not a member or an error occurs. This method also has a functional wrapper:

```typescript
// line 376
getTeamMemberTE(teamID: string, userUid: string): TaskEither<'team/member_not_found', TeamMember>
```

which delegates to `getTeamMember` internally (line 378).

---

## 1. Services and Modules That Directly Call `getTeamMember`

### Within TeamService itself (internal callers):

| Caller | File & Line | Usage |
|--------|------------|-------|
| `leaveTeam` | team.service.ts:216 | Checks if user is a team member before allowing them to leave; reads `member.role` to enforce sole-owner constraint |
| `getTeamMemberTE` | team.service.ts:376-387 | Wraps `getTeamMember` into an fp-ts `TaskEither`; used by `AdminService.addUserToTeam` |
| `getRoleOfUserInTeam` | team.service.ts:389-395 | Calls `getTeamMember`, returns `teamMember.role` or `null`; used by `team.resolver.ts` for the `myRole` GQL field |

### TeamCollectionService:

| Caller | File & Line | Usage |
|--------|------------|-------|
| `getCollectionForCLI` | team-collection.service.ts:1444 | Authorization gate for CLI access: checks the user is a team member before returning collection tree. If `null`, returns `E.left(TEAM_MEMBER_NOT_FOUND)`. |

### TeamInvitationService:

| Caller | File & Line | Usage |
|--------|------------|-------|
| `createInvitation` (creator check) | team-invitation.service.ts:117 | Verifies the invitation creator is a team member. If `null`, returns `E.left(TEAM_MEMBER_NOT_FOUND)`. |
| `createInvitation` (invitee duplicate check) | team-invitation.service.ts:127 | Checks if invitee is already a team member. If truthy, returns `E.left(TEAM_INVITE_ALREADY_MEMBER)`. |
| `acceptInvitation` | team-invitation.service.ts:205 | Checks if the accepting user is already a team member. If truthy, returns `E.left(TEAM_INVITE_ALREADY_MEMBER)`. |

### TeamEnvironmentsService:

| Caller | File & Line | Usage |
|--------|------------|-------|
| `getTeamEnvironmentForCLI` | team-environments.service.ts:267 | Authorization gate for CLI access: checks the user is a team member before returning environment data. If `null`, returns `E.left(TEAM_MEMBER_NOT_FOUND)`. |

### AdminService (indirect via `getTeamMemberTE`):

| Caller | File & Line | Usage |
|--------|------------|-------|
| `addUserToTeam` | admin.service.ts:351 | Uses `getTeamMemberTE` to check if the user is already a member before adding them. If `E.isLeft` (member not found), proceeds to add; if member found, returns `E.left(TEAM_INVITE_ALREADY_MEMBER)`. |

### Guards (authorization layer -- outside the 7 listed service files but directly calling `getTeamMember`):

| Guard | File | Usage |
|-------|------|-------|
| `GqlTeamMemberGuard` | team/guards/gql-team-member.guard.ts:37 | Checks membership and role for GQL operations scoped to a team. Reads `teamMember.role` against required roles. |
| `RESTTeamMemberGuard` | team/guards/rest-team-member.guard.ts:39 | Same as above for REST endpoints. Reads `teamMember.role`. |
| `GqlCollectionTeamMemberGuard` | team-collection/guards/gql-collection-team-member.guard.ts:43 | Checks membership via collection's teamID. Reads `member.role`. |
| `GqlRequestTeamMemberGuard` | team-request/guards/gql-request-team-member.guard.ts:43 | Checks membership via request's team. Reads `member.role`. |
| `GqlTeamEnvTeamGuard` | team-environments/gql-team-env-team.guard.ts:49 | Checks membership via environment's teamID. Reads `member.role`. |
| `TeamInviteViewerGuard` | team-invitation/team-invite-viewer.guard.ts:47 | Checks if user is a team member when they are not the invitee. Truthiness check only. |
| `TeamInviteTeamOwnerGuard` | team-invitation/team-invite-team-owner.guard.ts:42 | Checks membership and specifically requires `OWNER` role. Reads `teamMember.role`. |
| `MockRequestGuard` | mock-server/mock-request.guard.ts:230 | Checks team membership for TEAM-type mock server workspaces. Truthiness check only. |

---

## 2. What Each Caller Uses the Result For

All callers use the return value of `getTeamMember` in one or both of these ways:

### A. Truthiness/null check (membership existence)
Every single caller first checks `if (!teamMember)` or `if (teamMember)` to determine whether the user is a member of the team. This is the primary authorization gate.

### B. Role-based access control (reading `.role`)
Many callers also read `teamMember.role` to enforce role-based permissions:
- **Guards** compare `teamMember.role` against `requireRoles` arrays (e.g., `requireRoles.includes(teamMember.role)`)
- **`leaveTeam`** checks if `member.role === TeamAccessRole.OWNER` to prevent sole-owner departure
- **`getRoleOfUserInTeam`** returns `teamMember.role` directly
- **`TeamInviteTeamOwnerGuard`** requires `teamMember.role === TeamAccessRole.OWNER`

### C. The `membershipID` field
The `membershipID` field of the return value is not directly used by any caller after the `getTeamMember` call (callers only check truthiness and `.role`). However, it is part of the `TeamMember` GraphQL type and would be exposed if the result were passed through to GQL resolvers.

---

## 3. What Would Break Under Specific Changes

### Change A: Modified method signature (different parameters)

**Adding a parameter:** All 15+ call sites across services and guards would fail to compile. This includes:
- 3 internal calls in `TeamService`
- 1 call in `TeamCollectionService`
- 3 calls in `TeamInvitationService`
- 1 call in `TeamEnvironmentsService`
- 8 guard classes
- 1 call in `MockRequestGuard`

**Removing a parameter:** Would change semantics. If `userUid` were removed, membership lookup becomes ambiguous. If `teamID` were removed, same issue.

### Change B: Modified return type

**Returning `TeamMember` (never null) and throwing instead:**
All callers that do `if (!teamMember)` with graceful error handling would break. The guards that catch errors via `throw new Error(...)` might still work, but services like `TeamInvitationService.createInvitation` and `TeamCollectionService.getCollectionForCLI` that return `E.left(...)` on null would now have unhandled exceptions.

**Returning an `Either<Error, TeamMember>` or `Option<TeamMember>` (fp-ts style):**
Every single null-check (`if (!teamMember)`, `if (teamMember)`) across all callers would break. These are standard JavaScript truthiness checks; an `Option.none` or `Either.left` is truthy in JavaScript. This would silently pass authorization checks that should fail, creating **security vulnerabilities** where non-members gain access.

**Removing the `role` field from `TeamMember`:**
All 8 guards would break (they read `.role` for RBAC). `leaveTeam` would break (sole-owner check). `getRoleOfUserInTeam` would break (returns `.role`). `TeamInviteTeamOwnerGuard` would break (checks `.role === OWNER`).

**Changing `role` from `TeamAccessRole` enum to a string:**
Guards using `requireRoles.includes(member.role)` might still work if the string values match the enum values. But strict equality checks like `teamMember.role === TeamAccessRole.OWNER` would fail if the enum comparison semantics change.

### Change C: Changed behavior (same signature, different logic)

**Always returning `null`:** All authorization gates would deny access. No user could access any team resource. Every guard would throw/reject. Every service method gated by membership would return errors.

**Always returning a `TeamMember` (never null):** Authorization would be completely bypassed. Non-members could:
- Access and modify team collections (`GqlCollectionTeamMemberGuard`)
- Access and modify team requests (`GqlRequestTeamMemberGuard`)
- Access and modify team environments (`GqlTeamEnvTeamGuard`)
- View and manage team invitations (`TeamInviteViewerGuard`, `TeamInviteTeamOwnerGuard`)
- Access mock servers (`MockRequestGuard`)
- Create invitations for teams they don't belong to (`TeamInvitationService.createInvitation`)
- Additionally, `acceptInvitation` would incorrectly think invitees are already members and reject valid invitation acceptances

**Returning wrong role:** If the role were always `VIEWER`, owners and editors would lose write access across all team operations but membership checks would still pass.

---

## 4. Indirect/Cascading Effects

### `getTeamMemberTE` cascade
`getTeamMemberTE` (line 376) wraps `getTeamMember` in a `TaskEither`. Any change to `getTeamMember` automatically propagates through `getTeamMemberTE` to `AdminService.addUserToTeam`. If the return type changes, the `TE.fromPredicate` on line 381-385 that checks truthiness (`(x): x is TeamMember => !!x`) would need updating.

### `getRoleOfUserInTeam` cascade
`getRoleOfUserInTeam` (line 389) calls `getTeamMember` and extracts `.role`. This is used by the `TeamResolver` (team.resolver.ts:71) for the `myRole` GQL field. Any change to the return type or the `role` property cascades to the GraphQL API response for the `myRole` query, potentially breaking frontend clients.

### `leaveTeam` cascade
`leaveTeam` (line 216) calls `getTeamMember` internally. It is itself called by:
- `deleteUserFromAllTeams` (line 427-447) -- used during user deletion
- `AdminService.removeUserFromTeam` (line 331-336)

So changing `getTeamMember` behavior could cascade through user deletion flows if `leaveTeam` starts behaving differently.

### Test suite breakage
Unit tests exist in:
- `team.service.spec.ts` (lines 555, 570, 703-746) -- tests `getTeamMember` and `getRoleOfUserInTeam` directly
- `team-collection.service.spec.ts` (line 2094) -- mocks `getTeamMember` returning null
- `team-environments.service.spec.ts` (lines 389, 417) -- mocks `getTeamMember` return values

All mock setups assume the current signature (`getTeamMember.mockResolvedValue(...)`) and return shape. Any signature or return type change would require updating all test mocks.

### Authorization security cascade
The most critical cascading effect is security-related. `getTeamMember` is the **single point of truth for team membership verification** across the entire backend. It is the gate used by:
- 6 distinct guard classes protecting GQL and REST endpoints
- 2 CLI-specific service methods
- The invitation creation flow (both creator authorization and duplicate-member detection)
- The invitation acceptance flow (duplicate-member detection)
- Mock server access control

A behavioral change that makes membership checks more permissive would open security holes across **every team-scoped resource** (collections, requests, environments, invitations, mock servers). A change that makes it more restrictive would lock legitimate members out of all team operations.

### Summary of blast radius

| Impact Area | # of Direct Call Sites | Severity if Broken |
|------------|----------------------|-------------------|
| Team Guards (GQL + REST) | 8 | Critical -- all team endpoints lose auth |
| TeamInvitationService | 3 | High -- invitation flow breaks |
| TeamCollectionService | 1 | High -- CLI collection access breaks |
| TeamEnvironmentsService | 1 | High -- CLI environment access breaks |
| AdminService (via TE wrapper) | 1 | Medium -- admin team management breaks |
| Internal TeamService methods | 3 | High -- leaveTeam, role queries, user deletion cascade |
| MockRequestGuard | 1 | Medium -- mock server auth breaks |
| **Total direct call sites** | **18** | |
| Test files requiring mock updates | 3+ | Medium -- CI/CD pipeline breaks |
