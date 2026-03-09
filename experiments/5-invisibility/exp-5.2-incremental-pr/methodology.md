# Experiment 5.2: Incremental Graph Maintenance from Pull Requests

## Hypothesis

**H1**: An agent can analyze a PR (diff + description + review comments) and generate
correct graph patches that maintain graph-code consistency, achieving ≥90% precision
and ≥70% recall compared to expert-maintained updates.

**H0**: PR artifacts do not contain sufficient signal for reliable graph maintenance.
Patches either introduce errors (precision <80%) or miss most required updates
(recall <50%).

## Product Question

**Should Yggdrasil invest in a CI/CD integration that automatically proposes graph
updates on every PR?** If yes, what is the precision/recall trade-off, and which
graph elements are maintainable vs. which require human input?

## Variables

| Type | Variable | Values |
|---|---|---|
| Independent | Patch source | T1: auto-generated from PR / B1: expert-maintained (reference) |
| Dependent | Precision | % of proposed patch operations that are correct |
| Dependent | Recall | % of required updates that the patch includes |
| Dependent | "Why NOT" capture | % of decisions from PR discussion captured in graph |
| Dependent | False positive rate | % of proposed changes that would degrade graph quality |
| Controlled | Starting graph | Same pre-PR reference graph for all conditions |
| Controlled | PR set | Same 10 PRs per repo, chronologically ordered |

## Prerequisites

- Reference graphs from exp 5.1 (or built independently)
- 3 repos with accessible PR history (GitHub API)
- Minimum 10 merged PRs per repo that touch the target area

## Repos

Use the same 3 repos as exp 5.1 (or 2 overlapping + 1 new). Ensure:
- PRs have descriptions (>100 words average)
- At least some PRs have review discussion (comments with reasoning)
- Mix of PR types: bug fix, feature addition, refactor

## Protocol

### Phase 1: PR Selection (per repo)

Select 10 merged PRs that touch the target area, ordered chronologically.
Classify each PR:

| PR Type | Description | Example |
|---|---|---|
| **Feature** | Adds new functionality | "Add rate limiting to API endpoints" |
| **Bugfix** | Fixes existing behavior | "Fix race condition in collection reorder" |
| **Refactor** | Changes structure without behavior change | "Extract validation into separate module" |
| **Interface change** | Changes public API | "Add optional `metadata` parameter to create()" |
| **Aspect-affecting** | Changes a cross-cutting pattern | "Switch from optimistic to pessimistic locking" |

Aim for a mix: at least 2 features, 2 bugfixes, 2 refactors, 1 interface change,
1 aspect-affecting change. If a repo doesn't have all types, document the gap.

**Output**: `prs/pr-selection.md` with PR numbers, types, descriptions

### Phase 2: Expert Patch Construction (per repo, per PR)

For each PR, the expert examines the diff and determines what graph changes are needed:

1. Read the PR diff
2. Identify affected nodes (`yg owner --file <changed-files>`)
3. Determine required graph updates:
   - Node artifacts that need modification (responsibility, interface, internals)
   - Relations that need adding/removing
   - Aspects that need updating
   - Flows that need updating
   - New nodes that need creation
   - Nodes that need removal
4. Write the required updates as a structured patch specification

**Patch specification format**:
```yaml
pr: <number>
type: <feature|bugfix|refactor|interface-change|aspect-affecting>
required_updates:
  - target: <node-path/artifact.md>
    operation: <modify|create|delete>
    description: "What needs to change and why"
    source: "Where in the PR this information comes from"
  - target: <aspect-id>
    operation: <modify>
    description: "..."
    source: "..."
decisions_in_pr:
  - decision: "Chose X over Y"
    source: "PR comment by @user at line N"
    should_be_captured: true
  - decision: "..."
no_update_needed:
  - reason: "Behavioral change is internal to node, artifacts already generic enough"
```

**Output**: `prs/expert-patches/pr-<N>.yaml` per PR

### Phase 3: Auto-Patch Generation (per repo, per PR)

For each PR, a Builder agent receives:
- The current graph state (as it was BEFORE the PR)
- The PR diff
- The PR description
- The PR review comments (full thread)
- The PR commit messages

The Builder agent does NOT receive:
- The expert patch specification
- Future PRs
- Any hint about what should change

Builder agent prompt:

```
You are maintaining a Yggdrasil graph. A PR has been merged that changes
source code covered by the graph.

You have:
1. The current graph (all node.yaml, artifacts, aspects, flows)
2. The PR diff (what code changed)
3. The PR description (author's explanation)
4. The PR review comments (discussion between author and reviewers)
5. The PR commit messages

Your task:
1. Identify which graph elements are affected by this PR
2. Generate a patch specification listing all required graph updates
3. For each update, cite the specific source (diff line, PR comment, commit message)
4. Extract any design decisions or rejected alternatives from the PR discussion
5. If the PR discussion reveals WHY something was done, capture it
6. If you cannot determine WHY, write "rationale: unknown — PR does not explain"

Output your patch in the same YAML format as the expert patches.

CRITICAL RULES:
- Be CONSERVATIVE. Only propose changes you are confident about.
- If unsure whether an artifact needs updating, flag it as "uncertain"
  rather than proposing a change.
- NEVER invent rationale not present in the PR artifacts.
- Pay special attention to PR review comments — reviewers often ask
  "why not do X?" and the author's response is a rejected alternative.
```

