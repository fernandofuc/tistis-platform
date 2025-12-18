// =====================================================
// TIS TIS PLATFORM - Tokens Management Component
// Manage token rules and view transactions
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import { useTokenRules, useLoyaltyProgram } from '../hooks/useLoyalty';
import * as loyaltyService from '../services/loyalty.service';
import type { TokenRule, ActionType } from '../types';

// ======================
// CONSTANTS
// ======================
const ACTION_TYPE_OPTIONS: { value: ActionType; label: string; description: string }[] = [
  { value: 'purchase', label: 'Compra', description: 'Tokens por monto gastado' },
  { value: 'appointment', label: 'Cita', description: 'Tokens por completar cita' },
  { value: 'referral', label: 'Referido', description: 'Tokens por referir pacientes' },
  { value: 'review', label: 'Reseña', description: 'Tokens por dejar reseña' },
  { value: 'signup', label: 'Registro', description: 'Tokens por registrarse' },
  { value: 'birthday', label: 'Cumpleaños', description: 'Tokens de cumpleaños' },
  { value: 'custom', label: 'Personalizado', description: 'Acción personalizada' },
];

const ACTION_TYPE_ICONS: Record<ActionType, React.ReactNode> = {
  purchase: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  appointment: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  referral: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  review: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  signup: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  birthday: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18z" />
    </svg>
  ),
  custom: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
};

// ======================
// RULE CARD COMPONENT
// ======================
interface RuleCardProps {
  rule: TokenRule;
  tokensName: string;
  onEdit: (rule: TokenRule) => void;
  onToggle: (rule: TokenRule) => void;
  onDelete: (rule: TokenRule) => void;
}

function RuleCard({ rule, tokensName, onEdit, onToggle, onDelete }: RuleCardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl border p-5 transition-all',
      rule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          rule.is_active ? 'bg-tis-coral/10 text-tis-coral' : 'bg-gray-100 text-gray-400'
        )}>
          {ACTION_TYPE_ICONS[rule.action_type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{rule.action_name}</h3>
            {!rule.is_active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
            )}
          </div>
          {rule.action_description && (
            <p className="text-sm text-gray-500 mt-1">{rule.action_description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <span className="text-sm font-medium text-tis-coral">
              +{rule.tokens_amount} {tokensName}
            </span>
            {rule.tokens_multiplier !== 1 && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                x{rule.tokens_multiplier} multiplicador
              </span>
            )}
            {rule.max_per_period && (
              <span className="text-xs text-gray-400">
                Máx {rule.max_per_period}/{rule.period_type}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(rule)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              rule.is_active
                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            )}
            title={rule.is_active ? 'Desactivar' : 'Activar'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {rule.is_active ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </button>
          <button
            onClick={() => onEdit(rule)}
            className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(rule)}
            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
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
// RULE FORM MODAL
// ======================
interface RuleFormProps {
  rule?: TokenRule | null;
  onSave: (data: Partial<TokenRule>) => Promise<void>;
  onClose: () => void;
}

function RuleForm({ rule, onSave, onClose }: RuleFormProps) {
  const [formData, setFormData] = useState({
    action_type: rule?.action_type || 'appointment',
    action_name: rule?.action_name || '',
    action_description: rule?.action_description || '',
    tokens_amount: rule?.tokens_amount || 10,
    tokens_multiplier: rule?.tokens_multiplier || 1,
    max_per_period: rule?.max_per_period || null,
    period_type: rule?.period_type || 'month',
    is_active: rule?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {rule ? 'Editar Regla' : 'Nueva Regla de Tokens'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Acción</label>
            <select
              value={formData.action_type}
              onChange={(e) => setFormData({ ...formData, action_type: e.target.value as ActionType })}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            >
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label} - {opt.description}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de la Regla</label>
            <input
              type="text"
              value={formData.action_name}
              onChange={(e) => setFormData({ ...formData, action_name: e.target.value })}
              placeholder="Ej: Cita completada"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción (opcional)</label>
            <textarea
              value={formData.action_description}
              onChange={(e) => setFormData({ ...formData, action_description: e.target.value })}
              placeholder="Describe cuándo se otorgan los tokens..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tokens a Otorgar</label>
              <input
                type="number"
                value={formData.tokens_amount}
                onChange={(e) => setFormData({ ...formData, tokens_amount: Number(e.target.value) })}
                min={1}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Multiplicador</label>
              <input
                type="number"
                value={formData.tokens_multiplier}
                onChange={(e) => setFormData({ ...formData, tokens_multiplier: Number(e.target.value) })}
                min={0.1}
                step={0.1}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Máximo por Período</label>
              <input
                type="number"
                value={formData.max_per_period || ''}
                onChange={(e) => setFormData({ ...formData, max_per_period: e.target.value ? Number(e.target.value) : null })}
                placeholder="Sin límite"
                min={1}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
              <select
                value={formData.period_type}
                onChange={(e) => setFormData({ ...formData, period_type: e.target.value as 'day' | 'week' | 'month' | 'year' | 'lifetime' })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="year">Año</option>
                <option value="lifetime">De por vida</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Regla activa</label>
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
              {saving ? 'Guardando...' : rule ? 'Guardar Cambios' : 'Crear Regla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function TokensManagement() {
  const { rules, loading, error, createRule, updateRule, deleteRule } = useTokenRules();
  const { program } = useLoyaltyProgram();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<TokenRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TokenRule | null>(null);

  const tokensName = program?.tokens_name_plural || 'Puntos';

  const handleSaveRule = async (data: Partial<TokenRule>) => {
    if (editingRule) {
      await updateRule(editingRule.id, data);
    } else {
      await createRule(data);
    }
    setShowForm(false);
    setEditingRule(null);
  };

  const handleToggleRule = async (rule: TokenRule) => {
    await updateRule(rule.id, { is_active: !rule.is_active });
  };

  const handleDeleteRule = async () => {
    if (deleteConfirm) {
      await deleteRule(deleteConfirm.id);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reglas de {tokensName}</h2>
          <p className="text-sm text-gray-500">Configura cómo los pacientes ganan {tokensName.toLowerCase()}</p>
        </div>
        <button
          onClick={() => { setEditingRule(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-tis-coral text-white rounded-lg hover:bg-tis-coral/90 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Regla
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Sin reglas configuradas</h3>
          <p className="text-gray-500 text-sm mb-4">Crea tu primera regla para empezar a otorgar {tokensName.toLowerCase()}</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-tis-coral font-medium hover:underline"
          >
            Crear primera regla
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              tokensName={tokensName}
              onEdit={(r) => { setEditingRule(r); setShowForm(true); }}
              onToggle={handleToggleRule}
              onDelete={(r) => setDeleteConfirm(r)}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <RuleForm
          rule={editingRule}
          onSave={handleSaveRule}
          onClose={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Regla</h3>
            <p className="text-gray-500 mb-6">
              ¿Estás seguro de eliminar "{deleteConfirm.action_name}"? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteRule}
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
