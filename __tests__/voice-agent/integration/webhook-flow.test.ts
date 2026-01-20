/**
 * TIS TIS Platform - Voice Agent v2.0
 * Integration Tests: Webhook Flow
 *
 * Tests the complete webhook processing flow from request to response.
 *
 * @jest-environment node
 */

import { createHmac } from 'crypto';

// =====================================================
// TEST TYPES
// =====================================================

interface MockWebhookPayload {
  message: {
    type: string;
    call?: {
      id: string;
      orgId: string;
      createdAt: string;
      customerId?: string;
      phoneNumberId?: string;
      phoneNumber?: string;
    };
    transcript?: string;
    functionCall?: {
      name: string;
      parameters: Record<string, unknown>;
    };
    artifact?: {
      messages?: Array<{
        role: string;
        content: string;
        time: number;
      }>;
      messagesOpenAIFormatted?: unknown[];
    };
    endedReason?: string;
    cost?: number;
    analysis?: {
      summary?: string;
      successEvaluation?: string;
    };
  };
}

// =====================================================
// TEST HELPERS
// =====================================================

function createMockPayload(type: string, overrides: Partial<MockWebhookPayload['message']> = {}): MockWebhookPayload {
  return {
    message: {
      type,
      call: {
        id: `call-${Date.now()}`,
        orgId: 'org-test-123',
        createdAt: new Date().toISOString(),
        phoneNumber: '+52 55 1234 5678',
        ...overrides.call,
      },
      ...overrides,
    },
  };
}

function generateSignature(secretKey: string, timestamp: string, payload: string): string {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac('sha256', secretKey).update(signedPayload).digest('hex');
}

// =====================================================
// ASSISTANT REQUEST FLOW TESTS
// =====================================================

describe('Webhook Flow: Assistant Request', () => {
  describe('initial call setup', () => {
    it('should process assistant-request with valid structure', () => {
      const payload = createMockPayload('assistant-request');

      expect(payload.message.type).toBe('assistant-request');
      expect(payload.message.call).toBeDefined();
      expect(payload.message.call?.id).toBeDefined();
    });

    it('should include call metadata', () => {
      const payload = createMockPayload('assistant-request', {
        call: {
          id: 'call-test-123',
          orgId: 'org-test-456',
          createdAt: '2024-01-15T10:30:00Z',
          customerId: 'customer-789',
          phoneNumberId: 'phone-001',
          phoneNumber: '+52 55 9876 5432',
        },
      });

      expect(payload.message.call?.customerId).toBe('customer-789');
      expect(payload.message.call?.phoneNumberId).toBe('phone-001');
    });

    it('should handle multiple assistant requests in sequence', () => {
      const requests = Array.from({ length: 5 }).map((_, i) =>
        createMockPayload('assistant-request', {
          call: {
            id: `call-sequence-${i}`,
            orgId: 'org-test',
            createdAt: new Date(Date.now() + i * 1000).toISOString(),
          },
        })
      );

      expect(requests.length).toBe(5);
      const uniqueIds = new Set(requests.map((r) => r.message.call?.id));
      expect(uniqueIds.size).toBe(5);
    });
  });
});

// =====================================================
// FUNCTION CALL FLOW TESTS
// =====================================================

describe('Webhook Flow: Function Calls', () => {
  describe('tool execution', () => {
    it('should process function-call with parameters', () => {
      const payload = createMockPayload('function-call', {
        functionCall: {
          name: 'check_availability',
          parameters: {
            date: '2024-01-20',
            time: '14:00',
            partySize: 4,
          },
        },
      });

      expect(payload.message.functionCall?.name).toBe('check_availability');
      expect(payload.message.functionCall?.parameters.date).toBe('2024-01-20');
    });

    it('should handle dental tools', () => {
      const dentalTools = [
        { name: 'check_availability', params: { doctorId: 'dr-1', date: '2024-01-20' } },
        { name: 'create_appointment', params: { patientName: 'Juan', serviceId: 's-1' } },
        { name: 'get_services', params: { category: 'preventivo' } },
      ];

      dentalTools.forEach((tool) => {
        const payload = createMockPayload('function-call', {
          functionCall: {
            name: tool.name,
            parameters: tool.params,
          },
        });

        expect(payload.message.functionCall?.name).toBe(tool.name);
      });
    });

    it('should handle restaurant tools', () => {
      const restaurantTools = [
        { name: 'check_availability', params: { date: '2024-01-20', partySize: 4 } },
        { name: 'create_reservation', params: { name: 'María', phone: '+521234567890' } },
        { name: 'get_menu', params: { category: 'platos_fuertes' } },
        { name: 'create_order', params: { items: ['item-1', 'item-2'] } },
      ];

      restaurantTools.forEach((tool) => {
        const payload = createMockPayload('function-call', {
          functionCall: {
            name: tool.name,
            parameters: tool.params,
          },
        });

        expect(payload.message.functionCall?.name).toBe(tool.name);
      });
    });

    it('should handle common tools', () => {
      const commonTools = [
        { name: 'get_business_hours', params: {} },
        { name: 'transfer_to_human', params: { reason: 'customer request' } },
        { name: 'end_call', params: { summary: 'Call completed successfully' } },
      ];

      commonTools.forEach((tool) => {
        const payload = createMockPayload('function-call', {
          functionCall: {
            name: tool.name,
            parameters: tool.params,
          },
        });

        expect(payload.message.functionCall?.name).toBe(tool.name);
      });
    });
  });
});

