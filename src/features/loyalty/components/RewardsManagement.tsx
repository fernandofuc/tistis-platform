// =====================================================
// TIS TIS PLATFORM - Rewards Management Component
// Professional reward catalog management with Apple/TIS TIS style
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/shared/utils';
import { useRewards, useLoyaltyProgram } from '../hooks/useLoyalty';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import * as loyaltyService from '../services/loyalty.service';
import type { LoyaltyReward, RewardType, Redemption } from '../types';

// ======================
// CONSTANTS
// ======================
const REWARD_TYPE_CONFIG: Record<RewardType, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  gradient: string;
}> = {
  discount_percentage: {
    label: 'Descuento %',
    description: 'Porcentaje de descuento',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    gradient: 'from-emerald-500 to-green-600',
  },
  discount_fixed: {
    label: 'Descuento Fijo',
    description: 'Monto fijo de descuento',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    gradient: 'from-blue-500 to-indigo-600',
  },
  free_service: {
    label: 'Servicio Gratis',
    description: 'Servicio completamente gratis',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    gradient: 'from-violet-500 to-purple-600',
  },
  gift: {
    label: 'Regalo',
    description: 'Producto o artículo de regalo',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    gradient: 'from-pink-500 to-rose-600',
  },
  upgrade: {
    label: 'Upgrade',
    description: 'Mejora de servicio',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    gradient: 'from-amber-500 to-orange-600',
  },
  custom: {
    label: 'Personalizado',
    description: 'Recompensa personalizada',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    gradient: 'from-gray-500 to-gray-700',
  },
};

// ======================
// STATS HEADER
// ======================
interface StatsHeaderProps {
  rewards: LoyaltyReward[];
  tokensName: string;
}

function StatsHeader({ rewards, tokensName }: StatsHeaderProps) {
  const activeRewards = rewards.filter(r => r.is_active).length;
  const totalStock = rewards.reduce((sum, r) => {
    if (r.stock_limit && r.is_active) {
      return sum + (r.stock_limit - r.stock_used);
    }
    return sum;
  }, 0);
  const avgTokens = rewards.length > 0
    ? Math.round(rewards.reduce((sum, r) => sum + r.tokens_required, 0) / rewards.length)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeRewards}</p>
            <p className="text-sm text-slate-500">Recompensas Activas</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalStock > 0 ? totalStock : '∞'}</p>
            <p className="text-sm text-slate-500">Stock Disponible</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{avgTokens}</p>
            <p className="text-sm text-slate-500">{tokensName} Promedio</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// REWARD CARD COMPONENT
// ======================
interface RewardCardProps {
  reward: LoyaltyReward;
  tokensName: string;
  onEdit: (reward: LoyaltyReward) => void;
  onToggle: (reward: LoyaltyReward) => void;
  onDelete: (reward: LoyaltyReward) => void;
}

