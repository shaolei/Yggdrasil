# Core Constraints

- **Determinism:** Same graph state always produces same context package, validation result, drift report. No heuristics, no guessing, no repository search.
- **Context assembly algorithm (fixed order):** For node N at path P with tags T, buildContext executes in this order:
  1. GLOBAL — config.yaml (stack, standards)
  2. KNOWLEDGE scope global — every knowledge item where scope = global
  3. KNOWLEDGE scope tags — every knowledge item where scope.tags ∩ T ≠ ∅
  4. KNOWLEDGE scope nodes — every knowledge item where P ∈ scope.nodes
  5. KNOWLEDGE declared — every item in N.knowledge[]
  6. HIERARCHY — artifacts of each ancestor (root down to parent of N)
  7. OWN — N's node.yaml (raw from disk) and N's content artifacts (all .md matching config)
  8. RELATIONAL — for each structural relation: target's interface + errors (or fallback: artifacts filtered by config), annotate with consumes/failure from relation; for each event relation: event name + consumes
  9. ASPECTS — for each tag in T, content of matching aspect
  10. FLOWS — for each flow listing P as participant: flow artifacts + flow's knowledge[]
  Deduplicate knowledge globally (each item appears at most once).
- **No graph writes:** Core never creates or modifies node.yaml, artifacts, knowledge. Only reads. Drift-sync and journal commands write operational metadata via io layer.
- **Broken references block:** buildContext throws if relation target missing. validate reports E004 for broken relations. resolveDeps throws on cycles.
- **Token heuristic:** estimateTokens uses ~4 chars/token. Budget thresholds from config.quality.context_budget.
- **Structural relations acyclic:** uses, calls, extends, implements must not form cycles. emits, listens may cycle (event relations do not create dependency edges). Cycles involving at least one blackbox node are tolerated.
