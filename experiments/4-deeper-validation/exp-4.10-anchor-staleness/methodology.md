# Experiment 4.10: Anchor-Based Staleness Detection Validation

## Hypothesis

Experiment 4.6 demonstrated that NO git-level signal (commit frequency, churn, recency, commit type) predicts aspect staleness. Its recommendation was: implement code anchors -- specific function names, identifiers, or patterns that implement each aspect. When an anchor changes in a diff, flag the aspect for review.

This experiment validates whether code anchors actually deliver better staleness detection than git signals.

## Setup

- **Repository:** Hoppscotch (`/workspaces/hoppscotch/`), same as 4.6
- **Aspects:** 5 (pessimistic-locking, pubsub-events, retry-on-deadlock, role-based-access, team-ownership)
- **Product feature tested:** `anchors` field on `aspect.yaml` (recently implemented)
- **CLI version:** Current development build (`/workspaces/Yggdrasil/source/cli/dist/bin.js`)

## Phase 1: Anchor Selection

For each aspect, I:

1. Read the aspect's content.md to understand what behavioral pattern it describes
2. Searched the Hoppscotch source code for functions, identifiers, constants, and patterns that implement the aspect
3. Selected anchors based on three criteria:
   - **Specificity:** The identifier is distinctive enough to avoid false positives
   - **Centrality:** The identifier is central to the pattern (changing it implies the pattern changed)
   - **Coverage:** Together, the anchors cover the full scope of the aspect
4. Added `stability` classification (schema/protocol/implementation) based on 4.6's stability tier findings
5. Validated with `yg validate` and `yg aspects`

### Anchor selection categories

Three types of anchors were used:

- **Function/method names** (e.g., `lockTeamCollectionByTeamAndParent`, `getTeamOfCollection`): Most specific, low false positive rate, but vulnerable to renames
- **Constants/error codes** (e.g., `TEAM_COL_REORDERING_FAILED`, `TRANSACTION_DEADLOCK`): Highly specific, rarely change without semantic change
- **Structural patterns** (e.g., `FOR UPDATE`, `pubsub.publish`): Medium specificity, broader coverage, higher false positive potential

## Phase 2: Staleness Simulation

For each aspect's anchors:

1. **Anchor presence:** Search the codebase for each anchor, count files and occurrences
2. **Anchor specificity:** Classify each anchor's false positive risk (would unrelated changes match it?)
3. **Scenario replay:** Using the 4.6 dataset (simulated graph at tag 2025.8.0), determine:
   - Would the anchor have existed in the 2025.8.0 code?
   - Would a diff from 2025.8.0 to current contain the anchor?
   - Would that detection correctly predict the aspect needs review?
4. **False negative analysis:** Identify scenarios where the aspect could become stale WITHOUT any anchor changing
5. **False positive analysis:** Identify scenarios where an anchor changes but the aspect is still accurate

## Phase 3: Comparison to 4.6

Direct comparison of detection rates:

| Metric | Git signals (4.6) | Code anchors (4.10) |
|--------|-------------------|---------------------|
| True positive rate | ? | ? |
| False positive rate | ? | ? |
| False negative rate | ? | ? |

## Controls

- Same repository, same aspects, same time window as 4.6
- Same staleness ground truth (manual claim verification from 4.6)
- Anchors selected by reading code, not by reverse-engineering from known staleness outcomes