function RewardCard({ reward, tokensName, onEdit, onToggle, onDelete }: RewardCardProps) {
  const config = REWARD_TYPE_CONFIG[reward.reward_type];

  const getBadgeText = () => {
    switch (reward.reward_type) {
      case 'discount_percentage':
        return `${reward.discount_value}% OFF`;
      case 'discount_fixed':
        return `$${reward.discount_value} OFF`;
      case 'free_service':
        return 'GRATIS';
      case 'gift':
        return 'REGALO';
      case 'upgrade':
        return 'UPGRADE';
      default:
        return 'CANJEABLE';
    }
  };

  const stockPercent = reward.stock_limit
    ? ((reward.stock_limit - reward.stock_used) / reward.stock_limit) * 100
    : 100;

  const stockRemaining = reward.stock_limit ? reward.stock_limit - reward.stock_used : null;

  return (
    <div className={cn(
      'bg-white rounded-2xl border-2 overflow-hidden transition-all duration-200 hover:shadow-lg group',
      reward.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
    )}>
      {/* Header with gradient */}
      <div className={cn(
        'p-5 text-white relative overflow-hidden',
        reward.is_active
          ? 'bg-slate-900'
          : 'bg-slate-400'
      )}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold bg-white/25 backdrop-blur-sm px-3 py-1 rounded-full">
              {getBadgeText()}
            </span>
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold">{reward.tokens_required}</span>
            </div>
          </div>
          <h3 className="font-bold text-lg leading-tight">{reward.reward_name}</h3>
          {!reward.is_active && (
            <span className="inline-block mt-2 text-xs bg-white/30 px-2 py-0.5 rounded">
              Inactivo
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {reward.reward_description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">
            {reward.reward_description}
          </p>
        )}

        {/* Stock indicator */}
        {reward.stock_limit && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">Stock disponible</span>
              <span className={cn(
                'font-semibold',
                stockPercent > 50 ? 'text-green-600' :
                stockPercent > 20 ? 'text-amber-600' : 'text-red-600'
              )}>
                {stockRemaining} / {reward.stock_limit}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  stockPercent > 50 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                  stockPercent > 20 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                  'bg-gradient-to-r from-red-400 to-rose-500'
                )}
                style={{ width: `${stockPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Info tags */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Válido {reward.valid_days} días
          </span>
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
            config.bgColor,
            config.color
          )}>
            {config.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => onToggle(reward)}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
              reward.is_active
                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            )}
            title={reward.is_active ? 'Desactivar' : 'Activar'}
          >
            {reward.is_active ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onEdit(reward)}
            className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-all"
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(reward)}
            className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all"
            title="Eliminar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================
// REWARD FORM MODAL
// ======================
interface RewardFormProps {
  reward?: LoyaltyReward | null;
  onSave: (data: Partial<LoyaltyReward>) => Promise<void>;
  onClose: () => void;
}

function RewardForm({ reward, onSave, onClose }: RewardFormProps) {
  const { terminology } = useVerticalTerminology();
  const patientsLower = terminology.patients.toLowerCase();
  const [formData, setFormData] = useState({
    reward_name: reward?.reward_name || '',
    reward_description: reward?.reward_description || '',
    reward_type: reward?.reward_type || 'discount_percentage',
    tokens_required: reward?.tokens_required || 100,
    discount_value: reward?.discount_value || 0,
    stock_limit: reward?.stock_limit || '',
    valid_days: reward?.valid_days || 30,
    terms_conditions: reward?.terms_conditions || '',
    is_active: reward?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        reward_name: formData.reward_name,
        reward_description: formData.reward_description || null,
        reward_type: formData.reward_type as RewardType,
        tokens_required: formData.tokens_required,
        discount_type: formData.reward_type === 'discount_percentage' ? 'percentage' : 'fixed',
        discount_value: formData.discount_value || null,
        stock_limit: formData.stock_limit ? Number(formData.stock_limit) : null,
        valid_days: formData.valid_days,
        terms_conditions: formData.terms_conditions || null,
        is_active: formData.is_active,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const showDiscountField = ['discount_percentage', 'discount_fixed'].includes(formData.reward_type);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {reward ? 'Editar Recompensa' : 'Nueva Recompensa'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {reward ? 'Modifica los detalles de la recompensa' : `Crea una recompensa para tus ${patientsLower}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
              <input
                type="text"
                value={formData.reward_name}
                onChange={(e) => setFormData({ ...formData, reward_name: e.target.value })}
                placeholder="Ej: Limpieza dental gratis"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
              <textarea
                value={formData.reward_description}
                onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
                placeholder="Describe la recompensa..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors resize-none"
                rows={2}
              />
            </div>

            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Recompensa</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(REWARD_TYPE_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, reward_type: key as RewardType })}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all text-center',
                      formData.reward_type === key
                        ? 'border-tis-coral bg-tis-coral/5'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className="font-medium text-gray-900 text-sm">{config.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tokens & Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Puntos Requeridos</label>
                <input
                  type="number"
                  value={formData.tokens_required}
                  onChange={(e) => setFormData({ ...formData, tokens_required: Number(e.target.value) })}
                  min={1}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                  required
                />
              </div>
              {showDiscountField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor {formData.reward_type === 'discount_percentage' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                    min={0}
                    max={formData.reward_type === 'discount_percentage' ? 100 : undefined}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Stock & Validity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Límite</label>
                <input
                  type="number"
                  value={formData.stock_limit}
                  onChange={(e) => setFormData({ ...formData, stock_limit: e.target.value })}
                  placeholder="Sin límite"
                  min={1}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Días de Validez</label>
                <input
                  type="number"
                  value={formData.valid_days}
                  onChange={(e) => setFormData({ ...formData, valid_days: Number(e.target.value) })}
                  min={1}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                  required
                />
              </div>
            </div>

            {/* Terms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Términos y Condiciones <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={formData.terms_conditions}
                onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                placeholder="Condiciones de la recompensa..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors resize-none"
                rows={2}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900">Recompensa Activa</p>
                <p className="text-sm text-gray-500">Disponible para canjear por los {patientsLower}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tis-coral focus:ring-offset-2',
                  formData.is_active ? 'bg-green-500' : 'bg-gray-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform',
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !formData.reward_name}
              className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </span>
              ) : reward ? 'Guardar Cambios' : 'Crear Recompensa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ======================
// REDEMPTIONS LIST
// ======================
function RedemptionsList() {
  const { terminology } = useVerticalTerminology();
  const patientsLower = terminology.patients.toLowerCase();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'used' | 'all'>('pending');

  const loadRedemptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loyaltyService.getRedemptions({
        status: filter === 'all' ? undefined : filter as 'pending' | 'used',
        limit: 50,
      });
      setRedemptions(data.redemptions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadRedemptions();
  }, [loadRedemptions]);

  const handleMarkUsed = async (redemption: Redemption) => {
    await loyaltyService.markRedemptionUsed(redemption.id);
    loadRedemptions();
  };

  const filters: { value: 'pending' | 'used' | 'all'; label: string; count?: number }[] = [
    { value: 'pending', label: 'Pendientes' },
    { value: 'used', label: 'Usados' },
    { value: 'all', label: 'Todos' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Canjes de Recompensas</h2>
          <p className="text-gray-500 mt-1">Gestiona los canjes realizados por tus {patientsLower}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-xl transition-all',
              filter === f.value
                ? 'bg-slate-900 text-white'
                : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tis-coral mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">Cargando canjes...</p>
          </div>
        ) : redemptions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Sin canjes {filter === 'pending' ? 'pendientes' : ''}</h3>
            <p className="text-gray-500 text-sm">
              {filter === 'pending'
                ? 'No hay canjes esperando ser validados'
                : 'No se han registrado canjes aún'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {redemptions.map((r) => (
              <div key={r.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{r.leads?.name || terminology.patient}</p>
                    <p className="text-sm text-gray-500">{r.loyalty_rewards?.reward_name || 'Recompensa'}</p>
                    <p className="text-xs text-gray-400 font-mono mt-1 bg-gray-100 px-2 py-0.5 rounded inline-block">
                      {r.redemption_code}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full',
                      r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      r.status === 'used' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        r.status === 'pending' ? 'bg-amber-500' :
                        r.status === 'used' ? 'bg-green-500' : 'bg-red-500'
                      )} />
                      {r.status === 'pending' ? 'Pendiente' :
                       r.status === 'used' ? 'Usado' : 'Expirado'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      -{r.tokens_used} pts
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <button
                      onClick={() => handleMarkUsed(r)}
                      className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-xl hover:bg-green-200 transition-colors"
                    >
                      Validar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ======================
// EMPTY STATE
// ======================
interface EmptyStateProps {
  onCreate: () => void;
}

function EmptyState({ onCreate }: EmptyStateProps) {
  const { terminology } = useVerticalTerminology();
  const patientsLower = terminology.patients.toLowerCase();
  return (
    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">Crea tu Catálogo de Recompensas</h3>
      <p className="text-slate-500 max-w-md mx-auto mb-6">
        Define las recompensas que tus {patientsLower} pueden canjear con sus puntos acumulados.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Crear Primera Recompensa
      </button>
    </div>
  );
}

// ======================
// DELETE MODAL
// ======================
interface DeleteModalProps {
  reward: LoyaltyReward;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteModal({ reward, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Eliminar Recompensa</h3>
        <p className="text-gray-500 text-center mb-6">
          ¿Estás seguro de eliminar <span className="font-semibold text-gray-900">&ldquo;{reward.reward_name}&rdquo;</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function RewardsManagement() {
  const { rewards, loading, error, createReward, updateReward, deleteReward } = useRewards(true);
  const { program } = useLoyaltyProgram();
  const { terminology } = useVerticalTerminology();
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LoyaltyReward | null>(null);
  const [activeSection, setActiveSection] = useState<'catalog' | 'redemptions'>('catalog');

  const tokensName = program?.tokens_name_plural || 'Puntos';
  const patientsLower = terminology.patients.toLowerCase();

  const handleSaveReward = async (data: Partial<LoyaltyReward>) => {
    if (editingReward) {
      await updateReward(editingReward.id, data);
    } else {
      await createReward(data);
    }
    setShowForm(false);
    setEditingReward(null);
  };

  const handleToggleReward = async (reward: LoyaltyReward) => {
    await updateReward(reward.id, { is_active: !reward.is_active });
  };

  const handleDeleteReward = async () => {
    if (deleteConfirm) {
      await deleteReward(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tis-coral"></div>
          <p className="text-sm text-gray-500">Cargando recompensas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Toggle */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveSection('catalog')}
          className={cn(
            'px-5 py-2.5 text-sm font-medium rounded-lg transition-all',
            activeSection === 'catalog'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            Catálogo
          </span>
        </button>
        <button
          onClick={() => setActiveSection('redemptions')}
          className={cn(
            'px-5 py-2.5 text-sm font-medium rounded-lg transition-all',
            activeSection === 'redemptions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Canjes
          </span>
        </button>
      </div>

      {activeSection === 'catalog' ? (
        <>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Catálogo de Recompensas</h2>
              <p className="text-gray-500 mt-1">Recompensas que tus {patientsLower} pueden canjear con {tokensName.toLowerCase()}</p>
            </div>
            <button
              onClick={() => { setEditingReward(null); setShowForm(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Recompensa
            </button>
          </div>

          {/* Stats */}
          {rewards.length > 0 && <StatsHeader rewards={rewards} tokensName={tokensName} />}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Content */}
          {rewards.length === 0 ? (
            <EmptyState onCreate={() => setShowForm(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  tokensName={tokensName}
                  onEdit={(r) => { setEditingReward(r); setShowForm(true); }}
                  onToggle={handleToggleReward}
                  onDelete={(r) => setDeleteConfirm(r)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <RedemptionsList />
      )}

      {/* Form Modal */}
      {showForm && (
        <RewardForm
          reward={editingReward}
          onSave={handleSaveReward}
          onClose={() => { setShowForm(false); setEditingReward(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteModal
          reward={deleteConfirm}
          onConfirm={handleDeleteReward}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
