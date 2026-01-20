/**
 * TIS TIS Platform - Voice Agent Wizard Tests
 * Test Scenarios and Test Result Types
 */

import { TEST_SCENARIOS } from '@/components/voice-agent/wizard/types';
import type { TestScenario, TestResult } from '@/components/voice-agent/wizard/types';

// =====================================================
// TEST SCENARIOS STRUCTURE TESTS
// =====================================================

describe('TEST_SCENARIOS', () => {
  describe('restaurant scenarios', () => {
    const scenarios = TEST_SCENARIOS.restaurant;

    it('should have at least 4 scenarios', () => {
      expect(scenarios.length).toBeGreaterThanOrEqual(4);
    });

    it('each scenario should have required fields', () => {
      scenarios.forEach((scenario: TestScenario) => {
        expect(scenario.id).toBeDefined();
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(scenario.icon).toBeDefined();
        expect(scenario.sampleMessage).toBeDefined();
        expect(typeof scenario.id).toBe('string');
        expect(typeof scenario.name).toBe('string');
        expect(typeof scenario.description).toBe('string');
        expect(typeof scenario.icon).toBe('string');
        expect(typeof scenario.sampleMessage).toBe('string');
      });
    });

    it('should include reservation scenario', () => {
      const reservation = scenarios.find((s) => s.id === 'reservation');
      expect(reservation).toBeDefined();
      expect(reservation?.expectedIntent).toBe('make_reservation');
    });

    it('should include hours scenario', () => {
      const hours = scenarios.find((s) => s.id === 'hours');
      expect(hours).toBeDefined();
      expect(hours?.expectedIntent).toBe('query_hours');
    });

    it('should include menu scenario', () => {
      const menu = scenarios.find((s) => s.id === 'menu');
      expect(menu).toBeDefined();
      expect(menu?.expectedIntent).toBe('query_menu');
    });

    it('should include cancel scenario', () => {
      const cancel = scenarios.find((s) => s.id === 'cancel');
      expect(cancel).toBeDefined();
      expect(cancel?.expectedIntent).toBe('cancel_reservation');
    });

    it('scenarios should have unique ids', () => {
      const ids = scenarios.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('dental scenarios', () => {
    const scenarios = TEST_SCENARIOS.dental;

    it('should have at least 4 scenarios', () => {
      expect(scenarios.length).toBeGreaterThanOrEqual(4);
    });

    it('each scenario should have required fields', () => {
      scenarios.forEach((scenario: TestScenario) => {
        expect(scenario.id).toBeDefined();
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(scenario.icon).toBeDefined();
        expect(scenario.sampleMessage).toBeDefined();
      });
    });

    it('should include appointment scenario', () => {
      const appointment = scenarios.find((s) => s.id === 'appointment');
      expect(appointment).toBeDefined();
      expect(appointment?.expectedIntent).toBe('make_appointment');
    });

    it('should include hours scenario', () => {
      const hours = scenarios.find((s) => s.id === 'hours');
      expect(hours).toBeDefined();
      expect(hours?.expectedIntent).toBe('query_hours');
    });

    it('should include services scenario', () => {
      const services = scenarios.find((s) => s.id === 'services');
      expect(services).toBeDefined();
      expect(services?.expectedIntent).toBe('query_services');
    });

    it('should include emergency scenario', () => {
      const emergency = scenarios.find((s) => s.id === 'emergency');
      expect(emergency).toBeDefined();
      expect(emergency?.expectedIntent).toBe('emergency');
    });

    it('scenarios should have unique ids', () => {
      const ids = scenarios.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('sample messages', () => {
    it('all sample messages should be in Spanish', () => {
      const allScenarios = [...TEST_SCENARIOS.restaurant, ...TEST_SCENARIOS.dental];

      allScenarios.forEach((scenario) => {
        // Check for common Spanish words or patterns
        const hasSpanishIndicators =
          /[áéíóúüñ¿¡]/i.test(scenario.sampleMessage) ||
          /\b(hola|quisiera|para|con|una|el|la|los|las|qué|cuánto|cómo)\b/i.test(scenario.sampleMessage);

        expect(hasSpanishIndicators).toBe(true);
      });
    });

    it('sample messages should not be too short', () => {
      const allScenarios = [...TEST_SCENARIOS.restaurant, ...TEST_SCENARIOS.dental];

      allScenarios.forEach((scenario) => {
        expect(scenario.sampleMessage.length).toBeGreaterThan(10);
      });
    });
  });

  describe('icons', () => {
    it('all icons should be emojis', () => {
      const allScenarios = [...TEST_SCENARIOS.restaurant, ...TEST_SCENARIOS.dental];

      allScenarios.forEach((scenario) => {
        // Emojis are typically represented as 1-4 characters
        expect(scenario.icon.length).toBeLessThanOrEqual(4);
        expect(scenario.icon.length).toBeGreaterThan(0);
      });
    });
  });
});

// =====================================================
// TEST RESULT TYPE TESTS
// =====================================================

describe('TestResult type', () => {
  it('should be able to create a valid test result', () => {
    const result: TestResult = {
      success: true,
      durationSeconds: 45,
      messageCount: 6,
      averageLatencyMs: 250,
      detectedIntents: ['make_appointment', 'query_hours'],
      notes: 'Test completed successfully',
    };

    expect(result.success).toBe(true);
    expect(result.durationSeconds).toBe(45);
    expect(result.messageCount).toBe(6);
    expect(result.averageLatencyMs).toBe(250);
    expect(result.detectedIntents).toContain('make_appointment');
    expect(result.notes).toBe('Test completed successfully');
  });

  it('should work without optional notes', () => {
    const result: TestResult = {
      success: false,
      durationSeconds: 30,
      messageCount: 2,
      averageLatencyMs: 500,
      detectedIntents: [],
    };

    expect(result.success).toBe(false);
    expect(result.notes).toBeUndefined();
  });

  it('should handle empty intents array', () => {
    const result: TestResult = {
      success: true,
      durationSeconds: 60,
      messageCount: 4,
      averageLatencyMs: 300,
      detectedIntents: [],
    };

    expect(result.detectedIntents).toHaveLength(0);
    expect(Array.isArray(result.detectedIntents)).toBe(true);
  });
});

// =====================================================
// SCENARIO COVERAGE TESTS
// =====================================================

describe('scenario coverage', () => {
  it('both verticals should have time/hours scenarios', () => {
    expect(TEST_SCENARIOS.restaurant.some((s) => s.expectedIntent?.includes('hours'))).toBe(true);
    expect(TEST_SCENARIOS.dental.some((s) => s.expectedIntent?.includes('hours'))).toBe(true);
  });

  it('both verticals should have booking/appointment scenarios', () => {
    const restaurantBooking = TEST_SCENARIOS.restaurant.some(
      (s) => s.expectedIntent?.includes('reservation') || s.expectedIntent?.includes('booking')
    );
    const dentalBooking = TEST_SCENARIOS.dental.some(
      (s) => s.expectedIntent?.includes('appointment') || s.expectedIntent?.includes('booking')
    );

    expect(restaurantBooking).toBe(true);
    expect(dentalBooking).toBe(true);
  });

  it('dental should have emergency scenario', () => {
    const hasEmergency = TEST_SCENARIOS.dental.some((s) => s.id === 'emergency');
    expect(hasEmergency).toBe(true);
  });

  it('restaurant should have menu scenario', () => {
    const hasMenu = TEST_SCENARIOS.restaurant.some((s) => s.expectedIntent?.includes('menu'));
    expect(hasMenu).toBe(true);
  });
});
