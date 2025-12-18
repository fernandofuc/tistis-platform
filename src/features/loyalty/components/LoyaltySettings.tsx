// =====================================================
// TIS TIS PLATFORM - Loyalty Settings Component
// Configure program settings and message templates
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import { useLoyaltyProgram, useMessageTemplates } from '../hooks/useLoyalty';
import type { LoyaltyProgram, MessageTemplate, TemplateType } from '../types';

// ======================
// TEMPLATE TYPE CONFIG
// ======================
const TEMPLATE_CONFIG: Record<TemplateType, { name: string; description: string; variables: string[] }> = {
  membership_reminder: {
    name: 'Recordatorio de Membresía',
    description: 'Enviado 7 días antes de que expire la membresía',
    variables: ['{{nombre}}', '{{plan}}', '{{fecha_vencimiento}}', '{{dias_restantes}}'],
  },
  membership_expired: {
    name: 'Membresía Expirada',
    description: 'Enviado cuando la membresía ha expirado',
    variables: ['{{nombre}}', '{{plan}}', '{{fecha_vencimiento}}'],
  },
  tokens_earned: {
    name: 'Tokens Ganados',
    description: 'Notificación cuando el paciente gana tokens',
    variables: ['{{nombre}}', '{{tokens}}', '{{motivo}}', '{{balance}}'],
  },
  tokens_expiring: {
    name: 'Tokens por Expirar',
    description: 'Enviado cuando los tokens están por expirar',
    variables: ['{{nombre}}', '{{tokens}}', '{{fecha_expiracion}}'],
  },
  reward_redeemed: {
    name: 'Recompensa Canjeada',
    description: 'Confirmación de canje de recompensa',
    variables: ['{{nombre}}', '{{recompensa}}', '{{codigo}}', '{{validez}}'],
  },
  tier_upgrade: {
    name: 'Upgrade de Nivel',
    description: 'Felicitación por subir de nivel',
    variables: ['{{nombre}}', '{{nivel_anterior}}', '{{nivel_nuevo}}', '{{beneficios}}'],
  },
  reactivation: {
    name: 'Reactivación',
    description: 'Mensaje para pacientes inactivos (solo 1 vez)',
    variables: ['{{nombre}}', '{{meses_inactivo}}', '{{ultima_cita}}', '{{oferta}}'],
  },
  welcome: {
    name: 'Bienvenida',
    description: 'Mensaje de bienvenida al programa',
    variables: ['{{nombre}}', '{{programa}}', '{{beneficios}}'],
  },
  birthday: {
    name: 'Cumpleaños',
    description: 'Mensaje de cumpleaños con tokens de regalo',
    variables: ['{{nombre}}', '{{tokens_regalo}}'],
  },
};

// ======================
// PROGRAM SETTINGS
// ======================
interface ProgramSettingsProps {
  program: LoyaltyProgram;
  onUpdate: (updates: Partial<LoyaltyProgram>) => Promise<void>;
}

