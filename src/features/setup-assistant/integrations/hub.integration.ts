// =====================================================
// TIS TIS PLATFORM - Integration Hub Connection
// Sprint 5: Connect setup assistant with external integrations
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type { MessageAction } from '../types';

// =====================================================
// TYPES
// =====================================================

export interface IntegrationSuggestion {
  name: string;
  type: string;
  description: string;
  benefits: string[];
  setupDifficulty: 'easy' | 'medium' | 'hard';
  icon?: string;
}

export interface IntegrationStatus {
  type: string;
  name: string;
  isConnected: boolean;
  lastSyncAt?: string;
}

// =====================================================
// HUB INTEGRATION CLASS
// =====================================================

export class HubIntegration {
  private supabase = createServerClient();

  // ======================
  // GET SUGGESTIONS
  // ======================

  /**
   * Get integration suggestions based on tenant's vertical and setup
   */
  async getIntegrationSuggestions(
    tenantId: string,
    vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym'
  ): Promise<IntegrationSuggestion[]> {
    try {
      // Check existing integrations
      const { data: existingIntegrations } = await this.supabase
        .from('integration_connections')
        .select('integration_type')
        .eq('tenant_id', tenantId)
        .eq('status', 'connected');

      const existingTypes = new Set(existingIntegrations?.map(i => i.integration_type) || []);

      // Get suggestions based on vertical
      const allSuggestions = this.getSuggestionsByVertical(vertical);

      // Filter out existing integrations
      return allSuggestions.filter(s => !existingTypes.has(s.type));
    } catch (error) {
      console.error('[HubIntegration] Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Get all possible integrations by vertical
   */
  private getSuggestionsByVertical(vertical: string): IntegrationSuggestion[] {
    const suggestionsByVertical: Record<string, IntegrationSuggestion[]> = {
      restaurant: [
        {
          name: 'Google Calendar',
          type: 'google_calendar',
          description: 'Sincroniza reservaciones con tu calendario',
          benefits: ['Ver disponibilidad en tiempo real', 'Notificaciones automáticas', 'Gestión de horarios'],
          setupDifficulty: 'easy',
          icon: 'calendar',
        },
        {
          name: 'Square POS',
          type: 'square',
          description: 'Conecta tu punto de venta',
          benefits: ['Sincronizar productos', 'Ventas en tiempo real', 'Inventario automático'],
          setupDifficulty: 'medium',
          icon: 'credit-card',
        },
        {
          name: 'Toast POS',
          type: 'toast',
          description: 'Conecta con Toast para gestión de restaurante',
          benefits: ['Pedidos centralizados', 'Menú sincronizado', 'Reportes unificados'],
          setupDifficulty: 'medium',
          icon: 'package',
        },
      ],
      dental: [
        {
          name: 'Google Calendar',
          type: 'google_calendar',
          description: 'Sincroniza citas con tu calendario',
          benefits: ['Gestión de citas automática', 'Recordatorios', 'Vista de disponibilidad'],
          setupDifficulty: 'easy',
          icon: 'calendar',
        },
        {
          name: 'HubSpot CRM',
          type: 'hubspot',
          description: 'Gestiona tus pacientes como leads',
          benefits: ['Seguimiento automatizado', 'Pipeline de pacientes', 'Marketing personalizado'],
          setupDifficulty: 'medium',
          icon: 'users',
        },
        {
          name: 'Calendly',
          type: 'calendly',
          description: 'Agenda citas con enlace personalizado',
          benefits: ['Enlaces de reserva', 'Integración con calendario', 'Recordatorios automáticos'],
          setupDifficulty: 'easy',
          icon: 'calendar',
        },
      ],
      clinic: [
        {
          name: 'Google Calendar',
          type: 'google_calendar',
          description: 'Sincroniza consultas con tu calendario',
          benefits: ['Gestión de agenda', 'Recordatorios', 'Disponibilidad en tiempo real'],
          setupDifficulty: 'easy',
          icon: 'calendar',
        },
        {
          name: 'HubSpot CRM',
          type: 'hubspot',
          description: 'Gestiona pacientes y seguimientos',
          benefits: ['Historial de pacientes', 'Campañas de salud', 'Análisis de datos'],
          setupDifficulty: 'medium',
          icon: 'users',
        },
      ],
      beauty: [
        {
          name: 'Google Calendar',
          type: 'google_calendar',
          description: 'Sincroniza citas con tu calendario',
          benefits: ['Gestión de agenda', 'Notificaciones', 'Disponibilidad online'],
          setupDifficulty: 'easy',
          icon: 'calendar',
        },
        {
          name: 'Acuity Scheduling',
          type: 'acuity',
          description: 'Sistema de reservas online avanzado',
          benefits: ['Reservas 24/7', 'Recordatorios automáticos', 'Pagos anticipados'],
          setupDifficulty: 'medium',
          icon: 'calendar',
        },
      ],
      veterinary: [
        {
          name: 'Google Calendar',
          type: 'google_calendar',
          description: 'Sincroniza citas veterinarias',
          benefits: ['Gestión de consultas', 'Recordatorios de vacunas', 'Seguimiento de pacientes'],
          setupDifficulty: 'easy',
          icon: 'calendar',
        },
      ],
      gym: [
        {
          name: 'Google Calendar',
          type: 'google_calendar',
          description: 'Sincroniza clases y sesiones',
          benefits: ['Horario de clases', 'Reservas de sesiones', 'Disponibilidad de entrenadores'],
          setupDifficulty: 'easy',
          icon: 'calendar',
        },
        {
          name: 'Square Payments',
          type: 'square',
          description: 'Gestiona membresías y pagos',
          benefits: ['Cobros recurrentes', 'Planes de membresía', 'Facturación automática'],
          setupDifficulty: 'easy',
          icon: 'credit-card',
        },
      ],
    };

    return suggestionsByVertical[vertical] || suggestionsByVertical.dental;
  }

  // ======================
  // INITIATE INTEGRATION
  // ======================

  /**
   * Initiate integration setup (redirect to settings)
   */
  async initiateIntegration(
    tenantId: string,
    integrationType: string
  ): Promise<{ redirectUrl: string; action: MessageAction }> {
    return {
      redirectUrl: `/dashboard/settings?tab=integrations&setup=${integrationType}`,
      action: {
        type: 'configure',
        module: 'integrations',
        entityType: 'integration_redirect',
        status: 'success',
        details: {
          integrationType,
          action: 'redirect_to_settings',
          message: 'Te redirigiremos a la página de integraciones para completar la configuración.',
        },
      },
    };
  }

  // ======================
  // GET INTEGRATION STATUS
  // ======================

  /**
   * Get current integration status for a tenant
   */
  async getIntegrationStatus(tenantId: string): Promise<IntegrationStatus[]> {
    try {
      const { data: connections } = await this.supabase
        .from('integration_connections')
        .select('integration_type, connection_name, status, last_sync_at')
        .eq('tenant_id', tenantId);

      if (!connections) return [];

      return connections.map(c => ({
        type: c.integration_type,
        name: c.connection_name,
        isConnected: c.status === 'connected',
        lastSyncAt: c.last_sync_at,
      }));
    } catch (error) {
      console.error('[HubIntegration] Error getting status:', error);
      return [];
    }
  }

  // ======================
  // CHECK INTEGRATION
  // ======================

  /**
   * Check if a specific integration is connected
   */
  async isIntegrationConnected(tenantId: string, integrationType: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('integration_connections')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_type', integrationType)
        .eq('status', 'connected')
        .single();

      return !!data;
    } catch {
      return false;
    }
  }

  // ======================
  // GET SETUP RECOMMENDATIONS
  // ======================

  /**
   * Get recommended integrations based on current setup progress
   */
  async getSetupRecommendations(
    tenantId: string,
    vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym',
    currentModules: string[]
  ): Promise<IntegrationSuggestion[]> {
    const suggestions = await this.getIntegrationSuggestions(tenantId, vertical);

    // Prioritize based on what's already configured
    const hasCalendar = currentModules.includes('branches'); // If branches are set, calendar is useful
    const hasServices = currentModules.includes('services'); // If services are set, payment is useful
    const hasLoyalty = currentModules.includes('loyalty'); // If loyalty is set, CRM is useful

    // Sort suggestions by relevance
    return suggestions.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Calendar is always recommended first
      if (a.type === 'google_calendar' && hasCalendar) scoreA += 10;
      if (b.type === 'google_calendar' && hasCalendar) scoreB += 10;

      // Payment integrations are recommended after services
      if ((a.type === 'stripe' || a.type === 'square') && hasServices) scoreA += 5;
      if ((b.type === 'stripe' || b.type === 'square') && hasServices) scoreB += 5;

      // CRM is recommended after loyalty
      if (a.type === 'hubspot' && hasLoyalty) scoreA += 3;
      if (b.type === 'hubspot' && hasLoyalty) scoreB += 3;

      // Easy integrations first
      const difficultyScore: Record<string, number> = { easy: 3, medium: 2, hard: 1 };
      scoreA += difficultyScore[a.setupDifficulty] || 0;
      scoreB += difficultyScore[b.setupDifficulty] || 0;

      return scoreB - scoreA;
    });
  }
}

// Singleton instance export
export const hubIntegration = new HubIntegration();
