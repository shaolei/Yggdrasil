# Recipe Scheduler Interface

## Types

```typescript
interface RecipeDefinition {
  id: string;
  name: string;
  phases: PhaseDefinition[];
  timeout: number; // ms, max total execution time
}

interface PhaseDefinition {
  id: string;
  name: string;
  equipmentId: string;
  requiredReagents: ReagentRequirement[];
  baseDuration: number; // ms
  completionCriteria: CompletionCriteria;
  environmentalLimits: EnvironmentalLimits;
  gracePeriod: number; // ms, time to wait for conditions to return to safe range
}

interface ReagentRequirement {
  reagentId: string;
  quantity: number; // micrograms (integer)
}

interface CompletionCriteria {
  type: 'duration' | 'condition' | 'both';
  targetTemperature?: number; // Celsius
  targetPressure?: number; // kPa
  tolerance?: number; // percentage
}

interface EnvironmentalLimits {
  minTemperature: number;
  maxTemperature: number;
  minPressure: number;
  maxPressure: number;
}

type RecipeExecutionState = 'submitted' | 'queued' | 'active' | 'completed' | 'aborted' | 'halted';

interface RecipeExecution {
  executionId: string;
  recipe: RecipeDefinition;
  priority: number; // lower = higher priority
  state: RecipeExecutionState;
  currentPhaseIndex: number;
  startTime: number; // epoch ms
  stateLog: StateTransition[];
}

interface StateTransition {
  from: RecipeExecutionState | string;
  to: RecipeExecutionState | string;
  timestamp: number;
  cause: string;
  affectedEntities: string[];
}

interface ContaminationEvent {
  sourceRecipeId: string;
  sourcePhaseId: string;
  equipmentId: string;
  timestamp: number;
  cascadeDepth: number;
}
```

## Methods

- `submitRecipe(recipe: RecipeDefinition, priority: number, startTime?: number): Promise<RecipeExecution>`
  - Parameters: `recipe` (validated recipe definition), `priority` (integer, lower = higher), `startTime` (epoch ms, optional; if omitted, immediate)
  - Returns: RecipeExecution with state `submitted`, assigned executionId (UUIDv4)
  - Validates recipe: at least 1 phase, all phase equipment IDs reference known equipment, all reagent quantities > 0, baseDuration > 0
  - Throws `InvalidRecipeError` if validation fails (with list of violations)
  - Throws `SystemHaltedError` if system is in emergency halt state

- `cancelRecipe(executionId: string): Promise<void>`
  - Parameters: `executionId`
  - Cancels a recipe: if queued, removes from queue. If active, aborts current phase and releases all resources.
  - Throws `RecipeNotFoundError` if executionId unknown
  - Throws `RecipeAlreadyTerminalError` if recipe is completed/aborted/halted

- `getExecution(executionId: string): RecipeExecution | undefined`
  - Returns current execution state, or undefined if not found

- `getActiveExecutions(): RecipeExecution[]`
  - Returns all executions in non-terminal states (submitted, queued, active), sorted by priority then submission time

- `handleContamination(event: ContaminationEvent): void`
  - Synchronous. Identifies all active recipes using event.equipmentId. For each: emits abort or hold. Increments cascadeDepth. If cascadeDepth > 5, triggers emergency halt.
  - This method is synchronous (not async) because contamination notification must complete within the same tick. This is a deliberate design choice per contamination-propagation aspect.

- `resumeFromHalt(): Promise<void>`
  - Operator action to resume after emergency halt. Resets cascade depth. All halted recipes remain halted; operator must individually re-submit or cancel them.
  - Throws `NotHaltedError` if system is not in halt state

## Failure Modes

- **InvalidRecipeError**: Recipe definition fails validation. Contains `violations: string[]` listing each problem.
- **SystemHaltedError**: System is in emergency halt. No new recipes accepted until `resumeFromHalt()`.
- **RecipeNotFoundError**: executionId does not match any known execution.
- **RecipeAlreadyTerminalError**: Attempted operation on completed/aborted/halted recipe.
- **Equipment double-booking**: Should never occur (invariant violation). If detected, triggers emergency halt and logs critical error. This indicates a bug in the scheduler, not a recoverable state.
