# Experiment 5: Time Decay of Semantic Graph Artifacts

**Date:** 2026-03-03

---

## 1. Hypothesis

**Original hypothesis:** "Different artifact types have different 'half-lives.' decisions.md decays slower than logic.md because design decisions change less frequently than algorithmic details."

**Predicted stability ranking** (most stable to least stable):

aspects > decisions > constraints > responsibility > interface > logic > state

The reasoning behind this prediction was that higher-level, more abstract artifacts capture intent and architectural choices that evolve slowly, while lower-level artifacts describing implementation details are more tightly coupled to code that changes frequently.

---

## 2. Methodology

Three brownfield open-source repositories were selected, each with active development histories:

1. **Cal.com** (calcom/cal.com) -- scheduling availability pipeline (date-ranges, slots, period-limits)
2. **Medusa** (medusajs/medusa) -- payment module (PaymentModuleService, PaymentProviderService)
3. **Hoppscotch** (hoppscotch/hoppscotch) -- team collection service (TeamCollectionService)

For each repository:

- A semantic graph was built from the **current** codebase (as of March 2026)
- Historical source code was retrieved at two time points:
  - **T0** (~12 months ago): commits on or before 2025-03-15
  - **T1** (~6 months ago): commits on or before 2025-09-15
- An independent audit agent evaluated every distinct factual claim in the graph against the historical code
- Each claim was rated as ACCURATE, PARTIALLY ACCURATE, or INACCURATE

**Scoring:** Two accuracy metrics are used throughout:

- **Strict accuracy:** only ACCURATE claims count as correct
- **Weighted accuracy:** PARTIALLY ACCURATE claims count as 0.5

**Code churn context** (from the historical code manifest):

| File                                  | T0 Lines | T1 Lines | Change | % Change |
| ------------------------------------- | -------- | -------- | ------ | -------- |
| cal.com date-ranges.ts                | 337      | 467      | +130   | +38.6%   |
| cal.com slots.ts                      | 171      | 242      | +71    | +41.5%   |
| cal.com isOutOfBounds.tsx             | 375      | 363      | -12    | -3.2%    |
| medusa payment-module.ts              | 1183     | 1252     | +69    | +5.8%    |
| medusa payment-provider.ts            | 222      | 226      | +4     | +1.8%    |
| hoppscotch team-collection.service.ts | 1488     | 1470     | -18    | -1.2%    |

---

## 3. Results by Repo

### 3.1 Cal.com

**Overall accuracy:**

- **T0 (12 months):** 157 claims. 124 accurate, 18 partial, 15 inaccurate. Strict: **79.0%**. Weighted: **84.7%**.
- **T1 (6 months):** 189 claims. 174 accurate, 8 partial, 7 inaccurate. Strict: **92.1%**. Weighted: **94.2%**.

**Per-artifact-type accuracy (strict, then weighted):**

| Artifact Type     | T0 Claims | T0 Strict | T0 Weighted | T1 Claims | T1 Strict | T1 Weighted |
| ----------------- | --------- | --------- | ----------- | --------- | --------- | ----------- |
| responsibility.md | 27        | 81.5%     | 87.0%       | 24        | 100.0%    | 100.0%      |
| constraints.md    | 20        | 75.0%     | 82.5%       | 13        | 92.3%     | 92.3%       |
| logic.md          | 49        | 75.5%     | 81.6%       | 45        | 95.6%     | 95.6%       |
| decisions.md      | 12        | 75.0%     | 79.2%       | 11        | 90.9%     | 90.9%       |
| interface.md      | 10        | 80.0%     | 90.0%       | 9         | 100.0%    | 100.0%      |
| errors.md         | 5         | 100.0%    | 100.0%      | 5         | 100.0%    | 100.0%      |
| Aspects           | 19        | 84.2%     | 86.8%       | 23        | 95.7%     | 97.8%       |
| Flow              | 15        | 80.0%     | 86.7%       | 14        | 100.0%    | 100.0%      |

**Key findings:**

