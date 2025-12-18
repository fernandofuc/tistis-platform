// =====================================================
// TIS TIS PLATFORM - Loyalty Settings Component
// Configure program settings and professional message templates
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import { useLoyaltyProgram, useMessageTemplates } from '../hooks/useLoyalty';
import type { LoyaltyProgram, MessageTemplate, TemplateType } from '../types';

// ======================
// TEMPLATE CATEGORIES & CONFIG
// ======================
interface TemplateConfig {
  name: string;
  description: string;
  category: 'engagement' | 'retention' | 'conversion' | 'celebration';
  icon: React.ReactNode;
  variables: { key: string; label: string; example: string }[];
  defaultMessage: string;
  tips: string[];
  priority: 'high' | 'medium' | 'low';
}

const CATEGORY_CONFIG = {
  engagement: {
    name: 'Engagement',
    description: 'Mensajes para mantener a los pacientes activos',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  retention: {
    name: 'Retención',
    description: 'Recuperar pacientes inactivos',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  conversion: {
    name: 'Conversión',
    description: 'Impulsar canjes y ventas',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
  },
  celebration: {
    name: 'Celebración',
    description: 'Ocasiones especiales',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
  },
};

const TEMPLATE_CONFIG: Record<TemplateType, TemplateConfig> = {
  welcome: {
    name: 'Bienvenida al Programa',
    description: 'Primera impresión cuando un paciente se une al programa de lealtad',
    category: 'engagement',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'María' },
      { key: '{{negocio}}', label: 'Nombre de tu negocio', example: 'Clínica Dental' },
      { key: '{{tokens_nombre}}', label: 'Nombre de los tokens', example: 'Puntos' },
    ],
    defaultMessage: `¡Bienvenido/a al programa de lealtad de {{negocio}}, {{nombre}}! 🎉

A partir de ahora ganarás {{tokens_nombre}} con cada visita que podrás canjear por increíbles recompensas.

¿Tienes dudas? Estamos aquí para ayudarte.`,
    tips: [
      'Usa un tono cálido y personalizado',
      'Explica brevemente los beneficios',
      'Invita a hacer la primera acción',
    ],
    priority: 'high',
  },
  tokens_earned: {
    name: 'Puntos Ganados',
    description: 'Notificación instantánea cuando el paciente acumula puntos',
    category: 'engagement',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Juan' },
      { key: '{{tokens_ganados}}', label: 'Tokens ganados', example: '50' },
      { key: '{{motivo}}', label: 'Motivo (cita, compra)', example: 'tu cita de limpieza' },
      { key: '{{tokens_balance}}', label: 'Balance total', example: '150' },
      { key: '{{tokens_nombre}}', label: 'Nombre de los tokens', example: 'Puntos' },
    ],
    defaultMessage: `¡Felicidades {{nombre}}! 🌟

Has ganado +{{tokens_ganados}} {{tokens_nombre}} por {{motivo}}.

Tu balance actual: {{tokens_balance}} {{tokens_nombre}}

¡Sigue acumulando para desbloquear recompensas exclusivas!`,
    tips: [
      'Celebra el logro del paciente',
      'Muestra el progreso hacia la siguiente recompensa',
      'Mantén el mensaje breve y positivo',
    ],
    priority: 'medium',
  },
  tokens_expiring: {
    name: 'Puntos por Expirar',
    description: 'Alerta 30 días antes de que expiren los puntos',
    category: 'retention',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Ana' },
      { key: '{{tokens_por_vencer}}', label: 'Puntos por expirar', example: '200' },
      { key: '{{dias_restantes}}', label: 'Días restantes', example: '15' },
      { key: '{{tokens_nombre}}', label: 'Nombre de los tokens', example: 'Puntos' },
    ],
    defaultMessage: `Hola {{nombre}}, tienes {{tokens_por_vencer}} {{tokens_nombre}} que vencen en {{dias_restantes}} días ⏰

¡No los pierdas! Agenda tu próxima cita o canjéalos por una recompensa antes de que expiren.

¿Te ayudamos a agendar?`,
    tips: [
      'Crea sentido de urgencia sin presionar',
      'Ofrece una solución clara',
      'Incluye un llamado a la acción',
    ],
    priority: 'high',
  },
  reward_redeemed: {
    name: 'Recompensa Canjeada',
    description: 'Confirmación con código cuando el paciente canjea una recompensa',
    category: 'conversion',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Carlos' },
      { key: '{{recompensa}}', label: 'Nombre de la recompensa', example: 'Limpieza dental gratis' },
      { key: '{{codigo}}', label: 'Código de canje', example: 'CANJE-A1B2C3' },
      { key: '{{validez}}', label: 'Fecha de validez', example: '15/02/2025' },
    ],
    defaultMessage: `¡Excelente elección, {{nombre}}! 🎁

Tu recompensa: {{recompensa}}
Código de canje: {{codigo}}
Válido hasta: {{validez}}

Presenta este código en tu próxima visita para hacerlo efectivo.

¡Gracias por tu lealtad!`,
    tips: [
      'Destaca claramente el código',
      'Incluye instrucciones de uso',
      'Especifica la fecha de vencimiento',
    ],
    priority: 'high',
  },
  tier_upgrade: {
    name: 'Upgrade de Nivel',
    description: 'Celebración cuando el paciente sube de categoría',
    category: 'celebration',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Laura' },
      { key: '{{nivel_anterior}}', label: 'Nivel anterior', example: 'Bronce' },
      { key: '{{nivel_nuevo}}', label: 'Nuevo nivel', example: 'Plata' },
      { key: '{{beneficios}}', label: 'Nuevos beneficios', example: '10% extra en puntos' },
    ],
    defaultMessage: `¡FELICIDADES {{nombre}}! 🏆✨

Has subido de nivel: {{nivel_anterior}} ➡️ {{nivel_nuevo}}

Tus nuevos beneficios:
{{beneficios}}

Gracias por ser parte de nuestra comunidad de pacientes VIP.`,
    tips: [
      'Celebra efusivamente el logro',
      'Detalla los nuevos beneficios',
      'Hazlo sentir especial',
    ],
    priority: 'medium',
  },
  membership_reminder: {
    name: 'Recordatorio de Membresía',
    description: 'Aviso 7 días antes del vencimiento de membresía',
    category: 'retention',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Pedro' },
      { key: '{{plan}}', label: 'Nombre del plan', example: 'Plan Premium' },
      { key: '{{fecha_vencimiento}}', label: 'Fecha de vencimiento', example: '20/01/2025' },
      { key: '{{dias_restantes}}', label: 'Días restantes', example: '7' },
    ],
    defaultMessage: `Hola {{nombre}}, tu membresía {{plan}} vence en {{dias_restantes}} días 📅

Fecha de vencimiento: {{fecha_vencimiento}}

Renueva ahora para seguir disfrutando de todos tus beneficios exclusivos sin interrupción.

¿Tienes alguna duda sobre la renovación?`,
    tips: [
      'Recuerda los beneficios que perdería',
      'Ofrece facilidades de renovación',
      'Mantén un tono amigable, no amenazante',
    ],
    priority: 'high',
  },
  membership_expired: {
    name: 'Membresía Expirada',
    description: 'Mensaje cuando la membresía ha vencido',
    category: 'retention',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Sofía' },
      { key: '{{plan}}', label: 'Nombre del plan', example: 'Plan Gold' },
      { key: '{{fecha_vencimiento}}', label: 'Fecha que venció', example: '01/01/2025' },
    ],
    defaultMessage: `Hola {{nombre}}, tu membresía {{plan}} ha vencido 😔

Te extrañamos. Renueva hoy y recupera todos tus beneficios exclusivos inmediatamente.

Como paciente especial, te ofrecemos condiciones preferenciales para tu renovación.

¿Hablamos?`,
    tips: [
      'Muestra que lo extrañas',
      'Ofrece un incentivo para renovar',
      'No seas insistente',
    ],
    priority: 'medium',
  },
  reactivation: {
    name: 'Reactivación de Pacientes',
    description: 'Mensaje único para pacientes inactivos (se envía solo 1 vez)',
    category: 'retention',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Roberto' },
      { key: '{{meses_inactivo}}', label: 'Meses de inactividad', example: '6' },
      { key: '{{ultima_cita}}', label: 'Fecha última cita', example: 'Julio 2024' },
      { key: '{{oferta}}', label: 'Oferta especial', example: '20% de descuento' },
      { key: '{{negocio}}', label: 'Nombre del negocio', example: 'Clínica Dental' },
    ],
    defaultMessage: `Hola {{nombre}}, ha pasado tiempo desde tu última visita en {{negocio}} 💭

Tu salud dental es importante para nosotros. Han pasado {{meses_inactivo}} meses desde {{ultima_cita}}.

Como paciente especial, te ofrecemos {{oferta}} en tu próxima cita.

¿Te gustaría agendar? Estamos para atenderte.`,
    tips: [
      'Este mensaje se envía SOLO UNA VEZ',
      'Usa un tono cálido, no de reclamo',
      'Incluye una oferta atractiva',
      'Menciona el beneficio de volver',
    ],
    priority: 'high',
  },
  birthday: {
    name: 'Feliz Cumpleaños',
    description: 'Mensaje de cumpleaños con regalo de puntos',
    category: 'celebration',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A2.704 2.704 0 003 15.546V12a9 9 0 1118 0v3.546zM12 4.5v.75m-4.5 6.75h.008v.008H7.5v-.008zm4.5 0h.008v.008H12v-.008zm4.5 0h.008v.008h-.008v-.008z" />
      </svg>
    ),
    variables: [
      { key: '{{nombre}}', label: 'Nombre del paciente', example: 'Diana' },
      { key: '{{tokens_regalo}}', label: 'Tokens de regalo', example: '100' },
      { key: '{{tokens_nombre}}', label: 'Nombre de los tokens', example: 'Puntos' },
    ],
    defaultMessage: `¡Feliz Cumpleaños {{nombre}}! 🎂🎉

En tu día especial, queremos celebrar contigo.

Te obsequiamos {{tokens_regalo}} {{tokens_nombre}} de regalo.

¡Que tengas un excelente día lleno de sonrisas!`,
    tips: [
      'Sé genuinamente cálido',
      'El regalo debe sentirse especial',
      'No incluyas llamados de venta directos',
    ],
    priority: 'medium',
  },
};

