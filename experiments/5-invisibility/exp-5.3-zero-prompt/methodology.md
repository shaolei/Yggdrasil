# Experiment 5.3: Zero-Prompt Context Delivery

## Hypothesis

**H1**: Automatically injecting graph context (without explicit `yg` commands in agent
rules) achieves ≥95% of the task accuracy of the manual `yg` protocol, while reducing
agent-rules overhead to zero.

**H0**: Automatic injection either delivers wrong context (degrading accuracy below B0)
or delivers too much context (token waste >50%), making it worse than the manual protocol.

## Product Question

**Should Yggdrasil invest in an IDE extension / agent hook that automatically injects
context?** If yes, what injection strategy works best: eager (inject on file open),
lazy (inject on task start), or query-driven (inject based on task description)?

## Why This Experiment is Different

Previous experiments measured graph QUALITY. This experiment measures graph DELIVERY.
A perfect graph is useless if the agent doesn't use it. Currently, using Yggdrasil
requires ~500 lines of agent-rules.md that teach the agent HOW to use `yg` commands.
The invisibility goal means eliminating this entirely.

## Variables

| Type | Variable | Values |
|---|---|---|
| Independent | Context delivery method | C0: no graph / C1: manual yg protocol / C2: eager injection / C3: lazy injection / C4: query-driven injection |
| Dependent | Task accuracy | Correctness of agent's code changes (see Evaluation) |
| Dependent | Task completeness | % of task requirements satisfied |
| Dependent | Harmful changes | Code changes that break existing behavior |
| Dependent | Token overhead | Tokens consumed by context (prompt overhead) |
| Dependent | Irrelevant context | % of injected context not used by agent |
| Controlled | Graph quality | Same reference graph for all conditions |
| Controlled | Tasks | Same task set across all conditions |
| Controlled | Agent capability | Same model, same system prompt (minus yg rules for C2-C4) |

## Prerequisites

- Reference graphs from exp 5.1 or 5.5
- 2 repos with full graphs (reduced to 2 because this experiment is the most expensive)
- Working `yg` CLI
- A mechanism to inject context into agent prompts (can be simulated — see below)

## Repos

Use 2 repos from the candidate list. Ensure:
- At least 2 languages represented
- Reference graph has ≥6 nodes (enough for context selection to matter)

## Injection Strategies

### C0: No graph (baseline)
Agent receives only: task description + access to source code files.
No Yggdrasil, no graph, no agent-rules about `yg`.

### C1: Manual yg protocol (current state)
Agent receives: task description + full agent-rules.md (with `yg` protocol) + access
to source code files + access to `yg` CLI.
This is how Yggdrasil works today.

### C2: Eager injection
When the agent opens or reads a source file, the system automatically:
1. Runs `yg owner --file <path>`
2. If mapped: runs `yg build-context --node <owner>`
3. Prepends the context package to the file content (as a header comment block)
4. Agent sees enriched file content, not raw file

Agent receives: task description + access to enriched source files.
Agent does NOT receive agent-rules.md or knowledge that Yggdrasil exists.

**Simulation**: A preprocessing step enriches all target area files with their context
packages before the agent session begins. Files outside the target area remain raw.

### C3: Lazy injection
At the start of the agent session, the system:
1. Identifies which files the task description mentions or implies
2. Runs `yg owner` + `yg build-context` for those files
3. Injects the context packages into the system prompt as "Background context"

Agent receives: task description + background context + access to raw source files.
Agent does NOT receive agent-rules.md or knowledge that Yggdrasil exists.

**Simulation**: Before the agent session, a preprocessing step analyzes the task
description, identifies likely relevant files, and assembles context packages. These
are included in the system prompt.

### C4: Query-driven injection
At the start of the agent session, the system:
1. Takes the task description
2. Searches graph artifacts (responsibility.md, interface.md, aspect content) for
   semantic matches to the task
3. Selects top-K relevant nodes based on search results
4. Assembles context packages for selected nodes
5. Injects into system prompt as "Relevant architectural context"

Agent receives: task description + relevant context + access to raw source files.
Agent does NOT receive agent-rules.md or knowledge that Yggdrasil exists.

**Simulation**: Before the agent session, a preprocessing step searches the graph
with the task description as query and assembles the context. This is included in
the system prompt.

**Note**: C4 overlaps with exp 5.4 (intent-based selection). The difference:
5.4 measures SELECTION quality. 5.3 measures end-to-end TASK ACCURACY.

## Protocol

