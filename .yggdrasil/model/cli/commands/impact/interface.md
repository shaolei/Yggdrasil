# Impact Command Interface

| Function | Signature | Command | Options |
| -------- | --------- | ------- | ------- |
| registerImpactCommand | (program: Command) => void | impact | --node, --aspect, --flow (mutually exclusive, one required), --simulate |

**Also exported:**

- `collectReverseDependents(graph: Graph, targetNode: GraphNode): { direct, allDependents, reverse }` — builds reverse dependency map from structural relations.
- `buildTransitiveChains(targetNode, direct, allDependents, reverse): string[][]` — BFS chains excluding target.
- `collectDescendants(graph: Graph, nodePath: string): string[]` — hierarchy children recursively.

**Return:** void for registerImpactCommand. Contract: errors to stderr, process.exit(1) on failure.

## Failure Modes

**Propagated from loadGraph:**

- Missing .yggdrasil/: `Error: No .yggdrasil/ directory found. Run 'yg init' first.`

**Command-specific:**

- Node not found: `Node not found: ${nodePath}` — when --node path does not exist in graph.
- Aspect not found: `Aspect not found: ${aspectId}` — when --aspect id does not exist.
- Flow not found: `Flow not found: ${flowName}` — when --flow name does not exist.
- Mode validation: `Specify exactly one of: --node, --aspect, --flow` — when 0 or >1 modes given.

**Generic:** I/O errors — standard Node.js Error, caught and reported to stderr.
