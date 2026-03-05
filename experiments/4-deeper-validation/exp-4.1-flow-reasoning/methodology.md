# Experiment 4.1: Flow-Driven Reasoning

## Thesis

Flow descriptions materially improve agent reasoning about cross-module business processes.

## Repo

Hoppscotch (`/workspaces/hoppscotch/`) — 16 nodes, 5 aspects, 2 flows (collection-management, team-member-lifecycle)

## Design

### Questions (10 total)

5 questions about each flow, designed to require multi-node understanding:

**Collection Management flow:**
1. What happens to child collections and requests when a parent collection is deleted?
2. How does the system prevent circular references when moving a collection?
3. What concurrency mechanism ensures orderIndex consistency when two users reorder simultaneously?
4. How does collection duplication reuse the import mechanism, and what events are published?
5. What happens to sibling orderIndex values when a collection is moved out of a parent?

**Team Member Lifecycle flow:**
6. What prevents deleting a user who is the sole owner of a team?
7. When an admin directly adds a user who already has a pending invitation, what happens to the invitation?
8. How many PubSub events are published when accepting an invitation?
9. What is the full chain of checks when a user account is deleted (across all participants)?
10. Can an admin remove the last owner of a team? What protection exists?

### Conditions (3 agents per condition)

**Condition A: Full graph (nodes + aspects + flows)**
- Agent receives: `yg build-context` output for all participating nodes
- Flow descriptions ARE included in context packages

**Condition B: Graph without flows (nodes + aspects only)**
- Agent receives: same `yg build-context` output but with flow sections stripped
- Tests whether node-level artifacts alone capture process knowledge

**Condition C: Raw source code only**
- Agent receives: relevant source files (services) without any graph
- Baseline for what raw code comprehension achieves

### Scoring

Each answer scored 0-5 by an independent scoring agent:
- 5: Completely correct, captures all nuances
- 4: Correct with minor omission
- 3: Mostly correct, misses important detail
- 2: Partially correct, significant gaps
- 1: Addresses the question but mostly wrong
- 0: Wrong or irrelevant

### Metrics

- Mean score per condition (A, B, C)
- Delta A-B = flow value-add
- Delta A-C = total graph value-add
- Per-question breakdown to identify where flows help most