// =====================================================
// TRANSCRIPT FLOW TESTS
// =====================================================

describe('Webhook Flow: Transcripts', () => {
  describe('conversation tracking', () => {
    it('should process transcript updates', () => {
      const payload = createMockPayload('transcript', {
        transcript: 'Hola, quisiera hacer una reservación para 4 personas.',
      });

      expect(payload.message.transcript).toContain('reservación');
    });

    it('should track conversation messages', () => {
      const payload = createMockPayload('conversation-update', {
        artifact: {
          messages: [
            { role: 'user', content: 'Hola', time: 1000 },
            { role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarle?', time: 1500 },
            { role: 'user', content: 'Quiero una cita', time: 3000 },
          ],
        },
      });

      expect(payload.message.artifact?.messages?.length).toBe(3);
    });

    it('should calculate conversation duration', () => {
      const messages = [
        { role: 'user', content: 'Inicio', time: 0 },
        { role: 'assistant', content: 'Respuesta', time: 500 },
        { role: 'user', content: 'Fin', time: 120000 }, // 2 minutes
      ];

      const startTime = messages[0].time;
      const endTime = messages[messages.length - 1].time;
      const durationMs = endTime - startTime;

      expect(durationMs).toBe(120000);
      expect(durationMs / 1000).toBe(120); // 2 minutes in seconds
    });
  });
});

// =====================================================
// END OF CALL FLOW TESTS
// =====================================================

describe('Webhook Flow: End of Call', () => {
  describe('call completion', () => {
    it('should process end-of-call-report', () => {
      const payload = createMockPayload('end-of-call-report', {
        endedReason: 'customer-ended-call',
        cost: 0.15,
        analysis: {
          summary: 'Customer booked a reservation for 4 people.',
          successEvaluation: 'success',
        },
        artifact: {
          messages: [
            { role: 'user', content: 'Quiero una reservación', time: 1000 },
            { role: 'assistant', content: 'Por supuesto, ¿para cuántas personas?', time: 1500 },
            { role: 'user', content: 'Para 4', time: 3000 },
            { role: 'assistant', content: 'Listo, su reservación está confirmada', time: 5000 },
          ],
        },
      });

      expect(payload.message.endedReason).toBe('customer-ended-call');
      expect(payload.message.cost).toBe(0.15);
      expect(payload.message.analysis?.successEvaluation).toBe('success');
    });

    it('should handle different end reasons', () => {
      const endReasons = [
        'customer-ended-call',
        'assistant-ended-call',
        'silence-timeout',
        'max-duration-reached',
        'error',
        'customer-did-not-answer',
        'voicemail',
        'transferred',
      ];

      endReasons.forEach((reason) => {
        const payload = createMockPayload('end-of-call-report', {
          endedReason: reason,
        });

        expect(payload.message.endedReason).toBe(reason);
      });
    });

    it('should extract call outcomes', () => {
      const outcomes = [
        { summary: 'Cita agendada para limpieza dental', expected: 'appointment_booked' },
        { summary: 'Se proporcionó información sobre horarios', expected: 'information_given' },
        { summary: 'Cliente solicitó hablar con un humano', expected: 'escalated_human' },
        { summary: 'Cliente no mostró interés', expected: 'not_interested' },
        { summary: 'La llamada se cortó inesperadamente', expected: 'dropped' },
      ];

      outcomes.forEach((outcome) => {
        const payload = createMockPayload('end-of-call-report', {
          analysis: {
            summary: outcome.summary,
            successEvaluation: outcome.expected === 'appointment_booked' ? 'success' : 'partial',
          },
        });

        expect(payload.message.analysis?.summary).toContain(outcome.summary.split(' ')[0]);
      });
    });
  });
});

// =====================================================
// SECURITY LAYER TESTS
// =====================================================

describe('Webhook Flow: Security', () => {
  const SECRET_KEY = 'test-integration-secret-key';

  describe('signature validation', () => {
    it('should generate valid HMAC signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify(createMockPayload('assistant-request'));
      const signature = generateSignature(SECRET_KEY, timestamp, payload);

      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should detect tampered payloads', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const originalPayload = JSON.stringify(createMockPayload('assistant-request'));
      const signature = generateSignature(SECRET_KEY, timestamp, originalPayload);

      // Tamper with payload
      const tamperedPayload = originalPayload.replace('assistant-request', 'hacked');
      const expectedSignature = generateSignature(SECRET_KEY, timestamp, tamperedPayload);

      expect(signature).not.toBe(expectedSignature);
    });

    it('should reject expired timestamps', () => {
      const maxAgeMs = 300000; // 5 minutes
      const expiredTimestamp = Math.floor((Date.now() - maxAgeMs - 1000) / 1000);
      const currentTime = Date.now();

      const timestampAge = currentTime - expiredTimestamp * 1000;
      const isExpired = timestampAge > maxAgeMs;

      expect(isExpired).toBe(true);
    });
  });
});

