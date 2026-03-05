/**
 * ReagentManager — Manages shared reagent inventory with atomic allocation,
 * reservation tracking, consumption confirmation, and audit trail.
 *
 * Implemented from context package: inventory/reagent-manager
 */

import { randomUUID } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReagentRequirement {
  reagentId: string;
  quantity: number; // micrograms, positive integer
}

export interface AllocationResult {
  success: boolean;
  allocatedReagents?: ReagentAllocation[];
  failedReagents?: FailedAllocation[];
}

export interface ReagentAllocation {
  reagentId: string;
  quantity: number; // micrograms
  reservationId: string;
}

export interface FailedAllocation {
  reagentId: string;
  requested: number; // micrograms
  available: number; // micrograms
}

export interface ReagentInventory {
  reagentId: string;
  name: string;
  total: number; // micrograms
  reserved: number; // micrograms
  consumed: number; // micrograms
  get available(): number; // micrograms = total - reserved - consumed
}

export interface AllocationRequest {
  recipeId: string;
  phaseId: string;
  priority: number; // lower = higher priority
  deadline: number; // epoch ms, phase deadline
  requirements: ReagentRequirement[];
}

export interface InventoryEvent {
  type: 'released' | 'restocked' | 'consumed';
  reagentIds: string[];
  timestamp: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class InvalidQuantityError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: number,
  ) {
    super(`Invalid quantity for ${field}: ${value}. Must be a positive integer.`);
    this.name = 'InvalidQuantityError';
  }
}

export class UnknownReagentError extends Error {
  constructor(public readonly reagentId: string) {
    super(`Unknown reagent: ${reagentId}`);
    this.name = 'UnknownReagentError';
  }
}

export class DuplicateReagentError extends Error {
  constructor(public readonly reagentId: string) {
    super(`Reagent already exists: ${reagentId}`);
    this.name = 'DuplicateReagentError';
  }
}

export class NoReservationError extends Error {
  constructor(
    public readonly recipeId: string,
    public readonly phaseId: string,
  ) {
    super(`No active reservation for recipe ${recipeId}, phase ${phaseId}`);
    this.name = 'NoReservationError';
  }
}

