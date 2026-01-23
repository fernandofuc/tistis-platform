// =====================================================
// TIS TIS PLATFORM - Inventory Config Tests
// Unit tests for inventory configuration constants
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  STOCK_STATUS_CONFIG,
  ALERT_SEVERITY_CONFIG,
  MOVEMENT_TYPE_CONFIG,
  ITEM_TYPE_CONFIG,
  STORAGE_TYPE_CONFIG,
  UNIT_TYPES,
  CURRENCY_CONFIG,
  STOCK_THRESHOLDS,
  PAGINATION_DEFAULTS,
  SORT_OPTIONS,
  DATE_RANGE_PRESETS,
  VALIDATION_RULES,
  TOAST_CONFIG,
  SKELETON_CONFIG,
  EMPTY_STATE_CONFIG,
} from '@/features/inventory-management/config/inventory-config';

// ========================================
// STOCK_STATUS_CONFIG TESTS
// ========================================

describe('STOCK_STATUS_CONFIG', () => {
  it('should have all required stock statuses', () => {
    const expectedStatuses = ['in_stock', 'low_stock', 'out_of_stock', 'overstocked'];
    for (const status of expectedStatuses) {
      expect(STOCK_STATUS_CONFIG).toHaveProperty(status);
    }
  });

  it('should have required properties for each status', () => {
    for (const [status, config] of Object.entries(STOCK_STATUS_CONFIG)) {
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('colors');
      expect(config.colors).toHaveProperty('bg');
      expect(config.colors).toHaveProperty('text');
      expect(config.colors).toHaveProperty('border');
      expect(config.colors).toHaveProperty('badge');
      expect(config.colors).toHaveProperty('icon');

      // Labels should be non-empty strings
      expect(typeof config.label).toBe('string');
      expect(config.label.length).toBeGreaterThan(0);
    }
  });

  it('should have Tailwind CSS classes for colors', () => {
    for (const config of Object.values(STOCK_STATUS_CONFIG)) {
      expect(config.colors.bg).toMatch(/^bg-/);
      expect(config.colors.text).toMatch(/^text-/);
      expect(config.colors.border).toMatch(/^border-/);
    }
  });
});

// ========================================
// ALERT_SEVERITY_CONFIG TESTS
// ========================================

describe('ALERT_SEVERITY_CONFIG', () => {
  it('should have all required severities', () => {
    const expectedSeverities = ['critical', 'warning', 'low'];
    for (const severity of expectedSeverities) {
      expect(ALERT_SEVERITY_CONFIG).toHaveProperty(severity);
    }
  });

  it('should have correct priority order', () => {
    expect(ALERT_SEVERITY_CONFIG.critical.priority).toBeGreaterThan(ALERT_SEVERITY_CONFIG.warning.priority);
    expect(ALERT_SEVERITY_CONFIG.warning.priority).toBeGreaterThan(ALERT_SEVERITY_CONFIG.low.priority);
  });

  it('should have animation only for critical', () => {
    expect(ALERT_SEVERITY_CONFIG.critical.animation).toBeDefined();
    expect(ALERT_SEVERITY_CONFIG.warning.animation).toBeUndefined();
    expect(ALERT_SEVERITY_CONFIG.low.animation).toBeUndefined();
  });
});

// ========================================
// MOVEMENT_TYPE_CONFIG TESTS
// ========================================

describe('MOVEMENT_TYPE_CONFIG', () => {
  it('should have all required movement types', () => {
    const expectedTypes = [
      'purchase', 'sale', 'consumption', 'waste', 'adjustment',
      'transfer_in', 'transfer_out', 'return', 'production'
    ];
    for (const type of expectedTypes) {
      expect(MOVEMENT_TYPE_CONFIG).toHaveProperty(type);
    }
  });

  it('should correctly identify inbound vs outbound movements', () => {
    // Inbound movements
    expect(MOVEMENT_TYPE_CONFIG.purchase.isInbound).toBe(true);
    expect(MOVEMENT_TYPE_CONFIG.transfer_in.isInbound).toBe(true);
    expect(MOVEMENT_TYPE_CONFIG.production.isInbound).toBe(true);

    // Outbound movements
    expect(MOVEMENT_TYPE_CONFIG.sale.isInbound).toBe(false);
    expect(MOVEMENT_TYPE_CONFIG.consumption.isInbound).toBe(false);
    expect(MOVEMENT_TYPE_CONFIG.waste.isInbound).toBe(false);
    expect(MOVEMENT_TYPE_CONFIG.transfer_out.isInbound).toBe(false);
    expect(MOVEMENT_TYPE_CONFIG.return.isInbound).toBe(false);
  });

  it('should have both label and shortLabel for all types', () => {
    for (const config of Object.values(MOVEMENT_TYPE_CONFIG)) {
      expect(config.label).toBeDefined();
      expect(config.shortLabel).toBeDefined();
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.shortLabel.length).toBeGreaterThan(0);
    }
  });

  it('should have descriptions for all types', () => {
    for (const config of Object.values(MOVEMENT_TYPE_CONFIG)) {
      expect(config.description).toBeDefined();
      expect(typeof config.description).toBe('string');
      expect(config.description.length).toBeGreaterThan(0);
    }
  });
});

