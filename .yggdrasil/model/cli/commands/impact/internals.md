## Logic

# Impact Command Logic

## Mode selection

1. Parse options: --node, --aspect, --flow, --method, --simulate. Exactly one mode required (node/aspect/flow). --method requires --node.
2. If 0 or >1 modes: exit 1 with usage error.

## --node mode

1. `loadGraph(process.cwd())`. Trim node path, strip trailing slash.
2. Find node; if not found exit 1.
3. `collectReverseDependents(graph, node)` — scan all structural relations for target match. Returns `relationFrom` map for consumes metadata.
4. If --method: filter direct dependents to those consuming the named method (or with no consumes constraint). Rebuild transitive set from filtered direct.
5. `buildTransitiveChains(node, direct, allDependents, reverse)` — BFS from target, build chains.
6. Collect event-dependent nodes: scan all nodes for `emits`/`listens` relations targeting the node. Also find listeners for events the target emits (cross-referencing emitted event targets).
7. `collectDescendants(graph, nodePath)` — recursive children.
8. `collectEffectiveAspectIds(graph, node)` — own + hierarchy + flow + implies.
9. Co-aspect nodes: other nodes sharing any effective aspect (exclude self and descendants).
10. Total scope: union of structural dependents, descendants, and event dependents.
11. If --simulate: `runSimulation(graph, affectedPaths, projectRoot)`.

## --aspect mode

1. Find aspect by id in `graph.aspects`.
2. For every node: `collectEffectiveAspectIds`; if contains target aspect, add to affected (directly affected).
3. Determine attribution: own (in node.aspects), hierarchy (ancestor), flow (via flow.aspects), implied (via implies chain).
4. `collectIndirectDependents(graph, affected.map(a => a.path))` — find structural dependents of directly affected nodes that are not themselves directly affected. Output as "Indirectly affected (structural dependents)" section.
5. Total scope includes both directly and indirectly affected nodes.
6. If --simulate: `runSimulation` with combined direct + indirect paths.

## --flow mode

1. Find flow by name or path in `graph.flows`.
2. Collect declared participants + `collectDescendants` for each.
3. `collectIndirectDependents(graph, sorted)` — find structural dependents of participants that are not themselves participants. Output as "Indirectly affected (structural dependents)" section (only if any exist).
4. Total scope includes both participants and indirectly affected nodes.
5. If --simulate: `runSimulation` with combined participant + indirect paths.

## runSimulation

1. `loadGraphFromRef(projectRoot, 'HEAD')` — baseline.
2. `detectDrift(graph)` — current drift state.
3. For each affected node: `buildContext` current + baseline, compare tokens, report budget delta.

## Constraints

# Impact Command Constraints

- **Exactly one mode required:** The flags `--node`, `--aspect`, and `--flow` are mutually exclusive. Exactly one must be provided. Zero or more than one causes exit with error.
- **Simulation requires git history:** The `--simulate` flag calls `loadGraphFromRef` to compare HEAD baseline against the current working tree. This requires a git repository with at least one commit. If the ref cannot be resolved, the baseline comparison is skipped gracefully (returns null).
- **Node mode requires valid node path:** When `--node` is used, the path must exist in the graph. Missing nodes cause exit with error.
- **Aspect mode requires valid aspect id:** When `--aspect` is used, the id must match a loaded aspect. Missing aspects cause exit with error.
- **Flow mode requires valid flow name:** When `--flow` is used, the name must match a loaded flow (by name or path). Missing flows cause exit with error.
