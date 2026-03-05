/**
 * PhaseEngine — Executes individual recipe phases with environmental monitoring,
 * duration adjustment, completion criteria checking, and contamination event raising.
 *
 * Implemented from context package: orchestrator/phase-engine
 */

import type {
  EnvironmentalConditions,
  EnvironmentalLimits,
  DurationAdjustment,
  AlarmEvent,
  ConditionMonitor,
} from '../environment/condition-monitor.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PhaseState = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface PhaseDefinition {
  id: string;
  name: string;
  equipmentId: string;
  baseDuration: number; // ms
  completionCriteria: CompletionCriteria;
  environmentalLimits: EnvironmentalLimits;
  gracePeriod: number; // ms
}

export interface CompletionCriteria {
  type: 'duration' | 'condition' | 'both';
  targetTemperature?: number; // Celsius
  targetPressure?: number; // kPa
  tolerance?: number; // percentage
}

export interface PhaseExecution {
  executionId: string;
  phaseIndex: number;
  state: PhaseState;
  startTime: number;
  elapsedTime: number; // ms, paused time excluded
  adjustedDuration: number; // ms
  completionCriteriaMet: boolean;
  environmentalReadings: EnvironmentalReading[];
}

export interface EnvironmentalReading {
  timestamp: number;
  temperature: number;
  pressure: number;
  durationFactor: number;
}

export interface PhaseResult {
  executionId: string;
  phaseIndex: number;
  outcome: 'completed' | 'failed' | 'aborted';
  actualDuration: number;
  finalConditions: { temperature: number; pressure: number };
  contaminationEvent?: ContaminationEvent;
  failureReason?: string;
}

export interface ContaminationEvent {
  sourceRecipeId: string;
  sourcePhaseId: string;
  equipmentId: string;
  timestamp: number;
  cascadeDepth: number;
}

export interface PhaseEngineCallbacks {
  onPhaseComplete(executionId: string, phaseIndex: number, result: PhaseResult): void;
  onContamination(event: ContaminationEvent): void;
  onPhaseStateChange(executionId: string, from: PhaseState, to: PhaseState): void;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class PhaseOrderViolation extends Error {
  constructor(
    public readonly expected: number,
    public readonly received: number,
  ) {
    super(`Phase order violation: expected phase ${expected}, received ${received}`);
    this.name = 'PhaseOrderViolation';
  }
}

export class PhaseAlreadyRunning extends Error {
  constructor(public readonly executionId: string) {
    super(`Phase already running for execution ${executionId}`);
    this.name = 'PhaseAlreadyRunning';
  }
}

export class NoActivePhaseError extends Error {
  constructor(public readonly executionId: string) {
    super(`No active phase for execution ${executionId}`);
    this.name = 'NoActivePhaseError';
  }
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface ActivePhase {
  execution: PhaseExecution;
  phaseDefinition: PhaseDefinition;
  equipmentId: string;
  currentFactor: number;
  inGracePeriod: boolean;
  gracePeriodStart: number;
  monitorUnavailableSince: number | null;
  unsubscribeAlarm: (() => void) | null;
  resolve: (result: PhaseResult) => void;
  lastCompletedPhaseIndex: number; // tracks expected sequence
}

// ─── Implementation ──────────────────────────────────────────────────────────

const TICK_INTERVAL_MS = 100;
const MONITOR_TIMEOUT_MS = 60_000; // 60s
const HARD_TIMEOUT_MULTIPLIER = 1.5;

export class PhaseEngine {
  private activePhases: Map<string, ActivePhase> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private callbacks: PhaseEngineCallbacks;
  private conditionMonitor: ConditionMonitor;

  constructor(conditionMonitor: ConditionMonitor, callbacks: PhaseEngineCallbacks) {
    this.conditionMonitor = conditionMonitor;
    this.callbacks = callbacks;
  }

