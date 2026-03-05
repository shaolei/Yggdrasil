# Condition Monitor Responsibility

Reads environmental sensors (temperature, pressure) for equipment, calculates duration adjustment factors based on deviation from optimal conditions, and raises alarms when conditions exceed safe ranges. Acts as the environmental data layer for the system.

**In scope:**

- **getConditions(equipmentId)**: Return current environmental conditions (temperature, pressure) for a piece of equipment
- **calculateDurationAdjustment(conditions, limits)**: Given current conditions and a phase's environmental limits, calculate a duration adjustment factor. Factor represents how much slower/faster the reaction proceeds under current conditions.
- **subscribeToAlarms(equipmentId, limits, callback)**: Register an alarm callback that fires when conditions on an equipment exceed the given limits. Alarm fires once per exceedance transition (edge-triggered, not level-triggered).
- **Sensor simulation**: In the absence of real hardware, provide a configurable sensor simulation layer that generates realistic environmental readings with optional noise and drift patterns.
- **Condition history**: Maintain a rolling window (configurable, default 5 minutes) of condition readings per equipment for trend analysis.

**Out of scope:**

- Phase timing decisions (orchestrator/phase-engine) — condition monitor provides data, not decisions
- Equipment booking or contamination handling (orchestrator/scheduler)
- Hardware sensor communication protocols (abstracted behind a sensor adapter interface)
