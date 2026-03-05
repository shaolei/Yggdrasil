# Temporal Monotonicity

## Requirement

Within a single recipe execution, phases must execute in the order defined by the recipe specification. No phase may be skipped, reordered, or run concurrently with another phase of the same recipe.

## Rules

1. **Sequential phase index**: Each recipe execution maintains a `currentPhaseIndex` starting at 0. The only valid transition is `currentPhaseIndex -> currentPhaseIndex + 1`. Any attempt to advance by more than 1, go backwards, or stay at the same index (re-execute) is rejected with `PhaseOrderViolation`.

2. **Phase completion gate**: A phase is complete only when its `completionCriteria` are satisfied (duration elapsed AND target conditions met). The scheduler must not advance to the next phase until completion is confirmed.

3. **Environmental adjustment does not reorder**: When environmental conditions (temperature, pressure) cause a phase to take longer, the phase duration extends but the phase sequence is unchanged. The adjustment is to duration, never to ordering.

4. **Abort respects monotonicity**: When a recipe is aborted (due to contamination, timeout, or manual intervention), it transitions to a terminal state. It does not "skip" remaining phases — they are cancelled, not skipped. The distinction matters: cancelled phases are recorded as never-started, not as completed-with-skip.

5. **Cross-recipe independence**: Temporal monotonicity applies within a single recipe. Different recipes may execute phases concurrently with each other (on different equipment). Monotonicity is a per-recipe invariant, not a global one.

## Rejected Alternatives

- **Allow phase skipping with operator override**: rejected because chemical reactions build on prior phase outputs. Skipping a phase produces unsafe intermediate states. Safety override is abort, not skip.
- **Parallel phases within a recipe**: rejected because the domain requires sequential chemical transformations. The output of phase N is the input of phase N+1. Parallelism within a recipe is physically impossible.