  /**
   * Start executing a phase. Returns a promise that resolves when the phase
   * reaches a terminal state (completed, failed, or aborted).
   *
   * Enforces temporal monotonicity: phaseIndex must follow sequential order.
   */
  startPhase(
    executionId: string,
    phaseIndex: number,
    phaseDefinition: PhaseDefinition,
    equipmentId: string,
  ): Promise<PhaseResult> {
    // Check for already-running phase (PhaseAlreadyRunning)
    const existing = this.activePhases.get(executionId);
    if (existing && (existing.execution.state === 'running' || existing.execution.state === 'paused')) {
      throw new PhaseAlreadyRunning(executionId);
    }

    // Enforce temporal monotonicity
    const expectedIndex = existing ? existing.lastCompletedPhaseIndex + 1 : 0;
    if (phaseIndex !== expectedIndex) {
      throw new PhaseOrderViolation(expectedIndex, phaseIndex);
    }

    return new Promise<PhaseResult>((resolve) => {
      const execution: PhaseExecution = {
        executionId,
        phaseIndex,
        state: 'running',
        startTime: Date.now(),
        elapsedTime: 0,
        adjustedDuration: phaseDefinition.baseDuration,
        completionCriteriaMet: false,
        environmentalReadings: [],
      };

      // Subscribe to environmental alarms (edge-triggered)
      let unsubscribeAlarm: (() => void) | null = null;
      try {
        unsubscribeAlarm = this.conditionMonitor.subscribeToAlarms(
          equipmentId,
          phaseDefinition.environmentalLimits,
          (_alarm: AlarmEvent) => {
            // Alarm handling is done in the tick loop via limit checking.
            // The subscription ensures we are notified of threshold crossings,
            // but the tick loop is the authoritative decision-maker.
          },
        );
      } catch {
        // Monitor may not have this equipment registered; continue without alarm
      }

      const activePhase: ActivePhase = {
        execution,
        phaseDefinition,
        equipmentId,
        currentFactor: 1.0,
        inGracePeriod: false,
        gracePeriodStart: 0,
        monitorUnavailableSince: null,
        unsubscribeAlarm,
        resolve,
        lastCompletedPhaseIndex: existing?.lastCompletedPhaseIndex ?? -1,
      };

      this.activePhases.set(executionId, activePhase);
      this.callbacks.onPhaseStateChange(executionId, 'idle', 'running');

      // Start tick interval if not already running
      if (!this.tickInterval) {
        this.tickInterval = setInterval(() => this.tick(), TICK_INTERVAL_MS);
      }
    });
  }

  /**
   * Synchronous. Immediately aborts a running phase, raises contamination event.
   * No-op if no phase is running for this executionId.
   */
  abortPhase(executionId: string): void {
    const active = this.activePhases.get(executionId);
    if (!active || (active.execution.state !== 'running' && active.execution.state !== 'paused')) {
      return; // no-op
    }

    this.failPhase(active, 'aborted', 'Aborted by scheduler');
  }

  /**
   * Synchronous. Pauses the phase timer.
   */
  pausePhase(executionId: string): void {
    const active = this.activePhases.get(executionId);
    if (!active || active.execution.state !== 'running') {
      throw new NoActivePhaseError(executionId);
    }

    this.transitionState(active, 'paused');
  }

  /**
   * Synchronous. Resumes a paused phase.
   */
  resumePhase(executionId: string): void {
    const active = this.activePhases.get(executionId);
    if (!active || active.execution.state !== 'paused') {
      throw new NoActivePhaseError(executionId);
    }

    this.transitionState(active, 'running');
  }

  /**
   * Returns current phase execution state, or undefined if no active phase.
   */
  getPhaseExecution(executionId: string): PhaseExecution | undefined {
    const active = this.activePhases.get(executionId);
    return active ? { ...active.execution } : undefined;
  }

  // ─── Private methods ────────────────────────────────────────────────────────

