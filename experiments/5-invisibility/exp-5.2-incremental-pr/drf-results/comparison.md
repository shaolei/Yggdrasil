# Patch Comparison: Expert vs Auto — DRF Results

## Per-Commit Analysis

### Commit 1: Change OR semantics (aspect-affecting)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| permissions/internals.md modify | permissions/internals.md modify | TP |
| permissions/interface.md modify | permissions/interface.md modify | TP |
| operator-composition aspect modify | operator-composition aspect modify | TP |
| Decision: coupled vs independent | Decision: coupled vs independent | TP (decision) |

- **TP: 3, FP: 0, FN: 0** | Precision: 1.00, Recall: 1.00, F1: 1.00
- Decision capture: 1/1

### Commit 2: Add __eq__ to OperandHolder (feature)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| permissions/interface.md modify | permissions/interface.md modify | TP |
| permissions/internals.md modify | (not proposed) | FN |

- **TP: 1, FP: 0, FN: 1** | Precision: 1.00, Recall: 0.50, F1: 0.67
- Decision capture: N/A (none in PR)

### Commit 3: Fix deepcopy recursion on Request (bugfix)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| request/internals.md modify | request/internals.md modify | TP |
| request/interface.md modify | (not proposed) | FN |

- **TP: 1, FP: 0, FN: 1** | Precision: 1.00, Recall: 0.50, F1: 0.67
- Decision capture: N/A (decision not marked should_be_captured)

### Commit 4: Preserve exception messages (bugfix)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| api-view/internals.md modify | api-view/internals.md modify | TP |
| api-view/interface.md modify | api-view/interface.md modify | TP |

- **TP: 2, FP: 0, FN: 0** | Precision: 1.00, Recall: 1.00, F1: 1.00
- Decision capture: N/A

### Commit 5: Replace partition with split (refactor)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| authentication/internals.md modify | authentication/internals.md modify | TP |
| authentication/interface.md modify | (not proposed) | FN |
| Decision: split over partition | (not captured) | FN (decision) |

- **TP: 1, FP: 0, FN: 1** | Precision: 1.00, Recall: 0.50, F1: 0.67
- Decision capture: 0/1

### Commit 6: Fix throttling when user is None (bugfix)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| throttling/internals.md modify | throttling/internals.md modify | TP |
| throttling/interface.md modify | throttling/interface.md modify | TP |

- **TP: 2, FP: 0, FN: 0** | Precision: 1.00, Recall: 1.00, F1: 1.00
- Decision capture: N/A

### Commit 7: Auth check before _ignore_model_permissions (bugfix)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| permissions/internals.md modify | permissions/internals.md modify | TP |
| permissions/interface.md modify | permissions/interface.md modify | TP |
| Decision: auth before bypass | Decision: auth before bypass | TP (decision) |

- **TP: 2, FP: 0, FN: 0** | Precision: 1.00, Recall: 1.00, F1: 1.00
- Decision capture: 1/1

### Commit 8: Respect can_read_model permission (interface change)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| permissions/interface.md modify | permissions/interface.md modify | TP |
| permissions/internals.md modify | permissions/internals.md modify | TP |
| permissions/responsibility.md modify | (not proposed) | FN |
| Decision: require view perm | Decision: require view perm | TP (decision) |
| Decision: fallback to change perm | (not captured) | FN (decision) |

- **TP: 2, FP: 0, FN: 1** | Precision: 1.00, Recall: 0.67, F1: 0.80
- Decision capture: 1/2

### Commit 9: Add __hash__ to OperandHolder (feature)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| permissions/interface.md modify | permissions/interface.md modify | TP |

- **TP: 1, FP: 0, FN: 0** | Precision: 1.00, Recall: 1.00, F1: 1.00
- Decision capture: N/A

### Commit 10: Remove deprecated DATA/QUERY_PARAMS (refactor)

| Expert Updates | Auto Updates | Match |
|---|---|---|
| request/interface.md modify | request/interface.md modify | TP |
| request/internals.md modify | request/internals.md modify | TP |

- **TP: 2, FP: 0, FN: 0** | Precision: 1.00, Recall: 1.00, F1: 1.00
- Decision capture: N/A

## Summary Table

| Commit | Type | Expert Ops | Auto Ops | TP | FP | FN | Precision | Recall | F1 |
|--------|------|-----------|----------|----|----|----|-----------|---------|----|
| 1 | Aspect-affecting | 3 | 3 | 3 | 0 | 0 | 1.00 | 1.00 | 1.00 |
| 2 | Feature | 2 | 1 | 1 | 0 | 1 | 1.00 | 0.50 | 0.67 |
| 3 | Bugfix | 2 | 1 | 1 | 0 | 1 | 1.00 | 0.50 | 0.67 |
| 4 | Bugfix | 2 | 2 | 2 | 0 | 0 | 1.00 | 1.00 | 1.00 |
| 5 | Refactor | 2 | 1 | 1 | 0 | 1 | 1.00 | 0.50 | 0.67 |
| 6 | Bugfix | 2 | 2 | 2 | 0 | 0 | 1.00 | 1.00 | 1.00 |
| 7 | Bugfix | 2 | 2 | 2 | 0 | 0 | 1.00 | 1.00 | 1.00 |
| 8 | Interface change | 3 | 2 | 2 | 0 | 1 | 1.00 | 0.67 | 0.80 |
| 9 | Feature | 1 | 1 | 1 | 0 | 0 | 1.00 | 1.00 | 1.00 |
| 10 | Refactor | 2 | 2 | 2 | 0 | 0 | 1.00 | 1.00 | 1.00 |
| **TOTAL** | | **21** | **17** | **17** | **0** | **4** | **1.00** | **0.81** | **0.89** |

## Decision Capture

| Commit | Decisions in Expert | Captured by Auto | Rate |
|--------|-------------------|-----------------|------|
| 1 | 1 | 1 | 100% |
| 5 | 1 | 0 | 0% |
| 7 | 1 | 1 | 100% |
| 8 | 2 | 1 | 50% |
| **TOTAL** | **5** | **3** | **60%** |

## Aggregate Metrics

| Metric | Value | Threshold | Verdict |
|--------|-------|-----------|---------|
| Precision | 100% (17/17) | >= 90% | PASS |
| Recall | 81% (17/21) | >= 70% | PASS |
| F1 (macro avg) | 0.88 | N/A | N/A |
| Decision capture | 60% (3/5) | >= 50% | PASS |
| False positive rate | 0% (0/17) | < 10% | PASS |
