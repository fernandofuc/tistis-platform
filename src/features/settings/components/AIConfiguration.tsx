// =====================================================
// TIS TIS PLATFORM - AI Configuration Component
// Configure AI assistant behavior and clinic information
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Input } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================

// Los modelos son gestionados internamente por TIS TIS, no por los clientes
// - Chat Discovery: gpt-5-nano (ultra rápido y económico)
// - Mensajería Auto: gpt-5-mini (balance calidad/costo)
// - Voz VAPI: gpt-4o (optimizado para audio)

interface AIConfig {
  id?: string;
  tenant_id: string;
  ai_enabled: boolean;
  ai_personality: 'professional' | 'professional_friendly' | 'casual' | 'formal';
  max_tokens: number;
  ai_temperature: number;
  enable_scoring: boolean;
  auto_escalate_after_messages: number;
  escalation_keywords: string[];
  business_hours: {
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
    timezone: string;
  };
}

interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  whatsapp_number: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  operating_hours: {
    monday?: { open: string; close: string; enabled: boolean };
    tuesday?: { open: string; close: string; enabled: boolean };
    wednesday?: { open: string; close: string; enabled: boolean };
    thursday?: { open: string; close: string; enabled: boolean };
    friday?: { open: string; close: string; enabled: boolean };
    saturday?: { open: string; close: string; enabled: boolean };
    sunday?: { open: string; close: string; enabled: boolean };
  };
}

interface Staff {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  role: string;
  specialty: string | null;
  license_number: string | null;
  is_active: boolean;
}

interface StaffBranch {
  staff_id: string;
  branch_id: string;
  is_primary: boolean;
}

interface ScoringRule {
  id: string;
  tenant_id: string | null;
  signal_name: string;
  points: number;
  keywords: string[];
  category: string;
  is_active: boolean;
}

