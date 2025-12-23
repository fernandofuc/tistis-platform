'use client';

// =====================================================
// TIS TIS PLATFORM - Escalation & Goodbye Section
// Configuración de escalación y mensaje de despedida
// =====================================================

import { useState, useEffect } from 'react';

// ======================
// ICONS
// ======================

const PhoneForwardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94"/>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

// ======================
// TYPES
// ======================

interface EscalationSectionProps {
  escalationEnabled: boolean;
  escalationPhone: string;
  goodbyeMessage: string;
  onEscalationEnabledChange: (enabled: boolean) => void;
  onEscalationPhoneChange: (phone: string) => void;
  onGoodbyeMessageChange: (message: string) => void;
  onSave: () => void;
  saving?: boolean;
}

// ======================
// DEFAULT VALUES
// ======================

const DEFAULT_GOODBYE_MESSAGE = '¡Gracias por llamar! Que tenga un excelente día.';

const GOODBYE_EXAMPLES = [
  '¡Gracias por llamar! Que tenga un excelente día.',
  'Gracias por comunicarse con nosotros. ¡Hasta pronto!',
  'Fue un placer atenderle. ¡Que tenga un buen día!',
  'Gracias por su preferencia. ¡Lo esperamos pronto!',
];

// ======================
// COMPONENT
// ======================

export function EscalationSection({
  escalationEnabled,
  escalationPhone,
  goodbyeMessage,
  onEscalationEnabledChange,
  onEscalationPhoneChange,
  onGoodbyeMessageChange,
  onSave,
  saving = false,
}: EscalationSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localEscalationEnabled, setLocalEscalationEnabled] = useState(escalationEnabled);
  const [localEscalationPhone, setLocalEscalationPhone] = useState(escalationPhone);
  const [localGoodbyeMessage, setLocalGoodbyeMessage] = useState(goodbyeMessage || DEFAULT_GOODBYE_MESSAGE);

  // Sync with props
  useEffect(() => {
    setLocalEscalationEnabled(escalationEnabled);
    setLocalEscalationPhone(escalationPhone);
    setLocalGoodbyeMessage(goodbyeMessage || DEFAULT_GOODBYE_MESSAGE);
  }, [escalationEnabled, escalationPhone, goodbyeMessage]);

  const handleSave = () => {
    onEscalationEnabledChange(localEscalationEnabled);
    onEscalationPhoneChange(localEscalationPhone);
    onGoodbyeMessageChange(localGoodbyeMessage);
    onSave();
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalEscalationEnabled(escalationEnabled);
    setLocalEscalationPhone(escalationPhone);
    setLocalGoodbyeMessage(goodbyeMessage || DEFAULT_GOODBYE_MESSAGE);
    setIsEditing(false);
  };

  // Format phone for display
  const formatPhone = (phone: string) => {
    if (!phone) return 'No configurado';
    // Simple Mexican format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <PhoneForwardIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Escalación y Despedida</h3>
              <p className="text-sm text-slate-500">Transferencia a humano y mensaje final</p>
            </div>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <EditIcon className="w-4 h-4" />
              Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:shadow-lg hover:shadow-tis-coral/20 transition-all disabled:opacity-50"
              >
                <SaveIcon className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Escalation Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <PhoneForwardIcon className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Escalación a Humano</h4>
              <p className="text-xs text-slate-500">Transfiere la llamada cuando el cliente lo requiere</p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-medium text-slate-900">Habilitar escalación</p>
                  <p className="text-sm text-slate-500">Permitir transferir a un humano</p>
                </div>
                <button
                  onClick={() => setLocalEscalationEnabled(!localEscalationEnabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    localEscalationEnabled ? 'bg-tis-coral' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
                      localEscalationEnabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Phone Input */}
              {localEscalationEnabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de escalación
                  </label>
                  <input
                    type="tel"
                    value={localEscalationPhone}
                    onChange={(e) => setLocalEscalationPhone(e.target.value)}
                    placeholder="Ej: 5512345678"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Este número recibirá la llamada cuando el cliente pida hablar con una persona
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                escalationEnabled ? 'bg-tis-green/10' : 'bg-slate-100'
              }`}>
                <PhoneForwardIcon className={`w-5 h-5 ${
                  escalationEnabled ? 'text-tis-green' : 'text-slate-400'
                }`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">
                  {escalationEnabled ? 'Escalación habilitada' : 'Escalación deshabilitada'}
                </p>
                <p className="text-sm text-slate-500">
                  {escalationEnabled && escalationPhone
                    ? `Transfiere a ${formatPhone(escalationPhone)}`
                    : escalationEnabled
                    ? 'Sin número configurado'
                    : 'Las llamadas no se transferirán'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                escalationEnabled
                  ? 'bg-tis-green/10 text-tis-green'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {escalationEnabled ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          )}
        </div>

        {/* Goodbye Message Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <MessageSquareIcon className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Mensaje de Despedida</h4>
              <p className="text-xs text-slate-500">Lo último que dirá tu asistente al finalizar</p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={localGoodbyeMessage}
                onChange={(e) => setLocalGoodbyeMessage(e.target.value)}
                placeholder="Escribe el mensaje de despedida..."
                rows={2}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all resize-none"
              />

              {/* Quick examples */}
              <div className="flex flex-wrap gap-2">
                {GOODBYE_EXAMPLES.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLocalGoodbyeMessage(example)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      localGoodbyeMessage === example
                        ? 'bg-tis-coral/10 text-tis-coral border border-tis-coral/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {example.substring(0, 30)}...
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-100">
              <div className="absolute top-3 left-3 text-3xl text-purple-200 font-serif">&ldquo;</div>
              <p className="text-slate-700 leading-relaxed pl-6 pr-4 italic">
                {goodbyeMessage || DEFAULT_GOODBYE_MESSAGE}
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        {!isEditing && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-start gap-3">
              <InfoIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-800">
                  El asistente dirá el mensaje de despedida antes de finalizar cada llamada.
                  {escalationEnabled && ' Cuando escale, indicará que está transfiriendo la llamada.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EscalationSection;
