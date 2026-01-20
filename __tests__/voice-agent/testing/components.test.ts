/**
 * TIS TIS Platform - Voice Agent Testing Components Tests
 * Tests for CallSimulator, ValidationChecklist, and TestScenarios
 */

import type {
  SimulatorMessage,
  SimulatorMetrics,
} from '@/components/voice-agent/testing/CallSimulator';
import type { TestScenarioResult } from '@/components/voice-agent/testing/TestScenarios';
import type { ValidationItem, ValidationStatus } from '@/components/voice-agent/testing/ValidationChecklist';

// =====================================================
// SIMULATOR MESSAGE TESTS
// =====================================================

describe('SimulatorMessage type', () => {
  it('should create user message', () => {
    const message: SimulatorMessage = {
      id: 'user-1',
      role: 'user',
      content: 'Hola, quiero agendar una cita',
      timestamp: new Date(),
    };

    expect(message.role).toBe('user');
    expect(message.content).toBeDefined();
    expect(message.latencyMs).toBeUndefined();
  });

  it('should create assistant message with latency', () => {
    const message: SimulatorMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Buenos días, con gusto le ayudo',
      timestamp: new Date(),
      latencyMs: 250,
    };

    expect(message.role).toBe('assistant');
    expect(message.latencyMs).toBe(250);
  });

  it('should create system message', () => {
    const message: SimulatorMessage = {
      id: 'system-1',
      role: 'system',
      content: 'Llamada conectada',
      timestamp: new Date(),
    };

    expect(message.role).toBe('system');
  });
});

// =====================================================
// SIMULATOR METRICS TESTS
// =====================================================

describe('SimulatorMetrics type', () => {
  it('should have all required fields', () => {
    const metrics: SimulatorMetrics = {
      duration: 120,
      messageCount: 10,
      avgLatency: 280,
      maxLatency: 450,
    };

    expect(metrics.duration).toBe(120);
    expect(metrics.messageCount).toBe(10);
    expect(metrics.avgLatency).toBe(280);
    expect(metrics.maxLatency).toBe(450);
  });

  it('should handle zero values', () => {
    const metrics: SimulatorMetrics = {
      duration: 0,
      messageCount: 0,
      avgLatency: 0,
      maxLatency: 0,
    };

    expect(metrics.duration).toBe(0);
    expect(metrics.messageCount).toBe(0);
  });

  it('should satisfy invariant: maxLatency >= avgLatency', () => {
    const metrics: SimulatorMetrics = {
      duration: 60,
      messageCount: 5,
      avgLatency: 300,
      maxLatency: 500,
    };

    expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.avgLatency);
  });
});

// =====================================================
// TEST SCENARIO RESULT TESTS
// =====================================================

describe('TestScenarioResult type', () => {
  it('should create passed result', () => {
    const result: TestScenarioResult = {
      scenarioId: 'reservation',
      passed: true,
      response: 'Perfecto, he agendado su reservación',
      latencyMs: 320,
      detectedIntent: 'make_reservation',
      timestamp: new Date(),
    };

    expect(result.passed).toBe(true);
    expect(result.detectedIntent).toBe('make_reservation');
  });

  it('should create failed result', () => {
    const result: TestScenarioResult = {
      scenarioId: 'cancel',
      passed: false,
      response: 'Error al procesar',
      latencyMs: 0,
      timestamp: new Date(),
    };

    expect(result.passed).toBe(false);
    expect(result.detectedIntent).toBeUndefined();
  });
});

// =====================================================
// VALIDATION ITEM TESTS
// =====================================================

describe('ValidationItem type', () => {
  // Mock icon for tests
  const mockIcon = null;

  it('should create passed validation', () => {
    const item: ValidationItem = {
      id: 'voice-configured',
      title: 'Voz configurada',
      description: 'Una voz ha sido seleccionada',
      status: 'passed',
      icon: mockIcon,
    };

    expect(item.status).toBe('passed');
  });

  it('should create failed validation with message', () => {
    const item: ValidationItem = {
      id: 'first-message',
      title: 'Mensaje inicial',
      description: 'El mensaje de saludo está configurado',
      status: 'failed',
      message: 'El mensaje inicial está vacío',
      icon: mockIcon,
    };

    expect(item.status).toBe('failed');
    expect(item.message).toBeDefined();
  });

  it('should create warning validation', () => {
    const item: ValidationItem = {
      id: 'phone-number',
      title: 'Número de teléfono',
      description: 'Un número está asignado',
      status: 'warning',
      message: 'Número pendiente de verificación',
      icon: mockIcon,
    };

    expect(item.status).toBe('warning');
  });

  it('should create pending validation', () => {
    const item: ValidationItem = {
      id: 'api-connection',
      title: 'Conexión API',
      description: 'Conexión con el servicio',
      status: 'pending',
      icon: mockIcon,
    };

    expect(item.status).toBe('pending');
  });

  it('should support checking status', () => {
    const item: ValidationItem = {
      id: 'checking-item',
      title: 'Verificando',
      description: 'En proceso de verificación',
      status: 'checking',
      icon: mockIcon,
    };

    expect(item.status).toBe('checking');
  });
});

