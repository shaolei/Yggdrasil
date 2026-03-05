# Experiment 4.8: Greenfield with Novel Domain — Methodology

## Objective

Test whether the graph-first greenfield workflow produces equally high-quality implementations for a truly novel domain that has minimal representation in LLM training data, compared to the 4.93/5.0 score achieved in Experiment 4.2 with a familiar domain (webhook relay).

## Domain Selection: Temporal Recipe Orchestrator

### Why this domain is novel

The "Temporal Recipe Orchestrator" was designed to avoid mapping cleanly to any standard software pattern:

1. **Not a standard scheduler**: While it has scheduling elements, the core challenge is temporal ordering with environmental adjustments and cascading contamination — no standard job scheduler handles these.

2. **Not a standard inventory system**: The atomic allocation with priority-based conflict resolution under physical safety constraints (stoichiometric ratios) differs from standard inventory management (e.g., e-commerce stock).

3. **Not a standard process orchestrator**: Standard process orchestrators (Temporal, Camunda, Step Functions) do not model environmental conditions affecting step duration, nor do they model contamination cascading through shared physical equipment.

4. **Not a standard chemical simulation**: Chemical process simulators (ASPEN, ChemCAD) model chemistry, not the scheduling and resource management around chemistry. This system sits between the chemistry and the scheduling in a gap that standard tools do not occupy.

5. **Domain-specific cross-cutting concerns**: Contamination propagation, temporal monotonicity within recipes, and reagent atomicity are not standard cross-cutting concerns that appear in typical software systems. They were invented for this experiment specifically because they resist pattern matching to known concerns.

### Domain characteristics that make it challenging

- **Multiple interacting time domains**: Phase timing (100ms ticks), environmental monitoring (continuous), recipe timeout (total duration), grace periods (per-phase), cascade depth tracking (per-event chain)
- **Cascading failures**: A failure in one recipe can contaminate shared equipment, affecting other recipes, which may themselves fail and contaminate their equipment — recursive, depth-limited
- **Mixed synchronous/asynchronous execution**: Contamination handling must be synchronous (same tick); phase execution is asynchronous (promise-based); reagent allocation is synchronous
- **Competing resource allocation**: Multiple recipes compete for shared reagents and equipment, with priority-based conflict resolution
- **Environmental feedback loops**: Environmental conditions affect phase duration, which affects equipment occupancy, which affects which recipes can run, which affects environmental conditions on shared equipment

## Approach

### Step 1: Graph creation (graph-first)

Following the Yggdrasil greenfield workflow from the agent rules:

1. **Aspects first** — identified 3 cross-cutting requirements:
   - `contamination-propagation`: Equipment-scoped failure cascading with depth limits
   - `temporal-monotonicity`: Strict sequential phase ordering within a recipe
   - `reagent-atomicity`: All-or-nothing reagent allocation from shared inventory

2. **Flow next** — created `recipe-execution` flow describing the end-to-end business process with happy path, 4 failure paths, and 6 invariants

3. **Nodes last** — created 4 leaf nodes with full artifacts:
   - `orchestrator/scheduler` — central coordinator (responsibility, interface, internals)
   - `orchestrator/phase-engine` — phase execution (responsibility, interface, internals)
   - `inventory/reagent-manager` — atomic inventory (responsibility, interface, internals)
   - `environment/condition-monitor` — environmental sensing (responsibility, interface, internals)

Plus 3 parent module nodes (orchestrator, inventory, environment) with responsibility.md only.

### Step 2: Context package assembly

Since the experiment graph is standalone (not registered in the main Yggdrasil repo), context packages were assembled manually following the exact format produced by `yg build-context`:

- `<global>` section from config.yaml
- `<hierarchy>` section from parent node artifacts
- `<own>` section with node.yaml, responsibility.md, interface.md, internals.md
- `<aspects>` section with effective aspect content
- `<relational>` section with dependency interfaces and flow participation

The format was verified by comparing against a real `yg build-context` output from the Yggdrasil repository.

### Step 3: Implementation from context packages only

For each of the 4 nodes, the implementation was written using ONLY the context package for that node. The graph files were not referenced during implementation — the context package was the sole input.

Each implementation includes:
- All exported types matching the interface.md definitions
- All error classes matching the failure modes
- All public methods with signatures from interface.md
- Internal logic from internals.md pseudocode
- Error handling from failure modes
- State management from internals state declarations
- Design decisions reflected in implementation choices

### Step 4: Scoring

Each implementation was scored on the 1-5 scale defined in the experiment specification:

- **5**: Fully implementable from context alone, no ambiguity
- **4**: Minor gaps but clear intent
- **3**: Significant assumptions needed
- **2**: Major gaps, would need to ask questions
- **1**: Context insufficient, would start from scratch

The scoring methodology:

1. **Type fidelity**: Do all types match the interface.md exactly?
2. **Method completeness**: Are all public methods implemented with correct signatures?
3. **Error handling**: Are all failure modes handled per specification?
4. **Algorithm accuracy**: Does the implementation match the internals.md pseudocode?
5. **Aspect compliance**: Does the implementation honor all applicable aspects?
6. **Gaps**: How many implementation decisions required assumptions not covered by the context?
7. **Ambiguities**: How many places had multiple valid interpretations?

## Comparison baseline

Experiment 4.2 scored 4.93/5.0 on a webhook relay domain, which is a well-known pattern in software engineering (event routing, retry logic, delivery confirmation). That domain benefits from extensive representation in training data.

This experiment specifically targets a domain with minimal training data representation to isolate the graph's contribution from the model's prior knowledge.

## Threats to validity

1. **Same author for graph and implementation**: The same agent created the graph and implemented it, which may introduce bias (the graph is written in a way that the same author can easily implement). In a real scenario, different agents or different people might create graph vs implementation.

2. **Graph quality may be artificially high**: Since this is an experiment, the graph was crafted carefully. In practice, graphs created under time pressure or by less experienced authors may have more gaps.

3. **Single implementation sample**: Only one implementation was produced per node. Multiple independent implementations would provide stronger evidence.

4. **Self-assessment bias**: The implementer scoring their own implementation may over- or under-rate quality. An independent reviewer would provide a more objective assessment.

5. **Domain complexity conflated with novelty**: The temporal recipe orchestrator is both novel AND complex. It is difficult to separate whether any score reduction is due to novelty or complexity. A novel-but-simple domain would isolate the novelty factor better.
