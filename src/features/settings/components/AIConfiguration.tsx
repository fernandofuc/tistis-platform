// =====================================================
// TIS TIS PLATFORM - AI Configuration Component
// Configure AI assistant behavior and clinic information
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Input } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { updateTenant, type UpdateTenantData } from '@/src/features/auth/services/authService';
import { cn } from '@/src/shared/utils';
import { KnowledgeBase } from './KnowledgeBase';
import { ServicePriorityConfig } from './ServicePriorityConfig';

// ======================
// TYPES
// ======================

// Los modelos son gestionados internamente por TIS TIS, no por los clientes
// - Chat Discovery: gpt-5-nano (ultra rápido y económico)
// - Mensajería Auto: gpt-5-mini (balance calidad/costo)
// - Voz VAPI: gpt-4o (optimizado para audio)

// AIConfig type must match database schema exactly (ai_tenant_config table)
interface AIConfig {
  id?: string;
  tenant_id: string;
  ai_enabled: boolean;
  ai_model?: string;
  ai_personality: 'professional' | 'professional_friendly' | 'casual' | 'formal';
  ai_temperature: number;
  max_tokens: number;
  custom_instructions?: string;
  escalation_keywords: string[];
  out_of_hours_enabled?: boolean;
  out_of_hours_message?: string;
  auto_greeting_enabled?: boolean;
  auto_greeting_message?: string;
  max_turns_before_escalation: number;
  escalate_on_hot_lead?: boolean;
  supported_languages?: string[];
  default_language?: string;
  currency?: string;
  currency_format?: string;
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
  display_name: string | null;
  email: string;
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

interface SubscriptionInfo {
  plan: string;
  max_branches: number;
  current_branches: number;
  can_add_branch: boolean;
  next_branch_price: number;
  currency: string;
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
  brain: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
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
  const [activeSection, setActiveSection] = useState<'general' | 'clinic' | 'knowledge' | 'scoring' | 'escalation'>('general');

  // AI Config State - must match database schema exactly
  const [config, setConfig] = useState<AIConfig>({
    tenant_id: tenant?.id || '',
    ai_enabled: true,
    ai_personality: 'professional_friendly',
    ai_temperature: 0.7,
    max_tokens: 500,
    escalation_keywords: ['queja', 'molesto', 'enojado', 'gerente', 'supervisor'],
    max_turns_before_escalation: 10,
    escalate_on_hot_lead: true,
    out_of_hours_enabled: true,
    auto_greeting_enabled: true,
    supported_languages: ['es', 'en'],
    default_language: 'es',
  });

  // Clinic Data State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffBranches, setStaffBranches] = useState<StaffBranch[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);

  // UI-only state (not saved to database)
  const [enableScoring, setEnableScoring] = useState(true);

  // Modal States
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showStaffModal, setShowStaffModal] = useState(false);

