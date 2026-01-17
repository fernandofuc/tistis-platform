// =====================================================
// TIS TIS PLATFORM - Advanced Tab (Agent Messages)
// Technical configuration + Escalation settings
// Design: Premium TIS TIS (Apple/Google aesthetics)
// Migrated: Escalation from Leads y Prioridades
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { AgentProfileWithChannels, AgentProfileInput } from '@/src/shared/types/agent-profiles';

// Shared imports from centralized modules
import { icons, DEFAULT_ESCALATION_KEYWORDS } from '../shared';

// ======================
// CONSTANTS
// ======================

const ESCALATION_SUGGESTIONS = [
  'queja', 'molesto', 'enojado', 'gerente', 'supervisor',
  'demanda', 'abogado', 'cancelar', 'reembolso', 'denuncia'
];

const MESSAGE_LIMIT_OPTIONS = [
  { value: 5, label: '5', desc: 'Rápido' },
  { value: 10, label: '10', desc: 'Recomendado' },
  { value: 15, label: '15', desc: 'Moderado' },
  { value: 20, label: '20', desc: 'Paciente' },
  { value: 0, label: '∞', desc: 'Desactivado' },
];

// ======================
// TYPES
// ======================
interface AdvancedTabProps {
  businessProfile: AgentProfileWithChannels | null;
  isLoading?: boolean;
  onSave: (data: Partial<AgentProfileInput>) => Promise<boolean>;
}

