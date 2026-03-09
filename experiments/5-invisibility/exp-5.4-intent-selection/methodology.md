# Experiment 5.4: Intent-Based Automatic Node Selection

## Hypothesis

**H1**: Given a task description (natural language intent), an automatic selection
algorithm can identify the relevant graph nodes with ≥85% precision@K and achieve
≥90% of the blindfold score of manually selected nodes.

**H0**: Task descriptions are too ambiguous for automatic selection. Either the
algorithm selects wrong nodes (precision <70%) or misses critical nodes (recall <60%),
degrading the context package below the no-graph baseline.

## Product Question

**Should Yggdrasil invest in query-aware context assembly (`yg build-context --task
"description"`)?** If yes, which selection algorithm works best: keyword matching,
flow-based, relation-graph traversal, or semantic embedding?

## Why This Matters

Exp 3.4 showed that 4 well-chosen nodes = 92% of full graph quality. But "well-chosen"
required human intuition. If automatic selection works, the developer never needs to
know about nodes, aspects, or flows. They describe their task; the system delivers
exactly the context they need.

## Variables

| Type | Variable | Values |
|---|---|---|
| Independent | Selection algorithm | S1: keyword / S2: flow-based / S3: relation traversal / S4: semantic / S5: manual (reference) |
| Dependent | Precision@K | % of selected nodes that are actually relevant |
| Dependent | Recall@K | % of relevant nodes that are selected |
| Dependent | Blindfold score | Evaluator score using the selected context |
| Dependent | Token efficiency | Context tokens vs full graph tokens |
| Controlled | Graph | Same reference graph |
| Controlled | Tasks | Same task set |
| Controlled | K | Dynamic, but capped at 8 nodes (token budget) |

## Prerequisites

- Reference graphs with ≥8 nodes per repo
- 3 repos
- 20 task descriptions per repo (diverse complexity)

## Repos

Use 3 repos from the candidate list. Ensure:
- Reference graph has ≥8 nodes (enough for selection to be non-trivial)
- Task descriptions span different modules (not all focused on same area)

## Selection Algorithms

### S1: Keyword Matching
1. Tokenize the task description into keywords (remove stop words)
2. Search all graph artifacts (responsibility.md, interface.md, aspect content) for
   keyword matches
3. Score each node: weighted sum of keyword hits across its artifacts
   - responsibility.md hit: weight 3 (identity/boundary)
   - interface.md hit: weight 2 (public API)
   - internals.md hit: weight 1 (implementation detail)
   - aspect content hit: weight 2 (cross-cutting concern)
4. Select top-K nodes by score

### S2: Flow-Based
1. Search flow descriptions for task keyword matches
2. If a matching flow is found: select ALL flow participants
3. If no matching flow: fall back to S1
4. Add infrastructure nodes that have relations to selected participants

Rationale: Exp 3.4 showed flow participation beats connectivity for node selection.

### S3: Relation Graph Traversal
1. Use S1 to find seed nodes (top 2 by keyword score)
2. From seed nodes, traverse the relation graph:
   - Add all direct dependents (nodes that depend on seeds)
   - Add all direct dependencies (nodes that seeds depend on)
   - Add infrastructure nodes adjacent to any selected node
3. Limit to K total nodes (prefer closer nodes in traversal order)

### S4: Semantic Search
1. Generate an embedding (or use LLM-based similarity) for the task description
2. Generate embeddings for each node's combined artifacts (responsibility + interface)
3. Select top-K nodes by cosine similarity
4. Add infrastructure nodes adjacent to any selected node

Note: This can be simulated by asking an LLM "which of these node descriptions is
most relevant to this task?" with all node responsibility.md summaries listed.

### S5: Manual Selection (reference)
A human expert reads the task description and selects the relevant nodes.
This is the gold standard. All algorithms are compared against this.

## Protocol

### Phase 1: Task Design (per repo)

Create 20 task descriptions spanning the target area. Each task:
- Is described in 1-3 sentences (natural language, not technical spec)
- Requires 2-6 nodes of context (not trivially single-node)
- Has a known correct set of relevant nodes (determined by expert)

