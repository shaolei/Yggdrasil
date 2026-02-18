# Dependency Resolver Responsibility

Topological sort and change detection for graph nodes. Uses structural relations only.

**In scope:**

- `resolveDeps(graph, options)`: modes all|changed|node. Returns stages (stage number, parallel flag, nodes). Throws on cycles.
- `formatDependencyTree(graph, nodePath, options?)`: ASCII tree output.
- `findChangedNodes(graph, ref?)`: git diff for .yggdrasil/
- Excludes blackbox and unmapped nodes.

**Out of scope:**

- Drift detection (cli/core/drift-detector)
- Graph loading (cli/core/loader)