### Phase 1: Task Design (per repo)

Create 15 realistic coding tasks across the target area. Each task:
- Has a clear, unambiguous goal
- Requires understanding 1-3 modules
- Has a verifiable correct solution
- Varies in complexity

**Task categories (3 tasks each):**

| Category | Description | Example |
|---|---|---|
| **Bug fix** | Fix a described bug | "Users report error X when doing Y. Find and fix." |
| **Feature addition** | Add a small feature | "Add a `description` field to collections." |
| **Refactor** | Improve structure without changing behavior | "Extract validation logic into a separate function." |
| **Cross-module change** | Change that spans modules | "When a team is deleted, also clean up invitations." |
| **Constraint-aware change** | Change that must respect a non-obvious constraint | "Add caching to method X" (where the constraint is that X uses pessimistic locking) |

**Task specification format:**
```yaml
id: T01
category: bug_fix
description: "Users report that reordering collections sometimes loses items.
              The bug is in the moveCollection method."
target_files:
  - <files the task touches>
requires_cross_module: false
requires_constraint_knowledge: false
has_aspect_interaction: false
correct_solution_summary: "The bug is caused by..."
verification:
  - "moveCollection no longer loses items when..."
  - "Existing tests still pass"
```

**Critical**: Include at least 5 tasks where the correct solution DEPENDS on
information captured in the graph but not obvious from code alone (e.g., "why NOT"
decisions, ordering constraints, aspect patterns). These are the tasks where
graph context should make a measurable difference.

**Output**: `tasks/task-set.yaml`

### Phase 2: Correct Solution Preparation (per repo)

For each task, prepare:
1. The correct code change (diff)
2. Why this is correct (explaining the reasoning)
3. Common mistakes an agent might make WITHOUT graph context
4. What graph information prevents each mistake

**Output**: `tasks/solutions/T<N>.md` per task

### Phase 3: Context Preparation (per repo)

Prepare the injected context for each condition:

**C2 (eager):**
- For each file in target area: prepend `yg build-context` output as header
- Store enriched files in `contexts/C2/`

**C3 (lazy):**
- For each task: identify files mentioned/implied in task description
- Run `yg owner` + `yg build-context` for those files
- Store assembled context per task in `contexts/C3/T<N>.md`

**C4 (query-driven):**
- For each task: search graph artifacts for task-relevant nodes
- Select top-K nodes (K ≤ 5 to stay within token budget)
- Store assembled context per task in `contexts/C4/T<N>.md`

**Output**: `contexts/` directory with per-condition, per-task context

### Phase 4: Task Execution (per repo, per condition)

For each condition × each task × 3 runs:

1. Set up a fresh agent session with the condition's context
2. Give the agent the task description
3. Let the agent work (read files, propose changes)
4. Capture the agent's proposed code change (diff)
5. Record: tokens consumed, files read, context tokens injected

**Agent prompt template (C2/C3/C4):**
```
You are a software engineer working on [repo name].

[For C3/C4: BACKGROUND CONTEXT section with assembled context]

TASK: [task description]

Analyze the code, understand the problem, and propose a fix.
Output your change as a unified diff.
```

Note: NO mention of Yggdrasil, no `yg` commands, no graph protocol.

**Agent prompt template (C1 — manual):**
```
You are a software engineer working on [repo name].

[Full agent-rules.md with yg protocol]

TASK: [task description]

Follow the Yggdrasil protocol to understand the code, then propose a fix.
Output your change as a unified diff.
```

**Output**: `runs/<condition>/T<N>-run<R>.md` with proposed diff + token stats

### Phase 5: Task Scoring

Score each proposed change on 5 dimensions:

| Dimension | 5 (excellent) | 3 (adequate) | 1 (poor) |
|---|---|---|---|
| **Correctness** | Fix is correct, handles all cases | Fix addresses main issue, minor gaps | Fix is wrong or incomplete |
| **Completeness** | All requirements met, edge cases covered | Main requirements met | Requirements partially met |
| **Safety** | No regressions, respects all constraints | Minor risk of regression | Breaks existing behavior |
| **Constraint respect** | Respects all non-obvious constraints (aspects, ordering) | Respects most constraints | Violates constraints |
| **Efficiency** | Minimal, focused change | Reasonable change, some unnecessary additions | Over-engineered or too broad |

**Total per task**: 25 points
**Total per condition**: 375 points (15 tasks × 25 points)

For each task also record:
- Did the agent make the common mistake identified in Phase 2?
- If yes, would graph context have prevented it?

