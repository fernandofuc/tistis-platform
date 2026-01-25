// =====================================================
// TIS TIS PLATFORM - Setup Assistant Service Tests
// Sprint 5: AI Setup Assistant
// Migrated to Vitest
// =====================================================

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  SetupAssistantService,
  setupAssistantService,
  ProcessMessageInput,
} from '../../services/setup-assistant.service';

// Mock the graph
vi.mock('../../graph', () => ({
  setupAssistantGraph: {
    invoke: vi.fn(),
  },
}));

// Import after mock
import { setupAssistantGraph } from '../../graph';

describe('SetupAssistantService', () => {
  const mockInvoke = setupAssistantGraph.invoke as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================
  // getInstance Tests
  // ======================

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = SetupAssistantService.getInstance();
      const instance2 = SetupAssistantService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export setupAssistantService as singleton', () => {
      expect(setupAssistantService).toBe(SetupAssistantService.getInstance());
    });
  });

  // ======================
  // processMessage Tests
  // ======================

  describe('processMessage', () => {
    const createMockInput = (overrides: Partial<ProcessMessageInput> = {}): ProcessMessageInput => ({
      conversationId: 'conv-123',
      context: {
        tenantId: 'tenant-123',
        userId: 'user-123',
        vertical: 'dental',
        tenantConfig: {
          name: 'Test Clinic',
          timezone: 'America/Mexico_City',
          businessHours: {},
          policies: {},
        },
        loyaltyConfigured: false,
        agentsConfigured: false,
        knowledgeBaseConfigured: false,
        servicesConfigured: false,
        promotionsConfigured: false,
        existingServices: [],
        existingFaqs: [],
        existingLoyaltyProgram: null,
      },
      messages: [],
      currentMessage: 'Test message',
      ...overrides,
    });

    it('should process message successfully', async () => {
      mockInvoke.mockResolvedValue({
        response: 'Hello! How can I help you?',
        executedActions: [],
        inputTokens: 100,
        outputTokens: 50,
        errors: [],
      });

      const result = await setupAssistantService.processMessage(createMockInput());

      expect(result.response).toBe('Hello! How can I help you?');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle executed actions', async () => {
      const mockActions = [
        {
          type: 'create' as const,
          module: 'services' as const,
          entityType: 'service',
          entityId: 'service-123',
          status: 'success' as const,
          details: { name: 'Test Service' },
        },
      ];

      mockInvoke.mockResolvedValue({
        response: 'Service created!',
        executedActions: mockActions,
        inputTokens: 150,
        outputTokens: 75,
        errors: [],
      });

      const result = await setupAssistantService.processMessage(createMockInput({
        currentMessage: 'Create a cleaning service for $800',
      }));

      expect(result.executedActions).toHaveLength(1);
      expect(result.executedActions[0].type).toBe('create');
      expect(result.executedActions[0].module).toBe('services');
    });

    it('should include conversation history', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi! How can I help?' },
      ];

      mockInvoke.mockResolvedValue({
        response: 'Sure, I can help with that.',
        executedActions: [],
        inputTokens: 200,
        outputTokens: 60,
        errors: [],
      });

      const result = await setupAssistantService.processMessage(createMockInput({
        messages,
        currentMessage: 'Can you help me set up services?',
      }));

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(result.response).toBe('Sure, I can help with that.');
    });

    it('should handle attachments', async () => {
      mockInvoke.mockResolvedValue({
        response: 'I see the image you uploaded.',
        executedActions: [],
        inputTokens: 250,
        outputTokens: 80,
        errors: [],
      });

      const result = await setupAssistantService.processMessage(createMockInput({
        attachments: ['https://example.com/image.jpg'],
        currentMessage: 'This is my menu',
      }));

      expect(result.response).toContain('image');
    });

    it('should handle vision analysis', async () => {
      const visionAnalysis = {
        description: 'Menu with 5 items',
        extractedData: {
          type: 'menu',
          items: [
            { name: 'Tacos', price: 120 },
            { name: 'Enchiladas', price: 150 },
          ],
        },
        confidence: 0.9,
        suggestions: ['Add more details'],
      };

      mockInvoke.mockResolvedValue({
        response: 'I found 2 items in your menu.',
        executedActions: [
          { type: 'create', module: 'services', entityType: 'service', status: 'success' },
          { type: 'create', module: 'services', entityType: 'service', status: 'success' },
        ],
        inputTokens: 300,
        outputTokens: 100,
        errors: [],
      });

      const result = await setupAssistantService.processMessage(createMockInput({
        visionAnalysis,
        currentMessage: 'Add these items from my menu',
      }));

      expect(result.executedActions).toHaveLength(2);
    });

    it('should handle graph errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('LangGraph processing failed'));

      const result = await setupAssistantService.processMessage(createMockInput());

      expect(result.response).toContain('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('LangGraph processing failed');
      expect(result.executedActions).toHaveLength(0);
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });

    it('should handle non-Error exceptions', async () => {
      mockInvoke.mockRejectedValue('String error');

      const result = await setupAssistantService.processMessage(createMockInput());

      expect(result.errors[0]).toBe('Unknown error');
    });

    it('should provide default response when none returned', async () => {
      mockInvoke.mockResolvedValue({
        response: null,
        executedActions: null,
        inputTokens: null,
        outputTokens: null,
        errors: null,
      });

      const result = await setupAssistantService.processMessage(createMockInput());

      expect(result.response).toBe('Lo siento, no pude procesar tu mensaje.');
      expect(result.executedActions).toEqual([]);
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should work with different verticals', async () => {
      const verticals = ['dental', 'restaurant', 'clinic', 'beauty', 'veterinary', 'gym'] as const;

      mockInvoke.mockResolvedValue({
        response: 'Configured for your business type',
        executedActions: [],
        inputTokens: 100,
        outputTokens: 50,
        errors: [],
      });

      for (const vertical of verticals) {
        const input = createMockInput({
          context: {
            tenantId: 'tenant-123',
            userId: 'user-123',
            vertical,
            tenantConfig: {
              name: 'Test Business',
              timezone: 'America/Mexico_City',
              businessHours: {},
              policies: {},
            },
            loyaltyConfigured: false,
            agentsConfigured: false,
            knowledgeBaseConfigured: false,
            servicesConfigured: false,
            promotionsConfigured: false,
            existingServices: [],
            existingFaqs: [],
            existingLoyaltyProgram: null,
          },
        });

        const result = await setupAssistantService.processMessage(input);
        expect(result.response).toBeDefined();
      }
    });

    it('should handle complex context with existing data', async () => {
      mockInvoke.mockResolvedValue({
        response: 'I see you already have some services configured.',
        executedActions: [],
        inputTokens: 150,
        outputTokens: 60,
        errors: [],
      });

      const result = await setupAssistantService.processMessage(createMockInput({
        context: {
          tenantId: 'tenant-123',
          userId: 'user-123',
          vertical: 'dental',
          tenantConfig: {
            name: 'Complete Dental',
            timezone: 'America/Mexico_City',
            businessHours: { monday: { open: '09:00', close: '18:00' } },
            policies: { cancellation: '24 hours notice required' },
          },
          loyaltyConfigured: true,
          agentsConfigured: true,
          knowledgeBaseConfigured: true,
          servicesConfigured: true,
          promotionsConfigured: true,
          existingServices: [
            { id: 'svc-1', name: 'Cleaning', price: 800 },
            { id: 'svc-2', name: 'Filling', price: 1500 },
          ],
          existingFaqs: [
            { id: 'faq-1', question: 'What are your hours?' },
          ],
          existingLoyaltyProgram: { id: 'loy-1', name: 'Dental Points' },
        },
      }));

      expect(result.response).toContain('services');
    });
  });
});
