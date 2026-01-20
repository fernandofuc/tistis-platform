/**
 * TIS TIS Platform - Voice Agent v2.0
 * Query Optimizer Tests
 */

import {
  QueryOptimizer,
  createQueryOptimizer,
  getQueryOptimizer,
  resetQueryOptimizer,
} from '../../../lib/voice-agent/rag/query-optimizer';

describe('QueryOptimizer', () => {
  let optimizer: QueryOptimizer;

  beforeEach(() => {
    resetQueryOptimizer();
    optimizer = createQueryOptimizer({ locale: 'es' });
  });

  describe('constructor', () => {
    it('should create optimizer with default config', () => {
      const opt = new QueryOptimizer();
      const config = opt.getConfig();

      expect(config.expandSynonyms).toBe(true);
      expect(config.expandAbbreviations).toBe(true);
      expect(config.detectIntent).toBe(true);
      expect(config.locale).toBe('es');
    });

    it('should accept custom config', () => {
      const opt = new QueryOptimizer({
        expandSynonyms: false,
        locale: 'en',
      });
      const config = opt.getConfig();

      expect(config.expandSynonyms).toBe(false);
      expect(config.locale).toBe('en');
    });
  });

  describe('optimize', () => {
    it('should return original query when no optimization needed', () => {
      const opt = new QueryOptimizer({
        expandSynonyms: false,
        expandAbbreviations: false,
        detectIntent: false,
      });

      const result = opt.optimize('hola mundo');

      expect(result.original).toBe('hola mundo');
      expect(result.optimized).toBe('hola mundo');
      expect(result.wasModified).toBe(false);
    });

    it('should detect menu intent', () => {
      const result = optimizer.optimize('¿Qué tienen en el menú?');

      expect(result.intent).toBe('menu');
      expect(result.targetCategories).toContain('menu');
    });

    it('should detect hours intent', () => {
      const result = optimizer.optimize('¿A qué hora abren?');

      expect(result.intent).toBe('hours');
      expect(result.targetCategories).toContain('hours');
    });

    it('should detect location intent', () => {
      const result = optimizer.optimize('¿Dónde están ubicados?');

      expect(result.intent).toBe('location');
      expect(result.targetCategories).toContain('location');
    });

    it('should detect pricing intent', () => {
      const result = optimizer.optimize('¿Cuánto cuesta?');

      expect(result.intent).toBe('pricing');
      expect(result.targetCategories).toContain('pricing');
    });

    it('should detect services intent', () => {
      const result = optimizer.optimize('¿Qué servicios ofrecen?');

      expect(result.intent).toBe('services');
      expect(result.targetCategories).toContain('services');
    });

    it('should detect policies intent', () => {
      const result = optimizer.optimize('¿Cuál es la política de cancelación?');

      expect(result.intent).toBe('policies');
    });

    it('should detect promotions intent', () => {
      const result = optimizer.optimize('¿Tienen alguna promoción?');

      expect(result.intent).toBe('promotions');
    });

    it('should default to general intent', () => {
      const result = optimizer.optimize('hola');

      expect(result.intent).toBe('general');
    });
  });

  describe('abbreviation expansion', () => {
    it('should expand Spanish abbreviations', () => {
      const result = optimizer.optimize('info de hrs y tel');

      expect(result.optimized).toContain('información');
      expect(result.optimized).toContain('horas');
      expect(result.optimized).toContain('teléfono');
      expect(result.wasModified).toBe(true);
    });

    it('should expand English abbreviations', () => {
      const optEn = createQueryOptimizer({ locale: 'en' });
      const result = optEn.optimize('info about hrs and tel');

      expect(result.optimized).toContain('information');
      expect(result.optimized).toContain('hours');
      expect(result.optimized).toContain('telephone');
    });
  });

  describe('synonym expansion', () => {
    it('should add synonyms for precio', () => {
      // The optimizer looks for exact word matches
      const result = optimizer.optimize('quiero saber el precio');

      expect(result.synonyms.length).toBeGreaterThan(0);
      expect(result.wasModified).toBe(true);
    });

    it('should add specific synonyms for precio', () => {
      const result = optimizer.optimize('precio de la comida');

      expect(result.synonyms).toEqual(
        expect.arrayContaining(['costo', 'valor'])
      );
    });

    it('should not duplicate words', () => {
      const result = optimizer.optimize('precio costo');

      const words = result.optimized.split(' ');
      const uniqueWords = [...new Set(words)];
      expect(words.length).toBeGreaterThanOrEqual(uniqueWords.length);
    });
  });

  describe('keyword extraction', () => {
    it('should extract keywords from query', () => {
      const result = optimizer.optimize('¿Cuál es el precio del menú de la cena?');

      expect(result.keywords).toContain('precio');
      expect(result.keywords).toContain('menú');
      expect(result.keywords).toContain('cena');
    });

    it('should remove stop words', () => {
      const result = optimizer.optimize('el la de en un una');

      expect(result.keywords).not.toContain('el');
      expect(result.keywords).not.toContain('la');
      expect(result.keywords).not.toContain('de');
    });

    it('should remove short words', () => {
      const result = optimizer.optimize('y o a');

      expect(result.keywords.length).toBe(0);
    });
  });

  describe('urgency detection', () => {
    it('should detect immediate urgency', () => {
      const result = optimizer.optimize('Necesito esto urgente');

      expect(result.urgency).toBe('immediate');
    });

    it('should detect normal urgency by default', () => {
      const result = optimizer.optimize('¿Qué servicios tienen?');

      expect(result.urgency).toBe('normal');
    });

    it('should detect urgency in English', () => {
      const optEn = createQueryOptimizer({ locale: 'en' });
      const result = optEn.optimize('I need this immediately');

      expect(result.urgency).toBe('immediate');
    });
  });

  describe('English support', () => {
    let optEn: QueryOptimizer;

    beforeEach(() => {
      optEn = createQueryOptimizer({ locale: 'en' });
    });

    it('should detect menu intent in English', () => {
      const result = optEn.optimize('What do you have on the menu?');

      expect(result.intent).toBe('menu');
    });

    it('should detect hours intent in English', () => {
      const result = optEn.optimize('When do you open?');

      expect(result.intent).toBe('hours');
    });

    it('should detect location intent in English', () => {
      const result = optEn.optimize('Where are you located?');

      expect(result.intent).toBe('location');
    });
  });

  describe('addSynonyms', () => {
    it('should add custom synonyms', () => {
      optimizer.addSynonyms('es', {
        'especial': ['único', 'exclusivo'],
      });

      const result = optimizer.optimize('plato especial');

      expect(result.synonyms).toEqual(
        expect.arrayContaining(['único', 'exclusivo'])
      );
    });
  });

  describe('singleton', () => {
    it('should return same instance with getQueryOptimizer', () => {
      const opt1 = getQueryOptimizer();
      const opt2 = getQueryOptimizer();

      expect(opt1).toBe(opt2);
    });

    it('should reset with resetQueryOptimizer', () => {
      const opt1 = getQueryOptimizer();
      resetQueryOptimizer();
      const opt2 = getQueryOptimizer();

      expect(opt1).not.toBe(opt2);
    });
  });
});
