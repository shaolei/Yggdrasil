# Experiment 5.1: Automatic Graph Construction from Git History

## Hypothesis

**H1**: An agent can construct a Yggdrasil graph from git history alone that achieves
≥80% structural coverage and ≥60% semantic coverage compared to an expert-built
reference graph, with <5% fabricated information.

**H0**: Git history does not contain sufficient signal to construct a meaningful graph.
The auto-constructed graph either misses critical structure (structural coverage <60%)
or introduces fabricated rationale (error rate >10%).

## Product Question

**Should Yggdrasil invest in an `yg auto-init` command that bootstraps graphs from
git history?** If yes, what quality level is achievable, and what supplementary
information (if any) is needed?

## Variables

| Type | Variable | Values |
|---|---|---|
| Independent | Graph source | T1: auto-constructed from git / B0: no graph / B1: expert reference |
| Dependent | Structural coverage | % of reference nodes, relations, mappings present in auto graph |
| Dependent | Semantic coverage | % of reference aspects, decisions, rationale captured |
| Dependent | Error rate | % of auto-graph claims that are factually wrong |
| Dependent | Blindfold score | Evaluator score on 15 diagnostic questions (see METHODOLOGY.md) |
| Controlled | Target area | Same modules per repo across all conditions |
| Controlled | Evaluator | Same agent, same questions, same scoring |

## Prerequisites

- 3 repos cloned with full git history (`git clone` without `--depth`)
- Reference graph built for each repo's target area (see METHODOLOGY.md §Reference Graph Protocol)
- 15 diagnostic questions + gold standard answers per repo

## Repos

Use 3 repos from the candidate list in METHODOLOGY.md. Ensure:
- At least 2 languages represented
- At least 1 repo has conventional commit messages (structured)
- At least 1 repo has free-form commit messages (unstructured)

This tests whether the method is robust to different commit cultures.

## Protocol

### Phase 1: Reference Graph Construction (per repo)

Follow METHODOLOGY.md §Reference Graph Protocol:
1. Select target area (3-5 interacting modules, 2000-5000 lines)
2. Expert builds full graph: aspects → flows → nodes → artifacts
3. Create 15 questions + gold standard answers
4. Validate: `yg validate`, blindfold score ≥90/125

**Output**: `reference/` directory with complete graph + questions + gold answers

### Phase 2: Git History Extraction (per repo)

Extract the git history for the target area files:

```bash
# Get all commits touching target area files
git log --all --follow -p -- <target-area-paths> > git-history.txt

# Get PR merge commits with descriptions (if using GitHub)
gh pr list --state merged --limit 100 --json number,title,body,mergedAt \
  | jq '[.[] | select(.body | length > 50)]' > pr-history.json

# Get blame for current state (shows who wrote what and when)
git blame --line-porcelain <each-target-file> > blame-data.txt
```

**Output**: `input/` directory with git-history.txt, pr-history.json, blame-data.txt

### Phase 3: Auto-Construction (per repo)

A Builder agent receives ONLY:
- The extracted git history (Phase 2 output)
- The current source code of the target area (read-only)
- Yggdrasil schemas (`schemas/` directory)
- The agent-rules.md (for graph construction protocol)

The Builder agent does NOT receive:
- The reference graph
- The diagnostic questions
- Any hints about what aspects, flows, or decisions exist

Builder agent prompt:

```
You are building a Yggdrasil graph for a codebase. You have:

1. The current source code of the target area (files listed below)
2. The complete git history for these files (commits, diffs, messages)
3. PR descriptions and discussions related to these files
4. Yggdrasil schemas (for correct YAML structure)

Your task:
1. Read the source code to understand WHAT the code does
2. Read the git history and PRs to understand WHY it was designed this way
3. Identify cross-cutting patterns → create aspects
4. Identify business processes → create flows
5. Create nodes with artifacts (responsibility.md, interface.md, internals.md)
6. Capture decisions with rejected alternatives from PR discussions and
   commit messages. Use "rationale: unknown — inferred from code" when you
   cannot find the WHY in history.

Output a complete graph in the Yggdrasil directory structure.

CRITICAL RULES:
- NEVER invent rationale. If the git history doesn't say WHY, write
  "rationale: unknown" and note what CAN be observed.
- NEVER fabricate rejected alternatives. Only document alternatives that
  are explicitly mentioned in commits, PRs, or code comments.
- DO extract "why NOT" information from: PR review comments, commit messages
  that mention alternatives, code comments with "NOTE:" or "TODO:" or
  "HACK:" or "@see" annotations.
```

**Output**: `auto-graph/` directory with the auto-constructed graph

### Phase 4: Structural Comparison (per repo)

Compare auto-constructed graph vs reference graph on structural elements:

| Element | Metric | How to measure |
|---|---|---|
| Nodes | Coverage | % of reference nodes that have a corresponding auto node (same files mapped) |
| Relations | Coverage | % of reference relations present in auto graph |
| Aspects | Coverage | % of reference aspects identified (same cross-cutting concern, may differ in name) |
| Flows | Coverage | % of reference flows identified (same business process) |
| File mappings | Precision | % of auto mappings that are correct |
| File mappings | Recall | % of reference mappings present in auto graph |
| Node granularity | Match | % of reference nodes where auto graph has same or finer granularity |