**Task complexity distribution:**

| Complexity | Count | Description | Example |
|---|---|---|---|
| **Single-module** | 5 | Task touches one module | "Add validation to X input" |
| **Cross-module** | 5 | Task spans 2-3 modules | "When X happens, also update Y" |
| **Flow-spanning** | 5 | Task involves a business process | "Fix the checkout flow when payment fails" |
| **Constraint-aware** | 3 | Task must respect non-obvious constraint | "Add caching to X" (locking constraint) |
| **Ambiguous** | 2 | Task description is vague | "Improve performance of the team system" |

The "ambiguous" tasks test how algorithms handle imprecise input.

**Task specification format:**
```yaml
id: T01
description: "When a team collection is moved to a new parent, the ordering
              of sibling collections is sometimes incorrect."
complexity: cross-module
relevant_nodes:
  - team-collections/team-collection-service  # primary
  - team-collections/team-collection-model    # secondary
  - team-collections                          # parent context
relevant_aspects:
  - pessimistic-locking                       # ordering uses locking
relevant_flows:
  - team-collection-lifecycle                 # move is part of lifecycle
ideal_context_nodes: 4                        # how many nodes an expert would load
```

**Output**: `tasks/task-set.yaml`

### Phase 2: Algorithm Implementation

Implement each selection algorithm as a reproducible procedure. For each algorithm:
1. Document the exact steps (pseudocode level)
2. Define all parameters (weights, K limits, traversal depth)
3. Make the procedure deterministic (no random elements)

For S4 (semantic), document the exact similarity method used (which model, what
prompt for LLM-based similarity).

**Output**: `algorithms/S<N>.md` per algorithm

### Phase 3: Selection Execution (per repo, per algorithm, per task)

