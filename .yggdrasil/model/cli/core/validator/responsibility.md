# Validator Responsibility

Structural validation and completeness checks. Implements E001–E017 (errors, excluding removed E005/E008/E011/E013/E018/E019/E020) and W001–W002, W005–W007, W009–W014 (warnings). Enforces invariants/001 (context sufficient) and invariants/002 (graph intended truth). Aligns with decisions/001 (read-only; reports issues, does not modify graph). E018 and E019 were removed when aspects, aspect_exceptions, and anchors were unified into a single aspects list — structurally invalid references are now impossible.

**In scope:**

- `validate(graph, scope?)`: scope 'all' or node path. Returns ValidationResult (issues, nodesScanned). Structural errors block build-context.
- **Errors**: E001 (invalid-node-yaml), E002 (unknown-node-type), E003 (unknown-aspect), E004 (broken-relation), E006 (broken-flow-ref), E007 (broken-aspect-ref), E009 (overlapping-mapping), E010 (structural-cycle), E012 (invalid-config), E014 (duplicate-aspect-binding), E015 (missing-node-yaml), E016 (implied-aspect-missing), E017 (aspect-implies-cycle).
- **Warnings**: W001 (missing-artifact), W002 (shallow-artifact), W005 (budget-warning, informational with breakdown), W006 (budget-error, informational with breakdown), W007 (high-fan-out), W009 (unpaired-event), W010 (missing-schema), W011 (missing-required-aspect-coverage), W012 (mapping-path-missing), W013 (directory-without-node), W014 (anchor-not-found), W015 (own-budget-warning, actionable — own tokens exceed 50% of warning threshold), W017 (wide-node — maps too many source files, suggests splitting).
- E010: cycles involving at least one blackbox node are tolerated. W005/W006: uses buildContext for token count, includes per-category breakdown via computeBudgetBreakdown. W015: fires when own-layer tokens exceed 50% of warning threshold. W010: checks that node, aspect, flow schemas are present in schemas/. W011: uses resolveAspects for coverage (direct tag or via implies).
- **Internal checks**: checkNodeTypes, checkAspectsDefined, checkAspectIds, checkAspectIdUniqueness, checkImpliedAspectsExist, checkImpliesNoCycles, checkRequiredAspectsCoverage, checkAnchorPresence, checkRequiredArtifacts, checkContextBudget, checkHighFanOut, checkWideNodes, checkSchemas, checkRelationTargets, checkNoCycles, checkMappingOverlap, checkMappingPathsExist, checkBrokenFlowRefs, checkFlowAspectIds, checkDirectoriesHaveNodeYaml, checkShallowArtifacts, checkUnpairedEvents. findSimilar: suggests similar node_path for E004. expandMappingToFiles: recursively collects files from mapping paths for anchor and wide-node validation. getAspectIds: extracts flat aspect id list from unified NodeAspectEntry[].

**Out of scope:**

- Graph loading (cli/core/loader)
- Context building (cli/core/context) — validator consumes buildContext for budget check only
