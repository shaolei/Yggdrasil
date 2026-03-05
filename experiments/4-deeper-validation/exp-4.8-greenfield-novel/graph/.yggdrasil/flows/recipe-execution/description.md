# Recipe Execution Flow

## Business context

A laboratory or chemical plant needs to run multiple chemical recipes concurrently. Each recipe is a sequence of timed phases that transform reagents using shared equipment under controlled environmental conditions. The system ensures safe concurrent execution, prevents resource conflicts, and handles cascading failures when reactions go wrong.

## Trigger

An operator submits a recipe for execution, specifying the recipe definition, desired start time (or "immediate"), and priority.

## Goal

Execute all phases of the recipe in sequence, allocating reagents and equipment for each phase, monitoring environmental conditions, and completing the recipe with a final product — or aborting safely if any phase fails.

## Participants

- `orchestrator/scheduler` — accepts recipe submissions, determines execution order across concurrent recipes, assigns equipment, manages the lifecycle of recipe executions from submission to completion/abort
- `orchestrator/phase-engine` — executes individual phases: manages phase timing (with environmental adjustments), monitors phase completion criteria, detects phase failures, triggers contamination events
- `inventory/reagent-manager` — manages shared reagent inventory: atomic allocation, reservation tracking, consumption confirmation, return on failure
- `environment/condition-monitor` — reads environmental sensors (temperature, pressure, humidity), calculates duration adjustments for phases based on deviation from optimal conditions, raises alarms when conditions exceed safe ranges

## Paths

### Happy path

1. Operator submits recipe with priority and desired start time
2. Scheduler validates recipe definition (phases, reagents, equipment requirements)
3. Scheduler queues recipe and determines execution slot based on equipment availability and priority
4. For each phase in sequence:
   a. Scheduler requests reagent allocation from reagent-manager (atomic, all-or-nothing)
   b. Scheduler reserves equipment for the phase duration
   c. Phase-engine begins phase execution with target duration and completion criteria
   d. Condition-monitor provides environmental readings; phase-engine adjusts remaining duration
   e. Phase completes: completion criteria met within adjusted duration
   f. Reagent-manager confirms consumption (reserved quantities become consumed)
   g. Equipment released
5. All phases complete; recipe marked as `completed` with final product record

### Reagent unavailable

Reagent-manager cannot fulfill atomic allocation (insufficient quantity). Phase enters `waiting_for_reagents`. Scheduler re-evaluates when inventory changes (new stock or another recipe releases reagents). If wait exceeds recipe timeout, recipe is aborted.

### Environmental exceedance

Condition-monitor detects temperature or pressure outside safe range for the current phase. Phase-engine pauses the phase timer. If conditions return to safe range within grace period (configurable per phase), phase resumes. If grace period exceeded, phase fails and contamination check begins.

### Phase failure with contamination

A phase fails (timeout, environmental exceedance, or operator abort). Phase-engine raises contamination event for the equipment used. Scheduler receives contamination event and:
1. Identifies all recipes using the contaminated equipment
2. Notifies affected recipes synchronously
3. Affected recipes either abort or enter holding state
4. Decontamination phase is scheduled on the equipment
5. After decontamination, equipment is available for new phases

### Cascade failure

Contamination from one recipe causes another recipe to abort, which itself contaminates its equipment. Cascade depth tracked. At depth 5, system enters emergency halt: all recipes paused, operator intervention required.

## Invariants across all paths

- Phases within a recipe always execute in definition order (temporal monotonicity)
- Reagent allocations are always atomic (all-or-nothing)
- Contamination notification is synchronous (same tick)
- Equipment is never double-booked (one phase per equipment at a time)
- All state transitions are recorded with timestamps and causal chains
- Recipe execution is deterministic given the same inputs, environmental readings, and timing
