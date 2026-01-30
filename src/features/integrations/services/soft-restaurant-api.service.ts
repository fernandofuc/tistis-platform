// =====================================================
// TIS TIS PLATFORM - Soft Restaurant API Service
// Real API connection test and data fetching service
// Based on official documentation: api.softrestaurant.com.mx
// =====================================================

// ======================
// TYPES
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
// CONSTANTS
// ======================

// Official Soft Restaurant API base URL
const SR_API_BASE_URL = 'https://api.softrestaurant.com.mx';

// API endpoints (from official documentation)
const SR_ENDPOINTS = {
  // Menu endpoint - CONFIRMED working
  MENU: '/v1/menu',
  MENU_ITEMS: '/v1/menu/items',
  MENU_CATEGORIES: '/v1/menu/categories',
  // Other endpoints - NOT CONFIRMED (documented but may require additional permissions)
  INVENTORY: '/v1/inventory',
  TABLES: '/v1/tables',
  RESERVATIONS: '/v1/reservations',
  SALES: '/v1/sales',
} as const;

// Error codes for client-friendly messages
export const SR_ERROR_CODES = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// ======================
// SERVICE
// ======================

/**
 * Test connection to Soft Restaurant API
 * Uses the official AuthorizedApp header for authentication
 *
 * @param apiKey - The API key provided by National Soft
 * @returns Connection test result with details
 */
