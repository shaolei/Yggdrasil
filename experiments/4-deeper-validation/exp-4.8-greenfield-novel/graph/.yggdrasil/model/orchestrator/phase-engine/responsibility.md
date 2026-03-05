# Phase Engine Responsibility

Executes individual recipe phases. Manages phase timing with environmental adjustments, monitors completion criteria, detects failures, and raises contamination events when phases fail on shared equipment.

**In scope:**

- **startPhase(execution, phaseIndex)**: Begin executing a specific phase — start phase timer, subscribe to environmental alarms for the phase's equipment, monitor completion criteria
- **Phase timing**: Track elapsed time vs adjusted duration. Environmental conditions modify the effective duration (e.g., lower temperature extends reaction time). Timer precision: 100ms tick interval.
- **Completion monitoring**: Check completion criteria each tick. Criteria types: duration-only (timer expires), condition-only (target temp/pressure reached), or both (timer expires AND conditions met).
- **Failure detection**: Phase fails when: adjusted duration exceeded without meeting criteria, environmental conditions exceed safe limits beyond grace period, or explicit abort from scheduler.
- **Contamination event raising**: When a phase fails, create ContaminationEvent with source recipe, source phase, equipment ID, timestamp, and cascade depth 0 (first event in chain). Emit synchronously to scheduler.
- **Phase pause/resume**: Pause timer on environmental exceedance or explicit pause; resume when conditions return or explicit resume.

**Out of scope:**

- Recipe lifecycle management (orchestrator/scheduler)
- Reagent allocation (inventory/reagent-manager)
- Sensor reading and condition calculation (environment/condition-monitor)
- Equipment booking (orchestrator/scheduler)
