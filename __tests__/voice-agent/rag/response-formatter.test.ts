/**
 * TIS TIS Platform - Voice Agent v2.0
 * Response Formatter Tests
 */

import {
  ResponseFormatter,
  createResponseFormatter,
  getResponseFormatter,
  resetResponseFormatter,
  formatMenuForVoice,
  formatHoursForVoice,
  formatLocationForVoice,
} from '../../../lib/voice-agent/rag/response-formatter';
import type { RetrievedDocument } from '../../../lib/voice-agent/rag/types';

describe('ResponseFormatter', () => {
  let formatter: ResponseFormatter;

  beforeEach(() => {
    resetResponseFormatter();
    formatter = createResponseFormatter({ locale: 'es' });
  });

  describe('constructor', () => {
    it('should create formatter with default config', () => {
      const f = new ResponseFormatter();
      const config = f.getConfig();

      expect(config.maxLength).toBe(300);
      expect(config.maxSentences).toBe(3);
      expect(config.locale).toBe('es');
      expect(config.style).toBe('conversational');
    });

    it('should accept custom config', () => {
      const f = new ResponseFormatter({
        maxLength: 500,
        maxSentences: 5,
        locale: 'en',
        style: 'concise',
      });
      const config = f.getConfig();

      expect(config.maxLength).toBe(500);
      expect(config.maxSentences).toBe(5);
      expect(config.locale).toBe('en');
      expect(config.style).toBe('concise');
    });
  });

  describe('format', () => {
    const mockDocuments: RetrievedDocument[] = [
      {
        id: 'doc-1',
        content: 'Nuestro restaurante abre de lunes a viernes de 8am a 10pm. Los fines de semana abrimos de 9am a 11pm.',
        similarity: 0.9,
        category: 'hours',
      },
      {
        id: 'doc-2',
        content: 'También contamos con servicio a domicilio.',
        similarity: 0.8,
        category: 'services',
      },
    ];

    it('should format documents into response', () => {
      const result = formatter.format(mockDocuments, 'hours');

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.sources).toEqual(['doc-1', 'doc-2']);
    });

    it('should return no results response for empty documents', () => {
      const result = formatter.format([], 'hours');

      expect(result.confidence).toBe('low');
      expect(result.text).toContain('información');
    });

    it('should truncate long responses', () => {
      const longDoc: RetrievedDocument = {
        id: 'long-doc',
        content: 'Lorem ipsum '.repeat(100),
        similarity: 0.9,
      };

      const result = formatter.format([longDoc]);

      expect(result.wasTruncated).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(350); // maxLength + buffer for ellipsis
    });

    it('should determine confidence from similarity scores', () => {
      const highConfidenceDocs: RetrievedDocument[] = [
        { id: '1', content: 'High confidence content.', similarity: 0.95 },
      ];

      const lowConfidenceDocs: RetrievedDocument[] = [
        { id: '2', content: 'Low confidence content.', similarity: 0.65 },
      ];

      const highResult = formatter.format(highConfidenceDocs);
      const lowResult = formatter.format(lowConfidenceDocs);

      expect(highResult.confidence).toBe('high');
      expect(lowResult.confidence).toBe('low');
    });

    it('should create summary', () => {
      const result = formatter.format(mockDocuments);

      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeLessThanOrEqual(100);
    });
  });

  describe('formatSingle', () => {
    it('should format single document', () => {
      const doc: RetrievedDocument = {
        id: 'doc-1',
        content: 'Abrimos de 9 a 6.',
        similarity: 0.9,
      };

      const result = formatter.formatSingle(doc);

      expect(result.sources).toEqual(['doc-1']);
    });
  });

  describe('style application', () => {
    it('should apply conversational style', () => {
      const convFormatter = createResponseFormatter({ style: 'conversational' });
      const doc: RetrievedDocument = {
        id: '1',
        content: 'Abrimos de 9 a 6.',
        similarity: 0.9,
      };

      // Conversational style might add filler phrases
      const result = convFormatter.format([doc]);

      expect(result.text).toBeDefined();
    });

    it('should apply concise style without modifications', () => {
      const conciseFormatter = createResponseFormatter({ style: 'concise' });
      const doc: RetrievedDocument = {
        id: '1',
        content: 'Abrimos de 9 a 6.',
        similarity: 0.9,
      };

      const result = conciseFormatter.format([doc]);

      expect(result.text).toBeDefined();
    });
  });

  describe('technical term simplification', () => {
    it('should simplify dental terms', () => {
      const doc: RetrievedDocument = {
        id: '1',
        content: 'Ofrecemos profilaxis y endodoncia.',
        similarity: 0.9,
      };

      const result = formatter.format([doc]);

      expect(result.text).toContain('limpieza dental');
      expect(result.text).toContain('tratamiento de conducto');
    });

    it('should not simplify when disabled', () => {
      const noSimplify = createResponseFormatter({ simplifyTerms: false });
      const doc: RetrievedDocument = {
        id: '1',
        content: 'Ofrecemos profilaxis.',
        similarity: 0.9,
      };

      const result = noSimplify.format([doc]);

      expect(result.text).toContain('profilaxis');
    });
  });

  describe('sentence selection', () => {
    it('should limit sentences to maxSentences', () => {
      const doc: RetrievedDocument = {
        id: '1',
        content: 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.',
        similarity: 0.9,
      };

      const result = formatter.format([doc]);

      const sentenceCount = (result.text.match(/\./g) || []).length;
      expect(sentenceCount).toBeLessThanOrEqual(4); // 3 + possible ellipsis
    });

    it('should prioritize sentences with numbers for pricing intent', () => {
      const doc: RetrievedDocument = {
        id: '1',
        content: 'Tenemos varios platillos. El precio es de 150 pesos. Estamos ubicados en el centro.',
        similarity: 0.9,
      };

      const result = formatter.format([doc], 'pricing');

      expect(result.text).toContain('150');
    });
  });

  describe('English support', () => {
    let enFormatter: ResponseFormatter;

    beforeEach(() => {
      enFormatter = createResponseFormatter({ locale: 'en' });
    });

    it('should format in English', () => {
      const result = enFormatter.format([], 'hours');

      expect(result.text).toContain('information');
    });
  });

  describe('singleton', () => {
    it('should return same instance with getResponseFormatter', () => {
      const f1 = getResponseFormatter();
      const f2 = getResponseFormatter();

      expect(f1).toBe(f2);
    });

    it('should reset with resetResponseFormatter', () => {
      const f1 = getResponseFormatter();
      resetResponseFormatter();
      const f2 = getResponseFormatter();

      expect(f1).not.toBe(f2);
    });
  });
});

