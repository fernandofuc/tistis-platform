'use client';

// =====================================================
// TIS TIS PLATFORM - Guided Instructions Section
// Sistema guiado para crear instrucciones perfectas
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ======================
// ICONS
// ======================

const LightbulbIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6"/>
    <path d="M10 22h4"/>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
  </svg>
);

const MessageIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const TagIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3L14.5 8.5L20 9L16 13.5L17 19L12 16L7 19L8 13.5L4 9L9.5 8.5L12 3Z"/>
  </svg>
);

// ======================
// TYPES
// ======================

interface GuidedInstructions {
  // Estilo de comunicación
  fillerPhrases: string[];
  communicationTone: 'professional' | 'friendly' | 'empathetic';
  avoidSilences: boolean;

  // Manejo de citas
  appointmentFlow: string;
  availabilityCheck: string;
  confirmationMessage: string;

  // Situaciones especiales
  emergencyInstructions: string;
  complaintHandling: string;
  unknownQuestions: string;

  // Información adicional
  promotions: string[];
  paymentInfo: string;
  additionalNotes: string;
}

interface GuidedInstructionsSectionProps {
  value: string;
  vertical: 'dental' | 'restaurant' | 'medical' | 'general';
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<boolean>;
  saving?: boolean;
}

// ======================
// PRESET OPTIONS PER VERTICAL
// ======================

const FILLER_PHRASES_OPTIONS: Record<string, string[]> = {
  dental: [
    'Claro, déjame revisar...',
    'Un momento por favor...',
    'Entiendo perfectamente...',
    'Por supuesto...',
    'Mmm, déjame ver...',
  ],
  restaurant: [
    'Claro, un segundo...',
    'Por supuesto...',
    'Déjame verificar...',
    'Bueno...',
    'Mmm, permíteme...',
  ],
  medical: [
    'Entiendo su situación...',
    'Un momento por favor...',
    'Déjame revisar la agenda...',
    'Por supuesto...',
    'Claro que sí...',
  ],
  general: [
    'Claro...',
    'Un momento...',
    'Por supuesto...',
    'Déjame ver...',
    'Entiendo...',
  ],
};

const TONE_OPTIONS = [
  { value: 'professional', label: 'Profesional', description: 'Formal y cortés, ideal para consultorios' },
  { value: 'friendly', label: 'Amigable', description: 'Cálido y cercano, genera confianza' },
  { value: 'empathetic', label: 'Empático', description: 'Comprensivo, ideal para pacientes con ansiedad' },
];

