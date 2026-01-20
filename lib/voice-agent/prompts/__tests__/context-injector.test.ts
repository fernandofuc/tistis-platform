/**
 * TIS TIS Platform - Voice Agent v2.0
 * Context Injector Tests
 */

// Using Jest for testing
import {
  DynamicContextInjector,
  createContextInjector,
  generateContextBlock,
  injectContextIntoPrompt,
  DEFAULT_INJECTION_OPTIONS,
} from '../context-injector';
import type {
  BusinessContext,
  VoiceAssistantConfig,
  DynamicContext,
} from '../types';

// =====================================================
// TEST DATA
// =====================================================

const createMockBusinessContext = (
  overrides: Partial<BusinessContext> = {}
): BusinessContext => ({
  tenantId: 'test-business-123',
  businessName: 'Test Restaurant',
  vertical: 'restaurant',
  schedule: {
    days: [
      { dayOfWeek: 0, dayName: 'Domingo', isOpen: false },
      {
        dayOfWeek: 1,
        dayName: 'Lunes',
        isOpen: true,
        openTime: '09:00',
        closeTime: '21:00',
      },
    ],
    timezone: 'America/Mexico_City',
  },
  todaySchedule: {
    dayOfWeek: 1,
    dayName: 'Lunes',
    isOpen: true,
    openTime: '09:00',
    closeTime: '21:00',
  },
  isCurrentlyOpen: true,
  bookingPolicy: {
    minAdvanceHours: 2,
    maxAdvanceDays: 30,
    cancellationPolicy: 'Free cancellation',
    requiresConfirmation: true,
  },
  promotions: [
    {
      id: 'promo1',
      name: '2x1 Drinks',
      description: 'All drinks 2 for 1',
      discountType: 'special',
    },
    {
      id: 'promo2',
      name: '15% Off Dinner',
      description: '15% off after 7pm',
      discountType: 'percentage',
      discountValue: 15,
    },
  ],
  ...overrides,
});

const createMockConfig = (
  overrides: Partial<VoiceAssistantConfig> = {}
): VoiceAssistantConfig => ({
  typeId: 'rest_basic',
  voiceId: 'coral',
  personality: 'friendly',
  enabledCapabilities: ['reservations'],
  availableTools: ['check_availability'],
  locale: 'es-MX',
  maxCallDuration: 300,
  includeFaq: true,
  includePromotions: true,
  includeTransfer: true,
  ...overrides,
});

const createMockDynamicContext = (
  overrides: Partial<DynamicContext> = {}
): DynamicContext => ({
  tenantId: 'test-business-123',
  fetchedAt: new Date(),
  unavailableItems: [],
  activePromotionIds: [],
  todayAnnouncements: [],
  acceptingBookings: true,
  ...overrides,
});

// =====================================================
// DYNAMIC CONTEXT INJECTOR TESTS
// =====================================================

