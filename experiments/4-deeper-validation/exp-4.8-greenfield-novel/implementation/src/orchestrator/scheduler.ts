/**
 * RecipeScheduler — Central coordinator for recipe execution lifecycle.
 * Manages execution queue, equipment booking, phase transitions,
 * contamination cascades, and emergency halt.
 *
 * Implemented from context package: orchestrator/scheduler
 */

import { randomUUID } from 'node:crypto';
import type { PhaseEngine, PhaseResult, ContaminationEvent, PhaseEngineCallbacks } from './phase-engine.js';
import type { ReagentManager, AllocationRequest, AllocationResult, InventoryEvent } from '../inventory/reagent-manager.js';
import type { ConditionMonitor } from '../environment/condition-monitor.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecipeDefinition {
  id: string;
  name: string;
  phases: PhaseDefinition[];
  timeout: number; // ms, max total execution time
}

export interface PhaseDefinition {
  id: string;
  name: string;
  equipmentId: string;
  requiredReagents: ReagentRequirement[];
  baseDuration: number; // ms
  completionCriteria: CompletionCriteria;
  environmentalLimits: EnvironmentalLimits;
  gracePeriod: number; // ms
}

export interface ReagentRequirement {
  reagentId: string;
  quantity: number; // micrograms (integer)
}

export interface CompletionCriteria {
  type: 'duration' | 'condition' | 'both';
  targetTemperature?: number;
  targetPressure?: number;
  tolerance?: number;
}

export interface EnvironmentalLimits {
  minTemperature: number;
  maxTemperature: number;
  minPressure: number;
  maxPressure: number;
}

export type RecipeExecutionState = 'submitted' | 'queued' | 'active' | 'completed' | 'aborted' | 'halted';

export interface RecipeExecution {
  executionId: string;
  recipe: RecipeDefinition;
  priority: number;
  state: RecipeExecutionState;
  currentPhaseIndex: number;
  startTime: number;
  stateLog: StateTransition[];
}

export interface StateTransition {
  from: RecipeExecutionState | string;
  to: RecipeExecutionState | string;
  timestamp: number;
  cause: string;
  affectedEntities: string[];
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class InvalidRecipeError extends Error {
  constructor(public readonly violations: string[]) {
    super(`Invalid recipe: ${violations.join('; ')}`);
    this.name = 'InvalidRecipeError';
  }
}

export class SystemHaltedError extends Error {
  constructor() {
    super('System is in emergency halt. No new recipes accepted until resumeFromHalt().');
    this.name = 'SystemHaltedError';
  }
}

export class RecipeNotFoundError extends Error {
  constructor(public readonly executionId: string) {
    super(`Recipe execution not found: ${executionId}`);
    this.name = 'RecipeNotFoundError';
  }
}

export class RecipeAlreadyTerminalError extends Error {
  constructor(public readonly executionId: string, public readonly currentState: string) {
    super(`Recipe ${executionId} is already in terminal state: ${currentState}`);
    this.name = 'RecipeAlreadyTerminalError';
  }
}

export class NotHaltedError extends Error {
  constructor() {
    super('System is not in halt state');
    this.name = 'NotHaltedError';
  }
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface EquipmentBooking {
  recipeId: string;
  phaseId: string;
  until: number; // estimated end time (epoch ms)
}

const MAX_CASCADE_DEPTH = 5;
const TERMINAL_STATES: RecipeExecutionState[] = ['completed', 'aborted', 'halted'];

// ─── Implementation ──────────────────────────────────────────────────────────

export class RecipeScheduler {
  private executions: Map<string, RecipeExecution> = new Map();
  private equipmentMap: Map<string, EquipmentBooking | null> = new Map();
  private systemHalted = false;
  private knownEquipment: Set<string> = new Set();

  // Recipes waiting for reagent availability
  private waitingForReagents: Set<string> = new Set();

  private phaseEngine: PhaseEngine;
  private reagentManager: ReagentManager;
  private conditionMonitor: ConditionMonitor;

