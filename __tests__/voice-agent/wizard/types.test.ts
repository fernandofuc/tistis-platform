/**
 * TIS TIS Platform - Voice Agent Wizard Tests
 * Type Definitions and Validation Tests
 */

import {
  WIZARD_STEPS,
  DEFAULT_WIZARD_CONFIG,
  validateStep,
  canNavigateToStep,
  isLegacyWizardProps,
  convertLegacyProps,
} from '@/components/voice-agent/wizard/types';
import type {
  WizardConfigData,
  WizardStepId,
  LegacyWizardProps,
  VoiceAgentWizardProps,
} from '@/components/voice-agent/wizard/types';
import type { VoiceAgentConfig } from '@/src/features/voice-agent/types';

// =====================================================
// WIZARD STEPS TESTS
// =====================================================

describe('WIZARD_STEPS', () => {
  it('should have exactly 5 steps', () => {
    expect(WIZARD_STEPS).toHaveLength(5);
  });

  it('should have steps in correct order', () => {
    const stepIds = WIZARD_STEPS.map((s) => s.id);
    expect(stepIds).toEqual(['type', 'voice', 'customize', 'test', 'activate']);
  });

  it('each step should have required fields', () => {
    WIZARD_STEPS.forEach((step) => {
      expect(step.id).toBeDefined();
      expect(step.title).toBeDefined();
      expect(step.description).toBeDefined();
      expect(typeof step.title).toBe('string');
      expect(typeof step.description).toBe('string');
    });
  });
});

// =====================================================
// DEFAULT CONFIG TESTS
// =====================================================

describe('DEFAULT_WIZARD_CONFIG', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_WIZARD_CONFIG).toMatchObject({
      assistantType: null,
      voiceId: null,
      voiceSpeed: 1.0,
      assistantName: '',
      firstMessage: '',
      personality: 'professional_friendly',
      customInstructions: '',
      enabledCapabilities: [],
      areaCode: null,
      hasBeenTested: false,
    });
  });

  it('should have empty strings for text fields', () => {
    expect(DEFAULT_WIZARD_CONFIG.assistantName).toBe('');
    expect(DEFAULT_WIZARD_CONFIG.firstMessage).toBe('');
    expect(DEFAULT_WIZARD_CONFIG.customInstructions).toBe('');
  });

  it('should have default voice speed of 1.0', () => {
    expect(DEFAULT_WIZARD_CONFIG.voiceSpeed).toBe(1.0);
  });
});

// =====================================================
// VALIDATE STEP TESTS
// =====================================================

