// =====================================================
// TIS TIS PLATFORM - Tokens Management Component
// Professional token rules management with Apple/TIS TIS style
// =====================================================

'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/shared/utils';
import { useTokenRules, useLoyaltyProgram } from '../hooks/useLoyalty';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import type { TokenRule, ActionType, PeriodType } from '../types';

// ======================
// CONSTANTS
// ======================
const ACTION_TYPE_CONFIG: Record<ActionType, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}> = {
  purchase: {
    label: 'Compra',
    description: 'Tokens por monto gastado',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  appointment: {
    label: 'Cita',
    description: 'Tokens por completar cita',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  referral: {
    label: 'Referido',
    description: 'Tokens por referir nuevos miembros',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  review: {
    label: 'Reseña',
    description: 'Tokens por dejar reseña',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  signup: {
    label: 'Registro',
    description: 'Tokens por registrarse',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  birthday: {
    label: 'Cumpleaños',
    description: 'Tokens de cumpleaños',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18z" />
      </svg>
    ),
  },
  custom: {
    label: 'Personalizado',
    description: 'Acción personalizada',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
};

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: 'día',
  week: 'semana',
  month: 'mes',
  year: 'año',
  lifetime: 'siempre',
};

// ======================
// STATS HEADER COMPONENT
// ======================
interface StatsHeaderProps {
  rules: TokenRule[];
  tokensName: string;
}

function StatsHeader({ rules, tokensName }: StatsHeaderProps) {
  const activeRules = rules.filter(r => r.is_active).length;
  const totalTokensPossible = rules.reduce((sum, r) => r.is_active ? sum + r.tokens_amount : sum, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeRules}</p>
            <p className="text-sm text-slate-500">Reglas Activas</p>
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
            <p className="text-2xl font-bold text-slate-900">{totalTokensPossible}</p>
            <p className="text-sm text-slate-500">{tokensName} por Evento</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{rules.length}</p>
            <p className="text-sm text-slate-500">Total de Reglas</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// RULE CARD COMPONENT
// ======================
interface RuleCardProps {
  rule: TokenRule;
  tokensName: string;
  getActionConfig: (actionType: ActionType) => typeof ACTION_TYPE_CONFIG[ActionType];
  onEdit: (rule: TokenRule) => void;
  onToggle: (rule: TokenRule) => void;
  onDelete: (rule: TokenRule) => void;
}

function RuleCard({ rule, tokensName, getActionConfig, onEdit, onToggle, onDelete }: RuleCardProps) {
  const config = getActionConfig(rule.action_type);

  return (
    <div className={cn(
      'bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-md group',
      rule.is_active
        ? 'border-gray-200 hover:border-gray-300'
        : 'border-gray-100 bg-gray-50/50'
    )}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
            rule.is_active ? config.bgColor : 'bg-gray-100',
            rule.is_active ? config.color : 'text-gray-400'
          )}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn(
                'font-semibold',
                rule.is_active ? 'text-gray-900' : 'text-gray-500'
              )}>
                {rule.action_name}
              </h3>
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                rule.is_active ? config.bgColor : 'bg-gray-100',
                rule.is_active ? config.color : 'text-gray-400'
              )}>
                {config.label}
              </span>
              {!rule.is_active && (
                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                  Inactivo
                </span>
              )}
            </div>

            {rule.action_description && (
              <p className={cn(
                'text-sm mt-1.5 line-clamp-2',
                rule.is_active ? 'text-gray-500' : 'text-gray-400'
              )}>
                {rule.action_description}
              </p>
            )}

            {/* Tokens badge */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm',
                rule.is_active
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-500'
              )}>
                <span>+{rule.tokens_amount}</span>
                <span className="opacity-80">{tokensName}</span>
              </div>

              {rule.tokens_multiplier !== 1 && (
                <span className={cn(
                  'text-xs font-medium px-2 py-1 rounded-full',
                  rule.is_active ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'
                )}>
                  x{rule.tokens_multiplier} multiplicador
                </span>
              )}

              {rule.max_per_period && (
                <span className={cn(
                  'text-xs',
                  rule.is_active ? 'text-gray-400' : 'text-gray-300'
                )}>
                  Máx {rule.max_per_period}/{PERIOD_LABELS[rule.period_type]}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggle(rule)}
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                rule.is_active
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              )}
              title={rule.is_active ? 'Desactivar' : 'Activar'}
            >
              {rule.is_active ? (
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
              onClick={() => onEdit(rule)}
              className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-all"
              title="Editar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(rule)}
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
    </div>
  );
}

// ======================
// RULE FORM MODAL
// ======================
interface RuleFormProps {
  rule?: TokenRule | null;
  patientsName: string;
  getActionConfig: (actionType: ActionType) => typeof ACTION_TYPE_CONFIG[ActionType];
  onSave: (data: Partial<TokenRule>) => Promise<void>;
  onClose: () => void;
}

