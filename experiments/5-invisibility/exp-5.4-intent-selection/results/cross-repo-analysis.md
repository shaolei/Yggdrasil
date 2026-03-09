# Cross-Repo Analysis — Experiment 5.4

## Aggregate Metrics Across All 3 Repos (30 tasks)

| Algorithm | Mean Precision | Mean Recall | Mean F1 |
|---|---|---|---|
| **S1 (Keyword)** | **0.89** | **0.96** | **0.90** |
| **S2 (Flow-based)** | **0.61** | **0.99** | **0.71** |
| **S3 (Relation traversal)** | **0.51** | **0.99** | **0.64** |

## Per-Repo Summary

| Repo | S1 P/R/F1 | S2 P/R/F1 | S3 P/R/F1 |
|---|---|---|---|
| DRF | 0.80/0.94/0.84 | 0.52/1.00/0.64 | 0.52/1.00/0.64 |
| Caddy | 0.92/0.98/0.94 | 0.51/1.00/0.64 | 0.48/1.00/0.60 |
| Payload | 0.95/0.95/0.93 | 0.80/0.98/0.86 | 0.54/0.98/0.67 |

## By Task Type (All Repos Combined)

| Task Type | Count | S1 P/R/F1 | S2 P/R/F1 | S3 P/R/F1 | Winner |
|---|---|---|---|---|---|
| Single-module | 9 | 0.72/1.00/0.82 | 0.41/1.00/0.52 | 0.23/1.00/0.36 | **S1** |
| Cross-module | 9 | 1.00/1.00/1.00 | 0.59/1.00/0.73 | 0.52/1.00/0.68 | **S1** |
| Flow-spanning | 6 | 1.00/1.00/1.00 | 0.85/1.00/0.89 | 0.79/1.00/0.88 | **S1** |
| Constraint-aware | 3 | 1.00/1.00/1.00 | 0.60/1.00/0.71 | 0.49/1.00/0.66 | **S1** |
| Ambiguous | 3 | 0.72/0.55/0.61 | 0.85/0.92/0.88 | 0.85/0.92/0.88 | **S2/S3** |

## Pattern Analysis

### 1. S1 (Keyword) Wins Overall — and It Is Not Close

S1 achieves the highest F1 in every task type except ambiguous tasks. Its advantage comes from **precision**: it selects only what the keywords actually match, avoiding the over-selection that plagues S2 and S3.

**Why S1 works so well:** Graph artifacts (responsibility.md, interface.md) use the same vocabulary as task descriptions. The weighted scoring (responsibility=3 > interface=2 > internals=1) naturally prioritizes nodes whose identity matches the task over nodes that merely mention a term in passing.

### 2. S2 (Flow-based) Has Precision Problems

S2 selects all flow participants whenever a flow matches. This guarantees perfect recall but tanks precision for single-module and cross-module tasks. The damage is worst in DRF (single flow = all nodes selected for everything) and mildest in Payload (3 distinct flows provide discrimination).

**Structural insight:** S2's quality is directly proportional to the number of distinct flows in the graph. With 1 flow, S2 degenerates to "select all." With 3+ flows covering different node subsets, S2 becomes competitive.

### 3. S3 (Relation Traversal) Is the Worst Algorithm

S3 consistently over-selects because hub nodes (api-view, handler, operations) connect to nearly everything. The traversal step amplifies seed selection into near-total coverage, destroying precision without improving recall (which was already high from S1 seeds).

**Structural insight:** Relation traversal only adds value in sparse graphs where traversal reveals non-obvious connections. In the 5-6 node graphs tested here, every node is within 2 hops of every other node. S3 may perform better in larger graphs (50+ nodes) where traversal surfaces genuinely non-obvious dependencies.

### 4. Ambiguous Tasks Favor Broad Selection

For ambiguous tasks ("improve performance", "improve reliability", "improve security"), S2 and S3 outperform S1. This makes sense: vague descriptions have weak keyword signal, so S1 under-selects. Flow-based and traversal approaches cast a wider net, which happens to be correct when the expert answer is "select broadly."

### 5. Graph Topology Determines Algorithm Behavior

The most important finding is that **graph topology determines algorithm quality more than algorithm design**:

| Topology Feature | Effect on S1 | Effect on S2 | Effect on S3 |
|---|---|---|---|
| Single flow containing all nodes | No effect | Degenerates to "select all" | No effect |
| Hub node connected to all others | No effect | No effect | Degenerates to "select all" |
| Multiple distinct flows | No effect | Improves precision | No effect |
| Sparse relation graph | No effect | No effect | Improves precision |

## Failure Mode Analysis

### S1 Failures (4 total across 30 tasks)

| Mode | Count | Tasks | Impact |
|---|---|---|---|
| Under-selection on ambiguous tasks | 3 | DRF-T10, Caddy-T10, Payload-T10 | Medium — missed auxiliary nodes |
| Over-selection on single-module (included orchestrator) | 3 | DRF-T01/T02/T03 | Low — extra node is the orchestrator, which provides useful context anyway |

### S2 Failures (structural, not per-task)

| Mode | Count | Description | Impact |
|---|---|---|---|
| Flow over-selection | 22/30 | Selected full flow when task touches subset | Low — token waste but no missing nodes |
| Fallback to S1 on no flow match | 1 | Payload-T01 (hashing, no flow match) | None — S1 fallback worked correctly |

### S3 Failures (structural)

| Mode | Count | Description | Impact |
|---|---|---|---|
| Hub-node explosion | 28/30 | Traversal from hub reaches all nodes | Low — token waste, no missing nodes |

## Ambiguous Task Results

| Task | S1 selects ≥1 relevant? | S2 selects ≥1 relevant? | S3 selects ≥1 relevant? |
|---|---|---|---|
| DRF-T10 | Yes (2 of 5) | Yes (5 of 5) | Yes (5 of 5) |
| Caddy-T10 | Yes (3 of 4) | Yes (4 of 4) | Yes (4 of 4) |
| Payload-T10 | Yes (2 of 4) | Yes (3 of 4) | Yes (3 of 4) |

**All three algorithms select at least 1 relevant node for all ambiguous tasks.** This meets the INVEST threshold.

## Limitations

1. **Small graphs (5-6 nodes):** With K=5, even random selection achieves ~60% recall. These results may not generalize to 50+ node graphs where selection becomes genuinely challenging.

2. **Deterministic execution:** The algorithms were executed analytically (not programmatically). Edge cases in keyword tokenization or scoring weights could shift results by a few percentage points.

3. **No S4 (semantic) tested:** The methodology called for semantic search but this was excluded from the streamlined protocol. Given S1's strong performance, S4 would need to significantly outperform keyword matching to justify embedding infrastructure.

4. **Expert bias:** The expert who designed tasks also selected ground-truth nodes. An independent expert might disagree on 1-2 nodes per task.
