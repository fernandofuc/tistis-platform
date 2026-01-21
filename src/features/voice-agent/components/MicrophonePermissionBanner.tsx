'use client';

// =====================================================
// TIS TIS PLATFORM - Microphone Permission Banner
// Banner para solicitar/mostrar estado de permisos de mic
// FASE 4: UI Improvements
// =====================================================

import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import type { MicrophonePermissionState } from '../hooks/useMicrophonePermission';

// ======================
// TYPES
// ======================

interface MicrophonePermissionBannerProps {
  /** Estado actual del permiso */
  status: MicrophonePermissionState;
  /** Callback para solicitar permiso */
  onRequestPermission: () => void;
  /** Si se está verificando el permiso */
  isChecking?: boolean;
}

// ======================
// COMPONENT
// ======================

export function MicrophonePermissionBanner({
  status,
  onRequestPermission,
  isChecking = false,
}: MicrophonePermissionBannerProps) {
  // No mostrar si ya está concedido o está verificando
  if (status === 'granted' || status === 'checking' || isChecking) {
    return null;
  }

  const isDenied = status === 'denied';

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        aria-live="polite"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`p-4 rounded-xl mb-4 ${
          isDenied
            ? 'bg-red-50 border border-red-200'
            : 'bg-amber-50 border border-amber-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isDenied ? 'bg-red-100' : 'bg-amber-100'
            }`}
          >
            {isDenied ? (
              <MicOff className="w-4 h-4 text-red-600" aria-hidden="true" />
            ) : (
              <Mic className="w-4 h-4 text-amber-600" aria-hidden="true" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className={`font-medium text-sm ${
                isDenied ? 'text-red-800' : 'text-amber-800'
              }`}
            >
              {isDenied
                ? 'Acceso al micrófono denegado'
                : 'Se requiere acceso al micrófono'}
            </p>

            <p
              className={`text-sm mt-1 ${
                isDenied ? 'text-red-700' : 'text-amber-700'
              }`}
            >
              {isDenied
                ? 'Para usar el modo de llamada, habilita el micrófono en la configuración de tu navegador.'
                : 'Para usar el modo de llamada, necesitamos acceso a tu micrófono.'}
            </p>

            {/* Mostrar botón solo si es 'prompt' */}
            {status === 'prompt' && (
              <button
                onClick={onRequestPermission}
                className="mt-3 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors inline-flex items-center gap-2"
              >
                <Mic className="w-4 h-4" aria-hidden="true" />
                Permitir Micrófono
              </button>
            )}

            {/* Instrucciones si está denegado */}
            {isDenied && (
              <div className="mt-3 p-3 bg-red-100/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs text-red-700">
                    <p className="font-medium mb-1">Cómo habilitar el micrófono:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Haz clic en el ícono de candado en la barra de direcciones</li>
                      <li>Busca &quot;Micrófono&quot; en los permisos</li>
                      <li>Cambia a &quot;Permitir&quot;</li>
                      <li>Recarga la página</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default MicrophonePermissionBanner;