function RuleForm({ rule, patientsName, getActionConfig, onSave, onClose }: RuleFormProps) {
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

  const selectedConfig = getActionConfig(formData.action_type as ActionType);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {rule ? 'Editar Regla' : 'Nueva Regla de Puntos'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {rule ? 'Modifica los parámetros de la regla' : `Define cómo tus ${patientsName} ganan puntos`}
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
            {/* Action Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Acción</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ACTION_TYPE_CONFIG) as ActionType[]).map((key) => {
                  const config = getActionConfig(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, action_type: key })}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                        formData.action_type === key
                          ? 'border-tis-coral bg-tis-coral/5'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.bgColor, config.color)}>
                        {config.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{config.label}</p>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de la Regla</label>
              <input
                type="text"
                value={formData.action_name}
                onChange={(e) => setFormData({ ...formData, action_name: e.target.value })}
                placeholder={`Ej: ${selectedConfig.label} completada`}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={formData.action_description}
                onChange={(e) => setFormData({ ...formData, action_description: e.target.value })}
                placeholder="Describe cuándo se otorgan los puntos..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors resize-none"
                rows={2}
              />
            </div>

            {/* Tokens Amount & Multiplier */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Puntos a Otorgar</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.tokens_amount}
                    onChange={(e) => setFormData({ ...formData, tokens_amount: Number(e.target.value) })}
                    min={1}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">pts</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Multiplicador</label>
                <input
                  type="number"
                  value={formData.tokens_multiplier}
                  onChange={(e) => setFormData({ ...formData, tokens_multiplier: Number(e.target.value) })}
                  min={0.1}
                  step={0.1}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Máximo por Período</label>
                <input
                  type="number"
                  value={formData.max_per_period || ''}
                  onChange={(e) => setFormData({ ...formData, max_per_period: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Sin límite"
                  min={1}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                <select
                  value={formData.period_type}
                  onChange={(e) => setFormData({ ...formData, period_type: e.target.value as PeriodType })}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-tis-coral transition-colors bg-white"
                >
                  <option value="day">Por Día</option>
                  <option value="week">Por Semana</option>
                  <option value="month">Por Mes</option>
                  <option value="year">Por Año</option>
                  <option value="lifetime">De por Vida</option>
                </select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900">Regla Activa</p>
                <p className="text-sm text-gray-500">Los {patientsName} podrán ganar puntos con esta regla</p>
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
              disabled={saving || !formData.action_name}
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
              ) : rule ? 'Guardar Cambios' : 'Crear Regla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ======================
// EMPTY STATE
// ======================
interface EmptyStateProps {
  tokensName: string;
  patientsName: string;
  onCreate: () => void;
}

function EmptyState({ tokensName, patientsName, onCreate }: EmptyStateProps) {
  return (
    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">Configura tus Reglas de {tokensName}</h3>
      <p className="text-slate-500 max-w-md mx-auto mb-6">
        Define cómo tus {patientsName} acumulan {tokensName.toLowerCase()}. Puedes otorgar puntos por visitas, compras, referidos y más.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Crear Primera Regla
      </button>
    </div>
  );
}

// ======================
// DELETE CONFIRMATION MODAL
// ======================
interface DeleteModalProps {
  rule: TokenRule;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteModal({ rule, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Eliminar Regla</h3>
        <p className="text-gray-500 text-center mb-6">
          ¿Estás seguro de eliminar <span className="font-semibold text-gray-900">&ldquo;{rule.action_name}&rdquo;</span>? Esta acción no se puede deshacer.
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
export function TokensManagement() {
  const { rules, loading, error, createRule, updateRule, deleteRule } = useTokenRules();
  const { program } = useLoyaltyProgram();
  const { terminology } = useVerticalTerminology();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<TokenRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TokenRule | null>(null);

  const tokensName = program?.tokens_name_plural || 'Puntos';
  const patientsLower = terminology.patients.toLowerCase();

  // Dynamic labels for action types (only appointment changes by vertical)
  const actionTypeLabels = useMemo(() => ({
    appointment: {
      label: terminology.appointment,
      description: `Tokens por completar ${terminology.appointment.toLowerCase()}`,
    },
  }), [terminology]);

  // Helper to get config with dynamic labels (memoized for stable reference)
  const getActionConfig = useCallback((actionType: ActionType) => {
    const baseConfig = ACTION_TYPE_CONFIG[actionType];
    const dynamicLabels = actionTypeLabels[actionType as keyof typeof actionTypeLabels];
    return dynamicLabels ? { ...baseConfig, ...dynamicLabels } : baseConfig;
  }, [actionTypeLabels]);

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
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tis-coral"></div>
          <p className="text-sm text-gray-500">Cargando reglas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reglas de {tokensName}</h2>
          <p className="text-gray-500 mt-1">Configura cómo los {patientsLower} ganan {tokensName.toLowerCase()}</p>
        </div>
        <button
          onClick={() => { setEditingRule(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Regla
        </button>
      </div>

      {/* Stats */}
      {rules.length > 0 && <StatsHeader rules={rules} tokensName={tokensName} />}

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
      {rules.length === 0 ? (
        <EmptyState tokensName={tokensName} patientsName={patientsLower} onCreate={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              tokensName={tokensName}
              getActionConfig={getActionConfig}
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
          patientsName={patientsLower}
          getActionConfig={getActionConfig}
          onSave={handleSaveRule}
          onClose={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteModal
          rule={deleteConfirm}
          onConfirm={handleDeleteRule}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