// ========================================
// ITEM_TYPE_CONFIG TESTS
// ========================================

describe('ITEM_TYPE_CONFIG', () => {
  it('should have all required item types', () => {
    const expectedTypes = ['ingredient', 'supply', 'equipment', 'packaging'];
    for (const type of expectedTypes) {
      expect(ITEM_TYPE_CONFIG).toHaveProperty(type);
    }
  });

  it('should have unique icons for each type', () => {
    const icons = Object.values(ITEM_TYPE_CONFIG).map(c => c.icon);
    const uniqueIcons = new Set(icons);
    expect(uniqueIcons.size).toBe(icons.length);
  });

  it('should have descriptions for all types', () => {
    for (const config of Object.values(ITEM_TYPE_CONFIG)) {
      expect(config.description).toBeDefined();
      expect(typeof config.description).toBe('string');
    }
  });
});

// ========================================
// STORAGE_TYPE_CONFIG TESTS
// ========================================

describe('STORAGE_TYPE_CONFIG', () => {
  it('should have all required storage types', () => {
    const expectedTypes = ['dry', 'refrigerated', 'frozen', 'ambient'];
    for (const type of expectedTypes) {
      expect(STORAGE_TYPE_CONFIG).toHaveProperty(type);
    }
  });

  it('should have temperature info for cold storage types', () => {
    expect(STORAGE_TYPE_CONFIG.refrigerated.temperature).toContain('°C');
    expect(STORAGE_TYPE_CONFIG.frozen.temperature).toContain('°C');
  });

  it('should have different colors for each type', () => {
    const colors = Object.values(STORAGE_TYPE_CONFIG).map(c => c.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);
  });
});

// ========================================
// UNIT_TYPES TESTS
// ========================================

describe('UNIT_TYPES', () => {
  it('should have weight, volume, and count categories', () => {
    expect(UNIT_TYPES).toHaveProperty('weight');
    expect(UNIT_TYPES).toHaveProperty('volume');
    expect(UNIT_TYPES).toHaveProperty('count');
  });

  it('should have common weight units', () => {
    const weightValues = UNIT_TYPES.weight.units.map(u => u.value);
    expect(weightValues).toContain('kg');
    expect(weightValues).toContain('g');
    expect(weightValues).toContain('lb');
  });

  it('should have common volume units', () => {
    const volumeValues = UNIT_TYPES.volume.units.map(u => u.value);
    expect(volumeValues).toContain('l');
    expect(volumeValues).toContain('ml');
  });

  it('should have common count units', () => {
    const countValues = UNIT_TYPES.count.units.map(u => u.value);
    expect(countValues).toContain('unit');
    expect(countValues).toContain('box');
  });

  it('should have both value and label for all units', () => {
    for (const category of Object.values(UNIT_TYPES)) {
      for (const unit of category.units) {
        expect(unit).toHaveProperty('value');
        expect(unit).toHaveProperty('label');
      }
    }
  });
});

// ========================================
// CURRENCY_CONFIG TESTS
// ========================================

describe('CURRENCY_CONFIG', () => {
  it('should have MXN configuration', () => {
    expect(CURRENCY_CONFIG).toHaveProperty('MXN');
    expect(CURRENCY_CONFIG.MXN.code).toBe('MXN');
    expect(CURRENCY_CONFIG.MXN.symbol).toBe('$');
  });

  it('should have USD configuration', () => {
    expect(CURRENCY_CONFIG).toHaveProperty('USD');
    expect(CURRENCY_CONFIG.USD.code).toBe('USD');
  });

  it('should format MXN currency correctly', () => {
    const formatted = CURRENCY_CONFIG.MXN.format(1234.56);
    expect(formatted).toContain('$');
    expect(formatted).toContain('MXN');
    expect(formatted).toContain('1234.56');
  });

  it('should format USD currency correctly', () => {
    const formatted = CURRENCY_CONFIG.USD.format(100);
    expect(formatted).toContain('$');
    expect(formatted).toContain('USD');
  });
});

// ========================================
// STOCK_THRESHOLDS TESTS
// ========================================

