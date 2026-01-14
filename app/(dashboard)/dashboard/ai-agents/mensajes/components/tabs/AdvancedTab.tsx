// =====================================================
// TIS TIS PLATFORM - Advanced Tab (Agent Messages)
// Technical configuration options for power users
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { AgentProfileWithChannels, AgentProfileInput } from '@/src/shared/types/agent-profiles';

// ======================
// ICONS
// ======================
const icons = {
  save: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  settings: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  moon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  text: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  link: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// DEFAULT ESCALATION KEYWORDS
// ======================
const DEFAULT_ESCALATION_KEYWORDS = [
  'queja',
  'molesto',
  'enojado',
  'gerente',
  'supervisor',
  'urgente',
  'emergencia',
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

  // Form state
  const [maxResponseLength, setMaxResponseLength] = useState(settings.max_response_length || 300);
  const [escalationKeywords, setEscalationKeywords] = useState<string[]>(
    settings.escalation_keywords || DEFAULT_ESCALATION_KEYWORDS
  );
  const [newKeyword, setNewKeyword] = useState('');
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
      const settings = businessProfile.settings;
      setMaxResponseLength(settings.max_response_length || 300);
      setEscalationKeywords(settings.escalation_keywords || DEFAULT_ESCALATION_KEYWORDS);
      setOutOfHoursEnabled(settings.out_of_hours_enabled ?? true);
      setOutOfHoursMessage(settings.out_of_hours_message ||
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

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const data: Partial<AgentProfileInput> = {
      settings: {
        max_response_length: maxResponseLength,
        escalation_keywords: escalationKeywords,
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
    } catch (err) {
      setSaveError('Error al guardar. Verifica tu conexión.');
    } finally {
      setIsSaving(false);
    }
  }, [maxResponseLength, escalationKeywords, outOfHoursEnabled, outOfHoursMessage, onSave]);

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
            <p className="text-white/70 text-sm">Opciones técnicas para usuarios expertos</p>
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

      {/* Escalation Keywords */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-slate-600">{icons.alert}</span>
          <label className="text-sm font-medium text-slate-700">
            Palabras clave de escalamiento
          </label>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Cuando el cliente use estas palabras, el agente notificará para atención humana
        </p>

        {/* Current keywords */}
        <div className="flex flex-wrap gap-2 mb-4">
          {escalationKeywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-sm"
            >
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-200 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>

        {/* Add new keyword */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Agregar palabra clave..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
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
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700"></div>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
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
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