  private tick(): void {
    for (const [executionId, active] of this.activePhases) {
      const { execution, phaseDefinition, equipmentId } = active;

      // Only process running phases (paused phases skip the tick)
      if (execution.state !== 'running') {
        // Check paused phase for grace period or monitor timeout
        if (execution.state === 'paused') {
          this.checkPausedTimeouts(active);
        }
        continue;
      }

      // Step 1: Read current conditions
      let conditions: EnvironmentalConditions;
      try {
        conditions = this.conditionMonitor.getConditions(equipmentId);
        // If we were tracking monitor unavailability, clear it
        if (active.monitorUnavailableSince !== null) {
          active.monitorUnavailableSince = null;
        }
      } catch {
        // Condition monitor unavailable: pause phase timer, safety-first
        if (active.monitorUnavailableSince === null) {
          active.monitorUnavailableSince = Date.now();
          this.transitionState(active, 'paused');
        }
        continue;
      }

      // Step 2: Calculate duration factor
      let adjustment: DurationAdjustment;
      try {
        adjustment = this.conditionMonitor.calculateDurationAdjustment(
          conditions,
          phaseDefinition.environmentalLimits,
        );
      } catch {
        adjustment = { factor: 1.0, reason: 'Fallback: unable to calculate adjustment' };
      }

      // Record environmental reading
      execution.environmentalReadings.push({
        timestamp: conditions.timestamp,
        temperature: conditions.temperature,
        pressure: conditions.pressure,
        durationFactor: adjustment.factor,
      });

      // Step 3: Update adjusted duration (factor applies to REMAINING time)
      const remainingBase = phaseDefinition.baseDuration - (execution.elapsedTime / active.currentFactor);
      execution.adjustedDuration = execution.elapsedTime + (remainingBase * adjustment.factor);
      active.currentFactor = adjustment.factor;

      // Step 4: Check environmental limits
      const isExceeding = this.isOutsideLimits(conditions, phaseDefinition.environmentalLimits);

      if (isExceeding) {
        if (!active.inGracePeriod) {
          // Start grace period, pause timer
          active.inGracePeriod = true;
          active.gracePeriodStart = Date.now();
          this.transitionState(active, 'paused');
          continue;
        }
        // Grace period already running — check in paused timeout handler
      } else {
        if (active.inGracePeriod) {
          // Conditions returned to safe — resume timer, clear grace period
          active.inGracePeriod = false;
          active.gracePeriodStart = 0;
          // State will already be 'running' if we reach here
        }
      }

      // Step 5: Advance elapsed time
      execution.elapsedTime += TICK_INTERVAL_MS;

      // Step 6: Check completion criteria
      const durationMet = execution.elapsedTime >= execution.adjustedDuration;
      const conditionMet = this.checkConditionCriteria(conditions, phaseDefinition.completionCriteria);

      let isComplete = false;
      switch (phaseDefinition.completionCriteria.type) {
        case 'duration':
          isComplete = durationMet;
          break;
        case 'condition':
          isComplete = conditionMet;
          break;
        case 'both':
          isComplete = durationMet && conditionMet;
          break;
      }

      execution.completionCriteriaMet = isComplete;

      // Step 7: If complete, resolve with 'completed'
      if (isComplete) {
        this.completePhase(active, conditions);
        continue;
      }

      // Step 8: Hard timeout check (1.5x adjusted duration)
      if (execution.elapsedTime > execution.adjustedDuration * HARD_TIMEOUT_MULTIPLIER) {
        this.failPhase(
          active,
          'failed',
          `Hard timeout: elapsed ${execution.elapsedTime}ms exceeds ${execution.adjustedDuration * HARD_TIMEOUT_MULTIPLIER}ms`,
        );
      }
    }

    // Clear tick interval if no more active phases
    if (this.activePhases.size === 0 && this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private checkPausedTimeouts(active: ActivePhase): void {
    const now = Date.now();

    // Check monitor unavailability timeout (60s)
    if (active.monitorUnavailableSince !== null) {
      if (now - active.monitorUnavailableSince > MONITOR_TIMEOUT_MS) {
        this.failPhase(active, 'failed', 'Condition monitor unavailable for >60s');
        return;
      }

      // Try to reconnect
      try {
        this.conditionMonitor.getConditions(active.equipmentId);
        // Monitor reconnected — resume
        active.monitorUnavailableSince = null;
        this.transitionState(active, 'running');
      } catch {
        // Still unavailable
      }
      return;
    }

    // Check grace period timeout
    if (active.inGracePeriod) {
      if (now - active.gracePeriodStart > active.phaseDefinition.gracePeriod) {
        this.failPhase(
          active,
          'failed',
          `Environmental exceedance: grace period (${active.phaseDefinition.gracePeriod}ms) exceeded`,
        );
        return;
      }

      // Check if conditions returned to safe range
      try {
        const conditions = this.conditionMonitor.getConditions(active.equipmentId);
        if (!this.isOutsideLimits(conditions, active.phaseDefinition.environmentalLimits)) {
          // Conditions restored — resume
          active.inGracePeriod = false;
          active.gracePeriodStart = 0;
          this.transitionState(active, 'running');
        }
      } catch {
        // Monitor unavailable while in grace period — start monitor timeout
        active.monitorUnavailableSince = Date.now();
      }
    }
  }

  private completePhase(active: ActivePhase, conditions: EnvironmentalConditions): void {
    const { execution } = active;
    const previousState = execution.state;
    execution.state = 'completed';

    // Clean up
    active.unsubscribeAlarm?.();

    const result: PhaseResult = {
      executionId: execution.executionId,
      phaseIndex: execution.phaseIndex,
      outcome: 'completed',
      actualDuration: execution.elapsedTime,
      finalConditions: {
        temperature: conditions.temperature,
        pressure: conditions.pressure,
      },
    };

    // Update tracking for temporal monotonicity
    active.lastCompletedPhaseIndex = execution.phaseIndex;

    this.callbacks.onPhaseStateChange(execution.executionId, previousState, 'completed');
    this.callbacks.onPhaseComplete(execution.executionId, execution.phaseIndex, result);

    // Remove from active phases
    this.activePhases.delete(execution.executionId);

    // Resolve the promise
    active.resolve(result);
  }

  private failPhase(active: ActivePhase, outcome: 'failed' | 'aborted', reason: string): void {
    const { execution, equipmentId, phaseDefinition } = active;
    const previousState = execution.state;
    execution.state = 'failed';

    // Clean up
    active.unsubscribeAlarm?.();

    // Create contamination event (cascade depth 0 for initial event)
    const contaminationEvent: ContaminationEvent = {
      sourceRecipeId: execution.executionId,
      sourcePhaseId: phaseDefinition.id,
      equipmentId,
      timestamp: Date.now(),
      cascadeDepth: 0,
    };

    const result: PhaseResult = {
      executionId: execution.executionId,
      phaseIndex: execution.phaseIndex,
      outcome,
      actualDuration: execution.elapsedTime,
      finalConditions: this.getLastConditions(active),
      contaminationEvent,
      failureReason: reason,
    };

    this.callbacks.onPhaseStateChange(execution.executionId, previousState, 'failed');

    // Raise contamination event synchronously — before resolving the promise
    this.callbacks.onContamination(contaminationEvent);

    this.callbacks.onPhaseComplete(execution.executionId, execution.phaseIndex, result);

    // Remove from active phases
    this.activePhases.delete(execution.executionId);

    // Resolve the promise
    active.resolve(result);
  }

  private transitionState(active: ActivePhase, to: PhaseState): void {
    const from = active.execution.state;
    active.execution.state = to;
    this.callbacks.onPhaseStateChange(active.execution.executionId, from, to);
  }

  private isOutsideLimits(conditions: EnvironmentalConditions, limits: EnvironmentalLimits): boolean {
    return (
      conditions.temperature > limits.maxTemperature ||
      conditions.temperature < limits.minTemperature ||
      conditions.pressure > limits.maxPressure ||
      conditions.pressure < limits.minPressure
    );
  }

  private checkConditionCriteria(
    conditions: EnvironmentalConditions,
    criteria: CompletionCriteria,
  ): boolean {
    if (criteria.type === 'duration') return true; // duration-only doesn't use conditions

    const tolerance = (criteria.tolerance ?? 0) / 100;

    if (criteria.targetTemperature !== undefined) {
      const tempRange = criteria.targetTemperature * tolerance;
      if (Math.abs(conditions.temperature - criteria.targetTemperature) > tempRange) {
        return false;
      }
    }

    if (criteria.targetPressure !== undefined) {
      const pressRange = criteria.targetPressure * tolerance;
      if (Math.abs(conditions.pressure - criteria.targetPressure) > pressRange) {
        return false;
      }
    }

    return true;
  }

  private getLastConditions(active: ActivePhase): { temperature: number; pressure: number } {
    const readings = active.execution.environmentalReadings;
    if (readings.length > 0) {
      const last = readings[readings.length - 1];
      return { temperature: last.temperature, pressure: last.pressure };
    }
    return { temperature: 0, pressure: 0 };
  }
}
