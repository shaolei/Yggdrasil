# Error Pattern Analysis: DRF

## False Negatives (4 total, 0 FP)

### Pattern 1: Interface update missed for internal bugfixes (3 occurrences)

**Commits:** 2, 3, 5

The auto-patcher correctly identified internals.md updates but missed corresponding interface.md updates. In each case, the bugfix or feature had user-facing implications (new method, new edge case behavior, new failure mode) that should be reflected in the interface contract.

- Commit 2: Added __eq__ but auto only proposed interface update, missed internals. (Actually reversed: expert wanted internals too.)
- Commit 3: Fixed deepcopy behavior — auto missed that "safe to deepcopy" is a user-facing contract.
- Commit 5: Changed failure mode for missing-colon credentials — auto missed interface.md failure mode update.

**Root cause:** The auto-patcher tends to update the artifact most directly connected to the code change (internals for implementation changes, interface for API changes) but misses the secondary artifact. When a bugfix changes failure modes, the interface contract should be updated too, but the auto-patcher doesn't systematically check "does this change affect the contract?"

**Mitigation:** Add a rule: "For every internals.md update, check whether the change also affects the public contract (new failure modes, new edge cases, changed preconditions). If so, update interface.md too."

### Pattern 2: Responsibility.md update missed for scope-expanding changes (1 occurrence)

**Commit:** 8

The auto-patcher missed that adding view permission enforcement to DjangoModelPermissions expanded the node's effective responsibility from "write permission enforcement" to "read+write permission enforcement." This is a responsibility boundary shift.

**Root cause:** responsibility.md is rarely changed by diffs — it describes identity and boundaries, which change only on major scope shifts. The auto-patcher focuses on what changed in the code but not whether the change redefines what the component is FOR.

**Mitigation:** Add a rule: "If a diff adds new behavior categories (not just fixing existing ones), check whether responsibility.md boundaries need updating."

### Pattern 3: Decision capture from implicit code reasoning (2 misses out of 5)

**Commits:** 5, 8 (partial)

- Commit 5: The decision to use split over partition for security was inferable from the test addition but not explicitly stated in the commit message. Auto missed it.
- Commit 8: The fallback-to-change-permission decision was implicit in the code but not stated in the commit message. Auto captured the primary decision but missed the secondary one.

**Root cause:** When decisions are not explicitly stated in PR text, the auto-patcher cannot capture them. It correctly follows the rule of not inventing rationale, but this means implicit design decisions are lost.

**Mitigation:** This is fundamentally hard to automate. Two options: (1) flag "possible implicit decisions" for human review, (2) add PR template prompting authors to explain "why this approach."

## False Positives (0 total)

No false positives were generated. The auto-patcher was conservative as instructed — it only proposed changes it was confident about.

## Summary by Commit Type

| Type | Count | Avg Recall | Common FN Pattern |
|------|-------|------------|-------------------|
| Aspect-affecting | 1 | 1.00 | None |
| Feature | 3 | 0.83 | Missing secondary artifact |
| Bugfix | 4 | 0.88 | Missing interface update for behavior changes |
| Refactor | 2 | 0.75 | Missing interface update + implicit decisions |
| Interface change | 1 | 0.67 | Missing responsibility.md + implicit decisions |

Aspect-affecting and simple bugfixes are most reliable. Refactors and interface changes have the lowest recall due to secondary-artifact and responsibility-boundary misses.