describe('STOCK_THRESHOLDS', () => {
  it('should have all required thresholds', () => {
    expect(STOCK_THRESHOLDS).toHaveProperty('CRITICAL');
    expect(STOCK_THRESHOLDS).toHaveProperty('WARNING');
    expect(STOCK_THRESHOLDS).toHaveProperty('LOW');
    expect(STOCK_THRESHOLDS).toHaveProperty('OVERSTOCK');
  });

  it('should have thresholds in correct order', () => {
    expect(STOCK_THRESHOLDS.CRITICAL).toBeLessThan(STOCK_THRESHOLDS.WARNING);
    expect(STOCK_THRESHOLDS.WARNING).toBeLessThan(STOCK_THRESHOLDS.LOW);
    expect(STOCK_THRESHOLDS.LOW).toBeLessThan(STOCK_THRESHOLDS.OVERSTOCK);
  });

  it('should have reasonable threshold values', () => {
    expect(STOCK_THRESHOLDS.CRITICAL).toBeLessThanOrEqual(1);
    expect(STOCK_THRESHOLDS.OVERSTOCK).toBeGreaterThan(1);
  });
});

// ========================================
// PAGINATION_DEFAULTS TESTS
// ========================================

describe('PAGINATION_DEFAULTS', () => {
  it('should have default page size', () => {
    expect(PAGINATION_DEFAULTS.PAGE_SIZE).toBeDefined();
    expect(typeof PAGINATION_DEFAULTS.PAGE_SIZE).toBe('number');
    expect(PAGINATION_DEFAULTS.PAGE_SIZE).toBeGreaterThan(0);
  });

  it('should have page size options', () => {
    expect(Array.isArray(PAGINATION_DEFAULTS.PAGE_SIZES)).toBe(true);
    expect(PAGINATION_DEFAULTS.PAGE_SIZES).toContain(PAGINATION_DEFAULTS.PAGE_SIZE);
  });

  it('should have max page size', () => {
    expect(PAGINATION_DEFAULTS.MAX_PAGE_SIZE).toBeDefined();
    expect(PAGINATION_DEFAULTS.MAX_PAGE_SIZE).toBeGreaterThanOrEqual(
      Math.max(...PAGINATION_DEFAULTS.PAGE_SIZES)
    );
  });
});

// ========================================
// SORT_OPTIONS TESTS
// ========================================

describe('SORT_OPTIONS', () => {
  it('should have inventory sort options', () => {
    expect(SORT_OPTIONS).toHaveProperty('inventory');
    expect(Array.isArray(SORT_OPTIONS.inventory)).toBe(true);
    expect(SORT_OPTIONS.inventory.length).toBeGreaterThan(0);
  });

  it('should have movements sort options', () => {
    expect(SORT_OPTIONS).toHaveProperty('movements');
    expect(Array.isArray(SORT_OPTIONS.movements)).toBe(true);
  });

  it('should have recipes sort options', () => {
    expect(SORT_OPTIONS).toHaveProperty('recipes');
    expect(Array.isArray(SORT_OPTIONS.recipes)).toBe(true);
  });

  it('should have value and label for all options', () => {
    for (const options of Object.values(SORT_OPTIONS)) {
      for (const option of options) {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
      }
    }
  });

  it('should include name sort for inventory', () => {
    const inventoryValues = SORT_OPTIONS.inventory.map(o => o.value);
    expect(inventoryValues).toContain('name');
  });
});

// ========================================
// DATE_RANGE_PRESETS TESTS
// ========================================

describe('DATE_RANGE_PRESETS', () => {
  it('should be an array of presets', () => {
    expect(Array.isArray(DATE_RANGE_PRESETS)).toBe(true);
    expect(DATE_RANGE_PRESETS.length).toBeGreaterThan(0);
  });

  it('should have label and days for all presets', () => {
    for (const preset of DATE_RANGE_PRESETS) {
      expect(preset).toHaveProperty('label');
      expect(preset).toHaveProperty('days');
    }
  });

  it('should include common presets', () => {
    const labels = DATE_RANGE_PRESETS.map(p => p.label);
    expect(labels.some(l => l.toLowerCase().includes('hoy'))).toBe(true);
    expect(labels.some(l => l.toLowerCase().includes('7'))).toBe(true);
    expect(labels.some(l => l.toLowerCase().includes('30'))).toBe(true);
  });
});

// ========================================
// VALIDATION_RULES TESTS
// ========================================

