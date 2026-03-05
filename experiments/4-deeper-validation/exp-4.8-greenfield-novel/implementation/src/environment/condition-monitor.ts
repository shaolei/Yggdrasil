/**
 * ConditionMonitor — Reads environmental sensors for equipment, calculates
 * duration adjustment factors, and raises edge-triggered alarms.
 *
 * Implemented from context package: environment/condition-monitor
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EnvironmentalConditions {
  equipmentId: string;
  temperature: number; // Celsius, floating-point
  pressure: number; // kPa, floating-point
  timestamp: number; // epoch ms
}

export interface EnvironmentalLimits {
  minTemperature: number;
  maxTemperature: number;
  minPressure: number;
  maxPressure: number;
}

export interface DurationAdjustment {
  factor: number; // multiplier, 0.5 to 3.0
  reason: string;
}

export interface AlarmEvent {
  equipmentId: string;
  type: 'temperature_high' | 'temperature_low' | 'pressure_high' | 'pressure_low';
  currentValue: number;
  limitValue: number;
  timestamp: number;
}

export type AlarmCallback = (alarm: AlarmEvent) => void;

export interface SensorAdapter {
  readTemperature(equipmentId: string): number;
  readPressure(equipmentId: string): number;
}

export interface ConditionMonitorOptions {
  sensorAdapter: SensorAdapter;
  pollInterval?: number; // ms, default 100
  historyWindow?: number; // ms, default 300000 (5 minutes)
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class UnknownEquipmentError extends Error {
  constructor(public readonly equipmentId: string) {
    super(`Unknown equipment: ${equipmentId}`);
    this.name = 'UnknownEquipmentError';
  }
}

export class SensorUnavailableError extends Error {
  constructor(
    public readonly equipmentId: string,
    public readonly lastSuccessfulRead: number,
  ) {
    super(`Sensor unavailable for equipment ${equipmentId}. Last successful read: ${lastSuccessfulRead}`);
    this.name = 'SensorUnavailableError';
  }
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface AlarmSubscription {
  limits: EnvironmentalLimits;
  callback: AlarmCallback;
  triggered: boolean;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class ConditionMonitor {
  private readonly sensorAdapter: SensorAdapter;
  private readonly pollInterval: number;
  private readonly historyWindow: number;

  private latestReadings: Map<string, EnvironmentalConditions> = new Map();
  private historyBuffer: Map<string, EnvironmentalConditions[]> = new Map();
  private sensorErrors: Map<string, { error: Error; timestamp: number }> = new Map();
  private alarmSubscriptions: Map<string, AlarmSubscription[]> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private registeredEquipment: Set<string> = new Set();

  constructor(options: ConditionMonitorOptions) {
    this.sensorAdapter = options.sensorAdapter;
    this.pollInterval = options.pollInterval ?? 100;
    this.historyWindow = options.historyWindow ?? 300_000; // 5 minutes

    // Start polling immediately upon construction
    this.pollTimer = setInterval(() => this.pollTick(), this.pollInterval);
  }

  /**
   * Returns the most recent sensor reading for the equipment.
   * Synchronous. Throws if equipment unknown or sensor unavailable.
   */
  getConditions(equipmentId: string): EnvironmentalConditions {
    if (!this.registeredEquipment.has(equipmentId)) {
      throw new UnknownEquipmentError(equipmentId);
    }

    const reading = this.latestReadings.get(equipmentId);
    const sensorError = this.sensorErrors.get(equipmentId);

    // If we have a reading, check if it's stale (older than 2x poll interval)
    if (reading) {
      const staleness = Date.now() - reading.timestamp;
      if (sensorError && staleness > this.pollInterval * 2) {
        throw new SensorUnavailableError(equipmentId, reading.timestamp);
      }
      return reading;
    }

    // No reading at all — sensor must have failed on first read
    throw new SensorUnavailableError(equipmentId, 0);
  }

  /**
   * Pure function. Calculates how environmental deviation affects reaction duration.
   * Factor is 1.0 at optimal (midpoint of limits), increases toward limits.
   * Capped at 3.0, floored at 0.5.
   */
  calculateDurationAdjustment(
    conditions: EnvironmentalConditions,
    limits: EnvironmentalLimits,
  ): DurationAdjustment {
    const tempMid = (limits.minTemperature + limits.maxTemperature) / 2;
    const tempRange = (limits.maxTemperature - limits.minTemperature) / 2;
    const tempDeviation = tempRange > 0
      ? Math.abs(conditions.temperature - tempMid) / tempRange
      : 0;

    const pressureMid = (limits.minPressure + limits.maxPressure) / 2;
    const pressureRange = (limits.maxPressure - limits.minPressure) / 2;
    const pressureDeviation = pressureRange > 0
      ? Math.abs(conditions.pressure - pressureMid) / pressureRange
      : 0;

    // Max-deviation approach: worse condition dominates
    const maxDeviation = Math.max(tempDeviation, pressureDeviation);
    const maxPenalty = 2.0;

    let factor = 1.0 + maxDeviation * maxPenalty;
    factor = Math.max(0.5, Math.min(3.0, factor)); // clamp [0.5, 3.0]

    const reason = this.buildReason(tempDeviation, pressureDeviation, factor);
    return { factor, reason };
  }

  /**
   * Registers an edge-triggered alarm callback. Returns an unsubscribe function.
   * Fires once when conditions cross from safe to unsafe. Resets when conditions
   * return to safe.
   */
  subscribeToAlarms(
    equipmentId: string,
    limits: EnvironmentalLimits,
    callback: AlarmCallback,
  ): () => void {
    if (!this.alarmSubscriptions.has(equipmentId)) {
      this.alarmSubscriptions.set(equipmentId, []);
    }

    const subscription: AlarmSubscription = {
      limits,
      callback,
      triggered: false,
    };

    this.alarmSubscriptions.get(equipmentId)!.push(subscription);

    // Return unsubscribe function
    return () => {
      const subs = this.alarmSubscriptions.get(equipmentId);
      if (subs) {
        const index = subs.indexOf(subscription);
        if (index !== -1) {
          subs.splice(index, 1);
        }
      }
    };
  }

  /**
   * Returns the rolling window of recent readings for the equipment, oldest first.
   */
  getHistory(equipmentId: string): EnvironmentalConditions[] {
    return this.historyBuffer.get(equipmentId) ?? [];
  }

  /**
   * Tells the monitor to start reading sensors for this equipment.
   * Idempotent.
   */
  registerEquipment(equipmentId: string): void {
    if (this.registeredEquipment.has(equipmentId)) {
      return; // idempotent
    }
    this.registeredEquipment.add(equipmentId);
    this.historyBuffer.set(equipmentId, []);
  }

  /**
   * Stops all polling, clears all subscriptions and history.
   */
  dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.latestReadings.clear();
    this.historyBuffer.clear();
    this.sensorErrors.clear();
    this.alarmSubscriptions.clear();
    this.registeredEquipment.clear();
  }

  // ─── Private methods ────────────────────────────────────────────────────────

  private pollTick(): void {
    for (const equipmentId of this.registeredEquipment) {
      try {
        const temp = this.sensorAdapter.readTemperature(equipmentId);
        const pressure = this.sensorAdapter.readPressure(equipmentId);
        const reading: EnvironmentalConditions = {
          equipmentId,
          temperature: temp,
          pressure,
          timestamp: Date.now(),
        };

        this.latestReadings.set(equipmentId, reading);
        this.historyBuffer.get(equipmentId)!.push(reading);
        this.trimHistory(equipmentId);
        this.checkAlarms(equipmentId, reading);

        // Clear any previous sensor error on successful read
        this.sensorErrors.delete(equipmentId);
      } catch (error) {
        // Sensor failed — keep last reading, log error
        this.sensorErrors.set(equipmentId, {
          error: error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now(),
        });
        // Do NOT update latestReadings — stale data is better than no data
      }
    }
  }

  private trimHistory(equipmentId: string): void {
    const buffer = this.historyBuffer.get(equipmentId);
    if (!buffer) return;

    const cutoff = Date.now() - this.historyWindow;
    // Remove entries older than historyWindow from the front
    while (buffer.length > 0 && buffer[0].timestamp < cutoff) {
      buffer.shift();
    }
  }

  private checkAlarms(equipmentId: string, reading: EnvironmentalConditions): void {
    const subscriptions = this.alarmSubscriptions.get(equipmentId);
    if (!subscriptions) return;

    for (const sub of subscriptions) {
      const isExceeding =
        reading.temperature > sub.limits.maxTemperature ||
        reading.temperature < sub.limits.minTemperature ||
        reading.pressure > sub.limits.maxPressure ||
        reading.pressure < sub.limits.minPressure;

      if (isExceeding && !sub.triggered) {
        sub.triggered = true;
        const alarm = this.buildAlarmEvent(reading, sub.limits);
        sub.callback(alarm); // synchronous call
      } else if (!isExceeding && sub.triggered) {
        sub.triggered = false; // reset edge detector
      }
    }
  }

  private buildAlarmEvent(
    reading: EnvironmentalConditions,
    limits: EnvironmentalLimits,
  ): AlarmEvent {
    // Determine which limit was exceeded (pick the first matching)
    let type: AlarmEvent['type'];
    let currentValue: number;
    let limitValue: number;

    if (reading.temperature > limits.maxTemperature) {
      type = 'temperature_high';
      currentValue = reading.temperature;
      limitValue = limits.maxTemperature;
    } else if (reading.temperature < limits.minTemperature) {
      type = 'temperature_low';
      currentValue = reading.temperature;
      limitValue = limits.minTemperature;
    } else if (reading.pressure > limits.maxPressure) {
      type = 'pressure_high';
      currentValue = reading.pressure;
      limitValue = limits.maxPressure;
    } else {
      // Must be pressure_low since isExceeding was true
      type = 'pressure_low';
      currentValue = reading.pressure;
      limitValue = limits.minPressure;
    }

    return {
      equipmentId: reading.equipmentId,
      type,
      currentValue,
      limitValue,
      timestamp: reading.timestamp,
    };
  }

  private buildReason(
    tempDeviation: number,
    pressureDeviation: number,
    factor: number,
  ): string {
    const dominant = tempDeviation >= pressureDeviation ? 'temperature' : 'pressure';
    const dominantPct = Math.round(Math.max(tempDeviation, pressureDeviation) * 100);

    if (factor === 1.0) {
      return 'Conditions at optimal; no duration adjustment needed.';
    }

    return `Duration factor ${factor.toFixed(2)}x due to ${dominant} deviation (${dominantPct}% from optimal).`;
  }
}
