// =====================================================
// TIS TIS PLATFORM - Inventory Configuration
// Design system configuration for Inventory Management
// Inspired by Apple/Google elegant design principles
// =====================================================

import type { MovementType, StockStatus, AlertSeverity } from '../types';

// ========================================
// STOCK STATUS CONFIGURATION
// ========================================

export const STOCK_STATUS_CONFIG: Record<StockStatus, {
  label: string;
  icon: string;
  colors: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    icon: string;
  };
}> = {
  in_stock: {
    label: 'En Stock',
    icon: 'CheckCircle2',
    colors: {
      bg: 'bg-tis-green-100',
      text: 'text-tis-green-700',
      border: 'border-tis-green-300',
      badge: 'bg-gradient-green',
      icon: 'text-tis-green-500',
    },
  },
  low_stock: {
    label: 'Stock Bajo',
    icon: 'AlertTriangle',
    colors: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      border: 'border-amber-300',
      badge: 'bg-gradient-warm',
      icon: 'text-amber-500',
    },
  },
  out_of_stock: {
    label: 'Agotado',
    icon: 'XCircle',
    colors: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-300',
      badge: 'bg-gradient-hot',
      icon: 'text-red-500',
    },
  },
  overstocked: {
    label: 'Sobre Stock',
    icon: 'TrendingUp',
    colors: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-300',
      badge: 'bg-gradient-primary',
      icon: 'text-blue-500',
    },
  },
};

// ========================================
// ALERT SEVERITY CONFIGURATION
// ========================================

export const ALERT_SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string;
  icon: string;
  priority: number;
  colors: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    icon: string;
  };
  animation?: string;
}> = {
  critical: {
    label: 'Crítico',
    icon: 'AlertCircle',
    priority: 3,
    colors: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      badge: 'bg-gradient-hot',
      icon: 'text-red-500',
    },
    animation: 'animate-pulse-soft',
  },
  warning: {
    label: 'Advertencia',
    icon: 'AlertTriangle',
    priority: 2,
    colors: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      badge: 'bg-gradient-warm',
      icon: 'text-amber-500',
    },
  },
  low: {
    label: 'Bajo',
    icon: 'Info',
    priority: 1,
    colors: {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200',
      badge: 'bg-gradient-cold',
      icon: 'text-slate-500',
    },
  },
};

// ========================================
// MOVEMENT TYPE CONFIGURATION
// ========================================

export const MOVEMENT_TYPE_CONFIG: Record<MovementType, {
  label: string;
  shortLabel: string;
  icon: string;
  isInbound: boolean;
  colors: {
    bg: string;
    text: string;
    icon: string;
    badge: string;
  };
  description: string;
}> = {
  purchase: {
    label: 'Compra',
    shortLabel: 'Compra',
    icon: 'ShoppingCart',
    isInbound: true,
    colors: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: 'text-green-500',
      badge: 'bg-green-500',
    },
    description: 'Entrada de mercancía por compra a proveedor',
  },
  sale: {
    label: 'Venta',
    shortLabel: 'Venta',
    icon: 'TrendingUp',
    isInbound: false,
    colors: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: 'text-blue-500',
      badge: 'bg-blue-500',
    },
    description: 'Salida de mercancía por venta',
  },
  consumption: {
    label: 'Consumo',
    shortLabel: 'Consumo',
    icon: 'ChefHat',
    isInbound: false,
    colors: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      icon: 'text-orange-500',
      badge: 'bg-orange-500',
    },
    description: 'Consumo en producción (recetas)',
  },
  waste: {
    label: 'Merma',
    shortLabel: 'Merma',
    icon: 'Trash2',
    isInbound: false,
    colors: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: 'text-red-500',
      badge: 'bg-red-500',
    },
    description: 'Desperdicio o producto en mal estado',
  },
  adjustment: {
    label: 'Ajuste',
    shortLabel: 'Ajuste',
    icon: 'Settings',
    isInbound: false, // NOTE: Bidirectional - actual direction determined by quantity sign at runtime
    colors: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: 'text-blue-500',
      badge: 'bg-blue-500',
    },
    description: 'Ajuste manual de inventario (positivo o negativo)',
  },
  transfer_in: {
    label: 'Transferencia Entrante',
    shortLabel: 'Entrada',
    icon: 'ArrowDownCircle',
    isInbound: true,
    colors: {
      bg: 'bg-tis-green-100',
      text: 'text-tis-green-700',
      icon: 'text-tis-green-500',
      badge: 'bg-tis-green-500',
    },
    description: 'Recepción desde otra sucursal',
  },
  transfer_out: {
    label: 'Transferencia Saliente',
    shortLabel: 'Salida',
    icon: 'ArrowUpCircle',
    isInbound: false,
    colors: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      icon: 'text-slate-500',
      badge: 'bg-slate-500',
    },
    description: 'Envío a otra sucursal',
  },
  return: {
    label: 'Devolución',
    shortLabel: 'Devolución',
    icon: 'RotateCcw',
    isInbound: false, // Devolución A proveedor = salida de nuestro inventario
    colors: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      icon: 'text-purple-500',
      badge: 'bg-purple-500',
    },
    description: 'Devolución a proveedor (salida)',
  },
  production: {
    label: 'Producción',
    shortLabel: 'Producción',
    icon: 'Factory',
    isInbound: true,
    colors: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-700',
      icon: 'text-indigo-500',
      badge: 'bg-indigo-500',
    },
    description: 'Producto fabricado internamente',
  },
};