const VERTICAL_TEMPLATES: Record<string, Partial<GuidedInstructions>> = {
  dental: {
    appointmentFlow: 'Pregunta: día preferido, hora aproximada y motivo de la cita. Ejemplo: "¿Para qué día te gustaría la cita, a qué hora te conviene y cuál sería el motivo de tu visita?"',
    availabilityCheck: 'Mientras verificas disponibilidad di: "Un momento, déjame revisar la agenda del doctor..."',
    confirmationMessage: 'Al confirmar: "Perfecto, te agendo para el [día] a las [hora] con [doctor]. Recibirás un recordatorio por WhatsApp."',
    emergencyInstructions: 'Si mencionan dolor intenso, sangrado o accidente dental, prioriza la atención: "Entiendo que es urgente. Déjame ver el primer espacio disponible para atenderte lo antes posible."',
    complaintHandling: 'Si hay una queja o insatisfacción, muestra empatía y ofrece transferir: "Lamento mucho lo que me comentas. Voy a comunicarte con nuestro equipo para atenderte mejor."',
    unknownQuestions: 'Para preguntas médicas específicas: "Esa es una excelente pregunta. El doctor podrá darte una respuesta más precisa durante tu consulta."',
    paymentInfo: 'Aceptamos efectivo, tarjeta y tenemos planes de financiamiento disponibles.',
  },
  restaurant: {
    appointmentFlow: 'Pregunta: día, hora y número de personas. Ejemplo: "Claro, dime por favor el día, la hora y cuántas personas serían."',
    availabilityCheck: 'Mientras verificas: "Un segundo, reviso si tenemos disponibilidad para ese momento..."',
    confirmationMessage: 'Al confirmar: "Genial, pues quedamos así. Te reservo para el [día] a las [hora]. Recibirás un WhatsApp de confirmación."',
    emergencyInstructions: 'Para alergias alimentarias: "Es muy importante que me lo indiques. ¿Podrías decirme específicamente a qué alimentos eres alérgico para informar a la cocina?"',
    complaintHandling: 'Ante quejas: "Lamento mucho lo sucedido. Permíteme comunicarte con el encargado para resolver esto de inmediato."',
    unknownQuestions: 'Para ingredientes específicos: "Déjame verificar esa información con la cocina para darte una respuesta precisa."',
    paymentInfo: 'Aceptamos efectivo, todas las tarjetas y también pagos con código QR.',
  },
  medical: {
    appointmentFlow: 'Pregunta: especialidad necesaria, día preferido y hora. Ejemplo: "¿Con qué especialista necesitas la cita, qué día te convendría y a qué hora?"',
    availabilityCheck: 'Mientras verificas: "Permíteme un momento mientras reviso la agenda del especialista..."',
    confirmationMessage: 'Al confirmar: "Listo, tu cita está agendada para el [día] a las [hora] con el [doctor]. Te enviaremos un recordatorio."',
    emergencyInstructions: 'Para emergencias médicas: "Si es una emergencia que requiere atención inmediata, te recomiendo acudir directamente a urgencias. ¿Necesitas que te proporcione la dirección del hospital más cercano?"',
    complaintHandling: 'Ante quejas: "Entiendo tu frustración y lamento la situación. Voy a comunicarte con atención al paciente para que te ayuden."',
    unknownQuestions: 'Para consultas médicas: "Esa pregunta requiere una evaluación profesional. Te recomiendo comentarlo directamente con el especialista durante tu consulta."',
    paymentInfo: 'Aceptamos seguros de gastos médicos mayores, efectivo y tarjeta. También tenemos convenios con varias aseguradoras.',
  },
  general: {
    appointmentFlow: 'Pregunta la información necesaria para agendar la cita.',
    availabilityCheck: 'Mientras verificas: "Un momento, déjame revisar la disponibilidad..."',
    confirmationMessage: 'Al confirmar: "Perfecto, tu cita está agendada. Te enviaremos un recordatorio."',
    emergencyInstructions: 'Para situaciones urgentes, prioriza la atención y ofrece alternativas.',
    complaintHandling: 'Ante quejas, muestra empatía y ofrece transferir al encargado.',
    unknownQuestions: 'Para preguntas que no puedas responder, sugiere consultar con un especialista.',
    paymentInfo: 'Aceptamos diversos métodos de pago.',
  },
};

// ======================
// HELPER FUNCTIONS
// ======================

const parseInstructionsFromText = (text: string): GuidedInstructions => {
  // Default values - NO ponemos el texto completo en additionalNotes
  // El texto guardado es solo el output, no lo usamos para inicializar campos
  const defaults: GuidedInstructions = {
    fillerPhrases: [],
    communicationTone: 'friendly',
    avoidSilences: true,
    appointmentFlow: '',
    availabilityCheck: '',
    confirmationMessage: '',
    emergencyInstructions: '',
    complaintHandling: '',
    unknownQuestions: '',
    promotions: [],
    paymentInfo: '',
    additionalNotes: '', // Siempre vacío - evita duplicación
  };

  // Si hay texto, intentamos extraer el tono de comunicación
  if (text) {
    if (text.includes('Profesional')) {
      defaults.communicationTone = 'professional';
    } else if (text.includes('Empático')) {
      defaults.communicationTone = 'empathetic';
    }
    // Podríamos parsear más campos en el futuro, pero por ahora
    // es mejor que el usuario vuelva a configurar que duplicar contenido
  }

  return defaults;
};

