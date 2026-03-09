# Summary — Exp 5.3 Zero-Prompt Pilot (DRF)

## Aggregate Scores

| Condition | Total (max 125) | % of Max | vs C0 | vs C1 |
|-----------|-----------------|----------|-------|-------|
| C0 (no graph) | 76 | 60.8% | — | 62.8% |
| C1 (manual yg) | 121 | 96.8% | +59.2% | — |
| C3 (lazy injection) | 125 | 100% | +64.5% | 103.3% |

## Key Findings

### C3 exceeds C1

C3 scored HIGHER than C1 (125 vs 121). This is because C3 eliminates the yg protocol overhead (agent doesn't need to learn/execute `yg owner`, `yg build-context` etc.), while receiving the same architectural information pre-assembled. The 4-point difference comes entirely from the Efficiency dimension — C1 loses 1 point per task on protocol execution overhead.

**Caveat**: This is a simulation. In reality, C1's advantage is that the agent can dynamically request MORE context when needed (e.g., `yg impact` for blast radius). C3's context is pre-assembled and fixed — if the wrong nodes are selected, the agent has no recourse. The simulation assumes perfect node selection for C3, which is optimistic.

### C3 dramatically beats C0

The gap is largest on constraint-aware tasks (T05: 25 vs 9) and refactoring tasks (T03: 25 vs 14). These are tasks where the code alone doesn't reveal WHY things are the way they are.

The gap is smallest on straightforward feature addition (T02: 25 vs 19) and cross-module tasks (T04: 25 vs 18), where a competent agent can trace the code path through careful reading.

### Graph context matters most for:

1. **Constraint-aware tasks** (+16 points, +178%): Where non-obvious constraints must be respected. This is the highest-value category — the graph captures constraints invisible in code.
2. **Refactoring** (+11 points, +79%): Where understanding WHY code is structured a certain way prevents breaking subtle invariants (e.g., WrappedAttributeError).
3. **Bug investigation** (+9 points, +56%): Where the agent must determine if behavior is a bug or intentional design.
4. **Feature addition** (+6 points, +32%): Where architectural patterns (class-based-policy) guide correct placement.
5. **Cross-module** (+7 points, +39%): Where data flow across modules must be understood.

### Token overhead

| Condition | Context tokens per task (est.) | Notes |
|-----------|-------------------------------|-------|
| C0 | 0 | Agent reads source files on demand (~2000-5000 tokens per file) |
| C1 | ~500 (rules) + 3000-6000 (build-context calls) | Agent may call build-context 1-3 times |
| C3 | ~3500-5500 | Pre-assembled, no protocol overhead |

C3 is comparable to or slightly less than C1 in total context tokens, but more efficient because there's no wasted protocol/rules overhead.

## Honesty Check

The simulation has known optimistic biases for C3:

1. **Perfect node selection**: C3 assumes we correctly identify which nodes the task implies. In practice, file-to-node mapping may miss relevant context or include irrelevant context.
2. **No dynamic context**: C1 can call `yg impact` mid-task. C3 cannot request additional context.
3. **C0 may be underrated**: A very strong agent with extensive DRF knowledge might score higher on C0 than simulated. However, the simulation focuses on what an agent can derive from CODE ALONE, not prior training knowledge.
4. **C3 perfect scores are suspicious**: 5/5 across all dimensions for all tasks is likely too generous. In practice, even with perfect context, agents make implementation mistakes. A more realistic C3 total might be 115-120.

**Adjusted estimates** (conservative):

| Condition | Adjusted Total | Adjusted % of C1 |
|-----------|---------------|-------------------|
| C0 | 76 (unchanged) | 62.8% |
| C1 | 121 (unchanged) | — |
| C3 | 118 (adjusted -7) | 97.5% |

## Verdict

**C3 >= 80% of C1? YES** (97.5% conservatively, 103% optimistically)

**C3 > C0? YES** (+55% conservatively)

**Recommendation: PROCEED to full experiment.**

The pilot strongly suggests lazy injection is a viable strategy. The full experiment should:

1. Add C2 (eager) and C4 (query-driven) conditions
2. Use 15 tasks instead of 5
3. Run 3 repetitions per condition for variance control
4. Add a second repo (different language) for cross-stack validation
5. Test imperfect node selection (deliberately inject wrong/missing nodes for some C3 tasks)
6. Include tasks where graph context should NOT help (simple CRUD-like changes) to test for harmful context injection

## Risk to Investigate in Full Experiment

The biggest risk for C3 is **node selection accuracy**. If the system picks the wrong nodes for a task, C3 could deliver irrelevant or misleading context. The pilot assumes perfect selection. The full experiment must include a "noisy selection" sub-condition where 1-2 irrelevant nodes are included and 1 relevant node is omitted, to measure degradation.
