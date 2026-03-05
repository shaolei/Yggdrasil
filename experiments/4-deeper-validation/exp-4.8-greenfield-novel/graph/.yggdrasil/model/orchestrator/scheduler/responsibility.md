# Recipe Scheduler Responsibility

Central coordinator for recipe execution lifecycle. Accepts recipe submissions, manages the execution queue, orchestrates phase transitions, handles equipment booking, and coordinates failure responses including contamination cascades.

**In scope:**

- **submitRecipe(recipe, priority, startTime)**: Validate recipe definition, enqueue for execution, return execution ID
- **Equipment booking**: Maintain equipment availability map; reserve equipment for phase duration; release on phase completion or abort; enforce single-occupancy (one phase per equipment at a time)
- **Phase transition orchestration**: After each phase completes, trigger reagent allocation for next phase, reserve equipment, then delegate to phase-engine
- **Contamination handling**: Receive contamination events from phase-engine, identify all affected recipes by equipment, notify synchronously, schedule decontamination phases, track cascade depth
- **Emergency halt**: When cascade depth exceeds 5, pause all recipes, mark system as halted, require operator intervention to resume
- **Recipe lifecycle states**: submitted -> queued -> active -> completed | aborted | halted
- **Execution log**: Record every state transition with timestamp, causal chain (which event triggered it), and affected entities

**Out of scope:**

- Phase execution timing and monitoring (orchestrator/phase-engine)
- Reagent inventory tracking and atomic allocation (inventory/reagent-manager)
- Environmental sensor reading and condition evaluation (environment/condition-monitor)
- Recipe definition authoring or validation of chemical correctness (external concern)