const generateInstructionsText = (instructions: GuidedInstructions): string => {
  const sections: string[] = [];

  // Estilo de comunicación - muletillas fijas
  sections.push('ESTILO DE COMUNICACIÓN:');
  sections.push('- Sé informal pero profesional, con frases como: "Mmm...", "Bueno...", "Claro..." y "Quiero decir..."');
  const toneLabel = TONE_OPTIONS.find(t => t.value === instructions.communicationTone)?.label || 'Amigable';
  sections.push(`- Tono de comunicación: ${toneLabel}`);
  sections.push('');

  // Manejo de citas
  if (instructions.appointmentFlow || instructions.availabilityCheck || instructions.confirmationMessage) {
    sections.push('MANEJO DE CITAS:');
    if (instructions.appointmentFlow) {
      sections.push(`- Flujo de reserva: ${instructions.appointmentFlow}`);
    }
    if (instructions.availabilityCheck) {
      sections.push(`- Al verificar disponibilidad: ${instructions.availabilityCheck}`);
    }
    if (instructions.confirmationMessage) {
      sections.push(`- Al confirmar: ${instructions.confirmationMessage}`);
    }
    sections.push('');
  }

  // Situaciones especiales
  if (instructions.emergencyInstructions || instructions.complaintHandling || instructions.unknownQuestions) {
    sections.push('SITUACIONES ESPECIALES:');
    if (instructions.emergencyInstructions) {
      sections.push(`- Emergencias/Urgencias: ${instructions.emergencyInstructions}`);
    }
    if (instructions.complaintHandling) {
      sections.push(`- Quejas o insatisfacción: ${instructions.complaintHandling}`);
    }
    if (instructions.unknownQuestions) {
      sections.push(`- Preguntas que no puedes responder: ${instructions.unknownQuestions}`);
    }
    sections.push('');
  }

  // Información adicional
  if (instructions.promotions.length > 0 || instructions.paymentInfo || instructions.additionalNotes) {
    sections.push('INFORMACIÓN ADICIONAL:');
    if (instructions.promotions.length > 0) {
      sections.push(`- Promociones a mencionar: ${instructions.promotions.join(', ')}`);
    }
    if (instructions.paymentInfo) {
      sections.push(`- Información de pago: ${instructions.paymentInfo}`);
    }
    if (instructions.additionalNotes) {
      sections.push(`- Notas adicionales: ${instructions.additionalNotes}`);
    }
  }

  return sections.join('\n').trim();
};

// ======================
// COMPONENT
// ======================

