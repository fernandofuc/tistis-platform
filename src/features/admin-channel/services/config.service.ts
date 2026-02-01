/**
 * TIS TIS PLATFORM - Admin Channel Config Service
 *
 * CRUD de configuración via Admin Channel.
 * Maneja servicios, precios, horarios, personal y promociones.
 *
 * @module admin-channel/services/config
 */

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateUUID, escapeLikePattern, withTimeout } from '../utils/helpers';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Config]';

// Timeout for database operations (10 seconds)
const DB_TIMEOUT_MS = 10000;

// =====================================================
// TYPES
// =====================================================

export interface ConfigResult {
  success: boolean;
  error?: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

export interface ServiceData {
  name: string;
  price: number;
  duration?: number;
  description?: string;
}

export interface PriceUpdateData {
  serviceName: string;
  newPrice: number;
}

export interface HoursData {
  day: string;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export interface StaffData {
  firstName: string;
  lastName?: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface PromotionData {
  name: string;
  description?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue: number;
  startDate?: string;
  endDate?: string;
  serviceIds?: string[];
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class ConfigService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // =====================================================
  // SERVICES CRUD
  // =====================================================

  async upsertService(
    tenantId: string,
    data: ServiceData,
    serviceId?: string
  ): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');
    if (serviceId) {
      validateUUID(serviceId, 'serviceId');
    }

    try {
      const serviceData = {
        tenant_id: tenantId,
        name: data.name,
        price: data.price,
        duration_minutes: data.duration || 60,
        description: data.description || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (serviceId) {
        // Update existing service
        const { data: updated, error } = await withTimeout(
          this.supabase
            .from('services')
            .update(serviceData)
            .eq('id', serviceId)
            .eq('tenant_id', tenantId)
            .select('id')
            .single()
            .then((r) => r),
          DB_TIMEOUT_MS,
          'Update service'
        );

        if (error) {
          console.error(`${LOG_PREFIX} Update service error:`, error);
          return { success: false, error: error.message };
        }

        console.log(`${LOG_PREFIX} Service updated: ${updated?.id}`);
        return { success: true, entityId: updated?.id };
      } else {
        // Create new service
        const { data: created, error } = await withTimeout(
          this.supabase
            .from('services')
            .insert({
              ...serviceData,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single()
            .then((r) => r),
          DB_TIMEOUT_MS,
          'Create service'
        );

        if (error) {
          console.error(`${LOG_PREFIX} Create service error:`, error);
          return { success: false, error: error.message };
        }

        console.log(`${LOG_PREFIX} Service created: ${created?.id}`);
        return { success: true, entityId: created?.id };
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} upsertService error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al guardar servicio',
      };
    }
  }

  async deleteService(tenantId: string, serviceId: string): Promise<ConfigResult> {
    // P0 Security: Validate UUIDs
    validateUUID(tenantId, 'tenantId');
    validateUUID(serviceId, 'serviceId');

    try {
      // Soft delete - mark as inactive
      const { error } = await withTimeout(
        this.supabase
          .from('services')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', serviceId)
          .eq('tenant_id', tenantId)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Delete service'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Delete service error:`, error);
        return { success: false, error: error.message };
      }

      console.log(`${LOG_PREFIX} Service deleted: ${serviceId}`);
      return { success: true, entityId: serviceId };
    } catch (error) {
      console.error(`${LOG_PREFIX} deleteService error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al eliminar servicio',
      };
    }
  }

  async getServices(tenantId: string): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');

    try {
      const { data: services, error } = await withTimeout(
        this.supabase
          .from('services')
          .select('id, name, price, duration_minutes, description, is_active')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name')
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get services'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Get services error:`, error);
        return { success: false, error: error.message };
      }

      return { success: true, data: { services: services || [] } };
    } catch (error) {
      console.error(`${LOG_PREFIX} getServices error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener servicios',
      };
    }
  }

  // =====================================================
  // PRICES
  // =====================================================

  async updatePrice(
    tenantId: string,
    serviceName: string,
    newPrice: number
  ): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');

    // Validate price
    if (typeof newPrice !== 'number' || newPrice < 0) {
      return { success: false, error: 'Precio inválido' };
    }

    try {
      // Find service by name (case-insensitive)
      // P0 Security: Escape LIKE special characters to prevent pattern injection
      const escapedServiceName = escapeLikePattern(serviceName);
      const { data: services, error: findError } = await withTimeout(
        this.supabase
          .from('services')
          .select('id, name, price')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .ilike('name', `%${escapedServiceName}%`)
          .limit(5)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Find service'
      );

      if (findError) {
        console.error(`${LOG_PREFIX} Find service error:`, findError);
        return { success: false, error: findError.message };
      }

      if (!services || services.length === 0) {
        return {
          success: false,
          error: `No se encontró el servicio "${serviceName}"`,
        };
      }

      // If multiple matches, require exact match
      let service = services[0];
      if (services.length > 1) {
        const exactMatch = services.find(
          (s) => s.name.toLowerCase() === serviceName.toLowerCase()
        );
        if (exactMatch) {
          service = exactMatch;
        } else {
          const names = services.map((s) => s.name).join(', ');
          return {
            success: false,
            error: `Varios servicios coinciden: ${names}. Sé más específico.`,
          };
        }
      }

      // Update price
      const { error: updateError } = await withTimeout(
        this.supabase
          .from('services')
          .update({ price: newPrice, updated_at: new Date().toISOString() })
          .eq('id', service.id)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Update price'
      );

      if (updateError) {
        console.error(`${LOG_PREFIX} Update price error:`, updateError);
        return { success: false, error: updateError.message };
      }

      console.log(`${LOG_PREFIX} Price updated for ${service.name}: $${service.price} -> $${newPrice}`);
      return {
        success: true,
        entityId: service.id,
        data: { previousPrice: service.price, newPrice, serviceName: service.name },
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} updatePrice error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar precio',
      };
    }
  }

  // =====================================================
  // HOURS
  // =====================================================

  async updateHours(tenantId: string, data: HoursData): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');

    try {
      // Map day name to number
      const dayMap: Record<string, number> = {
        domingo: 0,
        lunes: 1,
        martes: 2,
        miércoles: 3,
        miercoles: 3,
        jueves: 4,
        viernes: 5,
        sábado: 6,
        sabado: 6,
      };

      const dayName = data.day.toLowerCase().trim();
      const dayNumber = dayMap[dayName];

      if (dayNumber === undefined) {
        return { success: false, error: `Día "${data.day}" no válido` };
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(data.openTime) || !timeRegex.test(data.closeTime)) {
        return { success: false, error: 'Formato de hora inválido. Usa HH:MM' };
      }

      // Get main branch
      const { data: branches, error: branchError } = await withTimeout(
        this.supabase
          .from('branches')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('is_main', true)
          .limit(1)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get main branch'
      );

      if (branchError) {
        console.error(`${LOG_PREFIX} Get branch error:`, branchError);
        return { success: false, error: branchError.message };
      }

      let branchId: string;

      if (!branches || branches.length === 0) {
        // Try to get any branch with timeout
        const { data: anyBranch, error: anyBranchError } = await withTimeout(
          this.supabase
            .from('branches')
            .select('id')
            .eq('tenant_id', tenantId)
            .limit(1)
            .then((r) => r),
          DB_TIMEOUT_MS,
          'Get any branch'
        );

        if (anyBranchError || !anyBranch || anyBranch.length === 0) {
          return { success: false, error: 'No se encontró sucursal' };
        }
        branchId = anyBranch[0].id;
      } else {
        branchId = branches[0].id;
      }

      // Upsert hours
      const { error } = await withTimeout(
        this.supabase.from('branch_hours').upsert(
          {
            branch_id: branchId,
            day_of_week: dayNumber,
            open_time: data.openTime,
            close_time: data.closeTime,
            is_closed: data.isClosed || false,
          },
          {
            onConflict: 'branch_id,day_of_week',
          }
        ).then((r) => r),
        DB_TIMEOUT_MS,
        'Update hours'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Update hours error:`, error);
        return { success: false, error: error.message };
      }

      console.log(`${LOG_PREFIX} Hours updated for ${data.day}: ${data.openTime}-${data.closeTime}`);
      return { success: true, entityId: branchId };
    } catch (error) {
      console.error(`${LOG_PREFIX} updateHours error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar horario',
      };
    }
  }

  async getHours(tenantId: string): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');

    try {
      // Use timeout wrapper for consistency and protection
      const { data: branches, error: branchError } = await withTimeout(
        this.supabase
          .from('branches')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('is_main', true)
          .limit(1)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get branch for hours'
      );

      if (branchError) {
        console.error(`${LOG_PREFIX} Get branch error:`, branchError);
        return { success: false, error: branchError.message };
      }

      if (!branches || branches.length === 0) {
        return { success: false, error: 'No se encontró sucursal' };
      }

      const { data: hours, error } = await withTimeout(
        this.supabase
          .from('branch_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .eq('branch_id', branches[0].id)
          .order('day_of_week')
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get hours'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Get hours error:`, error);
        return { success: false, error: error.message };
      }

      return { success: true, data: { hours: hours || [] } };
    } catch (error) {
      console.error(`${LOG_PREFIX} getHours error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener horarios',
      };
    }
  }

  // =====================================================
  // STAFF
  // =====================================================

  async upsertStaff(
    tenantId: string,
    data: StaffData,
    staffId?: string
  ): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');
    if (staffId) {
      validateUUID(staffId, 'staffId');
    }

    try {
      const staffData = {
        tenant_id: tenantId,
        first_name: data.firstName,
        last_name: data.lastName || '',
        role: data.role || 'staff',
        email: data.email || null,
        phone: data.phone || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (staffId) {
        const { data: updated, error } = await withTimeout(
          this.supabase
            .from('staff')
            .update(staffData)
            .eq('id', staffId)
            .eq('tenant_id', tenantId)
            .select('id')
            .single()
            .then((r) => r),
          DB_TIMEOUT_MS,
          'Update staff'
        );

        if (error) {
          console.error(`${LOG_PREFIX} Update staff error:`, error);
          return { success: false, error: error.message };
        }

        console.log(`${LOG_PREFIX} Staff updated: ${updated?.id}`);
        return { success: true, entityId: updated?.id };
      } else {
        const { data: created, error } = await withTimeout(
          this.supabase
            .from('staff')
            .insert({
              ...staffData,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single()
            .then((r) => r),
          DB_TIMEOUT_MS,
          'Create staff'
        );

        if (error) {
          console.error(`${LOG_PREFIX} Create staff error:`, error);
          return { success: false, error: error.message };
        }

        console.log(`${LOG_PREFIX} Staff created: ${created?.id}`);
        return { success: true, entityId: created?.id };
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} upsertStaff error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al guardar empleado',
      };
    }
  }

  async deleteStaff(tenantId: string, staffId: string): Promise<ConfigResult> {
    // P0 Security: Validate UUIDs
    validateUUID(tenantId, 'tenantId');
    validateUUID(staffId, 'staffId');

    try {
      // Soft delete
      const { error } = await withTimeout(
        this.supabase
          .from('staff')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', staffId)
          .eq('tenant_id', tenantId)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Delete staff'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Delete staff error:`, error);
        return { success: false, error: error.message };
      }

      return { success: true, entityId: staffId };
    } catch (error) {
      console.error(`${LOG_PREFIX} deleteStaff error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al eliminar empleado',
      };
    }
  }

  // =====================================================
  // PROMOTIONS
  // =====================================================

  async upsertPromotion(
    tenantId: string,
    data: PromotionData,
    promotionId?: string
  ): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');
    if (promotionId) {
      validateUUID(promotionId, 'promotionId');
    }

    try {
      const promotionData = {
        tenant_id: tenantId,
        name: data.name,
        description: data.description || null,
        discount_type: data.discountType || 'percentage',
        discount_value: data.discountValue,
        start_date: data.startDate || new Date().toISOString(),
        end_date: data.endDate || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (promotionId) {
        const { data: updated, error } = await withTimeout(
          this.supabase
            .from('promotions')
            .update(promotionData)
            .eq('id', promotionId)
            .eq('tenant_id', tenantId)
            .select('id')
            .single()
            .then((r) => r),
          DB_TIMEOUT_MS,
          'Update promotion'
        );

        if (error) {
          console.error(`${LOG_PREFIX} Update promotion error:`, error);
          return { success: false, error: error.message };
        }

        return { success: true, entityId: updated?.id };
      } else {
        const { data: created, error } = await withTimeout(
          this.supabase
            .from('promotions')
            .insert({
              ...promotionData,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single()
            .then((r) => r),
          DB_TIMEOUT_MS,
          'Create promotion'
        );

        if (error) {
          console.error(`${LOG_PREFIX} Create promotion error:`, error);
          return { success: false, error: error.message };
        }

        return { success: true, entityId: created?.id };
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} upsertPromotion error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al guardar promoción',
      };
    }
  }

  async getActivePromotions(tenantId: string): Promise<ConfigResult> {
    // P0 Security: Validate UUID
    validateUUID(tenantId, 'tenantId');

    try {
      const now = new Date().toISOString();

      const { data: promotions, error } = await withTimeout(
        this.supabase
          .from('promotions')
          .select('id, name, description, discount_type, discount_value, start_date, end_date')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .lte('start_date', now)
          .or(`end_date.is.null,end_date.gte.${now}`)
          .order('created_at', { ascending: false })
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Get promotions'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Get promotions error:`, error);
        return { success: false, error: error.message };
      }

