/**
 * TIS TIS Platform - Voice Agent v2.0
 * Assistant Type Manager Tests
 *
 * Tests for:
 * - Type retrieval (by ID, vertical, etc.)
 * - Capability and tool queries
 * - Configuration validation
 * - UI helpers
 * - Cache behavior
 */

import {
  AssistantTypeManager,
  createLocalAssistantTypeManager,
  REST_BASIC,
  REST_STANDARD,
  REST_COMPLETE,
  DENTAL_BASIC,
  DENTAL_STANDARD,
  DENTAL_COMPLETE,
  ASSISTANT_TYPES,
  ASSISTANT_TYPE_IDS,
  RESTAURANT_CAPABILITIES,
  DENTAL_CAPABILITIES,
  RESTAURANT_TOOLS,
  DENTAL_TOOLS,
  getCapabilitiesForTypeId,
  getToolsForTypeId,
  getVerticalFromTypeId,
  getLevelFromTypeId,
  isValidAssistantTypeId,
  isValidVertical,
  isValidPersonalityType,
  isValidCapability,
  isValidTool,
  isValidAssistantTypeLevel,
  ALL_CAPABILITIES,
  ALL_TOOLS,
  rowToAssistantType,
  type AssistantTypeId,
  type AssistantTypeRow,
  type Capability,
  type Tool,
} from '../../../lib/voice-agent/types';

// =====================================================
// TEST SETUP
// =====================================================

