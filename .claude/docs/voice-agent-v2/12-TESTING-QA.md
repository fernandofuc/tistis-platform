# 12. Testing y QA - Voice Agent v2.0

## Tabla de Contenidos

1. [Estrategia de Testing](#1-estrategia-de-testing)
2. [Tests Unitarios](#2-tests-unitarios)
3. [Tests de Integracion](#3-tests-de-integracion)
4. [Tests E2E](#4-tests-e2e)
5. [Tests de Performance](#5-tests-de-performance)
6. [Tests de Seguridad](#6-tests-de-seguridad)
7. [QA Manual](#7-qa-manual)
8. [Metricas de Calidad](#8-metricas-de-calidad)

---

## 1. Estrategia de Testing

### 1.1 Piramide de Tests

```
                    ┌─────────┐
                   /           \
                  /   E2E (10%) \        ← Flujos criticos completos
                 /───────────────\
                /                 \
               /  Integration (30%)\     ← Componentes conectados
              /─────────────────────\
             /                       \
            /     Unit Tests (60%)    \  ← Logica aislada
           └───────────────────────────┘
```

### 1.2 Cobertura Objetivo

| Tipo | Coverage Minimo | Coverage Objetivo |
|------|-----------------|-------------------|
| Unit Tests | 80% | 90% |
| Integration | 70% | 80% |
| E2E | Flujos criticos | 100% flujos criticos |
| Performance | p95 < 800ms | p50 < 500ms |

### 1.3 Herramientas

```typescript
// Configuracion de testing
const TESTING_STACK = {
  unitTests: {
    framework: 'Vitest',
    mocking: 'vi.mock',
    assertions: 'expect'
  },
  integrationTests: {
    framework: 'Vitest',
    database: 'Supabase Test Instance',
    mocking: 'MSW (Mock Service Worker)'
  },
  e2eTests: {
    framework: 'Playwright',
    browsers: ['chromium', 'firefox', 'webkit']
  },
  performanceTests: {
    loadTesting: 'k6',
    latencyTesting: 'Custom scripts'
  },
  securityTests: {
    staticAnalysis: 'ESLint Security Plugin',
    dynamicAnalysis: 'OWASP ZAP'
  }
};
```

---

## 2. Tests Unitarios

### 2.1 Security Gate Tests

```typescript
// __tests__/unit/voice-agent/security/webhook-security-gate.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookSecurityGate } from '@/lib/voice-agent/security/webhook-security-gate';
import { createMockRequest } from '@/test-utils/mocks';

describe('WebhookSecurityGate', () => {
  let securityGate: WebhookSecurityGate;

  beforeEach(() => {
    securityGate = new WebhookSecurityGate({
      vapiSecretKey: 'test-secret-key',
      enableIpWhitelist: true,
      enableRateLimit: true,
      rateLimitRequests: 100,
      rateLimitWindowMs: 60000
    });
  });

  describe('IP Whitelist Validation', () => {
    it('should allow requests from whitelisted VAPI IPs', async () => {
      const request = createMockRequest({
        ip: '54.172.60.0', // VAPI IP
        headers: {
          'x-vapi-signature': 'valid-signature'
        }
      });

      const result = await securityGate.validateIp(request);
      expect(result.valid).toBe(true);
    });

    it('should reject requests from non-whitelisted IPs', async () => {
      const request = createMockRequest({
        ip: '192.168.1.1', // Non-VAPI IP
      });

      const result = await securityGate.validateIp(request);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('IP not in whitelist');
    });

    it('should handle IPv6 addresses correctly', async () => {
      const request = createMockRequest({
        ip: '::ffff:54.172.60.0',
      });

      const result = await securityGate.validateIp(request);
      expect(result.valid).toBe(true);
    });
  });

  describe('HMAC Signature Validation', () => {
    it('should validate correct HMAC signature', async () => {
      const payload = JSON.stringify({ type: 'assistant-request', call: {} });
      const timestamp = Date.now().toString();
      const signature = generateValidSignature(payload, timestamp, 'test-secret-key');

      const request = createMockRequest({
        body: payload,
        headers: {
          'x-vapi-signature': signature,
          'x-vapi-timestamp': timestamp
        }
      });

      const result = await securityGate.validateSignature(request);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid HMAC signature', async () => {
      const request = createMockRequest({
        body: JSON.stringify({ type: 'test' }),
        headers: {
          'x-vapi-signature': 'invalid-signature',
          'x-vapi-timestamp': Date.now().toString()
        }
      });

      const result = await securityGate.validateSignature(request);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid HMAC signature');
    });

    it('should reject expired timestamps (> 5 minutes)', async () => {
      const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago

      const request = createMockRequest({
        headers: {
          'x-vapi-timestamp': oldTimestamp
        }
      });

      const result = await securityGate.validateTimestamp(request);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Timestamp expired');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const request = createMockRequest({ ip: '54.172.60.0' });

      // Make 50 requests (under limit of 100)
      for (let i = 0; i < 50; i++) {
        const result = await securityGate.checkRateLimit(request);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject requests exceeding rate limit', async () => {
      const request = createMockRequest({ ip: '54.172.60.0' });

      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        await securityGate.checkRateLimit(request);
      }

      // Next request should be rejected
      const result = await securityGate.checkRateLimit(request);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
    });

    it('should reset rate limit after window expires', async () => {
      vi.useFakeTimers();

      const request = createMockRequest({ ip: '54.172.60.0' });

      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        await securityGate.checkRateLimit(request);
      }

      // Advance time past window
      vi.advanceTimersByTime(61000);

      // Should be allowed again
      const result = await securityGate.checkRateLimit(request);
      expect(result.valid).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Full Validation Pipeline', () => {
    it('should pass all validations for valid request', async () => {
      const payload = JSON.stringify({ type: 'assistant-request' });
      const timestamp = Date.now().toString();
      const signature = generateValidSignature(payload, timestamp, 'test-secret-key');

      const request = createMockRequest({
        ip: '54.172.60.0',
        body: payload,
        headers: {
          'x-vapi-signature': signature,
          'x-vapi-timestamp': timestamp,
          'content-type': 'application/json'
        }
      });

      const result = await securityGate.validate(request);
      expect(result.valid).toBe(true);
      expect(result.validations).toEqual({
        ip: true,
        signature: true,
        timestamp: true,
        rateLimit: true,
        content: true
      });
    });

    it('should fail fast on first validation failure', async () => {
      const request = createMockRequest({
        ip: '192.168.1.1', // Invalid IP
      });

      const result = await securityGate.validate(request);
      expect(result.valid).toBe(false);
      expect(result.failedAt).toBe('ip');
    });
  });
});

// Helper function
function generateValidSignature(payload: string, timestamp: string, secret: string): string {
  const crypto = require('crypto');
  const message = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}
```

### 2.2 Circuit Breaker Tests

```typescript
// __tests__/unit/voice-agent/resilience/circuit-breaker.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceCircuitBreaker } from '@/lib/voice-agent/resilience/circuit-breaker';

describe('VoiceCircuitBreaker', () => {
  let circuitBreaker: VoiceCircuitBreaker;
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      getState: vi.fn().mockResolvedValue({
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null
      }),
      setState: vi.fn().mockResolvedValue(undefined)
    };

    circuitBreaker = new VoiceCircuitBreaker({
      businessId: 'test-business',
      failureThreshold: 5,
      recoveryTimeout: 30000,
      store: mockStore
    });
  });

  describe('CLOSED State', () => {
    it('should execute function when circuit is closed', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should increment failure count on error', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');

      expect(mockStore.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          failureCount: 1
        })
      );
    });

    it('should open circuit after reaching failure threshold', async () => {
      mockStore.getState.mockResolvedValue({
        state: 'CLOSED',
        failureCount: 4, // One more failure will reach threshold
        lastFailureTime: Date.now()
      });

      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();

      expect(mockStore.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'OPEN',
          failureCount: 5
        })
      );
    });

    it('should reset failure count on success', async () => {
      mockStore.getState.mockResolvedValue({
        state: 'CLOSED',
        failureCount: 3,
        lastFailureTime: Date.now()
      });

      const mockFn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(mockFn);

      expect(mockStore.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          failureCount: 0
        })
      );
    });
  });

  describe('OPEN State', () => {
    it('should return fallback immediately without executing function', async () => {
      mockStore.getState.mockResolvedValue({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now()
      });

      const mockFn = vi.fn().mockResolvedValue('success');
      const fallback = 'fallback response';

      const result = await circuitBreaker.execute(mockFn, { fallback });

      expect(result).toBe(fallback);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should throw CircuitOpenError if no fallback provided', async () => {
      mockStore.getState.mockResolvedValue({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now()
      });

      const mockFn = vi.fn();

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      vi.useFakeTimers();

      const oldTime = Date.now() - 31000; // 31 seconds ago
      mockStore.getState.mockResolvedValue({
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: oldTime
      });

      const mockFn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(mockFn);

      expect(mockStore.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'HALF_OPEN'
        })
      );

      vi.useRealTimers();
    });
  });

  describe('HALF_OPEN State', () => {
    beforeEach(() => {
      mockStore.getState.mockResolvedValue({
        state: 'HALF_OPEN',
        failureCount: 5,
        lastFailureTime: Date.now() - 31000
      });
    });

    it('should close circuit on success', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(mockFn);

      expect(mockStore.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'CLOSED',
          failureCount: 0
        })
      );
    });

    it('should re-open circuit on failure', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Still failing'));

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow();

      expect(mockStore.setState).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'OPEN'
        })
      );
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running functions', async () => {
      const slowFn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      circuitBreaker = new VoiceCircuitBreaker({
        businessId: 'test',
        failureThreshold: 5,
        recoveryTimeout: 30000,
        timeout: 1000, // 1 second timeout
        store: mockStore
      });

      await expect(circuitBreaker.execute(slowFn)).rejects.toThrow('Timeout');
    });
  });
});
```

### 2.3 Tool Registry Tests

```typescript
// __tests__/unit/voice-agent/tools/registry.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '@/lib/voice-agent/tools/registry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', () => {
      const tool = {
        name: 'check_availability',
        description: 'Check availability',
        parameters: {},
        handler: async () => ({ available: true })
      };

      registry.register(tool);

      expect(registry.has('check_availability')).toBe(true);
    });

    it('should throw error for duplicate tool names', () => {
      const tool = {
        name: 'test_tool',
        description: 'Test',
        parameters: {},
        handler: async () => ({})
      };

      registry.register(tool);

      expect(() => registry.register(tool)).toThrow('Tool already registered');
    });

    it('should validate tool schema on registration', () => {
      const invalidTool = {
        name: '', // Invalid empty name
        description: 'Test',
        parameters: {},
        handler: async () => ({})
      };

      expect(() => registry.register(invalidTool)).toThrow('Invalid tool name');
    });
  });

  describe('Tool Retrieval', () => {
    it('should get tool by name', () => {
      const tool = {
        name: 'get_menu',
        description: 'Get menu',
        parameters: {},
        handler: async () => ({ items: [] })
      };

      registry.register(tool);

      const retrieved = registry.get('get_menu');
      expect(retrieved).toEqual(tool);
    });

    it('should return undefined for non-existent tool', () => {
      const result = registry.get('non_existent');
      expect(result).toBeUndefined();
    });

    it('should filter tools by type', () => {
      registry.register({
        name: 'tool_a',
        description: 'A',
        parameters: {},
        types: ['rest_basic', 'rest_standard'],
        handler: async () => ({})
      });

      registry.register({
        name: 'tool_b',
        description: 'B',
        parameters: {},
        types: ['rest_complete'],
        handler: async () => ({})
      });

      const basicTools = registry.getForType('rest_basic');
      expect(basicTools).toHaveLength(1);
      expect(basicTools[0].name).toBe('tool_a');
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });

      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        handler
      });

      const result = await registry.execute('test_tool', { id: '123' });

      expect(handler).toHaveBeenCalledWith({ id: '123' });
      expect(result).toEqual({ success: true });
    });

    it('should validate parameters before execution', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: {
          type: 'object',
          properties: {
            required_field: { type: 'string' }
          },
          required: ['required_field']
        },
        handler: async () => ({})
      });

      await expect(
        registry.execute('test_tool', {}) // Missing required field
      ).rejects.toThrow('Missing required parameter');
    });

    it('should handle execution errors gracefully', async () => {
      registry.register({
        name: 'failing_tool',
        description: 'Fails',
        parameters: {},
        handler: async () => {
          throw new Error('Handler error');
        }
      });

      await expect(
        registry.execute('failing_tool', {})
      ).rejects.toThrow('Handler error');
    });
  });

  describe('Confirmation Flow', () => {
    it('should identify tools requiring confirmation', () => {
      registry.register({
        name: 'create_reservation',
        description: 'Create reservation',
        parameters: {},
        requiresConfirmation: true,
        handler: async () => ({})
      });

      expect(registry.requiresConfirmation('create_reservation')).toBe(true);
    });

    it('should generate confirmation message', () => {
      registry.register({
        name: 'create_reservation',
        description: 'Create reservation',
        parameters: {},
        requiresConfirmation: true,
        confirmationTemplate: 'Confirma reservacion para {party_size} personas el {date}?',
        handler: async () => ({})
      });

      const message = registry.getConfirmationMessage('create_reservation', {
        party_size: 4,
        date: '15 de enero'
      });

      expect(message).toBe('Confirma reservacion para 4 personas el 15 de enero?');
    });
  });
});
```

---

## 3. Tests de Integracion

### 3.1 Webhook Handler Integration

```typescript
// __tests__/integration/voice-agent/webhook-handler.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestServer, createTestDatabase } from '@/test-utils/server';
import { generateVapiWebhook } from '@/test-utils/vapi-mocks';

describe('Webhook Handler Integration', () => {
  let server: TestServer;
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
    server = await createTestServer({ database: db });
  });

  afterAll(async () => {
    await server.close();
    await db.cleanup();
  });

  beforeEach(async () => {
    await db.seed('voice_agent_fixtures');
  });

  describe('assistant-request webhook', () => {
    it('should return complete assistant configuration', async () => {
      const webhook = generateVapiWebhook('assistant-request', {
        call: {
          id: 'call-123',
          phoneNumber: '+15551234567',
          customer: { number: '+15559876543' }
        }
      });

      const response = await server.post('/api/voice-agent/webhook', webhook);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        assistant: {
          model: expect.any(Object),
          voice: expect.any(Object),
          firstMessage: expect.any(String),
          serverUrl: expect.stringContaining('/api/voice-agent/webhook')
        }
      });
    });

    it('should use correct template based on business type', async () => {
      // Restaurant business
      const restaurantWebhook = generateVapiWebhook('assistant-request', {
        call: {
          phoneNumber: '+15551111111' // Restaurant phone
        }
      });

      const restaurantResponse = await server.post('/api/voice-agent/webhook', restaurantWebhook);
      expect(restaurantResponse.body.assistant.firstMessage).toContain('restaurante');

      // Dental business
      const dentalWebhook = generateVapiWebhook('assistant-request', {
        call: {
          phoneNumber: '+15552222222' // Dental phone
        }
      });

      const dentalResponse = await server.post('/api/voice-agent/webhook', dentalWebhook);
      expect(dentalResponse.body.assistant.firstMessage).toContain('clinica');
    });

    it('should handle unknown phone numbers gracefully', async () => {
      const webhook = generateVapiWebhook('assistant-request', {
        call: {
          phoneNumber: '+15559999999' // Unknown phone
        }
      });

      const response = await server.post('/api/voice-agent/webhook', webhook);

      expect(response.status).toBe(200);
      expect(response.body.assistant.firstMessage).toContain('no configurado');
    });
  });

  describe('function-call webhook', () => {
    it('should execute check_availability tool', async () => {
      const webhook = generateVapiWebhook('function-call', {
        call: { id: 'call-123' },
        functionCall: {
          name: 'check_availability',
          parameters: {
            date: '2024-01-20',
            time: '19:00',
            party_size: 4
          }
        }
      });

      const response = await server.post('/api/voice-agent/webhook', webhook);

      expect(response.status).toBe(200);
      expect(response.body.result).toHaveProperty('available');
      expect(response.body.result).toHaveProperty('alternatives');
    });

    it('should handle create_reservation with confirmation', async () => {
      const webhook = generateVapiWebhook('function-call', {
        call: { id: 'call-123' },
        functionCall: {
          name: 'create_reservation',
          parameters: {
            date: '2024-01-20',
            time: '19:00',
            party_size: 4,
            customer_name: 'Juan Perez',
            customer_phone: '+5215551234567'
          }
        }
      });

      const response = await server.post('/api/voice-agent/webhook', webhook);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('confirmation_required', true);
      expect(response.body).toHaveProperty('confirmation_message');
    });

    it('should create reservation after confirmation', async () => {
      const webhook = generateVapiWebhook('function-call', {
        call: { id: 'call-123' },
        functionCall: {
          name: 'create_reservation',
          parameters: {
            date: '2024-01-20',
            time: '19:00',
            party_size: 4,
            customer_name: 'Juan Perez',
            customer_phone: '+5215551234567',
            confirmed: true
          }
        }
      });

      const response = await server.post('/api/voice-agent/webhook', webhook);

      expect(response.status).toBe(200);
      expect(response.body.result).toHaveProperty('reservation_id');
      expect(response.body.result).toHaveProperty('confirmation_number');

      // Verify in database
      const reservation = await db.query(
        'SELECT * FROM reservations WHERE confirmation_number = $1',
        [response.body.result.confirmation_number]
      );
      expect(reservation).toBeDefined();
    });
  });

  describe('end-of-call-report webhook', () => {
    it('should save call metrics', async () => {
      const webhook = generateVapiWebhook('end-of-call-report', {
        call: {
          id: 'call-123',
          startedAt: '2024-01-15T10:00:00Z',
          endedAt: '2024-01-15T10:05:00Z',
          endedReason: 'customer-ended-call',
          cost: 0.15
        },
        analysis: {
          summary: 'Customer made a reservation for 4 people',
          structuredData: {
            reservation_made: true,
            party_size: 4
          }
        }
      });

      const response = await server.post('/api/voice-agent/webhook', webhook);

      expect(response.status).toBe(200);

      // Verify metrics saved
      const metrics = await db.query(
        'SELECT * FROM voice_assistant_metrics WHERE call_id = $1',
        ['call-123']
      );
      expect(metrics).toBeDefined();
      expect(metrics.duration_seconds).toBe(300);
    });
  });
});
```

### 3.2 LangGraph Integration

```typescript
// __tests__/integration/voice-agent/langgraph.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VoiceAgentGraph } from '@/lib/voice-agent/langgraph/voice-agent-graph';
import { createTestDatabase } from '@/test-utils/server';

describe('VoiceAgentGraph Integration', () => {
  let db: TestDatabase;
  let graph: VoiceAgentGraph;

  beforeAll(async () => {
    db = await createTestDatabase();
    await db.seed('voice_agent_fixtures');

    graph = new VoiceAgentGraph({
      businessId: 'test-business-123',
      assistantType: 'rest_standard'
    });
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe('Conversation Flow', () => {
    it('should handle reservation request flow', async () => {
      const result = await graph.invoke({
        messages: [
          { role: 'user', content: 'Quiero hacer una reservacion para 4 personas manana a las 7' }
        ],
        context: {
          businessId: 'test-business-123',
          callId: 'test-call-123'
        }
      });

      expect(result.response).toBeDefined();
      expect(result.toolCalls).toContainEqual(
        expect.objectContaining({
          name: 'check_availability'
        })
      );
    });

    it('should route to RAG for menu questions', async () => {
      const result = await graph.invoke({
        messages: [
          { role: 'user', content: 'Que platillos de mariscos tienen?' }
        ],
        context: {
          businessId: 'test-business-123',
          callId: 'test-call-123'
        }
      });

      expect(result.ragUsed).toBe(true);
      expect(result.response).toContain('marisco');
    });

    it('should handle confirmation flow', async () => {
      // First message - reservation request
      let result = await graph.invoke({
        messages: [
          { role: 'user', content: 'Reserva para 4 personas el viernes a las 8' }
        ],
        context: {
          businessId: 'test-business-123',
          callId: 'test-call-123'
        }
      });

      expect(result.pendingConfirmation).toBe(true);

      // Second message - confirmation
      result = await graph.invoke({
        messages: [
          { role: 'user', content: 'Reserva para 4 personas el viernes a las 8' },
          { role: 'assistant', content: result.response },
          { role: 'user', content: 'Si, confirmo' }
        ],
        context: {
          businessId: 'test-business-123',
          callId: 'test-call-123',
          pendingAction: result.pendingAction
        }
      });

      expect(result.actionExecuted).toBe(true);
      expect(result.response).toContain('confirmad');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      // Force a database error
      await db.disconnect();

      const result = await graph.invoke({
        messages: [
          { role: 'user', content: 'Reserva para 4 personas manana' }
        ],
        context: {
          businessId: 'test-business-123',
          callId: 'test-call-123'
        }
      });

      expect(result.error).toBeDefined();
      expect(result.fallbackUsed).toBe(true);
      expect(result.response).toContain('problema');

      await db.reconnect();
    });
  });

  describe('Latency', () => {
    it('should respond within latency budget', async () => {
      const start = Date.now();

      await graph.invoke({
        messages: [
          { role: 'user', content: 'Cual es su horario?' }
        ],
        context: {
          businessId: 'test-business-123',
          callId: 'test-call-123'
        }
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(800); // p95 target
    });
  });
});
```

---

## 4. Tests E2E

### 4.1 Wizard Flow E2E

```typescript
// __tests__/e2e/voice-agent/wizard-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Voice Agent Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should complete full wizard flow', async ({ page }) => {
    // Navigate to voice agent setup
    await page.goto('/dashboard/voice-agent/setup');

    // Step 1: Select Type
    await expect(page.locator('h2')).toContainText('Elige el tipo de asistente');

    // Select standard type
    await page.click('[data-testid="type-rest_standard"]');
    await expect(page.locator('[data-testid="type-rest_standard"]')).toHaveClass(/border-primary/);

    await page.click('button:has-text("Continuar")');

    // Step 2: Select Voice
    await expect(page.locator('h2')).toContainText('Elige la voz');

    // Play voice preview
    await page.click('[data-testid="voice-maria"] button:has-text("Play")');
    await page.waitForTimeout(2000); // Wait for audio

    // Select voice
    await page.click('[data-testid="voice-maria"]');
    await page.click('button:has-text("Continuar")');

    // Step 3: Customize
    await expect(page.locator('h2')).toContainText('Personalizar');

    // Add special instructions
    await page.fill('[name="specialInstructions"]', 'Siempre mencionar la promocion del dia');
    await page.click('button:has-text("Continuar")');

    // Step 4: Test
    await expect(page.locator('h2')).toContainText('Probar');

    // Start test call
    await page.click('[data-testid="start-test-call"]');
    await expect(page.locator('[data-testid="call-status"]')).toContainText('Llamada activa');

    // End test call
    await page.click('[data-testid="end-test-call"]');
    await expect(page.locator('[data-testid="validation-checklist"]')).toBeVisible();

    // Wait for validations to complete
    await expect(page.locator('[data-testid="validation-passed"]')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Continuar")');

    // Step 5: Activate
    await expect(page.locator('h2')).toContainText('Activar');

    // Provision phone number
    await page.click('button:has-text("Activar asistente")');

    // Wait for success
    await expect(page.locator('[data-testid="activation-success"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="phone-number"]')).toBeVisible();
  });

  test('should handle back navigation', async ({ page }) => {
    await page.goto('/dashboard/voice-agent/setup');

    // Go to step 2
    await page.click('[data-testid="type-rest_basic"]');
    await page.click('button:has-text("Continuar")');

    // Go back
    await page.click('button:has-text("Atras")');

    // Should be back at step 1 with selection preserved
    await expect(page.locator('h2')).toContainText('Elige el tipo');
    await expect(page.locator('[data-testid="type-rest_basic"]')).toHaveClass(/border-primary/);
  });

  test('should show validation errors', async ({ page }) => {
    await page.goto('/dashboard/voice-agent/setup');

    // Try to continue without selecting type
    await page.click('button:has-text("Continuar")');

    // Button should be disabled
    await expect(page.locator('button:has-text("Continuar")')).toBeDisabled();
  });
});
```

### 4.2 Dashboard E2E

```typescript
// __tests__/e2e/voice-agent/dashboard.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Voice Agent Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto('/dashboard/voice-agent');
  });

  test('should display metrics cards', async ({ page }) => {
    await expect(page.locator('[data-testid="metric-total-calls"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-avg-latency"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-avg-duration"]')).toBeVisible();
  });

  test('should filter by date range', async ({ page }) => {
    // Select last 7 days
    await page.click('[data-testid="date-range-selector"]');
    await page.click('text=Ultimos 7 dias');

    // Wait for data to reload
    await page.waitForResponse(response =>
      response.url().includes('/api/voice-agent/metrics')
    );

    // Verify charts updated
    await expect(page.locator('[data-testid="calls-chart"]')).toBeVisible();
  });

  test('should show call details on click', async ({ page }) => {
    // Click on a call row
    await page.click('[data-testid="call-row"]:first-child');

    // Should show call details modal
    await expect(page.locator('[data-testid="call-details-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="call-transcript"]')).toBeVisible();
  });

  test('should export data', async ({ page }) => {
    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar")');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/voice-agent-metrics.*\.csv/);
  });
});
```

---

## 5. Tests de Performance

### 5.1 Load Testing con k6

```javascript
// __tests__/performance/voice-agent/load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const webhookLatency = new Trend('webhook_latency');

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],  // 95% of requests under 800ms
    errors: ['rate<0.05'],              // Error rate under 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulate assistant-request webhook
  const assistantRequestPayload = JSON.stringify({
    message: {
      type: 'assistant-request',
      call: {
        id: `call-${Date.now()}-${Math.random()}`,
        phoneNumber: '+15551234567',
        customer: {
          number: '+15559876543'
        }
      }
    }
  });

  const headers = {
    'Content-Type': 'application/json',
    'x-vapi-signature': generateSignature(assistantRequestPayload),
    'x-vapi-timestamp': Date.now().toString()
  };

  const start = Date.now();
  const response = http.post(
    `${BASE_URL}/api/voice-agent/webhook`,
    assistantRequestPayload,
    { headers }
  );
  const latency = Date.now() - start;

  webhookLatency.add(latency);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has assistant config': (r) => {
      const body = JSON.parse(r.body);
      return body.assistant !== undefined;
    },
    'latency under 800ms': () => latency < 800,
  });

  errorRate.add(!success);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'performance-results.json': JSON.stringify(data),
  };
}

function generateSignature(payload) {
  // Simplified for testing - in real tests use proper HMAC
  return 'test-signature';
}
```

### 5.2 Latency Benchmarks

```typescript
// __tests__/performance/voice-agent/latency-benchmark.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestServer } from '@/test-utils/server';

describe('Latency Benchmarks', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  const runBenchmark = async (name: string, fn: () => Promise<void>, iterations = 100) => {
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await fn();
      latencies.push(Date.now() - start);
    }

    latencies.sort((a, b) => a - b);

    return {
      name,
      p50: latencies[Math.floor(iterations * 0.5)],
      p95: latencies[Math.floor(iterations * 0.95)],
      p99: latencies[Math.floor(iterations * 0.99)],
      avg: latencies.reduce((a, b) => a + b, 0) / iterations,
      min: latencies[0],
      max: latencies[latencies.length - 1]
    };
  };

  it('assistant-request webhook should meet latency targets', async () => {
    const results = await runBenchmark('assistant-request', async () => {
      await server.post('/api/voice-agent/webhook', {
        message: {
          type: 'assistant-request',
          call: { id: 'test', phoneNumber: '+15551234567' }
        }
      });
    });

    console.log('Assistant Request Latency:', results);

    expect(results.p50).toBeLessThan(500);
    expect(results.p95).toBeLessThan(800);
  });

  it('function-call webhook should meet latency targets', async () => {
    const results = await runBenchmark('function-call', async () => {
      await server.post('/api/voice-agent/webhook', {
        message: {
          type: 'function-call',
          call: { id: 'test' },
          functionCall: {
            name: 'check_availability',
            parameters: { date: '2024-01-20', time: '19:00', party_size: 4 }
          }
        }
      });
    });

    console.log('Function Call Latency:', results);

    expect(results.p50).toBeLessThan(500);
    expect(results.p95).toBeLessThan(800);
  });

  it('RAG query should meet latency targets', async () => {
    const results = await runBenchmark('rag-query', async () => {
      await server.post('/api/voice-agent/webhook', {
        message: {
          type: 'function-call',
          call: { id: 'test' },
          functionCall: {
            name: 'get_menu',
            parameters: {}
          }
        }
      });
    }, 50); // Fewer iterations for RAG

    console.log('RAG Query Latency:', results);

    expect(results.p50).toBeLessThan(300);
    expect(results.p95).toBeLessThan(500);
  });
});
```

---

## 6. Tests de Seguridad

### 6.1 Security Tests

```typescript
// __tests__/security/voice-agent/security.test.ts

import { describe, it, expect } from 'vitest';
import { createTestServer } from '@/test-utils/server';

describe('Voice Agent Security', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  describe('Authentication', () => {
    it('should reject requests without signature', async () => {
      const response = await server.post('/api/voice-agent/webhook', {
        message: { type: 'assistant-request' }
      }, {
        headers: {} // No signature
      });

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid signature', async () => {
      const response = await server.post('/api/voice-agent/webhook', {
        message: { type: 'assistant-request' }
      }, {
        headers: {
          'x-vapi-signature': 'invalid-signature',
          'x-vapi-timestamp': Date.now().toString()
        }
      });

      expect(response.status).toBe(401);
    });

    it('should reject requests from non-whitelisted IPs', async () => {
      const response = await server.post('/api/voice-agent/webhook', {
        message: { type: 'assistant-request' }
      }, {
        headers: {
          'x-forwarded-for': '192.168.1.1' // Non-VAPI IP
        }
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation', () => {
    it('should reject malformed JSON', async () => {
      const response = await server.postRaw(
        '/api/voice-agent/webhook',
        'not-valid-json',
        { headers: { 'content-type': 'application/json' } }
      );

      expect(response.status).toBe(400);
    });

    it('should reject oversized payloads', async () => {
      const largePayload = { data: 'x'.repeat(10 * 1024 * 1024) }; // 10MB

      const response = await server.post('/api/voice-agent/webhook', largePayload);

      expect(response.status).toBe(413);
    });

    it('should sanitize user input in tool parameters', async () => {
      const response = await server.post('/api/voice-agent/webhook', {
        message: {
          type: 'function-call',
          functionCall: {
            name: 'create_reservation',
            parameters: {
              customer_name: '<script>alert("xss")</script>',
              date: '2024-01-20'
            }
          }
        }
      });

      // Should not contain script tags in response
      expect(response.body).not.toContain('<script>');
    });

    it('should prevent SQL injection in tool parameters', async () => {
      const response = await server.post('/api/voice-agent/webhook', {
        message: {
          type: 'function-call',
          functionCall: {
            name: 'check_availability',
            parameters: {
              date: "2024-01-20'; DROP TABLE reservations; --"
            }
          }
        }
      });

      // Should return error, not execute injection
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make many requests quickly
      const requests = Array(150).fill(null).map(() =>
        server.post('/api/voice-agent/webhook', {
          message: { type: 'assistant-request' }
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Data Protection', () => {
    it('should not expose internal errors', async () => {
      // Force an internal error
      const response = await server.post('/api/voice-agent/webhook', {
        message: {
          type: 'function-call',
          functionCall: {
            name: 'non_existent_tool',
            parameters: {}
          }
        }
      });

      // Should return generic error, not stack trace
      expect(response.body).not.toContain('Error:');
      expect(response.body).not.toContain('at ');
    });

    it('should not log sensitive data', async () => {
      // This would be checked by reviewing logs
      // Placeholder for log audit test
      expect(true).toBe(true);
    });
  });
});
```

---

## 7. QA Manual

### 7.1 Checklist de QA Manual

```markdown
# Checklist QA Manual - Voice Agent v2.0

## Pre-requisitos
- [ ] Ambiente de staging configurado
- [ ] Datos de prueba cargados
- [ ] Acceso a VAPI dashboard
- [ ] Telefono para pruebas

## Wizard de Configuracion

### Paso 1: Seleccion de Tipo
- [ ] Se muestran los 3 tipos correctos (basico/estandar/completo)
- [ ] Badge "Recomendado" visible en tipo estandar
- [ ] Seleccion visual funciona al hacer click
- [ ] Boton "Continuar" deshabilitado sin seleccion
- [ ] Boton "Continuar" habilitado con seleccion

### Paso 2: Seleccion de Voz
- [ ] Se muestran todas las voces disponibles
- [ ] Boton Play reproduce preview de audio
- [ ] Boton Pause detiene el audio
- [ ] Solo un audio reproduce a la vez
- [ ] Slider de velocidad funciona
- [ ] Seleccion visual funciona

### Paso 3: Personalizacion
- [ ] Campo de instrucciones especiales funciona
- [ ] Limite de caracteres se respeta
- [ ] Preview del prompt se actualiza

### Paso 4: Testing
- [ ] Simulador de llamada inicia
- [ ] Mensajes se muestran en tiempo real
- [ ] Escenarios de prueba funcionan
- [ ] Validaciones ejecutan correctamente
- [ ] Latencia se muestra

### Paso 5: Activacion
- [ ] Numero de telefono se provisiona
- [ ] Estado activo se muestra
- [ ] Redireccion a dashboard funciona

## Dashboard de Metricas

### Tarjetas de Resumen
- [ ] Total de llamadas es correcto
- [ ] Tasa de exito es correcta
- [ ] Latencia promedio es correcta
- [ ] Duracion promedio es correcta
- [ ] Cambios porcentuales son correctos

### Graficas
- [ ] Grafica de llamadas muestra datos
- [ ] Grafica de latencia muestra p50/p95
- [ ] Grafica de resultados muestra distribucion
- [ ] Tooltips funcionan al hover
- [ ] Zoom funciona

### Filtros
- [ ] Selector de rango de fechas funciona
- [ ] Datos se actualizan al cambiar filtro
- [ ] "Hoy" muestra datos de hoy
- [ ] "Ultimos 7 dias" funciona correctamente

### Tabla de Llamadas
- [ ] Llamadas recientes se muestran
- [ ] Paginacion funciona
- [ ] Click abre detalles
- [ ] Detalles muestran transcripcion

## Llamadas Reales

### Llamada de Prueba Basica
- [ ] Llamar al numero provisionado
- [ ] Saludo inicial se escucha
- [ ] Respuestas son coherentes
- [ ] Latencia es aceptable (< 1s)
- [ ] Voz es la seleccionada

### Flujo de Reservacion
- [ ] Pedir reservacion funciona
- [ ] Verificacion de disponibilidad funciona
- [ ] Confirmacion se solicita
- [ ] Reservacion se crea en BD
- [ ] Numero de confirmacion se da

### Flujo de Menu/FAQ
- [ ] Preguntar por menu funciona
- [ ] Respuestas de RAG son relevantes
- [ ] Precios se mencionan correctamente

### Manejo de Errores
- [ ] "No entendi" funciona
- [ ] Transferencia a humano funciona
- [ ] Timeout se maneja correctamente

## Seguridad

### Autenticacion
- [ ] Webhooks sin firma son rechazados
- [ ] Webhooks con firma invalida son rechazados
- [ ] IPs no autorizadas son bloqueadas

### Rate Limiting
- [ ] Rate limit se aplica
- [ ] Respuesta 429 se retorna

## Responsive/Mobile

- [ ] Dashboard se ve bien en mobile
- [ ] Wizard funciona en tablet
- [ ] Graficas se adaptan

## Accesibilidad

- [ ] Navegacion por teclado funciona
- [ ] Lectores de pantalla funcionan
- [ ] Contraste es suficiente
```

---

## 8. Metricas de Calidad

### 8.1 KPIs de Testing

| Metrica | Target | Medicion |
|---------|--------|----------|
| Code Coverage | > 80% | Jest/Vitest |
| E2E Pass Rate | 100% | Playwright |
| Performance p95 | < 800ms | k6 |
| Security Issues | 0 Critical | OWASP ZAP |
| Bug Escape Rate | < 5% | Post-release tracking |

### 8.2 CI/CD Pipeline

```yaml
# .github/workflows/test.yml

name: Test Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run OWASP ZAP
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:3000'
```

---

**Documento creado:** Enero 2024
**Ultima actualizacion:** Enero 2024
**Version:** 1.0.0