export class InventoryCorruptionError extends Error {
  constructor(message: string) {
    super(`Inventory invariant violation: ${message}`);
    this.name = 'InventoryCorruptionError';
  }
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface ReagentRecord {
  reagentId: string;
  name: string;
  total: number;
  reserved: number;
  consumed: number;
}

interface AuditEntry {
  operation: 'allocate' | 'release' | 'consume' | 'restock' | 'add';
  recipeId?: string;
  phaseId?: string;
  reagentId?: string;
  quantities: Record<string, number>;
  timestamp: number;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class ReagentManager {
  private reagents: Map<string, ReagentRecord> = new Map();
  private activeReservations: Map<string, ReagentAllocation[]> = new Map();
  private auditLog: AuditEntry[] = [];
  private changeCallbacks: Array<(event: InventoryEvent) => void> = [];

  /**
   * Atomic all-or-nothing allocation. Synchronous.
   * Phase 1: validate and check availability for all reagents.
   * Phase 2: if all available, allocate atomically.
   * No lock needed — synchronous in single-threaded Node.js.
   */
  allocateReagents(request: AllocationRequest): AllocationResult {
    const failedList: FailedAllocation[] = [];

    // Phase 1: Check availability for all reagents
    for (const requirement of request.requirements) {
      // Validate quantity
      if (requirement.quantity <= 0 || !Number.isInteger(requirement.quantity)) {
        throw new InvalidQuantityError('quantity', requirement.quantity);
      }

      const reagent = this.reagents.get(requirement.reagentId);
      if (!reagent) {
        throw new UnknownReagentError(requirement.reagentId);
      }

      const available = this.computeAvailable(reagent);
      if (available < requirement.quantity) {
        failedList.push({
          reagentId: requirement.reagentId,
          requested: requirement.quantity,
          available,
        });
      }
    }

    if (failedList.length > 0) {
      return { success: false, failedReagents: failedList };
    }

    // Phase 2: All checks passed — allocate atomically
    const reservations: ReagentAllocation[] = [];

    for (const requirement of request.requirements) {
      const reagent = this.reagents.get(requirement.reagentId)!;
      reagent.reserved += requirement.quantity;

      // Invariant check: available must not go negative
      const available = this.computeAvailable(reagent);
      if (available < 0) {
        throw new InventoryCorruptionError(
          `Available went negative for reagent ${reagent.reagentId}: ${available}`,
        );
      }

      reservations.push({
        reagentId: requirement.reagentId,
        quantity: requirement.quantity,
        reservationId: randomUUID(),
      });
    }

    // Phase 3: Record reservation
    const key = this.reservationKey(request.recipeId, request.phaseId);
    this.activeReservations.set(key, reservations);

    // Audit
    this.auditLog.push({
      operation: 'allocate',
      recipeId: request.recipeId,
      phaseId: request.phaseId,
      quantities: Object.fromEntries(
        request.requirements.map((r) => [r.reagentId, r.quantity]),
      ),
      timestamp: Date.now(),
    });

    return { success: true, allocatedReagents: reservations };
  }

  /**
   * Returns all reserved (not consumed) reagents for the given recipe+phase.
   * Idempotent — no-op if no reservations exist.
   */
  releaseReagents(recipeId: string, phaseId: string): void {
    const key = this.reservationKey(recipeId, phaseId);
    const reservations = this.activeReservations.get(key);

    if (!reservations) {
      return; // idempotent
    }

    const affectedReagentIds: string[] = [];

    for (const reservation of reservations) {
      const reagent = this.reagents.get(reservation.reagentId);
      if (reagent) {
        reagent.reserved -= reservation.quantity;
        affectedReagentIds.push(reservation.reagentId);
      }
    }

    this.activeReservations.delete(key);

    // Audit
    this.auditLog.push({
      operation: 'release',
      recipeId,
      phaseId,
      quantities: Object.fromEntries(
        reservations.map((r) => [r.reagentId, r.quantity]),
      ),
      timestamp: Date.now(),
    });

    // Emit inventory change event
    if (affectedReagentIds.length > 0) {
      this.emitChange({
        type: 'released',
        reagentIds: affectedReagentIds,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Converts reserved quantities to consumed. Quantities permanently deducted.
   * Throws NoReservationError if no active reservations for this recipe+phase.
   */
  confirmConsumption(recipeId: string, phaseId: string): void {
    const key = this.reservationKey(recipeId, phaseId);
    const reservations = this.activeReservations.get(key);

    if (!reservations) {
      throw new NoReservationError(recipeId, phaseId);
    }

    const affectedReagentIds: string[] = [];

    for (const reservation of reservations) {
      const reagent = this.reagents.get(reservation.reagentId);
      if (reagent) {
        // Move from reserved to consumed (no change to available)
        reagent.reserved -= reservation.quantity;
        reagent.consumed += reservation.quantity;
        affectedReagentIds.push(reservation.reagentId);
      }
    }

    this.activeReservations.delete(key);

    // Audit
    this.auditLog.push({
      operation: 'consume',
      recipeId,
      phaseId,
      quantities: Object.fromEntries(
        reservations.map((r) => [r.reagentId, r.quantity]),
      ),
      timestamp: Date.now(),
    });

    // Emit inventory change event
    if (affectedReagentIds.length > 0) {
      this.emitChange({
        type: 'consumed',
        reagentIds: affectedReagentIds,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Adds quantity to an existing reagent's total and available.
   */
  restock(reagentId: string, quantity: number): void {
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new InvalidQuantityError('quantity', quantity);
    }

    const reagent = this.reagents.get(reagentId);
    if (!reagent) {
      throw new UnknownReagentError(reagentId);
    }

    reagent.total += quantity;

    // Audit
    this.auditLog.push({
      operation: 'restock',
      reagentId,
      quantities: { [reagentId]: quantity },
      timestamp: Date.now(),
    });

    // Emit inventory change event
    this.emitChange({
      type: 'restocked',
      reagentIds: [reagentId],
      timestamp: Date.now(),
    });
  }

  /**
   * Registers a new reagent in inventory.
   */
  addReagent(reagentId: string, name: string, initialQuantity: number): void {
    if (this.reagents.has(reagentId)) {
      throw new DuplicateReagentError(reagentId);
    }

    if (initialQuantity < 0 || !Number.isInteger(initialQuantity)) {
      throw new InvalidQuantityError('initialQuantity', initialQuantity);
    }

    this.reagents.set(reagentId, {
      reagentId,
      name,
      total: initialQuantity,
      reserved: 0,
      consumed: 0,
    });

    // Audit
    this.auditLog.push({
      operation: 'add',
      reagentId,
      quantities: { [reagentId]: initialQuantity },
      timestamp: Date.now(),
    });
  }

  /**
   * Returns current inventory state for a reagent, or undefined if not found.
   */
  getInventory(reagentId: string): ReagentInventory | undefined {
    const reagent = this.reagents.get(reagentId);
    if (!reagent) return undefined;

    return {
      reagentId: reagent.reagentId,
      name: reagent.name,
      total: reagent.total,
      reserved: reagent.reserved,
      consumed: reagent.consumed,
      // Computed, not stored — prevents drift (per internals decision)
      get available() {
        return reagent.total - reagent.reserved - reagent.consumed;
      },
    };
  }

  /**
   * Returns inventory state for all reagents.
   */
  getAllInventory(): ReagentInventory[] {
    const result: ReagentInventory[] = [];
    for (const reagent of this.reagents.values()) {
      result.push({
        reagentId: reagent.reagentId,
        name: reagent.name,
        total: reagent.total,
        reserved: reagent.reserved,
        consumed: reagent.consumed,
        get available() {
          return reagent.total - reagent.reserved - reagent.consumed;
        },
      });
    }
    return result;
  }

  /**
   * Registers a callback for inventory change events.
   */
  onInventoryChange(callback: (event: InventoryEvent) => void): void {
    this.changeCallbacks.push(callback);
  }

  // ─── Private methods ────────────────────────────────────────────────────────

  private computeAvailable(reagent: ReagentRecord): number {
    return reagent.total - reagent.reserved - reagent.consumed;
  }

  private reservationKey(recipeId: string, phaseId: string): string {
    return `${recipeId}:${phaseId}`;
  }

  private emitChange(event: InventoryEvent): void {
    for (const callback of this.changeCallbacks) {
      callback(event);
    }
  }
}