      return { success: true, data: { promotions: promotions || [] } };
    } catch (error) {
      console.error(`${LOG_PREFIX} getActivePromotions error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener promociones',
      };
    }
  }

  async deletePromotion(tenantId: string, promotionId: string): Promise<ConfigResult> {
    // P0 Security: Validate UUIDs
    validateUUID(tenantId, 'tenantId');
    validateUUID(promotionId, 'promotionId');

    try {
      // Soft delete
      const { error } = await withTimeout(
        this.supabase
          .from('promotions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', promotionId)
          .eq('tenant_id', tenantId)
          .then((r) => r),
        DB_TIMEOUT_MS,
        'Delete promotion'
      );

      if (error) {
        console.error(`${LOG_PREFIX} Delete promotion error:`, error);
        return { success: false, error: error.message };
      }

      return { success: true, entityId: promotionId };
    } catch (error) {
      console.error(`${LOG_PREFIX} deletePromotion error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al eliminar promoción',
      };
    }
  }
}

// =====================================================
// SINGLETON
// =====================================================

let _service: ConfigService | null = null;

export function getConfigService(): ConfigService {
  if (!_service) {
    _service = new ConfigService();
  }
  return _service;
}

/**
 * Reset the singleton instance.
 * Useful for testing and hot reload scenarios.
 */
export function resetConfigService(): void {
  _service = null;
}
