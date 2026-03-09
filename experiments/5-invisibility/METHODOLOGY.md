# Experiment Series 5: Invisibility — Common Methodology

## Goal

Validate that Yggdrasil can become invisible to developers: automatic construction,
automatic maintenance, automatic context delivery. The developer writes code; the
graph lives in the background like `.git/`.

## Series-Level Principles

### 1. Pre-registered criteria

Every experiment defines success/failure thresholds BEFORE execution.
Results are scored against these thresholds, not interpreted post-hoc.

### 2. Multiple repositories

Each experiment uses **at least 3 repositories** across at least 2 languages.
Single-repo findings do not generalize. Results must hold across domains.

### 3. Separation of roles

Three distinct agent roles, never combined in one session:

| Role | What it does | What it sees |
|---|---|---|
| **Builder** | Constructs or maintains the graph | Source code, git history, PRs |
| **Evaluator** | Answers diagnostic questions | Only what the experiment provides (context package, raw code, etc.) |
| **Scorer** | Compares evaluator answers to gold standard | Evaluator answer + gold standard |

The Builder never evaluates. The Evaluator never sees more than its assigned condition.
The Scorer never builds or evaluates — only compares.

### 4. Variance control

Each condition is run **3 times** with the same inputs. Report:
- Median score (primary metric)
- Range (max - min)
- Agreement rate (% of questions where all 3 runs agree within 1 point)

If range > 3 points on any question, flag as "high variance" and investigate.

### 5. Decision framework

Every experiment maps results to one of three product actions:
- **INVEST**: Build the feature (threshold met)
- **ITERATE**: Promising but needs refinement (threshold partially met)
- **ABANDON**: Not viable (threshold clearly missed)

---

## Repository Selection

### Criteria

Repos must satisfy ALL of the following:

| Criterion | Minimum | Why |
|---|---|---|
| Stars | >5,000 | Credibility, non-trivial codebase |
| Contributors | >50 | Multiple perspectives in history |
| PR culture | >50% of PRs have description >100 words | Needed for exp 5.2 (PR-based maintenance) |
| Commit quality | >30% of commits have multi-line messages | Needed for exp 5.1 (git-based construction) |
| Architectural complexity | >3 interacting modules with cross-cutting concerns | Need aspects, flows, relations to model |
| Language | Mix of TS, Python, Go (minimum 3 languages across series) | Cross-stack validation |
| Size | 5k-50k lines in target modules | Tractable for reference graph construction |

### Candidate Repos

The executor validates these candidates against criteria. Substitute if a candidate
fails criteria, documenting the reason.

| Candidate | Language | Domain | Why chosen |
|---|---|---|---|
| **payloadcms/payload** | TypeScript | CMS framework | Rich hooks/access control system, detailed PR descriptions, business logic heavy |
| **caddyserver/caddy** | Go | Web server | Clean architecture, excellent commit messages, middleware/plugin system |
| **encode/django-rest-framework** | Python | REST framework | Mature project, serialization/validation pipeline, exceptional PR reviews |
| **fastify/fastify** | TypeScript | Web framework | Plugin architecture, schema validation, good contributor culture |
| **ratatui/ratatui** | Rust | TUI framework | Cross-language validation (4th language), excellent PR culture, widget system |

### Reference Graph Protocol

For each repo, before any experiment begins:

1. **Select target area**: 3-5 interacting modules within the repo, ~2000-5000 lines total.
   The area must include at least:
   - 1 cross-cutting concern (→ aspect)
   - 1 business process spanning 3+ modules (→ flow)
   - 1 infrastructure component (guard/middleware/plugin → infrastructure node)

2. **Build reference graph**: An expert builds the full Yggdrasil graph for the target area
   following the standard protocol (aspects → flows → nodes → artifacts). This is the
   **gold standard** against which experimental conditions are compared.

3. **Create question set**: 15 diagnostic questions per repo (see Evaluation Protocol).
   Questions are written BEFORE any experimental condition is run.

4. **Create gold standard answers**: Answer all 15 questions using the reference graph +
   source code. These are the ground truth for scoring.

5. **Validate reference graph**: Run `yg validate`. Run blindfold test on reference graph
   (evaluator answers questions from context packages only). Score must be ≥90/125.
   If not, enrich graph until threshold met.

### Target Area Selection Guidelines

Selecting the right area within each repo is critical. The area must have enough
"decision density" — places where WHY matters, not just WHAT.

**Good signals** (area is suitable):
- Multiple error handling strategies in the same module
- Concurrency or ordering constraints
- Business rules that differ from the obvious implementation
- Configuration/plugin systems with extension points
- Authorization/access control logic

**Bad signals** (area is too simple):
- Pure CRUD with no business rules
- Thin wrappers around library calls
- Generated code or boilerplate
- Test utilities or fixtures

---

## Evaluation Protocol

### Question Categories

15 questions per repo, 3 per category:

| Category | Tests | Example |
|---|---|---|
| **Factual** (F1-F3) | Basic understanding of what code does | "What are the public methods of X and what does each return?" |
| **Structural** (S1-S3) | Cross-component relationships and data flow | "How does data flow from X through Y to Z?" |
| **Rationale** (R1-R3) | Design decisions and their reasons | "Why does X use strategy A instead of the simpler strategy B?" |
| **Impact** (I1-I3) | Blast radius of changes | "What breaks if the signature of X.method() changes?" |
| **Counterfactual** (C1-C3) | Rejected alternatives and trade-offs | "What would go wrong if X used approach B instead of approach A?" |

