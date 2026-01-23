// =====================================================
// TIS TIS PLATFORM - Inventory Validation Tests
// Unit tests for validation helpers
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  validateInventoryItem,
  validateRecipe,
  validateMovement,
  validateCompleteInventoryItem,
  formatValidationErrors,
  isValidUUID,
  isValidSKU,
} from '@/features/inventory-management/lib/validation';

// ========================================
// validateInventoryItem TESTS
// ========================================

describe('validateInventoryItem', () => {
  describe('name validation', () => {
    it('should fail when name is empty and required', () => {
      const result = validateInventoryItem({ name: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          code: 'REQUIRED',
        })
      );
    });

    it('should fail when name is too short', () => {
      const result = validateInventoryItem({ name: 'A' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          code: 'MIN_LENGTH',
        })
      );
    });

    it('should fail when name exceeds max length', () => {
      const longName = 'A'.repeat(256);
      const result = validateInventoryItem({ name: longName });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          code: 'MAX_LENGTH',
        })
      );
    });

    it('should pass with valid name', () => {
      const result = validateInventoryItem({ name: 'Tomate Rojo' });
      expect(result.errors.filter(e => e.field === 'name')).toHaveLength(0);
    });
  });

  describe('SKU validation', () => {
    it('should fail when SKU has invalid characters', () => {
      const result = validateInventoryItem({ sku: 'sku-lowercase' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'sku',
          code: 'INVALID_FORMAT',
        })
      );
    });

    it('should fail when SKU has special characters', () => {
      const result = validateInventoryItem({ sku: 'SKU@123' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'sku',
          code: 'INVALID_FORMAT',
        })
      );
    });

    it('should fail when SKU exceeds max length', () => {
      const longSku = 'A'.repeat(51);
      const result = validateInventoryItem({ sku: longSku });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'sku',
          code: 'MAX_LENGTH',
        })
      );
    });

    it('should pass with valid SKU', () => {
      const result = validateInventoryItem({ sku: 'TOM-001-RED' });
      expect(result.errors.filter(e => e.field === 'sku')).toHaveLength(0);
    });

    it('should pass when SKU is undefined (optional field)', () => {
      const result = validateInventoryItem({});
      expect(result.errors.filter(e => e.field === 'sku')).toHaveLength(0);
    });
  });

  describe('current_stock validation', () => {
    it('should fail when current_stock is required but undefined', () => {
      const result = validateInventoryItem({ current_stock: undefined });
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'current_stock',
          code: 'REQUIRED',
        })
      );
    });

    it('should fail when current_stock is negative', () => {
      const result = validateInventoryItem({ current_stock: -5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'current_stock',
          code: 'MIN_VALUE',
        })
      );
    });

    it('should pass when current_stock is zero', () => {
      const result = validateInventoryItem({ current_stock: 0 });
      expect(result.errors.filter(e => e.field === 'current_stock')).toHaveLength(0);
    });

    it('should pass when current_stock is positive', () => {
      const result = validateInventoryItem({ current_stock: 100 });
      expect(result.errors.filter(e => e.field === 'current_stock')).toHaveLength(0);
    });
  });

  describe('minimum_stock validation', () => {
    it('should fail when minimum_stock is negative', () => {
      const result = validateInventoryItem({ minimum_stock: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'minimum_stock',
          code: 'MIN_VALUE',
        })
      );
    });

    it('should pass when minimum_stock is zero', () => {
      const result = validateInventoryItem({ minimum_stock: 0 });
      expect(result.errors.filter(e => e.field === 'minimum_stock')).toHaveLength(0);
    });
  });

  describe('unit_cost validation', () => {
    it('should fail when unit_cost is negative', () => {
      const result = validateInventoryItem({ unit_cost: -10 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'unit_cost',
          code: 'MIN_VALUE',
        })
      );
    });

    it('should pass when unit_cost is zero', () => {
      const result = validateInventoryItem({ unit_cost: 0 });
      expect(result.errors.filter(e => e.field === 'unit_cost')).toHaveLength(0);
    });
  });

  describe('maximum_stock vs minimum_stock validation', () => {
    it('should fail when maximum_stock is less than minimum_stock', () => {
      const result = validateInventoryItem({
        minimum_stock: 100,
        maximum_stock: 50,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'maximum_stock',
          code: 'INVALID_RANGE',
        })
      );
    });

    it('should pass when maximum_stock is greater than minimum_stock', () => {
      const result = validateInventoryItem({
        minimum_stock: 10,
        maximum_stock: 100,
      });
      expect(result.errors.filter(e => e.field === 'maximum_stock')).toHaveLength(0);
    });

    it('should pass when maximum_stock equals minimum_stock', () => {
      const result = validateInventoryItem({
        minimum_stock: 50,
        maximum_stock: 50,
      });
      expect(result.errors.filter(e => e.field === 'maximum_stock')).toHaveLength(0);
    });
  });

  describe('complete valid item', () => {
    it('should pass with all valid fields', () => {
      const result = validateInventoryItem({
        name: 'Tomate Rojo',
        sku: 'TOM-001',
        current_stock: 50,
        minimum_stock: 10,
        maximum_stock: 100,
        unit_cost: 25.50,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ========================================
// validateRecipe TESTS
// ========================================

describe('validateRecipe', () => {
  describe('yield_quantity validation', () => {
    it('should fail when yield_quantity is undefined and required', () => {
      const result = validateRecipe({ yield_quantity: undefined });
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'yield_quantity',
          code: 'REQUIRED',
        })
      );
    });

    it('should fail when yield_quantity is less than minimum', () => {
      const result = validateRecipe({ yield_quantity: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'yield_quantity',
          code: 'MIN_VALUE',
        })
      );
    });

    it('should pass with valid yield_quantity', () => {
      const result = validateRecipe({ yield_quantity: 4 });
      expect(result.errors.filter(e => e.field === 'yield_quantity')).toHaveLength(0);
    });
  });

  describe('ingredients validation', () => {
    it('should fail when ingredients array is empty', () => {
      const result = validateRecipe({ ingredients: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'ingredients',
          code: 'MIN_ITEMS',
        })
      );
    });

    it('should fail when ingredient has no inventory_item_id', () => {
      const result = validateRecipe({
        ingredients: [
          {
            inventory_item_id: '',
            quantity: 1,
            unit: 'kg',
            display_order: 0,
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'ingredients[0].inventory_item_id',
          code: 'REQUIRED',
        })
      );
    });

    it('should fail when ingredient quantity is zero or negative', () => {
      const result = validateRecipe({
        ingredients: [
          {
            inventory_item_id: 'valid-uuid-here',
            quantity: 0,
            unit: 'kg',
            display_order: 0,
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'ingredients[0].quantity',
          code: 'MIN_VALUE',
        })
      );
    });

    it('should pass with valid ingredients', () => {
      const result = validateRecipe({
        ingredients: [
          {
            inventory_item_id: 'valid-uuid-here',
            quantity: 2.5,
            unit: 'kg',
            display_order: 0,
          },
        ],
      });
      expect(result.errors.filter(e => e.field.startsWith('ingredients'))).toHaveLength(0);
    });
  });
});

// ========================================
// validateMovement TESTS
// ========================================

describe('validateMovement', () => {
  describe('quantity validation', () => {
    it('should fail when quantity is undefined and required', () => {
      const result = validateMovement({ quantity: undefined });
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'quantity',
          code: 'REQUIRED',
        })
      );
    });

    it('should fail when quantity is zero', () => {
      const result = validateMovement({ quantity: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'quantity',
          code: 'INVALID_VALUE',
        })
      );
    });

    it('should pass with positive quantity', () => {
      const result = validateMovement({ quantity: 10 });
      expect(result.errors.filter(e => e.field === 'quantity')).toHaveLength(0);
    });

    it('should pass with negative quantity (for outbound movements)', () => {
      const result = validateMovement({ quantity: -5 });
      expect(result.errors.filter(e => e.field === 'quantity')).toHaveLength(0);
    });
  });

  describe('movement_type validation', () => {
    it('should fail with invalid movement_type', () => {
      const result = validateMovement({ movement_type: 'invalid_type' as never });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'movement_type',
          code: 'INVALID_VALUE',
        })
      );
    });

    it('should pass with valid movement_type', () => {
      const result = validateMovement({ movement_type: 'purchase' });
      expect(result.errors.filter(e => e.field === 'movement_type')).toHaveLength(0);
    });
  });

  describe('item_id validation', () => {
    it('should fail when item_id is empty', () => {
      const result = validateMovement({ item_id: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'item_id',
          code: 'REQUIRED',
        })
      );
    });

    it('should pass with valid item_id', () => {
      const result = validateMovement({ item_id: 'valid-uuid-here' });
      expect(result.errors.filter(e => e.field === 'item_id')).toHaveLength(0);
    });
  });
});

