# Experiment 4.7: Re-run Impact Analysis with Event Relations

## Thesis

The addition of event relation tracking (`emits`/`listens`) in `yg impact --node` improves blast radius recall for event-driven changes compared to the Exp 4.5 baseline (which had 0% recall for event payload changes in S3).

## Context

Experiment 4.5 measured impact analysis accuracy across 5 scenarios using the Hoppscotch graph (16 nodes, 5 aspects, 2 flows). Scenario S3 (event payload change) scored 0% recall / 0% precision because PubSub event producers and consumers were not linked by graph relations. The `pubsub-events` aspect marked that a node uses PubSub but did not specify which events are published or consumed.

The Yggdrasil CLI has since been updated:
- `yg impact --node` now includes an "Event-connected" output section
- The impact algorithm traverses `emits` and `listens` relation types
- If a node emits to a target, listeners of that same target are included in impact scope
- Event dependents are included in the `Total scope` count
- `yg deps` supports `--type event` filtering
- `yg validate` checks for unpaired event relations (W009)
- `yg status` reports event vs structural relation counts separately

## Repo

Hoppscotch (`/workspaces/hoppscotch/`) -- same graph as Exp 4.5: 16 nodes, 5 aspects, 0 flows recognized by CLI

## Design

### Phase 1: Inventory of Event Relations in the Graph

Examine all 16 `node.yaml` files for `emits` or `listens` relation types. Count total event relations. Compare to structural relations.

### Phase 2: Run Updated Impact Analysis

For each of the 8 service nodes (which have relations), run:
- `yg impact --node <path>` -- check for "Event-connected" section
- `yg deps --node <path> --type event` -- check for event dependencies

### Phase 3: Compare to 4.5 Baseline

Specifically for S3 (event payload change on `team_col_added`):
- Old result: 0 TP, 2 FP, 0 FN among mapped nodes; event consumers invisible
- New result: does the updated tool surface event consumers?
- If no emits/listens relations exist: the feature works but the graph does not exercise it

### Phase 4: Assess Actual Event Topology

Manually catalog PubSub publishers and subscribers in the Hoppscotch codebase to understand what emits/listens relations SHOULD exist if the graph were enriched with event relations.

## Measurement

- Count of event relations in the Hoppscotch graph (emits + listens)
- Impact output format: does "Event-connected" section appear?
- For S3 scenario: new precision/recall vs. 4.5 baseline
- Gap analysis: what event relations would need to be added to exercise the feature?
