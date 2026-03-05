# Condition Monitor Internals

## Logic

### Polling Loop

The condition monitor runs a setInterval at `pollInterval` (default 100ms). Each tick:

```
pollTick():
  for each registered equipment:
    try:
      temp = sensorAdapter.readTemperature(equipmentId)
      pressure = sensorAdapter.readPressure(equipmentId)
      reading = { equipmentId, temperature: temp, pressure, timestamp: Date.now() }
      latestReadings.set(equipmentId, reading)
      historyBuffer.get(equipmentId).push(reading)
      trimHistory(equipmentId) // remove entries older than historyWindow
      checkAlarms(equipmentId, reading)
    catch (error):
      // Sensor failed — keep last reading, log error
      sensorErrors.set(equipmentId, { error, timestamp: Date.now() })
      // Do NOT update latestReadings — stale data is better than no data
```

### Alarm Edge Detection

Each alarm subscription has a state: `{ triggered: boolean }`.

```
checkAlarms(equipmentId, reading):
  for each subscription on this equipment:
    isExceeding = reading.temperature > limits.maxTemperature
                || reading.temperature < limits.minTemperature
                || reading.pressure > limits.maxPressure
                || reading.pressure < limits.minPressure

    if isExceeding && !subscription.triggered:
      subscription.triggered = true
      // Determine which limit was exceeded
      alarm = buildAlarmEvent(reading, limits)
      subscription.callback(alarm) // synchronous call
    else if !isExceeding && subscription.triggered:
      subscription.triggered = false  // reset edge detector
```

Edge-triggered design avoids flooding the phase-engine with repeated alarms while conditions remain outside limits. The phase-engine's own tick loop handles continuous monitoring during the grace period.

### Duration Adjustment Formula

```
calculateDurationAdjustment(conditions, limits):
  tempMid = (limits.minTemperature + limits.maxTemperature) / 2
  tempRange = (limits.maxTemperature - limits.minTemperature) / 2
  tempDeviation = abs(conditions.temperature - tempMid) / tempRange

  pressureMid = (limits.minPressure + limits.maxPressure) / 2
  pressureRange = (limits.maxPressure - limits.minPressure) / 2
  pressureDeviation = abs(conditions.pressure - pressureMid) / pressureRange

  // Use the larger deviation (worst case)
  maxDeviation = max(tempDeviation, pressureDeviation)
  maxPenalty = 2.0  // at the limit boundary, factor = 1.0 + 2.0 = 3.0

  factor = 1.0 + (maxDeviation * maxPenalty)
  factor = clamp(factor, 0.5, 3.0)

  reason = buildReason(tempDeviation, pressureDeviation, factor)
  return { factor, reason }
```

The formula uses the max-deviation approach (worst of temperature or pressure) rather than additive. This means if temperature is perfect but pressure is at the limit, the factor is 3.0 — the worse condition dominates. This models real chemistry where a single out-of-spec parameter can dramatically affect reaction kinetics.

## State

- `latestReadings: Map<string, EnvironmentalConditions>` — most recent per-equipment
- `historyBuffer: Map<string, EnvironmentalConditions[]>` — rolling window per-equipment
- `sensorErrors: Map<string, { error: Error, timestamp: number }>` — last error per-equipment
- `alarmSubscriptions: Map<string, Array<{ limits, callback, triggered }>>` — per-equipment
- `pollTimer: NodeJS.Timeout` — the polling interval
- `sensorAdapter: SensorAdapter` — injected dependency

## Decisions

- **Chose polling over event-driven sensor reads** because real sensors typically expose synchronous read APIs, not event streams. Polling with a configurable interval maps naturally to hardware capabilities. Rejected: event-driven with sensor push — requires hardware support that may not exist.

- **Chose edge-triggered alarms over level-triggered** because level-triggered alarms would fire every 100ms while conditions remain bad, flooding the phase-engine. Edge-triggered fires once per transition, which is all the phase-engine needs (it has its own grace period timer). Rejected: level-triggered with debounce — adds complexity without benefit since the phase-engine handles the sustained-alarm case.

- **Chose max-deviation over additive deviation for duration factor** because in chemical reactions, a single parameter far out of spec is more impactful than two parameters slightly off. Additive would underweight a single critical deviation. Rejected: additive — would allow compensating effects (e.g., high temp + low pressure averaging out) that don't exist in real chemistry. Rejected: multiplicative — would create unreasonably large factors (3.0 * 3.0 = 9.0).