describe('VALIDATION_RULES', () => {
  it('should have item validation rules', () => {
    expect(VALIDATION_RULES).toHaveProperty('item');
    expect(VALIDATION_RULES.item).toHaveProperty('name');
    expect(VALIDATION_RULES.item).toHaveProperty('sku');
    expect(VALIDATION_RULES.item).toHaveProperty('current_stock');
    expect(VALIDATION_RULES.item).toHaveProperty('minimum_stock');
    expect(VALIDATION_RULES.item).toHaveProperty('unit_cost');
  });

  it('should have recipe validation rules', () => {
    expect(VALIDATION_RULES).toHaveProperty('recipe');
    expect(VALIDATION_RULES.recipe).toHaveProperty('yield_quantity');
    expect(VALIDATION_RULES.recipe).toHaveProperty('ingredients');
  });

  it('should have movement validation rules', () => {
    expect(VALIDATION_RULES).toHaveProperty('movement');
    expect(VALIDATION_RULES.movement).toHaveProperty('quantity');
  });

  it('should have reasonable min/max for name', () => {
    expect(VALIDATION_RULES.item.name.minLength).toBeGreaterThan(0);
    expect(VALIDATION_RULES.item.name.maxLength).toBeGreaterThan(VALIDATION_RULES.item.name.minLength);
  });

  it('should have SKU pattern as regex', () => {
    expect(VALIDATION_RULES.item.sku.pattern).toBeInstanceOf(RegExp);
  });
});

// ========================================
// TOAST_CONFIG TESTS
// ========================================

describe('TOAST_CONFIG', () => {
  it('should have duration', () => {
    expect(TOAST_CONFIG.duration).toBeDefined();
    expect(typeof TOAST_CONFIG.duration).toBe('number');
    expect(TOAST_CONFIG.duration).toBeGreaterThan(0);
  });

  it('should have position', () => {
    expect(TOAST_CONFIG.position).toBeDefined();
    expect(typeof TOAST_CONFIG.position).toBe('string');
  });

  it('should have messages for item operations', () => {
    expect(TOAST_CONFIG.messages.item).toHaveProperty('created');
    expect(TOAST_CONFIG.messages.item).toHaveProperty('updated');
    expect(TOAST_CONFIG.messages.item).toHaveProperty('deleted');
    expect(TOAST_CONFIG.messages.item).toHaveProperty('error');
  });

  it('should have messages for recipe operations', () => {
    expect(TOAST_CONFIG.messages.recipe).toHaveProperty('created');
    expect(TOAST_CONFIG.messages.recipe).toHaveProperty('updated');
    expect(TOAST_CONFIG.messages.recipe).toHaveProperty('deleted');
  });

  it('should have messages for movement operations', () => {
    expect(TOAST_CONFIG.messages.movement).toHaveProperty('recorded');
    expect(TOAST_CONFIG.messages.movement).toHaveProperty('error');
  });
});

// ========================================
// SKELETON_CONFIG TESTS
// ========================================

describe('SKELETON_CONFIG', () => {
  it('should have item card skeleton config', () => {
    expect(SKELETON_CONFIG).toHaveProperty('itemCard');
    expect(SKELETON_CONFIG.itemCard).toHaveProperty('height');
    expect(SKELETON_CONFIG.itemCard).toHaveProperty('lines');
    expect(SKELETON_CONFIG.itemCard).toHaveProperty('animation');
  });

  it('should have table skeleton config', () => {
    expect(SKELETON_CONFIG).toHaveProperty('table');
    expect(SKELETON_CONFIG.table).toHaveProperty('rows');
    expect(SKELETON_CONFIG.table).toHaveProperty('columns');
  });

  it('should have stat skeleton config', () => {
    expect(SKELETON_CONFIG).toHaveProperty('stat');
    expect(SKELETON_CONFIG.stat).toHaveProperty('height');
    expect(SKELETON_CONFIG.stat).toHaveProperty('width');
  });
});

// ========================================
// EMPTY_STATE_CONFIG TESTS
// ========================================

describe('EMPTY_STATE_CONFIG', () => {
  it('should have inventory empty state', () => {
    expect(EMPTY_STATE_CONFIG).toHaveProperty('inventory');
    expect(EMPTY_STATE_CONFIG.inventory).toHaveProperty('icon');
    expect(EMPTY_STATE_CONFIG.inventory).toHaveProperty('title');
    expect(EMPTY_STATE_CONFIG.inventory).toHaveProperty('description');
    expect(EMPTY_STATE_CONFIG.inventory).toHaveProperty('action');
  });

  it('should have recipes empty state', () => {
    expect(EMPTY_STATE_CONFIG).toHaveProperty('recipes');
  });

  it('should have movements empty state', () => {
    expect(EMPTY_STATE_CONFIG).toHaveProperty('movements');
  });

  it('should have alerts empty state', () => {
    expect(EMPTY_STATE_CONFIG).toHaveProperty('alerts');
  });

  it('should not have action for movements (read-only list)', () => {
    // movements is read-only, so it shouldn't have an action property
    expect('action' in EMPTY_STATE_CONFIG.movements).toBe(false);
  });
});