**Output**: `scoring/<condition>/T<N>.md`

### Phase 6: Analysis

**Primary comparison** (paired by task):

| Comparison | Tests |
|---|---|
| C2 vs C1 | Does eager injection match manual protocol? |
| C3 vs C1 | Does lazy injection match manual protocol? |
| C4 vs C1 | Does query-driven injection match manual protocol? |
| C2/C3/C4 vs C0 | Does any injection beat no-graph baseline? |
| Token overhead C1 vs C2/C3/C4 | How much prompt space does each approach use? |

**Per-task-category breakdown:**
- Which task types benefit most from graph context?
- Which injection strategy works best for which task type?
- Where does injection HURT (wrong context degrades performance)?

**Failure analysis:**
- Tasks where C1 > C2/C3/C4: what went wrong with injection?
- Tasks where C0 > C2/C3/C4: injection delivered HARMFUL context
- Tasks where C2/C3/C4 > C1: manual protocol failed (agent didn't use `yg` correctly)

**Token efficiency:**
- Context tokens per task for each condition
- "Useful context ratio": tokens that influenced the correct answer / total context tokens

**Output**: `analysis/comparison.md`, `analysis/failures.md`, `analysis/efficiency.md`

## Success Criteria

| Metric | INVEST threshold | ITERATE threshold | ABANDON threshold |
|---|---|---|---|
| Best injection vs C1 accuracy | ≥95% of C1 | 85-94% | <85% |
| Best injection vs C0 accuracy | >C0 + 10% | >C0 + 5% | ≤C0 |
| Harmful context rate | <5% of tasks | 5-15% | >15% |
| Token overhead vs C1 | ≤C1 overhead | ≤150% of C1 | >150% of C1 |
| Constraint-aware tasks (C2/3/4 vs C0) | ≥30% improvement | 10-29% | <10% |

## Decision Framework

**If INVEST:**
- Build IDE extension / agent hook with the winning injection strategy
- If C4 wins: invest in semantic search infrastructure for graph artifacts
- If C3 wins: invest in task-to-file mapping heuristics
- If C2 wins: invest in file-level context enrichment (simplest to build)
- Priority: HIGH (eliminates agent-rules.md requirement entirely)

**If ITERATE:**
- Test hybrid approaches:
  - C2+C4 (eager for open files + query-driven for task context)
  - C3 with fallback to C2 (lazy first, enrich on file open if needed)
- Test context COMPRESSION (summarize context packages to reduce token waste)
- Test agent-side FILTERING (agent requests context when it needs it vs always injecting)

**If ABANDON:**
- The manual protocol (C1) remains the only viable delivery mechanism
- Invest in simplifying agent-rules.md instead
- Consider: is the problem injection strategy or graph quality?

## Known Risks

1. **Simulation vs real integration.** Pre-assembling context is not the same as
   real-time injection. Real integration would face latency, context window limits,
   and interaction effects. Results should be interpreted as upper-bound on what
   injection CAN achieve.

2. **C4 depends on search quality.** If the semantic search for graph artifacts is
   poor, C4 may inject wrong context. This risk is shared with exp 5.4.

3. **Task design bias.** If tasks are designed with graph knowledge in mind, they
   may inadvertently favor graph-enabled conditions. Mitigate: include 5 tasks that
   are straightforward and do NOT benefit from graph context.

4. **Most expensive experiment.** 5 conditions × 15 tasks × 3 runs = 225 agent sessions
   per repo. Consider: run pilot with 5 tasks first, then expand if promising.

## Pilot Protocol

Before full execution, run a pilot:
- 1 repo, 5 tasks (1 per category), 5 conditions, 1 run per condition
- If pilot shows C2/C3/C4 ≥ 80% of C1: proceed to full experiment
- If pilot shows C2/C3/C4 < 60% of C1: abandon or redesign injection strategy
- If pilot is inconclusive: run 3 more tasks before deciding

## Estimated Duration

- Phase 1-2 (tasks + solutions): 3-4 hours per repo
- Phase 3 (context prep): 2-3 hours per repo
- Phase 4 (execution): 15-20 hours per repo (225 runs at ~5 min each)
  - With pilot: 2-3 hours per repo (25 runs)
- Phase 5-6 (scoring + analysis): 4-5 hours per repo
- Total (full): ~50-60 hours per repo, ~100-120 hours total
- Total (pilot only): ~10-15 hours total
- Recommendation: pilot first, then expand only for promising conditions
