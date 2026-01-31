// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Cloud API Service
// Integrates with SR Cloud (SaaS) via official REST API
// =====================================================

import type {
  SRCloudConfig,
  SRCloudConnectionStatus,
  SRCloudMenuResponse,
  SRCloudMenuItem,
  SRCloudCategory,
} from '../types/integration.types';

// ======================
// TYPES
// ======================

export interface SRCloudConnectionTestResult {
  success: boolean;
  status: SRCloudConnectionStatus;
  message: string;
  details?: {
    apiVersion?: string;
    accountName?: string;
    accountId?: string;
    menuItemsCount?: number;
    categoriesCount?: number;
    responseTimeMs?: number;
    expiresAt?: string;
  };
  errorCode?: string;
  errorDetails?: string;
}

export interface SRCloudMenuSyncResult {
  success: boolean;
  itemsSynced: number;
  categoriesSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errors: string[];
  syncDurationMs: number;
}

// ======================
// ERROR CODES
// ======================

export const SR_CLOUD_ERROR_CODES = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type SRCloudErrorCode = keyof typeof SR_CLOUD_ERROR_CODES;

// ======================
// CONSTANTS
// ======================

/** Current platform version for User-Agent header */
const PLATFORM_VERSION = '4.8.4';

/** Allowed domains for SR Cloud API (SSRF prevention) */
const ALLOWED_API_DOMAINS = [
  'api.softrestaurant.com.mx',
  'softrestaurant.com.mx',
  'api.nationalsoft.com.mx',
] as const;

// ======================
// SERVICE CLASS
// ======================

/**
 * Service for integrating with Soft Restaurant Cloud API.
 *
 * IMPORTANT: SR Cloud has significant limitations compared to SR Local:
 * - Only menu data is available via API
 * - Inventory is NOT available in SR Cloud
 * - Sales data is limited
 * - Tables/Reservations not available
 *
 * @see https://api.softrestaurant.com.mx/ for official documentation
 */
class SoftRestaurantCloudService {
  private readonly defaultApiBaseUrl = 'https://api.softrestaurant.com.mx';
  private readonly requestTimeoutMs = 30000; // 30 seconds

  /**
   * Validates that a URL is safe to make requests to (SSRF prevention).
   * Only allows HTTPS connections to whitelisted domains.
   */
  private isValidApiUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Must be HTTPS
      if (parsed.protocol !== 'https:') {
        return false;
      }
      // Check against whitelist
      return ALLOWED_API_DOMAINS.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Validates and normalizes the API base URL.
   * Returns the default URL if provided URL is invalid.
   */
  private getValidatedBaseUrl(apiBaseUrl?: string): string {
    if (!apiBaseUrl) {
      return this.defaultApiBaseUrl;
    }
    if (this.isValidApiUrl(apiBaseUrl)) {
      return apiBaseUrl;
    }
    // Log warning but don't expose in error response
    console.warn('[SRCloud] Invalid apiBaseUrl provided, using default');
    return this.defaultApiBaseUrl;
  }

  // ======================
  // CONNECTION TESTING
  // ======================

  /**
   * Tests connection to SR Cloud API.
   * Validates API key and retrieves account information.
   */
  async testConnection(
    apiKey: string,
    apiBaseUrl?: string
  ): Promise<SRCloudConnectionTestResult> {
    const startTime = Date.now();
    const baseUrl = this.getValidatedBaseUrl(apiBaseUrl);

    try {
      // Make test request to SR Cloud API
      const response = await this.makeRequest(
        `${baseUrl}/v1/account/info`,
        apiKey
      );

      const responseTimeMs = Date.now() - startTime;

      if (!response.ok) {
        return this.handleApiError(response, responseTimeMs);
      }

      const data = await response.json();

      return {
        success: true,
        status: 'connected',
        message: 'Conexion exitosa con Soft Restaurant Cloud',
        details: {
          apiVersion: data.api_version || 'v1',
          accountName: data.account_name || data.nombre_cuenta,
          accountId: data.account_id || data.id_cuenta,
          responseTimeMs,
          expiresAt: data.license_expires_at,
        },
      };
    } catch (error) {
      return this.handleNetworkError(error, Date.now() - startTime);
    }
  }

