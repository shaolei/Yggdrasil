# Phase Engine Interface

## Types

```typescript
type PhaseState = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

interface PhaseExecution {
  executionId: string;
  phaseIndex: number;
  state: PhaseState;
  startTime: number; // epoch ms
  elapsedTime: number; // ms, paused time excluded
  adjustedDuration: number; // ms, base duration * environmental factor
  completionCriteriaMet: boolean;
  environmentalReadings: EnvironmentalReading[];
}

interface EnvironmentalReading {
  timestamp: number;
  temperature: number; // Celsius
  pressure: number; // kPa
  durationFactor: number; // multiplier applied to remaining duration
}

interface PhaseResult {
  executionId: string;
  phaseIndex: number;
  outcome: 'completed' | 'failed' | 'aborted';
  actualDuration: number; // ms
  finalConditions: { temperature: number; pressure: number };
  contaminationEvent?: ContaminationEvent;
  failureReason?: string;
}
```

## Methods

- `startPhase(executionId: string, phaseIndex: number, phaseDefinition: PhaseDefinition, equipmentId: string): Promise<PhaseResult>`
  - Parameters: `executionId`, `phaseIndex` (must equal recipe's currentPhaseIndex), `phaseDefinition`, `equipmentId`
  - Returns: PhaseResult when phase reaches terminal state (completed, failed, or aborted)
  - The promise resolves when the phase finishes — it does NOT resolve immediately. The caller awaits it.
  - Starts a 100ms tick interval. Each tick: read conditions from condition-monitor, recalculate adjusted duration, check completion criteria, check environmental limits.
  - Throws `PhaseOrderViolation` if phaseIndex does not match expected sequence (temporal-monotonicity enforcement)
  - Throws `PhaseAlreadyRunning` if this executionId already has a running phase

- `abortPhase(executionId: string): void`
  - Synchronous. Immediately transitions running phase to 'failed' state, raises contamination event, resolves the startPhase promise with 'aborted' outcome.
  - No-op if no phase is running for this executionId.

- `pausePhase(executionId: string): void`
  - Synchronous. Pauses the phase timer (elapsedTime stops advancing). Phase remains in 'paused' state until resumed.
  - Throws `NoActivePhaseError` if no running phase for executionId.

- `resumePhase(executionId: string): void`
  - Synchronous. Resumes a paused phase. Timer continues from where it stopped.
  - Throws `NoActivePhaseError` if no paused phase for executionId.

- `getPhaseExecution(executionId: string): PhaseExecution | undefined`
  - Returns current phase execution state, or undefined if no active phase.

## Failure Modes

- **PhaseOrderViolation**: Attempted to start phase N when phase N-1 has not completed. This is an invariant violation — indicates bug in scheduler. Contains `expected: number, received: number`.
- **PhaseAlreadyRunning**: Attempted to start a new phase while one is already running for this execution.
- **NoActivePhaseError**: Attempted to pause/resume a phase that is not running/paused.
- **Phase timeout**: adjustedDuration exceeded. Phase transitions to 'failed', contamination event raised. This is normal operation, not a bug.
- **Environmental exceedance**: Conditions outside safe limits. Timer paused, grace period started. If grace period exceeded without recovery, phase fails.
- **Condition-monitor unavailable**: Phase timer paused (safety-first). Resumes when monitor reconnects. If monitor unavailable for > 60s, phase fails.

## Callbacks

The phase-engine emits events to the scheduler via a callback interface (passed during construction):

```typescript
interface PhaseEngineCallbacks {
  onPhaseComplete(executionId: string, phaseIndex: number, result: PhaseResult): void;
  onContamination(event: ContaminationEvent): void;
  onPhaseStateChange(executionId: string, from: PhaseState, to: PhaseState): void;
}
```

These callbacks are invoked synchronously from the tick loop. The scheduler's handleContamination is called directly via onContamination — no event queue.
