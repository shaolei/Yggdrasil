# Phase Engine Internals

## Logic

### Tick Loop

The phase engine uses a 100ms tick interval (setInterval). Each tick:

```
tick():
  for each active phase execution:
    1. Read current conditions: conditionMonitor.getConditions(equipmentId)
       → if unavailable: pause phase, start 60s unavailability timer
    2. Calculate duration factor: conditionMonitor.calculateDurationAdjustment(
         conditions, phaseDefinition.environmentalLimits)
    3. Update adjustedDuration:
       remainingBase = baseDuration - (elapsedTime / currentFactor)
       adjustedDuration = elapsedTime + (remainingBase * newFactor)
       // Factor applies to REMAINING time, not total time
    4. Check environmental limits:
       if conditions outside phaseDefinition.environmentalLimits:
         if not already in grace period:
           start grace period timer (phaseDefinition.gracePeriod ms)
           pause elapsedTime accumulation (timer paused)
         else if grace period exceeded:
           fail phase → raise contamination
       else:
         if was in grace period: resume timer, clear grace period
    5. Advance elapsedTime by 100ms (only if not paused)
    6. Check completion criteria:
       type 'duration': elapsedTime >= adjustedDuration
       type 'condition': conditions within target ± tolerance
       type 'both': duration met AND conditions met
    7. If complete: resolve promise with 'completed' outcome
    8. If elapsedTime > adjustedDuration * 1.5 (hard timeout):
       fail phase → raise contamination
```

### Duration Adjustment Formula

The condition monitor returns a `durationFactor` (float, >= 0.5, <= 3.0). This represents how much slower (>1.0) or faster (<1.0) the reaction proceeds under current conditions vs optimal.

Key insight: the factor applies to REMAINING time, not total time. If a phase is 50% done and conditions change, only the remaining 50% is adjusted. This prevents already-elapsed time from being retroactively modified.

### Phase State Machine

```
idle → running (startPhase called)
running → paused (environmental exceedance OR explicit pause OR monitor unavailable)
running → completed (completion criteria met)
running → failed (timeout, grace period exceeded, monitor timeout)
paused → running (conditions restored OR explicit resume OR monitor reconnected)
paused → failed (grace period exceeded while paused, 60s monitor timeout)
failed → (terminal, contamination event raised)
completed → (terminal)
```

No transition from completed/failed to any other state. Terminal states are final.

## State

- `activePhases: Map<string, PhaseExecution>` — keyed by executionId, max 1 per execution
- `tickInterval: NodeJS.Timeout | null` — the 100ms tick timer; created on first startPhase, cleared when no active phases
- `callbacks: PhaseEngineCallbacks` — injected at construction

## Decisions

- **Chose 100ms tick interval over event-driven timing** because environmental conditions change continuously and duration adjustment must be recalculated frequently. Event-driven would miss gradual environmental drift between events. Rejected: 1s tick — too coarse for accurate duration adjustment. Rejected: 10ms tick — unnecessary precision, excessive CPU usage.

- **Chose factor-on-remaining over factor-on-total duration adjustment** because retroactive adjustment of elapsed time creates confusion (a phase that has been running for 10s suddenly shows 15s elapsed). Adjusting only remaining time is monotonic — elapsed time only moves forward. Rejected: factor-on-total — simpler math but non-monotonic elapsed time.

- **Chose synchronous callbacks over EventEmitter** because contamination must be handled in the same tick. EventEmitter in Node.js defers to next microtask. Direct synchronous function calls guarantee same-tick execution. Rejected: EventEmitter — familiar pattern but wrong semantics for this safety-critical requirement.