  constructor(
    phaseEngine: PhaseEngine,
    reagentManager: ReagentManager,
    conditionMonitor: ConditionMonitor,
    knownEquipment: string[],
  ) {
    this.phaseEngine = phaseEngine;
    this.reagentManager = reagentManager;
    this.conditionMonitor = conditionMonitor;

    for (const eq of knownEquipment) {
      this.knownEquipment.add(eq);
      this.equipmentMap.set(eq, null);
    }

    // Register for inventory change events to re-evaluate waiting recipes
    this.reagentManager.onInventoryChange((_event: InventoryEvent) => {
      this.evaluateWaitingRecipes();
    });
  }

  /**
   * Returns the PhaseEngineCallbacks that should be passed to PhaseEngine construction.
   * The scheduler implements the callback interface to receive phase events.
   */
  getPhaseEngineCallbacks(): PhaseEngineCallbacks {
    return {
      onPhaseComplete: (executionId: string, phaseIndex: number, result: PhaseResult) => {
        this.onPhaseComplete(executionId, phaseIndex, result);
      },
      onContamination: (event: ContaminationEvent) => {
        this.handleContamination(event);
      },
      onPhaseStateChange: (_executionId: string, _from: string, _to: string) => {
        // State change logging handled internally
      },
    };
  }

  /**
   * Submit a recipe for execution.
   * Validates the recipe, assigns executionId (UUIDv4), and enqueues.
   */
  async submitRecipe(
    recipe: RecipeDefinition,
    priority: number,
    startTime?: number,
  ): Promise<RecipeExecution> {
    if (this.systemHalted) {
      throw new SystemHaltedError();
    }

    // Validate recipe
    const violations = this.validateRecipe(recipe);
    if (violations.length > 0) {
      throw new InvalidRecipeError(violations);
    }

    const execution: RecipeExecution = {
      executionId: randomUUID(),
      recipe,
      priority,
      state: 'submitted',
      currentPhaseIndex: 0,
      startTime: startTime ?? Date.now(),
      stateLog: [],
    };

    this.executions.set(execution.executionId, execution);

    // Transition: submitted -> queued
    this.recordTransition(execution, 'submitted', 'queued', 'Recipe submitted and enqueued', []);
    execution.state = 'queued';

    // Try to start immediately if equipment and reagents available
    this.tryStartNextPhase(execution);

    return execution;
  }

  /**
   * Cancel a recipe. If queued, removes. If active, aborts current phase.
   */
  async cancelRecipe(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new RecipeNotFoundError(executionId);
    }

    if (TERMINAL_STATES.includes(execution.state)) {
      throw new RecipeAlreadyTerminalError(executionId, execution.state);
    }

    if (execution.state === 'active') {
      // Abort current phase
      this.phaseEngine.abortPhase(executionId);
      // Release reagents for current phase
      const currentPhase = execution.recipe.phases[execution.currentPhaseIndex];
      this.reagentManager.releaseReagents(executionId, currentPhase.id);
      // Release equipment
      this.releaseEquipment(currentPhase.equipmentId, executionId);
    }

    this.waitingForReagents.delete(executionId);
    this.recordTransition(execution, execution.state, 'aborted', 'Cancelled by operator', []);
    execution.state = 'aborted';
  }

