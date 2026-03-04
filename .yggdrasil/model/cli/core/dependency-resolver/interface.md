# Dependency Resolver Interface

**Types:**

- `ResolveOptions`: `mode` ('all'|'changed'|'node'), `nodePath?` (required when mode==='node'), `ref?` (git ref, default HEAD), `depth?`, `relationType?` ('structural'|'event'|'all')
- `DepTreeNode`: `nodePath`, `relationType`, `relationTarget?`, `blackbox`, `children: DepTreeNode[]`
- `Stage`: `stage` (number), `parallel` (boolean), `nodes` (string[])

**Primary API:**

- `resolveDeps(graph: Graph, options: ResolveOptions): Promise<Stage[]>`
  - Returns stages for topological execution. Excludes blackbox and unmapped nodes. Throws on cycles or broken relations.

- `findChangedNodes(graph: Graph, ref?: string): string[]`
  - Synchronous. Git diff for .yggdrasil/; maps file paths to node paths; extends with direct dependents. Returns [] on non-git, execSync failure, or empty diff.

- `collectTransitiveDeps(graph: Graph, nodePath: string): string[]`
  - Transitive structural dependencies (relationType: structural). Throws if node or relation target not found.

- `buildDependencyTree(graph: Graph, nodePath: string, options?: { depth?: number; relationType?: 'structural'|'event'|'all' }): DepTreeNode[]`
  - Tree structure; avoids cycles via branch set. Throws if node not found. Skips relation targets not in graph (no throw).

- `formatDependencyTree(graph: Graph, nodePath: string, options?: { depth?: number; relationType?: 'structural'|'event'|'all' }): string`
  - ASCII tree output. Throws if node not found.

## Failure Modes

- **resolveDeps**:
  - `Error("Relation target not found: ${target}")` when relation target not in graph (during candidate validation or collectTransitiveDeps for mode node).
  - `Error("Circular dependency detected involving: ${cycleNodes.join(', ')}")` when structural relations form a cycle among non-blackbox nodes.
  - When mode==='node', `collectTransitiveDeps` throws if nodePath not in graph.
- **findChangedNodes**: Returns [] on non-git repo, execSync failure, or empty diff. No throw.
- **collectTransitiveDeps**, **buildDependencyTree**, **formatDependencyTree**: `Error("Node not found: ${nodePath}")` when node does not exist; `Error("Relation target not found: ${rel.target}")` when relation target missing (collectTransitiveDepsFiltered, buildChildren). buildDependencyTree skips missing targets (no throw) when building tree children.
