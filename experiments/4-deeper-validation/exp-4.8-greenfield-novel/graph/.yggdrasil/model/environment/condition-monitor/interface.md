# Condition Monitor Interface

## Types

```typescript
interface EnvironmentalConditions {
  equipmentId: string;
  temperature: number; // Celsius, floating-point
  pressure: number; // kPa, floating-point
  timestamp: number; // epoch ms
}

interface EnvironmentalLimits {
  minTemperature: number;
  maxTemperature: number;
  minPressure: number;
  maxPressure: number;
}

interface DurationAdjustment {
  factor: number; // multiplier, 0.5 to 3.0
  reason: string; // human-readable explanation of why the factor is what it is
}

interface AlarmEvent {
  equipmentId: string;
  type: 'temperature_high' | 'temperature_low' | 'pressure_high' | 'pressure_low';
  currentValue: number;
  limitValue: number;
  timestamp: number;
}

type AlarmCallback = (alarm: AlarmEvent) => void;

interface SensorAdapter {
  readTemperature(equipmentId: string): number;
  readPressure(equipmentId: string): number;
}

interface ConditionMonitorOptions {
  sensorAdapter: SensorAdapter;
  pollInterval?: number; // ms, default 100
  historyWindow?: number; // ms, default 300000 (5 minutes)
}
```

## Methods

- `constructor(options: ConditionMonitorOptions)`
  - Accepts sensor adapter (required), poll interval (default 100ms), history window (default 5min).
  - Starts polling sensors immediately upon construction.

- `getConditions(equipmentId: string): EnvironmentalConditions`
  - Synchronous. Returns the most recent sensor reading for the equipment.
  - Throws `UnknownEquipmentError` if equipmentId has never been read.
  - Throws `SensorUnavailableError` if the last read from the sensor adapter failed (with timestamp of last successful read).

- `calculateDurationAdjustment(conditions: EnvironmentalConditions, limits: EnvironmentalLimits): DurationAdjustment`
  - Pure function. Calculates how environmental deviation affects reaction duration.
  - Factor is 1.0 at optimal conditions (midpoint of limits range).
  - Factor increases (reaction slower) as conditions deviate from optimal toward limits.
  - Factor capped at 3.0 (reaction 3x slower) and floored at 0.5 (reaction 2x faster).
  - Formula: `factor = 1.0 + (deviation / halfRange) * maxPenalty` where deviation = distance from midpoint, halfRange = (max - min) / 2, maxPenalty = 2.0 (so at the limit, factor = 3.0).
  - For conditions beyond limits (unsafe zone), factor is clamped at 3.0 — the phase engine handles the safety response, not the duration calculation.

- `subscribeToAlarms(equipmentId: string, limits: EnvironmentalLimits, callback: AlarmCallback): () => void`
  - Registers an alarm callback. Returns an unsubscribe function.
  - Alarm is edge-triggered: fires once when conditions cross the limit threshold (from safe to unsafe). Does not re-fire while conditions remain outside limits. Fires again if conditions return to safe and then exceed again.
  - Multiple subscriptions for the same equipment with different limits are supported.

- `getHistory(equipmentId: string): EnvironmentalConditions[]`
  - Returns the rolling window of recent readings for the equipment, oldest first.
  - Returns empty array if no readings exist.

- `registerEquipment(equipmentId: string): void`
  - Tells the monitor to start reading sensors for this equipment.
  - Idempotent — no-op if already registered.

- `dispose(): void`
  - Stops all polling, clears all subscriptions and history. Call on shutdown.

## Failure Modes

- **UnknownEquipmentError**: equipmentId not registered. Contains `{ equipmentId: string }`.
- **SensorUnavailableError**: Sensor adapter threw during read. Contains `{ equipmentId: string, lastSuccessfulRead: number }`. The condition monitor continues polling; it does not give up after a failed read. Stale data from last successful read remains available but is marked with its timestamp.
- **Sensor adapter errors**: If the sensor adapter throws, the error is caught and logged. The previous reading remains in cache with its original timestamp. `getConditions()` still returns the stale reading but `SensorUnavailableError` is thrown if the reading is older than 2x the poll interval.
