// =====================================================
// TIS TIS PLATFORM - Service Priority Configuration
// Configure lead classification based on service interest
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, Button, Badge } from '@/src/shared/components/ui';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';
import type { ServiceLeadPriority } from '@/src/shared/types/database';

// ======================
// TYPES
// ======================
interface ServiceWithPriority {
  id: string;
  name: string;
  category: string | null;
  price_min: number | null;
  price_max: number | null;
  lead_priority: ServiceLeadPriority;
  is_active: boolean;
}

interface ServicePriorityConfigProps {
  className?: string;
}

// ======================
// ICONS
// ======================
const icons = {
  fire: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
  sun: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  snowflake: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3M3 12h18M3 12l3-3m-3 3l3 3m15-3l-3-3m3 3l-3 3" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  drag: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  ),
};

const priorityConfig = {
  hot: {
    label: 'HOT',
    description: 'Alta prioridad - Servicios de alto valor',
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    icon: icons.fire,
    examples: 'Implantes, Ortodoncia, Rehabilitaciones',
  },
  warm: {
    label: 'WARM',
    description: 'Prioridad media - Servicios moderados',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    icon: icons.sun,
    examples: 'Coronas, Endodoncia, Blanqueamiento',
  },
  cold: {
    label: 'COLD',
    description: 'Prioridad baja - Servicios básicos',
    color: 'bg-blue-400',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: icons.snowflake,
    examples: 'Limpieza, Consulta, Radiografías',
  },
};

// ======================
// COMPONENT
// ======================
export function ServicePriorityConfig({ className }: ServicePriorityConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<ServiceWithPriority[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, ServiceLeadPriority>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // ======================
  // DATA FETCHING
  // ======================
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch('/api/services?is_active=true', { headers });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Error al cargar servicios');
      }

      const result = await response.json();
      setServices(result.data || []);
    } catch (err) {
      console.error('[ServicePriorityConfig] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // ======================
  // HANDLERS
  // ======================
  const handlePriorityChange = (serviceId: string, newPriority: ServiceLeadPriority) => {
    // Update local state immediately for UI responsiveness
    setServices(prev => prev.map(s =>
      s.id === serviceId ? { ...s, lead_priority: newPriority } : s
    ));

    // Track pending changes
    setPendingChanges(prev => {
      const next = new Map(prev);
      next.set(serviceId, newPriority);
      return next;
    });
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const updates = Array.from(pendingChanges.entries()).map(([id, lead_priority]) => ({
        id,
        lead_priority,
      }));

      const response = await fetch('/api/services', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Error al guardar');
      }

      const result = await response.json();
      console.log('[ServicePriorityConfig] Saved:', result.message);

      // Clear pending changes
      setPendingChanges(new Map());
    } catch (err) {
      console.error('[ServicePriorityConfig] Save error:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar');
      // Revert changes on error
      fetchServices();
    } finally {
      setSaving(false);
    }
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.category || 'Sin categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceWithPriority[]>);

  // Count by priority
  const priorityCounts = {
    hot: services.filter(s => s.lead_priority === 'hot').length,
    warm: services.filter(s => s.lead_priority === 'warm').length,
    cold: services.filter(s => s.lead_priority === 'cold').length,
  };

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error && services.length === 0) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <p className="text-red-600">{error}</p>
        <Button variant="outline" onClick={fetchServices} className="mt-4">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header con explicación */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-indigo-900 mb-1">Clasificación por Servicio</h4>
            <p className="text-sm text-indigo-700">
              Cuando un lead muestra interés en un servicio específico, su clasificación se actualiza
              automáticamente según la prioridad del servicio. Esto permite priorizar leads que
              buscan tratamientos de alto valor.
            </p>
          </div>
        </div>
      </div>

      {/* Priority Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['hot', 'warm', 'cold'] as const).map((priority) => {
          const config = priorityConfig[priority];
          return (
            <div
              key={priority}
              className={cn(
                'p-4 rounded-xl border-2',
                config.bgColor,
                config.borderColor
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-3 h-3 rounded-full', config.color, priority === 'hot' && 'animate-pulse')} />
                <span className={cn('font-bold', config.textColor)}>{config.label}</span>
                <span className={cn('ml-auto text-2xl font-bold', config.textColor)}>
                  {priorityCounts[priority]}
                </span>
              </div>
              <p className={cn('text-xs', config.textColor)}>{config.description}</p>
              <p className={cn('text-xs mt-1 opacity-75', config.textColor)}>
                Ej: {config.examples}
              </p>
            </div>
          );
        })}
      </div>

      {/* Services List by Category */}
      <div className="space-y-6">
        {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
          <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Category Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h5 className="font-semibold text-gray-900">{category}</h5>
              <p className="text-xs text-gray-500">{categoryServices.length} servicios</p>
            </div>

            {/* Services */}
            <div className="divide-y divide-gray-100">
              {categoryServices.map((service) => {
                const currentPriority = priorityConfig[service.lead_priority];

                return (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Service Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{service.name}</p>
                      {(service.price_min || service.price_max) && (
                        <p className="text-xs text-gray-500">
                          {service.price_min && service.price_max
                            ? `$${service.price_min.toLocaleString()} - $${service.price_max.toLocaleString()}`
                            : service.price_min
                            ? `Desde $${service.price_min.toLocaleString()}`
                            : `Hasta $${service.price_max?.toLocaleString()}`}
                        </p>
                      )}
                    </div>

                    {/* Priority Selector */}
                    <div className="flex items-center gap-1 ml-4">
                      {(['hot', 'warm', 'cold'] as const).map((priority) => {
                        const config = priorityConfig[priority];
                        const isSelected = service.lead_priority === priority;

                        return (
                          <button
                            key={priority}
                            onClick={() => handlePriorityChange(service.id, priority)}
                            className={cn(
                              'relative p-2 rounded-lg transition-all',
                              isSelected
                                ? cn(config.bgColor, config.borderColor, 'border-2 shadow-sm')
                                : 'border border-transparent hover:bg-gray-100'
                            )}
                            title={`${config.label} - ${config.description}`}
                          >
                            <span className={cn(
                              isSelected ? config.textColor : 'text-gray-400'
                            )}>
                              {config.icon}
                            </span>
                            {isSelected && (
                              <motion.div
                                layoutId={`priority-indicator-${service.id}`}
                                className={cn(
                                  'absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full',
                                  config.color
                                )}
                                transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* No services message */}
      {services.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No hay servicios configurados</p>
          <p className="text-sm text-gray-500 mt-1">
            Los servicios se crearán automáticamente cuando configures tu clínica
          </p>
        </div>
      )}

      {/* Save Button - Only show if there are pending changes */}
      <AnimatePresence>
        {pendingChanges.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="sticky bottom-4 flex justify-center"
          >
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-center gap-4">
              <p className="text-sm text-gray-600">
                <strong>{pendingChanges.size}</strong> cambio{pendingChanges.size > 1 ? 's' : ''} pendiente{pendingChanges.size > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPendingChanges(new Map());
                    fetchServices();
                  }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={saveChanges}
                  isLoading={saving}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

export default ServicePriorityConfig;