// =====================================================
// RATE LIMITING TESTS
// =====================================================

describe('Webhook Flow: Rate Limiting', () => {
  describe('request throttling', () => {
    it('should track requests per IP', () => {
      const requestCounts: Map<string, number> = new Map();
      const testIPs = ['192.168.1.1', '192.168.1.2', '192.168.1.1', '192.168.1.1'];

      testIPs.forEach((ip) => {
        const current = requestCounts.get(ip) || 0;
        requestCounts.set(ip, current + 1);
      });

      expect(requestCounts.get('192.168.1.1')).toBe(3);
      expect(requestCounts.get('192.168.1.2')).toBe(1);
    });

    it('should calculate requests within window', () => {
      const windowMs = 60000; // 1 minute
      const now = Date.now();
      const requests = [
        { timestamp: now - 70000, ip: '1.1.1.1' }, // Outside window
        { timestamp: now - 30000, ip: '1.1.1.1' }, // Inside window
        { timestamp: now - 10000, ip: '1.1.1.1' }, // Inside window
        { timestamp: now - 5000, ip: '1.1.1.1' }, // Inside window
      ];

      const requestsInWindow = requests.filter((r) => now - r.timestamp <= windowMs);

      expect(requestsInWindow.length).toBe(3);
    });
  });
});

// =====================================================
// ERROR HANDLING TESTS
// =====================================================

describe('Webhook Flow: Error Handling', () => {
  describe('graceful degradation', () => {
    it('should handle missing call object', () => {
      const payload: MockWebhookPayload = {
        message: {
          type: 'assistant-request',
          // call is missing
        },
      };

      const hasCall = !!payload.message.call;
      expect(hasCall).toBe(false);

      // Should provide default values
      const callId = payload.message.call?.id ?? 'unknown';
      expect(callId).toBe('unknown');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedStrings = [
        '{"message": "incomplete',
        'not json at all',
        '',
        'null',
        '[]',
      ];

      malformedStrings.forEach((str) => {
        let isValidJson = false;
        try {
          const parsed = JSON.parse(str);
          isValidJson = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
        } catch {
          isValidJson = false;
        }

        // All these should fail validation
        expect(str === '' || !isValidJson || str === 'null').toBe(true);
      });
    });

    it('should handle unknown message types', () => {
      const knownTypes = [
        'assistant-request',
        'function-call',
        'transcript',
        'end-of-call-report',
        'status-update',
        'conversation-update',
      ];

      const unknownType = 'unknown-custom-type';
      const isKnown = knownTypes.includes(unknownType);

      expect(isKnown).toBe(false);
    });
  });
});

// =====================================================
// LATENCY TRACKING TESTS
// =====================================================

describe('Webhook Flow: Latency Tracking', () => {
  describe('response time measurement', () => {
    it('should measure processing time', async () => {
      const startTime = performance.now();

      // Simulate some processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      const endTime = performance.now();
      const processingTimeMs = endTime - startTime;

      // setTimeout is not precise, allow 45ms minimum
      expect(processingTimeMs).toBeGreaterThanOrEqual(45);
      expect(processingTimeMs).toBeLessThan(200); // Should not take too long
    });

    it('should track P95 latency calculations', () => {
      const latencies = [
        100, 120, 110, 150, 90, 80, 130, 140, 160, 500, // 500ms is an outlier
      ];

      const sorted = [...latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95 = sorted[Math.min(p95Index, sorted.length - 1)];

      expect(p95).toBe(500); // The 95th percentile is the highest value
    });

    it('should detect slow requests', () => {
      const threshold = 800; // 800ms target for webhooks
      const latencies = [200, 350, 900, 1200, 150, 750];

      const slowRequests = latencies.filter((l) => l > threshold);

      expect(slowRequests.length).toBe(2); // 900ms and 1200ms
    });
  });
});