// ======================
// PROGRAM SETTINGS
// ======================
interface ProgramSettingsProps {
  program: LoyaltyProgram;
  onUpdate: (updates: Partial<LoyaltyProgram>) => Promise<void | LoyaltyProgram>;
}

function ProgramSettings({ program, onUpdate }: ProgramSettingsProps) {
  const [formData, setFormData] = useState({
    program_name: program.program_name,
    tokens_name: program.tokens_name,
    tokens_name_plural: program.tokens_name_plural,
    tokens_per_currency: program.tokens_per_currency,
    tokens_currency_threshold: program.tokens_currency_threshold,
    tokens_expiry_days: program.tokens_expiry_days || '',
    reactivation_days_inactive: program.reactivation_days_inactive,
    is_active: program.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        program_name: formData.program_name,
        tokens_name: formData.tokens_name,
        tokens_name_plural: formData.tokens_name_plural,
        tokens_per_currency: formData.tokens_per_currency,
        tokens_currency_threshold: formData.tokens_currency_threshold,
        tokens_expiry_days: formData.tokens_expiry_days ? Number(formData.tokens_expiry_days) : 365,
        reactivation_days_inactive: formData.reactivation_days_inactive,
        is_active: formData.is_active,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Configuración General</h3>
          <p className="text-sm text-gray-500">Personaliza el nombre y funcionamiento del programa</p>
        </div>
        <label className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Programa Activo</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="sr-only"
            />
            <div
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={cn(
                'w-11 h-6 rounded-full cursor-pointer transition-colors',
                formData.is_active ? 'bg-green-500' : 'bg-gray-300'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform mt-0.5',
                  formData.is_active ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
                )}
              />
            </div>
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Programa</label>
          <input
            type="text"
            value={formData.program_name}
            onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            placeholder="Programa de Lealtad"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Token (singular)</label>
            <input
              type="text"
              value={formData.tokens_name}
              onChange={(e) => setFormData({ ...formData, tokens_name: e.target.value })}
              placeholder="Punto"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tokens (plural)</label>
            <input
              type="text"
              value={formData.tokens_name_plural}
              onChange={(e) => setFormData({ ...formData, tokens_name_plural: e.target.value })}
              placeholder="Puntos"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Configuración de Tokens</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.tokens_name_plural} por cada $
            </label>
            <input
              type="number"
              value={formData.tokens_per_currency}
              onChange={(e) => setFormData({ ...formData, tokens_per_currency: Number(e.target.value) })}
              min={0.01}
              step={0.01}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
            <p className="text-xs text-gray-500 mt-1">Ratio de conversión de gasto a tokens</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mínimo para ganar tokens ($)</label>
            <input
              type="number"
              value={formData.tokens_currency_threshold}
              onChange={(e) => setFormData({ ...formData, tokens_currency_threshold: Number(e.target.value) })}
              min={0}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
            <p className="text-xs text-gray-500 mt-1">Gasto mínimo para acumular tokens</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expiración (días)</label>
            <input
              type="number"
              value={formData.tokens_expiry_days}
              onChange={(e) => setFormData({ ...formData, tokens_expiry_days: e.target.value })}
              placeholder="365"
              min={0}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
            <p className="text-xs text-gray-500 mt-1">0 = no expiran</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Reactivación de Pacientes</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Días de inactividad para reactivación</label>
            <input
              type="number"
              value={formData.reactivation_days_inactive}
              onChange={(e) => setFormData({ ...formData, reactivation_days_inactive: Number(e.target.value) })}
              min={30}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
            <p className="text-xs text-gray-500 mt-1">Días sin visita para considerar paciente inactivo</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2',
            saved
              ? 'bg-green-500 text-white'
              : 'bg-tis-coral text-white hover:bg-tis-coral/90',
            saving && 'opacity-50'
          )}
        >
          {saved && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {saving ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}

// ======================
// MESSAGE TEMPLATES
// ======================
function MessageTemplatesSection() {
  const { templates, loading, createTemplate, updateTemplate } = useMessageTemplates();
  const [editingType, setEditingType] = useState<TemplateType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getTemplateForType = (type: TemplateType) => {
    return templates.find(t => t.template_type === type);
  };

  const handleSaveTemplate = async (type: TemplateType, data: {
    message_template: string;
    whatsapp_template: string;
    is_active: boolean;
    send_via_whatsapp: boolean;
  }) => {
    const existing = getTemplateForType(type);
    const config = TEMPLATE_CONFIG[type];

    if (existing) {
      await updateTemplate(existing.id, data);
    } else {
      await createTemplate({
        template_type: type,
        template_name: config.name,
        message_template: data.message_template,
        whatsapp_template: data.whatsapp_template,
        variables: config.variables.map(v => v.key),
        is_active: data.is_active,
        send_via_whatsapp: data.send_via_whatsapp,
        send_via_email: false,
      });
    }
    setEditingType(null);
  };

  // Count configured templates by category
  const getCategoryStats = (category: string) => {
    const categoryTemplates = (Object.keys(TEMPLATE_CONFIG) as TemplateType[]).filter(
      type => TEMPLATE_CONFIG[type].category === category
    );
    const configured = categoryTemplates.filter(type => getTemplateForType(type)?.is_active).length;
    return { configured, total: categoryTemplates.length };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
      </div>
    );
  }

  const filteredTemplates = selectedCategory
    ? (Object.keys(TEMPLATE_CONFIG) as TemplateType[]).filter(
        type => TEMPLATE_CONFIG[type].category === selectedCategory
      )
    : (Object.keys(TEMPLATE_CONFIG) as TemplateType[]);

  return (
    <div className="space-y-6">
      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(CATEGORY_CONFIG) as (keyof typeof CATEGORY_CONFIG)[]).map((cat) => {
          const catConfig = CATEGORY_CONFIG[cat];
          const stats = getCategoryStats(cat);
          const isSelected = selectedCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(isSelected ? null : cat)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                isSelected
                  ? `${catConfig.bgColor} border-current ${catConfig.textColor}`
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <div className={cn('w-3 h-3 rounded-full mb-2', catConfig.color)} />
              <h4 className={cn('font-medium', isSelected ? catConfig.textColor : 'text-gray-900')}>
                {catConfig.name}
              </h4>
              <p className="text-xs text-gray-500 mt-1">{catConfig.description}</p>
              <p className="text-xs mt-2">
                <span className={cn('font-semibold', isSelected ? catConfig.textColor : 'text-gray-700')}>
                  {stats.configured}/{stats.total}
                </span>
                <span className="text-gray-400"> configurados</span>
              </p>
            </button>
          );
        })}
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-tis-coral/10 to-purple-100/50 rounded-xl p-4 flex items-start gap-4">
        <div className="w-10 h-10 bg-tis-coral/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-tis-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h4 className="font-medium text-gray-900">Sistema de Mensajes Inteligente</h4>
          <p className="text-sm text-gray-600 mt-1">
            Configura las plantillas que el AI usará para comunicarse automáticamente con tus pacientes.
            Cada mensaje se personaliza con los datos del paciente en tiempo real.
          </p>
        </div>
      </div>

      {/* Templates List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            {selectedCategory
              ? `Plantillas de ${CATEGORY_CONFIG[selectedCategory as keyof typeof CATEGORY_CONFIG].name}`
              : 'Todas las Plantillas'}
          </h3>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-tis-coral hover:underline mt-1"
            >
              Ver todas
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {filteredTemplates.map((type) => {
            const config = TEMPLATE_CONFIG[type];
            const template = getTemplateForType(type);
            const isConfigured = !!template;
            const catConfig = CATEGORY_CONFIG[config.category];

            return (
              <div key={type} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', catConfig.bgColor, catConfig.textColor)}>
                      {config.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{config.name}</h4>
                        {config.priority === 'high' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Alta prioridad</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{config.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          catConfig.bgColor, catConfig.textColor
                        )}>
                          {catConfig.name}
                        </span>
                        {isConfigured && (
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            template.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          )}>
                            {template.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        )}
                        {isConfigured && template.send_via_whatsapp && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingType(type)}
                    className={cn(
                      'px-4 py-2 text-sm rounded-lg font-medium transition-colors',
                      isConfigured
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-tis-coral text-white hover:bg-tis-coral/90'
                    )}
                  >
                    {isConfigured ? 'Editar' : 'Configurar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Template Edit Modal */}
      {editingType && (
        <TemplateEditModal
          type={editingType}
          template={getTemplateForType(editingType) || null}
          config={TEMPLATE_CONFIG[editingType]}
          onSave={(data) => handleSaveTemplate(editingType, data)}
          onClose={() => setEditingType(null)}
        />
      )}
    </div>
  );
}

