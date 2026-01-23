// =====================================================
// TIS TIS PLATFORM - Inventory Validation Helpers
// Validation logic for forms and business rules
// =====================================================

import type {
  InventoryItemFormData,
  RecipeFormData,
  MovementFormData,
} from '../types';
import { VALIDATION_RULES } from '../config/inventory-config';

// ========================================
// VALIDATION RESULT TYPES
// ========================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ========================================
// INVENTORY ITEM VALIDATION
// ========================================

/**
 * Validate inventory item form data
 */
export function validateInventoryItem(data: Partial<InventoryItemFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  // Name validation
  if (data.name !== undefined) {
    const rules = VALIDATION_RULES.item.name;
    if (rules.required && !data.name) {
      errors.push({
        field: 'name',
        message: 'El nombre es requerido',
        code: 'REQUIRED',
      });
    } else if (data.name) {
      if (data.name.length < rules.minLength) {
        errors.push({
          field: 'name',
          message: `El nombre debe tener al menos ${rules.minLength} caracteres`,
          code: 'MIN_LENGTH',
        });
      }
      if (data.name.length > rules.maxLength) {
        errors.push({
          field: 'name',
          message: `El nombre no puede exceder ${rules.maxLength} caracteres`,
          code: 'MAX_LENGTH',
        });
      }
    }
  }

  // SKU validation
  if (data.sku !== undefined && data.sku) {
    const rules = VALIDATION_RULES.item.sku;
    if (!rules.pattern.test(data.sku)) {
      errors.push({
        field: 'sku',
        message: 'SKU debe contener solo letras mayúsculas, números y guiones',
        code: 'INVALID_FORMAT',
      });
    }
    if (data.sku.length > rules.maxLength) {
      errors.push({
        field: 'sku',
        message: `SKU no puede exceder ${rules.maxLength} caracteres`,
        code: 'MAX_LENGTH',
      });
    }
  }

  // Current stock validation
  const currentStockRules = VALIDATION_RULES.item.current_stock;
  if (data.current_stock === undefined || data.current_stock === null) {
    if (currentStockRules.required) {
      errors.push({
        field: 'current_stock',
        message: 'El stock actual es requerido',
        code: 'REQUIRED',
      });
    }
  } else if (data.current_stock < currentStockRules.min) {
    errors.push({
      field: 'current_stock',
      message: 'El stock actual no puede ser negativo',
      code: 'MIN_VALUE',
    });
  }

  // Minimum stock validation
  const minStockRules = VALIDATION_RULES.item.minimum_stock;
  if (data.minimum_stock === undefined || data.minimum_stock === null) {
    if (minStockRules.required) {
      errors.push({
        field: 'minimum_stock',
        message: 'El stock mínimo es requerido',
        code: 'REQUIRED',
      });
    }
  } else if (data.minimum_stock < minStockRules.min) {
    errors.push({
      field: 'minimum_stock',
      message: 'El stock mínimo no puede ser negativo',
      code: 'MIN_VALUE',
    });
  }

  // Unit cost validation
  const unitCostRules = VALIDATION_RULES.item.unit_cost;
  if (data.unit_cost === undefined || data.unit_cost === null) {
    if (unitCostRules.required) {
      errors.push({
        field: 'unit_cost',
        message: 'El costo unitario es requerido',
        code: 'REQUIRED',
      });
    }
  } else if (data.unit_cost < unitCostRules.min) {
    errors.push({
      field: 'unit_cost',
      message: 'El costo unitario no puede ser negativo',
      code: 'MIN_VALUE',
    });
  }

  // Maximum stock vs minimum stock
  if (data.maximum_stock !== undefined && data.minimum_stock !== undefined) {
    if (data.maximum_stock < data.minimum_stock) {
      errors.push({
        field: 'maximum_stock',
        message: 'El stock máximo debe ser mayor al stock mínimo',
        code: 'INVALID_RANGE',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ========================================
// RECIPE VALIDATION
// ========================================

/**
 * Validate recipe form data
 */
export function validateRecipe(data: Partial<RecipeFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  // Yield quantity validation
  const yieldRules = VALIDATION_RULES.recipe.yield_quantity;
  if (data.yield_quantity === undefined || data.yield_quantity === null) {
    if (yieldRules.required) {
      errors.push({
        field: 'yield_quantity',
        message: 'El rendimiento es requerido',
        code: 'REQUIRED',
      });
    }
  } else if (data.yield_quantity < yieldRules.min) {
    errors.push({
      field: 'yield_quantity',
      message: 'El rendimiento debe ser mayor a 0',
      code: 'MIN_VALUE',
    });
  }

  // Ingredients validation
  if (data.ingredients !== undefined) {
    const rules = VALIDATION_RULES.recipe.ingredients;
    if (rules.required && (!data.ingredients || data.ingredients.length === 0)) {
      errors.push({
        field: 'ingredients',
        message: 'La receta debe tener al menos un ingrediente',
        code: 'MIN_ITEMS',
      });
    }

    // Validate each ingredient
    data.ingredients?.forEach((ingredient, index) => {
      if (!ingredient.inventory_item_id) {
        errors.push({
          field: `ingredients[${index}].inventory_item_id`,
          message: `Ingrediente ${index + 1}: Debe seleccionar un item de inventario`,
          code: 'REQUIRED',
        });
      }
      if (ingredient.quantity <= 0) {
        errors.push({
          field: `ingredients[${index}].quantity`,
          message: `Ingrediente ${index + 1}: La cantidad debe ser mayor a 0`,
          code: 'MIN_VALUE',
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ========================================
// MOVEMENT VALIDATION
// ========================================

/**
 * Validate movement form data
 */
export function validateMovement(data: Partial<MovementFormData>): ValidationResult {
  const errors: ValidationError[] = [];

  // Quantity validation
  const quantityRules = VALIDATION_RULES.movement.quantity;
  if (data.quantity === undefined || data.quantity === null) {
    if (quantityRules.required) {
      errors.push({
        field: 'quantity',
        message: 'La cantidad es requerida',
        code: 'REQUIRED',
      });
    }
  } else if (quantityRules.notZero && data.quantity === 0) {
    errors.push({
      field: 'quantity',
      message: 'La cantidad no puede ser cero',
      code: 'INVALID_VALUE',
    });
  }

  // Movement type validation
  if (data.movement_type !== undefined) {
    if (!data.movement_type) {
      errors.push({
        field: 'movement_type',
        message: 'El tipo de movimiento es requerido',
        code: 'REQUIRED',
      });
    } else if (!VALID_MOVEMENT_TYPES.includes(data.movement_type as typeof VALID_MOVEMENT_TYPES[number])) {
      errors.push({
        field: 'movement_type',
        message: `Tipo de movimiento inválido. Debe ser: ${VALID_MOVEMENT_TYPES.join(', ')}`,
        code: 'INVALID_VALUE',
      });
    }
  }

  // Item ID validation
  if (data.item_id !== undefined) {
    if (!data.item_id) {
      errors.push({
        field: 'item_id',
        message: 'Debe seleccionar un item',
        code: 'REQUIRED',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Format validation errors as a single message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0].message;
  return errors.map((err, i) => `${i + 1}. ${err.message}`).join('\n');
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if a string is a valid SKU format
 */
export function isValidSKU(value: string): boolean {
  return VALIDATION_RULES.item.sku.pattern.test(value);
}

/**
 * Valid item types
 */
const VALID_ITEM_TYPES = ['ingredient', 'supply', 'equipment', 'packaging'] as const;

/**
 * Valid storage types
 */
const VALID_STORAGE_TYPES = ['dry', 'refrigerated', 'frozen', 'ambient'] as const;

/**
 * Valid movement types
 */
const VALID_MOVEMENT_TYPES = [
  'purchase', 'sale', 'consumption', 'waste', 'adjustment',
  'transfer_in', 'transfer_out', 'return', 'production'
] as const;

/**
 * Validate a complete inventory item for creation (all required fields must be present)
 */
export function validateCompleteInventoryItem(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Type guard
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'data', message: 'Los datos son requeridos', code: 'REQUIRED' }],
    };
  }

  const item = data as Record<string, unknown>;

  // Check all required fields are present
  const requiredFields = ['name', 'item_type', 'unit', 'unit_cost', 'current_stock', 'minimum_stock'];
  for (const field of requiredFields) {
    if (item[field] === undefined || item[field] === null || item[field] === '') {
      errors.push({
        field,
        message: `El campo ${field} es requerido`,
        code: 'REQUIRED',
      });
    }
  }

  // Validate item_type is a valid enum value
  if (item.item_type && !VALID_ITEM_TYPES.includes(item.item_type as typeof VALID_ITEM_TYPES[number])) {
    errors.push({
      field: 'item_type',
      message: `Tipo de item inválido. Debe ser: ${VALID_ITEM_TYPES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate storage_type if provided
  if (item.storage_type && !VALID_STORAGE_TYPES.includes(item.storage_type as typeof VALID_STORAGE_TYPES[number])) {
    errors.push({
      field: 'storage_type',
      message: `Tipo de almacenamiento inválido. Debe ser: ${VALID_STORAGE_TYPES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // If missing required fields, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Now validate the values using existing function
  return validateInventoryItem(item as Partial<InventoryItemFormData>);
}
