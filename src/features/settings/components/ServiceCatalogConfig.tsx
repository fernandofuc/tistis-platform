// =====================================================
// TIS TIS PLATFORM - Service Catalog Configuration
// Configure service prices, duration, and availability
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, Button, Badge, Input } from '@/src/shared/components/ui';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================
interface Service {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  lead_priority: 'hot' | 'warm' | 'cold';
  currency: string;
}

interface ServiceUpdate {
  price_min?: number | null;
  price_max?: number | null;
  duration_minutes?: number | null;
  is_active?: boolean;
}

interface PendingChange {
  serviceId: string;
  field: keyof ServiceUpdate;
  value: number | boolean | null;
}

interface ServiceCatalogConfigProps {
  className?: string;
}

// ======================
// ICONS
// ======================
const icons = {
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  currency: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  chevronUp: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ),
  fire: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
    </svg>
  ),
};

const priorityBadge = {
  hot: { label: 'HOT', color: 'bg-red-100 text-red-700' },
  warm: { label: 'WARM', color: 'bg-amber-100 text-amber-700' },
  cold: { label: 'COLD', color: 'bg-blue-100 text-blue-700' },
};

// ======================
// COMPONENT
// ======================
export function ServiceCatalogConfig({ className }: ServiceCatalogConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, ServiceUpdate>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingService, setEditingService] = useState<string | null>(null);

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
      // Fetch ALL services including inactive ones
      const response = await fetch('/api/services', { headers });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Error al cargar servicios');
      }

      const result = await response.json();
      setServices(result.data || []);

      // Expand all categories by default
      const categories = new Set<string>(
        (result.data || []).map((s: Service) => s.category || 'Sin categoría')
      );
      setExpandedCategories(categories);
    } catch (err) {
      console.error('[ServiceCatalogConfig] Error:', err);
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
  const handleFieldChange = (serviceId: string, field: keyof ServiceUpdate, value: number | boolean | null) => {
    // Update local state immediately
    setServices(prev => prev.map(s =>
      s.id === serviceId ? { ...s, [field]: value } : s
    ));

    // Track pending changes
    setPendingChanges(prev => {
      const next = new Map(prev);
      const existing = next.get(serviceId) || {};
      next.set(serviceId, { ...existing, [field]: value });
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      // Save each service update
      const updates = Array.from(pendingChanges.entries()).map(([id, changes]) => ({
        id,
        ...changes,
      }));

      const response = await fetch('/api/services/catalog', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Error al guardar');
      }

      const result = await response.json();
      console.log('[ServiceCatalogConfig] Saved:', result.message);

      // Clear pending changes
      setPendingChanges(new Map());
      setEditingService(null);
    } catch (err) {
      console.error('[ServiceCatalogConfig] Save error:', err);
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
  }, {} as Record<string, Service[]>);

  // Stats
  const stats = {
    total: services.length,
    active: services.filter(s => s.is_active).length,
    inactive: services.filter(s => !s.is_active).length,
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
      {/* Header */}
      <div>
        <h4 className="font-medium text-gray-900">Catálogo de Servicios</h4>
        <p className="text-sm text-gray-500">
          Configura precios, duración y disponibilidad de tus servicios
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
          <p className="text-2xl font-bold text-purple-700">{stats.total}</p>
          <p className="text-sm text-purple-600">Total Servicios</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
          <p className="text-sm text-green-600">Activos</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200">
          <p className="text-2xl font-bold text-gray-500">{stats.inactive}</p>
          <p className="text-sm text-gray-500">Inactivos</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            {icons.currency}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">Personaliza tu Catálogo</h4>
            <p className="text-sm text-blue-700">
              Ajusta los precios según tu mercado local. Los precios predeterminados son referencias
              basadas en promedios de la industria dental en México (MXN).
            </p>
          </div>
        </div>
      </div>

      {/* Services by Category */}
      <div className="space-y-4">
        {Object.entries(servicesByCategory).map(([category, categoryServices]) => {
          const isExpanded = expandedCategories.has(category);
          const activeCount = categoryServices.filter(s => s.is_active).length;

          return (
            <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Category Header - Clickable */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'}>
                    {icons.chevronDown}
                  </span>
                  <div className="text-left">
                    <h5 className="font-semibold text-gray-900">{category}</h5>
                    <p className="text-xs text-gray-500">
                      {activeCount}/{categoryServices.length} servicios activos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {categoryServices.some(s => s.lead_priority === 'hot') && (
                    <span className="text-red-500">{icons.fire}</span>
                  )}
                </div>
              </button>

              {/* Services List */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-gray-100">
                      {categoryServices.map((service) => (
                        <ServiceRow
                          key={service.id}
                          service={service}
                          isEditing={editingService === service.id}
                          onEdit={() => setEditingService(service.id)}
                          onClose={() => setEditingService(null)}
                          onChange={(field, value) => handleFieldChange(service.id, field, value)}
                          hasPendingChanges={pendingChanges.has(service.id)}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
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
            Los servicios se crearán automáticamente
          </p>
        </div>
      )}

      {/* Save Button - Sticky bottom */}
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
                <strong>{pendingChanges.size}</strong> servicio{pendingChanges.size > 1 ? 's' : ''} modificado{pendingChanges.size > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPendingChanges(new Map());
                    setEditingService(null);
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

// ======================
// SERVICE ROW COMPONENT
// ======================
interface ServiceRowProps {
  service: Service;
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onChange: (field: keyof ServiceUpdate, value: number | boolean | null) => void;
  hasPendingChanges: boolean;
}

function ServiceRow({ service, isEditing, onEdit, onClose, onChange, hasPendingChanges }: ServiceRowProps) {
  const badge = priorityBadge[service.lead_priority];

  return (
    <div className={cn(
      'p-4 transition-colors',
      !service.is_active && 'bg-gray-50 opacity-60',
      hasPendingChanges && 'bg-purple-50 border-l-4 border-purple-400'
    )}>
      {/* Service Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={cn(
              'font-medium',
              service.is_active ? 'text-gray-900' : 'text-gray-500'
            )}>
              {service.name}
            </p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', badge.color)}>
              {badge.label}
            </span>
          </div>
          {service.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{service.description}</p>
          )}
        </div>

        {/* Active Toggle */}
        <button
          onClick={() => onChange('is_active', !service.is_active)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            service.is_active ? 'bg-green-500' : 'bg-gray-300'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              service.is_active ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* Price and Duration Fields */}
      <div className="grid grid-cols-3 gap-3">
        {/* Price Min */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Precio Mín.</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={service.price_min ?? ''}
              onChange={(e) => onChange('price_min', e.target.value ? Number(e.target.value) : null)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        {/* Price Max */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Precio Máx.</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={service.price_max ?? ''}
              onChange={(e) => onChange('price_max', e.target.value ? Number(e.target.value) : null)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Duración</label>
          <div className="relative">
            <input
              type="number"
              value={service.duration_minutes ?? ''}
              onChange={(e) => onChange('duration_minutes', e.target.value ? Number(e.target.value) : null)}
              className="w-full pl-3 pr-12 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="30"
              min="5"
              step="5"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">min</span>
          </div>
        </div>
      </div>

      {/* Currency indicator */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Moneda: {service.currency || 'MXN'}
        </span>
        {hasPendingChanges && (
          <span className="text-xs text-purple-600 font-medium">
            Cambios pendientes
          </span>
        )}
      </div>
    </div>
  );
}

export default ServiceCatalogConfig;
