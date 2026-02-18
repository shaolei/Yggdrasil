# Dependency Resolver Interface

- `resolveDeps(graph: Graph, options: ResolveOptions): Promise<Stage[]>`
  - options.mode: 'all' | 'changed' | 'node'. Returns stages. Throws on cycles.

- `formatDependencyTree(graph, nodePath, options?): string`
  - ASCII tree of dependencies.

- `findChangedNodes(graph, ref?): string[]`
  - Git diff for .yggdrasil/ files.