describe('Specialized formatters', () => {
  describe('formatMenuForVoice', () => {
    it('should format menu items in Spanish', () => {
      const items = [
        { name: 'Tacos', price: 50 },
        { name: 'Burritos', price: 80 },
      ];

      const result = formatMenuForVoice(items, 'es');

      expect(result).toContain('Tacos');
      expect(result).toContain('50 pesos');
    });

    it('should format menu items in English', () => {
      const items = [
        { name: 'Tacos', price: 50 },
        { name: 'Burritos', price: 80 },
      ];

      const result = formatMenuForVoice(items, 'en');

      expect(result).toContain('for 50 pesos');
    });

    it('should limit items and show remaining count', () => {
      const items = [
        { name: 'Item1' },
        { name: 'Item2' },
        { name: 'Item3' },
        { name: 'Item4' },
        { name: 'Item5' },
      ];

      const result = formatMenuForVoice(items, 'es', 3);

      expect(result).toContain('2 opciones más');
    });

    it('should handle empty items', () => {
      const result = formatMenuForVoice([], 'es');

      expect(result).toContain('No encontré');
    });
  });

  describe('formatHoursForVoice', () => {
    it('should format hours in Spanish', () => {
      const hours = { open: '9:00', close: '18:00' };

      const result = formatHoursForVoice(hours, 'es');

      expect(result).toContain('Abrimos');
      expect(result).toContain('9:00');
      expect(result).toContain('18:00');
    });

    it('should format hours in English', () => {
      const hours = { open: '9:00', close: '18:00' };

      const result = formatHoursForVoice(hours, 'en');

      expect(result).toContain("We're open");
    });

    it('should include day if provided', () => {
      const hours = { open: '9:00', close: '18:00', day: 'lunes' };

      const result = formatHoursForVoice(hours, 'es');

      expect(result).toContain('lunes');
    });
  });

  describe('formatLocationForVoice', () => {
    it('should format location in Spanish', () => {
      const location = { address: 'Calle Principal 123' };

      const result = formatLocationForVoice(location, 'es');

      expect(result).toContain('Estamos ubicados');
      expect(result).toContain('Calle Principal 123');
    });

    it('should format location in English', () => {
      const location = { address: 'Main Street 123' };

      const result = formatLocationForVoice(location, 'en');

      expect(result).toContain("We're located");
    });

    it('should include reference', () => {
      const location = {
        address: 'Calle Principal 123',
        reference: 'Frente al parque',
      };

      const result = formatLocationForVoice(location, 'es');

      expect(result).toContain('Frente al parque');
    });

    it('should include parking info', () => {
      const location = {
        address: 'Calle Principal 123',
        parking: 'Estacionamiento gratuito disponible',
      };

      const result = formatLocationForVoice(location, 'es');

      expect(result).toContain('estacionamiento');
    });
  });
});