// ======================
// ICONS
// ======================
const icons = {
  ai: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  location: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  clinic: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  doctor: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

const responseStyles = [
  { value: 'professional', label: 'Profesional', desc: 'Formal y directo' },
  { value: 'professional_friendly', label: 'Profesional Cálido', desc: 'Formal pero amigable (recomendado)' },
  { value: 'casual', label: 'Casual', desc: 'Informal y cercano' },
  { value: 'formal', label: 'Muy Formal', desc: 'Extremadamente profesional' },
];

// Modelos gestionados por TIS TIS (no seleccionables por cliente)
const TISTIS_AI_MODELS = {
  messaging: { name: 'GPT-5 Mini', description: 'Respuestas naturales y rápidas para chat', icon: '💬' },
  discovery: { name: 'GPT-5 Nano', description: 'Ultra rápido para discovery chat', icon: '🔍' },
  voice: { name: 'GPT-4o', description: 'Optimizado para asistente de voz', icon: '🎙️' },
};

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// ======================
// COMPONENT
// ======================

export function AIConfiguration() {
  const { tenant, isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'clinic' | 'scoring' | 'escalation'>('general');

  // AI Config State
  const [config, setConfig] = useState<AIConfig>({
    tenant_id: tenant?.id || '',
    ai_enabled: true,
    ai_personality: 'professional_friendly',
    max_tokens: 500,
    ai_temperature: 0.7,
    enable_scoring: true,
    auto_escalate_after_messages: 10,
    escalation_keywords: ['queja', 'molesto', 'enojado', 'gerente', 'supervisor'],
    business_hours: {
      enabled: false,
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5],
      timezone: 'America/Mexico_City',
    },
  });

  // Clinic Data State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffBranches, setStaffBranches] = useState<StaffBranch[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);

  // Modal States
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showStaffModal, setShowStaffModal] = useState(false);

  // Load configuration
  useEffect(() => {
    if (!tenant?.id) return;

    const loadConfig = async () => {
      setLoading(true);

      // Load AI config
      const { data: aiConfig } = await supabase
        .from('ai_tenant_config')
        .select('*')
        .eq('tenant_id', tenant.id)
        .single();

      if (aiConfig) {
        setConfig((prev) => ({
          ...prev,
          ...aiConfig,
        }));
      }

      // Load branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false });

      if (branchesData) {
        setBranches(branchesData);
      }

      // Load staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .in('role', ['dentist', 'specialist', 'owner', 'manager']);

      if (staffData) {
        setStaff(staffData);
      }

      // Load staff-branch assignments
      const { data: sbData } = await supabase
        .from('staff_branches')
        .select('*');

      if (sbData) {
        setStaffBranches(sbData);
      }

      // Load scoring rules
      const { data: rules } = await supabase
        .from('ai_scoring_rules')
        .select('*')
        .or(`tenant_id.eq.${tenant.id},tenant_id.is.null`)
        .eq('is_active', true)
        .order('points', { ascending: false });

      if (rules) {
        setScoringRules(rules);
      }

      setLoading(false);
    };

    loadConfig();
  }, [tenant?.id]);

  // Save AI configuration
  const saveConfig = async () => {
    if (!tenant?.id) return;

    setSaving(true);

    const { tenant_id: _, ...configWithoutTenantId } = config;

    const { error } = await supabase
      .from('ai_tenant_config')
      .upsert({
        tenant_id: tenant.id,
        ...configWithoutTenantId,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);

    if (error) {
      console.error('Error saving config:', error);
    }
  };

  // Save branch
  const saveBranch = async (branchData: Partial<Branch>) => {
    if (!tenant?.id) return;

    setSaving(true);

    const { error } = await supabase
      .from('branches')
      .upsert({
        ...branchData,
        tenant_id: tenant.id,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      // Reload branches
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false });

      if (data) setBranches(data);
      setShowBranchModal(false);
      setEditingBranch(null);
    }

    setSaving(false);
  };

  // Toggle AI enabled
  const toggleAI = async () => {
    const newState = !config.ai_enabled;
    setConfig({ ...config, ai_enabled: newState });

    await supabase
      .from('ai_tenant_config')
      .upsert({
        tenant_id: tenant?.id,
        ai_enabled: newState,
      });
  };

  // Get staff for a branch
  const getStaffForBranch = (branchId: string) => {
    const staffIds = staffBranches
      .filter(sb => sb.branch_id === branchId)
      .map(sb => sb.staff_id);
    return staff.filter(s => staffIds.includes(s.id));
  };

  if (loading) {
    return (
      <Card variant="bordered">
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Status Card */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <div
            className={cn(
              'p-6 rounded-xl',
              config.ai_enabled ? 'bg-gradient-to-r from-purple-50 to-blue-50' : 'bg-gray-50'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center',
                    config.ai_enabled ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-400'
                  )}
                >
                  {icons.ai}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    AI Agent {config.ai_enabled ? 'Activo' : 'Desactivado'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {config.ai_enabled
                      ? `Usando ${TISTIS_AI_MODELS.messaging.name} para mensajería`
                      : 'Las conversaciones serán atendidas manualmente'}
                  </p>
                </div>
              </div>

              {isAdmin && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.ai_enabled}
                    onChange={toggleAI}
                  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Tabs */}
      <Card variant="bordered">
        <CardContent className="p-0">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {[
              { key: 'general', label: 'General', icon: icons.ai },
              { key: 'clinic', label: 'Clínica y Sucursales', icon: icons.clinic },
              { key: 'scoring', label: 'Puntuación', icon: icons.check },
              { key: 'escalation', label: 'Escalamiento', icon: icons.warning },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key as typeof activeSection)}
                className={cn(
                  'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeSection === tab.key
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <span className={cn(activeSection === tab.key ? 'text-purple-600' : 'text-gray-400')}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="p-6 space-y-6">
              {/* Información de Modelos AI (gestionados por TIS TIS) */}
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-green-900 mb-2">Modelos AI Optimizados por TIS TIS</h4>
                    <p className="text-sm text-green-700 mb-3">
                      Utilizamos los modelos más avanzados de OpenAI, seleccionados automáticamente para cada caso de uso:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(TISTIS_AI_MODELS).map(([key, model]) => (
                        <div key={key} className="bg-white/60 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{model.icon}</span>
                            <p className="font-medium text-green-900 text-sm">{model.name}</p>
                          </div>
                          <p className="text-xs text-green-600 mt-1">{model.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estilo de Respuesta del AI
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {responseStyles.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setConfig({ ...config, ai_personality: style.value as typeof config.ai_personality })}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        config.ai_personality === style.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <p className="font-medium text-gray-900">{style.label}</p>
                      <p className="text-sm text-gray-500">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitud Máxima de Respuesta
                  </label>
                  <select
                    value={config.max_tokens}
                    onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={300}>Corto - Mensajes breves</option>
                    <option value={500}>Medio - Balance (recomendado)</option>
                    <option value={800}>Largo - Respuestas detalladas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Creatividad del AI
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.ai_temperature}
                      onChange={(e) => setConfig({ ...config, ai_temperature: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600 w-12">{config.ai_temperature}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    0 = Muy consistente, 1 = Más creativo
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Clinic & Branches Settings */}
          {activeSection === 'clinic' && (
            <div className="p-6 space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {icons.clinic}
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">Información de la Clínica</h4>
                    <p className="text-sm text-blue-700">
                      Esta información es utilizada por el AI para responder preguntas sobre ubicaciones,
                      horarios y doctores. Las coordenadas GPS permiten enviar ubicaciones directas por WhatsApp.
                    </p>
                  </div>
                </div>
              </div>

              {/* Branches List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Sucursales ({branches.length})</h4>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingBranch(null);
                        setShowBranchModal(true);
                      }}
                    >
                      {icons.plus}
                      <span className="ml-2">Agregar Sucursal</span>
                    </Button>
                  )}
                </div>

                {branches.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                      {icons.location}
                    </div>
                    <p className="text-gray-500">No hay sucursales configuradas</p>
                    <p className="text-sm text-gray-400">Agrega tu primera sucursal para que el AI pueda dar información de ubicación</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {branches.map((branch) => (
                      <BranchCard
                        key={branch.id}
                        branch={branch}
                        staff={getStaffForBranch(branch.id)}
                        onEdit={() => {
                          setEditingBranch(branch);
                          setShowBranchModal(true);
                        }}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Doctors Summary */}
              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Doctores / Especialistas ({staff.length})</h4>
                </div>

                {staff.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl">
                    <p className="text-gray-500">No hay doctores registrados</p>
                    <p className="text-sm text-gray-400">Los doctores se gestionan desde la sección de Personal</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {staff.map((member) => {
                      const memberBranches = staffBranches
                        .filter(sb => sb.staff_id === member.id)
                        .map(sb => branches.find(b => b.id === sb.branch_id)?.name)
                        .filter(Boolean);

                      return (
                        <div key={member.id} className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-purple-600 font-medium">
                                {member.first_name[0]}{member.last_name[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                Dr. {member.first_name} {member.last_name}
                              </p>
                              {member.specialty && (
                                <p className="text-sm text-gray-500">{member.specialty}</p>
                              )}
                              {memberBranches.length > 0 && (
                                <p className="text-xs text-purple-600 mt-1">
                                  {memberBranches.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scoring Configuration */}
          {activeSection === 'scoring' && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Sistema de Puntuación de Leads</h4>
                  <p className="text-sm text-gray-500">
                    Detecta automáticamente señales de intención de compra
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.enable_scoring}
                    onChange={(e) => setConfig({ ...config, enable_scoring: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {config.enable_scoring && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 font-medium">Reglas de Puntuación Activas</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {scoringRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{rule.signal_name}</p>
                          <p className="text-xs text-gray-500">
                            {rule.keywords.slice(0, 3).join(', ')}
                            {rule.keywords.length > 3 && '...'}
                          </p>
                        </div>
                        <Badge
                          variant={rule.points > 0 ? 'success' : 'warning'}
                          size="sm"
                        >
                          {rule.points > 0 ? '+' : ''}{rule.points} pts
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <strong>Sistema de Clasificación:</strong>
                    <div className="mt-2 grid grid-cols-3 gap-4">
                      <div>
                        <Badge variant="hot" size="sm">HOT</Badge>
                        <span className="ml-2">80+ puntos</span>
                      </div>
                      <div>
                        <Badge variant="warning" size="sm">WARM</Badge>
                        <span className="ml-2">40-79 puntos</span>
                      </div>
                      <div>
                        <Badge variant="info" size="sm">COLD</Badge>
                        <span className="ml-2">0-39 puntos</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Escalation Settings */}
          {activeSection === 'escalation' && (
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escalar después de N mensajes sin conversión
                </label>
                <select
                  value={config.auto_escalate_after_messages}
                  onChange={(e) =>
                    setConfig({ ...config, auto_escalate_after_messages: parseInt(e.target.value) })
                  }
                  className="w-full max-w-xs px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={5}>5 mensajes</option>
                  <option value={10}>10 mensajes</option>
                  <option value={15}>15 mensajes</option>
                  <option value={20}>20 mensajes</option>
                  <option value={0}>Nunca (deshabilitado)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Palabras clave de escalamiento automático
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  El AI escalará inmediatamente si detecta estas palabras
                </p>
                <textarea
                  rows={3}
                  value={config.escalation_keywords.join(', ')}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      escalation_keywords: e.target.value.split(',').map((k) => k.trim()),
                    })
                  }
                  placeholder="queja, molesto, enojado, gerente, supervisor, demanda"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-600">{icons.warning}</span>
                  <div>
                    <p className="font-medium text-yellow-800">Escalamiento automático siempre activo:</p>
                    <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
                      <li>Cuando el cliente solicite hablar con un humano</li>
                      <li>Cuando se detecte dolor o emergencia</li>
                      <li>Cuando el lead sea clasificado como HOT (80+ puntos)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="p-6 border-t border-gray-100 flex justify-end">
            <Button onClick={saveConfig} isLoading={saving}>
              Guardar Configuración
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Branch Modal */}
      {showBranchModal && (
        <BranchModal
          branch={editingBranch}
          onClose={() => {
            setShowBranchModal(false);
            setEditingBranch(null);
          }}
          onSave={saveBranch}
          saving={saving}
        />
      )}
    </div>
  );
}

// ======================
// BRANCH CARD COMPONENT
// ======================

interface BranchCardProps {
  branch: Branch;
  staff: Staff[];
  onEdit: () => void;
  isAdmin: boolean;
}

function BranchCard({ branch, staff, onEdit, isAdmin }: BranchCardProps) {
  const hasCoordinates = branch.latitude && branch.longitude;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            branch.is_headquarters ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
          )}>
            {icons.location}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="font-semibold text-gray-900">{branch.name}</h5>
              {branch.is_headquarters && (
                <Badge variant="info" size="sm">Principal</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {branch.city}, {branch.state}
            </p>
            {branch.address && (
              <p className="text-sm text-gray-400">{branch.address}</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {icons.edit}
          </button>
        )}
      </div>

      {/* Info Grid */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Phone */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Teléfono</p>
          <p className="text-sm font-medium text-gray-900">{branch.phone || 'No configurado'}</p>
        </div>

        {/* WhatsApp */}
        <div>
          <p className="text-xs text-gray-500 mb-1">WhatsApp</p>
          <p className="text-sm font-medium text-gray-900">{branch.whatsapp_number || 'No configurado'}</p>
        </div>

        {/* Coordinates */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Coordenadas GPS</p>
          {hasCoordinates ? (
            <p className="text-sm font-medium text-green-600">
              Configuradas
            </p>
          ) : (
            <p className="text-sm text-red-500">No configuradas</p>
          )}
        </div>

        {/* Staff */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Doctores</p>
          <p className="text-sm font-medium text-gray-900">
            {staff.length > 0 ? `${staff.length} asignados` : 'Ninguno'}
          </p>
        </div>
      </div>

      {/* Operating Hours Preview */}
      {branch.operating_hours && Object.keys(branch.operating_hours).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Horarios de atención</p>
          <div className="flex flex-wrap gap-2">
            {dayKeys.map((day, idx) => {
              const hours = branch.operating_hours[day];
              const isEnabled = hours?.enabled;
              return (
                <span
                  key={day}
                  className={cn(
                    'px-2 py-1 rounded text-xs',
                    isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  )}
                >
                  {dayNames[idx]}
                  {isEnabled && hours && (
                    <span className="ml-1">{hours.open}-{hours.close}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* GPS Warning */}
      {!hasCoordinates && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-xs text-yellow-800">
            <strong>Importante:</strong> Sin coordenadas GPS, el AI no podrá enviar la ubicación por WhatsApp.
            Solo enviará el link de Google Maps.
          </p>
        </div>
      )}
    </div>
  );
}

// ======================
// BRANCH MODAL COMPONENT
// ======================

interface BranchModalProps {
  branch: Branch | null;
  onClose: () => void;
  onSave: (data: Partial<Branch>) => void;
  saving: boolean;
}

function BranchModal({ branch, onClose, onSave, saving }: BranchModalProps) {
  const [formData, setFormData] = useState({
    id: branch?.id || undefined,
    name: branch?.name || '',
    slug: branch?.slug || '',
    city: branch?.city || '',
    state: branch?.state || '',
    address: branch?.address || '',
    phone: branch?.phone || '',
    whatsapp_number: branch?.whatsapp_number || '',
    latitude: branch?.latitude || null,
    longitude: branch?.longitude || null,
    google_maps_url: branch?.google_maps_url || '',
    is_headquarters: branch?.is_headquarters || false,
    is_active: branch?.is_active ?? true,
    operating_hours: branch?.operating_hours || {
      monday: { open: '09:00', close: '18:00', enabled: true },
      tuesday: { open: '09:00', close: '18:00', enabled: true },
      wednesday: { open: '09:00', close: '18:00', enabled: true },
      thursday: { open: '09:00', close: '18:00', enabled: true },
      friday: { open: '09:00', close: '18:00', enabled: true },
      saturday: { open: '09:00', close: '14:00', enabled: true },
      sunday: { open: '09:00', close: '14:00', enabled: false },
    },
  });

  const [activeTab, setActiveTab] = useState<'info' | 'hours' | 'location'>('info');

  // Auto-generate slug from name
  useEffect(() => {
    if (!branch?.id && formData.name) {
      const slug = formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, branch?.id]);

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                {icons.clinic}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {branch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                </h3>
                <p className="text-sm text-gray-500">
                  Configura la información de la sucursal
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Inner Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { key: 'info', label: 'Información' },
              { key: 'hours', label: 'Horarios' },
              { key: 'location', label: 'Ubicación GPS' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  activeTab === tab.key
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nombre de la Sucursal *"
                  placeholder="Ej: ESVA Nogales"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Input
                  label="Slug (URL)"
                  placeholder="esva-nogales"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ciudad *"
                  placeholder="Ej: Nogales"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
                <Input
                  label="Estado *"
                  placeholder="Ej: Sonora"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>

              <Input
                label="Dirección completa"
                placeholder="Ej: Av. Obregón #123, Col. Centro"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Teléfono"
                  placeholder="+52 631 123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="WhatsApp"
                  placeholder="+52 631 123 4567"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_headquarters}
                  onChange={(e) => setFormData({ ...formData, is_headquarters: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Sucursal Principal</p>
                  <p className="text-sm text-gray-500">Esta es la sede principal de la clínica</p>
                </div>
              </label>
            </div>
          )}

          {activeTab === 'hours' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Configura los horarios de atención para cada día de la semana
              </p>

              {dayKeys.map((day, idx) => {
                const hours = formData.operating_hours[day] || { open: '09:00', close: '18:00', enabled: false };
                return (
                  <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 w-24">
                      <input
                        type="checkbox"
                        checked={hours.enabled}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            operating_hours: {
                              ...formData.operating_hours,
                              [day]: { ...hours, enabled: e.target.checked },
                            },
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600"
                      />
                      <span className="font-medium text-gray-900">{dayNames[idx]}</span>
                    </label>

                    {hours.enabled && (
                      <>
                        <input
                          type="time"
                          value={hours.open}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              operating_hours: {
                                ...formData.operating_hours,
                                [day]: { ...hours, open: e.target.value },
                              },
                            });
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                        <span className="text-gray-400">a</span>
                        <input
                          type="time"
                          value={hours.close}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              operating_hours: {
                                ...formData.operating_hours,
                                [day]: { ...hours, close: e.target.value },
                              },
                            });
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </>
                    )}

                    {!hours.enabled && (
                      <span className="text-gray-400 text-sm">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Coordenadas GPS:</strong> Son necesarias para que el AI pueda enviar la ubicación
                  exacta por WhatsApp (no solo un link de Google Maps).
                </p>
              </div>

              <Input
                label="Link de Google Maps"
                placeholder="https://maps.google.com/..."
                value={formData.google_maps_url || ''}
                onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                helperText="Pega el link de Google Maps de tu ubicación"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitud *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="31.3159"
                    value={formData.latitude || ''}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitud *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="-110.9559"
                    value={formData.longitude || ''}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>Cómo obtener las coordenadas:</strong>
                </p>
                <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                  <li>Abre Google Maps y busca tu ubicación</li>
                  <li>Haz clic derecho en el punto exacto</li>
                  <li>Copia las coordenadas (primero latitud, luego longitud)</li>
                  <li>Ejemplo: 31.3159, -110.9559 (Nogales, Sonora)</li>
                </ol>
              </div>

              {/* Coordinates for ESVA clinics reference */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Coordenadas de referencia (ESVA Clinic):</p>
                <div className="space-y-2 text-xs text-gray-600">
                  <p>Nogales, Sonora: <code className="bg-gray-200 px-1 rounded">31.3159, -110.9559</code></p>
                  <p>Hermosillo, Sonora: <code className="bg-gray-200 px-1 rounded">29.0729, -110.9559</code></p>
                  <p>Tijuana, Baja California: <code className="bg-gray-200 px-1 rounded">32.5149, -117.0382</code></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={saving}
            disabled={!formData.name || !formData.city || !formData.state}
          >
            {branch ? 'Guardar Cambios' : 'Crear Sucursal'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AIConfiguration;