export function GuidedInstructionsSection({
  value,
  vertical,
  onChange,
  onSave,
  saving = false,
}: GuidedInstructionsSectionProps) {
  const [instructions, setInstructions] = useState<GuidedInstructions>(() =>
    parseInstructionsFromText(value)
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    communication: true,
    appointments: false,
    special: false,
    additional: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [newPromotion, setNewPromotion] = useState('');

  // Initialize with vertical template if empty
  useEffect(() => {
    if (!value && vertical) {
      const template = VERTICAL_TEMPLATES[vertical] || VERTICAL_TEMPLATES.general;
      setInstructions(prev => ({
        ...prev,
        ...template,
        fillerPhrases: FILLER_PHRASES_OPTIONS[vertical]?.slice(0, 3) || [],
      }));
    }
  }, [vertical, value]);

  // Generate text when instructions change
  const updateInstructions = useCallback((updates: Partial<GuidedInstructions>) => {
    setInstructions(prev => {
      const newInstructions = { ...prev, ...updates };
      const text = generateInstructionsText(newInstructions);
      onChange(text);
      return newInstructions;
    });
    setHasChanges(true);
  }, [onChange]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };


  const addPromotion = () => {
    if (newPromotion.trim()) {
      updateInstructions({
        promotions: [...instructions.promotions, newPromotion.trim()],
      });
      setNewPromotion('');
    }
  };

  const removePromotion = (index: number) => {
    updateInstructions({
      promotions: instructions.promotions.filter((_, i) => i !== index),
    });
  };

  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

  const handleSave = async () => {
    // Generate fresh text from current instructions state
    const text = generateInstructionsText(instructions);
    console.log('[GuidedInstructionsSection] Saving instructions:', text);
    setSaveSuccess(null);
    const success = await onSave(text);
    setSaveSuccess(success);
    if (success) {
      setHasChanges(false);
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(null), 3000);
    }
  };

  const applyTemplate = () => {
    const template = VERTICAL_TEMPLATES[vertical] || VERTICAL_TEMPLATES.general;
    const defaultPhrases = FILLER_PHRASES_OPTIONS[vertical]?.slice(0, 3) || [];
    setInstructions(prev => ({
      ...prev,
      ...template,
      fillerPhrases: defaultPhrases,
    }));
    const text = generateInstructionsText({
      ...instructions,
      ...template,
      fillerPhrases: defaultPhrases,
    });
    onChange(text);
    setHasChanges(true);
  };

  const verticalLabel = {
    dental: 'Consultorio Dental',
    restaurant: 'Restaurante',
    medical: 'Consultorio Médico',
    general: 'Negocio',
  }[vertical] || 'Negocio';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <LightbulbIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Instrucciones del Asistente</h3>
              <p className="text-sm text-slate-500">Configura cómo se comporta tu asistente de voz</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={applyTemplate}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              Usar plantilla {verticalLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* SECCIÓN 1: Estilo de Comunicación */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('communication')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <MessageIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-slate-900">Estilo de Comunicación</h4>
                <p className="text-xs text-slate-500">Cómo habla tu asistente</p>
              </div>
            </div>
            <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.communication ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {expandedSections.communication && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 border-t border-slate-200">
                  {/* Tono */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tono de comunicación
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {TONE_OPTIONS.map(tone => (
                        <button
                          key={tone.value}
                          onClick={() => updateInstructions({ communicationTone: tone.value as GuidedInstructions['communicationTone'] })}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            instructions.communicationTone === tone.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <p className="font-medium text-slate-900 text-sm">{tone.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{tone.description}</p>
                          {instructions.communicationTone === tone.value && (
                            <CheckIcon className="w-4 h-4 text-blue-500 absolute top-2 right-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info about filler phrases - ya están fijas internamente */}
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm text-blue-700">
                      <strong>Muletillas naturales:</strong> Tu asistente usará frases como &quot;Mmm...&quot;, &quot;Bueno...&quot;, &quot;Claro...&quot; y &quot;Quiero decir...&quot; para sonar más natural.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECCIÓN 2: Manejo de Citas */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('appointments')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <CalendarIcon className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-slate-900">Manejo de Citas</h4>
                <p className="text-xs text-slate-500">Cómo agenda y confirma citas</p>
              </div>
            </div>
            <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.appointments ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {expandedSections.appointments && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 border-t border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ¿Qué información pide para agendar?
                    </label>
                    <textarea
                      value={instructions.appointmentFlow}
                      onChange={(e) => updateInstructions({ appointmentFlow: e.target.value })}
                      placeholder="Ej: Pregunta día, hora y motivo de la cita"
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ¿Qué dice mientras verifica disponibilidad?
                    </label>
                    <textarea
                      value={instructions.availabilityCheck}
                      onChange={(e) => updateInstructions({ availabilityCheck: e.target.value })}
                      placeholder='Ej: "Un momento, déjame revisar la agenda..."'
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ¿Cómo confirma la cita?
                    </label>
                    <textarea
                      value={instructions.confirmationMessage}
                      onChange={(e) => updateInstructions({ confirmationMessage: e.target.value })}
                      placeholder='Ej: "Perfecto, te agendo para el [día] a las [hora]..."'
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECCIÓN 3: Situaciones Especiales */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('special')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertIcon className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-slate-900">Situaciones Especiales</h4>
                <p className="text-xs text-slate-500">Emergencias, quejas y preguntas difíciles</p>
              </div>
            </div>
            <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.special ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {expandedSections.special && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 border-t border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {vertical === 'dental' ? '¿Cómo maneja emergencias dentales?' :
                       vertical === 'restaurant' ? '¿Cómo maneja alergias alimentarias?' :
                       '¿Cómo maneja urgencias?'}
                    </label>
                    <textarea
                      value={instructions.emergencyInstructions}
                      onChange={(e) => updateInstructions({ emergencyInstructions: e.target.value })}
                      placeholder={vertical === 'dental'
                        ? 'Ej: Si mencionan dolor intenso, priorizar atención inmediata...'
                        : 'Ej: Preguntar específicamente sobre alergias antes de confirmar...'}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ¿Cómo maneja quejas o clientes molestos?
                    </label>
                    <textarea
                      value={instructions.complaintHandling}
                      onChange={(e) => updateInstructions({ complaintHandling: e.target.value })}
                      placeholder='Ej: Mostrar empatía y transferir al encargado si es necesario...'
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ¿Qué hace con preguntas que no puede responder?
                    </label>
                    <textarea
                      value={instructions.unknownQuestions}
                      onChange={(e) => updateInstructions({ unknownQuestions: e.target.value })}
                      placeholder='Ej: Sugerir consultar con el especialista durante la cita...'
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SECCIÓN 4: Información Adicional */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('additional')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <TagIcon className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-slate-900">Información Adicional</h4>
                <p className="text-xs text-slate-500">Promociones, pagos y notas extras</p>
              </div>
            </div>
            <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.additional ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {expandedSections.additional && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 border-t border-slate-200">
                  {/* Promociones */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Promociones que debe mencionar
                    </label>
                    <div className="space-y-2">
                      {instructions.promotions.map((promo, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                          <TagIcon className="w-4 h-4 text-purple-500" />
                          <span className="flex-1 text-sm text-purple-800">{promo}</span>
                          <button
                            onClick={() => removePromotion(idx)}
                            className="p-1 hover:bg-purple-100 rounded"
                          >
                            <XIcon className="w-4 h-4 text-purple-400" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPromotion}
                          onChange={(e) => setNewPromotion(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addPromotion()}
                          placeholder="Ej: 20% descuento en limpieza dental este mes"
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                        />
                        <button
                          onClick={addPromotion}
                          className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                        >
                          <PlusIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Información de pago */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Formas de pago aceptadas
                    </label>
                    <textarea
                      value={instructions.paymentInfo}
                      onChange={(e) => updateInstructions({ paymentInfo: e.target.value })}
                      placeholder='Ej: Efectivo, tarjeta, planes de financiamiento disponibles...'
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>

                  {/* Notas adicionales */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Otras instrucciones
                    </label>
                    <textarea
                      value={instructions.additionalNotes}
                      onChange={(e) => updateInstructions({ additionalNotes: e.target.value })}
                      placeholder='Cualquier otra instrucción especial para tu asistente...'
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer with Save */}
      {(hasChanges || saveSuccess !== null) && (
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            {saveSuccess === true ? (
              <p className="text-sm text-tis-green font-medium flex items-center gap-2">
                <CheckIcon className="w-4 h-4" />
                Instrucciones guardadas correctamente
              </p>
            ) : saveSuccess === false ? (
              <p className="text-sm text-red-500 font-medium">
                Error al guardar. Intenta de nuevo.
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Tienes cambios sin guardar
              </p>
            )}
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:shadow-lg hover:shadow-tis-coral/20 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Guardar instrucciones
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GuidedInstructionsSection;
