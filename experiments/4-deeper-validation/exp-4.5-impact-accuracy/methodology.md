# Experiment 4.5: Impact Analysis Accuracy

## Thesis

After infrastructure nodes, `yg impact` covers >90% of the actual blast radius for interface changes.

## Repo

Hoppscotch (`/workspaces/hoppscotch/`) — 16 nodes, 5 aspects, 2 flows

## Design

### Scenarios (5 planned changes, increasing complexity)

**S1: Simple method signature change**
- Change: TeamCollectionService.createTeamCollection adds a required `description` parameter
- Predicted impact: `yg impact --node team-collections/team-collection-service --simulate`
- Actual impact: Manual trace through code — what callers exist, what tests break?

**S2: Return type change**
- Change: TeamService.getTeamMember returns a different data shape (adds `permissions` field)
- Predicted vs actual

**S3: Event payload change**
- Change: `team_col_added` PubSub event gets a new required field
- Predicted vs actual (event relations should catch listeners)

**S4: Aspect-level change**
- Change: pessimistic-locking aspect changes from row-level to table-level locking
- Predicted: `yg impact --aspect pessimistic-locking`
- Actual: which nodes actually use locking and would need changes?

**S5: Cross-flow change**
- Change: sole-owner protection rule changes (teams can now have 0 owners)
- Predicted: impact across team-member-lifecycle flow
- Actual: trace through all participants

### Measurement

For each scenario:
1. Run `yg impact` and record predicted affected nodes
2. Manually trace through source code to find ALL actually affected locations
3. Calculate:
   - **Precision**: predicted_correct / total_predicted (are predictions accurate?)
   - **Recall**: predicted_correct / total_actual (are all affected nodes found?)
   - **F1 score**: harmonic mean of precision and recall
4. Categorize misses:
   - Missing relation in graph
   - Infrastructure/guard not modeled
   - Transitive dependency missed
   - Event chain not traced
   - Aspect propagation missed

### Success Criteria

- Recall > 90% = impact analysis is reliable for change planning
- Recall < 70% = significant blind spots remain
- Precision > 80% = predictions are not noisy
