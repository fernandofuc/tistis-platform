/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Step 5: Activate & Provision Phone Number
 *
 * Final step to activate the voice agent and provision a phone number.
 * Shows configuration summary and phone number selection.
 */

'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PhoneIcon,
  CheckIcon,
  CheckCircleIcon,
  SparklesIcon,
  VolumeIcon,
  UserIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import { MEXICO_AREA_CODES, AVAILABLE_VOICES, type AreaCode } from '@/src/features/voice-agent/types';
import { getAssistantTypeById } from '@/lib/voice-agent/types/assistant-types';
import type { StepComponentProps } from '../types';

// =====================================================
// CONFIG SUMMARY COMPONENT
// =====================================================

interface ConfigSummaryProps {
  config: StepComponentProps['config'];
  vertical: 'restaurant' | 'dental';
}

function ConfigSummary({ config, vertical }: ConfigSummaryProps) {
  const assistantType = config.assistantType
    ? getAssistantTypeById(config.assistantType)
    : null;

  const selectedVoice = AVAILABLE_VOICES.find((v) => v.id === config.voiceId);

  const summaryItems = [
    {
      icon: <SparklesIcon className="w-5 h-5" />,
      label: 'Tipo de asistente',
      value: assistantType?.displayName || 'No seleccionado',
      color: 'from-tis-coral to-tis-pink',
    },
    {
      icon: <VolumeIcon className="w-5 h-5" />,
      label: 'Voz',
      value: selectedVoice?.name || 'No seleccionada',
      color: 'from-tis-purple to-indigo-600',
    },
    {
      icon: <UserIcon className="w-5 h-5" />,
      label: 'Nombre',
      value: config.assistantName || 'Sin nombre',
      color: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Resumen de configuración</h3>

      <div className="space-y-3">
        {summaryItems.map((item, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-sm`}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-sm font-medium text-slate-900 truncate">{item.value}</p>
            </div>
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
          </div>
        ))}
      </div>

      {/* First message preview */}
      {config.firstMessage && (
        <div className="mt-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 mb-1">Mensaje de bienvenida</p>
          <p className="text-sm text-slate-700 italic line-clamp-2">
            &ldquo;{config.firstMessage}&rdquo;
          </p>
        </div>
      )}

      {/* Test status */}
      <div className="mt-4 flex items-center gap-2">
        {config.hasBeenTested ? (
          <>
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-600 font-medium">Prueba completada</span>
          </>
        ) : (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-amber-400" />
            <span className="text-xs text-amber-600 font-medium">Sin probar (opcional)</span>
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================
// AREA CODE SELECTOR
// =====================================================

interface AreaCodeSelectorProps {
  selectedCode: string | null;
  onSelect: (code: string) => void;
  isLoading: boolean;
}

function AreaCodeSelector({ selectedCode, onSelect, isLoading }: AreaCodeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCodes = useMemo(() => {
    if (!searchQuery.trim()) return MEXICO_AREA_CODES;

    const query = searchQuery.toLowerCase();
    return MEXICO_AREA_CODES.filter(
      (ac) =>
        ac.code.includes(query) ||
        ac.city.toLowerCase().includes(query) ||
        ac.state.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Popular codes
  const popularCodes = ['55', '33', '81'];
  const popularAreaCodes = MEXICO_AREA_CODES.filter((ac) => popularCodes.includes(ac.code));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Selecciona la lada de tu número</h3>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por ciudad, estado o lada..."
          className="w-full px-4 py-2.5 pl-10 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Popular codes */}
      {!searchQuery && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Ciudades principales</p>
          <div className="grid grid-cols-3 gap-2">
            {popularAreaCodes.map((ac) => (
              <motion.button
                key={ac.code}
                type="button"
                onClick={() => onSelect(ac.code)}
                disabled={isLoading}
                className={`
                  p-3 rounded-xl border-2 text-left transition-all
                  ${selectedCode === ac.code
                    ? 'border-tis-green bg-tis-green-50 ring-2 ring-tis-green/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                whileTap={!isLoading ? { scale: 0.98 } : undefined}
              >
                <p className="text-lg font-bold text-slate-900">+52 {ac.code}</p>
                <p className="text-xs font-medium text-slate-600 truncate">{ac.city}</p>
                {selectedCode === ac.code && (
                  <CheckIcon className="w-4 h-4 text-tis-green mt-1" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* All codes (or filtered) */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">
          {searchQuery ? `Resultados para "${searchQuery}"` : 'Todas las ciudades'}
        </p>
        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          {filteredCodes.map((ac) => (
            <motion.button
              key={ac.code}
              type="button"
              onClick={() => onSelect(ac.code)}
              disabled={isLoading}
              className={`
                w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left
                ${selectedCode === ac.code
                  ? 'border-tis-green bg-tis-green-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              whileTap={!isLoading ? { scale: 0.99 } : undefined}
            >
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-slate-900">+52 {ac.code}</span>
                <span className="text-sm text-slate-600">
                  {ac.city}, {ac.state}
                </span>
              </div>
              {selectedCode === ac.code && <CheckIcon className="w-4 h-4 text-tis-green" />}
            </motion.button>
          ))}

          {filteredCodes.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No se encontraron resultados</div>
          )}
        </div>
      </div>

      {/* Cost info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-xs text-blue-700">
          <strong>Costo estimado:</strong> ~$3 USD/mes + ~$0.02 USD/minuto de llamada
        </p>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function StepActivate({
  config,
  vertical,
  onUpdateConfig,
  isLoading,
}: StepComponentProps) {
  const handleAreaCodeSelect = (code: string) => {
    onUpdateConfig({ areaCode: code });
  };

  const isConfigComplete = useMemo(() => {
    return (
      config.assistantType &&
      config.voiceId &&
      config.assistantName.trim().length >= 2 &&
      config.firstMessage.trim().length >= 20
    );
  }, [config]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-tis-green to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-tis-green/30"
        >
          <PhoneIcon className="w-8 h-8 text-white" />
        </motion.div>

        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-2xl font-bold text-slate-900 mb-2"
        >
          Activa tu asistente
        </motion.h2>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-slate-500"
        >
          Revisa tu configuración y elige un número de teléfono
        </motion.p>
      </div>

      {/* Main content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        {/* Config summary */}
        <ConfigSummary config={config} vertical={vertical} />

        {/* Area code selector */}
        <AreaCodeSelector
          selectedCode={config.areaCode}
          onSelect={handleAreaCodeSelect}
          isLoading={isLoading}
        />
      </motion.div>

      {/* Warning if config incomplete */}
      {!isConfigComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <p className="text-sm text-amber-700">
            <strong>Atención:</strong> Por favor completa todos los pasos anteriores antes de
            activar tu asistente.
          </p>
        </motion.div>
      )}

      {/* Ready to activate message */}
      {isConfigComplete && config.areaCode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 border border-green-200 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm text-green-700 font-medium">
                ¡Todo listo para activar!
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Se te asignará un número con lada {config.areaCode}. El proceso puede tomar unos
                segundos.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Terms notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="text-center"
      >
        <p className="text-xs text-slate-400">
          Al activar, aceptas los{' '}
          <a href="/terms" className="text-tis-coral hover:underline">
            Términos de Servicio
          </a>{' '}
          y la{' '}
          <a href="/privacy" className="text-tis-coral hover:underline">
            Política de Privacidad
          </a>{' '}
          de TIS TIS.
        </p>
      </motion.div>
    </div>
  );
}

export default StepActivate;
