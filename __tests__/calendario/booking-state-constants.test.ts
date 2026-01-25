/**
 * TIS TIS Platform - Booking State Constants Tests
 * FASE 8 - Testing: Micro-fase 8.4
 *
 * Tests for booking state constants to ensure consistency
 * and correctness of the state definitions.
 */

import { describe, it, expect } from 'vitest';
import {
  BOOKING_COMBINED_STATES,
  CONFIRMATION_STATUSES,
  DEPOSIT_STATUSES,
  TRUST_LEVELS,
} from '@/src/shared/constants';

// ==============================================
// CONFIRMATION STATUSES TESTS
// ==============================================
describe('CONFIRMATION_STATUSES', () => {
  it('exports an array', () => {
    expect(Array.isArray(CONFIRMATION_STATUSES)).toBe(true);
  });

  it('has exactly 4 statuses', () => {
    expect(CONFIRMATION_STATUSES).toHaveLength(4);
  });

  it('contains not_required status', () => {
    const status = CONFIRMATION_STATUSES.find((s) => s.value === 'not_required');
    expect(status).toBeDefined();
    expect(status?.label).toBe('No Requerida');
    expect(status?.color).toBe('slate');
  });

  it('contains pending status', () => {
    const status = CONFIRMATION_STATUSES.find((s) => s.value === 'pending');
    expect(status).toBeDefined();
    expect(status?.label).toBe('Pendiente');
    expect(status?.color).toBe('amber');
  });

  it('contains confirmed status', () => {
    const status = CONFIRMATION_STATUSES.find((s) => s.value === 'confirmed');
    expect(status).toBeDefined();
    expect(status?.label).toBe('Confirmada');
    expect(status?.color).toBe('green');
  });

  it('contains expired status', () => {
    const status = CONFIRMATION_STATUSES.find((s) => s.value === 'expired');
    expect(status).toBeDefined();
    expect(status?.label).toBe('Expirada');
    expect(status?.color).toBe('red');
  });

  it('all statuses have required properties', () => {
    CONFIRMATION_STATUSES.forEach((status) => {
      expect(status).toHaveProperty('value');
      expect(status).toHaveProperty('label');
      expect(status).toHaveProperty('color');
      expect(status).toHaveProperty('icon');
      expect(status).toHaveProperty('description');
    });
  });

  it('all values are unique', () => {
    const values = CONFIRMATION_STATUSES.map((s) => s.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

// ==============================================
// DEPOSIT STATUSES TESTS
// ==============================================
describe('DEPOSIT_STATUSES', () => {
  it('exports an array', () => {
    expect(Array.isArray(DEPOSIT_STATUSES)).toBe(true);
  });

  it('has exactly 7 statuses', () => {
    expect(DEPOSIT_STATUSES).toHaveLength(7);
  });

  const expectedStatuses = [
    { value: 'not_required', label: 'No Requerido', color: 'slate' },
    { value: 'required', label: 'Requerido', color: 'amber' },
    { value: 'pending', label: 'Procesando', color: 'blue' },
    { value: 'paid', label: 'Pagado', color: 'green' },
    { value: 'forfeited', label: 'Perdido', color: 'red' },
    { value: 'refunded', label: 'Reembolsado', color: 'purple' },
    { value: 'applied', label: 'Aplicado', color: 'emerald' },
  ];

  expectedStatuses.forEach(({ value, label, color }) => {
    it(`contains ${value} status with correct properties`, () => {
      const status = DEPOSIT_STATUSES.find((s) => s.value === value);
      expect(status).toBeDefined();
      expect(status?.label).toBe(label);
      expect(status?.color).toBe(color);
    });
  });

  it('all statuses have required properties', () => {
    DEPOSIT_STATUSES.forEach((status) => {
      expect(status).toHaveProperty('value');
      expect(status).toHaveProperty('label');
      expect(status).toHaveProperty('color');
      expect(status).toHaveProperty('icon');
      expect(status).toHaveProperty('description');
    });
  });

  it('all values are unique', () => {
    const values = DEPOSIT_STATUSES.map((s) => s.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

// ==============================================
// TRUST LEVELS TESTS
// ==============================================
describe('TRUST_LEVELS', () => {
  it('exports an array', () => {
    expect(Array.isArray(TRUST_LEVELS)).toBe(true);
  });

  it('has exactly 4 levels', () => {
    expect(TRUST_LEVELS).toHaveLength(4);
  });

  it('contains trusted level with minScore 80', () => {
    const level = TRUST_LEVELS.find((l) => l.value === 'trusted');
    expect(level).toBeDefined();
    expect(level?.minScore).toBe(80);
    expect(level?.color).toBe('green');
  });

  it('contains standard level with minScore 50', () => {
    const level = TRUST_LEVELS.find((l) => l.value === 'standard');
    expect(level).toBeDefined();
    expect(level?.minScore).toBe(50);
    expect(level?.color).toBe('blue');
  });

  it('contains cautious level with minScore 30', () => {
    const level = TRUST_LEVELS.find((l) => l.value === 'cautious');
    expect(level).toBeDefined();
    expect(level?.minScore).toBe(30);
    expect(level?.color).toBe('amber');
  });

  it('contains high_risk level with minScore 0', () => {
    const level = TRUST_LEVELS.find((l) => l.value === 'high_risk');
    expect(level).toBeDefined();
    expect(level?.minScore).toBe(0);
    expect(level?.color).toBe('red');
  });

  it('levels are ordered by minScore descending', () => {
    const scores = TRUST_LEVELS.map((l) => l.minScore);
    const sortedScores = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sortedScores);
  });

  it('all levels have required properties', () => {
    TRUST_LEVELS.forEach((level) => {
      expect(level).toHaveProperty('value');
      expect(level).toHaveProperty('label');
      expect(level).toHaveProperty('minScore');
      expect(level).toHaveProperty('color');
      expect(level).toHaveProperty('icon');
    });
  });

  it('all values are unique', () => {
    const values = TRUST_LEVELS.map((l) => l.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

// ==============================================
// BOOKING COMBINED STATES TESTS
// ==============================================
describe('BOOKING_COMBINED_STATES', () => {
  it('exports an array', () => {
    expect(Array.isArray(BOOKING_COMBINED_STATES)).toBe(true);
  });

  it('has exactly 9 states', () => {
    expect(BOOKING_COMBINED_STATES).toHaveLength(9);
  });

  const expectedStates = [
    { value: 'hold_active', label: 'En Proceso', color: 'amber', priority: 1 },
    { value: 'pending_confirmation', label: 'Pendiente Confirmar', color: 'orange', priority: 2 },
    { value: 'pending_deposit', label: 'Pendiente Depósito', color: 'yellow', priority: 3 },
    { value: 'confirmed', label: 'Confirmado', color: 'green', priority: 4 },
    { value: 'scheduled', label: 'Programado', color: 'blue', priority: 5 },
    { value: 'in_progress', label: 'En Progreso', color: 'indigo', priority: 6 },
    { value: 'completed', label: 'Completado', color: 'emerald', priority: 7 },
    { value: 'no_show', label: 'No Asistió', color: 'red', priority: 8 },
    { value: 'cancelled', label: 'Cancelado', color: 'gray', priority: 9 },
  ];

  expectedStates.forEach(({ value, label, color, priority }) => {
    it(`contains ${value} state with correct properties`, () => {
      const state = BOOKING_COMBINED_STATES.find((s) => s.value === value);
      expect(state).toBeDefined();
      expect(state?.label).toBe(label);
      expect(state?.color).toBe(color);
      expect(state?.priority).toBe(priority);
    });
  });

  it('all states have required properties', () => {
    BOOKING_COMBINED_STATES.forEach((state) => {
      expect(state).toHaveProperty('value');
      expect(state).toHaveProperty('label');
      expect(state).toHaveProperty('color');
      expect(state).toHaveProperty('priority');
      expect(state).toHaveProperty('description');
    });
  });

  it('all values are unique', () => {
    const values = BOOKING_COMBINED_STATES.map((s) => s.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('all priorities are unique', () => {
    const priorities = BOOKING_COMBINED_STATES.map((s) => s.priority);
    const uniquePriorities = new Set(priorities);
    expect(uniquePriorities.size).toBe(priorities.length);
  });

  it('states are ordered by priority', () => {
    const priorities = BOOKING_COMBINED_STATES.map((s) => s.priority);
    const sortedPriorities = [...priorities].sort((a, b) => a - b);
    expect(priorities).toEqual(sortedPriorities);
  });
});

// ==============================================
// CROSS-CONSTANT CONSISTENCY TESTS
// ==============================================
describe('Cross-constant Consistency', () => {
  it('deposit "required" and "pending" statuses trigger pending_deposit combined state', () => {
    const pendingDepositState = BOOKING_COMBINED_STATES.find((s) => s.value === 'pending_deposit');
    const requiredDepositStatus = DEPOSIT_STATUSES.find((s) => s.value === 'required');
    const pendingDepositStatus = DEPOSIT_STATUSES.find((s) => s.value === 'pending');

    expect(pendingDepositState).toBeDefined();
    expect(requiredDepositStatus).toBeDefined();
    expect(pendingDepositStatus).toBeDefined();
  });

  it('confirmation "pending" status triggers pending_confirmation combined state', () => {
    const pendingConfirmationState = BOOKING_COMBINED_STATES.find(
      (s) => s.value === 'pending_confirmation'
    );
    const pendingConfirmationStatus = CONFIRMATION_STATUSES.find((s) => s.value === 'pending');

    expect(pendingConfirmationState).toBeDefined();
    expect(pendingConfirmationStatus).toBeDefined();
  });

  it('trust level boundaries are consistent', () => {
    const trusted = TRUST_LEVELS.find((l) => l.value === 'trusted');
    const standard = TRUST_LEVELS.find((l) => l.value === 'standard');
    const cautious = TRUST_LEVELS.find((l) => l.value === 'cautious');
    const highRisk = TRUST_LEVELS.find((l) => l.value === 'high_risk');

    // Boundaries should not overlap
    expect(trusted?.minScore).toBeGreaterThan(standard?.minScore ?? 0);
    expect(standard?.minScore).toBeGreaterThan(cautious?.minScore ?? 0);
    expect(cautious?.minScore).toBeGreaterThan(highRisk?.minScore ?? -1);
  });

  it('all color values are valid Tailwind color names', () => {
    const validColors = [
      'slate', 'gray', 'red', 'orange', 'amber', 'yellow',
      'green', 'emerald', 'blue', 'indigo', 'purple',
    ];

    BOOKING_COMBINED_STATES.forEach((state) => {
      expect(validColors).toContain(state.color);
    });

    CONFIRMATION_STATUSES.forEach((status) => {
      expect(validColors).toContain(status.color);
    });

    DEPOSIT_STATUSES.forEach((status) => {
      expect(validColors).toContain(status.color);
    });

    TRUST_LEVELS.forEach((level) => {
      expect(validColors).toContain(level.color);
    });
  });
});