describe('validateStep', () => {
  const baseConfig: WizardConfigData = {
    ...DEFAULT_WIZARD_CONFIG,
  };

  describe('type step', () => {
    it('should fail when no assistant type selected', () => {
      const result = validateStep('type', { ...baseConfig, assistantType: null }, 'dental');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Selecciona un tipo de asistente');
    });

    it('should pass when assistant type is selected', () => {
      const result = validateStep('type', { ...baseConfig, assistantType: 'dental_standard' }, 'dental');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('voice step', () => {
    it('should fail when no voice selected', () => {
      const result = validateStep('voice', { ...baseConfig, voiceId: null }, 'dental');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Selecciona una voz para tu asistente');
    });

    it('should pass when voice is selected', () => {
      const result = validateStep('voice', { ...baseConfig, voiceId: 'voice_123' }, 'dental');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('customize step', () => {
    it('should fail when assistant name is empty', () => {
      const result = validateStep('customize', { ...baseConfig, assistantName: '' }, 'dental');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El nombre del asistente es requerido');
    });

    it('should fail when assistant name is too short', () => {
      const result = validateStep('customize', { ...baseConfig, assistantName: 'A' }, 'dental');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El nombre debe tener al menos 2 caracteres');
    });

    it('should fail when assistant name is too long', () => {
      const result = validateStep('customize', { ...baseConfig, assistantName: 'A'.repeat(25) }, 'dental');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El nombre no puede exceder 20 caracteres');
    });

    it('should fail when first message is empty', () => {
      const result = validateStep('customize', { ...baseConfig, assistantName: 'Ana', firstMessage: '' }, 'dental');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El mensaje de bienvenida es requerido');
    });

    it('should fail when first message is too long', () => {
      const result = validateStep(
        'customize',
        { ...baseConfig, assistantName: 'Ana', firstMessage: 'A'.repeat(600) },
        'dental'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El mensaje de bienvenida no puede exceder 500 caracteres');
    });

    it('should warn when first message is too short but still valid', () => {
      const result = validateStep(
        'customize',
        { ...baseConfig, assistantName: 'Ana', firstMessage: 'Hola, bienvenido!' },
        'dental'
      );
      // Short message produces a warning but is still technically valid
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('El mensaje de bienvenida es muy corto');
    });

    it('should pass with valid name and message', () => {
      const result = validateStep(
        'customize',
        {
          ...baseConfig,
          assistantName: 'Ana',
          firstMessage: 'Hola, soy Ana de la Clínica Dental. ¿En qué puedo ayudarte hoy?',
        },
        'dental'
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('test step', () => {
    it('should always be valid (optional)', () => {
      const result = validateStep('test', baseConfig, 'dental');
      expect(result.isValid).toBe(true);
    });

    it('should warn if not tested', () => {
      const result = validateStep('test', { ...baseConfig, hasBeenTested: false }, 'dental');
      expect(result.warnings).toContain('Te recomendamos probar tu asistente antes de activarlo');
    });
  });

  describe('activate step', () => {
    it('should fail when no area code selected', () => {
      const result = validateStep('activate', { ...baseConfig, areaCode: null }, 'dental');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Selecciona una lada para tu número de teléfono');
    });

    it('should pass when area code is selected', () => {
      const result = validateStep('activate', { ...baseConfig, areaCode: '55' }, 'dental');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// =====================================================
// CAN NAVIGATE TO STEP TESTS
// =====================================================

describe('canNavigateToStep', () => {
  const validConfig: WizardConfigData = {
    ...DEFAULT_WIZARD_CONFIG,
    assistantType: 'dental_standard',
    voiceId: 'voice_123',
    assistantName: 'Ana',
    firstMessage: 'Hola, soy Ana de la Clínica Dental. ¿En qué puedo ayudarte hoy?',
  };

  it('should always allow going back', () => {
    expect(canNavigateToStep(0, 3, DEFAULT_WIZARD_CONFIG, 'dental')).toBe(true);
    expect(canNavigateToStep(1, 4, DEFAULT_WIZARD_CONFIG, 'dental')).toBe(true);
  });

  it('should not allow skipping steps with invalid data', () => {
    expect(canNavigateToStep(2, 0, DEFAULT_WIZARD_CONFIG, 'dental')).toBe(false);
    expect(canNavigateToStep(3, 0, DEFAULT_WIZARD_CONFIG, 'dental')).toBe(false);
  });

  it('should allow navigating forward with valid data', () => {
    expect(canNavigateToStep(1, 0, { ...validConfig }, 'dental')).toBe(true);
    expect(canNavigateToStep(2, 1, { ...validConfig }, 'dental')).toBe(true);
    expect(canNavigateToStep(3, 2, { ...validConfig }, 'dental')).toBe(true);
  });

  it('should allow skipping test step', () => {
    // Should be able to go from customize (2) to activate (4)
    expect(canNavigateToStep(4, 3, { ...validConfig }, 'dental')).toBe(true);
  });
});

// =====================================================
// LEGACY PROPS TESTS
// =====================================================

describe('isLegacyWizardProps', () => {
  const legacyProps: LegacyWizardProps = {
    config: null,
    vertical: 'dental',
    accessToken: 'token123',
    onSaveConfig: async () => true,
    onRequestPhoneNumber: async () => true,
    onComplete: () => {},
    onClose: () => {},
  };

  const newProps: VoiceAgentWizardProps = {
    businessId: 'business_123',
    vertical: 'dental',
    existingConfig: null,
    accessToken: 'token123',
    onComplete: () => {},
    onClose: () => {},
    onSaveConfig: async () => true,
    onRequestPhoneNumber: async () => true,
  };

  it('should identify legacy props correctly', () => {
    expect(isLegacyWizardProps(legacyProps)).toBe(true);
  });

  it('should identify new props correctly', () => {
    expect(isLegacyWizardProps(newProps)).toBe(false);
  });
});

describe('convertLegacyProps', () => {
  // Use partial mock with type assertion for testing purposes
  const mockConfig = {
    id: 'config_123',
    tenant_id: 'tenant_123',
    voice_id: 'voice_456',
    assistant_name: 'Ana',
    first_message: 'Hola',
    voice_enabled: true,
    voice_status: 'active',
    assistant_personality: 'professional_friendly',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as VoiceAgentConfig;

  const legacyProps: LegacyWizardProps = {
    config: mockConfig,
    vertical: 'dental',
    accessToken: 'token123',
    onSaveConfig: async () => true,
    onRequestPhoneNumber: async () => true,
    onComplete: () => {},
    onClose: () => {},
  };

  it('should convert config to existingConfig', () => {
    const converted = convertLegacyProps(legacyProps);
    expect(converted.existingConfig).toBe(legacyProps.config);
  });

  it('should map vertical correctly', () => {
    const dentalConverted = convertLegacyProps({ ...legacyProps, vertical: 'dental' });
    expect(dentalConverted.vertical).toBe('dental');

    const restaurantConverted = convertLegacyProps({ ...legacyProps, vertical: 'restaurant' });
    expect(restaurantConverted.vertical).toBe('restaurant');

    // Medical and general should map to dental
    const medicalConverted = convertLegacyProps({ ...legacyProps, vertical: 'medical' });
    expect(medicalConverted.vertical).toBe('dental');

    const generalConverted = convertLegacyProps({ ...legacyProps, vertical: 'general' });
    expect(generalConverted.vertical).toBe('dental');
  });

  it('should preserve callback functions', () => {
    const converted = convertLegacyProps(legacyProps);
    expect(converted.onComplete).toBe(legacyProps.onComplete);
    expect(converted.onClose).toBe(legacyProps.onClose);
    expect(converted.onSaveConfig).toBe(legacyProps.onSaveConfig);
    expect(converted.onRequestPhoneNumber).toBe(legacyProps.onRequestPhoneNumber);
  });

  it('should preserve accessToken', () => {
    const converted = convertLegacyProps(legacyProps);
    expect(converted.accessToken).toBe(legacyProps.accessToken);
  });

  it('should set empty businessId (to be fetched from session)', () => {
    const converted = convertLegacyProps(legacyProps);
    expect(converted.businessId).toBe('');
  });
});
