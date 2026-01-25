// =====================================================
// TIS TIS PLATFORM - Services Integration
// Sprint 5: Setup Assistant module integrations
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type { MessageAction, VisionAnalysis } from '../types';

// =====================================================
// TYPES
// =====================================================

export interface CreateServiceInput {
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  priceMax?: number;
  duration?: number;  // in minutes
  category?: string;
  priceUnit?: 'per_service' | 'per_hour' | 'per_session' | 'per_tooth' | 'per_unit';
}

export interface BulkCreateServicesInput {
  tenantId: string;
  services: Array<{
    name: string;
    price: number;
    priceMax?: number;
    category?: string;
    description?: string;
    duration?: number;
  }>;
}

export interface UpdateServiceInput {
  tenantId: string;
  serviceId: string;
  updates: Partial<{
    name: string;
    description: string;
    price: number;
    priceMax: number;
    duration: number;
    category: string;
    isActive: boolean;
  }>;
}

// =====================================================
// SERVICES INTEGRATION CLASS
// =====================================================

export class ServicesIntegration {
  private supabase = createServerClient();

  // ======================
  // CREATE SERVICE
  // ======================

  /**
   * Create a single service
   */
  async createService(input: CreateServiceInput): Promise<MessageAction> {
    try {
      // Generate slug from name
      const slug = this.generateSlug(input.name);

      const { data: service, error } = await this.supabase
        .from('services')
        .insert({
          tenant_id: input.tenantId,
          name: input.name,
          slug,
          description: input.description,
          price_min: input.price,
          price_max: input.priceMax || input.price,
          price_unit: input.priceUnit || 'per_service',
          duration_minutes: input.duration || 30,
          category: input.category || 'general',
          is_active: true,
          currency: 'MXN',
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        type: 'create',
        module: 'services',
        entityType: 'service',
        entityId: service.id,
        status: 'success',
        details: { name: input.name, price: input.price },
      };
    } catch (error) {
      return {
        type: 'create',
        module: 'services',
        entityType: 'service',
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ======================
  // BULK CREATE
  // ======================

  /**
   * Bulk create services (e.g., from Vision analysis)
   */
  async bulkCreateServices(input: BulkCreateServicesInput): Promise<MessageAction[]> {
    const actions: MessageAction[] = [];

    for (const service of input.services) {
      const action = await this.createService({
        tenantId: input.tenantId,
        name: service.name,
        price: service.price,
        priceMax: service.priceMax,
        category: service.category,
        description: service.description,
        duration: service.duration,
      });
      actions.push(action);
    }

    return actions;
  }

  // ======================
  // CREATE FROM VISION
  // ======================

  /**
   * Create services from Vision analysis result
   */
  async createFromVisionAnalysis(
    tenantId: string,
    analysis: VisionAnalysis
  ): Promise<MessageAction[]> {
    // Extract items from Vision analysis
    const items = (analysis.extractedData.items as Array<{
      name: string;
      price: number;
      priceMax?: number;
      category?: string;
      description?: string;
    }>) || [];

    if (items.length === 0) {
      return [{
        type: 'create',
        module: 'services',
        entityType: 'service',
        status: 'failure',
        details: { error: 'No se encontraron servicios en la imagen' },
      }];
    }

    return this.bulkCreateServices({
      tenantId,
      services: items.map(item => ({
        name: item.name,
        price: item.price,
        priceMax: item.priceMax,
        category: item.category || 'menu',
        description: item.description,
      })),
    });
  }

  // ======================
  // UPDATE SERVICE
  // ======================

  /**
   * Update an existing service
   */
  async updateService(input: UpdateServiceInput): Promise<MessageAction> {
    try {
      const updateData: Record<string, unknown> = {};

      if (input.updates.name !== undefined) updateData.name = input.updates.name;
      if (input.updates.description !== undefined) updateData.description = input.updates.description;
      if (input.updates.price !== undefined) updateData.price_min = input.updates.price;
      if (input.updates.priceMax !== undefined) updateData.price_max = input.updates.priceMax;
      if (input.updates.duration !== undefined) updateData.duration_minutes = input.updates.duration;
      if (input.updates.category !== undefined) updateData.category = input.updates.category;
      if (input.updates.isActive !== undefined) updateData.is_active = input.updates.isActive;

      updateData.updated_at = new Date().toISOString();

      const { error } = await this.supabase
        .from('services')
        .update(updateData)
        .eq('id', input.serviceId)
        .eq('tenant_id', input.tenantId);

      if (error) throw error;

      return {
        type: 'update',
        module: 'services',
        entityType: 'service',
        entityId: input.serviceId,
        status: 'success',
        details: { updates: Object.keys(input.updates) },
      };
    } catch (error) {
      return {
        type: 'update',
        module: 'services',
        entityType: 'service',
        entityId: input.serviceId,
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ======================
  // UPDATE PRICE
  // ======================

  /**
   * Update service price (convenience method)
   */
  async updateServicePrice(
    tenantId: string,
    serviceId: string,
    newPrice: number,
    newPriceMax?: number
  ): Promise<MessageAction> {
    return this.updateService({
      tenantId,
      serviceId,
      updates: {
        price: newPrice,
        priceMax: newPriceMax || newPrice,
      },
    });
  }

  // ======================
  // GET SERVICES
  // ======================

  /**
   * Get all active services for a tenant
   */
  async getServices(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    price: number;
    category: string;
  }>> {
    try {
      const { data } = await this.supabase
        .from('services')
        .select('id, name, price_min, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        price: s.price_min,
        category: s.category,
      }));
    } catch {
      return [];
    }
  }

  // ======================
  // GET SERVICES COUNT
  // ======================

  /**
   * Get services count for a tenant
   */
  async getServicesCount(tenantId: string): Promise<number> {
    try {
      const { count } = await this.supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('deleted_at', null);

      return count || 0;
    } catch {
      return 0;
    }
  }

  // ======================
  // HELPER METHODS
  // ======================

  /**
   * Generate URL-safe slug from service name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove consecutive hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Create default services for a vertical
   */
  async createDefaultServices(
    tenantId: string,
    vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym'
  ): Promise<MessageAction[]> {
    const servicesByVertical: Record<string, Array<{
      name: string;
      price: number;
      category: string;
      duration?: number;
    }>> = {
      restaurant: [
        { name: 'Desayuno completo', price: 120, category: 'desayunos' },
        { name: 'Comida ejecutiva', price: 180, category: 'comidas' },
        { name: 'Hamburguesa clásica', price: 150, category: 'principales' },
      ],
      dental: [
        { name: 'Consulta de valoración', price: 500, category: 'consultas', duration: 30 },
        { name: 'Limpieza dental', price: 800, category: 'preventivos', duration: 45 },
        { name: 'Blanqueamiento', price: 3500, category: 'estéticos', duration: 60 },
      ],
      clinic: [
        { name: 'Consulta general', price: 600, category: 'consultas', duration: 30 },
        { name: 'Estudios de laboratorio', price: 450, category: 'estudios', duration: 15 },
        { name: 'Chequeo completo', price: 1500, category: 'preventivos', duration: 60 },
      ],
      beauty: [
        { name: 'Corte de cabello', price: 250, category: 'cabello', duration: 30 },
        { name: 'Facial básico', price: 600, category: 'faciales', duration: 45 },
        { name: 'Manicure', price: 200, category: 'uñas', duration: 30 },
      ],
      veterinary: [
        { name: 'Consulta general', price: 400, category: 'consultas', duration: 30 },
        { name: 'Vacunación', price: 350, category: 'preventivos', duration: 15 },
        { name: 'Baño y corte', price: 500, category: 'estética', duration: 60 },
      ],
      gym: [
        { name: 'Membresía mensual', price: 800, category: 'membresías', duration: 0 },
        { name: 'Clase personal', price: 400, category: 'clases', duration: 60 },
        { name: 'Evaluación física', price: 300, category: 'evaluaciones', duration: 45 },
      ],
    };

    const services = servicesByVertical[vertical] || servicesByVertical.dental;

    return this.bulkCreateServices({
      tenantId,
      services,
    });
  }
}

// Singleton instance export
export const servicesIntegration = new ServicesIntegration();