- Cal.com had the highest code churn (date-ranges +38.6%, slots +41.5% between T0 and T1), which explains its higher decay at T0
- The 15 inaccurate T0 claims clustered around 4 specific features added after T0: three-tier slot snapping, endTimeToKeyMap optimization, old/new date format detection, and timezone-before-alignment reordering
- By T1, most of these features had already been added, reducing inaccuracies to 7 (mainly timezone ordering and date format detection in period-limits)
- errors.md achieved 100% accuracy at both time points

### 3.2 Medusa

**Overall accuracy:**

- **T0 (12 months):** 141 claims. 108 accurate, 15 partial, 18 inaccurate. Strict: **76.6%**. Weighted: **81.9%**.
- **T1 (6 months):** 67 claims. 55 accurate, 8 partial, 4 inaccurate. Strict: **82.1%**. Weighted: **88.1%**.

**Per-artifact-type accuracy (strict, then weighted):**

| Artifact Type     | T0 Claims | T0 Strict | T0 Weighted | T1 Claims | T1 Strict | T1 Weighted |
| ----------------- | --------- | --------- | ----------- | --------- | --------- | ----------- |
| responsibility.md | 21        | 81.0%     | 90.5%       | 11        | 100.0%    | 100.0%      |
| constraints.md    | 15        | 60.0%     | 66.7%       | 15        | 86.7%     | 86.7%       |
| state.md          | 11        | 81.8%     | 81.8%       | 9         | 100.0%    | 100.0%      |
| decisions.md      | 8         | 75.0%     | 75.0%       | 7         | 85.7%     | 92.9%       |
| interface.md      | 17        | 88.2%     | 91.2%       | 9         | 88.9%     | 94.4%       |
| errors.md         | 7         | 57.1%     | 71.4%       | 2         | 100.0%    | 100.0%      |
| node.yaml         | 3         | 100.0%    | 100.0%      | --        | --        | --          |
| Aspects           | 29        | 69.0%     | 74.1%       | 14        | 85.7%     | 92.9%       |
| Flow              | 20        | 80.0%     | 85.0%       | 13        | 84.6%     | 84.6%       |

**Key findings:**

- The dominant decay source was the `roundToCurrencyPrecision` function and `Intl.NumberFormat` usage, which did not exist at T0 but was present at T1. This single feature accounted for 10+ inaccurate claims at T0.
- The `currency-precision` aspect scored only 25% at T0 (6 of 8 claims inaccurate) because the entire rounding system was added after T0. By T1, this improved dramatically.
- The `is_captured` flag for auto-capture skipping the provider call was inaccurate at both T0 and T1, suggesting it was a graph error rather than a decay issue.
- Default refund amount was consistently described as "full captured amount" but code uses `payment.amount` (authorized amount) at both T0 and T1.

### 3.3 Hoppscotch

**Overall accuracy:**

- **T0 (12 months):** 72 claims. 48 accurate, 7 partial, 17 inaccurate. Strict: **66.7%**. Weighted: **71.5%**.
- **T1 (6 months):** 74 claims. 65 accurate, 6 partial, 3 inaccurate. Strict: **87.8%**. Weighted: **91.9%**.

**Per-artifact-type accuracy (strict, then weighted):**

| Artifact Type          | T0 Claims | T0 Strict | T0 Weighted | T1 Claims | T1 Strict | T1 Weighted |
| ---------------------- | --------- | --------- | ----------- | --------- | --------- | ----------- |
| responsibility.md      | 27        | 81.5%     | 88.9%       | 13        | 92.3%     | 96.2%       |
| constraints.md         | 7         | 71.4%     | 78.6%       | 7         | 85.7%     | 85.7%       |
| logic.md               | 5         | 40.0%     | 60.0%       | 4         | 75.0%     | 87.5%       |
| decisions.md           | 6         | 83.3%     | 83.3%       | 6         | 100.0%    | 100.0%      |
| node.yaml              | 5         | 60.0%     | 60.0%       | 4         | 75.0%     | 87.5%       |
| Aspects (all)          | 15        | 33.3%     | 40.0%       | 17        | 82.4%     | 85.3%       |
| -- Pessimistic Locking | 4         | 0.0%      | 0.0%        | 4         | 25.0%     | 37.5%       |
| -- PubSub Events       | 6         | 83.3%     | 91.7%       | 5         | 100.0%    | 100.0%      |
| -- Retry on Deadlock   | 5         | 0.0%      | 0.0%        | 8         | 100.0%    | 100.0%      |

