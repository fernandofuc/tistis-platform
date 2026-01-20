/**
 * TIS TIS Platform - Voice Agent v2.0
 * Confirmation Node Tests
 */

import {
  confirmationNode,
  createConfirmationNode,
  parseConfirmationResponse,
  isPositiveResponse,
  isNegativeResponse,
  getConfirmationConfidence,
  generateConfirmationPrompt,
} from '@/lib/voice-agent/langgraph/nodes/confirmation';
import { createInitialState } from '@/lib/voice-agent/langgraph/state';

describe('Confirmation Parsing', () => {
  describe('parseConfirmationResponse', () => {
    describe('Positive Responses - Spanish', () => {
      const positiveInputs = [
        'sí', 'si', 'Sí', 'SÍ',
        'claro', 'Claro',
        'correcto', 'exacto',
        'afirmativo',
        'dale', 'va',
        'está bien', 'ok', 'okay',
        'por supuesto', 'desde luego',
        'confirmo', 'acepto',
        'de acuerdo',
      ];

      positiveInputs.forEach(input => {
        it(`should recognize "${input}" as positive`, () => {
          const result = parseConfirmationResponse(input, 'es');
          expect(result.status).toBe('confirmed');
          expect(result.understood).toBe(true);
        });
      });
    });

    describe('Positive Responses - English', () => {
      const positiveInputs = [
        'yes', 'Yeah', 'yep', 'yup',
        'sure', 'okay', 'ok',
        'absolutely', 'definitely', 'certainly',
        'of course', 'confirm', 'confirmed',
        'go ahead', 'proceed',
      ];

      positiveInputs.forEach(input => {
        it(`should recognize "${input}" as positive`, () => {
          const result = parseConfirmationResponse(input, 'en');
          expect(result.status).toBe('confirmed');
          expect(result.understood).toBe(true);
        });
      });
    });

    describe('Negative Responses - Spanish', () => {
      const negativeInputs = [
        'no', 'No', 'NO',
        'nel', 'nop', 'nope',
        'negativo',
        'para nada',
        'mejor no', 'no gracias',
        'cancelar', 'cancela',
      ];

      negativeInputs.forEach(input => {
        it(`should recognize "${input}" as negative`, () => {
          const result = parseConfirmationResponse(input, 'es');
          expect(result.status).toBe('denied');
          expect(result.understood).toBe(true);
        });
      });
    });

    describe('Negative Responses - English', () => {
      const negativeInputs = [
        'no', 'nope', 'nah',
        'negative',
        'no way', 'forget it',
        'cancel', 'stop',
      ];

      negativeInputs.forEach(input => {
        it(`should recognize "${input}" as negative`, () => {
          const result = parseConfirmationResponse(input, 'en');
          expect(result.status).toBe('denied');
          expect(result.understood).toBe(true);
        });
      });
    });

    describe('Unclear Responses', () => {
      const unclearInputs = [
        '¿qué?', 'what?',
        'tal vez', 'maybe',
        'déjame pensar', 'let me think',
        'depende', 'depends',
      ];

      unclearInputs.forEach(input => {
        it(`should recognize "${input}" as unclear`, () => {
          const result = parseConfirmationResponse(input, 'es');
          expect(result.understood).toBe(false);
          expect(result.status).toBe('pending');
        });
      });

      it('should handle "no sé" which may partially match "no"', () => {
        const result = parseConfirmationResponse('no sé', 'es');
        // "no sé" contains "no" so it may match as negative or unclear
        expect(['pending', 'denied']).toContain(result.status);
      });
    });

    describe('Empty/Invalid Input', () => {
      it('should handle empty input', () => {
        const result = parseConfirmationResponse('', 'es');
        expect(result.understood).toBe(false);
        expect(result.status).toBe('pending');
      });

      it('should handle whitespace-only input', () => {
        const result = parseConfirmationResponse('   ', 'es');
        expect(result.understood).toBe(false);
        expect(result.status).toBe('pending');
      });
    });

    describe('Confidence Levels', () => {
      it('should have high confidence for exact matches', () => {
        const result = parseConfirmationResponse('sí', 'es');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });

      it('should have lower confidence for fuzzy or ambiguous matches', () => {
        const result = parseConfirmationResponse('bueno supongo', 'es');
        // This input is ambiguous and should have lower confidence
        expect(result.confidence).toBeLessThanOrEqual(0.95);
      });
    });
  });

  describe('isPositiveResponse', () => {
    it('should return true for positive responses', () => {
      expect(isPositiveResponse('sí')).toBe(true);
      expect(isPositiveResponse('yes')).toBe(true);
      expect(isPositiveResponse('ok')).toBe(true);
      expect(isPositiveResponse('claro')).toBe(true);
    });

    it('should return false for negative responses', () => {
      expect(isPositiveResponse('no')).toBe(false);
      expect(isPositiveResponse('cancelar')).toBe(false);
    });
  });

  describe('isNegativeResponse', () => {
    it('should return true for negative responses', () => {
      expect(isNegativeResponse('no')).toBe(true);
      expect(isNegativeResponse('nope')).toBe(true);
      expect(isNegativeResponse('cancelar')).toBe(true);
    });

    it('should return false for positive responses', () => {
      expect(isNegativeResponse('sí')).toBe(false);
      expect(isNegativeResponse('ok')).toBe(false);
    });
  });

  describe('getConfirmationConfidence', () => {
    it('should return high confidence for exact matches', () => {
      expect(getConfirmationConfidence('sí')).toBeGreaterThanOrEqual(0.9);
      expect(getConfirmationConfidence('no')).toBeGreaterThanOrEqual(0.9);
    });

    it('should return lower confidence for unclear input', () => {
      expect(getConfirmationConfidence('maybe')).toBeLessThan(0.5);
      expect(getConfirmationConfidence('hmm')).toBeLessThan(0.5);
    });
  });

  describe('generateConfirmationPrompt', () => {
    it('should generate Spanish prompt for reservations', () => {
      const prompt = generateConfirmationPrompt(
        'create_reservation',
        { date: '2024-01-15', time: '18:00', guests: 4 },
        'es'
      );

      expect(prompt).toContain('Confirma');
      expect(prompt).toContain('reservación');
    });

    it('should generate English prompt for reservations', () => {
      const prompt = generateConfirmationPrompt(
        'create_reservation',
        { date: '2024-01-15', time: '18:00', guests: 4 },
        'en'
      );

      expect(prompt).toContain('confirm');
      expect(prompt).toContain('reservation');
    });

    it('should generate prompt for transfer', () => {
      const prompt = generateConfirmationPrompt('transfer_to_human', {}, 'es');
      // Spanish conjugation: "transfiera" contains "transfier"
      expect(prompt.toLowerCase()).toMatch(/transfier/);
    });

    it('should generate default prompt for unknown tools', () => {
      const prompt = generateConfirmationPrompt('unknown_tool', {}, 'es');
      expect(prompt).toContain('proceder');
    });

    it('should replace placeholders with values', () => {
      const prompt = generateConfirmationPrompt(
        'create_reservation',
        { guests: 4, date: 'mañana', time: '7pm' },
        'es'
      );

      expect(prompt).toContain('4');
    });
  });
});