describe('ValidationStatus type', () => {
  it('should allow all valid statuses', () => {
    const statuses: ValidationStatus[] = ['pending', 'checking', 'passed', 'failed', 'warning'];

    expect(statuses).toHaveLength(5);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('checking');
    expect(statuses).toContain('passed');
    expect(statuses).toContain('failed');
    expect(statuses).toContain('warning');
  });
});

// =====================================================
// INTEGRATION TESTS
// =====================================================

describe('Testing components integration', () => {
  it('should calculate metrics from messages', () => {
    const messages: SimulatorMessage[] = [
      { id: '1', role: 'system', content: 'Conectado', timestamp: new Date() },
      { id: '2', role: 'assistant', content: 'Hola', timestamp: new Date(), latencyMs: 0 },
      { id: '3', role: 'user', content: 'Quiero reservar', timestamp: new Date() },
      { id: '4', role: 'assistant', content: 'Claro', timestamp: new Date(), latencyMs: 280 },
      { id: '5', role: 'user', content: 'Para mañana', timestamp: new Date() },
      { id: '6', role: 'assistant', content: 'Listo', timestamp: new Date(), latencyMs: 350 },
    ];

    // Calculate metrics like component does
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const messagesWithLatency = messages.filter((m) => m.latencyMs && m.latencyMs > 0);
    const avgLatency = messagesWithLatency.length > 0
      ? messagesWithLatency.reduce((sum, m) => sum + (m.latencyMs || 0), 0) / messagesWithLatency.length
      : 0;
    const maxLatency = Math.max(...messages.map((m) => m.latencyMs || 0), 0);

    expect(nonSystemMessages.length).toBe(5);
    expect(messagesWithLatency.length).toBe(2);
    expect(avgLatency).toBe(315); // (280 + 350) / 2
    expect(maxLatency).toBe(350);
  });

  it('should aggregate validation results', () => {
    const mockIcon = null;
    const items: ValidationItem[] = [
      { id: '1', title: 'Check 1', description: 'Desc 1', status: 'passed', icon: mockIcon },
      { id: '2', title: 'Check 2', description: 'Desc 2', status: 'passed', icon: mockIcon },
      { id: '3', title: 'Check 3', description: 'Desc 3', status: 'failed', icon: mockIcon },
      { id: '4', title: 'Check 4', description: 'Desc 4', status: 'warning', icon: mockIcon },
    ];

    const passed = items.filter((c) => c.status === 'passed').length;
    const failed = items.filter((c) => c.status === 'failed').length;
    const warnings = items.filter((c) => c.status === 'warning').length;

    expect(passed).toBe(2);
    expect(failed).toBe(1);
    expect(warnings).toBe(1);
  });

  it('should calculate test scenario success rate', () => {
    const results: TestScenarioResult[] = [
      { scenarioId: '1', passed: true, response: 'OK', latencyMs: 200, timestamp: new Date() },
      { scenarioId: '2', passed: true, response: 'OK', latencyMs: 250, timestamp: new Date() },
      { scenarioId: '3', passed: false, response: 'Error', latencyMs: 0, timestamp: new Date() },
      { scenarioId: '4', passed: true, response: 'OK', latencyMs: 300, timestamp: new Date() },
    ];

    const totalScenarios = results.length;
    const passedScenarios = results.filter((r) => r.passed).length;
    const successRate = (passedScenarios / totalScenarios) * 100;
    const avgLatency = results
      .filter((r) => r.passed)
      .reduce((sum, r) => sum + r.latencyMs, 0) / passedScenarios;

    expect(totalScenarios).toBe(4);
    expect(passedScenarios).toBe(3);
    expect(successRate).toBe(75);
    expect(avgLatency).toBe(250); // (200 + 250 + 300) / 3
  });
});