**Key findings:**

- Hoppscotch showed the most dramatic decay pattern: two entire aspects (pessimistic locking: 4 claims, retry-on-deadlock: 5 claims) scored **0% at T0** because neither feature existed in the 12-month-old code. Both were added between T0 and T1.
- The underlying business logic (CRUD, tree operations, search, import/export, PubSub events) was stable across both time points.
- The `TITLE_LENGTH` constant was 3 in both T0 and T1 code, but the graph claims it is 1 -- this is a graph authoring error, not decay.
- The "sort siblings" operation is claimed as in-scope but does not exist at either T0 or T1, indicating another graph error.
- Despite only 1.2% line-count change between T0 and T1, the nature of the changes (adding concurrency safety mechanisms) caused significant claim failures.

---

## 4. Cross-Repo Analysis

### Combined Accuracy by Artifact Type

| Artifact Type     | Cal T0    | Cal T1    | Med T0    | Med T1    | Hop T0    | Hop T1    | Avg T0    | Avg T1     |
| ----------------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | ---------- |
| responsibility.md | 87.0%     | 100.0%    | 90.5%     | 100.0%    | 88.9%     | 96.2%     | **88.8%** | **98.7%**  |
| constraints.md    | 82.5%     | 92.3%     | 66.7%     | 86.7%     | 78.6%     | 85.7%     | **75.9%** | **88.2%**  |
| logic.md          | 81.6%     | 95.6%     | --        | --        | 60.0%     | 87.5%     | **70.8%** | **91.6%**  |
| decisions.md      | 79.2%     | 90.9%     | 75.0%     | 92.9%     | 83.3%     | 100.0%    | **79.2%** | **94.6%**  |
| interface.md      | 90.0%     | 100.0%    | 91.2%     | 94.4%     | --        | --        | **90.6%** | **97.2%**  |
| errors.md         | 100.0%    | 100.0%    | 71.4%     | 100.0%    | --        | --        | **85.7%** | **100.0%** |
| state.md          | --        | --        | 81.8%     | 100.0%    | --        | --        | **81.8%** | **100.0%** |
| Aspects (all)     | 86.8%     | 97.8%     | 74.1%     | 92.9%     | 40.0%     | 85.3%     | **67.0%** | **92.0%**  |
| Flow              | 86.7%     | 100.0%    | 85.0%     | 84.6%     | --        | --        | **85.9%** | **92.3%**  |
| **Overall**       | **84.7%** | **94.2%** | **81.9%** | **88.1%** | **71.5%** | **91.9%** | **79.4%** | **91.4%**  |

_All values use weighted accuracy (PARTIALLY ACCURATE = 0.5)._

### Accuracy by Artifact Type (strict only, aggregated across repos)

| Artifact Type     | Total T0 Claims | T0 Strict % | Total T1 Claims | T1 Strict % | Decay (T0-T1) |
| ----------------- | --------------- | ----------- | --------------- | ----------- | ------------- |
| responsibility.md | 75              | 81.3%       | 48              | 97.9%       | 16.6 pp       |
| interface.md      | 27              | 85.2%       | 18              | 94.4%       | 9.3 pp        |
| decisions.md      | 26              | 76.9%       | 24              | 91.7%       | 14.7 pp       |
| constraints.md    | 42              | 66.7%       | 35              | 88.6%       | 21.9 pp       |
| logic.md          | 54              | 70.4%       | 49              | 93.9%       | 23.5 pp       |
| errors.md         | 12              | 75.0%       | 7               | 100.0%      | 25.0 pp       |
| state.md          | 11              | 81.8%       | 9               | 100.0%      | 18.2 pp       |
| Aspects           | 63              | 57.1%       | 54              | 85.2%       | 28.0 pp       |
| Flow              | 35              | 80.0%       | 27              | 92.6%       | 12.6 pp       |

---

## 5. Decay Rankings (Actual vs. Predicted)

### Actual Stability Ranking (by weighted T0 accuracy, most stable first)