**Output**: `prs/auto-patches/pr-<N>.yaml` per PR

### Phase 4: Patch Comparison (per repo, per PR)

Compare auto-patch vs expert-patch:

**Per-operation metrics:**

| Metric | Definition |
|---|---|
| True Positive (TP) | Auto proposes update that matches expert patch |
| False Positive (FP) | Auto proposes update NOT in expert patch (unnecessary or wrong) |
| False Negative (FN) | Expert patch has update NOT proposed by auto |
| True Negative (TN) | Both agree no update needed (implicit — not counted) |

**Matching rules:**
- Two operations "match" if they target the same artifact AND describe the same change
- A "partial match" (same target, related but different change) counts as 0.5 TP + 0.5 FN

**Computed metrics per PR:**
- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- F1 = 2 × (Precision × Recall) / (Precision + Recall)

**Decision capture per PR:**
- For each `decisions_in_pr` in expert patch where `should_be_captured: true`:
  does the auto patch include it?
- Decision recall = captured / total

**Output**: `comparison/per-pr-metrics.md`

### Phase 5: Cumulative Graph Quality

After processing all 10 PRs sequentially:

1. Apply expert patches to reference graph → "expert-maintained graph"
2. Apply auto patches to reference graph → "auto-maintained graph"
3. Run blindfold evaluation on both (same 15 questions, 3 runs each)
4. Compare scores

This tests whether small per-PR errors accumulate into significant graph degradation.

**Output**: `comparison/cumulative.md`

### Phase 6: Error Pattern Analysis

Classify all False Positives and False Negatives:

**False Negative patterns (auto missed an update):**

| Pattern | Description |
|---|---|
| **Implicit behavioral change** | Code changed behavior but diff isn't obvious |
| **Aspect ripple** | Change affects an aspect that applies to other nodes |
| **Flow impact** | Change affects a business process step |
| **Decision not in PR** | Expert captured a decision from code patterns, not PR text |
| **Granularity mismatch** | Auto doesn't recognize which artifact level needs updating |

**False Positive patterns (auto proposed unnecessary/wrong change):**

| Pattern | Description |
|---|---|
| **Over-reaction** | Minor code change triggers unnecessary artifact update |
| **Phantom decision** | Auto invents a decision from PR discussion context |
| **Stale context** | Auto proposes change based on misunderstanding of existing graph |
| **Scope creep** | Auto proposes changes beyond what the PR affects |

**Output**: `comparison/error-patterns.md`

### Phase 7: Confidence Calibration (optional extension)

If the auto-patcher includes confidence/uncertainty flags ("uncertain" items):

| Metric | Definition |
|---|---|
| Confidence precision | Among "confident" proposals, how many are correct? |
| Uncertainty recall | Among all errors, how many were flagged as "uncertain"? |

A well-calibrated patcher should have high confidence precision (>95%) and moderate
uncertainty recall (>50%). This determines whether a "auto-patch + human review of
uncertain items" workflow is viable.

**Output**: `comparison/confidence.md`

## Success Criteria

| Metric | INVEST threshold | ITERATE threshold | ABANDON threshold |
|---|---|---|---|
| Precision (median across repos) | ≥90% | 75-89% | <75% |
| Recall (median across repos) | ≥70% | 50-69% | <50% |
| Decision capture rate | ≥50% | 30-49% | <30% |
| Cumulative blindfold degradation | Auto ≥ 90% of expert | 75-89% | <75% |
| False positive rate | <10% | 10-20% | >20% |

## Decision Framework

**If INVEST:**
- Build CI integration (`yg suggest-updates`) that:
  1. Runs on PR merge (or as PR check)
  2. Generates graph patch
  3. Opens a follow-up PR with suggested graph changes
  4. Flags "uncertain" items for human review
- Consider: mandatory (blocks merge until graph updated) vs advisory (suggestion only)
- Priority: HIGH (removes maintenance burden entirely)

**If ITERATE:**
- Identify which PR types are reliable (features vs refactors vs bugfixes)
- Test: does adding "graph update checklist" to PR template improve auto-patching?
- Test: does a two-pass approach (auto-patch → human review → final patch) work?

**If ABANDON:**
- Invest in better drift detection instead (make manual updates easier, not automatic)
- Document which aspects of graph maintenance are fundamentally human-judgment-dependent

## Known Risks

1. **PR description quality varies.** Some developers write "fixes #123"; others write
   paragraphs explaining their approach. The experiment must test both extremes.

2. **Review comments are noisy.** Not all review discussion is about design decisions.
   Style nits, CI failures, and tangential discussions add noise.

3. **Chronological ordering matters.** PRs build on each other. Processing PR #5 requires
   the graph state after PRs #1-4 are applied. A single bad patch early in the sequence
   may cascade errors. Track this explicitly.

4. **Squash merge loses per-commit narrative.** If a repo squash-merges, the individual
   commit messages from development are lost. Only the PR description survives.

## Estimated Duration

- Phase 1 (PR selection): 1 hour per repo
- Phase 2 (expert patches): 2-3 hours per repo (10 PRs × 15-20 min)
- Phase 3 (auto patches): 1-2 hours per repo
- Phase 4-5 (comparison + cumulative): 3-4 hours per repo
- Phase 6-7 (analysis): 1-2 hours per repo
- Total: ~25-35 hours of agent time