// ======================
// COMPONENT
// ======================
export function AdvancedTab({
  businessProfile,
  isLoading,
  onSave,
}: AdvancedTabProps) {
  // Settings state from profile
  const settings = businessProfile?.settings || {};

  // Form state - Response settings
  const [maxResponseLength, setMaxResponseLength] = useState(settings.max_response_length || 300);

  // Form state - Escalation settings (migrated from Leads y Prioridades)
  const [escalationKeywords, setEscalationKeywords] = useState<string[]>(
    settings.escalation_keywords || DEFAULT_ESCALATION_KEYWORDS
  );
  const [newKeyword, setNewKeyword] = useState('');
  const [maxTurnsBeforeEscalation, setMaxTurnsBeforeEscalation] = useState(
    settings.max_turns_before_escalation ?? 15
  );
  const [escalateOnHotLead, setEscalateOnHotLead] = useState(
    settings.escalate_on_hot_lead ?? true
  );

  // Form state - Out of hours
  const [outOfHoursEnabled, setOutOfHoursEnabled] = useState(settings.out_of_hours_enabled ?? true);
  const [outOfHoursMessage, setOutOfHoursMessage] = useState(
    settings.out_of_hours_message ||
    'Gracias por tu mensaje. Nuestro horario de atención es de Lunes a Viernes de 9am a 7pm. Te responderemos en cuanto estemos disponibles.'
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when businessProfile changes
  useEffect(() => {
    if (businessProfile?.settings) {
      const s = businessProfile.settings;
      setMaxResponseLength(s.max_response_length || 300);
      setEscalationKeywords(s.escalation_keywords || DEFAULT_ESCALATION_KEYWORDS);
      setMaxTurnsBeforeEscalation(s.max_turns_before_escalation ?? 15);
      setEscalateOnHotLead(s.escalate_on_hot_lead ?? true);
      setOutOfHoursEnabled(s.out_of_hours_enabled ?? true);
      setOutOfHoursMessage(s.out_of_hours_message ||
        'Gracias por tu mensaje. Nuestro horario de atención es de Lunes a Viernes de 9am a 7pm. Te responderemos en cuanto estemos disponibles.');
      setHasChanges(false);
    }
  }, [businessProfile]);

  // Mark changes
  const markChange = useCallback(() => {
    setHasChanges(true);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  // Add keyword
  const addKeyword = useCallback(() => {
    if (newKeyword.trim() && !escalationKeywords.includes(newKeyword.trim().toLowerCase())) {
      setEscalationKeywords([...escalationKeywords, newKeyword.trim().toLowerCase()]);
      setNewKeyword('');
      markChange();
    }
  }, [newKeyword, escalationKeywords, markChange]);

  // Remove keyword
  const removeKeyword = useCallback((keyword: string) => {
    setEscalationKeywords(escalationKeywords.filter(k => k !== keyword));
    markChange();
  }, [escalationKeywords, markChange]);

  // Add suggested keyword
  const addSuggestion = useCallback((suggestion: string) => {
    if (!escalationKeywords.includes(suggestion)) {
      setEscalationKeywords([...escalationKeywords, suggestion]);
      markChange();
    }
  }, [escalationKeywords, markChange]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const data: Partial<AgentProfileInput> = {
      settings: {
        max_response_length: maxResponseLength,
        escalation_keywords: escalationKeywords,
        max_turns_before_escalation: maxTurnsBeforeEscalation,
        escalate_on_hot_lead: escalateOnHotLead,
        out_of_hours_enabled: outOfHoursEnabled,
        out_of_hours_message: outOfHoursMessage,
      },
    };

    try {
      const success = await onSave(data);
      if (success) {
        setSaveSuccess(true);
        setHasChanges(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError('No se pudo guardar. Intenta de nuevo.');
      }
    } catch {
      setSaveError('Error al guardar. Verifica tu conexión.');
    } finally {
      setIsSaving(false);
    }
  }, [maxResponseLength, escalationKeywords, maxTurnsBeforeEscalation, escalateOnHotLead, outOfHoursEnabled, outOfHoursMessage, onSave]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-slate-100 rounded-2xl" />
        <div className="h-40 bg-slate-100 rounded-2xl" />
        <div className="h-32 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            {icons.settings}
          </div>
          <div>
            <h2 className="text-xl font-bold">Configuración Avanzada</h2>
            <p className="text-white/70 text-sm">Escalamiento automático y opciones técnicas</p>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-amber-500 flex-shrink-0 mt-0.5">{icons.alert}</span>
        <div>
          <p className="text-sm text-amber-800">
            Estas opciones son para usuarios avanzados. Los valores predeterminados funcionan bien para la mayoría de los negocios.
          </p>
        </div>
      </div>

      {/* ============================== */}
      {/* ESCALATION SECTION (MIGRATED) */}
      {/* ============================== */}

      {/* Escalation Header */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Escalamiento Automático</h3>
        <p className="text-sm text-slate-500 mb-4">
          Configura cuándo el AI debe transferir la conversación a tu equipo
        </p>
      </div>

      {/* Escalation Triggers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lead HOT */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-red-900">Servicio HOT Detectado</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-800">
                Auto
              </span>
            </div>
          </div>
          <p className="text-sm text-red-700">
            Cuando el lead pregunta por implantes, ortodoncia u otro servicio HOT.
          </p>
        </div>

        {/* Human Request */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-blue-900">Solicitud de Humano</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
                Auto
              </span>
            </div>
          </div>
          <p className="text-sm text-blue-700">
            Cuando el cliente pide hablar con una persona o asesor.
          </p>
        </div>

        {/* Emergency / Pain */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-purple-900">Emergencia / Dolor</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-200 text-purple-800">
                Prioridad
              </span>
            </div>
          </div>
          <p className="text-sm text-purple-700">
            Detecta &quot;emergencia&quot;, &quot;dolor fuerte&quot;, &quot;urgente&quot;.
          </p>
        </div>

        {/* Message Limit */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-900">Límite de Mensajes</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-300 text-slate-700">
                Configurable
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Conversaciones largas sin conversión se escalan automáticamente.
          </p>
        </div>
      </div>

      {/* Message Limit Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-slate-900">Escalar por Conversación Larga</p>
            <p className="text-sm text-slate-500">
              Número de mensajes antes de escalar automáticamente
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {MESSAGE_LIMIT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => { setMaxTurnsBeforeEscalation(option.value); markChange(); }}
              className={cn(
                'p-3 rounded-xl border-2 text-center transition-all',
                maxTurnsBeforeEscalation === option.value
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <p className="font-bold text-slate-900">{option.label}</p>
              <p className="text-xs text-slate-500">{option.desc}</p>
            </button>
          ))}
        </div>
        {maxTurnsBeforeEscalation > 0 && (
          <p className="text-sm text-slate-500 mt-3">
            Después de <strong>{maxTurnsBeforeEscalation} mensajes</strong> sin conversión,
            la conversación se transferirá a tu equipo.
          </p>
        )}
        {maxTurnsBeforeEscalation === 0 && (
          <p className="text-sm text-amber-600 mt-3">
            El escalamiento por límite de mensajes está desactivado. Los otros triggers siguen activos.
          </p>
        )}
      </div>

      {/* Escalation Keywords */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="mb-4">
          <p className="font-medium text-slate-900">Palabras Clave de Escalamiento</p>
          <p className="text-sm text-slate-500">
            El AI escalará inmediatamente si detecta estas palabras
          </p>
        </div>

        {/* Current keywords */}
        <div className="flex flex-wrap gap-2 mb-4">
          {escalationKeywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm"
            >
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-amber-200 transition-colors"
              >
                {icons.x}
              </button>
            </span>
          ))}
          {escalationKeywords.length === 0 && (
            <span className="text-slate-400 text-sm">No hay palabras clave configuradas</span>
          )}
        </div>

        {/* Add new keyword */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Agregar palabra clave..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={addKeyword}
            disabled={!newKeyword.trim()}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              newKeyword.trim()
                ? 'bg-slate-800 text-white hover:bg-slate-900'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            Agregar
          </button>
        </div>

        {/* Suggestions */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">Sugerencias comunes:</p>
          <div className="flex flex-wrap gap-2">
            {ESCALATION_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => addSuggestion(suggestion)}
                disabled={escalationKeywords.includes(suggestion)}
                className={cn(
                  'px-2 py-1 text-xs rounded-lg border transition-colors',
                  escalationKeywords.includes(suggestion)
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-purple-300 hover:bg-purple-50'
                )}
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============================== */}
      {/* OTHER ADVANCED SETTINGS */}
      {/* ============================== */}

      {/* Max Response Length */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-slate-600">{icons.text}</span>
          <label className="text-sm font-medium text-slate-700">
            Longitud máxima de respuesta
          </label>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="100"
            max="500"
            step="50"
            value={maxResponseLength}
            onChange={(e) => { setMaxResponseLength(Number(e.target.value)); markChange(); }}
            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
          />
          <span className="w-20 text-center font-mono text-sm bg-slate-100 px-3 py-2 rounded-lg">
            {maxResponseLength}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
          <span className="text-slate-400 mt-0.5">{icons.info}</span>
          <span>
            Número aproximado de caracteres. Respuestas más cortas son más efectivas en mensajería.
          </span>
        </p>
      </div>

      {/* Out of Hours Message */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">{icons.moon}</span>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Mensaje fuera de horario
              </label>
              <p className="text-xs text-slate-500">
                Se envía cuando el negocio está cerrado
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={outOfHoursEnabled}
              onChange={(e) => { setOutOfHoursEnabled(e.target.checked); markChange(); }}
              className="sr-only peer"
            />
            <div className={cn(
              'w-11 h-6 rounded-full transition-colors',
              outOfHoursEnabled ? 'bg-slate-700' : 'bg-slate-200'
            )} />
            <div className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
              outOfHoursEnabled && 'translate-x-5'
            )} />
          </label>
        </div>

        {outOfHoursEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <textarea
              value={outOfHoursMessage}
              onChange={(e) => { setOutOfHoursMessage(e.target.value); markChange(); }}
              placeholder="Mensaje que se enviará fuera de horario..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none text-sm"
            />
            <p className="mt-2 text-xs text-slate-500">
              Este mensaje se envía automáticamente cuando alguien escribe fuera del horario configurado en tu perfil.
            </p>
          </motion.div>
        )}
      </div>

      {/* API/Webhook Info (Read-only info card) */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-slate-600">{icons.link}</span>
          <label className="text-sm font-medium text-slate-700">
            Integraciones
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1">Webhook URL</p>
            <p className="text-sm text-slate-700 font-mono truncate">
              {`https://api.tistis.ai/v1/webhook/${businessProfile?.tenant_id || 'TENANT_ID'}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1">Profile ID</p>
            <p className="text-sm text-slate-700 font-mono truncate">
              {businessProfile?.id || 'Sin perfil'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Usa estos datos para integraciones avanzadas. Contacta soporte para más información.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-emerald-600 font-medium flex items-center gap-1.5"
            >
              {icons.check}
              Cambios guardados
            </motion.span>
          )}
          {saveError && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-red-600"
            >
              {saveError}
            </motion.span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={cn(
            'px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all',
            hasChanges
              ? 'bg-slate-800 text-white shadow-lg hover:bg-slate-900'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          )}
        >
          {isSaving ? (
            <>
              {icons.spinner}
              <span>Guardando...</span>
            </>
          ) : (
            <>
              {icons.save}
              <span>Guardar cambios</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default AdvancedTab;
