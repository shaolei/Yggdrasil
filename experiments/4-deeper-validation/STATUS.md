# Experiment Series 4: Deeper Validation

## Status

| Experiment | Status | Key Result |
|---|---|---|
| 4.1 Flow-driven reasoning | COMPLETE | +0.40 flow value-add (marginal) |
| 4.2 Graph-first greenfield E2E | COMPLETE | 4.93/5.0 (self-sufficient) |
| 4.3 Self-calibration convergence | COMPLETE | 2 cycles to converge |
| 4.4 Hierarchy value | COMPLETE | 86% content / 14% structure |
| 4.5 Impact analysis accuracy | COMPLETE | 100% recall mapped / 35% total |
| 4.6 Aspect staleness prediction | COMPLETE | No git signal works (negative) |
| 4.7 Impact with event relations | COMPLETE | No event relations in test data (null result) |
| 4.8 Greenfield novel domain | COMPLETE | 4.75/5.0 (-0.18 vs familiar domain) |
| 4.9 Method-level impact filtering | COMPLETE | 62% avg blast radius reduction |
| 4.10 Anchor-based staleness | COMPLETE | 100% detection, 25% FP (3.2x better than git) |
| Synthesis | COMPLETE | See synthesis.md |

## Repos Used

- Hoppscotch (`/workspaces/hoppscotch/`) — 16 nodes, 5 aspects, 2 flows
- Medusa (`/workspaces/medusa/`) — 3 nodes, 3 aspects, 0 flows
- Django (`/workspaces/django/`) — 7 nodes, 2 aspects, 0 flows
- Yggdrasil self-graph (`/workspaces/Yggdrasil/.yggdrasil/`) — 27 nodes (for 4.9)

## Constraints

- No commits allowed
- Yggdrasil code may be modified for testing but not committed

## Product Changes Applied

Between 4.6 and 4.7, the following product changes were implemented to test:

- `anchors` field in `aspect.yaml` (code patterns for staleness detection)
- `stability` field in `aspect.yaml` (schema | protocol | implementation)
- `yg impact --method <name>` flag (method-level blast radius filtering)
- Event relation tracking in `yg impact --node` (emits/listens in output)
- Agent rules: enrichment priority (interface.md first)
- Agent rules: aspect stability tiers in review cadence

## Files

```
experiments/4-deeper-validation/
├── STATUS.md (this file)
├── synthesis.md
├── exp-4.1-flow-reasoning/
│   ├── methodology.md
│   └── results.md
├── exp-4.2-greenfield-e2e/
│   ├── methodology.md
│   ├── results.md
│   ├── graph/ (aspects, flows, model)
│   ├── context-packages/ (3 assembled packages)
│   └── implementation/ (4 TypeScript files)
├── exp-4.3-self-calibration/
│   ├── methodology.md
│   ├── results.md
│   ├── cycle-0/ (minimal graph + answers)
│   ├── cycle-1/ (+ interface.md)
│   └── cycle-2/ (+ internals.md)
├── exp-4.4-hierarchy-value/
│   ├── methodology.md
│   ├── results.md
│   └── conditions/ (A, B, C context packages)
├── exp-4.5-impact-accuracy/
│   ├── methodology.md
│   └── results.md
├── exp-4.6-aspect-staleness/
│   ├── methodology.md
│   └── results.md
├── exp-4.7-impact-events/
│   ├── methodology.md
│   └── results.md
├── exp-4.8-greenfield-novel/
│   ├── methodology.md
│   ├── results.md
│   ├── graph/ (7 nodes, 3 aspects, 1 flow)
│   ├── context-packages/ (4 assembled packages)
│   └── implementation/ (4 TypeScript files, ~1400 lines)
├── exp-4.9-method-impact/
│   ├── methodology.md
│   └── results.md
└── exp-4.10-anchor-staleness/
    ├── methodology.md
    └── results.md
```