function ProgramSettings({ program, onUpdate }: ProgramSettingsProps) {
  const [formData, setFormData] = useState({
    program_name: program.program_name,
    tokens_name: program.tokens_name,
    tokens_name_plural: program.tokens_name_plural,
    tokens_per_currency: program.tokens_per_currency,
    currency_per_token: program.currency_per_token,
    tokens_expiry_months: program.tokens_expiry_months || '',
    membership_reminder_days: program.membership_reminder_days,
    reactivation_months: program.reactivation_months,
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
        currency_per_token: formData.currency_per_token,
        tokens_expiry_months: formData.tokens_expiry_months ? Number(formData.tokens_expiry_months) : null,
        membership_reminder_days: formData.membership_reminder_days,
        reactivation_months: formData.reactivation_months,
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
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Configuración General</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Programa</label>
            <input
              type="text"
              value={formData.program_name}
              onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
              />
              <span className="text-sm text-gray-700">Programa Activo</span>
            </label>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-4">Nombre de los Tokens</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Singular</label>
            <input
              type="text"
              value={formData.tokens_name}
              onChange={(e) => setFormData({ ...formData, tokens_name: e.target.value })}
              placeholder="Punto"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plural</label>
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

      <div>
        <h4 className="font-medium text-gray-900 mb-4">Conversión de Tokens</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tokens por cada $100</label>
            <input
              type="number"
              value={formData.tokens_per_currency}
              onChange={(e) => setFormData({ ...formData, tokens_per_currency: Number(e.target.value) })}
              min={1}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
            <p className="text-xs text-gray-500 mt-1">Por cada $100 gastados, el paciente gana este número de tokens</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Valor de 1 Token ($)</label>
            <input
              type="number"
              value={formData.currency_per_token}
              onChange={(e) => setFormData({ ...formData, currency_per_token: Number(e.target.value) })}
              min={0.01}
              step={0.01}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
            <p className="text-xs text-gray-500 mt-1">Cuánto vale 1 token en pesos para cálculos</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-4">Automatización</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expiración de Tokens (meses)</label>
            <input
              type="number"
              value={formData.tokens_expiry_months}
              onChange={(e) => setFormData({ ...formData, tokens_expiry_months: e.target.value })}
              placeholder="Sin expiración"
              min={1}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recordatorio Membresía (días)</label>
            <input
              type="number"
              value={formData.membership_reminder_days}
              onChange={(e) => setFormData({ ...formData, membership_reminder_days: Number(e.target.value) })}
              min={1}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reactivación (meses inactivo)</label>
            <input
              type="number"
              value={formData.reactivation_months}
              onChange={(e) => setFormData({ ...formData, reactivation_months: Number(e.target.value) })}
              min={1}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'px-6 py-2.5 rounded-lg font-medium transition-all',
            saved
              ? 'bg-green-500 text-white'
              : 'bg-tis-coral text-white hover:bg-tis-coral/90',
            saving && 'opacity-50'
          )}
        >
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
  const { templates, loading, error, createTemplate, updateTemplate } = useMessageTemplates();
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [editingType, setEditingType] = useState<TemplateType | null>(null);

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
        variables: config.variables,
        is_active: data.is_active,
        send_via_whatsapp: data.send_via_whatsapp,
        send_via_email: false,
      });
    }
    setEditingType(null);
    setEditingTemplate(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-6 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Plantillas de Mensajes</h3>
        <p className="text-sm text-gray-500 mt-1">Configura los mensajes automáticos que el AI enviará</p>
      </div>
      <div className="divide-y divide-gray-100">
        {(Object.keys(TEMPLATE_CONFIG) as TemplateType[]).map((type) => {
          const config = TEMPLATE_CONFIG[type];
          const template = getTemplateForType(type);
          const isConfigured = !!template;

          return (
            <div key={type} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{config.name}</h4>
                  {isConfigured && template.is_active && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activo</span>
                  )}
                  {isConfigured && !template.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{config.description}</p>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(template || null);
                  setEditingType(type);
                }}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg transition-colors',
                  isConfigured
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-tis-coral text-white hover:bg-tis-coral/90'
                )}
              >
                {isConfigured ? 'Editar' : 'Configurar'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Template Edit Modal */}
      {editingType && (
        <TemplateEditModal
          type={editingType}
          template={editingTemplate}
          config={TEMPLATE_CONFIG[editingType]}
          onSave={(data) => handleSaveTemplate(editingType, data)}
          onClose={() => { setEditingType(null); setEditingTemplate(null); }}
        />
      )}
    </div>
  );
}

// ======================
// TEMPLATE EDIT MODAL
// ======================
interface TemplateEditModalProps {
  type: TemplateType;
  template: MessageTemplate | null;
  config: { name: string; description: string; variables: string[] };
  onSave: (data: { message_template: string; whatsapp_template: string; is_active: boolean; send_via_whatsapp: boolean }) => Promise<void>;
  onClose: () => void;
}

function TemplateEditModal({ type, template, config, onSave, onClose }: TemplateEditModalProps) {
  const [formData, setFormData] = useState({
    message_template: template?.message_template || '',
    whatsapp_template: template?.whatsapp_template || '',
    is_active: template?.is_active ?? true,
    send_via_whatsapp: template?.send_via_whatsapp ?? true,
  });
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{config.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{config.description}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Variables reference */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Variables disponibles:</p>
            <div className="flex flex-wrap gap-2">
              {config.variables.map((v) => (
                <code key={v} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">{v}</code>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mensaje (Email/General)</label>
            <textarea
              value={formData.message_template}
              onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
              placeholder={`Hola {{nombre}}, ...`}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              rows={4}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mensaje WhatsApp</label>
            <textarea
              value={formData.whatsapp_template}
              onChange={(e) => setFormData({ ...formData, whatsapp_template: e.target.value })}
              placeholder={`Hola {{nombre}}, ...`}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              rows={4}
            />
            <p className="text-xs text-gray-500 mt-1">Si está vacío, se usará el mensaje general</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.send_via_whatsapp}
                onChange={(e) => setFormData({ ...formData, send_via_whatsapp: e.target.checked })}
                className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
              />
              <span className="text-sm text-gray-700">Enviar por WhatsApp</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-tis-coral rounded border-gray-300 focus:ring-tis-coral"
              />
              <span className="text-sm text-gray-700">Plantilla activa</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-tis-coral text-white rounded-lg hover:bg-tis-coral/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Plantilla'}
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
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'general'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Configuración General
        </button>
        <button
          onClick={() => setActiveSection('messages')}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'messages'
              ? 'border-tis-coral text-tis-coral'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
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
