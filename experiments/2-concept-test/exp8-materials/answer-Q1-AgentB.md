# Answer to Q1 (Agent B -- TeamCollectionService context only)

**Question:** If I change the team membership check in TeamService (the `getTeamMember` method), what breaks in TeamCollectionService and other modules?

---

## 1. Which services call `getTeamMember` (based on what I can see)

From the TeamCollectionService context package, the following is explicitly declared:

- **TeamCollectionService** has a `calls` relation to `team/team-service` and explicitly **consumes `getTeamMember`** (declared in `node.yaml` relations).

The TeamService responsibility artifact also mentions these modules as consumers in the team-ownership aspect:

- **TeamRequestService** -- verifies collection ownership via `getTeamOfCollection` (not `getTeamMember` directly, but uses team ownership enforcement patterns).
- **TeamEnvironmentsService** -- its `getTeamEnvironmentForCLI` method "verifies the requesting user is a member of the environment's team before returning data." This strongly implies it calls `getTeamMember` or a similar membership check.
- **TeamInvitationService** -- "verifies the invitation creator is a member of the target team," which also implies a `getTeamMember` call.

However, from this single context package, I can only **confirm with certainty** that TeamCollectionService consumes `getTeamMember`. The others are inferences from the team-ownership aspect description.

---

## 2. What `getTeamMember` is used for in TeamCollectionService

Based on the context package:

- **CLI access methods**: The `getCollectionForCLI(collectionID, userUid)` method performs a "membership check" before returning collection data. The error `TEAM_MEMBER_NOT_FOUND` is returned "when the requesting user is not a member of the collection's team." This is the primary usage point -- `getTeamMember` is called to verify that the user requesting CLI access to a collection is actually a member of the team that owns that collection.

- The method signature `getTeamMember(teamID: string, userUid: string): Promise<TeamMember | null>` returns a `TeamMember` or `null`. TeamCollectionService likely checks for a `null` return to determine non-membership and returns `TEAM_MEMBER_NOT_FOUND`.

---

## 3. What would break if the method changed

### Direct breakage in TeamCollectionService

| Change scenario | What breaks |
|---|---|
| **Return type changes** (e.g., from `Promise<TeamMember \| null>` to `TaskEither`) | `getCollectionForCLI` null-check logic breaks. The service checks for `null` to determine non-membership; a different return type would cause type errors or incorrect control flow. |
| **Parameter signature changes** (e.g., added required parameter) | Every call site in TeamCollectionService would fail to compile. |
| **Semantics change** (e.g., returns `null` for inactive members who were previously returned) | CLI access would be denied to users who previously had access. `TEAM_MEMBER_NOT_FOUND` would be returned unexpectedly. |
| **Method renamed or removed** | Direct compilation failure in TeamCollectionService. |
| **Returns a different `TeamMember` shape** (e.g., missing fields like `role`) | If TeamCollectionService reads properties from the returned `TeamMember` object (e.g., to check role-based access), those reads would fail or return undefined. |

### Specific broken functionality

1. **`getCollectionForCLI`** -- This is the primary consumer. CLI users would be unable to retrieve collections if the membership check behavior changes. The error `TEAM_MEMBER_NOT_FOUND` would either fire incorrectly (false negatives) or not fire when it should (false positives / security hole).

2. **`getCollectionTreeForCLI`** -- Although the interface lists this method, it likely also depends on membership verification (the "ForCLI" suffix suggests the same access pattern). If it delegates to `getCollectionForCLI` or performs its own membership check, it would also break.

---

## 4. Indirect effects I can infer

### Security implications

The `getTeamMember` call is part of the **team-ownership** aspect, which enforces cross-team isolation. The aspect states: "There is no cross-team sharing. A collection, request, or environment belongs to exactly one team." If `getTeamMember` changes behavior:

- **Authorization bypass risk**: If the method starts returning non-null for non-members (e.g., due to a bug in the change), users could access collections from teams they do not belong to. This would violate the cross-team isolation invariant.
- **Over-restriction risk**: If the method becomes more restrictive (e.g., only returns OWNER/EDITOR members, filtering out VIEWERs), CLI read access would break for VIEWER-role members.

### Other modules (inferred from team-ownership aspect)

Based on the team-ownership aspect documentation visible in this context:

- **TeamEnvironmentsService** would likely break in the same way -- its CLI access method (`getTeamEnvironmentForCLI`) performs the same membership verification pattern. Users would be unable to access team environments via CLI.
- **TeamInvitationService** would be affected if it uses `getTeamMember` to verify that the invitation creator is a team member. Invitation creation could fail or allow unauthorized users to create invitations.
- **TeamRequestService** uses `getTeamOfCollection` rather than `getTeamMember` directly, so it may be unaffected -- but if it has any membership checks of its own, those would also break.

### fp-ts variant consideration

The TeamService interface also exposes `getTeamMemberTE(teamID, userUid): TaskEither<string, TeamMember>` -- an fp-ts variant. If only the base `getTeamMember` method changes and `getTeamMemberTE` wraps it, the fp-ts variant would also propagate the changed behavior. Any callers using the TE variant would be affected identically.

### PubSub event chain

While not directly related, if `getTeamMember` changes cause CLI mutations to fail (e.g., if there were CLI-based mutation paths that first check membership), the downstream PubSub events (`coll_added`, `coll_updated`, etc.) would never fire, causing connected real-time clients to miss updates.

---

## Confidence assessment

- **High confidence**: TeamCollectionService's `getCollectionForCLI` directly breaks.
- **Medium confidence**: `getCollectionTreeForCLI` also breaks (inferred from naming pattern, not explicitly stated).
- **Medium confidence**: TeamEnvironmentsService and TeamInvitationService break similarly (inferred from team-ownership aspect, not from their own context packages).
- **Low confidence**: TeamRequestService impact (its enforcement pattern uses a different method).

---

## Limitations of this analysis

This answer is based solely on the TeamCollectionService context package. I do not have:
- The actual source code of any service
- Context packages for TeamEnvironmentsService, TeamInvitationService, or TeamRequestService
- The full list of all consumers of `getTeamMember` across the codebase

A complete impact analysis would require running `yg impact --node team/team-service` or examining the context packages of all services that declare a `calls` relation to TeamService.
