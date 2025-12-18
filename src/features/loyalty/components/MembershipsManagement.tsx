// =====================================================
// TIS TIS PLATFORM - Memberships Management Component
// Manage membership plans and active memberships
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/shared/utils';
import { useMembershipPlans } from '../hooks/useLoyalty';
import * as loyaltyService from '../services/loyalty.service';
import type { MembershipPlan, Membership } from '../types';

// ======================
// PLAN CARD COMPONENT
// ======================
interface PlanCardProps {
  plan: MembershipPlan;
  onEdit: (plan: MembershipPlan) => void;
  onToggle: (plan: MembershipPlan) => void;
  onDelete: (plan: MembershipPlan) => void;
}

function PlanCard({ plan, onEdit, onToggle, onDelete }: PlanCardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl border p-6 transition-all',
      plan.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60',
      plan.is_featured && plan.is_active && 'ring-2 ring-tis-coral'
    )}>
      {plan.is_featured && plan.is_active && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-tis-coral text-white text-xs font-medium px-3 py-1 rounded-full">
            Destacado
          </span>
        </div>
      )}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{plan.plan_name}</h3>
          {plan.plan_description && (
            <p className="text-sm text-gray-500 mt-1">{plan.plan_description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(plan)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              plan.is_active
                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            )}
            title={plan.is_active ? 'Desactivar' : 'Activar'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {plan.is_active ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </button>
          <button
            onClick={() => onEdit(plan)}
            className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(plan)}
            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
            title="Eliminar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Prices */}
      <div className="flex items-baseline gap-2 mb-4">
        {plan.price_monthly && (
          <div>
            <span className="text-2xl font-bold text-gray-900">${plan.price_monthly}</span>
            <span className="text-gray-500 text-sm">/mes</span>
          </div>
        )}
        {plan.price_monthly && plan.price_annual && <span className="text-gray-300">|</span>}
        {plan.price_annual && (
          <div>
            <span className="text-lg font-semibold text-gray-700">${plan.price_annual}</span>
            <span className="text-gray-500 text-sm">/año</span>
          </div>
        )}
      </div>

      {/* Benefits */}
      {plan.benefits && plan.benefits.length > 0 && (
        <ul className="space-y-2 mb-4">
          {plan.benefits.map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {benefit}
            </li>
          ))}
        </ul>
      )}

      {/* Extra info */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        {(plan.discount_percent > 0 || (plan.discount_percentage && plan.discount_percentage > 0)) && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            {plan.discount_percent || plan.discount_percentage}% descuento
          </span>
        )}
        {plan.tokens_multiplier > 1 && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
            x{plan.tokens_multiplier} puntos
          </span>
        )}
        {plan.priority_booking && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            Prioridad en citas
          </span>
        )}
      </div>
    </div>
  );
}

// ======================
// PLAN FORM MODAL
// ======================
interface PlanFormProps {
  plan?: MembershipPlan | null;
  onSave: (data: Partial<MembershipPlan>) => Promise<void>;
  onClose: () => void;
}

function PlanForm({ plan, onSave, onClose }: PlanFormProps) {
  const [formData, setFormData] = useState({
    plan_name: plan?.plan_name || '',
    plan_description: plan?.plan_description || '',
    price_monthly: plan?.price_monthly || '',
    price_annual: plan?.price_annual || '',
    benefits: plan?.benefits?.join('\n') || '',
    discount_percentage: plan?.discount_percent || plan?.discount_percentage || 0, // Support both names
    tokens_multiplier: plan?.tokens_multiplier || 1,
    priority_booking: plan?.priority_booking || false,
    is_active: plan?.is_active ?? true,
    is_featured: plan?.is_featured || false,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate form
    if (!formData.plan_name.trim()) {
      setFormError('El nombre del plan es requerido');
      return;
    }

    if (!formData.price_monthly && !formData.price_annual) {
      setFormError('Debes especificar al menos un precio (mensual o anual)');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        plan_name: formData.plan_name.trim(),
        plan_description: formData.plan_description?.trim() || null,
        price_monthly: formData.price_monthly ? Number(formData.price_monthly) : null,
        price_annual: formData.price_annual ? Number(formData.price_annual) : null,
        benefits: formData.benefits.split('\n').filter(b => b.trim()),
        discount_percentage: formData.discount_percentage,
        tokens_multiplier: formData.tokens_multiplier,
        priority_booking: formData.priority_booking,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
      });
      onClose();
    } catch (err) {
      console.error('Error saving plan:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al guardar';
      setFormError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {plan ? 'Editar Plan' : 'Nuevo Plan de Membresía'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Display */}
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formError}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Plan</label>
            <input
              type="text"
              value={formData.plan_name}
              onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
              placeholder="Ej: Plan Premium"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              value={formData.plan_description}
              onChange={(e) => setFormData({ ...formData, plan_description: e.target.value })}
              placeholder="Describe el plan..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Precio Mensual ($)</label>
              <input
                type="number"
                value={formData.price_monthly}
                onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                placeholder="299"
                min={0}
                step={0.01}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Precio Anual ($)</label>
              <input
                type="number"
                value={formData.price_annual}
                onChange={(e) => setFormData({ ...formData, price_annual: e.target.value })}
                placeholder="2990"
                min={0}
                step={0.01}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Beneficios (uno por línea)</label>
            <textarea
              value={formData.benefits}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              placeholder="Limpieza dental gratis
20% descuento en blanqueamiento
Prioridad en citas"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descuento General (%)</label>
              <input
                type="number"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                min={0}
                max={100}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Multiplicador de Puntos</label>
              <input
                type="number"
                value={formData.tokens_multiplier}
                onChange={(e) => setFormData({ ...formData, tokens_multiplier: Number(e.target.value) })}
                min={1}
                step={0.5}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.priority_booking}
                onChange={(e) => setFormData({ ...formData, priority_booking: e.target.checked })}
                className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
              />
              <span className="text-sm text-gray-700">Prioridad en reservación de citas</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_featured}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
              />
              <span className="text-sm text-gray-700">Plan destacado</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
              />
              <span className="text-sm text-gray-700">Plan activo</span>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-tis-coral text-white rounded-lg hover:bg-tis-coral/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : plan ? 'Guardar Cambios' : 'Crear Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ======================
