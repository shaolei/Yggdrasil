# Aspect: team-ownership
# Team Ownership

All collaborative resources in Hoppscotch are scoped to a team. Before creating or accessing a resource, the service verifies that it belongs to the expected team.

## Enforcement patterns

- **TeamRequestService**: When creating a request, verifies that the target collection belongs to the specified team via `getTeamOfCollection`. Cross-team request creation is rejected with `TEAM_INVALID_ID`.
- **TeamEnvironmentsService**: The `getTeamEnvironmentForCLI` method verifies the requesting user is a member of the environment's team before returning data. Non-members receive `TEAM_MEMBER_NOT_FOUND`.
- **TeamInvitationService**: Verifies the target team exists before creating an invitation. Verifies the invitation creator is a member of the target team. The invitation itself records the teamID.
- **TeamCollectionService**: Collections store a teamID. Move operations verify source and destination belong to the same team (`TEAM_COLL_NOT_SAME_TEAM`).

## Data model

Resources carry a `teamID` foreign key that establishes ownership:
- `TeamCollection.teamID` -- collection belongs to team
- `TeamRequest.teamID` -- request belongs to team (plus `collectionID`)
- `TeamEnvironment.teamID` -- environment belongs to team
- `TeamInvitation.teamID` -- invitation is for a specific team

## Cross-team isolation

There is no cross-team sharing. A collection, request, or environment belongs to exactly one team. Moving resources between teams is not supported.

