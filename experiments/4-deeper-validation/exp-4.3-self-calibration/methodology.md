# Experiment 4.3: Self-Calibration Convergence

## Thesis

The self-calibration loop (implement → reveal gap → enrich graph → re-implement) converges to sufficient quality within a bounded number of cycles.

## Repo

Hoppscotch (`/workspaces/hoppscotch/`) — using team-collection-service as target (most complex node, well-understood from previous experiments)

## Design

### Setup

Start with a **deliberately minimal graph** for team-collection-service:
- Only `responsibility.md` (1-2 sentences)
- No `interface.md`, no `internals.md`
- Aspects declared but with minimal content
- No flow participation

### Task

Agent must answer 5 diagnostic questions that require deep understanding:

1. What are all the public methods of TeamCollectionService and their return types?
2. How does moveCollection prevent circular parent-child references?
3. What happens when a database deadlock occurs during reorderTeamCollection?
4. How does the search feature rank results (fuzzy matching algorithm)?
5. What events are published for each mutation and what data do they carry?

### Calibration Cycles

**Cycle 0 (minimal graph):**
- Agent answers questions using only the minimal context package
- Score answers

**Cycle 1 (agent-identified gap → enrichment):**
- Show the agent its wrong/incomplete answers
- Agent identifies what's missing from the graph
- Agent enriches the graph (adds interface.md, more detail to responsibility.md, etc.)
- Agent re-answers using the enriched context package
- Score answers

**Cycle 2+ (repeat until convergence or 5 cycles max):**
- Same pattern: show gaps → enrich → re-answer → score
- Stop when: score improvement < 0.5 points OR all scores ≥ 4 OR 5 cycles reached

### Metrics

- Score per question per cycle
- Total tokens added to graph per cycle
- Convergence rate (cycles to reach ≥ 4.0 mean)
- Diminishing returns curve (score improvement / tokens added)
- What types of information are added at each cycle (interface, internals, aspects, flows)
