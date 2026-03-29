## Logic

# Validator Logic

## validate(scope)

1. **Early errors**: configError → E012; nodeParseErrors → E001
2. **Config-dependent checks** (if !configError): checkNodeTypes, checkAspectsDefined, checkAspectIds, checkAspectIdUniqueness, checkImpliedAspectsExist, checkImpliesNoCycles, checkRequiredAspectsCoverage, checkAnchorPresence, checkRequiredArtifacts, checkInvalidArtifactConditions, checkContextBudget, checkHighFanOut, checkMissingDescriptions
3. **Graph-structure checks**: checkRelationTargets, checkNoCycles, checkMappingOverlap, checkMappingPathsExist, checkBrokenFlowRefs, checkFlowAspectIds, checkDirectoriesHaveNodeYaml, checkShallowArtifacts, checkUnpairedEvents
4. **Scope filter**: if scope !== 'all', filter issues by nodePath; validate scope exists

## Key rules

- **checkSchemas**: REQUIRED_SCHEMAS = ['node','aspect','flow']; present = Set(graph.schemas.map(s => s.schemaType)); missing → W010
- **checkNoCycles**: DFS with WHITE/GRAY/BLACK; cycles involving blackbox tolerated
- **checkImpliedAspectsExist**: each id in aspect.implies must have corresponding aspect → E016
- **checkImpliesNoCycles**: DFS on aspect implies graph; cycle → E017
- **checkRequiredAspectsCoverage**: node type with required_aspects; coverage via direct aspect or resolveAspects → W011
- **checkRequiredArtifacts**: artifactRequiredReason evaluates required (always | never | when conditions)
- **checkContextBudget**: buildContext per node; uses `computeBudgetBreakdown` to get per-category token costs; compares tokenCount to warning/error thresholds. Produces W015 (own-budget-warning) when own-layer tokens exceed 50% of the warning threshold — this is the actionable warning directing agents to split nodes. W005 (budget-warning) and W006 (budget-error) are now informational, showing the full breakdown (own, hierarchy, aspects, flows, dependencies) so agents can diagnose WHERE the budget is consumed
- **checkAnchorPresence**: For each node with aspect entries containing `anchors`, validates W014 — each anchor string must appear in at least one mapped source file. Uses `expandMappingToFiles` helper to recursively collect files from mapping paths (skips dotfiles and `node_modules`). All source files for a node are read once and searched for each anchor string via simple `content.includes(anchor)`. E018 (invalid-aspect-exception) and E019 (invalid-anchor-ref) were removed — the unified aspects format makes structurally invalid references impossible.
- **checkWideNodes**: W017 — for each non-blackbox node, expands mapping paths to source files (reusing `expandMappingToFiles`). If file count exceeds `quality.max_mapping_source_files` (default 10), emits warning with file count and filled artifact count, suggesting node splitting.

## Order of checks

Config-dependent first (need valid config). Structure checks can run with partial config. Scope filter applied last.

## Decisions

# Validator Decisions

**Stable error codes E001-E017, W001-W017:** Each validation rule has a fixed code (E for errors, W for warnings). E018, E019, E020 have been removed. These codes are machine-readable identifiers stable across versions, enabling CI pipelines and automation to match on specific codes rather than fragile message text. New rules receive the next available code.

**Warnings do not block build-context:** Warnings (W-codes) indicate quality suggestions such as shallow artifacts, high fan-out, or missing optional coverage. Errors (E-codes) indicate structural integrity failures such as broken relations, missing yg-node.yaml, or cycles. Only errors represent states where the graph is structurally invalid. build-context operates on the loaded graph and does not consult validation results, so warnings never prevent context assembly.

**W005/W006 as informational with breakdown, W015 as actionable:** W005 (budget-warning) and W006 (budget-error) now show the full per-category token breakdown (own, hierarchy, aspects, flows, dependencies) so agents can diagnose where budget is consumed. These are informational — they explain the situation. W015 (own-budget-warning) is the actionable warning: it fires when own-layer tokens exceed 50% of the warning threshold, directing agents to split nodes. Chose to separate informational (W005/W006) from actionable (W015) because agents need different responses: W005/W006 require diagnosis (maybe dependencies are the problem, not own content), while W015 requires action (split the node). The previous single W005 approach was interpreted by agents as permission to delete artifact content, destroying irrecoverable knowledge. The breakdown gives agents enough information to make informed decisions about which category to address.