// ========================================
// ITEM TYPE CONFIGURATION
// ========================================

export const ITEM_TYPE_CONFIG: Record<'ingredient' | 'supply' | 'equipment' | 'packaging', {
  label: string;
  icon: string;
  colors: {
    bg: string;
    text: string;
    icon: string;
    badge: string;
  };
  description: string;
}> = {
  ingredient: {
    label: 'Ingrediente',
    icon: 'Leaf',
    colors: {
      bg: 'bg-tis-green-100',
      text: 'text-tis-green-700',
      icon: 'text-tis-green-500',
      badge: 'bg-tis-green-500',
    },
    description: 'Ingrediente para recetas',
  },
  supply: {
    label: 'Suministro',
    icon: 'Box',
    colors: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: 'text-blue-500',
      badge: 'bg-blue-500',
    },
    description: 'Suministros operativos (servilletas, bolsas, etc)',
  },
  equipment: {
    label: 'Equipo',
    icon: 'Wrench',
    colors: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      icon: 'text-slate-500',
      badge: 'bg-slate-500',
    },
    description: 'Equipo y utensilios',
  },
  packaging: {
    label: 'Empaque',
    icon: 'Package',
    colors: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      icon: 'text-amber-500',
      badge: 'bg-amber-500',
    },
    description: 'Empaques para llevar',
  },
};

// ========================================
// STORAGE TYPE CONFIGURATION
// ========================================

export const STORAGE_TYPE_CONFIG: Record<'dry' | 'refrigerated' | 'frozen' | 'ambient', {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  temperature: string;
}> = {
  dry: {
    label: 'Almacén Seco',
    icon: 'Warehouse',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    temperature: 'Temperatura ambiente controlada',
  },
  refrigerated: {
    label: 'Refrigerado',
    icon: 'Refrigerator',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    temperature: '2°C - 8°C',
  },
  frozen: {
    label: 'Congelado',
    icon: 'Snowflake',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    temperature: '-18°C o menos',
  },
  ambient: {
    label: 'Temperatura Ambiente',
    icon: 'Thermometer',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    temperature: 'Sin control especial',
  },
};

// ========================================
// UNIT TYPES CONFIGURATION
// ========================================

export const UNIT_TYPES = {
  weight: {
    label: 'Peso',
    units: [
      { value: 'kg', label: 'Kilogramo (kg)' },
      { value: 'g', label: 'Gramo (g)' },
      { value: 'lb', label: 'Libra (lb)' },
      { value: 'oz', label: 'Onza (oz)' },
    ],
  },
  volume: {
    label: 'Volumen',
    units: [
      { value: 'l', label: 'Litro (l)' },
      { value: 'ml', label: 'Mililitro (ml)' },
      { value: 'gal', label: 'Galón (gal)' },
      { value: 'qt', label: 'Cuarto (qt)' },
    ],
  },
  count: {
    label: 'Cantidad',
    units: [
      { value: 'unit', label: 'Unidad' },
      { value: 'piece', label: 'Pieza' },
      { value: 'box', label: 'Caja' },
      { value: 'pack', label: 'Paquete' },
      { value: 'bag', label: 'Bolsa' },
    ],
  },
};

// ========================================
// CURRENCY CONFIGURATION
// ========================================

export const CURRENCY_CONFIG = {
  MXN: {
    symbol: '$',
    code: 'MXN',
    name: 'Peso Mexicano',
    format: (amount: number) => `$${amount.toFixed(2)} MXN`,
  },
  USD: {
    symbol: '$',
    code: 'USD',
    name: 'Dólar Estadounidense',
    format: (amount: number) => `$${amount.toFixed(2)} USD`,
  },
};