// MEMBERSHIPS LIST
// ======================
function MembershipsList() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loyaltyService.getMemberships({
        status: filter === 'all' ? undefined : filter,
        limit: 50,
      });
      setMemberships(data.memberships);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  const handleCancel = async (id: string) => {
    if (confirm('¿Cancelar esta membresía?')) {
      await loyaltyService.cancelMembership(id);
      loadMemberships();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Membresías de Pacientes</h3>
        <div className="flex gap-2">
          {(['all', 'active', 'expired'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                filter === f
                  ? 'bg-tis-coral text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Vencidas'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral mx-auto"></div>
        </div>
      ) : memberships.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No hay membresías {filter !== 'all' ? `${filter === 'active' ? 'activas' : 'vencidas'}` : ''}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {memberships.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{m.leads?.name}</p>
                <p className="text-sm text-gray-500">
                  {m.loyalty_membership_plans?.plan_name} • {m.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    m.status === 'active' ? 'bg-green-100 text-green-700' :
                    m.status === 'expired' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  )}>
                    {m.status === 'active' ? 'Activa' :
                     m.status === 'expired' ? 'Vencida' :
                     m.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    Vence: {new Date(m.end_date).toLocaleDateString('es-MX')}
                  </p>
                </div>
                {m.status === 'active' && (
                  <button
                    onClick={() => handleCancel(m.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function MembershipsManagement() {
  const { plans, loading, error, createPlan, updatePlan, deletePlan } = useMembershipPlans(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MembershipPlan | null>(null);
  const [activeSection, setActiveSection] = useState<'plans' | 'memberships'>('plans');

  const handleSavePlan = async (data: Partial<MembershipPlan>) => {
    if (editingPlan) {
      await updatePlan(editingPlan.id, data);
    } else {
      await createPlan(data);
    }
    setShowForm(false);
    setEditingPlan(null);
  };

  const handleTogglePlan = async (plan: MembershipPlan) => {
    await updatePlan(plan.id, { is_active: !plan.is_active });
  };

  const handleDeletePlan = async () => {
    if (deleteConfirm) {
      try {
        await deletePlan(deleteConfirm.id);
        setDeleteConfirm(null);
      } catch (err: unknown) {
        const error = err as Error;
        alert(error.message || 'Error al eliminar');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveSection('plans')}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'plans'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Planes de Membresía
        </button>
        <button
          onClick={() => setActiveSection('memberships')}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'memberships'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Membresías Activas
        </button>
      </div>

      {activeSection === 'plans' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Planes de Membresía</h2>
              <p className="text-sm text-gray-500">Configura los planes que ofrecerás a tus pacientes</p>
            </div>
            <button
              onClick={() => { setEditingPlan(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-tis-coral text-white rounded-lg hover:bg-tis-coral/90 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Plan
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
              {error}
            </div>
          )}

          {plans.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Sin planes configurados</h3>
              <p className="text-gray-500 text-sm mb-4">Crea tu primer plan de membresía</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-tis-coral font-medium hover:underline"
              >
                Crear primer plan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div key={plan.id} className="relative">
                  <PlanCard
                    plan={plan}
                    onEdit={(p) => { setEditingPlan(p); setShowForm(true); }}
                    onToggle={handleTogglePlan}
                    onDelete={(p) => setDeleteConfirm(p)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <MembershipsList />
      )}

      {/* Form Modal */}
      {showForm && (
        <PlanForm
          plan={editingPlan}
          onSave={handleSavePlan}
          onClose={() => { setShowForm(false); setEditingPlan(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Plan</h3>
            <p className="text-gray-500 mb-6">
              ¿Estás seguro de eliminar &ldquo;{deleteConfirm.plan_name}&rdquo;? Los pacientes con este plan mantendrán su membresía actual.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePlan}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