  // Business Identity Edit State
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityForm, setIdentityForm] = useState({
    name: '',
    legal_name: '',
    primary_contact_phone: '',
  });
  const [identityError, setIdentityError] = useState<string | null>(null);

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

      // Load staff - filter out empty records at DB level
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .in('role', ['dentist', 'specialist', 'owner', 'manager'])
        .or('first_name.neq.,last_name.neq.,display_name.neq.');

      if (staffData) {
        // Additional client-side filter as safety net
        const validStaff = staffData.filter(s =>
          (s.first_name && s.first_name.trim() !== '') ||
          (s.last_name && s.last_name.trim() !== '') ||
          (s.display_name && s.display_name.trim() !== '')
        );
        setStaff(validStaff);
      }

      // Load staff-branch assignments
      const { data: sbData } = await supabase
        .from('staff_branches')
        .select('*');

      if (sbData) {
        setStaffBranches(sbData);
      }

      // Load scoring rules
      const { data: rules, error: rulesError } = await supabase
        .from('ai_scoring_rules')
        .select('*')
        .eq('is_active', true)
        .order('points', { ascending: false });

      if (rulesError) {
        console.log('🟡 AI scoring rules table may not exist:', rulesError.message);
        // Table might not exist yet - this is OK
      } else if (rules) {
        // Filter to show only tenant-specific or global rules
        // Also normalize keywords to always be an array
        const filteredRules = rules
          .filter((rule: ScoringRule) => rule.tenant_id === tenant.id || rule.tenant_id === null)
          .map((rule: ScoringRule) => ({
            ...rule,
            keywords: Array.isArray(rule.keywords) ? rule.keywords : []
          }));
        setScoringRules(filteredRules);
      }

      // Load subscription info for branch limits
      try {
        const subRes = await fetch('/api/stripe/update-subscription');
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscriptionInfo(subData.data || null);
        }
      } catch (err) {
        console.log('Subscription info not available');
      }

      setLoading(false);
    };

    loadConfig();
  }, [tenant?.id]);

  // Helper to get auth headers
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // Save AI configuration via API
  const saveConfig = async () => {
    if (!tenant?.id) return;

    setSaving(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/ai-config', {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error saving config:', result.error);
        alert(`Error al guardar: ${result.error}`);
      } else {
        // Update local state with saved data
        if (result.data) {
          setConfig(prev => ({ ...prev, ...result.data }));
        }
        console.log('✅ Configuración guardada correctamente');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  // Save branch via API
  const saveBranch = async (branchData: Partial<Branch>) => {
    if (!tenant?.id) return;

    setSaving(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/settings/branches', {
        method: 'POST',
        headers,
        body: JSON.stringify(branchData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error saving branch:', result.error);
        alert(`Error al guardar: ${result.error}`);
      } else {
        // Reload branches from API
        const reloadResponse = await fetch('/api/settings/branches', { headers });
        const reloadResult = await reloadResponse.json();
        if (reloadResult.data) {
          setBranches(reloadResult.data.filter((b: Branch) => b.is_active));
        }
        setShowBranchModal(false);
        setEditingBranch(null);
        console.log('✅ Sucursal guardada correctamente');
      }
    } catch (error) {
      console.error('Error saving branch:', error);
      alert('Error al guardar la sucursal');
    } finally {
      setSaving(false);
    }
  };

  // Toggle AI enabled via API
  const toggleAI = async () => {
    const newState = !config.ai_enabled;
    setConfig({ ...config, ai_enabled: newState });

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/ai-config', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...config, ai_enabled: newState }),
      });

      if (!response.ok) {
        // Revert on error
        setConfig({ ...config, ai_enabled: !newState });
        const result = await response.json();
        console.error('Error toggling AI:', result.error);
      }
    } catch (error) {
      // Revert on error
      setConfig({ ...config, ai_enabled: !newState });
      console.error('Error toggling AI:', error);
    }
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

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.ai_enabled}
                  onChange={toggleAI}
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
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
              { key: 'knowledge', label: 'Base de Conocimiento', icon: icons.brain },
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

              {/* Business Identity - Datos del Tenant */}
              <div className="p-4 bg-white rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Identidad del Negocio
                  </h4>
                  {!isEditingIdentity && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIdentityForm({
                          name: tenant?.name || '',
                          legal_name: tenant?.legal_name || '',
                          primary_contact_phone: tenant?.primary_contact_phone || '',
                        });
                        setIdentityError(null);
                        setIsEditingIdentity(true);
                      }}
                    >
                      {icons.edit}
                      <span className="ml-1">Editar</span>
                    </Button>
                  )}
                </div>

                {/* Error Message */}
                {identityError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{identityError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombre Comercial - EDITABLE */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Comercial
                    </label>
                    {isEditingIdentity ? (
                      <input
                        type="text"
                        value={identityForm.name}
                        onChange={(e) => setIdentityForm({ ...identityForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Nombre de tu negocio"
                      />
                    ) : (
                      <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        {tenant?.name || 'No configurado'}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">El AI usa este nombre para identificar tu negocio</p>
                  </div>

                  {/* Razón Social - EDITABLE */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Razón Social
                      <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                    </label>
                    {isEditingIdentity ? (
                      <input
                        type="text"
                        value={identityForm.legal_name}
                        onChange={(e) => setIdentityForm({ ...identityForm, legal_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Razón social para facturas"
                      />
                    ) : (
                      <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        {tenant?.legal_name || 'No configurado'}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Nombre legal para facturas y documentos</p>
                  </div>

                  {/* Email de Contacto - READONLY (crítico) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      Email de Contacto
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </label>
                    <p className="text-gray-900 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                      {tenant?.primary_contact_email || 'No configurado'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Vinculado a tu cuenta y facturación. Contacta soporte para cambiarlo.
                    </p>
                  </div>

                  {/* Teléfono Principal - EDITABLE */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono Principal
                      <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                    </label>
                    {isEditingIdentity ? (
                      <input
                        type="tel"
                        value={identityForm.primary_contact_phone}
                        onChange={(e) => setIdentityForm({ ...identityForm, primary_contact_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="+52 55 1234 5678"
                      />
                    ) : (
                      <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        {tenant?.primary_contact_phone || 'No configurado'}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Teléfono de contacto principal del negocio</p>
                  </div>
                </div>

                {/* Action Buttons when Editing */}
                {isEditingIdentity && (
                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingIdentity(false);
                        setIdentityError(null);
                      }}
                      disabled={savingIdentity}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={async () => {
                        setSavingIdentity(true);
                        setIdentityError(null);

                        const result = await updateTenant({
                          name: identityForm.name,
                          legal_name: identityForm.legal_name,
                          primary_contact_phone: identityForm.primary_contact_phone,
                        });

                        if (result.success) {
                          // Refresh the page to get updated tenant data
                          window.location.reload();
                        } else {
                          setIdentityError(result.error || 'Error al guardar');
                          setSavingIdentity(false);
                        }
                      }}
                      isLoading={savingIdentity}
                    >
                      Guardar Cambios
                    </Button>
                  </div>
                )}

                {/* Info note - only when NOT editing */}
                {!isEditingIdentity && (
                  <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Puedes editar el nombre, razón social y teléfono. El email está protegido por seguridad.
                  </p>
                )}
              </div>

              {/* Branches List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Sucursales ({branches.length}{subscriptionInfo ? `/${subscriptionInfo.max_branches}` : ''})
                    </h4>
                    {subscriptionInfo && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Plan {subscriptionInfo.plan?.toUpperCase()} • {subscriptionInfo.max_branches - branches.length} disponibles
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingBranch(null);
                      setShowBranchModal(true);
                    }}
                    disabled={subscriptionInfo ? branches.length >= subscriptionInfo.max_branches : false}
                  >
                    {icons.plus}
                    <span className="ml-2">Agregar Sucursal</span>
                  </Button>
                </div>

                {/* Branch Limit Banner */}
                {subscriptionInfo && branches.length >= subscriptionInfo.max_branches && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-medium text-amber-900">
                        Has alcanzado el límite de sucursales
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Tu plan {subscriptionInfo.plan?.toUpperCase()} incluye hasta {subscriptionInfo.max_branches} sucursales.
                        {subscriptionInfo.next_branch_price > 0 && (
                          <> Para agregar una sucursal extra, el costo es de ${subscriptionInfo.next_branch_price.toLocaleString()} MXN/mes.</>
                        )}
                      </p>
                      {subscriptionInfo.next_branch_price > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => {
                            window.open('/dashboard/billing?action=add-branch', '_blank');
                          }}
                        >
                          Agregar Sucursal Extra (+${subscriptionInfo.next_branch_price.toLocaleString()}/mes)
                        </Button>
                      )}
                    </div>
                  </div>
                )}

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
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Doctors Summary */}
              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Doctores / Especialistas ({staff.length})</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingStaff(null);
                      setShowStaffModal(true);
                    }}
                  >
                    {icons.plus}
                    <span className="ml-2">Agregar Doctor</span>
                  </Button>
                </div>

                {staff.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl">
                    <p className="text-gray-500">No hay doctores registrados</p>
                    <p className="text-sm text-gray-400">Agrega doctores para asignarlos a sucursales</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {staff
                      .filter((member) => member.first_name?.trim() || member.last_name?.trim() || member.display_name?.trim())
                      .map((member) => {
                      const memberBranches = staffBranches
                        .filter(sb => sb.staff_id === member.id)
                        .map(sb => branches.find(b => b.id === sb.branch_id)?.name)
                        .filter(Boolean);

                      return (
                        <div key={member.id} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-purple-600 font-medium">
                                  {(member.first_name?.[0] || '').toUpperCase()}{(member.last_name?.[0] || '').toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  Dr. {member.display_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Sin nombre'}
                                </p>
                                {member.specialty && (
                                  <p className="text-sm text-gray-500">{member.specialty}</p>
                                )}
                                {memberBranches.length > 0 ? (
                                  <p className="text-xs text-purple-600 mt-1">
                                    {memberBranches.join(', ')}
                                  </p>
                                ) : (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Sin sucursal asignada
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setEditingStaff(member);
                                setShowStaffModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg"
                            >
                              {icons.edit}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Knowledge Base */}
          {activeSection === 'knowledge' && (
            <div className="p-6">
              <KnowledgeBase />
            </div>
          )}

          {/* Scoring Configuration */}
          {activeSection === 'scoring' && (
            <div className="p-6 space-y-6">
              {/* Header con Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Sistema de Puntuación de Leads</h4>
                  <p className="text-sm text-gray-500">
                    El AI detecta señales de intención de compra y clasifica automáticamente tus leads
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={enableScoring}
                    onChange={(e) => setEnableScoring(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Explicación del Sistema */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-purple-900 mb-1">¿Cómo funciona?</h4>
                    <p className="text-sm text-purple-700">
                      Cuando un cliente escribe por WhatsApp, el AI analiza sus mensajes y detecta señales de interés.
                      Cada señal suma puntos que clasifican al lead como <strong>HOT</strong>, <strong>WARM</strong> o <strong>COLD</strong>,
                      permitiéndote priorizar a quienes tienen mayor probabilidad de conversión.
                    </p>
                  </div>
                </div>
              </div>

              {enableScoring && (
                <div className="space-y-4">
                  {/* Sistema de Clasificación */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Sistema de Clasificación</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <Badge variant="hot" size="sm">HOT</Badge>
                        </div>
                        <p className="text-2xl font-bold text-red-700">80+</p>
                        <p className="text-xs text-red-600">puntos</p>
                        <p className="text-sm text-red-700 mt-2">Alta intención de compra. Prioridad máxima.</p>
                      </div>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                          <Badge variant="warning" size="sm">WARM</Badge>
                        </div>
                        <p className="text-2xl font-bold text-amber-700">40-79</p>
                        <p className="text-xs text-amber-600">puntos</p>
                        <p className="text-sm text-amber-700 mt-2">Interés moderado. Requiere seguimiento.</p>
                      </div>
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                          <Badge variant="info" size="sm">COLD</Badge>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">0-39</p>
                        <p className="text-xs text-blue-600">puntos</p>
                        <p className="text-sm text-blue-700 mt-2">Solo explorando. Nutrir con información.</p>
                      </div>
                    </div>
                  </div>

                  {/* Reglas de Puntuación */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Señales Detectadas ({scoringRules.length} reglas activas)
                    </p>
                    {scoringRules.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                          {icons.check}
                        </div>
                        <p className="text-gray-500">Sistema de puntuación con reglas por defecto</p>
                        <p className="text-sm text-gray-400 mt-1">Las reglas globales de TIS TIS están activas automáticamente</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {scoringRules.map((rule) => (
                          <div
                            key={rule.id}
                            className={cn(
                              'flex items-center justify-between p-4 rounded-xl border transition-colors',
                              rule.points > 0
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            )}
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{rule.signal_name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Detecta: {Array.isArray(rule.keywords) ? rule.keywords.slice(0, 4).join(', ') : 'Regla configurada'}
                                {Array.isArray(rule.keywords) && rule.keywords.length > 4 && ` (+${rule.keywords.length - 4} más)`}
                              </p>
                            </div>
                            <div className={cn(
                              'px-3 py-1.5 rounded-lg font-bold text-sm',
                              rule.points > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            )}>
                              {rule.points > 0 ? '+' : ''}{rule.points} pts
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Nota informativa */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600">
                      <strong>Nota:</strong> Las reglas de puntuación están optimizadas por TIS TIS para tu industria.
                      El sistema detecta automáticamente palabras clave como &quot;urgente&quot;, &quot;precio&quot;, &quot;agendar cita&quot;,
                      &quot;disponibilidad&quot; y ajusta el score del lead en tiempo real.
                    </p>
                  </div>

                  {/* Separador */}
                  <div className="border-t border-gray-200 pt-6 mt-6">
                    <h4 className="font-medium text-gray-900 mb-2">Prioridad por Servicio</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Clasifica tus servicios para determinar automáticamente la prioridad del lead cuando muestre interés
                    </p>
                    <ServicePriorityConfig />
                  </div>
                </div>
              )}

              {!enableScoring && (
                <div className="p-6 bg-gray-50 rounded-xl text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">Puntuación Desactivada</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Activa el sistema para clasificar automáticamente tus leads por nivel de interés
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Escalation Settings */}
          {activeSection === 'escalation' && (
            <div className="p-6 space-y-6">
              {/* Header Explicativo */}
              <div>
                <h4 className="font-medium text-gray-900">Sistema de Escalamiento Inteligente</h4>
                <p className="text-sm text-gray-500">
                  Configura cuándo el AI debe transferir la conversación a un humano
                </p>
              </div>

              {/* Explicación del Sistema */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-amber-900 mb-1">¿Qué es el Escalamiento?</h4>
                    <p className="text-sm text-amber-700">
                      El escalamiento transfiere automáticamente la conversación de WhatsApp del AI a tu equipo humano
                      cuando detecta situaciones que requieren atención personal: clientes molestos, emergencias,
                      oportunidades de venta calientes, o cuando el cliente solicita hablar con una persona.
                    </p>
                  </div>
                </div>
              </div>

              {/* Triggers Automáticos - Siempre Activos */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Triggers de Escalamiento Automático
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Lead HOT */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-red-900">Servicio HOT Detectado</p>
                        <Badge variant="hot" size="sm">Alto Valor</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-red-700">
                      Cuando el lead muestra interés en un servicio de alta prioridad (implantes, ortodoncia, etc.),
                      se escala para que tu equipo cierre la venta.
                    </p>
                  </div>

                  {/* Solicitud de Humano */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-blue-900">Solicitud de Humano</p>
                        <Badge variant="info" size="sm">Automático</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-blue-700">
                      Cuando el cliente pide explícitamente hablar con una persona, asesor o gerente.
                    </p>
                  </div>

                  {/* Emergencia Médica */}
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-purple-900">Emergencia / Dolor</p>
                        <Badge variant="default" size="sm">Prioridad Alta</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-purple-700">
                      Detecta palabras como &quot;emergencia&quot;, &quot;dolor fuerte&quot;, &quot;urgente&quot; para atención inmediata.
                    </p>
                  </div>

                  {/* Límite de Mensajes */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Límite de Mensajes</p>
                        <Badge variant="default" size="sm">Configurable</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Conversaciones largas sin conversión se escalan para evitar frustración del cliente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Configuración de Límite de Mensajes */}
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-gray-900">Escalar por Conversación Larga</p>
                    <p className="text-sm text-gray-500">
                      Número de mensajes antes de escalar automáticamente
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { value: 5, label: '5 mensajes', desc: 'Rápido' },
                    { value: 10, label: '10 mensajes', desc: 'Recomendado' },
                    { value: 15, label: '15 mensajes', desc: 'Moderado' },
                    { value: 20, label: '20 mensajes', desc: 'Paciente' },
                    { value: 0, label: 'Nunca', desc: 'Desactivado' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setConfig({ ...config, max_turns_before_escalation: option.value })}
                      className={cn(
                        'p-3 rounded-xl border-2 text-center transition-all',
                        config.max_turns_before_escalation === option.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <p className="font-bold text-gray-900">{option.value === 0 ? '∞' : option.value}</p>
                      <p className="text-xs text-gray-500">{option.desc}</p>
                    </button>
                  ))}
                </div>
                {config.max_turns_before_escalation > 0 && (
                  <p className="text-sm text-gray-500 mt-3">
                    Después de <strong>{config.max_turns_before_escalation} mensajes</strong> sin conversión,
                    la conversación se transferirá a tu equipo.
                  </p>
                )}
                {config.max_turns_before_escalation === 0 && (
                  <p className="text-sm text-amber-600 mt-3">
                    El escalamiento por límite de mensajes está desactivado. Los otros triggers siguen activos.
                  </p>
                )}
              </div>

              {/* Palabras Clave de Escalamiento */}
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="mb-4">
                  <p className="font-medium text-gray-900">Palabras Clave de Escalamiento</p>
                  <p className="text-sm text-gray-500">
                    El AI escalará inmediatamente si detecta estas palabras en los mensajes del cliente
                  </p>
                </div>

                {/* Tags de Keywords */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {config.escalation_keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => {
                          const newKeywords = config.escalation_keywords.filter((_, i) => i !== idx);
                          setConfig({ ...config, escalation_keywords: newKeywords });
                        }}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  {config.escalation_keywords.length === 0 && (
                    <span className="text-gray-400 text-sm">No hay palabras clave configuradas</span>
                  )}
                </div>

                {/* Input para agregar */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Agregar palabra clave..."
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget;
                        const value = input.value.trim().toLowerCase();
                        if (value && !config.escalation_keywords.includes(value)) {
                          setConfig({
                            ...config,
                            escalation_keywords: [...config.escalation_keywords, value],
                          });
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Agregar palabra clave..."]') as HTMLInputElement;
                      if (input) {
                        const value = input.value.trim().toLowerCase();
                        if (value && !config.escalation_keywords.includes(value)) {
                          setConfig({
                            ...config,
                            escalation_keywords: [...config.escalation_keywords, value],
                          });
                          input.value = '';
                        }
                      }
                    }}
                  >
                    {icons.plus}
                  </Button>
                </div>

                {/* Sugerencias */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Sugerencias comunes:</p>
                  <div className="flex flex-wrap gap-2">
                    {['queja', 'molesto', 'enojado', 'gerente', 'supervisor', 'demanda', 'abogado', 'cancelar', 'reembolso', 'denuncia'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          if (!config.escalation_keywords.includes(suggestion)) {
                            setConfig({
                              ...config,
                              escalation_keywords: [...config.escalation_keywords, suggestion],
                            });
                          }
                        }}
                        disabled={config.escalation_keywords.includes(suggestion)}
                        className={cn(
                          'px-2 py-1 text-xs rounded-lg border transition-colors',
                          config.escalation_keywords.includes(suggestion)
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                        )}
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Integración con Puntuación */}
              {enableScoring && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-green-900">Integración con Lead Scoring</p>
                      <p className="text-sm text-green-700">
                        El sistema de puntuación está <strong>activo</strong>. Los leads que alcancen 80+ puntos (HOT)
                        serán escalados automáticamente para maximizar las conversiones.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!enableScoring && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {icons.warning}
                    </div>
                    <div>
                      <p className="font-medium text-amber-900">Lead Scoring Desactivado</p>
                      <p className="text-sm text-amber-700">
                        El sistema de puntuación está desactivado. El escalamiento por lead HOT no funcionará.
                        Actívalo en la pestaña &quot;Puntuación&quot; para maximizar conversiones.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nota Final */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600">
                  <strong>Nota:</strong> Cuando se escala una conversación, recibirás una notificación en el dashboard
                  y la conversación aparecerá destacada en tu bandeja de entrada. El AI informará al cliente que
                  un asesor humano tomará la conversación.
                </p>
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

      {/* Staff Modal */}
      {showStaffModal && tenant && (
        <StaffModal
          staff={editingStaff}
          branches={branches}
          staffBranches={staffBranches}
          tenantId={tenant.id}
          onClose={() => {
            setShowStaffModal(false);
            setEditingStaff(null);
          }}
          onSave={async () => {
            // Reload staff and staff_branches data
            const { data: staffData } = await supabase
              .from('staff')
              .select('*')
              .eq('tenant_id', tenant.id)
              .order('first_name');

            const { data: staffBranchesData } = await supabase
              .from('staff_branches')
              .select('*');

            if (staffData) setStaff(staffData);
            if (staffBranchesData) setStaffBranches(staffBranchesData);
          }}
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
}

function BranchCard({ branch, staff, onEdit }: BranchCardProps) {
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

        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
        >
          {icons.edit}
          <span className="ml-2">Editar</span>
        </Button>
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

// ======================
// STAFF MODAL COMPONENT
// ======================

interface StaffModalProps {
  staff: Staff | null;
  branches: Branch[];
  staffBranches: StaffBranch[];
  tenantId: string;
  onClose: () => void;
  onSave: () => void;
}

function StaffModal({ staff, branches, staffBranches, tenantId, onClose, onSave }: StaffModalProps) {
  const isEditing = !!staff;

  const [formData, setFormData] = useState({
    first_name: staff?.first_name || '',
    last_name: staff?.last_name || '',
    email: staff?.email || '',
    specialty: staff?.specialty || '',
    license_number: staff?.license_number || '',
    role: staff?.role || 'dentist',
    is_active: staff?.is_active ?? true,
  });

  // Get currently assigned branches for this staff member
  const currentBranchIds = staffBranches
    .filter(sb => sb.staff_id === staff?.id)
    .map(sb => sb.branch_id);

  const [selectedBranches, setSelectedBranches] = useState<string[]>(currentBranchIds);
  const [saving, setSaving] = useState(false);

  // Helper to get auth headers for API calls
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      alert('Nombre y apellido son requeridos');
      return;
    }

    if (!formData.email || !formData.email.includes('@')) {
      alert('Email válido es requerido');
      return;
    }

    setSaving(true);

    try {
      const headers = await getAuthHeaders();

      const payload = {
        id: staff?.id,
        ...formData,
        branchAssignments: selectedBranches,
      };

      const response = await fetch('/api/settings/staff', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || 'Error desconocido';
        if (errorMessage.includes('row-level security') || errorMessage.includes('policy')) {
          alert('Error de permisos: No tienes autorización para realizar esta acción. Contacta al administrador.');
        } else if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate')) {
          alert('Este doctor ya está asignado a esa sucursal.');
        } else {
          alert(`Error al guardar: ${errorMessage}`);
        }
        return;
      }

      console.log('✅ Doctor guardado correctamente');
      onSave();
      onClose();
    } catch (error: unknown) {
      console.error('Error saving staff:', error);
      alert('Error al guardar el doctor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!staff?.id) return;

    if (!confirm('¿Estás seguro de eliminar este doctor? Esta acción no se puede deshacer.')) {
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/settings/staff?id=${staff.id}`, {
        method: 'DELETE',
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || 'Error desconocido';
        if (errorMessage.includes('row-level security') || errorMessage.includes('policy')) {
          alert('Error de permisos: No tienes autorización para eliminar este doctor.');
        } else {
          alert(`Error al eliminar: ${errorMessage}`);
        }
        return;
      }

      console.log('✅ Doctor eliminado correctamente');
      onSave();
      onClose();
    } catch (error: unknown) {
      console.error('Error deleting staff:', error);
      alert('Error al eliminar el doctor');
    } finally {
      setSaving(false);
    }
  };

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Editar Doctor' : 'Agregar Doctor'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {isEditing ? 'Modifica los datos del doctor' : 'Registra un nuevo doctor o especialista'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              placeholder="Ej: Juan"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            />
            <Input
              label="Apellido *"
              placeholder="Ej: Pérez"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            />
          </div>

          {/* Email Field */}
          <Input
            label="Email *"
            type="email"
            placeholder="Ej: doctor@clinica.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          {/* Specialty & License */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Especialidad"
              placeholder="Ej: Ortodoncia"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            />
            <Input
              label="Cédula Profesional"
              placeholder="Ej: 12345678"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="dentist">Dentista / Doctor</option>
              <option value="specialist">Especialista</option>
              <option value="assistant">Asistente</option>
              <option value="receptionist">Recepcionista</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
            </select>
          </div>

          {/* Branch Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sucursales Asignadas
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Selecciona las sucursales donde trabaja este doctor
            </p>

            {branches.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-xl text-center">
                <p className="text-amber-700 text-sm">
                  No hay sucursales configuradas. Agrega sucursales primero.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {branches.map((branch) => (
                  <label
                    key={branch.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border',
                      selectedBranches.includes(branch.id)
                        ? 'bg-purple-50 border-purple-300'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBranches.includes(branch.id)}
                      onChange={() => toggleBranch(branch.id)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{branch.name}</p>
                      <p className="text-sm text-gray-500">{branch.city}, {branch.state}</p>
                    </div>
                    {branch.is_headquarters && (
                      <Badge variant="info" size="sm">Principal</Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Active Status */}
          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <p className="font-medium text-gray-900">Doctor Activo</p>
              <p className="text-sm text-gray-500">Aparecerá en las opciones de asignación</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between">
          {isEditing ? (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={saving}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Eliminar
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Agregar Doctor')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIConfiguration;