### Question Design Rules

1. Questions must be answerable from source code alone (no external knowledge required)
2. Questions must have a single correct answer (or a bounded set of correct answers)
3. At least 3 of 15 questions must require cross-module reasoning
4. At least 2 of 15 questions must require knowledge that is NOT in the code
   (e.g., rejected alternatives, ordering constraints, "why NOT" decisions)
5. Questions are written ONCE and used across all conditions in an experiment

### Scoring Rubric

Each question scored on 5 dimensions, 1-5 points each:

| Dimension | 5 (excellent) | 3 (adequate) | 1 (poor) |
|---|---|---|---|
| **Completeness** | Covers all relevant aspects, no gaps | Covers main points, minor gaps | Major aspects missing |
| **Accuracy** | All claims factually correct | Mostly correct, minor errors | Significant errors or fabrications |
| **Cross-module** | Correctly traces all cross-component effects | Traces some cross-component effects | Misses cross-component relationships |
| **Rationale** | Explains WHY with correct reasoning | Explains WHY partially or generically | No WHY, or wrong reasoning |
| **Actionability** | Developer can act on this immediately | Developer needs some clarification | Not actionable |

**Total per question**: 25 points
**Total per repo**: 375 points (15 questions x 25 points)

### Scoring Procedure

1. Scorer receives: evaluator answer + gold standard answer
2. Scorer scores each dimension independently (not holistically)
3. Scorer must provide 1-sentence justification for any score ≤ 3
4. If scorer is uncertain about a score (±1), flag it; a second scorer resolves

---

## Baselines

Every experiment includes these standard baselines:

| Baseline | Code | What the evaluator receives |
|---|---|---|
| **B0: No graph** | B0 | Raw source code for the target area (all files) |
| **B1: Full expert graph** | B1 | `yg build-context` output from reference graph (no source code) |

Each experiment adds its treatment condition(s) on top. Example: exp 5.1 adds
"T1: auto-constructed graph" — evaluator receives `yg build-context` from the
auto-constructed graph (no source code).

B0 establishes the floor (what you get without Yggdrasil).
B1 establishes the ceiling (what you get with a perfect graph).
Treatments are compared against both.

---

## Reporting Format

Each experiment produces a `results.md` with:

```markdown
# Results: Exp 5.X — <name>

## Summary Table
| Repo | Condition | Median Score | Range | vs B0 | vs B1 |
|---|---|---|---|---|---|

## Per-Repo Findings
### <Repo 1>
- Target area: <description>
- Reference graph: <N nodes, N aspects, N flows>
- <per-condition scores and analysis>
- <notable findings>

## Cross-Repo Patterns
- What held across all repos
- What diverged and why

## Hypothesis Verdict
- H1: <CONFIRMED / PARTIALLY CONFIRMED / REJECTED>
- Evidence: <summary>

## Decision
- <INVEST / ITERATE / ABANDON>
- Rationale: <why>
- If INVEST: <what specifically to build>
- If ITERATE: <what to change and re-test>
- If ABANDON: <what alternative to explore>
```

---

## Execution Order

```
Phase 1 (parallel, no dependencies):
  5.1 Auto-construct from git history
  5.5 Non-expert quality

Phase 2 (depends on Phase 1 reference graphs):
  5.2 Incremental from PRs (needs reference graphs from 5.1/5.5)
  5.4 Intent-based selection (needs reference graphs)

Phase 3 (depends on Phase 2):
  5.3 Zero-prompt delivery (integrates findings from all above)
```

5.1 and 5.5 are fully independent and can run in parallel on separate repos.
5.3 is the culmination — design its final protocol AFTER 5.1, 5.2, 5.4, 5.5 results are known.

---

## Delegation Instructions

When delegating an experiment to a subagent:

1. The subagent receives: this METHODOLOGY.md + the experiment's methodology.md
2. The subagent must read `.yggdrasil/agent-rules.md` before touching any mapped code
3. The subagent creates all output files in the experiment's directory
4. The subagent does NOT modify any code in `source/` or `.yggdrasil/`
5. The subagent reports results in the standardized format above
6. If the subagent encounters an ambiguous situation, it stops and documents the question
   in a `BLOCKED.md` file rather than making assumptions

## Cost Estimation

| Experiment | Estimated agent sessions | Primary cost driver |
|---|---|---|
| 5.1 | 3 repos × (1 reference + 1 treatment + 3 eval runs × 2 conditions) = 24 | Reference graph construction |
| 5.2 | 3 repos × (10 PRs × 1 patch + 3 eval runs × 2 conditions) = 48 | PR analysis volume |
| 5.3 | 2 repos × (15 tasks × 3 conditions × 3 runs) = 270 | A/B/C testing volume |
| 5.4 | 3 repos × (20 tasks × 3 conditions × 3 runs) = 540 | Task volume |
| 5.5 | 2 repos × (1 reference + 1 novice + 3 eval runs × 2 conditions) = 16 | Human involvement |

5.3 and 5.4 are the most expensive. Consider starting with 1 repo as pilot before
scaling to full matrix.