describe('DynamicContextInjector', () => {
  let injector: DynamicContextInjector;

  beforeEach(() => {
    injector = createContextInjector();
  });

  describe('constructor', () => {
    it('should create with default timezone', () => {
      const inj = new DynamicContextInjector();
      expect(inj).toBeInstanceOf(DynamicContextInjector);
    });

    it('should create with custom timezone', () => {
      const inj = new DynamicContextInjector('America/New_York');
      expect(inj).toBeInstanceOf(DynamicContextInjector);
    });
  });

  describe('generateContextBlock', () => {
    it('should generate a context block with default options', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig();

      const result = injector.generateContextBlock(business, config);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.sections).toBeInstanceOf(Array);
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.locale).toBe('es-MX');
    });

    it('should include time context when enabled', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });

      const result = injector.generateContextBlock(business, config, undefined, undefined, {
        includeTimeContext: true,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.sections).toContain('time');
      expect(result.text).toContain('Momento actual');
    });

    it('should include business status when enabled', () => {
      const business = createMockBusinessContext({ isCurrentlyOpen: true });
      const config = createMockConfig({ locale: 'es-MX' });

      const result = injector.generateContextBlock(business, config, undefined, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: true,
        includeWaitTime: false,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.sections).toContain('business_status');
      expect(result.text).toContain('Estado');
    });

    it('should show closed status with next open time', () => {
      const business = createMockBusinessContext({
        isCurrentlyOpen: false,
        nextOpenTime: 'mañana a las 9',
      });
      const config = createMockConfig({ locale: 'es-MX' });

      const result = injector.generateContextBlock(business, config, undefined, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: true,
        includeWaitTime: false,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('Cerrado');
      expect(result.text).toContain('mañana a las 9');
      expect(result.priorityAlerts.length).toBeGreaterThan(0);
    });

    it('should include wait time when provided', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({ waitTimeMinutes: 25 });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: true,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.sections).toContain('wait_time');
      expect(result.text).toContain('Tiempo de espera');
      expect(result.text).toContain('25 minutos');
    });

    it('should alert for high wait times', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({ waitTimeMinutes: 45 });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: true,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('alto');
      expect(result.priorityAlerts.length).toBeGreaterThan(0);
    });

    it('should include unavailable items alerts', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({
        unavailableItems: ['Pasta Carbonara', 'Risotto', 'Tiramisu'],
      });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: true,
        includePromotionalContext: false,
      });

      expect(result.sections).toContain('availability');
      expect(result.text).toContain('No disponible');
      expect(result.text).toContain('Pasta Carbonara');
    });

    it('should truncate long unavailable items list', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({
        unavailableItems: [
          'Item 1',
          'Item 2',
          'Item 3',
          'Item 4',
          'Item 5',
          'Item 6',
          'Item 7',
        ],
      });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: true,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('y 2 más');
    });

    it('should alert when not accepting bookings', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({ acceptingBookings: false });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: true,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('No estamos aceptando');
    });

    it('should include high occupancy alert', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({ occupancyPercent: 90 });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: true,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('Ocupación alta');
      expect(result.text).toContain('90%');
    });

    it('should include promotional context', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });

      const result = injector.generateContextBlock(business, config, undefined, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: false,
        includePromotionalContext: true,
      });

      expect(result.sections).toContain('promotions');
      expect(result.text).toContain('Promociones activas');
      expect(result.text).toContain('2x1 Drinks');
    });

    it('should include custom message from dynamic context', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({
        customMessage: 'Hoy tenemos música en vivo',
      });

      const result = injector.generateContextBlock(business, config, dynamic);

      expect(result.text).toContain('Mensaje especial');
      expect(result.text).toContain('Hoy tenemos música en vivo');
    });

    it('should include today announcements', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'es-MX' });
      const dynamic = createMockDynamicContext({
        todayAnnouncements: ['Happy Hour de 5 a 7pm', 'Chef invitado este viernes'],
      });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: true,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('Happy Hour');
      expect(result.text).toContain('Chef invitado');
    });
  });

  describe('generateContextBlock - English locale', () => {
    it('should generate context in English', () => {
      const business = createMockBusinessContext({ isCurrentlyOpen: true });
      const config = createMockConfig({ locale: 'en-US' });

      const result = injector.generateContextBlock(business, config, undefined, undefined, {
        includeTimeContext: true,
        includeBusinessStatus: true,
        includeWaitTime: false,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('Current time');
      expect(result.text).toContain('Status');
      expect(result.text).toContain('Open');
    });

    it('should show closed status in English', () => {
      const business = createMockBusinessContext({
        isCurrentlyOpen: false,
        nextOpenTime: 'tomorrow at 9am',
      });
      const config = createMockConfig({ locale: 'en-US' });

      const result = injector.generateContextBlock(business, config, undefined, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: true,
        includeWaitTime: false,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('Closed');
      expect(result.text).toContain('Opening');
    });

    it('should format wait time in English', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'en-US' });
      const dynamic = createMockDynamicContext({ waitTimeMinutes: 20 });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: true,
        includeAvailabilityAlerts: false,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('Current wait time');
      expect(result.text).toContain('20 minutes');
    });

    it('should show unavailable items in English', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig({ locale: 'en-US' });
      const dynamic = createMockDynamicContext({
        unavailableItems: ['Carbonara', 'Tiramisu'],
      });

      const result = injector.generateContextBlock(business, config, dynamic, undefined, {
        includeTimeContext: false,
        includeBusinessStatus: false,
        includeWaitTime: false,
        includeAvailabilityAlerts: true,
        includePromotionalContext: false,
      });

      expect(result.text).toContain('Unavailable');
    });
  });

  describe('injectIntoPrompt', () => {
    const samplePrompt = `
# IDENTIDAD

Eres el asistente de Test Restaurant.

---

# CAPACIDADES

Puedes hacer reservaciones.

---

# ESTILO

Sé amable.
`;

    it('should inject at start position', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig();
      const contextBlock = injector.generateContextBlock(business, config);

      const result = injector.injectIntoPrompt(samplePrompt, contextBlock, 'start');

      expect(result.startsWith('---')).toBe(false);
      expect(result.indexOf('CONTEXTO EN TIEMPO REAL')).toBeLessThan(
        result.indexOf('IDENTIDAD')
      );
    });

    it('should inject at end position', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig();
      const contextBlock = injector.generateContextBlock(business, config);

      const result = injector.injectIntoPrompt(samplePrompt, contextBlock, 'end');

      expect(result.indexOf('ESTILO')).toBeLessThan(
        result.indexOf('CONTEXTO EN TIEMPO REAL')
      );
    });

    it('should inject after identity section', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig();
      const contextBlock = injector.generateContextBlock(business, config);

      const result = injector.injectIntoPrompt(
        samplePrompt,
        contextBlock,
        'after-identity'
      );

      const identityPos = result.indexOf('IDENTIDAD');
      const contextPos = result.indexOf('CONTEXTO EN TIEMPO REAL');
      const capabilitiesPos = result.indexOf('CAPACIDADES');

      expect(identityPos).toBeLessThan(contextPos);
      expect(contextPos).toBeLessThan(capabilitiesPos);
    });

    it('should return original prompt if context is empty', () => {
      const emptyContext = {
        text: '',
        sections: [],
        generatedAt: new Date(),
        locale: 'es-MX' as const,
        priorityAlerts: [],
      };

      const result = injector.injectIntoPrompt(samplePrompt, emptyContext);

      expect(result).toBe(samplePrompt);
    });
  });

  describe('generateMinimalUpdate', () => {
    it('should generate minimal update with wait time', () => {
      const dynamic = createMockDynamicContext({ waitTimeMinutes: 15 });

      const result = injector.generateMinimalUpdate(dynamic, 'es-MX');

      expect(result).toContain('Tiempo de espera');
      expect(result).toContain('15 minutos');
    });

    it('should include unavailable items', () => {
      const dynamic = createMockDynamicContext({
        unavailableItems: ['Pasta', 'Pizza'],
      });

      const result = injector.generateMinimalUpdate(dynamic, 'es-MX');

      expect(result).toContain('No disponible');
      expect(result).toContain('Pasta');
    });

    it('should include booking status', () => {
      const dynamic = createMockDynamicContext({ acceptingBookings: false });

      const result = injector.generateMinimalUpdate(dynamic, 'es-MX');

      expect(result).toContain('No aceptamos reservaciones');
    });

    it('should generate minimal update in English', () => {
      const dynamic = createMockDynamicContext({
        waitTimeMinutes: 30,
        unavailableItems: ['Steak'],
        acceptingBookings: false,
      });

      const result = injector.generateMinimalUpdate(dynamic, 'en-US');

      expect(result).toContain('Wait time');
      expect(result).toContain('30 minutes');
      expect(result).toContain('Unavailable');
      expect(result).toContain('Not accepting bookings');
    });

    it('should use pipe separator for multiple items', () => {
      const dynamic = createMockDynamicContext({
        waitTimeMinutes: 10,
        unavailableItems: ['Pasta'],
      });

      const result = injector.generateMinimalUpdate(dynamic, 'es-MX');

      expect(result).toContain(' | ');
    });
  });
});