1. **interface.md** -- 90.6% at T0
2. **responsibility.md** -- 88.8% at T0
3. **Flow** -- 85.9% at T0
4. **errors.md** -- 85.7% at T0
5. **state.md** -- 81.8% at T0
6. **decisions.md** -- 79.2% at T0
7. **constraints.md** -- 75.9% at T0
8. **logic.md** -- 70.8% at T0
9. **Aspects** -- 67.0% at T0

### Comparison: Predicted vs. Actual

| Predicted Rank | Predicted Type | Actual Rank | Actual Type       | Match?            |
| -------------- | -------------- | ----------- | ----------------- | ----------------- |
| 1              | aspects        | 1           | interface.md      | No                |
| 2              | decisions      | 2           | responsibility.md | No                |
| 3              | constraints    | 3           | Flow              | --                |
| 4              | responsibility | 4           | errors.md         | --                |
| 5              | interface      | 5           | state.md          | --                |
| 6              | logic          | 6           | decisions.md      | Partial           |
| 7              | state          | 7           | constraints.md    | Partial           |
| --             | --             | 8           | logic.md          | Close             |
| --             | --             | 9           | aspects           | No (predicted #1) |

### Key Discrepancies

1. **Aspects were predicted most stable but ranked last.** This was the largest prediction error. The reason: aspects describe cross-cutting patterns that may not exist yet in older code. When an aspect captures a _new_ pattern (e.g., pessimistic locking, currency-precision rounding), it is 100% inaccurate against pre-existing code. Aspects are binary -- they describe a pattern that either exists or does not.

2. **Interface was predicted near the bottom but ranked first.** Interface artifacts describe function signatures, types, and API contracts. These proved remarkably stable because interfaces change less frequently than implementations. Even when internal logic changes, the public API often remains the same.

3. **Responsibility was predicted mid-pack but ranked second.** High-level descriptions of what a module does proved very stable -- modules rarely change their fundamental purpose, even as they gain new capabilities.

4. **Logic ranked near the bottom as predicted.** This was the only artifact type that closely matched its predicted position. Implementation details are tightly coupled to code changes.

5. **Decisions were predicted second but ranked sixth.** Design decisions do change when new features are added that alter the fundamental approach (e.g., adding currency rounding changes the decision landscape).

---

## 6. Half-Life Estimates

Using the two data points (T0 at 12 months, T1 at 6 months), we can model decay as exponential: `accuracy(t) = A * e^(-lambda * t)`, where t is months from present. Solving for the time at which accuracy drops to 50%.

Assuming the graph is 100% accurate at t=0 (the present), we estimate lambda from each time point and average them.

| Artifact Type     | T0 Weighted (12mo) | T1 Weighted (6mo) | Lambda (from T0) | Lambda (from T1) | Avg Lambda | Estimated Half-Life         |
| ----------------- | ------------------ | ----------------- | ---------------- | ---------------- | ---------- | --------------------------- |
| interface.md      | 90.6%              | 97.2%             | 0.0082           | 0.0047           | 0.0065     | **107 months (~9 years)**   |
| responsibility.md | 88.8%              | 98.7%             | 0.0099           | 0.0022           | 0.0061     | **114 months (~9.5 years)** |
| Flow              | 85.9%              | 92.3%             | 0.0127           | 0.0134           | 0.0131     | **53 months (~4.4 years)**  |
| errors.md         | 85.7%              | 100.0%            | 0.0129           | 0.0000           | 0.0065     | **107 months (~9 years)**   |
| state.md          | 81.8%              | 100.0%            | 0.0168           | 0.0000           | 0.0084     | **83 months (~6.9 years)**  |
| decisions.md      | 79.2%              | 94.6%             | 0.0194           | 0.0093           | 0.0144     | **48 months (~4 years)**    |
| constraints.md    | 75.9%              | 88.2%             | 0.0230           | 0.0209           | 0.0220     | **32 months (~2.6 years)**  |
| logic.md          | 70.8%              | 91.6%             | 0.0288           | 0.0146           | 0.0217     | **32 months (~2.7 years)**  |
| Aspects           | 67.0%              | 92.0%             | 0.0334           | 0.0139           | 0.0237     | **29 months (~2.4 years)**  |

**Caveats:** These are rough extrapolations from two data points. The decay is not truly exponential -- it depends on the nature and timing of code changes. The estimates assume a constant rate of change similar to the observed period. Repositories with higher churn (like Cal.com) would see shorter half-lives; stable codebases would see longer ones.

---

## 7. Key Findings

### 7.1 Which artifact type is most stable and why?

**Interface.md and responsibility.md** are the most stable artifact types, with estimated half-lives of ~9 years. This is because:

- **Interfaces** describe function signatures, type definitions, and API contracts. Even when internal implementation changes significantly, the public-facing contract often remains stable or only gains new optional parameters. For example, Cal.com's `buildDateRanges` function signature was identical at T0, T1, and present.
- **Responsibility** artifacts describe _what_ a module does at a high level. Modules rarely change their fundamental purpose. Cal.com's date-ranges module was always "converting availability configuration into time ranges" regardless of internal optimizations. Medusa's PaymentModuleService was always "central orchestration for payment operations."

### 7.2 Which artifact type decays fastest and why?

**Aspects** decay fastest (estimated half-life ~2.4 years), but for a counterintuitive reason: aspects describe cross-cutting patterns, and when a _new_ pattern is introduced (e.g., pessimistic locking, currency-precision rounding), the aspect becomes retroactively wrong for all historical code. The decay is **catastrophic rather than gradual** -- an aspect goes from 0% to 100% accuracy at the moment the pattern is introduced.

This is distinct from **logic.md** (half-life ~2.7 years), which decays **gradually** as individual algorithmic steps are modified, added, or reordered.

### 7.3 What triggers decay?

Three distinct triggers were observed:

1. **New feature addition** (most common, ~60% of inaccuracies): A wholly new capability is added to the codebase that the graph describes but historical code lacks. Examples: three-tier slot snapping in Cal.com, currency-precision rounding in Medusa, pessimistic locking in Hoppscotch. This causes **catastrophic** decay in the specific artifact describing the feature.

2. **Behavioral refactoring** (~25% of inaccuracies): An existing behavior is restructured without changing its purpose. Examples: timezone-before-alignment reordering in Cal.com slots, endTimeToKeyMap optimization in Cal.com date-ranges. This causes **localized** decay in logic.md and constraints.md.

3. **Data model evolution** (~15% of inaccuracies): New fields, methods, or operations are added to existing structures. Examples: OOO metadata fields (`notes`, `showNotePublicly`) in Cal.com, `retrieveAccountHolder` method in Medusa. This causes **incremental** decay primarily in interface.md and state.md.

### 7.4 Is decay gradual or catastrophic?

**Both, depending on artifact type:**

- **Catastrophic decay** characterizes aspects and feature-gated logic. When a cross-cutting pattern is introduced (pessimistic locking, retry-on-deadlock), every claim in that aspect goes from 0% to 100% accuracy at once. The Hoppscotch pessimistic-locking aspect scored 0% at T0 and 25% at T1 (still being refined); retry-on-deadlock scored 0% at T0 and 100% at T1 (fully introduced between the two points).

- **Gradual decay** characterizes responsibility, interface, and constraints artifacts. These degrade one claim at a time as individual features are added or modified. Cal.com's responsibility.md went from 87% to 100% -- the 13% decay at T0 was spread across multiple small inaccuracies (mentioning "optimized slots," "boundary tracking," "endTimeToKeyMap"), none of which was individually devastating.

- **Mixed decay** characterizes logic.md and decisions.md. A single new algorithm (like three-tier slot snapping) can invalidate multiple logic claims at once, but the rest of the algorithm description remains accurate.

---

## 8. Product Implications for Yggdrasil

### 8.1 Which artifacts should be "required" vs "optional"?

Based on decay profiles, the recommended configuration is:

**Required (high stability, high value):**

- `responsibility.md` -- 98.7% accuracy at 6 months, 88.8% at 12 months. Provides the most durable understanding of a module's purpose.
- `interface.md` -- 97.2% at 6 months, 90.6% at 12 months. Captures the stable API surface.
- `constraints.md` -- 88.2% at 6 months. While it decays more than responsibility/interface, constraints capture invariants that are critical for correct implementation.

**Recommended (moderate stability, high value):**

- `decisions.md` -- 94.6% at 6 months. Design rationale is valuable and moderately stable.
- `logic.md` -- 91.6% at 6 months. Important for implementation context but requires more frequent updates.

**Optional (context-dependent):**

- `errors.md` -- 100% at 6 months, but small sample size. Include when error handling is complex.
- `state.md` -- 100% at 6 months, but only relevant for stateful services.

### 8.2 How often should graphs be reviewed?

The data suggests a **tiered review cadence:**

| Artifact Type     | Recommended Review Frequency | Rationale                                                    |
| ----------------- | ---------------------------- | ------------------------------------------------------------ |
| responsibility.md | Every 6-12 months            | Very stable; only needs update when module scope changes     |
| interface.md      | Every 6-12 months            | Stable; update when API surface changes                      |
| decisions.md      | Every 3-6 months             | Moderately stable; new features may invalidate old decisions |
| constraints.md    | Every 3-6 months             | Decays with behavioral changes                               |
| logic.md          | Every 1-3 months             | Decays with any algorithmic change                           |
| Aspects           | On every feature addition    | Binary decay; new patterns make old graphs instantly wrong   |

**Practical recommendation:** Run `yg drift` after every significant PR or feature branch merge. Focus manual review on logic.md and aspects after periods of high development activity.

### 8.3 Can Yggdrasil detect when artifacts are likely stale?

Yes, several signals could be used:

1. **File churn correlation:** Artifacts for files with high git commit frequency are more likely stale. Yggdrasil could compute `commits_since_last_drift_sync / time_elapsed` and flag nodes above a threshold. Cal.com's 38-42% line growth strongly correlated with higher decay.

2. **Artifact-type-specific staleness thresholds:** logic.md and aspects should have shorter staleness windows than responsibility.md. A `last_reviewed` timestamp per artifact could enable type-aware staleness warnings.

3. **New-feature detection:** When a file gains significant new exported functions, types, or patterns (detectable via AST analysis), flag the corresponding aspects and logic.md for review. The catastrophic aspect decay observed in this experiment could be caught by detecting new pattern introductions.

4. **Cross-reference validation:** When an aspect references a function, type, or pattern by name (e.g., `lockTeamCollectionByTeamAndParent`, `roundToCurrencyPrecision`), a simple grep against the mapped files could detect whether those identifiers actually exist, catching the most obvious staleness.

5. **Decay-weighted confidence scores:** Each artifact could carry a confidence score that decreases over time based on the artifact type's observed half-life and the file's commit frequency. This score would appear in `yg build-context` output, letting agents know which parts of the context package to trust less.

---

## 9. Conclusion

This experiment confirms the central hypothesis that different artifact types have meaningfully different decay rates, though the actual ranking differed significantly from predictions. The most stable artifacts are **interface.md** and **responsibility.md**, which describe _what_ a module does and _how_ it is accessed -- information that changes slowly even as internals evolve. These achieved 90.6% and 88.8% weighted accuracy at 12 months respectively, with estimated half-lives of approximately 9 years. The least stable are **aspects** and **logic.md**, with half-lives of approximately 2.4 and 2.7 years respectively.

The most surprising finding was that **aspects ranked last in stability** despite being predicted first. This is because aspects describe cross-cutting patterns with **binary existence** -- a pattern either exists in the code or it does not. When a repository introduces a new cross-cutting concern (pessimistic locking, currency-precision rounding, retry-on-deadlock), the corresponding aspect is 100% wrong against any historical code predating the introduction. This catastrophic decay pattern is fundamentally different from the gradual degradation seen in logic.md, where individual algorithm steps become stale one at a time. The implication for Yggdrasil is that aspects require a different review strategy: they should be validated not on a time-based schedule but on every significant feature addition.

Across all three repositories and both time points, the overall weighted accuracy was **79.4% at 12 months** and **91.4% at 6 months**. This means a Yggdrasil graph retains substantial value even without maintenance -- roughly 4 out of 5 claims remain accurate after a full year. However, the remaining 20% of inaccurate claims are not randomly distributed; they cluster around specific newly-added features, which means agents relying on stale graphs will be systematically wrong about the newest parts of the codebase while remaining correct about the established foundations. This pattern suggests that staleness detection should prioritize identifying _new additions_ rather than re-validating existing knowledge.