describe('AssistantTypeManager', () => {
  let manager: AssistantTypeManager;

  beforeEach(() => {
    manager = createLocalAssistantTypeManager();
  });

  afterEach(() => {
    manager.stop();
  });

  // =====================================================
  // TYPE RETRIEVAL TESTS
  // =====================================================

  describe('Type Retrieval', () => {
    describe('getAvailableTypes', () => {
      it('should return all 6 types when no vertical specified', () => {
        const types = manager.getAvailableTypes();

        expect(types).toHaveLength(6);
        expect(types.map((t) => t.id)).toEqual(
          expect.arrayContaining(ASSISTANT_TYPE_IDS)
        );
      });

      it('should return only restaurant types when vertical is restaurant', () => {
        const types = manager.getAvailableTypes('restaurant');

        expect(types).toHaveLength(3);
        expect(types.every((t) => t.vertical === 'restaurant')).toBe(true);
        expect(types.map((t) => t.id)).toEqual([
          'rest_basic',
          'rest_standard',
          'rest_complete',
        ]);
      });

      it('should return only dental types when vertical is dental', () => {
        const types = manager.getAvailableTypes('dental');

        expect(types).toHaveLength(3);
        expect(types.every((t) => t.vertical === 'dental')).toBe(true);
        expect(types.map((t) => t.id)).toEqual([
          'dental_basic',
          'dental_standard',
          'dental_complete',
        ]);
      });
    });

    describe('getTypeById', () => {
      it('should return correct type for valid ID', () => {
        const type = manager.getTypeById('rest_standard');

        expect(type).not.toBeNull();
        expect(type?.id).toBe('rest_standard');
        expect(type?.vertical).toBe('restaurant');
        expect(type?.level).toBe('standard');
      });

      it('should return null for invalid ID', () => {
        const type = manager.getTypeById('invalid_type');

        expect(type).toBeNull();
      });

      it('should return null for empty string', () => {
        const type = manager.getTypeById('');

        expect(type).toBeNull();
      });

      it('should find all 6 types by ID', () => {
        for (const typeId of ASSISTANT_TYPE_IDS) {
          const type = manager.getTypeById(typeId);
          expect(type).not.toBeNull();
          expect(type?.id).toBe(typeId);
        }
      });
    });

    describe('getRecommendedType', () => {
      it('should return rest_standard for restaurant vertical', () => {
        const recommended = manager.getRecommendedType('restaurant');

        expect(recommended.id).toBe('rest_standard');
        expect(recommended.isRecommended).toBe(true);
      });

      it('should return dental_standard for dental vertical', () => {
        const recommended = manager.getRecommendedType('dental');

        expect(recommended.id).toBe('dental_standard');
        expect(recommended.isRecommended).toBe(true);
      });
    });

    describe('getActiveTypes', () => {
      it('should return only active types', () => {
        const types = manager.getActiveTypes();

        expect(types.every((t) => t.isActive)).toBe(true);
      });

      it('should filter by vertical', () => {
        const types = manager.getActiveTypes('restaurant');

        expect(types.every((t) => t.isActive && t.vertical === 'restaurant')).toBe(
          true
        );
      });
    });
  });

  // =====================================================
  // CAPABILITY & TOOL TESTS
  // =====================================================

  describe('Capabilities and Tools', () => {
    describe('getCapabilitiesForType', () => {
      it('should return correct capabilities for rest_basic', () => {
        const caps = manager.getCapabilitiesForType('rest_basic');

        expect(caps).toEqual(RESTAURANT_CAPABILITIES.basic);
        expect(caps).toContain('reservations');
        expect(caps).toContain('business_hours');
        expect(caps).not.toContain('menu_info');
        expect(caps).not.toContain('orders');
      });

      it('should return correct capabilities for rest_standard', () => {
        const caps = manager.getCapabilitiesForType('rest_standard');

        expect(caps).toEqual(RESTAURANT_CAPABILITIES.standard);
        expect(caps).toContain('reservations');
        expect(caps).toContain('menu_info');
        expect(caps).toContain('recommendations');
        expect(caps).not.toContain('orders');
      });

      it('should return correct capabilities for rest_complete', () => {
        const caps = manager.getCapabilitiesForType('rest_complete');

        expect(caps).toEqual(RESTAURANT_CAPABILITIES.complete);
        expect(caps).toContain('orders');
        expect(caps).toContain('promotions');
      });

      it('should return correct capabilities for dental types', () => {
        expect(manager.getCapabilitiesForType('dental_basic')).toEqual(
          DENTAL_CAPABILITIES.basic
        );
        expect(manager.getCapabilitiesForType('dental_standard')).toEqual(
          DENTAL_CAPABILITIES.standard
        );
        expect(manager.getCapabilitiesForType('dental_complete')).toEqual(
          DENTAL_CAPABILITIES.complete
        );
      });

      it('should return empty array for invalid type', () => {
        const caps = manager.getCapabilitiesForType('invalid');

        expect(caps).toEqual([]);
      });
    });

    describe('getToolsForType', () => {
      it('should return correct tools for rest_basic', () => {
        const tools = manager.getToolsForType('rest_basic');

        expect(tools).toEqual(RESTAURANT_TOOLS.basic);
        expect(tools).toContain('check_availability');
        expect(tools).toContain('create_reservation');
        expect(tools).not.toContain('get_menu');
      });

      it('should return correct tools for rest_complete', () => {
        const tools = manager.getToolsForType('rest_complete');

        expect(tools).toEqual(RESTAURANT_TOOLS.complete);
        expect(tools).toContain('create_order');
        expect(tools).toContain('get_promotions');
      });

      it('should return empty array for invalid type', () => {
        const tools = manager.getToolsForType('invalid');

        expect(tools).toEqual([]);
      });
    });

    describe('typeSupportsCapability', () => {
      it('should return true for supported capability', () => {
        expect(
          manager.typeSupportsCapability('rest_basic', 'reservations')
        ).toBe(true);
        expect(
          manager.typeSupportsCapability('rest_standard', 'menu_info')
        ).toBe(true);
        expect(
          manager.typeSupportsCapability('dental_complete', 'emergencies')
        ).toBe(true);
      });

      it('should return false for unsupported capability', () => {
        expect(manager.typeSupportsCapability('rest_basic', 'orders')).toBe(
          false
        );
        expect(
          manager.typeSupportsCapability('dental_basic', 'insurance_info')
        ).toBe(false);
      });
    });

    describe('typeHasTool', () => {
      it('should return true for available tool', () => {
        expect(manager.typeHasTool('rest_basic', 'create_reservation')).toBe(
          true
        );
        expect(manager.typeHasTool('rest_complete', 'create_order')).toBe(true);
      });

      it('should return false for unavailable tool', () => {
        expect(manager.typeHasTool('rest_basic', 'create_order')).toBe(false);
        expect(manager.typeHasTool('dental_basic', 'handle_emergency')).toBe(
          false
        );
      });
    });
  });

  // =====================================================
  // VALIDATION TESTS
  // =====================================================

  describe('Validation', () => {
    describe('validateTypeConfig', () => {
      it('should pass valid configuration', () => {
        const result = manager.validateTypeConfig({
          typeId: 'rest_standard',
          useCustomSettings: false,
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail when typeId is missing', () => {
        const result = manager.validateTypeConfig({
          useCustomSettings: false,
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('INVALID_TYPE_ID');
      });

      it('should fail for invalid typeId', () => {
        const result = manager.validateTypeConfig({
          typeId: 'invalid_type' as AssistantTypeId,
          useCustomSettings: false,
        });

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_TYPE_ID');
      });

      it('should fail for vertical mismatch', () => {
        const result = manager.validateTypeConfig(
          {
            typeId: 'rest_standard',
            useCustomSettings: false,
          },
          'dental' // Wrong vertical
        );

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('VERTICAL_MISMATCH');
      });

      it('should validate custom personality', () => {
        const result = manager.validateTypeConfig({
          typeId: 'rest_standard',
          useCustomSettings: true,
          customPersonality: 'invalid' as any,
        });

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_PERSONALITY');
      });

      it('should validate custom max duration', () => {
        const result = manager.validateTypeConfig({
          typeId: 'rest_standard',
          useCustomSettings: true,
          customMaxDuration: 30, // Too short
        });

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_DURATION');
      });

      it('should warn for long duration', () => {
        const result = manager.validateTypeConfig({
          typeId: 'rest_standard',
          useCustomSettings: true,
          customMaxDuration: 2000, // Over 30 minutes
        });

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('30 minutes');
      });
    });

    describe('validateCapabilities', () => {
      it('should pass for valid capabilities', () => {
        const result = manager.validateCapabilities('rest_standard', [
          'reservations',
          'menu_info',
        ]);

        expect(result.valid).toBe(true);
      });

      it('should fail for unsupported capability', () => {
        const result = manager.validateCapabilities('rest_basic', [
          'reservations',
          'orders', // Not in basic
        ]);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('CAPABILITY_NOT_SUPPORTED');
      });

      it('should fail for wrong vertical capability', () => {
        const result = manager.validateCapabilities('rest_standard', [
          'appointments', // Dental capability
        ]);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_CAPABILITY');
      });
    });

    describe('validateTools', () => {
      it('should pass for valid tools', () => {
        const result = manager.validateTools('rest_basic', [
          'check_availability',
          'create_reservation',
        ]);

        expect(result.valid).toBe(true);
      });

      it('should fail for unsupported tool', () => {
        const result = manager.validateTools('rest_basic', [
          'check_availability',
          'create_order', // Not in basic
        ]);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('TOOL_NOT_SUPPORTED');
      });
    });
  });

  // =====================================================
  // UI HELPER TESTS
  // =====================================================

  describe('UI Helpers', () => {
    describe('getTypesForDisplay', () => {
      it('should return formatted types for restaurant', () => {
        const display = manager.getTypesForDisplay('restaurant');

        expect(display).toHaveLength(3);
        expect(display[0]).toHaveProperty('id');
        expect(display[0]).toHaveProperty('name');
        expect(display[0]).toHaveProperty('description');
        expect(display[0]).toHaveProperty('features');
        expect(display[0]).toHaveProperty('recommended');
        expect(display[0]).toHaveProperty('levelLabel');
      });

      it('should mark recommended type', () => {
        const display = manager.getTypesForDisplay('restaurant');
        const recommended = display.find((d) => d.recommended);

        expect(recommended).toBeDefined();
        expect(recommended?.id).toBe('rest_standard');
      });

      it('should have correct level labels', () => {
        const display = manager.getTypesForDisplay('dental');

        expect(display.find((d) => d.id === 'dental_basic')?.levelLabel).toBe(
          'Básico'
        );
        expect(display.find((d) => d.id === 'dental_standard')?.levelLabel).toBe(
          'Estándar'
        );
        expect(display.find((d) => d.id === 'dental_complete')?.levelLabel).toBe(
          'Completo'
        );
      });
    });

    describe('compareTypes', () => {
      it('should compare two types correctly', () => {
        const comparison = manager.compareTypes('rest_basic', 'rest_standard');

        expect(comparison).not.toBeNull();
        expect(comparison?.typeA).toBe('rest_basic');
        expect(comparison?.typeB).toBe('rest_standard');

        // Standard should have more capabilities
        expect(comparison?.capabilitiesOnlyInB.length).toBeGreaterThan(0);
        expect(comparison?.capabilitiesOnlyInB).toContain('menu_info');

        // Basic shouldn't have unique capabilities vs standard
        expect(comparison?.capabilitiesOnlyInA).toHaveLength(0);

        // Should share some capabilities
        expect(comparison?.sharedCapabilities).toContain('reservations');
      });

      it('should return null for invalid type IDs', () => {
        const comparison = manager.compareTypes('invalid', 'rest_standard');

        expect(comparison).toBeNull();
      });
    });

    describe('getUpgradePath', () => {
      it('should return valid upgrade path', () => {
        const upgrade = manager.getUpgradePath('rest_basic', 'rest_standard');

        expect(upgrade).not.toBeNull();
        expect(upgrade?.canUpgrade).toBe(true);
        expect(upgrade?.addedCapabilities).toContain('menu_info');
        expect(upgrade?.addedTools).toContain('get_menu');
      });

      it('should reject cross-vertical upgrade', () => {
        const upgrade = manager.getUpgradePath('rest_basic', 'dental_standard');

        expect(upgrade).not.toBeNull();
        expect(upgrade?.canUpgrade).toBe(false);
        expect(upgrade?.reason).toContain('different verticals');
      });

      it('should reject downgrade', () => {
        const upgrade = manager.getUpgradePath('rest_complete', 'rest_basic');

        expect(upgrade).not.toBeNull();
        expect(upgrade?.canUpgrade).toBe(false);
        expect(upgrade?.reason).toContain('downgrade');
      });

      it('should reject same level', () => {
        const upgrade = manager.getUpgradePath('rest_basic', 'rest_basic');

        expect(upgrade).not.toBeNull();
        expect(upgrade?.canUpgrade).toBe(false);
        expect(upgrade?.reason).toContain('Same level');
      });
    });

    describe('getVerticalSummary', () => {
      it('should return summary for restaurant', () => {
        const summary = manager.getVerticalSummary('restaurant');

        expect(summary.vertical).toBe('restaurant');
        expect(summary.types).toHaveLength(3);
        expect(summary.recommendedTypeId).toBe('rest_standard');
      });

      it('should include capability and tool counts', () => {
        const summary = manager.getVerticalSummary('dental');

        for (const type of summary.types) {
          expect(type.capabilityCount).toBeGreaterThan(0);
          expect(type.toolCount).toBeGreaterThan(0);
        }
      });
    });
  });

  // =====================================================
  // CONFIGURATION RESOLUTION TESTS
  // =====================================================

  describe('Configuration Resolution', () => {
    describe('resolveConfig', () => {
      it('should resolve config with default values', () => {
        const resolved = manager.resolveConfig({
          typeId: 'rest_standard',
          useCustomSettings: false,
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.type.id).toBe('rest_standard');
        expect(resolved?.voiceId).toBe('elevenlabs-maria');
        expect(resolved?.personality).toBe('friendly');
      });

      it('should resolve config with custom values', () => {
        const resolved = manager.resolveConfig({
          typeId: 'rest_standard',
          useCustomSettings: true,
          customVoiceId: 'elevenlabs-carlos',
          customPersonality: 'professional',
          customMaxDuration: 900,
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.voiceId).toBe('elevenlabs-carlos');
        expect(resolved?.personality).toBe('professional');
        expect(resolved?.maxDurationSeconds).toBe(900);
      });

      it('should return null for invalid type', () => {
        const resolved = manager.resolveConfig({
          typeId: 'invalid' as AssistantTypeId,
          useCustomSettings: false,
        });

        expect(resolved).toBeNull();
      });
    });
  });

  // =====================================================
  // METADATA TESTS
  // =====================================================

  describe('Metadata', () => {
    it('should report not initialized initially', () => {
      const fresh = createLocalAssistantTypeManager();
      expect(fresh.isInitialized()).toBe(false);
      fresh.stop();
    });

    it('should report type count', () => {
      expect(manager.getTypeCount()).toBe(6);
    });

    it('should report not using Supabase for local manager', () => {
      expect(manager.isUsingSupabase()).toBe(false);
    });
  });
});

// =====================================================
// STATIC HELPER TESTS
// =====================================================

describe('Static Type Helpers', () => {
  describe('getCapabilitiesForTypeId', () => {
    it('should return capabilities for all type IDs', () => {
      for (const typeId of ASSISTANT_TYPE_IDS) {
        const caps = getCapabilitiesForTypeId(typeId);
        expect(caps.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getToolsForTypeId', () => {
    it('should return tools for all type IDs', () => {
      for (const typeId of ASSISTANT_TYPE_IDS) {
        const tools = getToolsForTypeId(typeId);
        expect(tools.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getVerticalFromTypeId', () => {
    it('should return restaurant for rest_ types', () => {
      expect(getVerticalFromTypeId('rest_basic')).toBe('restaurant');
      expect(getVerticalFromTypeId('rest_standard')).toBe('restaurant');
      expect(getVerticalFromTypeId('rest_complete')).toBe('restaurant');
    });

    it('should return dental for dental_ types', () => {
      expect(getVerticalFromTypeId('dental_basic')).toBe('dental');
      expect(getVerticalFromTypeId('dental_standard')).toBe('dental');
      expect(getVerticalFromTypeId('dental_complete')).toBe('dental');
    });
  });

  describe('getLevelFromTypeId', () => {
    it('should return correct level', () => {
      expect(getLevelFromTypeId('rest_basic')).toBe('basic');
      expect(getLevelFromTypeId('rest_standard')).toBe('standard');
      expect(getLevelFromTypeId('rest_complete')).toBe('complete');
      expect(getLevelFromTypeId('dental_basic')).toBe('basic');
      expect(getLevelFromTypeId('dental_standard')).toBe('standard');
      expect(getLevelFromTypeId('dental_complete')).toBe('complete');
    });
  });
});

// =====================================================
// TYPE GUARD TESTS
// =====================================================

describe('Type Guards', () => {
  describe('isValidAssistantTypeId', () => {
    it('should return true for valid IDs', () => {
      expect(isValidAssistantTypeId('rest_basic')).toBe(true);
      expect(isValidAssistantTypeId('dental_complete')).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isValidAssistantTypeId('invalid')).toBe(false);
      expect(isValidAssistantTypeId('')).toBe(false);
      expect(isValidAssistantTypeId('rest_')).toBe(false);
    });
  });

  describe('isValidVertical', () => {
    it('should return true for valid verticals', () => {
      expect(isValidVertical('restaurant')).toBe(true);
      expect(isValidVertical('dental')).toBe(true);
    });

    it('should return false for invalid verticals', () => {
      expect(isValidVertical('gym')).toBe(false);
      expect(isValidVertical('')).toBe(false);
    });
  });

  describe('isValidPersonalityType', () => {
    it('should return true for valid personalities', () => {
      expect(isValidPersonalityType('professional')).toBe(true);
      expect(isValidPersonalityType('friendly')).toBe(true);
      expect(isValidPersonalityType('energetic')).toBe(true);
      expect(isValidPersonalityType('calm')).toBe(true);
    });

    it('should return false for invalid personalities', () => {
      expect(isValidPersonalityType('excited')).toBe(false);
      expect(isValidPersonalityType('')).toBe(false);
    });
  });

  describe('isValidCapability', () => {
    it('should return true for valid capabilities', () => {
      expect(isValidCapability('business_hours')).toBe(true);
      expect(isValidCapability('reservations')).toBe(true);
      expect(isValidCapability('appointments')).toBe(true);
      expect(isValidCapability('emergencies')).toBe(true);
    });

    it('should return false for invalid capabilities', () => {
      expect(isValidCapability('invalid_capability')).toBe(false);
      expect(isValidCapability('')).toBe(false);
      expect(isValidCapability('RESERVATIONS')).toBe(false); // case sensitive
    });

    it('should validate all capabilities in ALL_CAPABILITIES array', () => {
      for (const cap of ALL_CAPABILITIES) {
        expect(isValidCapability(cap)).toBe(true);
      }
    });
  });

  describe('isValidTool', () => {
    it('should return true for valid tools', () => {
      expect(isValidTool('get_business_hours')).toBe(true);
      expect(isValidTool('create_reservation')).toBe(true);
      expect(isValidTool('handle_emergency')).toBe(true);
    });

    it('should return false for invalid tools', () => {
      expect(isValidTool('invalid_tool')).toBe(false);
      expect(isValidTool('')).toBe(false);
      expect(isValidTool('GET_MENU')).toBe(false); // case sensitive
    });

    it('should validate all tools in ALL_TOOLS array', () => {
      for (const tool of ALL_TOOLS) {
        expect(isValidTool(tool)).toBe(true);
      }
    });
  });

  describe('isValidAssistantTypeLevel', () => {
    it('should return true for valid levels', () => {
      expect(isValidAssistantTypeLevel('basic')).toBe(true);
      expect(isValidAssistantTypeLevel('standard')).toBe(true);
      expect(isValidAssistantTypeLevel('complete')).toBe(true);
    });

    it('should return false for invalid levels', () => {
      expect(isValidAssistantTypeLevel('premium')).toBe(false);
      expect(isValidAssistantTypeLevel('')).toBe(false);
      expect(isValidAssistantTypeLevel('BASIC')).toBe(false);
    });
  });
});

// =====================================================
// VALIDATION ARRAYS TESTS
// =====================================================

describe('Validation Arrays', () => {
  describe('ALL_CAPABILITIES', () => {
    it('should contain all expected shared capabilities', () => {
      expect(ALL_CAPABILITIES).toContain('business_hours');
      expect(ALL_CAPABILITIES).toContain('business_info');
      expect(ALL_CAPABILITIES).toContain('human_transfer');
      expect(ALL_CAPABILITIES).toContain('faq');
    });

    it('should contain all restaurant capabilities', () => {
      expect(ALL_CAPABILITIES).toContain('reservations');
      expect(ALL_CAPABILITIES).toContain('menu_info');
      expect(ALL_CAPABILITIES).toContain('recommendations');
      expect(ALL_CAPABILITIES).toContain('orders');
      expect(ALL_CAPABILITIES).toContain('order_status');
      expect(ALL_CAPABILITIES).toContain('promotions');
    });

    it('should contain all dental capabilities', () => {
      expect(ALL_CAPABILITIES).toContain('appointments');
      expect(ALL_CAPABILITIES).toContain('services_info');
      expect(ALL_CAPABILITIES).toContain('doctor_info');
      expect(ALL_CAPABILITIES).toContain('insurance_info');
      expect(ALL_CAPABILITIES).toContain('appointment_management');
      expect(ALL_CAPABILITIES).toContain('emergencies');
    });

    it('should have correct total count', () => {
      // 4 shared + 6 restaurant + 6 dental = 16
      expect(ALL_CAPABILITIES).toHaveLength(16);
    });

    it('should not have duplicates', () => {
      const uniqueSet = new Set(ALL_CAPABILITIES);
      expect(uniqueSet.size).toBe(ALL_CAPABILITIES.length);
    });
  });

  describe('ALL_TOOLS', () => {
    it('should contain all shared tools', () => {
      expect(ALL_TOOLS).toContain('get_business_hours');
      expect(ALL_TOOLS).toContain('get_business_info');
      expect(ALL_TOOLS).toContain('transfer_to_human');
    });

    it('should contain restaurant reservation tools', () => {
      expect(ALL_TOOLS).toContain('check_availability');
      expect(ALL_TOOLS).toContain('create_reservation');
      expect(ALL_TOOLS).toContain('modify_reservation');
      expect(ALL_TOOLS).toContain('cancel_reservation');
    });

    it('should contain restaurant menu tools', () => {
      expect(ALL_TOOLS).toContain('get_menu');
      expect(ALL_TOOLS).toContain('get_menu_item');
      expect(ALL_TOOLS).toContain('search_menu');
      expect(ALL_TOOLS).toContain('get_recommendations');
    });

    it('should contain restaurant order tools', () => {
      expect(ALL_TOOLS).toContain('create_order');
      expect(ALL_TOOLS).toContain('modify_order');
      expect(ALL_TOOLS).toContain('cancel_order');
      expect(ALL_TOOLS).toContain('get_order_status');
      expect(ALL_TOOLS).toContain('calculate_delivery_time');
      expect(ALL_TOOLS).toContain('get_promotions');
    });

    it('should contain dental appointment tools', () => {
      expect(ALL_TOOLS).toContain('check_appointment_availability');
      expect(ALL_TOOLS).toContain('create_appointment');
      expect(ALL_TOOLS).toContain('modify_appointment');
      expect(ALL_TOOLS).toContain('cancel_appointment');
    });

    it('should contain dental service tools', () => {
      expect(ALL_TOOLS).toContain('get_services');
      expect(ALL_TOOLS).toContain('get_service_info');
      expect(ALL_TOOLS).toContain('get_service_prices');
    });

    it('should contain dental doctor and insurance tools', () => {
      expect(ALL_TOOLS).toContain('get_doctors');
      expect(ALL_TOOLS).toContain('get_doctor_info');
      expect(ALL_TOOLS).toContain('get_insurance_info');
      expect(ALL_TOOLS).toContain('check_insurance_coverage');
    });

    it('should contain dental emergency tools', () => {
      expect(ALL_TOOLS).toContain('handle_emergency');
      expect(ALL_TOOLS).toContain('send_reminder');
    });

    it('should not have duplicates', () => {
      const uniqueSet = new Set(ALL_TOOLS);
      expect(uniqueSet.size).toBe(ALL_TOOLS.length);
    });
  });
});

// =====================================================
// ROW TO ASSISTANT TYPE CONVERSION TESTS
// =====================================================

describe('rowToAssistantType', () => {
  const validRow: AssistantTypeRow = {
    id: 'rest_standard',
    name: 'rest_standard',
    display_name: 'Estándar',
    description: 'Test description',
    vertical: 'restaurant',
    level: 'standard',
    enabled_capabilities: ['business_hours', 'reservations', 'menu_info'],
    available_tools: ['get_business_hours', 'create_reservation', 'get_menu'],
    default_voice_id: 'elevenlabs-maria',
    default_personality: 'friendly',
    prompt_template_name: 'restaurant_standard',
    template_version: '2.0',
    max_call_duration_seconds: 600,
    is_active: true,
    sort_order: 2,
    is_recommended: true,
    icon_name: 'restaurant',
    features: ['Reservaciones', 'Menú'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  it('should convert valid row successfully', () => {
    const result = rowToAssistantType(validRow);

    expect(result.id).toBe('rest_standard');
    expect(result.displayName).toBe('Estándar');
    expect(result.vertical).toBe('restaurant');
    expect(result.level).toBe('standard');
    expect(result.isRecommended).toBe(true);
  });

  it('should throw error for invalid type ID', () => {
    const invalidRow = { ...validRow, id: 'invalid_type' };

    expect(() => rowToAssistantType(invalidRow)).toThrow(
      'Invalid assistant type ID from database: invalid_type'
    );
  });

  it('should throw error for invalid vertical', () => {
    const invalidRow = { ...validRow, vertical: 'gym' };

    expect(() => rowToAssistantType(invalidRow)).toThrow(
      'Invalid vertical from database: gym'
    );
  });

  it('should throw error for invalid level', () => {
    const invalidRow = { ...validRow, level: 'premium' };

    expect(() => rowToAssistantType(invalidRow)).toThrow(
      'Invalid level from database: premium'
    );
  });

  it('should throw error for invalid personality', () => {
    const invalidRow = { ...validRow, default_personality: 'excited' };

    expect(() => rowToAssistantType(invalidRow)).toThrow(
      'Invalid personality from database: excited'
    );
  });

  it('should filter out invalid capabilities with warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const rowWithInvalidCaps = {
      ...validRow,
      enabled_capabilities: ['business_hours', 'invalid_cap', 'reservations'],
    };

    const result = rowToAssistantType(rowWithInvalidCaps);

    expect(result.enabledCapabilities).toEqual(['business_hours', 'reservations']);
    expect(result.enabledCapabilities).not.toContain('invalid_cap');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid capabilities ignored'),
      expect.arrayContaining(['invalid_cap'])
    );

    warnSpy.mockRestore();
  });

  it('should filter out invalid tools with warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const rowWithInvalidTools = {
      ...validRow,
      available_tools: ['get_business_hours', 'invalid_tool', 'get_menu'],
    };

    const result = rowToAssistantType(rowWithInvalidTools);

    expect(result.availableTools).toEqual(['get_business_hours', 'get_menu']);
    expect(result.availableTools).not.toContain('invalid_tool');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid tools ignored'),
      expect.arrayContaining(['invalid_tool'])
    );

    warnSpy.mockRestore();
  });

  it('should handle null icon_name', () => {
    const rowWithNullIcon = { ...validRow, icon_name: null };

    const result = rowToAssistantType(rowWithNullIcon);

    expect(result.iconName).toBeUndefined();
  });

  it('should preserve all valid properties', () => {
    const result = rowToAssistantType(validRow);

    expect(result.name).toBe(validRow.name);
    expect(result.description).toBe(validRow.description);
    expect(result.defaultVoiceId).toBe(validRow.default_voice_id);
    expect(result.defaultPersonality).toBe(validRow.default_personality);
    expect(result.promptTemplateName).toBe(validRow.prompt_template_name);
    expect(result.templateVersion).toBe(validRow.template_version);
    expect(result.maxCallDurationSeconds).toBe(validRow.max_call_duration_seconds);
    expect(result.isActive).toBe(validRow.is_active);
    expect(result.sortOrder).toBe(validRow.sort_order);
    expect(result.features).toEqual(validRow.features);
    expect(result.createdAt).toBe(validRow.created_at);
    expect(result.updatedAt).toBe(validRow.updated_at);
  });
});

// =====================================================
// PREDEFINED TYPE TESTS
// =====================================================

describe('Predefined Types', () => {
  describe('Restaurant Types', () => {
    it('REST_BASIC should have correct properties', () => {
      expect(REST_BASIC.id).toBe('rest_basic');
      expect(REST_BASIC.vertical).toBe('restaurant');
      expect(REST_BASIC.level).toBe('basic');
      expect(REST_BASIC.isActive).toBe(true);
      expect(REST_BASIC.isRecommended).toBe(false);
    });

    it('REST_STANDARD should be recommended', () => {
      expect(REST_STANDARD.id).toBe('rest_standard');
      expect(REST_STANDARD.isRecommended).toBe(true);
    });

    it('REST_COMPLETE should have all capabilities', () => {
      expect(REST_COMPLETE.enabledCapabilities).toContain('orders');
      expect(REST_COMPLETE.enabledCapabilities).toContain('promotions');
      expect(REST_COMPLETE.availableTools).toContain('create_order');
    });
  });

  describe('Dental Types', () => {
    it('DENTAL_BASIC should have correct properties', () => {
      expect(DENTAL_BASIC.id).toBe('dental_basic');
      expect(DENTAL_BASIC.vertical).toBe('dental');
      expect(DENTAL_BASIC.level).toBe('basic');
      expect(DENTAL_BASIC.defaultPersonality).toBe('professional');
    });

    it('DENTAL_STANDARD should be recommended', () => {
      expect(DENTAL_STANDARD.id).toBe('dental_standard');
      expect(DENTAL_STANDARD.isRecommended).toBe(true);
    });

    it('DENTAL_COMPLETE should have emergency handling', () => {
      expect(DENTAL_COMPLETE.enabledCapabilities).toContain('emergencies');
      expect(DENTAL_COMPLETE.availableTools).toContain('handle_emergency');
    });
  });

  describe('All Types', () => {
    it('should have 6 types total', () => {
      expect(ASSISTANT_TYPES).toHaveLength(6);
    });

    it('all types should have required properties', () => {
      for (const type of ASSISTANT_TYPES) {
        expect(type.id).toBeDefined();
        expect(type.displayName).toBeDefined();
        expect(type.description).toBeDefined();
        expect(type.vertical).toBeDefined();
        expect(type.level).toBeDefined();
        expect(type.enabledCapabilities.length).toBeGreaterThan(0);
        expect(type.availableTools.length).toBeGreaterThan(0);
        expect(type.features.length).toBeGreaterThan(0);
      }
    });

    it('types should have increasing capabilities by level', () => {
      // Restaurant
      expect(REST_BASIC.enabledCapabilities.length).toBeLessThan(
        REST_STANDARD.enabledCapabilities.length
      );
      expect(REST_STANDARD.enabledCapabilities.length).toBeLessThan(
        REST_COMPLETE.enabledCapabilities.length
      );

      // Dental
      expect(DENTAL_BASIC.enabledCapabilities.length).toBeLessThan(
        DENTAL_STANDARD.enabledCapabilities.length
      );
      expect(DENTAL_STANDARD.enabledCapabilities.length).toBeLessThan(
        DENTAL_COMPLETE.enabledCapabilities.length
      );
    });
  });
});