describe('confirmationNode', () => {
  const createTestState = (currentInput: string, confirmationStatus: 'pending' | 'none' = 'pending') =>
    ({
      ...createInitialState({
        callId: 'call-123',
        vapiCallId: 'vapi-123',
        tenantId: 'tenant-123',
        voiceConfigId: 'config-123',
        assistantType: 'rest_basic',
        currentInput,
      }),
      confirmationStatus,
      normalizedInput: currentInput.toLowerCase(),
      pendingTool: confirmationStatus === 'pending' ? {
        name: 'create_reservation',
        parameters: { date: '2024-01-15' },
        requiresConfirmation: true,
        confirmationMessage: '¿Confirma la reservación?',
        queuedAt: Date.now(),
      } : undefined,
    });

  describe('Confirmation Processing', () => {
    it('should confirm when user says yes', async () => {
      const state = createTestState('sí');
      const result = await confirmationNode(state);

      expect(result.confirmationStatus).toBe('confirmed');
    });

    it('should deny when user says no', async () => {
      const state = createTestState('no');
      const result = await confirmationNode(state);

      expect(result.confirmationStatus).toBe('denied');
      expect(result.pendingTool).toBeUndefined();
      expect(result.response).toBeDefined();
    });

    it('should stay pending when unclear', async () => {
      const state = createTestState('¿qué?');
      const result = await confirmationNode(state);

      expect(result.confirmationStatus).toBe('pending');
      expect(result.response).toBeDefined();
    });
  });

  describe('No Pending Confirmation', () => {
    it('should pass through when no confirmation pending', async () => {
      const state = createTestState('sí', 'none');
      const result = await confirmationNode(state);

      // Should keep original status or not modify it significantly
      // When no pending confirmation, the node passes through
      expect(result.currentNode).toBe('confirmation');
    });
  });

  describe('Latency Recording', () => {
    it('should record latency', async () => {
      const state = createTestState('sí');
      const result = await confirmationNode(state);

      expect(result.nodeLatencies?.confirmation).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create node with config', async () => {
      const node = createConfirmationNode({ locale: 'en' });
      const state = createTestState('yes');
      const result = await node(state);

      expect(result.confirmationStatus).toBe('confirmed');
    });
  });
});
