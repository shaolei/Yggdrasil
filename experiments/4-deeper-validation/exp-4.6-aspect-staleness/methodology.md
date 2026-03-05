# Experiment 4.6: Aspect Staleness Prediction

## Thesis

Aspect staleness can be predicted from git history signals (commit patterns, file churn) without full drift checking.

## Repo

Hoppscotch (`/workspaces/hoppscotch/`) — real git history, 5 aspects

## Design

### Approach

For each aspect in Hoppscotch, analyze whether the aspect's claims still hold by:

1. **Ground truth establishment**: Read each aspect's content, then verify against current source code whether each claim is still accurate. Score: percentage of claims that are still true.

2. **Signal extraction from git history**: For each aspect, extract signals from the git history of files covered by nodes that carry the aspect:
   - Total commits touching aspect-covered files (last 6 months, 1 year, 2 years)
   - Number of files changed per commit (scope indicator)
   - Commit message keywords (refactor, feature, fix, breaking)
   - File churn rate (lines added + deleted / total lines)
   - New files added to aspect-covered directories
   - Whether the aspect's own definition files were updated

3. **Correlation analysis**: Which signals correlate with actual staleness?

### Aspects to Analyze

1. `pessimistic-locking` — Row-level locking before sibling order mutations
2. `pubsub-events` — Real-time event publishing after every mutation
3. `retry-on-deadlock` — Exponential retry for database transaction errors
4. `role-based-access` — Operations check team roles before proceeding
5. `team-ownership` — Resources scoped to team and verified on access

### Metrics

For each aspect:
- **Staleness score** (0-100%): percentage of claims that are stale/wrong
- **Git signals**: commit count, churn rate, feature additions, refactoring commits
- **Correlation**: which signals predict staleness > 20%?

### Expected Outcome

- New feature additions (60% trigger from Exp 5) should correlate with staleness
- File churn alone may not predict (refactoring doesn't change behavior)
- Commit message analysis may provide useful heuristic
- If no signal correlates: staleness is unpredictable from git alone → must check proactively
