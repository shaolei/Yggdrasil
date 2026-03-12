# Context Builder Interface

**Primary API:**

- `buildContext(graph: Graph, nodePath: string): Promise<ContextPackage>`
  - Parameters: `graph` (Graph), `nodePath` (string).
  - Returns: `ContextPackage` with `nodePath`, `nodeName`, `layers` (ContextLayer[]), `sections` (ContextSection[]), `mapping` (string[] | null), `tokenCount` (number).
  - Throws if node not found or relation target broken.

**Layer builders (exported for tests):**

- `buildGlobalLayer(config: YggConfig): ContextLayer` — project name.
- `buildHierarchyLayer(ancestor: GraphNode, config: YggConfig, graph: Graph): ContextLayer` — filtered by config.artifacts; adds attrs.aspects from ancestor aspects + expandAspects.
- `buildOwnLayer(node: GraphNode, config: YggConfig, graphRootPath: string, graph: Graph): Promise<ContextLayer>` — reads yg-node.yaml from disk; uses node.artifacts; adds attrs.aspects from node aspects + expandAspects.
- `buildStructuralRelationLayer(target: GraphNode, relation: Relation, config: YggConfig): ContextLayer` — prefers included_in_relations artifacts; includes consumes, failure.
- `buildEventRelationLayer(target: GraphNode, relation: Relation): ContextLayer`
- `buildAspectLayer(aspect: AspectDef, exceptionNote?: string): ContextLayer` — renders aspect content; if aspect has `stability`, appends "Stability tier: ..." line; if `exceptionNote` is provided, appends a warning block: "Exception for this node: {note}". The exception note comes from the aspect entry's `exceptions` field in `node.meta.aspects`, joined with '; '.
- `collectAncestors(node: GraphNode): GraphNode[]` — returns ancestors from parent chain.
- `collectDependencyAncestors(target: GraphNode, config: YggConfig, graph: Graph): DependencyAncestorInfo[]` — returns ancestor chain for a dependency target node. Each entry includes path, name, type, aspects (own aspects expanded via `implies` only — not effective aspects), and artifactFilenames (filtered by `included_in_relations`, falling back to all config artifacts). Used by context-map output to provide hierarchy context for dependency targets.

**Structured output converter:**

- `toContextMapOutput(pkg: ContextPackage, graph: Graph): ContextMapOutput` — converts a layers-based ContextPackage into the structured ContextMapOutput format. Extracts node aspects (with anchors/exceptions), flows, hierarchy ancestors, dependencies (with their own hierarchy and effective aspects), and builds an ArtifactRegistry mapping all referenced graph files. Budget status is computed from config thresholds.

**Types:**

- `DependencyAncestorInfo` — `{ path: string; name: string; type: string; aspects: string[]; artifactFilenames: string[] }`

**Constants (internal):** `STRUCTURAL_RELATION_TYPES`, `EVENT_RELATION_TYPES`.

## Failure Modes

- **Node not found**: Throws `Error("Node not found: ${nodePath}")` if nodePath not in graph.nodes.
- **Broken relation**: Throws `Error("Broken relation: ${nodePath} -> ${relation.target} (target not found)")` when structural or event relation target not in graph.
- **buildOwnLayer yg-node.yaml read**: Catches readFile errors; emits `(not found)` in content instead of throwing.
- **Artifact read failure**: Other readFile calls (e.g. in loader-provided artifacts) — not in context-builder; artifacts come pre-loaded.
