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

// Shared imports from centralized modules
import { icons, DEFAULT_ESCALATION_KEYWORDS } from '../shared';

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
                {icons.x}
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