// ========================================
// STOCK LEVEL THRESHOLDS
// ========================================

export const STOCK_THRESHOLDS = {
  // Percentage thresholds for stock status
  CRITICAL: 0.5, // < 50% of minimum = critical
  WARNING: 0.75, // < 75% of minimum = warning
  LOW: 1.0, // <= 100% of minimum = low
  OVERSTOCK: 1.5, // > 150% of maximum = overstocked
};

// ========================================
// PAGINATION DEFAULTS
// ========================================

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  PAGE_SIZES: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
};

// ========================================
// SORT OPTIONS
// ========================================

export const SORT_OPTIONS = {
  inventory: [
    { value: 'name', label: 'Nombre' },
    { value: 'current_stock', label: 'Stock Actual' },
    { value: 'unit_cost', label: 'Costo Unitario' },
    { value: 'updated_at', label: 'Última Actualización' },
  ],
  movements: [
    { value: 'performed_at', label: 'Fecha' },
    { value: 'quantity', label: 'Cantidad' },
    { value: 'total_cost', label: 'Costo Total' },
  ],
  recipes: [
    { value: 'menu_item_name', label: 'Platillo' },
    { value: 'total_cost', label: 'Costo Total' },
    { value: 'yield_quantity', label: 'Rendimiento' },
  ],
};

// ========================================
// DATE RANGE PRESETS
// ========================================

export type DateRangePreset = {
  label: string;
  days: number | 'month' | 'last_month';
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { label: 'Hoy', days: 0 },
  { label: 'Ayer', days: 1 },
  { label: 'Últimos 7 días', days: 7 },
  { label: 'Últimos 30 días', days: 30 },
  { label: 'Este mes', days: 'month' as const },
  { label: 'Mes pasado', days: 'last_month' as const },
];

// ========================================
// VALIDATION RULES
// ========================================

export const VALIDATION_RULES = {
  item: {
    name: {
      minLength: 2,
      maxLength: 255,
      required: true,
    },
    sku: {
      pattern: /^[A-Z0-9-]+$/,
      maxLength: 50,
    },
    current_stock: {
      min: 0,
      required: true,
    },
    minimum_stock: {
      min: 0,
      required: true,
    },
    unit_cost: {
      min: 0,
      required: true,
    },
  },
  recipe: {
    yield_quantity: {
      min: 0.01,
      required: true,
    },
    ingredients: {
      minItems: 1,
      required: true,
    },
  },
  movement: {
    quantity: {
      notZero: true,
      required: true,
    },
  },
};

// ========================================
// TOAST NOTIFICATION CONFIG
// ========================================

export const TOAST_CONFIG = {
  duration: 3000,
  position: 'top-right' as const,
  messages: {
    item: {
      created: '✅ Item creado exitosamente',
      updated: '✅ Item actualizado',
      deleted: '✅ Item eliminado',
      error: '❌ Error al procesar item',
    },
    recipe: {
      created: '✅ Receta creada exitosamente',
      updated: '✅ Receta actualizada',
      deleted: '✅ Receta eliminada',
      error: '❌ Error al procesar receta',
    },
    movement: {
      recorded: '✅ Movimiento registrado',
      error: '❌ Error al registrar movimiento',
    },
    alert: {
      dismissed: 'Alerta marcada como vista',
      resolved: '✅ Alerta resuelta',
    },
  },
};

// ========================================
// LOADING SKELETON CONFIG
// ========================================

export const SKELETON_CONFIG = {
  itemCard: {
    height: '120px',
    lines: 4,
    animation: 'animate-shimmer',
  },
  table: {
    rows: 10,
    columns: 6,
  },
  stat: {
    height: '80px',
    width: '200px',
  },
};

// ========================================
// EMPTY STATE CONFIG
// ========================================

export const EMPTY_STATE_CONFIG = {
  inventory: {
    icon: 'Package',
    title: 'No hay items en inventario',
    description: 'Comienza agregando tu primer item al inventario',
    action: 'Agregar Item',
  },
  recipes: {
    icon: 'ChefHat',
    title: 'No hay recetas configuradas',
    description: 'Crea recetas para automatizar la deducción de ingredientes',
    action: 'Crear Receta',
  },
  movements: {
    icon: 'ArrowLeftRight',
    title: 'No hay movimientos registrados',
    description: 'Los movimientos de inventario aparecerán aquí',
  },
  alerts: {
    icon: 'CheckCircle2',
    title: 'No hay alertas activas',
    description: 'Todo el inventario está en niveles óptimos',
  },
};
