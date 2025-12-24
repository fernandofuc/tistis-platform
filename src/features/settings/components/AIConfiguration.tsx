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
import { ServiceCatalogConfig } from './ServiceCatalogConfig';
import { ChannelAISettings } from './ChannelAISettings';
import {
  CHANNEL_METADATA,
  PERSONALITY_METADATA,
  type ChannelConnection,
  type ChannelType,
} from '../types/channels.types';

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

interface SubscriptionInfo {
  plan: string;
  max_branches: number;        // Sucursales contratadas (Essentials=8, Growth=20)
  current_branches: number;    // Sucursales CONTRATADAS inicialmente
  plan_limit: number;          // Límite absoluto del plan
  can_add_branch: boolean;
  can_add_extra: boolean;      // Puede agregar extra con cargo
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
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  brain: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  catalog: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  channels: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
};

const responseStyles = [
  {
    value: 'professional',
    label: 'Profesional',
    desc: 'Formal y directo',
    example: '"La limpieza dental tiene un costo de $800. El procedimiento dura 45 minutos. ¿Desea agendar una cita?"'
  },
  {
    value: 'professional_friendly',
    label: 'Profesional Cálido',
    desc: 'Formal pero amigable',
    example: '"Con gusto le informo que la limpieza dental tiene un costo de $800 MXN e incluye revisión completa. ¿Le gustaría agendar una cita?"',
    recommended: true
  },
  {
    value: 'casual',
    label: 'Casual',
    desc: 'Informal y cercano',
    example: '"Claro que sí, la limpieza te sale en $800 y tardamos como 45 mins. ¿Quieres que te aparte un espacio?"'
  },
  {
    value: 'formal',
    label: 'Muy Formal',
    desc: 'Extremadamente profesional',
    example: '"Estimado/a paciente, le informo que el procedimiento de profilaxis dental tiene un costo de $800.00 MXN. Quedamos a sus órdenes."'
  },
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
  const [activeSection, setActiveSection] = useState<'general' | 'channels' | 'clinic' | 'knowledge' | 'scoring' | 'catalog'>('general');

  // Channel AI configuration state
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [showChannelAIModal, setShowChannelAIModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelConnection | null>(null);

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
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);

  // Modal States
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deletingBranchLoading, setDeletingBranchLoading] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<Staff | null>(null);
  const [deletingStaffLoading, setDeletingStaffLoading] = useState(false);

  // Business Identity Edit State
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);

  // Prompt Generation State
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
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

      // Load channel connections for AI configuration
      const { data: channelsData } = await supabase
        .from('channel_connections')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('channel', { ascending: true });

      if (channelsData) {
        setChannels(channelsData);
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

      // Load subscription info for branch limits
      try {
        // Get auth token for API call
        const { data: { session } } = await supabase.auth.getSession();
        const authHeaders: HeadersInit = {};
        if (session?.access_token) {
          authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        }

        const subRes = await fetch('/api/branches/add-extra', {
          headers: authHeaders,
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          // Límites por plan
          const planLimits: Record<string, number> = {
            starter: 1,
            essentials: 5,
            growth: 8,
            scale: 15,
          };
          const plan = subData.plan || 'starter';
          const planLimit = planLimits[plan] || 1;

          // Map the response to SubscriptionInfo format
          setSubscriptionInfo({
            plan: plan,
            max_branches: subData.max_branches || 1,       // Lo que tiene contratado
            current_branches: subData.current_branches || 1, // Sucursales contratadas
            plan_limit: planLimit,                           // Límite máximo del plan
            can_add_branch: subData.current_branches < subData.max_branches, // Dentro del contrato
            can_add_extra: subData.can_add_extra && subData.max_branches < planLimit, // Puede comprar extra
            next_branch_price: subData.extra_branch_price || 0,
            currency: subData.currency || 'MXN',
          });
        } else {
          console.log('Subscription info response not ok:', subRes.status);
        }
      } catch (err) {
        console.log('Subscription info not available:', err);
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

  // Handle delete branch
  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;

    setDeletingBranchLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/branches?id=${deletingBranch.id}`, {
        method: 'DELETE',
        headers,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || data.error || 'Error al eliminar sucursal');
        return;
      }

      // Remove branch from local state
      setBranches(prev => prev.filter(b => b.id !== deletingBranch.id));
      setDeletingBranch(null);
    } catch (error) {
      console.error('Error deleting branch:', error);
      alert('Error al eliminar sucursal');
    } finally {
      setDeletingBranchLoading(false);
    }
  };

  // Handle delete staff/doctor
  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;

    setDeletingStaffLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/settings/staff?id=${deletingStaff.id}`, {
        method: 'DELETE',
        headers,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || data.error || 'Error al eliminar doctor');
        return;
      }

      // Remove staff from local state
      setStaff(prev => prev.filter(s => s.id !== deletingStaff.id));
      // Also remove staff_branches associations
      setStaffBranches(prev => prev.filter(sb => sb.staff_id !== deletingStaff.id));
      setDeletingStaff(null);
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Error al eliminar doctor');
    } finally {
      setDeletingStaffLoading(false);
    }
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
              { key: 'channels', label: 'AI por Canal', icon: icons.channels },
              { key: 'clinic', label: 'Clínica y Sucursales', icon: icons.clinic },
              { key: 'catalog', label: 'Catálogo de Servicios', icon: icons.catalog },
              { key: 'knowledge', label: 'Base de Conocimiento', icon: icons.brain },
              { key: 'scoring', label: 'Clasificación', icon: icons.check },
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

              {/* Estilo de Respuesta del AI - Con Ejemplos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Estilo de Respuesta del AI
                  </label>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    Sin emojis en respuestas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {responseStyles.map((style) => {
                    const isSelected = config.ai_personality === style.value;
                    return (
                      <button
                        key={style.value}
                        onClick={() => setConfig({ ...config, ai_personality: style.value as typeof config.ai_personality })}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all relative',
                          isSelected
                            ? 'border-purple-500 bg-purple-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              'font-semibold',
                              isSelected ? 'text-purple-900' : 'text-gray-900'
                            )}>
                              {style.label}
                            </p>
                            {'recommended' in style && style.recommended && (
                              <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                Recomendado
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <p className={cn(
                          'text-sm mb-3',
                          isSelected ? 'text-purple-700' : 'text-gray-500'
                        )}>
                          {style.desc}
                        </p>

                        {/* Example */}
                        <div className={cn(
                          'p-3 rounded-lg text-xs leading-relaxed',
                          isSelected
                            ? 'bg-purple-100/50 text-purple-800 border border-purple-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        )}>
                          <span className={cn(
                            'font-medium block mb-1',
                            isSelected ? 'text-purple-600' : 'text-gray-500'
                          )}>
                            Ejemplo de respuesta:
                          </span>
                          <span className="italic">{style.example}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Info Note */}
                <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-gray-600">
                    El AI mantiene un tono profesional y <strong>no utiliza emojis</strong> en sus respuestas para proyectar una imagen seria y confiable.
                    Solo responderá con emojis si el cliente los utiliza primero en la conversación.
                  </p>
                </div>
              </div>

              {/* Generate Prompt with AI Section */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-purple-900 mb-1">Generar Instrucciones con IA</h4>
                    <p className="text-sm text-purple-700 mb-3">
                      Usa Gemini 3.0 para generar automáticamente instrucciones personalizadas basadas en la información
                      de tu negocio (sucursales, servicios, equipo, políticas y FAQs).
                    </p>
                    <Button
                      onClick={async () => {
                        setGeneratingPrompt(true);
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session?.access_token) {
                            alert('No autenticado. Por favor, vuelve a iniciar sesión.');
                            return;
                          }
                          const response = await fetch('/api/ai-config/generate-prompt', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${session.access_token}`,
                              'Content-Type': 'application/json',
                            },
                          });
                          const result = await response.json();
                          if (result.success && result.prompt) {
                            setConfig(prev => ({ ...prev, custom_instructions: result.prompt }));
                            alert(`Instrucciones generadas exitosamente en ${(result.processing_time_ms / 1000).toFixed(1)}s usando ${result.model}`);
                          } else {
                            alert('Error: ' + (result.error || 'No se pudo generar el prompt'));
                          }
                        } catch (error) {
                          console.error('Error generating prompt:', error);
                          alert('Error al generar instrucciones');
                        } finally {
                          setGeneratingPrompt(false);
                        }
                      }}
                      isLoading={generatingPrompt}
                      variant="secondary"
                      className="bg-purple-600 hover:bg-purple-700 text-white border-0"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generar con Gemini 3.0
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* AI per Channel Settings */}
          {activeSection === 'channels' && (
            <div className="p-6 space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {icons.channels}
                  </div>
                  <div>
                    <h4 className="font-medium text-green-900 mb-1">Configuración de AI por Canal</h4>
                    <p className="text-sm text-green-700">
                      Personaliza cómo responde el AI en cada canal conectado. Puedes ajustar la personalidad,
                      tiempos de respuesta e instrucciones específicas para cada cuenta de WhatsApp, Instagram, Facebook o TikTok.
                    </p>
                  </div>
                </div>
              </div>

              {/* Connected Channels Grid */}
              {channels.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    {icons.channels}
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">No hay canales conectados</h4>
                  <p className="text-gray-500 text-sm mb-4">
                    Conecta WhatsApp, Instagram, Facebook o TikTok para configurar el AI por canal.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/dashboard/settings?tab=channels'}
                  >
                    Ir a Canales
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group channels by type */}
                  {(['whatsapp', 'instagram', 'facebook', 'tiktok'] as ChannelType[]).map((channelType) => {
                    const channelAccounts = channels.filter(c => c.channel === channelType);
                    if (channelAccounts.length === 0) return null;

                    const metadata = CHANNEL_METADATA[channelType];

                    return (
                      <div key={channelType} className="space-y-3">
                        {/* Channel Type Header */}
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center',
                            metadata.bgColor
                          )}>
                            <ChannelTypeIcon type={channelType} className={cn('w-5 h-5', metadata.textColor)} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{metadata.name}</h4>
                            <p className="text-sm text-gray-500">{channelAccounts.length} cuenta{channelAccounts.length > 1 ? 's' : ''} conectada{channelAccounts.length > 1 ? 's' : ''}</p>
                          </div>
                        </div>

                        {/* Channel Accounts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-13">
                          {channelAccounts.map((channel) => {
                            const personality = channel.ai_personality_override
                              ? PERSONALITY_METADATA[channel.ai_personality_override]
                              : null;
                            const isConnected = channel.status === 'connected';

                            return (
                              <div
                                key={channel.id}
                                className={cn(
                                  'p-4 bg-white rounded-xl border transition-all',
                                  isConnected
                                    ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                    : 'border-gray-200 opacity-60'
                                )}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-medium text-gray-900">{channel.account_name}</h5>
                                      {channel.is_personal_brand && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                          Personal
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Cuenta #{channel.account_number}
                                    </p>
                                  </div>
                                  <span className={cn(
                                    'px-2 py-1 rounded-full text-xs font-medium',
                                    isConnected
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-500'
                                  )}>
                                    {isConnected ? 'Conectado' : channel.status}
                                  </span>
                                </div>

                                {/* AI Settings Summary */}
                                {isConnected && (
                                  <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-gray-500">Personalidad:</span>
                                      <span className="font-medium text-gray-900">
                                        {personality ? `${personality.emoji} ${personality.name}` : 'Global (heredada)'}
                                      </span>
                                    </div>
                                    {channel.first_message_delay_seconds > 0 && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">Delay 1er mensaje:</span>
                                        <span className="font-medium text-gray-900">
                                          {Math.floor(channel.first_message_delay_seconds / 60)}min
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-gray-500">AI:</span>
                                      <span className={cn(
                                        'font-medium',
                                        channel.ai_enabled ? 'text-green-600' : 'text-gray-400'
                                      )}>
                                        {channel.ai_enabled ? 'Activo' : 'Desactivado'}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Configure Button */}
                                {isConnected && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                      setSelectedChannel(channel);
                                      setShowChannelAIModal(true);
                                    }}
                                  >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Configurar AI
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Note about global settings */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Configuración heredada</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Los canales sin configuración específica heredan la personalidad y ajustes del tab &quot;General&quot;.
                          Puedes personalizar cada canal individualmente para tener diferentes tonos según la plataforma.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                        Plan {subscriptionInfo.plan?.toUpperCase()} • {Math.max(0, subscriptionInfo.max_branches - branches.length)} disponibles
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
                    disabled={subscriptionInfo ? branches.length >= subscriptionInfo.plan_limit : false}
                  >
                    {icons.plus}
                    <span className="ml-2">Agregar Sucursal</span>
                  </Button>
                </div>

                {/* Branch Limit Banner - Alcanzó el límite contratado pero puede agregar extra */}
                {subscriptionInfo && branches.length >= subscriptionInfo.max_branches && subscriptionInfo.max_branches < subscriptionInfo.plan_limit && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-medium text-amber-900">
                        Has alcanzado el límite de sucursales
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Tu plan {subscriptionInfo.plan?.toUpperCase()} incluye hasta {subscriptionInfo.plan_limit} sucursales.
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
                            window.location.href = '/dashboard/settings/subscription';
                          }}
                        >
                          Agregar Sucursal Extra (+${subscriptionInfo.next_branch_price.toLocaleString()}/mes)
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Branch Plan Limit Banner - Alcanzó el límite máximo del plan, debe subir de plan */}
                {subscriptionInfo && branches.length >= subscriptionInfo.plan_limit && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-medium text-red-900">
                        Has alcanzado el límite máximo de tu plan
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        Tu plan {subscriptionInfo.plan?.toUpperCase()} permite máximo {subscriptionInfo.plan_limit} sucursales.
                        Para agregar más sucursales, necesitas actualizar a un plan superior.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 border-red-300 text-red-800 hover:bg-red-100"
                        onClick={() => {
                          window.location.href = '/dashboard/settings/subscription';
                        }}
                      >
                        Subir de Plan
                      </Button>
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
                        onDelete={() => setDeletingBranch(branch)}
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
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingStaff(member);
                                  setShowStaffModal(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar doctor"
                              >
                                {icons.edit}
                              </button>
                              <button
                                onClick={() => setDeletingStaff(member)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar doctor"
                              >
                                {icons.trash}
                              </button>
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

          {/* Knowledge Base */}
          {activeSection === 'knowledge' && (
            <div className="p-6">
              <KnowledgeBase />
            </div>
          )}

          {/* Catálogo de Servicios */}
          {activeSection === 'catalog' && (
            <div className="p-6">
              <ServiceCatalogConfig />
            </div>
          )}

          {/* Clasificación y Escalamiento - Sistema basado en Servicios */}
          {activeSection === 'scoring' && (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <h4 className="font-medium text-gray-900">Clasificación de Leads por Servicio</h4>
                <p className="text-sm text-gray-500">
                  Los leads se clasifican automáticamente según el servicio que les interesa
                </p>
              </div>

              {/* Explicación del Nuevo Sistema */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-purple-900 mb-1">¿Cómo funciona?</h4>
                    <p className="text-sm text-purple-700">
                      Cuando un lead muestra interés en un servicio específico, se clasifica automáticamente según
                      la prioridad que hayas asignado a ese servicio. Los servicios de alto valor (implantes, ortodoncia)
                      generan leads <strong>HOT</strong>, mientras que servicios básicos (limpieza) generan leads <strong>COLD</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sistema de Clasificación - Sin puntos */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Niveles de Clasificación</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <Badge variant="hot" size="sm">HOT</Badge>
                    </div>
                    <p className="text-sm font-medium text-red-900">Servicios de Alto Valor</p>
                    <p className="text-xs text-red-700 mt-1">Implantes, Ortodoncia, Carillas, Rehabilitación</p>
                    <p className="text-sm text-red-700 mt-2">→ Escalamiento automático para cierre de venta</p>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <Badge variant="warning" size="sm">WARM</Badge>
                    </div>
                    <p className="text-sm font-medium text-amber-900">Servicios Moderados</p>
                    <p className="text-xs text-amber-700 mt-1">Endodoncia, Coronas, Blanqueamiento, Resinas</p>
                    <p className="text-sm text-amber-700 mt-2">→ Seguimiento prioritario</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <Badge variant="info" size="sm">COLD</Badge>
                    </div>
                    <p className="text-sm font-medium text-blue-900">Servicios Básicos</p>
                    <p className="text-xs text-blue-700 mt-1">Limpieza, Consulta, Diagnóstico, Radiografías</p>
                    <p className="text-sm text-blue-700 mt-2">→ Nutrir con información</p>
                  </div>
                </div>
              </div>

              {/* Configuración de Servicios */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Configura la Prioridad de tus Servicios</p>
                <ServicePriorityConfig />
              </div>

              {/* Separador visual */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-medium text-gray-900 mb-2">Escalamiento Automático</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Configura cuándo el AI debe transferir la conversación a tu equipo
                </p>
              </div>

              {/* Triggers de Escalamiento */}
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
                      <Badge variant="hot" size="sm">Auto</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-red-700">
                    Cuando el lead pregunta por implantes, ortodoncia u otro servicio HOT.
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
                      <Badge variant="info" size="sm">Auto</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-blue-700">
                    Cuando el cliente pide hablar con una persona o asesor.
                  </p>
                </div>

                {/* Emergencia */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-purple-900">Emergencia / Dolor</p>
                      <Badge variant="default" size="sm">Prioridad</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-purple-700">
                    Detecta &quot;emergencia&quot;, &quot;dolor fuerte&quot;, &quot;urgente&quot;.
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
                    Conversaciones largas sin conversión se escalan automáticamente.
                  </p>
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
                    El AI escalará inmediatamente si detecta estas palabras
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

      {/* Delete Branch Confirmation Modal */}
      {deletingBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600">{icons.trash}</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center">
                ¿Eliminar sucursal?
              </h2>
              <p className="text-gray-500 text-center mt-2">
                Esta acción eliminará <strong>{deletingBranch.name}</strong>.
              </p>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> Los leads, citas y conversaciones de esta sucursal
                  se moverán automáticamente a la Sucursal Principal.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeletingBranch(null)}
                disabled={deletingBranchLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDeleteBranch}
                isLoading={deletingBranchLoading}
              >
                Sí, Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Staff/Doctor Confirmation Modal */}
      {deletingStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600">{icons.trash}</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center">
                ¿Eliminar doctor?
              </h2>
              <p className="text-gray-500 text-center mt-2">
                Esta acción eliminará a <strong>Dr. {deletingStaff.display_name || `${deletingStaff.first_name || ''} ${deletingStaff.last_name || ''}`.trim()}</strong> del sistema.
              </p>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Importante:</strong> El doctor será removido de todas las sucursales y sus citas pendientes quedarán sin asignar.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeletingStaff(null)}
                disabled={deletingStaffLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDeleteStaff}
                isLoading={deletingStaffLoading}
              >
                Sí, Eliminar Doctor
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Channel AI Settings Modal */}
      {showChannelAIModal && selectedChannel && (
        <ChannelAISettings
          connection={selectedChannel}
          onClose={() => {
            setShowChannelAIModal(false);
            setSelectedChannel(null);
          }}
          onSaved={(updated) => {
            // Update the channel in local state
            setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
            setShowChannelAIModal(false);
            setSelectedChannel(null);
          }}
        />
      )}
    </div>
  );
}

// ======================
// CHANNEL TYPE ICON COMPONENT
// ======================

function ChannelTypeIcon({ type, className }: { type: ChannelType; className?: string }) {
  switch (type) {
    case 'whatsapp':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    default:
      return null;
  }
}

// ======================
// BRANCH CARD COMPONENT
// ======================

interface BranchCardProps {
  branch: Branch;
  staff: Staff[];
  onEdit: () => void;
  onDelete?: () => void;
}

function BranchCard({ branch, staff, onEdit, onDelete }: BranchCardProps) {
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
          >
            {icons.edit}
            <span className="ml-2">Editar</span>
          </Button>
          {!branch.is_headquarters && onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar sucursal"
            >
              {icons.trash}
            </button>
          )}
        </div>
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