  /**
   * Validates if the API key is still valid.
   */
  async validateApiKey(
    apiKey: string,
    apiBaseUrl?: string
  ): Promise<{ isValid: boolean; errorCode?: string }> {
    const result = await this.testConnection(apiKey, apiBaseUrl);
    return {
      isValid: result.success,
      errorCode: result.errorCode,
    };
  }

  // ======================
  // MENU OPERATIONS
  // ======================

  /**
   * Fetches menu items from SR Cloud API.
   * This is the ONLY data reliably available from SR Cloud.
   */
  async fetchMenu(
    apiKey: string,
    apiBaseUrl?: string
  ): Promise<SRCloudMenuResponse> {
    const baseUrl = this.getValidatedBaseUrl(apiBaseUrl);

    try {
      // Fetch menu items
      const response = await this.makeRequest(
        `${baseUrl}/v1/menu/items`,
        apiKey
      );

      if (!response.ok) {
        const errorResult = await this.handleApiError(response, 0);
        return {
          success: false,
          error: {
            code: errorResult.errorCode || 'UNKNOWN_ERROR',
            message: errorResult.message,
          },
        };
      }

      const data = await response.json();

      // Transform API response to our format
      const items: SRCloudMenuItem[] = (data.items || data.productos || []).map(
        (item: Record<string, unknown>) => ({
          id: String(item.id || item.Id),
          codigo: String(item.codigo || item.Codigo || ''),
          nombre: String(item.nombre || item.descripcion || item.Descripcion || ''),
          descripcion: item.descripcion_larga as string | undefined,
          precio: Number(item.precio || item.Precio || 0),
          categoriaId: String(item.categoria_id || item.CategoriaId || ''),
          categoriaNombre: item.categoria_nombre as string | undefined,
          activo: Boolean(item.activo ?? item.Activo ?? true),
          imagen: item.imagen_url as string | undefined,
          modificadores: this.parseModifiers(item.modificadores || item.extras),
        })
      );

      // Fetch categories separately if available
      const categories = await this.fetchCategories(apiKey, apiBaseUrl);

      return {
        success: true,
        data: {
          items,
          categories,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: `Error al obtener menu: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Fetches categories from SR Cloud API.
   */
  private async fetchCategories(
    apiKey: string,
    apiBaseUrl?: string
  ): Promise<SRCloudCategory[]> {
    const baseUrl = this.getValidatedBaseUrl(apiBaseUrl);

    try {
      const response = await this.makeRequest(
        `${baseUrl}/v1/menu/categories`,
        apiKey
      );

      if (!response.ok) {
        console.warn('[SRCloud] Failed to fetch categories, returning empty array');
        return [];
      }

      const data = await response.json();

      return (data.categories || data.categorias || []).map(
        (cat: Record<string, unknown>) => ({
          id: String(cat.id || cat.Id),
          nombre: String(cat.nombre || cat.Nombre || ''),
          descripcion: cat.descripcion as string | undefined,
          orden: cat.orden as number | undefined,
          activa: Boolean(cat.activa ?? cat.Activa ?? true),
          imagen: cat.imagen_url as string | undefined,
        })
      );
    } catch (error) {
      console.warn('[SRCloud] Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Parses modifiers/extras from API response.
   */
  private parseModifiers(
    modifiers: unknown
  ): SRCloudMenuItem['modificadores'] {
    if (!Array.isArray(modifiers)) {
      return undefined;
    }

    return modifiers.map((mod: Record<string, unknown>) => ({
      id: String(mod.id || mod.Id),
      nombre: String(mod.nombre || mod.Nombre || ''),
      precio: Number(mod.precio || mod.Precio || 0),
      obligatorio: Boolean(mod.obligatorio ?? mod.required ?? false),
    }));
  }

  // ======================
  // FEATURE AVAILABILITY
  // ======================

  /**
   * Checks if a feature is available in SR Cloud.
   * Most features are NOT available in SR Cloud.
   */
  isFeatureAvailable(feature: 'menu' | 'inventory' | 'sales' | 'tables' | 'reservations' | 'recipes'): boolean {
    const availability: Record<string, boolean> = {
      menu: true,        // Only this is available
      inventory: false,  // NOT available in SR Cloud
      sales: false,      // Limited/Not available
      tables: false,     // NOT available
      reservations: false, // NOT available
      recipes: false,    // NOT available
    };

    return availability[feature] ?? false;
  }

  /**
   * Returns list of limitations for SR Cloud.
   */
  getCloudLimitations(): string[] {
    return [
      'Inventario NO disponible - SR Cloud no incluye modulo de inventarios',
      'Ventas limitadas - Solo resumen basico disponible via API',
      'Mesas/Plano NO disponible - Funcion no incluida en SR Cloud',
      'Reservaciones NO disponibles - No soportado por API',
      'Recetas con gramaje NO disponibles - Requiere SQL directo',
      'Requiere conexion a internet permanente',
      'Tiempo maximo offline: 48 horas',
      'Requiere licencia ERP/PMS activa con National Soft',
    ];
  }

  // ======================
  // HTTP HELPERS
  // ======================

  /**
   * Makes an authenticated request to SR Cloud API.
   * Uses AbortController for timeout handling.
   */
  private async makeRequest(url: string, apiKey: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': `TisTis-Platform/${PLATFORM_VERSION}`,
        },
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handles API error responses.
   */
  private async handleApiError(
    response: Response,
    responseTimeMs: number
  ): Promise<SRCloudConnectionTestResult> {
    let errorCode: SRCloudErrorCode = 'UNKNOWN_ERROR';
    let message = 'Error desconocido al conectar con SR Cloud';

    switch (response.status) {
      case 401:
        errorCode = 'UNAUTHORIZED';
        message = 'API Key invalida o expirada';
        break;
      case 403:
        errorCode = 'ACCOUNT_SUSPENDED';
        message = 'Cuenta suspendida o sin acceso a API';
        break;
      case 404:
        errorCode = 'INVALID_API_KEY';
        message = 'Endpoint no encontrado - verifica la URL de API';
        break;
      case 429:
        errorCode = 'RATE_LIMITED';
        message = 'Demasiadas solicitudes - intenta mas tarde';
        break;
      case 500:
      case 502:
      case 503:
        errorCode = 'SERVER_ERROR';
        message = 'Error en el servidor de SR Cloud - intenta mas tarde';
        break;
    }

    // Try to parse error body
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        message = errorBody.message;
      }
      if (errorBody.code) {
        errorCode = errorBody.code as SRCloudErrorCode;
      }
    } catch {
      // Ignore JSON parse errors
    }

    return {
      success: false,
      status: 'error',
      message,
      errorCode,
      errorDetails: `HTTP ${response.status}: ${response.statusText}`,
      details: {
        responseTimeMs,
      },
    };
  }

  /**
   * Handles network errors.
   */
  private handleNetworkError(
    error: unknown,
    responseTimeMs: number
  ): SRCloudConnectionTestResult {
    const errorMessage = error instanceof Error ? error.message : 'Error de red';

    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      return {
        success: false,
        status: 'error',
        message: 'Tiempo de espera agotado al conectar con SR Cloud',
        errorCode: 'TIMEOUT',
        errorDetails: errorMessage,
        details: { responseTimeMs },
      };
    }

    return {
      success: false,
      status: 'error',
      message: `Error de red: ${errorMessage}`,
      errorCode: 'NETWORK_ERROR',
      errorDetails: errorMessage,
      details: { responseTimeMs },
    };
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let instance: SoftRestaurantCloudService | null = null;

/**
 * Gets the singleton instance of SoftRestaurantCloudService.
 */
export function getSoftRestaurantCloudService(): SoftRestaurantCloudService {
  if (!instance) {
    instance = new SoftRestaurantCloudService();
  }
  return instance;
}

/**
 * Resets the singleton instance.
 * Useful for testing to ensure clean state between tests.
 * @internal
 */
export function resetSoftRestaurantCloudService(): void {
  instance = null;
}

export { SoftRestaurantCloudService };
export type { SoftRestaurantCloudService as SoftRestaurantCloudServiceType };