// =====================================================
// FACTORY FUNCTION TESTS
// =====================================================

describe('Factory Functions', () => {
  describe('createContextInjector', () => {
    it('should create a DynamicContextInjector instance', () => {
      const injector = createContextInjector();
      expect(injector).toBeInstanceOf(DynamicContextInjector);
    });

    it('should accept custom timezone', () => {
      const injector = createContextInjector('America/Los_Angeles');
      expect(injector).toBeInstanceOf(DynamicContextInjector);
    });
  });

  describe('generateContextBlock helper', () => {
    it('should generate context block using factory function', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig();

      const result = generateContextBlock(business, config);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.sections).toBeInstanceOf(Array);
    });
  });

  describe('injectContextIntoPrompt helper', () => {
    it('should inject context using factory function', () => {
      const business = createMockBusinessContext();
      const config = createMockConfig();
      const prompt = '# IDENTIDAD\n\nTest prompt';

      const result = injectContextIntoPrompt(prompt, business, config);

      expect(result).toContain('CONTEXTO EN TIEMPO REAL');
    });
  });
});

// =====================================================
// EDGE CASES
// =====================================================

describe('Edge Cases', () => {
  let injector: DynamicContextInjector;

  beforeEach(() => {
    injector = createContextInjector();
  });

  it('should handle empty promotions list', () => {
    const business = createMockBusinessContext({ promotions: [] });
    const config = createMockConfig({ locale: 'es-MX' });

    const result = injector.generateContextBlock(business, config, undefined, undefined, {
      includeTimeContext: false,
      includeBusinessStatus: false,
      includeWaitTime: false,
      includeAvailabilityAlerts: false,
      includePromotionalContext: true,
    });

    expect(result.sections).not.toContain('promotions');
  });

  it('should handle undefined dynamic context', () => {
    const business = createMockBusinessContext();
    const config = createMockConfig();

    const result = injector.generateContextBlock(business, config, undefined);

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
  });

  it('should handle all options disabled', () => {
    const business = createMockBusinessContext();
    const config = createMockConfig();

    const result = injector.generateContextBlock(business, config, undefined, undefined, {
      includeTimeContext: false,
      includeBusinessStatus: false,
      includeWaitTime: false,
      includeAvailabilityAlerts: false,
      includePromotionalContext: false,
    });

    expect(result.text).toBe('');
    expect(result.sections).toHaveLength(0);
  });

  it('should format hour duration correctly', () => {
    const business = createMockBusinessContext();
    const config = createMockConfig({ locale: 'es-MX' });
    const dynamic = createMockDynamicContext({ waitTimeMinutes: 90 });

    const result = injector.generateContextBlock(business, config, dynamic, undefined, {
      includeTimeContext: false,
      includeBusinessStatus: false,
      includeWaitTime: true,
      includeAvailabilityAlerts: false,
      includePromotionalContext: false,
    });

    expect(result.text).toContain('1 hora y 30 minutos');
  });

  it('should handle 1 minute singular correctly', () => {
    const business = createMockBusinessContext();
    const config = createMockConfig({ locale: 'es-MX' });
    const dynamic = createMockDynamicContext({ waitTimeMinutes: 1 });

    const result = injector.generateContextBlock(business, config, dynamic, undefined, {
      includeTimeContext: false,
      includeBusinessStatus: false,
      includeWaitTime: true,
      includeAvailabilityAlerts: false,
      includePromotionalContext: false,
    });

    expect(result.text).toContain('1 minuto');
  });

  it('should handle 1 hour singular correctly', () => {
    const business = createMockBusinessContext();
    const config = createMockConfig({ locale: 'es-MX' });
    const dynamic = createMockDynamicContext({ waitTimeMinutes: 60 });

    const result = injector.generateContextBlock(business, config, dynamic, undefined, {
      includeTimeContext: false,
      includeBusinessStatus: false,
      includeWaitTime: true,
      includeAvailabilityAlerts: false,
      includePromotionalContext: false,
    });

    expect(result.text).toContain('1 hora');
  });
});
