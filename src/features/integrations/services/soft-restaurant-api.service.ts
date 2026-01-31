// =====================================================
// TIS TIS PLATFORM - Soft Restaurant API Service
// DEPRECATED: This service is kept for backwards compatibility
// The new integration uses WEBHOOK model (SR pushes to TIS TIS)
// See: soft-restaurant-webhook.service.ts
// =====================================================

// ======================
// TYPES (kept for compatibility)
// ======================

export interface SRConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    apiVersion?: string;
    accountName?: string;
    menuItemsCount?: number;
    categoriesCount?: number;
    responseTimeMs?: number;
  };
  errorCode?: string;
  errorDetails?: string;
}

export interface SRMenuResponse {
  items: SRMenuItemResponse[];
  categories: string[];
  totalCount: number;
}

export interface SRMenuItemResponse {
  Codigo: string;
  Descripcion: string;
  Precio: number;
  Categoria?: string;
  Activo?: boolean;
}

// ======================
// ERROR CODES
// ======================

export const SR_ERROR_CODES = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  // New webhook-specific codes
  WEBHOOK_INVALID_PAYLOAD: 'WEBHOOK_INVALID_PAYLOAD',
  WEBHOOK_AUTH_FAILED: 'WEBHOOK_AUTH_FAILED',
  WEBHOOK_RATE_LIMITED: 'WEBHOOK_RATE_LIMITED',
} as const;

// ======================
// CAPABILITY INFO
// ======================

/**
 * Information about each sync capability
 * Updated for WEBHOOK model based on official documentation
 * (OPE.ANA.SR11.Guia_para_el_modulo_de_conexion_de_ERP_y_PMS.pdf)
 */
export const SR_CAPABILITY_STATUS = {
  sync_menu: {
    status: 'coming_soon' as const,
    label: 'Menú',
    description: 'Productos, categorías y precios',
    apiEndpoint: null,
    note: 'Requiere API adicional no incluida en módulo ERP/PMS',
  },
  sync_recipes: {
    status: 'coming_soon' as const,
    label: 'Recetas con Gramaje',
    description: 'Explosión de insumos y costos',
    apiEndpoint: null,
    note: 'Requiere API adicional no incluida en módulo ERP/PMS',
  },
  sync_inventory: {
    status: 'coming_soon' as const,
    label: 'Inventario',
    description: 'Stock y puntos de reorden',
    apiEndpoint: null,
    note: 'Requiere API adicional no incluida en módulo ERP/PMS',
  },
  sync_tables: {
    status: 'coming_soon' as const,
    label: 'Mesas',
    description: 'Plano del restaurante',
    apiEndpoint: null,
    note: 'Requiere API adicional no incluida en módulo ERP/PMS',
  },
  sync_reservations: {
    status: 'coming_soon' as const,
    label: 'Reservaciones',
    description: 'Reservas de clientes',
    apiEndpoint: null,
    note: 'Requiere API adicional no incluida en módulo ERP/PMS',
  },
  sync_sales: {
    status: 'confirmed' as const,
    label: 'Ventas',
    description: 'Tickets y análisis (via webhook)',
    apiEndpoint: 'webhook',
    note: 'Recibe datos en tiempo real cuando SR cierra un ticket',
  },
} as const;

export type SRCapabilityKey = keyof typeof SR_CAPABILITY_STATUS;
export type SRCapabilityStatus = 'confirmed' | 'beta' | 'coming_soon';

// ======================
// DEPRECATED FUNCTIONS
// These are kept for backwards compatibility but should not be used
// ======================

/**
 * @deprecated Use webhook model instead. SR should push data to TIS TIS.
 * This function is kept for backwards compatibility only.
 */
export async function testSoftRestaurantConnection(
  _apiKey: string
): Promise<SRConnectionTestResult> {
  console.warn('[DEPRECATED] testSoftRestaurantConnection is deprecated. Use webhook model instead.');

  return {
    success: false,
    message: 'Este método está deprecado. La integración ahora usa webhooks.',
    errorCode: 'DEPRECATED',
    errorDetails: 'Use the webhook model: SR sends data to TIS TIS webhook endpoint',
  };
}

/**
 * @deprecated Use webhook model instead.
 */
export async function fetchSoftRestaurantMenu(
  _apiKey: string
): Promise<SRMenuResponse | null> {
  console.warn('[DEPRECATED] fetchSoftRestaurantMenu is deprecated. Menu sync not available via webhook.');
  return null;
}
