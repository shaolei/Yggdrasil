# Experiment 4.4: Hierarchy Value

## Thesis

Hierarchical node structure (children inheriting parent context) provides measurable value over flat node structure with equivalent information.

## Repo

Hoppscotch (`/workspaces/hoppscotch/`) — using team-collections module (parent: team-collections/, child: team-collections/team-collection-service/)

## Design

### Conditions

**Condition A: Hierarchical (current structure)**
- Parent `team-collections/` has responsibility.md with domain context
- Child `team-collections/team-collection-service/` has its own artifacts
- `yg build-context` assembles both layers

**Condition B: Flat (equivalent information)**
- Remove parent node
- Merge parent's responsibility.md content into the child's artifacts
- Child stands alone with all information but no hierarchy
- Build context package manually (simulating flat structure)

**Condition C: Flat (child only, no parent content)**
- Only child artifacts, parent content NOT merged
- Tests whether parent content is actually needed

### Questions (8 total)

4 about boundaries/responsibilities (where hierarchy should help):
1. What is the domain scope of the team-collections area?
2. What responsibilities does the collection service NOT have?
3. How does the collection domain relate to the team domain?
4. What would happen if we added "collection sharing between teams" — which module handles it?

4 about implementation details (where hierarchy shouldn't matter):
5. How does createTeamCollection assign orderIndex?
6. What are the failure modes of moveCollection?
7. How does the search use fuzzy matching?
8. What concurrency mechanism protects reorder operations?

### Scoring

Same 0-5 scale. Score per condition, per question category (boundary vs implementation).

### Expected Outcome

- Hierarchy helps with boundary/responsibility questions (A > C)
- Hierarchy matches flat-equivalent for implementation questions (A ≈ B)
- The interesting finding: does hierarchy help vs flat-equivalent on boundary questions (A vs B)?
  - If A ≈ B: hierarchy is a convenience, not a necessity
  - If A > B: hierarchy provides structural signal beyond content
