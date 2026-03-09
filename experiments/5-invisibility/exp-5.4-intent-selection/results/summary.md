# Summary — Experiment 5.4: Intent-Based Automatic Node Selection

## Hypothesis

**H1**: An automatic selection algorithm can identify relevant graph nodes with ≥85% precision@K and ≥75% recall@K.

## Verdict: INVEST (with caveats)

## Aggregate Results

| Algorithm | Precision@K | Recall@K | F1@K |
|---|---|---|---|
| S1 (Keyword) | **0.89** | **0.96** | **0.90** |
| S2 (Flow-based) | 0.61 | 0.99 | 0.71 |
| S3 (Relation traversal) | 0.51 | 0.99 | 0.64 |

## Success Criteria Evaluation

| Metric | Threshold | Result | Met? |
|---|---|---|---|
| Best algorithm Precision@K | ≥85% | S1: **89%** | YES |
| Best algorithm Recall@K | ≥75% | S1: **96%** | YES |
| Ambiguous task handling | ≥1 relevant node | All algorithms: **3/3 tasks** | YES |

## Key Findings

1. **S1 (keyword matching) is the clear winner.** Simple weighted keyword search against graph artifacts achieves 89% precision and 96% recall across 30 tasks and 3 repos in 2 languages (Python, Go, TypeScript).

2. **Graph artifacts are written in task-compatible vocabulary.** The reason keyword matching works so well is that responsibility.md and interface.md use the same terms developers use in task descriptions. The graph is already optimized for intent matching — by design.

3. **Flow-based selection (S2) is a useful complement for ambiguous tasks.** When keyword signal is weak, falling back to flow participant selection provides broader coverage. An ensemble (S1 primary, S2 fallback for low-confidence matches) would likely outperform either alone.

4. **Relation traversal (S3) adds no value at this graph scale.** Hub nodes cause traversal to select nearly everything, destroying precision. S3 may become useful for larger graphs (50+ nodes) where traversal reveals non-obvious connections.

5. **Cross-module and constraint-aware tasks are the sweet spot.** S1 achieves perfect 1.00/1.00/1.00 precision/recall/F1 on all cross-module, flow-spanning, and constraint-aware tasks across all repos. These are exactly the tasks where automatic selection provides the most value.

## Recommendation

**Build `yg build-context --task "description"` using S1 (keyword matching) as the primary algorithm.**

Implementation plan:
1. Tokenize task description, remove stop words
2. Search all node artifacts with weights: responsibility=3, interface=2, internals=1, aspect=2
3. Score nodes by weighted keyword hit count
4. Select top-K nodes (K = min(5, nodes with score > 0))
5. If no node scores above threshold: fall back to S2 (match against flow descriptions, select flow participants)

Estimated implementation effort: Low (keyword search against YAML/Markdown files, no ML infrastructure needed).

## Caveats

- Results are from 5-6 node graphs. Validation on 20+ node graphs is needed before shipping.
- S4 (semantic/embedding) was not tested. It could outperform S1 for paraphrased or indirect task descriptions.
- The 89% precision means ~1 in 10 selected nodes is irrelevant — acceptable token waste, not a correctness problem.

## Decision: INVEST

- **What to build:** `yg build-context --task "description"` with S1 + S2 fallback
- **Priority:** MEDIUM-HIGH (enables zero-prompt delivery for exp 5.3)
- **Next step:** Validate on a 20+ node graph to confirm S1 precision holds at scale