// ========================================
// validateCompleteInventoryItem TESTS
// ========================================

describe('validateCompleteInventoryItem', () => {
  it('should fail when data is null', () => {
    const result = validateCompleteInventoryItem(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'data',
        code: 'REQUIRED',
      })
    );
  });

  it('should fail when data is not an object', () => {
    const result = validateCompleteInventoryItem('string');
    expect(result.valid).toBe(false);
  });

  it('should fail when required fields are missing', () => {
    const result = validateCompleteInventoryItem({
      name: 'Test Item',
    });
    expect(result.valid).toBe(false);
    // Should have errors for missing required fields
    const missingFields = ['item_type', 'unit', 'unit_cost', 'current_stock', 'minimum_stock'];
    for (const field of missingFields) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field,
          code: 'REQUIRED',
        })
      );
    }
  });

  it('should fail with invalid item_type', () => {
    const result = validateCompleteInventoryItem({
      name: 'Test Item',
      item_type: 'invalid',
      unit: 'kg',
      unit_cost: 10,
      current_stock: 50,
      minimum_stock: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'item_type',
        code: 'INVALID_VALUE',
      })
    );
  });

  it('should fail with invalid storage_type', () => {
    const result = validateCompleteInventoryItem({
      name: 'Test Item',
      item_type: 'ingredient',
      unit: 'kg',
      unit_cost: 10,
      current_stock: 50,
      minimum_stock: 10,
      storage_type: 'invalid',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'storage_type',
        code: 'INVALID_VALUE',
      })
    );
  });

  it('should pass with all valid required fields', () => {
    const result = validateCompleteInventoryItem({
      name: 'Tomate Rojo',
      item_type: 'ingredient',
      unit: 'kg',
      unit_cost: 25.50,
      current_stock: 50,
      minimum_stock: 10,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ========================================
// UTILITY FUNCTIONS TESTS
// ========================================

describe('formatValidationErrors', () => {
  it('should return empty string for no errors', () => {
    const result = formatValidationErrors([]);
    expect(result).toBe('');
  });

  it('should return single message for one error', () => {
    const errors = [
      { field: 'name', message: 'El nombre es requerido', code: 'REQUIRED' },
    ];
    const result = formatValidationErrors(errors);
    expect(result).toBe('El nombre es requerido');
  });

  it('should return numbered list for multiple errors', () => {
    const errors = [
      { field: 'name', message: 'El nombre es requerido', code: 'REQUIRED' },
      { field: 'sku', message: 'SKU inválido', code: 'INVALID_FORMAT' },
    ];
    const result = formatValidationErrors(errors);
    expect(result).toContain('1. El nombre es requerido');
    expect(result).toContain('2. SKU inválido');
  });
});

describe('isValidUUID', () => {
  it('should return true for valid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
  });

  it('should return false for invalid UUIDs', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    expect(isValidUUID('gggggggg-gggg-gggg-gggg-gggggggggggg')).toBe(false);
  });
});

describe('isValidSKU', () => {
  it('should return true for valid SKUs', () => {
    expect(isValidSKU('ABC-123')).toBe(true);
    expect(isValidSKU('TOM-001-RED')).toBe(true);
    expect(isValidSKU('PRODUCT123')).toBe(true);
    expect(isValidSKU('A1-B2-C3')).toBe(true);
  });

  it('should return false for invalid SKUs', () => {
    expect(isValidSKU('abc-123')).toBe(false);  // lowercase
    expect(isValidSKU('ABC 123')).toBe(false);  // space
    expect(isValidSKU('ABC@123')).toBe(false);  // special char
    expect(isValidSKU('ABC_123')).toBe(false);  // underscore
  });
});
