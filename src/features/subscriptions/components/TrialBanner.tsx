// =====================================================
// TIS TIS PLATFORM - Trial Banner Component
// Muestra el estado del trial activo con días restantes
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, Sparkles } from 'lucide-react';
import {
  getActiveTrialForClient,
  calculateDaysRemaining,
  type TrialSubscription,
} from '../services/trial.service';

interface TrialBannerProps {
  clientId: string;
  onCancelTrial?: () => void;
  onReactivateTrial?: () => void;
}

export function TrialBanner({ clientId, onCancelTrial, onReactivateTrial }: TrialBannerProps) {
  const [trial, setTrial] = useState<TrialSubscription | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadTrial();
  }, [clientId]);

  async function loadTrial() {
    try {
      const activeTrial = await getActiveTrialForClient(clientId);
      if (activeTrial && activeTrial.trial_end) {
        setTrial(activeTrial);
        setDaysRemaining(calculateDaysRemaining(activeTrial.trial_end));
      }
    } catch (error) {
      console.error('[TrialBanner] Error loading trial:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !trial || dismissed) {
    return null;
  }

  const isEndingSoon = daysRemaining <= 3;
  const willConvert = trial.will_convert_to_paid;

  return (
    <div
      className={`
        relative rounded-xl p-4 mb-6 border shadow-sm
        ${
          isEndingSoon
            ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
        }
      `}
    >
      {/* Botón cerrar */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4 pr-8">
        {/* Icono */}
        <div
          className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          ${
            isEndingSoon
              ? 'bg-orange-100 text-orange-600'
              : 'bg-green-100 text-green-600'
          }
        `}
        >
          {isEndingSoon ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">
            {isEndingSoon
              ? '¡Tu prueba gratuita está por terminar!'
              : '🎉 ¡Estás en prueba gratuita!'}
          </h3>

          <p className="text-sm text-gray-600 mb-3">
            {daysRemaining === 0 ? (
              <>Tu prueba gratuita termina <strong>hoy</strong>.</>
            ) : daysRemaining === 1 ? (
              <>Te queda <strong>1 día</strong> de prueba gratuita.</>
            ) : (
              <>
                Te quedan <strong>{daysRemaining} días</strong> de prueba
                gratuita.
              </>
            )}
            {willConvert ? (
              <> Al terminar, se cobrará automáticamente la suscripción mensual de <strong>$3,490 MXN</strong>.</>
            ) : (
              <> Tu acceso finalizará cuando termine el período de prueba.</>
            )}
          </p>

          {/* Acciones */}
          {willConvert && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onCancelTrial}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 underline transition-colors"
              >
                Cancelar suscripción
              </button>
              <span className="text-xs text-gray-500">
                (Podrás seguir usando TIS TIS hasta el final del trial, pero no se te cobrará)
              </span>
            </div>
          )}

          {!willConvert && daysRemaining > 0 && (
            <p className="text-sm text-gray-600">
              ¿Cambiaste de opinión?{' '}
              <button
                onClick={onReactivateTrial}
                className="font-medium text-green-600 hover:text-green-700 underline transition-colors"
              >
                Reactivar suscripción automática
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mt-4">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`
              h-full transition-all duration-500
              ${
                isEndingSoon
                  ? 'bg-gradient-to-r from-orange-400 to-red-500'
                  : 'bg-gradient-to-r from-green-400 to-emerald-500'
              }
            `}
            style={{
              width: `${((10 - daysRemaining) / 10) * 100}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">Día 1</span>
          <span className="text-xs text-gray-500">Día 10</span>
        </div>
      </div>
    </div>
  );
}
