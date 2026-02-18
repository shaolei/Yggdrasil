# Context Builder Interface

- `buildContext(graph: Graph, nodePath: string): Promise<ContextPackage>`
  - Throws if node not found or relation target broken. Returns package with nodePath, nodeName, layers, sections, mapping, tokenCount.

- `collectAncestors(node: GraphNode): GraphNode[]` (exported for tests)
