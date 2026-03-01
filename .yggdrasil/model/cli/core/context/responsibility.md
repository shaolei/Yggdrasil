# Context Builder Responsibility

Assembles context packages for nodes — the 6-step layer assembly used by `yg build-context`.

**In scope:**

- **buildContext(graph, nodePath)**: Primary API. Returns ContextPackage with layers, sections, mapping, tokenCount.
- **6-step build, 5-section render**: Build phase: (1) global config, (2) hierarchy ancestors, (3) own (node.yaml from disk + configured artifacts from node), (4) relational (structural_context per decisions/002 or fallback), (5) flows (node + ancestors), (6) aspects (union of aspects from hierarchy + own + flow layers; no source on aspect layer). Render order differs: Global → Hierarchy → OwnArtifacts → Aspects → Relational (deps+flows merged).
- **Aspects in blocks**: hierarchy, own, and flow layers carry `attrs.aspects` (comma-separated aspect ids, expanded via implies). No `collectHierarchyTags` or `collectFlowAspectTags`; no `source` on aspect layers.
- **expandAspects(aspectIds, aspects)**: Helper; expands aspect ids with implied aspects recursively (cycle detection). Used by buildHierarchyLayer, buildOwnLayer, buildFlowLayer.
- **Token estimation**: ~4 chars/token heuristic via estimateTokens (no tokenizer dependency).
- **Layer builders** (exported for tests): `buildGlobalLayer`, `buildHierarchyLayer`, `buildOwnLayer`, `buildStructuralRelationLayer`, `buildEventRelationLayer`, `buildAspectLayer`, `collectAncestors`.
- **filterArtifactsByConfig**: Internal; filters artifacts by config.artifacts keys.
- **buildHierarchyLayer(ancestor, config, graph)**: Accepts graph; computes ancestor aspects + implies via expandAspects; adds `attrs.aspects` when non-empty.
- **buildOwnLayer(node, config, graphRootPath, graph)**: Accepts graph; computes node aspects + implies; adds `attrs.aspects`.
- **buildFlowLayer(flow, graph)**: Internal; accepts graph; computes flow.aspects + implies; adds `attrs.aspects`.
- **buildSections**: Internal; groups layers into sections (Global, Hierarchy, OwnArtifacts, Aspects, Relational). Relational merges structural dependencies, events, and flows. Adds "Materialization Target" own layer when mapping exists.
- **collectParticipatingFlows**: Internal; returns flows where node or any ancestor is in flow.nodes.
- **Relation type sets**: STRUCTURAL_RELATION_TYPES (uses, calls, extends, implements), EVENT_RELATION_TYPES (emits, listens). Relations not in either set are skipped.

**Out of scope:**

- Graph loading (cli/core/loader)
- Validation (cli/core/validator)
