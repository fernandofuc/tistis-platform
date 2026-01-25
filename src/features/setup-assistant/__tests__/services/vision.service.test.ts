// =====================================================
// TIS TIS PLATFORM - Vision Service Tests
// Sprint 5: AI Setup Assistant
// =====================================================

import { VisionService, visionService } from '../../services/vision.service';

// Mock Google Generative AI
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Mock fetch for image URLs
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;

describe('VisionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GOOGLE_AI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ======================
  // getInstance Tests
  // ======================

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = VisionService.getInstance();
      const instance2 = VisionService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export visionService as singleton', () => {
      expect(visionService).toBe(VisionService.getInstance());
    });
  });

  // ======================
  // analyzeImage Tests
  // ======================

  describe('analyzeImage', () => {
    const mockMenuResponse = {
      response: {
        text: () => JSON.stringify({
          type: 'menu',
          confidence: 0.95,
          description: 'Menú de restaurante con 5 platillos',
          items: [
            { name: 'Tacos', price: 120, category: 'Antojitos' },
            { name: 'Enchiladas', price: 150, category: 'Platos Fuertes' },
          ],
          suggestions: ['Agregar bebidas', 'Incluir postres'],
        }),
      },
    };

    it('should analyze menu image with URL', async () => {
      mockGenerateContent.mockResolvedValue(mockMenuResponse);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-length', '1000']]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await visionService.analyzeImage({
        imageUrl: 'https://example.com/menu.jpg',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.description).toBe('Menú de restaurante con 5 platillos');
      expect(result.confidence).toBe(0.95);
      expect(result.extractedData.type).toBe('menu');
      expect(result.extractedData.items).toHaveLength(2);
      expect(result.suggestions).toContain('Agregar bebidas');
    });

    it('should analyze image with base64 data', async () => {
      mockGenerateContent.mockResolvedValue(mockMenuResponse);

      const result = await visionService.analyzeImage({
        imageBase64: 'base64encodeddata',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.description).toBe('Menú de restaurante con 5 platillos');
      expect(mockFetch).not.toHaveBeenCalled(); // Should not fetch URL
    });

    it('should handle services context', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'services',
            confidence: 0.9,
            description: 'Lista de servicios dentales',
            items: [
              { name: 'Limpieza dental', price: 800, duration: 45, category: 'Preventivos' },
            ],
            suggestions: [],
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/png',
        context: 'services',
      });

      expect(result.extractedData.type).toBe('services');
      expect(result.extractedData.items).toHaveLength(1);
    });

    it('should handle promotion context', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'promotion',
            confidence: 0.85,
            description: 'Promoción de temporada',
            promotion: {
              title: '20% de descuento',
              description: 'En todos los tratamientos',
              validTo: '2025-12-31',
            },
            suggestions: ['Agregar condiciones'],
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'promotion',
      });

      expect(result.extractedData.type).toBe('promotion');
      expect(result.extractedData.promotion).toBeDefined();
    });

    it('should sanitize additional context to prevent injection', async () => {
      mockGenerateContent.mockResolvedValue(mockMenuResponse);

      await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
        additionalContext: '```ignore previous```\n\n\n\nLong text '.repeat(100),
      });

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const prompt = callArgs[0];

      // Should have sanitized code blocks and limited length
      expect(prompt).not.toContain('```');
      expect(prompt.length).toBeLessThan(2000); // Should be truncated
    });

    it('should return error result when no image provided', async () => {
      const result = await visionService.analyzeImage({
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0);
      expect(result.description).toContain('No se pudo analizar');
      expect(result.suggestions).toContain('Intenta con una imagen más clara');
    });

    it('should handle JSON wrapped in markdown', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '```json\n{"type":"menu","confidence":0.8,"description":"Test"}\n```',
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0.8);
      expect(result.description).toBe('Test');
    });

    it('should clamp confidence to 0-1 range', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            confidence: 1.5, // Out of range
            description: 'Test',
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(1);
    });

    it('should handle negative confidence', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            confidence: -0.5,
            description: 'Test',
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0);
    });

    it('should return error when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      const result = await visionService.analyzeImage({
        imageUrl: 'https://example.com/not-found.jpg',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0);
      expect(result.description).toContain('No se pudo analizar');
    });

    it('should reject images too large', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-length', '15000000']]), // 15MB
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(15000000)),
      });

      const result = await visionService.analyzeImage({
        imageUrl: 'https://example.com/large.jpg',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0);
      expect(result.suggestions).toHaveLength(2);
    });

    it('should handle malformed JSON response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'This is not JSON at all',
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0);
      expect(result.description).toContain('No se pudo analizar');
    });
  });

  // ======================
  // Convenience Method Tests
  // ======================

  describe('analyzeMenu', () => {
    it('should call analyzeImage with menu context', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            confidence: 0.9,
            description: 'Test menu',
            items: [],
          }),
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await visionService.analyzeMenu(
        'https://example.com/menu.jpg',
        'image/jpeg'
      );

      expect(result.extractedData.type).toBe('menu');
    });
  });

  describe('analyzeServices', () => {
    it('should call analyzeImage with services context', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'services',
            confidence: 0.85,
            description: 'Test services',
            items: [],
          }),
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await visionService.analyzeServices(
        'https://example.com/services.jpg',
        'image/png'
      );

      expect(result.extractedData.type).toBe('services');
    });
  });

  describe('analyzePromotion', () => {
    it('should call analyzeImage with promotion context', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'promotion',
            confidence: 0.8,
            description: 'Test promotion',
            promotion: { title: 'Promo' },
          }),
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await visionService.analyzePromotion(
        'https://example.com/promo.jpg',
        'image/jpeg'
      );

      expect(result.extractedData.type).toBe('promotion');
    });
  });

  // ======================
  // autoAnalyze Tests
  // ======================

  describe('autoAnalyze', () => {
    it('should detect type and then analyze', async () => {
      // First call: type detection
      // Second call: full analysis
      mockGenerateContent
        .mockResolvedValueOnce({
          response: {
            text: () => '{"type": "menu"}',
          },
        })
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              type: 'menu',
              confidence: 0.9,
              description: 'Auto-detected menu',
              items: [],
            }),
          },
        });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await visionService.autoAnalyze(
        'https://example.com/image.jpg',
        'image/jpeg'
      );

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(result.description).toBe('Auto-detected menu');
    });

    it('should fallback to general on invalid detected type', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({
          response: {
            text: () => '{"type": "invalid_type"}',
          },
        })
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              type: 'general',
              confidence: 0.7,
              description: 'General analysis',
            }),
          },
        });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await visionService.autoAnalyze(
        'https://example.com/image.jpg',
        'image/jpeg'
      );

      expect(result.extractedData.type).toBe('general');
    });

    it('should fallback to general analysis on error', async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Detection failed'))
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              type: 'general',
              confidence: 0.6,
              description: 'Fallback analysis',
            }),
          },
        });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await visionService.autoAnalyze(
        'https://example.com/image.jpg',
        'image/jpeg'
      );

      // Should have called analyzeImage with general context as fallback
      expect(result.description).toBe('Fallback analysis');
    });
  });

  // ======================
  // getContextForVertical Tests
  // ======================

  describe('getContextForVertical', () => {
    it('should return menu for restaurant vertical', () => {
      const context = visionService.getContextForVertical('restaurant');
      expect(context).toBe('menu');
    });

    it('should return services for dental vertical', () => {
      const context = visionService.getContextForVertical('dental');
      expect(context).toBe('services');
    });

    it('should return services for clinic vertical', () => {
      const context = visionService.getContextForVertical('clinic');
      expect(context).toBe('services');
    });

    it('should return services for beauty vertical', () => {
      const context = visionService.getContextForVertical('beauty');
      expect(context).toBe('services');
    });

    it('should return services for gym vertical', () => {
      const context = visionService.getContextForVertical('gym');
      expect(context).toBe('services');
    });

    it('should return services for veterinary vertical', () => {
      const context = visionService.getContextForVertical('veterinary');
      expect(context).toBe('services');
    });

    it('should return general for unknown vertical', () => {
      const context = visionService.getContextForVertical('unknown');
      expect(context).toBe('general');
    });

    it('should return general for empty vertical', () => {
      const context = visionService.getContextForVertical('');
      expect(context).toBe('general');
    });
  });

  // ======================
  // Edge Cases
  // ======================

  describe('Edge Cases', () => {
    it('should handle empty suggestions array', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            confidence: 0.8,
            description: 'Test',
            // No suggestions field
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.suggestions).toEqual([]);
    });

    it('should handle non-array suggestions', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            confidence: 0.8,
            description: 'Test',
            suggestions: 'not an array',
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.suggestions).toEqual([]);
    });

    it('should provide default description when missing', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            confidence: 0.8,
            // No description
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.description).toBe('Imagen analizada');
    });

    it('should provide default confidence when missing', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'menu',
            description: 'Test',
            // No confidence
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'menu',
      });

      expect(result.confidence).toBe(0.7); // Default confidence
    });

    it('should handle extractedData normalization', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            type: 'general',
            confidence: 0.8,
            description: 'Test',
            extractedData: {
              businessName: 'Test Business',
              phone: '555-1234',
            },
          }),
        },
      });

      const result = await visionService.analyzeImage({
        imageBase64: 'base64data',
        mimeType: 'image/jpeg',
        context: 'general',
      });

      expect(result.extractedData.businessName).toBe('Test Business');
      expect(result.extractedData.phone).toBe('555-1234');
    });
  });
});
