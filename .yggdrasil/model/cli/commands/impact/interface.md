# Impact Command Interface

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerImpactCommand | (program: Command) => void | impact | --node, --aspect, --flow (mutually exclusive, one required), --method (requires --node), --simulate |

**Also exported:**

- `collectReverseDependents(graph: Graph, targetNode: GraphNode): { direct, allDependents, reverse }` — builds reverse dependency map from structural relations.
- `buildTransitiveChains(targetNode, direct, allDependents, reverse): string[][]` — BFS chains excluding target.
- `collectDescendants(graph: Graph, nodePath: string): string[]` — hierarchy children recursively.
- `collectIndirectDependents(graph: Graph, directlyAffected: string[]): { indirectPaths: string[]; chains: string[] }` — given a set of directly affected nodes, finds all structural and event reverse dependents not already in that set. Builds the reverse adjacency map once (structural + emits/listens), then BFS per affected node. When the same node is reachable via multiple affected nodes, keeps the shortest chain. Chain format: `<- indirect <- intermediary <- affected`. Used by both `--node` and `--aspect` modes.

**Return:** void for registerImpactCommand. Contract: errors to stderr, process.exit(1) on failure.

**--method filter:** When `--method <name>` is provided with `--node`, filters direct dependents to only those whose relation consumes the specified method (or has no consumes constraint). Transitive dependents are rebuilt from the filtered direct set.

**Event-dependent tracking:** In `--node` mode, output includes an "Event-connected" section showing nodes linked via `emits`/`listens` relations to the target node, including event listeners for events the target emits. Event dependents are included in the total scope count.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`

**Command-specific:**

- Node not found: `Node not found: ${nodePath}` — when --node path does not exist in graph.
- Aspect not found: `Aspect not found: ${aspectId}` — when --aspect id does not exist.
- Flow not found: `Flow not found: ${flowName}` — when --flow name does not exist.
- Mode validation: `Specify exactly one of: --node, --aspect, --flow` — when 0 or >1 modes given.
- Method without node: `--method requires --node` — when --method is used without --node.

**Generic:** I/O errors — standard Node.js Error, caught and reported to stderr.