**Matching rules**:
- Two nodes "match" if they map overlapping files (>50% overlap)
- Two aspects "match" if they describe the same cross-cutting concern (semantic match, not name match)
- Two flows "match" if they describe the same business process
- Two relations "match" if they connect matching nodes with compatible type

Compute:
- **Structural coverage** = mean of (node coverage, relation coverage, aspect coverage, flow coverage)
- **Structural precision** = % of auto-graph elements that have a reference counterpart

**Output**: `comparison/structural.md` with table of metrics

### Phase 5: Semantic Comparison (per repo)

Compare the CONTENT of matching elements:

For each matching node pair (auto vs reference):
1. Compare responsibility.md: does auto version capture the same identity and boundaries?
2. Compare interface.md: does auto version list the same public methods and contracts?
3. Compare internals.md: does auto version capture the same algorithms and decisions?

For each matching aspect pair:
1. Does auto version describe the same pattern?
2. Does auto version capture the same rationale (WHY this pattern)?

Score each comparison on a 3-point scale:
- **3 (equivalent)**: Same information, possibly different wording
- **2 (partial)**: Captures the core idea but misses details
- **1 (minimal)**: Recognizes the element exists but content is superficial

Compute:
- **Semantic coverage** = mean of all element scores / 3 (normalized to 0-100%)

Separately track:
- **Decision capture rate**: % of reference decisions.md/internals.md decisions found in auto graph
- **"Why NOT" capture rate**: % of reference rejected alternatives found in auto graph
- **Fabrication rate**: % of auto-graph claims that are NOT in reference AND NOT in source code

**Output**: `comparison/semantic.md` with per-element scores

### Phase 6: Blindfold Evaluation (per repo)

Run the standard evaluation protocol (METHODOLOGY.md §Evaluation Protocol):

| Condition | What evaluator receives |
|---|---|
| B0 | Raw source code only |
| B1 | `yg build-context` from reference graph |
| T1 | `yg build-context` from auto-constructed graph |

3 runs per condition. Same 15 questions. Same scorer.

**Output**: `evaluation/` directory with per-run answers and scores

### Phase 7: Error Analysis

For elements in the auto graph that do NOT match the reference:

Classify each as:
| Category | Description | Severity |
|---|---|---|
| **Missing** | Reference element not in auto graph | Medium |
| **Fabricated** | Auto element has no basis in code or history | Critical |
| **Misattributed** | Correct information, wrong location (e.g., aspect content in internals.md) | Low |
| **Over-split** | Auto graph split a reference node into multiple | Low |
| **Under-split** | Auto graph merged reference nodes into one | Medium |
| **Phantom rationale** | Auto graph invented a plausible-sounding reason | Critical |

**Output**: `comparison/errors.md` with categorized list

## Success Criteria

| Metric | INVEST threshold | ITERATE threshold | ABANDON threshold |
|---|---|---|---|
| Structural coverage | ≥80% across all 3 repos | 60-79% | <60% |
| Semantic coverage | ≥60% across all 3 repos | 40-59% | <40% |
| Error rate (fabrication + phantom rationale) | <5% | 5-15% | >15% |
| Blindfold score T1 vs B1 | T1 ≥ 80% of B1 | T1 ≥ 60% of B1 | T1 < 60% of B1 |
| Blindfold score T1 vs B0 | T1 > B0 | T1 ≈ B0 | T1 < B0 |
| "Why NOT" capture rate | ≥40% | 20-39% | <20% |

## Decision Framework

**If INVEST:**
- Build `yg auto-init` command that:
  1. Scans git history for target area
  2. Proposes node structure
  3. Auto-generates initial artifacts
  4. Marks all rationale as "inferred — confirm with developer"
- Priority: HIGH (removes adoption barrier #1)

**If ITERATE:**
- Identify which elements fail (nodes? aspects? decisions?) and test:
  - Does adding README/docs to input improve results?
  - Does interactive Q&A with developer fill the gaps?
  - Is a hybrid approach (auto-structure + manual enrichment) viable?

**If ABANDON:**
- Pivot to exp 5.5 (non-expert guided construction) as the primary onboarding path
- Document which git history signals are unreliable and why

## Known Risks

1. **Commit message quality varies wildly.** Some repos have excellent messages
   ("Chose sliding window over fixed window because X"); others have "fix" or
   "update". This is deliberate — we test both to understand the floor.

2. **Squash-merge repos lose history.** If a repo squashes all PR commits, the
   individual development narrative is lost. The PR description becomes the only
   signal. Document if this is a significant factor.

3. **Fabrication risk is the biggest threat.** LLMs are excellent at generating
   plausible-sounding rationale. The error analysis (Phase 7) must be rigorous
   about distinguishing "inferred from code patterns" (acceptable) from
   "invented plausible story" (unacceptable).

4. **Reference graph quality ceiling.** The auto graph can only be as good as
   the reference. If the reference graph has gaps, the auto graph may correctly
   capture things the reference missed. Score these as "bonus" separately.

## Estimated Duration

- Phase 1 (reference graphs): 3-5 hours per repo (15 hours total)
- Phase 2 (extraction): 30 min per repo
- Phase 3 (auto-construction): 1-2 hours per repo
- Phase 4-5 (comparison): 1-2 hours per repo
- Phase 6 (blindfold): 2-3 hours per repo (18 runs total)
- Phase 7 (error analysis): 1 hour per repo
- Total: ~30-40 hours of agent time
