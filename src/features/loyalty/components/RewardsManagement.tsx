// =====================================================
// TIS TIS PLATFORM - Rewards Management Component
// Manage reward catalog and redemptions
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/shared/utils';
import { useRewards, useLoyaltyProgram } from '../hooks/useLoyalty';
import * as loyaltyService from '../services/loyalty.service';
import type { LoyaltyReward, RewardType, Redemption } from '../types';

// ======================
// CONSTANTS
// ======================
const REWARD_TYPE_OPTIONS: { value: RewardType; label: string }[] = [
  { value: 'discount_percentage', label: 'Descuento %' },
  { value: 'discount_fixed', label: 'Descuento Fijo' },
  { value: 'free_service', label: 'Servicio Gratis' },
  { value: 'gift', label: 'Regalo' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'custom', label: 'Personalizado' },
];

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
  const getRewardBadge = () => {
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

  return (
    <div className={cn(
      'bg-white rounded-xl border overflow-hidden transition-all',
      reward.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
    )}>
      {/* Header with badge */}
      <div className="bg-gradient-to-r from-tis-coral to-orange-500 p-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded">
            {getRewardBadge()}
          </span>
          <span className="text-sm font-semibold">
            {reward.tokens_required} {tokensName}
          </span>
        </div>
        <h3 className="font-bold text-lg mt-2">{reward.reward_name}</h3>
      </div>

      {/* Content */}
      <div className="p-4">
        {reward.reward_description && (
          <p className="text-sm text-gray-500 mb-3">{reward.reward_description}</p>
        )}

        {/* Stock indicator */}
        {reward.stock_limit && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Stock disponible</span>
              <span className="font-medium text-gray-700">
                {reward.stock_limit - reward.stock_used} / {reward.stock_limit}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  stockPercent > 50 ? 'bg-green-500' :
                  stockPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${stockPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          <span>Válido por {reward.valid_days} días</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => onToggle(reward)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              reward.is_active
                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            )}
            title={reward.is_active ? 'Desactivar' : 'Activar'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {reward.is_active ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </button>
          <button
            onClick={() => onEdit(reward)}
            className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(reward)}
            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {reward ? 'Editar Recompensa' : 'Nueva Recompensa'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
            <input
              type="text"
              value={formData.reward_name}
              onChange={(e) => setFormData({ ...formData, reward_name: e.target.value })}
              placeholder="Ej: Limpieza dental gratis"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              value={formData.reward_description}
              onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
              placeholder="Describe la recompensa..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <select
                value={formData.reward_type}
                onChange={(e) => setFormData({ ...formData, reward_type: e.target.value as RewardType })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              >
                {REWARD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Puntos Requeridos</label>
              <input
                type="number"
                value={formData.tokens_required}
                onChange={(e) => setFormData({ ...formData, tokens_required: Number(e.target.value) })}
                min={1}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
                required
              />
            </div>
          </div>
          {showDiscountField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor del Descuento {formData.reward_type === 'discount_percentage' ? '(%)' : '($)'}
              </label>
              <input
                type="number"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                min={0}
                max={formData.reward_type === 'discount_percentage' ? 100 : undefined}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock Límite</label>
              <input
                type="number"
                value={formData.stock_limit}
                onChange={(e) => setFormData({ ...formData, stock_limit: e.target.value })}
                placeholder="Sin límite"
                min={1}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Días de Validez</label>
              <input
                type="number"
                value={formData.valid_days}
                onChange={(e) => setFormData({ ...formData, valid_days: Number(e.target.value) })}
                min={1}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Términos y Condiciones</label>
            <textarea
              value={formData.terms_conditions}
              onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
              placeholder="Opcional..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Recompensa activa</label>
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
              {saving ? 'Guardando...' : reward ? 'Guardar Cambios' : 'Crear Recompensa'}
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
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'used'>('pending');

  useEffect(() => {
    loadRedemptions();
  }, [filter]);

  const loadRedemptions = async () => {
    setLoading(true);
    try {
      const data = await loyaltyService.getRedemptions({
        status: filter === 'all' ? undefined : filter as 'pending' | 'used',
        limit: 50,
      });
      setRedemptions(data.redemptions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkUsed = async (redemption: Redemption) => {
    await loyaltyService.markRedemptionUsed(redemption.id);
    loadRedemptions();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Canjes Recientes</h3>
        <div className="flex gap-2">
          {(['pending', 'used', 'all'] as const).map((f) => (
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
              {f === 'pending' ? 'Pendientes' : f === 'used' ? 'Usados' : 'Todos'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral mx-auto"></div>
        </div>
      ) : redemptions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No hay canjes {filter === 'pending' ? 'pendientes' : filter === 'used' ? 'usados' : ''}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {redemptions.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{r.leads?.name}</p>
                <p className="text-sm text-gray-500">{r.loyalty_rewards?.reward_name}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">{r.redemption_code}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    r.status === 'used' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    {r.status === 'pending' ? 'Pendiente' :
                     r.status === 'used' ? 'Usado' : 'Expirado'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {r.tokens_used} pts
                  </p>
                </div>
                {r.status === 'pending' && (
                  <button
                    onClick={() => handleMarkUsed(r)}
                    className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 transition-colors"
                  >
                    Marcar Usado
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
export function RewardsManagement() {
  const { rewards, loading, error, createReward, updateReward, deleteReward } = useRewards(true);
  const { program } = useLoyaltyProgram();
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LoyaltyReward | null>(null);
  const [activeSection, setActiveSection] = useState<'catalog' | 'redemptions'>('catalog');

  const tokensName = program?.tokens_name_plural || 'Puntos';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveSection('catalog')}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'catalog'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Catálogo de Recompensas
        </button>
        <button
          onClick={() => setActiveSection('redemptions')}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'redemptions'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Canjes
        </button>
      </div>

      {activeSection === 'catalog' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Catálogo de Recompensas</h2>
              <p className="text-sm text-gray-500">Recompensas que tus pacientes pueden canjear con {tokensName.toLowerCase()}</p>
            </div>
            <button
              onClick={() => { setEditingReward(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-tis-coral text-white rounded-lg hover:bg-tis-coral/90 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Recompensa
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
              {error}
            </div>
          )}

          {rewards.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Sin recompensas configuradas</h3>
              <p className="text-gray-500 text-sm mb-4">Crea tu primera recompensa canjeable</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-tis-coral font-medium hover:underline"
              >
                Crear primera recompensa
              </button>
            </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Recompensa</h3>
            <p className="text-gray-500 mb-6">
              ¿Estás seguro de eliminar "{deleteConfirm.reward_name}"? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteReward}
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