  /**
   * Get execution state by ID.
   */
  getExecution(executionId: string): RecipeExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all non-terminal executions, sorted by priority then submission time.
   */
  getActiveExecutions(): RecipeExecution[] {
    const active: RecipeExecution[] = [];
    for (const execution of this.executions.values()) {
      if (!TERMINAL_STATES.includes(execution.state)) {
        active.push(execution);
      }
    }
    // Sort: lower priority number = higher priority, then earlier startTime
    active.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.startTime - b.startTime;
    });
    return active;
  }

  /**
   * Handle contamination event. SYNCHRONOUS — must complete within same tick.
   * Identifies affected recipes by equipment, aborts them, tracks cascade depth.
   * Recursive: aborting a recipe may generate new contamination events.
   */
  handleContamination(event: ContaminationEvent): void {
    // Check cascade depth limit
    if (event.cascadeDepth > MAX_CASCADE_DEPTH) {
      this.emergencyHalt('Cascade depth exceeded maximum of ' + MAX_CASCADE_DEPTH);
      return;
    }

    // Find all active recipes using the contaminated equipment
    // (excluding the source recipe itself)
    const affectedRecipes: RecipeExecution[] = [];
    for (const execution of this.executions.values()) {
      if (execution.state !== 'active') continue;
      if (execution.executionId === event.sourceRecipeId) continue;

      const currentPhase = execution.recipe.phases[execution.currentPhaseIndex];
      if (currentPhase && currentPhase.equipmentId === event.equipmentId) {
        affectedRecipes.push(execution);
      }
    }

    // Abort each affected recipe SYNCHRONOUSLY (no await)
    for (const affected of affectedRecipes) {
      const currentPhase = affected.recipe.phases[affected.currentPhaseIndex];

      // Abort via phase-engine (synchronous)
      this.phaseEngine.abortPhase(affected.executionId);

      // Release reagents
      this.reagentManager.releaseReagents(affected.executionId, currentPhase.id);

      // Release equipment
      this.releaseEquipment(currentPhase.equipmentId, affected.executionId);

      // Record transition
      this.recordTransition(
        affected,
        affected.state,
        'aborted',
        `Contamination from recipe ${event.sourceRecipeId} on equipment ${event.equipmentId} (cascade depth: ${event.cascadeDepth})`,
        [event.equipmentId, event.sourceRecipeId],
      );
      affected.state = 'aborted';
    }

    // Schedule decontamination for the equipment
    this.scheduleDecontamination(event.equipmentId);
  }

  /**
   * Resume from emergency halt. Resets system state but halted recipes remain halted.
   */
  async resumeFromHalt(): Promise<void> {
    if (!this.systemHalted) {
      throw new NotHaltedError();
    }

    this.systemHalted = false;

    // Re-evaluate any queued recipes
    this.evaluateWaitingRecipes();
  }

  // ─── Private methods ────────────────────────────────────────────────────────

  private validateRecipe(recipe: RecipeDefinition): string[] {
    const violations: string[] = [];

    if (!recipe.phases || recipe.phases.length === 0) {
      violations.push('Recipe must have at least 1 phase');
    }

    for (const phase of recipe.phases ?? []) {
      if (!this.knownEquipment.has(phase.equipmentId)) {
        violations.push(`Phase "${phase.name}": unknown equipment "${phase.equipmentId}"`);
      }
      if (phase.baseDuration <= 0) {
        violations.push(`Phase "${phase.name}": baseDuration must be > 0`);
      }
      for (const reagent of phase.requiredReagents) {
        if (reagent.quantity <= 0) {
          violations.push(`Phase "${phase.name}": reagent "${reagent.reagentId}" quantity must be > 0`);
        }
      }
    }

    return violations;
  }

  private tryStartNextPhase(execution: RecipeExecution): void {
    if (this.systemHalted) return;

    const phaseIndex = execution.currentPhaseIndex;
    const phase = execution.recipe.phases[phaseIndex];
    if (!phase) return;

    // Check recipe timeout
    const elapsed = Date.now() - execution.startTime;
    if (elapsed > execution.recipe.timeout) {
      this.recordTransition(execution, execution.state, 'aborted', 'Recipe timeout exceeded', []);
      execution.state = 'aborted';
      return;
    }

    // Check equipment availability
    const currentBooking = this.equipmentMap.get(phase.equipmentId);
    if (currentBooking !== null && currentBooking !== undefined) {
      // Equipment occupied — wait
      return;
    }

    // Attempt atomic reagent allocation
    const allocationRequest: AllocationRequest = {
      recipeId: execution.executionId,
      phaseId: phase.id,
      priority: execution.priority,
      deadline: execution.startTime + execution.recipe.timeout,
      requirements: phase.requiredReagents,
    };

    let result: AllocationResult;
    try {
      result = this.reagentManager.allocateReagents(allocationRequest);
    } catch {
      // Reagent manager error — pause transitions
      this.waitingForReagents.add(execution.executionId);
      return;
    }

    if (!result.success) {
      // Insufficient reagents — wait for inventory change
      this.waitingForReagents.add(execution.executionId);
      return;
    }

    // Book equipment
    this.bookEquipment(phase.equipmentId, execution.executionId, phase.id, phase.baseDuration);

    // Transition to active
    if (execution.state !== 'active') {
      this.recordTransition(execution, execution.state, 'active', `Starting phase ${phaseIndex}: ${phase.name}`, [phase.equipmentId]);
      execution.state = 'active';
    }

    this.waitingForReagents.delete(execution.executionId);

    // Delegate to phase engine (async, but we don't await — the callback handles completion)
    this.phaseEngine.startPhase(
      execution.executionId,
      phaseIndex,
      phase,
      phase.equipmentId,
    ).catch(() => {
      // Phase engine errors are handled via callbacks
    });
  }

  private onPhaseComplete(executionId: string, phaseIndex: number, result: PhaseResult): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const phase = execution.recipe.phases[phaseIndex];

    if (result.outcome === 'completed') {
      // Step 1: Confirm consumption (reserved -> consumed)
      try {
        this.reagentManager.confirmConsumption(executionId, phase.id);
      } catch {
        // Log but continue — consumption confirmation failure is not fatal
      }

      // Step 2: Release equipment
      this.releaseEquipment(phase.equipmentId, executionId);

      // Step 3: Check if recipe is complete
      if (phaseIndex === execution.recipe.phases.length - 1) {
        this.recordTransition(execution, execution.state, 'completed', 'All phases completed', []);
        execution.state = 'completed';
      } else {
        // Advance to next phase
        execution.currentPhaseIndex = phaseIndex + 1;
        this.tryStartNextPhase(execution);
      }
    } else {
      // Phase failed or aborted
      // Release reagents (reserved quantities returned)
      this.reagentManager.releaseReagents(executionId, phase.id);
      // Release equipment
      this.releaseEquipment(phase.equipmentId, executionId);

      if (execution.state !== 'aborted') {
        this.recordTransition(
          execution,
          execution.state,
          'aborted',
          `Phase ${phaseIndex} ${result.outcome}: ${result.failureReason ?? 'unknown'}`,
          [phase.equipmentId],
        );
        execution.state = 'aborted';
      }
    }

    // Equipment freed — evaluate waiting recipes
    this.evaluateWaitingRecipes();
  }

  private evaluateWaitingRecipes(): void {
    // Get all queued/waiting recipes sorted by priority
    const waiting = this.getActiveExecutions().filter(
      (e) => e.state === 'queued' || this.waitingForReagents.has(e.executionId),
    );

    for (const execution of waiting) {
      this.tryStartNextPhase(execution);
    }
  }

  private bookEquipment(equipmentId: string, recipeId: string, phaseId: string, estimatedDuration: number): void {
    const current = this.equipmentMap.get(equipmentId);

    // Double-booking check — invariant violation
    if (current !== null && current !== undefined) {
      if (current.recipeId !== recipeId) {
        // This should never happen — invariant violation
        this.emergencyHalt(`Equipment double-booking detected: ${equipmentId} booked by ${current.recipeId}, attempted by ${recipeId}`);
        return;
      }
    }

    this.equipmentMap.set(equipmentId, {
      recipeId,
      phaseId,
      until: Date.now() + estimatedDuration,
    });
  }

  private releaseEquipment(equipmentId: string, expectedRecipeId: string): void {
    const current = this.equipmentMap.get(equipmentId);
    if (current && current.recipeId === expectedRecipeId) {
      this.equipmentMap.set(equipmentId, null);
    }
  }

  private emergencyHalt(reason: string): void {
    this.systemHalted = true;

    // Pause all active recipes
    for (const execution of this.executions.values()) {
      if (execution.state === 'active') {
        this.phaseEngine.pausePhase(execution.executionId);
        this.recordTransition(execution, execution.state, 'halted', `Emergency halt: ${reason}`, []);
        execution.state = 'halted';
      } else if (execution.state === 'queued') {
        this.recordTransition(execution, execution.state, 'halted', `Emergency halt: ${reason}`, []);
        execution.state = 'halted';
      }
    }
  }

  private scheduleDecontamination(equipmentId: string): void {
    // Decontamination is modeled as a special booking that blocks the equipment.
    // In a full implementation, this would create a decontamination "recipe phase".
    // For now, we mark the equipment as booked with a decontamination marker.
    this.equipmentMap.set(equipmentId, {
      recipeId: '__decontamination__',
      phaseId: `decontamination-${equipmentId}-${Date.now()}`,
      until: Date.now() + 60_000, // placeholder duration
    });
  }

  private recordTransition(
    execution: RecipeExecution,
    from: RecipeExecutionState | string,
    to: RecipeExecutionState | string,
    cause: string,
    affectedEntities: string[],
  ): void {
    execution.stateLog.push({
      from,
      to,
      timestamp: Date.now(),
      cause,
      affectedEntities,
    });
  }
}
