'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Search,
  Package,
  Scale,
  DollarSign,
  AlertTriangle,
  ChefHat,
  FileText,
  Info,
  Check,
  X as XIcon,
  Loader2
} from 'lucide-react';
import type { RecipeIngredient, MenuItemRecipe } from '../types';
import * as menuService from '../services/menu.service';
import * as inventoryService from '@/src/features/restaurant-inventory/services/inventory.service';
import type { InventoryItem } from '@/src/features/restaurant-inventory/types';

// ======================
// TYPES
// ======================

interface RecipeEditorProps {
  menuItemId: string | null;
  branchId: string;
  onCostCalculated?: (cost: number) => void;
}

interface LocalIngredient {
  id: string;
  inventory_item_id: string;
  inventory_item: InventoryItem | null;
  quantity: number;
  unit: string;
  preparation_notes: string;
  is_optional: boolean;
}

// ======================
// UNIT OPTIONS
// ======================

const UNIT_OPTIONS = [
  { value: 'g', label: 'Gramos (g)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'l', label: 'Litros (l)' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'porcion', label: 'Porción' },
  { value: 'cucharada', label: 'Cucharada' },
  { value: 'cucharadita', label: 'Cucharadita' },
  { value: 'taza', label: 'Taza' },
  { value: 'pieza', label: 'Pieza' },
];

// ======================
// INGREDIENT SEARCH MODAL
// ======================

function IngredientSearchModal({
  isOpen,
  onClose,
  onSelect,
  branchId,
  excludeIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: InventoryItem) => void;
  branchId: string;
  excludeIds: string[];
}) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const isOpenRef = useRef(isOpen);

  // Memoize excludeIds Set for stable reference and efficient lookups
  const excludeIdsSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  // Keep track of isOpen to prevent stale closures
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setItems([]);
      return;
    }

    // Only load when modal is actually open
    let isMounted = true;

    const loadItems = async () => {
      if (!isOpenRef.current) return;

      setLoading(true);
      try {
        const result = await inventoryService.getItems({
          branch_id: branchId,
          search: search || undefined,
          limit: 50,
        });

        // Check if still mounted and modal still open before updating state
        if (isMounted && isOpenRef.current) {
          setItems(result.filter(item => !excludeIdsSet.has(item.id)));
        }
      } catch (error) {
        console.error('Error loading inventory items:', error);
      } finally {
        if (isMounted && isOpenRef.current) {
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(loadItems, 300);
    return () => {
      isMounted = false;
      clearTimeout(debounce);
    };
  }, [isOpen, search, branchId, excludeIdsSet]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }, [onClose]);

  // Handle modal content click - prevent any propagation
  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Handle ingredient selection
  const handleSelect = useCallback((item: InventoryItem) => {
    onSelect(item);
    // Delay close slightly to ensure selection is processed
    setTimeout(() => {
      onClose();
    }, 10);
  }, [onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Backdrop - clicking here closes the modal */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl"
          onClick={handleModalClick}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-tis-coral/10 rounded-xl flex items-center justify-center">
                <Package className="w-4.5 h-4.5 text-tis-coral" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                Agregar Ingrediente
              </h3>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ingrediente..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Items List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-tis-coral animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  {search ? 'No se encontraron ingredientes' : 'Sin ingredientes disponibles'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(item);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Stock: {item.current_stock} {item.unit}
                        {item.unit_cost ? ` • $${item.unit_cost.toFixed(2)}/${item.unit}` : ''}
                      </p>
                    </div>
                    {item.current_stock <= (item.minimum_stock || 0) && (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// INGREDIENT ROW
// ======================

function IngredientRow({
  ingredient,
  index,
  onUpdate,
  onRemove,
}: {
  ingredient: LocalIngredient;
  index: number;
  onUpdate: (index: number, field: keyof LocalIngredient, value: string | number | boolean) => void;
  onRemove: (index: number) => void;
}) {
  const unitCost = ingredient.inventory_item?.unit_cost || 0;
  const totalCost = unitCost * ingredient.quantity;
  const isLowStock = ingredient.inventory_item &&
    ingredient.inventory_item.current_stock <= (ingredient.inventory_item.minimum_stock || 0);

  return (
    <div className="group relative bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-4">
        {/* Item Info */}
        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
          {ingredient.inventory_item?.image_url ? (
            <img
              src={ingredient.inventory_item.image_url}
              alt={ingredient.inventory_item.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <Package className="w-5 h-5 text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name & Stock */}
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-medium text-slate-800 truncate">
              {ingredient.inventory_item?.name || 'Ingrediente'}
            </h4>
            {isLowStock && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-600 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Stock bajo
              </span>
            )}
            {ingredient.is_optional && (
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                Opcional
              </span>
            )}
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Cantidad
              </label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  value={ingredient.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)}
                  step="0.001"
                  min="0"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Unidad
              </label>
              <select
                value={ingredient.unit}
                onChange={(e) => onUpdate(index, 'unit', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
              >
                {UNIT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost Info */}
          <div className="flex items-center justify-between text-xs">
            <div className="text-slate-500">
              Stock: <span className="font-medium text-slate-700">
                {ingredient.inventory_item?.current_stock || 0} {ingredient.inventory_item?.unit}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <DollarSign className="w-3 h-3" />
              <span className="font-medium">{totalCost.toFixed(2)}</span>
              <span className="text-slate-400">
                ({unitCost.toFixed(2)}/{ingredient.unit})
              </span>
            </div>
          </div>

          {/* Optional Toggle & Notes */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ingredient.is_optional}
                onChange={(e) => onUpdate(index, 'is_optional', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-tis-coral focus:ring-tis-coral"
              />
              <span className="text-xs text-slate-600">Opcional</span>
            </label>
            <div className="flex-1">
              <input
                type="text"
                value={ingredient.preparation_notes}
                onChange={(e) => onUpdate(index, 'preparation_notes', e.target.value)}
                placeholder="Notas de preparación..."
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded
                  focus:outline-none focus:ring-1 focus:ring-tis-coral/20 focus:border-tis-coral"
              />
            </div>
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(index)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg
            opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function RecipeEditor({ menuItemId, branchId, onCostCalculated }: RecipeEditorProps) {
  const [recipe, setRecipe] = useState<MenuItemRecipe | null>(null);
  const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
  const [yieldQuantity, setYieldQuantity] = useState(1);
  const [yieldUnit, setYieldUnit] = useState('porcion');
  const [preparationNotes, setPreparationNotes] = useState('');
  const [storageNotes, setStorageNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Memoize excludeIds to prevent unnecessary re-renders of the search modal
  const excludeIds = useMemo(
    () => ingredients.map(i => i.inventory_item_id),
    [ingredients]
  );

  // Calculate total cost
  const totalCost = ingredients.reduce((sum, ing) => {
    const unitCost = ing.inventory_item?.unit_cost || 0;
    return sum + (unitCost * ing.quantity);
  }, 0);

  const costPerPortion = yieldQuantity > 0 ? totalCost / yieldQuantity : 0;

  // Load recipe when menuItemId changes
  useEffect(() => {
    if (!menuItemId) {
      setRecipe(null);
      setIngredients([]);
      setYieldQuantity(1);
      setYieldUnit('porcion');
      setPreparationNotes('');
      setStorageNotes('');
      return;
    }

    const loadRecipe = async () => {
      setLoading(true);
      try {
        const response = await menuService.getRecipe(menuItemId);
        if (response.success && response.data.recipe) {
          const r = response.data.recipe;
          setRecipe(r);
          setYieldQuantity(r.yield_quantity || 1);
          setYieldUnit(r.yield_unit || 'porcion');
          setPreparationNotes(r.preparation_notes || '');
          setStorageNotes(r.storage_notes || '');

          // Map ingredients
          const mappedIngredients: LocalIngredient[] = (r.ingredients || []).map((ing: RecipeIngredient) => ({
            id: ing.id,
            inventory_item_id: ing.inventory_item_id,
            inventory_item: ing.inventory_item as unknown as InventoryItem || null,
            quantity: ing.quantity,
            unit: ing.unit,
            preparation_notes: ing.preparation_notes || '',
            is_optional: ing.is_optional,
          }));
          setIngredients(mappedIngredients);
        }
      } catch (error) {
        console.error('Error loading recipe:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecipe();
  }, [menuItemId]);

  // Notify parent of cost changes
  useEffect(() => {
    onCostCalculated?.(costPerPortion);
  }, [costPerPortion, onCostCalculated]);

  // Handle adding ingredient
  const handleAddIngredient = useCallback((item: InventoryItem) => {
    const newIngredient: LocalIngredient = {
      id: `temp-${Date.now()}`,
      inventory_item_id: item.id,
      inventory_item: item,
      quantity: 1,
      unit: item.unit || 'g',
      preparation_notes: '',
      is_optional: false,
    };
    setIngredients(prev => [...prev, newIngredient]);
    setHasChanges(true);
  }, []);

  // Handle updating ingredient
  const handleUpdateIngredient = useCallback((
    index: number,
    field: keyof LocalIngredient,
    value: string | number | boolean
  ) => {
    setIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Handle removing ingredient
  const handleRemoveIngredient = useCallback((index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  // Handle save
  const handleSave = async () => {
    if (!menuItemId) return;

    setSaving(true);
    setSaveStatus('idle');

    try {
      await menuService.saveRecipe({
        menu_item_id: menuItemId,
        yield_quantity: yieldQuantity,
        yield_unit: yieldUnit,
        preparation_notes: preparationNotes || undefined,
        storage_notes: storageNotes || undefined,
        ingredients: ingredients.map((ing, index) => ({
          inventory_item_id: ing.inventory_item_id,
          quantity: ing.quantity,
          unit: ing.unit,
          preparation_notes: ing.preparation_notes || undefined,
          is_optional: ing.is_optional,
          display_order: index,
        })),
      });

      setHasChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving recipe:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (!menuItemId) {
    return (
      <div className="text-center py-12">
        <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">
          Guarda el platillo primero para agregar la receta
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-tis-coral animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cost Summary Card */}
      <div className="bg-gradient-to-br from-tis-coral/5 to-tis-coral/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <DollarSign className="w-5 h-5 text-tis-coral" />
            </div>
            <div>
              <p className="text-xs text-slate-600">Costo de producción</p>
              <p className="text-xl font-semibold text-slate-800">
                ${costPerPortion.toFixed(2)} <span className="text-sm font-normal text-slate-500">/ {yieldUnit}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Costo total</p>
            <p className="text-sm font-medium text-slate-700">${totalCost.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Yield Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Rendimiento
          </label>
          <input
            type="number"
            value={yieldQuantity}
            onChange={(e) => {
              setYieldQuantity(parseFloat(e.target.value) || 1);
              setHasChanges(true);
            }}
            min="1"
            step="1"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Unidad de rendimiento
          </label>
          <select
            value={yieldUnit}
            onChange={(e) => {
              setYieldUnit(e.target.value);
              setHasChanges(true);
            }}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
          >
            <option value="porcion">Porciones</option>
            <option value="unidad">Unidades</option>
            <option value="pieza">Piezas</option>
            <option value="orden">Órdenes</option>
          </select>
        </div>
      </div>

      {/* Ingredients Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Ingredientes ({ingredients.length})
          </label>
          <button
            onClick={() => setShowSearch(true)}
            className="text-sm text-tis-coral hover:text-tis-coral/80 flex items-center gap-1.5 font-medium"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>

        {ingredients.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">
              Sin ingredientes agregados
            </p>
            <button
              onClick={() => setShowSearch(true)}
              className="px-4 py-2 text-sm font-medium text-tis-coral bg-tis-coral/10
                hover:bg-tis-coral/20 rounded-lg transition-colors"
            >
              Agregar ingrediente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                index={index}
                onUpdate={handleUpdateIngredient}
                onRemove={handleRemoveIngredient}
              />
            ))}
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Notas de preparación
          </label>
          <textarea
            value={preparationNotes}
            onChange={(e) => {
              setPreparationNotes(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Instrucciones de preparación..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none
              focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Notas de almacenamiento
          </label>
          <textarea
            value={storageNotes}
            onChange={(e) => {
              setStorageNotes(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Condiciones de almacenamiento..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none
              focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
          />
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          {saveStatus === 'saved' && (
            <span className="text-sm text-emerald-600 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              Guardado
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Error al guardar
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-tis-coral
              hover:bg-tis-coral/90 rounded-lg transition-colors disabled:opacity-50
              flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar receta
              </>
            )}
          </button>
        </div>
      )}

      {/* Search Modal */}
      <IngredientSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={handleAddIngredient}
        branchId={branchId}
        excludeIds={excludeIds}
      />
    </div>
  );
}

export default RecipeEditor;