For each (algorithm, task) pair:
1. Run the algorithm on the task description
2. Record the selected nodes (ordered by algorithm's confidence/score)
3. Record the algorithm's confidence scores per node (if applicable)
4. Record wall-clock time (for practical feasibility)

**Output**: `selections/S<N>/T<M>.yaml` per (algorithm, task) with:
```yaml
algorithm: S1
task: T01
selected_nodes:
  - node: team-collections/team-collection-service
    score: 0.87
    rank: 1
  - node: team-collections/team-collection-model
    score: 0.65
    rank: 2
  ...
total_time_ms: 150
```

### Phase 4: Selection Quality Evaluation

For each (algorithm, task), compare selected nodes vs expert reference:

| Metric | Definition |
|---|---|
| Precision@K | (# selected that are in reference) / (# selected) |
| Recall@K | (# selected that are in reference) / (# in reference) |
| F1@K | Harmonic mean |
| First-relevant rank | Rank of the first correctly selected node |
| Wasted tokens | Context tokens from irrelevant selected nodes |

Compute aggregate metrics:
- Mean Precision@K across all tasks
- Mean Recall@K across all tasks
- Precision@K by task complexity category
- Failure cases: tasks where algorithm selected 0 relevant nodes

**Output**: `evaluation/selection-quality.md`

### Phase 5: Downstream Task Quality (per repo)

For a subset of 10 tasks (removing the 5 single-module tasks — too easy):

1. Assemble context packages using each algorithm's selected nodes
2. Run blindfold evaluation (same 3 questions per task about the task's domain)
3. Compare scores across algorithms

**Conditions:**

| Condition | What evaluator receives |
|---|---|
| B0 | No graph (raw source code) |
| S1-context | `yg build-context` for S1-selected nodes |
| S2-context | `yg build-context` for S2-selected nodes |
| S3-context | `yg build-context` for S3-selected nodes |
| S4-context | `yg build-context` for S4-selected nodes |
| S5-context | `yg build-context` for expert-selected nodes |
| B1 | `yg build-context` for ALL nodes (full graph, token-heavy) |

For each condition, evaluator answers task-specific questions (not the standard
15 diagnostic questions — these are targeted to the task's domain).

**Task-specific questions** (3 per task):
1. What components are involved in this task? (Factual)
2. What constraints or patterns must be respected? (Constraint)
3. What could go wrong if you change X without considering Y? (Impact)

**Output**: `evaluation/downstream-quality.md`

### Phase 6: Token Efficiency Analysis

For each algorithm:
- Mean context tokens per task
- Comparison to full graph (B1) token count
- Token waste: (tokens from irrelevant nodes) / (total context tokens)
- "Quality per token": blindfold score / context tokens

This identifies the best quality/cost trade-off.

**Output**: `evaluation/token-efficiency.md`

### Phase 7: Failure Mode Analysis

For each algorithm, analyze its failures:

| Failure mode | Description | Impact |
|---|---|---|
| **Missing core node** | Algorithm missed the primary node for the task | Critical |
| **Missing auxiliary node** | Algorithm missed a secondary relevant node | Medium |
| **Irrelevant inclusion** | Algorithm selected a non-relevant node | Low (token waste) |
| **Aspect blindness** | Algorithm didn't consider aspect-affected nodes | High |
| **Flow blindness** | Algorithm didn't consider flow participants | High |
| **Infrastructure miss** | Algorithm missed guards/middleware | High |

For each failure mode, count occurrences per algorithm.

**Output**: `evaluation/failure-modes.md`

## Success Criteria

| Metric | INVEST threshold | ITERATE threshold | ABANDON threshold |
|---|---|---|---|
| Best algorithm Precision@K | ≥85% | 70-84% | <70% |
| Best algorithm Recall@K | ≥75% | 60-74% | <60% |
| Downstream quality vs S5 | ≥90% of S5 score | 75-89% | <75% |
| Downstream quality vs B0 | >B0 + 15% | >B0 + 5% | ≤B0 |
| Token efficiency vs B1 | ≤50% of B1 tokens | ≤75% | >75% |
| Ambiguous task handling | Selects ≥1 relevant node for both | Selects ≥1 for one | Selects 0 |

## Decision Framework

**If INVEST:**
- Build `yg build-context --task "description"` with the winning algorithm
- If S2 (flow-based) wins: flow participation is the primary selection signal
- If S4 (semantic) wins: invest in embedding infrastructure for graph artifacts
- If S3 (traversal) wins: relation graph is the primary signal
- If multiple algorithms are close: build ensemble (S2 for flow tasks, S1 for simple)
- Priority: MEDIUM-HIGH (enables zero-prompt delivery in exp 5.3)

**If ITERATE:**
- Test ensemble approaches (combine algorithms)
- Test interactive refinement (algorithm proposes, agent requests more)
- Test whether adding task CATEGORY as input improves selection
  (e.g., "bug_fix: team-collection-service" vs "team-collection-service bug")

**If ABANDON:**
- Manual node selection remains required
- Simplify the manual protocol instead (e.g., better `yg tree` output)
- Consider: is the problem the algorithms or the task descriptions?

## Known Risks

1. **Task description quality varies.** Developers describe tasks differently.
   "Fix the reorder bug" vs "Users report that when they drag collections to
   reorder them, the order is sometimes wrong" — same task, very different signal.
   Include both styles in task set.

2. **S4 (semantic) may be unfairly advantaged.** Using an LLM for semantic matching
   AND for evaluation creates a potential circularity. Mitigate: use different
   models for matching vs evaluation, or use embedding-based matching (not LLM).

3. **Graph size matters.** With only 8 nodes, even random selection hits relevant
   nodes sometimes. Results may not generalize to 50+ node graphs. Document this
   limitation.

4. **K selection is critical.** Too small K → misses nodes. Too large K → token
   waste. Test multiple K values (3, 5, 8) and report sensitivity.

## Estimated Duration

- Phase 1 (tasks): 2 hours per repo
- Phase 2 (algorithms): 3-4 hours total (implement once, reuse across repos)
- Phase 3 (execution): 1-2 hours per repo (80 algorithm-task pairs, mostly automated)
- Phase 4 (selection quality): 1-2 hours per repo
- Phase 5 (downstream): 5-8 hours per repo (70 evaluations × 3 runs at ~5 min)
- Phase 6-7 (analysis): 2-3 hours per repo
- Total: ~35-45 hours of agent time
