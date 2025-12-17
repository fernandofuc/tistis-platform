// =====================================================
// TIS TIS PLATFORM - Branch Management Component
// Full CRUD UI for managing tenant branches with billing
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Input, Badge } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { cn } from '@/src/shared/utils';

// ======================
// ICONS
// ======================
const icons = {
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  mapPin: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  money: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface Branch {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  whatsapp_number: string;
  is_headquarters: boolean;
  is_active: boolean;
  stats?: {
    total_leads: number;
    pending_appointments: number;
    active_conversations: number;
  };
}

interface SubscriptionInfo {
  plan: string;
  max_branches: number;
  current_branches: number;
  can_add_branch: boolean;
  can_remove_branch: boolean;
  next_branch_price: number;
  currency: string;
}

interface ExtraBranchPricing {
  extra_branch_price: number;
  currency: string;
  billing_period: string;
  current_branches: number;
  max_branches: number;
  new_total_branches: number;
  plan: string;
}

// ======================
// COMPONENT
// ======================
export function BranchManagement() {
  const { isAdmin } = useAuthContext();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<Branch | null>(null);
  const [showExtraBranchModal, setShowExtraBranchModal] = useState(false);
  const [extraBranchPricing, setExtraBranchPricing] = useState<ExtraBranchPricing | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for new/edit branch
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    address: '',
    phone: '',
    whatsapp_number: '',
  });

  // Fetch branches and subscription info
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch branches with stats
      const branchesRes = await fetch('/api/branches?include_stats=true');
      if (!branchesRes.ok) throw new Error('Error al cargar sucursales');
      const branchesData = await branchesRes.json();
      setBranches(branchesData.data || []);

      // Fetch extra branch pricing info
      const pricingRes = await fetch('/api/branches/add-extra');
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        setSubscriptionInfo({
          plan: pricingData.plan,
          max_branches: pricingData.max_branches,
          current_branches: pricingData.current_branches,
          can_add_branch: pricingData.current_branches < pricingData.max_branches,
          can_remove_branch: true,
          next_branch_price: pricingData.extra_branch_price,
          currency: pricingData.currency,
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle add branch (normal - within limit)
  const handleAddBranch = async () => {
    if (!formData.name.trim()) {
      setError('El nombre de la sucursal es requerido');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'branch_limit_reached') {
          // At limit - show extra branch pricing
          setShowAddModal(false);
          await checkExtraBranchPricing();
        } else {
          setError(data.message || data.error || 'Error al crear sucursal');
        }
        return;
      }

      // Success - refresh data
      setShowAddModal(false);
      setFormData({ name: '', city: '', state: '', address: '', phone: '', whatsapp_number: '' });
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Check extra branch pricing
  const checkExtraBranchPricing = async () => {
    try {
      const res = await fetch('/api/branches/add-extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, confirmBilling: false }),
      });

      const data = await res.json();

      if (data.requires_confirmation) {
        setExtraBranchPricing(data.pricing);
        setShowExtraBranchModal(true);
      } else if (data.error === 'plan_not_allowed') {
        setError(data.message);
      } else if (data.error) {
        setError(data.message || 'Error al verificar precio');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    }
  };

  // Handle add extra branch (with billing)
  const handleAddExtraBranch = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/branches/add-extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, confirmBilling: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || 'Error al crear sucursal');
        return;
      }

      // Success
      setShowExtraBranchModal(false);
      setFormData({ name: '', city: '', state: '', address: '', phone: '', whatsapp_number: '' });
      fetchData();

      // Show success message with billing info
      if (data.billing) {
        alert(data.billing.message);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Handle clicking "Agregar Sucursal" button
  const handleAddBranchClick = () => {
    setFormData({ name: '', city: '', state: '', address: '', phone: '', whatsapp_number: '' });
    setError(null);

    // Check if at limit
    if (subscriptionInfo && subscriptionInfo.current_branches >= subscriptionInfo.max_branches) {
      // At limit - show pricing confirmation first
      checkExtraBranchPricing();
    } else {
      // Not at limit - show normal add modal
      setShowAddModal(true);
    }
  };

  // Handle update branch
  const handleUpdateBranch = async () => {
    if (!editingBranch || !formData.name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/branches/${editingBranch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || data.error || 'Error al actualizar sucursal');
        return;
      }

      setEditingBranch(null);
      setFormData({ name: '', city: '', state: '', address: '', phone: '', whatsapp_number: '' });
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Handle delete branch
  const handleDeleteBranch = async () => {
    if (!showDeleteModal) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/branches/${showDeleteModal.id}?migrate=true`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'cannot_delete_hq') {
          setError(data.message);
        } else {
          setError(data.message || data.error || 'Error al eliminar sucursal');
        }
        return;
      }

      setShowDeleteModal(null);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Start editing a branch
  const startEditing = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      city: branch.city || '',
      state: branch.state || '',
      address: branch.address || '',
      phone: branch.phone || '',
      whatsapp_number: branch.whatsapp_number || '',
    });
  };

  // Check if at branch limit
  const isAtLimit = subscriptionInfo &&
    subscriptionInfo.current_branches >= subscriptionInfo.max_branches;

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Header Card with Subscription Info */}
      <Card variant="bordered">
        <CardHeader
          title="Sucursales"
          subtitle={subscriptionInfo
            ? `${subscriptionInfo.current_branches} de ${subscriptionInfo.max_branches} sucursales contratadas`
            : 'Gestiona las ubicaciones de tu negocio'
          }
          action={
            isAdmin && (
              <Button
                leftIcon={icons.plus}
                onClick={handleAddBranchClick}
              >
                Agregar Sucursal
              </Button>
            )
          }
        />
        <CardContent>
          {/* Branch Limit Info Banner */}
          {isAtLimit && subscriptionInfo?.next_branch_price > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <span className="text-blue-600">{icons.money}</span>
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  Has usado todas tus sucursales contratadas
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Tu plan <span className="font-semibold uppercase">{subscriptionInfo?.plan}</span> incluye {subscriptionInfo?.max_branches} sucursal{subscriptionInfo?.max_branches !== 1 ? 'es' : ''}.
                  Puedes agregar sucursales adicionales por {formatPrice(subscriptionInfo.next_branch_price)}/mes cada una.
                </p>
              </div>
            </div>
          )}

          {/* Starter Plan Warning */}
          {subscriptionInfo?.plan === 'starter' && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <span className="text-amber-600">{icons.alert}</span>
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  Plan Starter: 1 sucursal incluida
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Para agregar más sucursales, necesitas mejorar tu plan a Essentials o superior.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    window.location.href = '/dashboard/settings/subscription';
                  }}
                >
                  Ver Planes
                </Button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 font-medium">{error}</p>
              <button
                className="text-sm text-red-600 underline mt-1"
                onClick={() => setError(null)}
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                {icons.building}
              </div>
              <p className="text-lg font-medium mb-2">No hay sucursales</p>
              <p className="text-sm">Agrega tu primera sucursal para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-colors',
                    branch.is_headquarters
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    branch.is_headquarters
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-200 text-gray-600'
                  )}>
                    {icons.building}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {branch.name}
                      </h3>
                      {branch.is_headquarters && (
                        <Badge variant="info" size="sm">
                          <span className="flex items-center gap-1">
                            {icons.star}
                            Principal
                          </span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      {branch.city && branch.city !== 'Por configurar' && (
                        <span className="flex items-center gap-1">
                          {icons.mapPin}
                          {branch.city}, {branch.state}
                        </span>
                      )}
                      {branch.phone && (
                        <span className="flex items-center gap-1">
                          {icons.phone}
                          {branch.phone}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    {branch.stats && (
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-gray-500">
                          {branch.stats.total_leads} leads
                        </span>
                        <span className="text-gray-500">
                          {branch.stats.pending_appointments} citas
                        </span>
                        <span className="text-gray-500">
                          {branch.stats.active_conversations} conversaciones
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        onClick={() => startEditing(branch)}
                        title="Editar"
                      >
                        {icons.edit}
                      </button>
                      {!branch.is_headquarters && (
                        <button
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => setShowDeleteModal(branch)}
                          title="Eliminar"
                        >
                          {icons.trash}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Refresh Button */}
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={icons.refresh}
              onClick={fetchData}
              disabled={loading}
            >
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal (Normal - within limit) */}
      {(showAddModal || editingBranch) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {editingBranch
                  ? 'Actualiza la información de la sucursal'
                  : 'Agrega una nueva ubicación para tu negocio'
                }
              </p>
            </div>

            <div className="p-6 space-y-4">
              <Input
                label="Nombre de la Sucursal *"
                placeholder="Ej: Sucursal Centro"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ciudad"
                  placeholder="Ej: Monterrey"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
                <Input
                  label="Estado"
                  placeholder="Ej: Nuevo León"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>

              <Input
                label="Dirección"
                placeholder="Calle, número, colonia"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Teléfono"
                  placeholder="+52 81 1234 5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="WhatsApp"
                  placeholder="+52 81 1234 5678"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingBranch(null);
                  setFormData({ name: '', city: '', state: '', address: '', phone: '', whatsapp_number: '' });
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={editingBranch ? handleUpdateBranch : handleAddBranch}
                isLoading={saving}
              >
                {editingBranch ? 'Guardar Cambios' : 'Crear Sucursal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Branch Confirmation Modal (at limit - with billing) */}
      {showExtraBranchModal && extraBranchPricing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-blue-600">{icons.money}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Agregar Sucursal Extra
                  </h2>
                  <p className="text-sm text-gray-500">
                    Se agregará un cobro mensual adicional
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Pricing Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600">Sucursales actuales:</span>
                  <span className="font-semibold">{extraBranchPricing.current_branches} de {extraBranchPricing.max_branches}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600">Nueva sucursal:</span>
                  <span className="font-semibold text-blue-600">+1</span>
                </div>
                <div className="border-t border-blue-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-medium">Costo mensual adicional:</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatPrice(extraBranchPricing.extra_branch_price)}/mes
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <Input
                label="Nombre de la Sucursal *"
                placeholder="Ej: Sucursal Centro"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ciudad"
                  placeholder="Ej: Monterrey"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
                <Input
                  label="Estado"
                  placeholder="Ej: Nuevo León"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>

              <Input
                label="Dirección"
                placeholder="Calle, número, colonia"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Teléfono"
                  placeholder="+52 81 1234 5678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="WhatsApp"
                  placeholder="+52 81 1234 5678"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                />
              </div>

              {/* Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> El cobro de {formatPrice(extraBranchPricing.extra_branch_price)}/mes se agregará a tu próxima factura y se mantendrá mientras la sucursal esté activa.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowExtraBranchModal(false);
                  setExtraBranchPricing(null);
                  setFormData({ name: '', city: '', state: '', address: '', phone: '', whatsapp_number: '' });
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddExtraBranch}
                isLoading={saving}
                disabled={!formData.name.trim()}
              >
                Confirmar y Agregar (+{formatPrice(extraBranchPricing.extra_branch_price)}/mes)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600">{icons.trash}</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center">
                ¿Eliminar sucursal?
              </h2>
              <p className="text-gray-500 text-center mt-2">
                Esta acción eliminará <strong>{showDeleteModal.name}</strong>.
              </p>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> Los leads, citas y conversaciones de esta sucursal
                  se moverán automáticamente a la Sucursal Principal.
                </p>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteModal(null);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDeleteBranch}
                isLoading={saving}
              >
                Sí, Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BranchManagement;
