# Core Constraints

- **Determinism:** Same graph state always produces same context package, validation result, drift report. No heuristics, no guessing, no repository search.
- **Context assembly algorithm (fixed order):** For node N at path P with aspects A, buildContext executes in this order:
  1. GLOBAL — config.yaml (stack, standards)
  2. HIERARCHY — artifacts of each ancestor (root down to parent of N)
  3. OWN — N's node.yaml (raw from disk) and N's content artifacts (all .md matching config)
  4. ASPECTS — for each aspect in A (union from hierarchy + own + flow blocks, expanded via implies), content of matching aspect
  5. RELATIONAL — for each structural relation: target's structural_context artifacts (or fallback: all configured artifacts), annotate with consumes/failure from relation; for each event relation: event name + consumes; for each participating flow: flow artifacts
- **No graph writes:** Core never creates or modifies node.yaml or artifacts. Only reads. Drift-sync and journal commands write operational metadata via io layer.
- **Broken references block:** buildContext throws if relation target missing. validate reports E004 for broken relations. resolveDeps throws on cycles.
- **Token heuristic:** estimateTokens uses ~4 chars/token. Budget thresholds from config.quality.context_budget.
- **Structural relations acyclic:** uses, calls, extends, implements must not form cycles. emits, listens may cycle (event relations do not create dependency edges). Cycles involving at least one blackbox node are tolerated.