export async function testSoftRestaurantConnection(
  apiKey: string
): Promise<SRConnectionTestResult> {
  const startTime = Date.now();

  // Validate API key format
  if (!apiKey || apiKey.trim().length < 10) {
    return {
      success: false,
      message: 'API Key inválida. Debe tener al menos 10 caracteres.',
      errorCode: SR_ERROR_CODES.INVALID_API_KEY,
    };
  }

  try {
    // Call the menu endpoint to test connection
    // This is the most reliable endpoint based on documentation
    const response = await fetch(`${SR_API_BASE_URL}${SR_ENDPOINTS.MENU}`, {
      method: 'GET',
      headers: {
        'AuthorizedApp': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    const responseTimeMs = Date.now() - startTime;

    // Handle different HTTP status codes
    if (response.ok) {
      // Try to parse response for additional details
      let details: SRConnectionTestResult['details'] = {
        responseTimeMs,
      };

      try {
        const data = await response.json();

        // Extract useful information from response
        if (Array.isArray(data)) {
          details.menuItemsCount = data.length;
          // Count unique categories
          const categories = new Set(
            data
              .map((item: SRMenuItemResponse) => item.Categoria)
              .filter(Boolean)
          );
          details.categoriesCount = categories.size;
        } else if (data.items && Array.isArray(data.items)) {
          details.menuItemsCount = data.items.length;
          if (data.categories) {
            details.categoriesCount = data.categories.length;
          }
        }
      } catch {
        // Response parsing failed but connection succeeded
      }

      return {
        success: true,
        message: 'Conexión exitosa con Soft Restaurant',
        details,
      };
    }

    // Handle error responses
    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'API Key no autorizada. Verifica que la key sea correcta.',
        errorCode: SR_ERROR_CODES.UNAUTHORIZED,
        errorDetails: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    if (response.status === 404) {
      // 404 might mean the endpoint structure changed or account not configured
      return {
        success: false,
        message: 'Endpoint no encontrado. Tu cuenta puede no tener acceso a la API.',
        errorCode: SR_ERROR_CODES.UNAUTHORIZED,
        errorDetails: `HTTP ${response.status}: Endpoint may not be enabled for this account`,
      };
    }

    if (response.status >= 500) {
      return {
        success: false,
        message: 'Error del servidor de Soft Restaurant. Intenta más tarde.',
        errorCode: SR_ERROR_CODES.SERVER_ERROR,
        errorDetails: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Generic error
    return {
      success: false,
      message: `Error de conexión: ${response.statusText}`,
      errorCode: SR_ERROR_CODES.UNKNOWN_ERROR,
      errorDetails: `HTTP ${response.status}: ${response.statusText}`,
    };

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    // Handle timeout
    if (error instanceof Error && error.name === 'TimeoutError') {
      return {
        success: false,
        message: 'Timeout: El servidor de Soft Restaurant no respondió a tiempo.',
        errorCode: SR_ERROR_CODES.TIMEOUT,
        errorDetails: `Request timed out after ${responseTimeMs}ms`,
      };
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        message: 'Error de red. Verifica tu conexión a internet.',
        errorCode: SR_ERROR_CODES.NETWORK_ERROR,
        errorDetails: error.message,
      };
    }

    // Generic error
    return {
      success: false,
      message: 'Error al conectar con Soft Restaurant.',
      errorCode: SR_ERROR_CODES.UNKNOWN_ERROR,
      errorDetails: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch menu items from Soft Restaurant API
 *
 * @param apiKey - The API key
 * @returns Menu items and categories
 */
export async function fetchSoftRestaurantMenu(
  apiKey: string
): Promise<SRMenuResponse | null> {
  try {
    const response = await fetch(`${SR_API_BASE_URL}${SR_ENDPOINTS.MENU}`, {
      method: 'GET',
      headers: {
        'AuthorizedApp': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout for data fetch
    });

    if (!response.ok) {
      console.error('[SR API] Menu fetch failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    // Normalize response format
    if (Array.isArray(data)) {
      const categories = [...new Set(
        data
          .map((item: SRMenuItemResponse) => item.Categoria)
          .filter(Boolean)
      )] as string[];

      return {
        items: data,
        categories,
        totalCount: data.length,
      };
    }

    if (data.items && Array.isArray(data.items)) {
      return {
        items: data.items,
        categories: data.categories || [],
        totalCount: data.items.length,
      };
    }

    return null;
  } catch (error) {
    console.error('[SR API] Menu fetch error:', error);
    return null;
  }
}

// ======================
// CAPABILITY INFO
// ======================

/**
 * Information about each sync capability
 * Based on official API documentation analysis
 */
export const SR_CAPABILITY_STATUS = {
  sync_menu: {
    status: 'confirmed' as const,
    label: 'Menú',
    description: 'Productos, categorías y precios',
    apiEndpoint: SR_ENDPOINTS.MENU,
    note: 'Confirmado en documentación oficial',
  },
  sync_recipes: {
    status: 'beta' as const,
    label: 'Recetas con Gramaje',
    description: 'Explosión de insumos y costos',
    apiEndpoint: null,
    note: 'Requiere configuración adicional con National Soft',
  },
  sync_inventory: {
    status: 'beta' as const,
    label: 'Inventario',
    description: 'Stock y puntos de reorden',
    apiEndpoint: SR_ENDPOINTS.INVENTORY,
    note: 'Disponibilidad varía según licencia',
  },
  sync_tables: {
    status: 'beta' as const,
    label: 'Mesas',
    description: 'Plano del restaurante',
    apiEndpoint: SR_ENDPOINTS.TABLES,
    note: 'Disponibilidad varía según licencia',
  },
  sync_reservations: {
    status: 'coming_soon' as const,
    label: 'Reservaciones',
    description: 'Reservas de clientes',
    apiEndpoint: SR_ENDPOINTS.RESERVATIONS,
    note: 'En desarrollo - próximamente',
  },
  sync_sales: {
    status: 'confirmed' as const,
    label: 'Ventas',
    description: 'Tickets y análisis (via webhook)',
    apiEndpoint: null,
    note: 'Funciona via webhook, requiere configuración en SR',
  },
} as const;

export type SRCapabilityKey = keyof typeof SR_CAPABILITY_STATUS;
export type SRCapabilityStatus = 'confirmed' | 'beta' | 'coming_soon';