// ======================
// TEMPLATE EDIT MODAL (PROFESSIONAL VERSION)
// ======================
interface TemplateEditModalProps {
  type: TemplateType;
  template: MessageTemplate | null;
  config: TemplateConfig;
  onSave: (data: { message_template: string; whatsapp_template: string; is_active: boolean; send_via_whatsapp: boolean }) => Promise<void>;
  onClose: () => void;
}

function TemplateEditModal({ type, template, config, onSave, onClose }: TemplateEditModalProps) {
  const [formData, setFormData] = useState({
    message_template: template?.message_template || config.defaultMessage,
    whatsapp_template: template?.whatsapp_template || '',
    is_active: template?.is_active ?? true,
    send_via_whatsapp: template?.send_via_whatsapp ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Generate preview with example values
  const generatePreview = (text: string) => {
    let preview = text;
    config.variables.forEach(v => {
      preview = preview.replace(new RegExp(v.key.replace(/[{}]/g, '\\$&'), 'g'), v.example);
    });
    return preview;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = formData.message_template.substring(0, start) + variable + formData.message_template.substring(end);
      setFormData({ ...formData, message_template: newText });
      // Focus and set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const catConfig = CATEGORY_CONFIG[config.category];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', catConfig.bgColor, catConfig.textColor)}>
              {config.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{config.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{config.description}</p>
              <span className={cn('text-xs px-2 py-0.5 rounded-full mt-2 inline-block', catConfig.bgColor, catConfig.textColor)}>
                {catConfig.name}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Variables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Variables disponibles</label>
              <div className="flex flex-wrap gap-2">
                {config.variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="group relative"
                  >
                    <code className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-tis-coral/10 hover:text-tis-coral transition-colors cursor-pointer">
                      {v.key}
                    </code>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {v.label}: <span className="text-tis-coral">{v.example}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Mensaje</label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-tis-coral hover:underline"
                >
                  {showPreview ? 'Editar' : 'Vista previa'}
                </button>
              </div>
              {showPreview ? (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Vista previa de WhatsApp</span>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {generatePreview(formData.whatsapp_template || formData.message_template)}
                    </p>
                  </div>
                </div>
              ) : (
                <textarea
                  id="message-textarea"
                  value={formData.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  placeholder="Escribe tu mensaje aquí..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-tis-coral/20 font-mono text-sm"
                  rows={8}
                  required
                />
              )}
            </div>

            {/* WhatsApp specific message (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mensaje específico para WhatsApp (opcional)
              </label>
              <textarea
                value={formData.whatsapp_template}
                onChange={(e) => setFormData({ ...formData, whatsapp_template: e.target.value })}
                placeholder="Si está vacío, se usará el mensaje principal..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-tis-coral/20 font-mono text-sm"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                Puedes personalizar el mensaje para WhatsApp si deseas un formato diferente
              </p>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Tips para este mensaje
              </h4>
              <ul className="space-y-1">
                {config.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Settings */}
            <div className="flex items-center justify-between py-4 border-t border-gray-100">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.send_via_whatsapp}
                    onChange={(e) => setFormData({ ...formData, send_via_whatsapp: e.target.checked })}
                    className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Enviar por WhatsApp
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
                  />
                  <span className="text-sm text-gray-700">Plantilla activa</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-white transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-tis-coral text-white rounded-lg hover:bg-tis-coral/90 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guardar Plantilla
                </>
              )}
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
export function LoyaltySettings() {
  const { program, loading, error, updateProgram } = useLoyaltyProgram();
  const [activeSection, setActiveSection] = useState<'general' | 'messages'>('general');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">{error || 'Error al cargar programa'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveSection('general')}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeSection === 'general'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuración General
        </button>
        <button
          onClick={() => setActiveSection('messages')}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeSection === 'messages'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Mensajes Automáticos
        </button>
      </div>

      {activeSection === 'general' ? (
        <ProgramSettings program={program} onUpdate={updateProgram} />
      ) : (
        <MessageTemplatesSection />
      )}
    </div>
  );
}
