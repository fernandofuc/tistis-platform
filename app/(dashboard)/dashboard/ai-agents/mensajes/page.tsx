'use client';

// =====================================================
// TIS TIS PLATFORM - Agente de Mensajes Page (Redesigned)
// Tab-based configuration for messaging agents
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/src/features/dashboard';
import { useAgentProfiles } from '@/src/hooks/useAgentProfiles';
import { useTenant } from '@/src/hooks/useTenant';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';
import type { VerticalType } from '@/src/shared/config/agent-templates';
import type { AgentProfileInput } from '@/src/shared/types/agent-profiles';
import { getDefaultTemplate } from '@/src/shared/config/agent-templates';

// Import tab components
import {
  AgentMessagesTabs,
  type AgentMessagesTabKey,
  ResumenTab,
  BusinessProfileTab,
  PersonalProfileTab,
  AdvancedTab,
} from './components';

// ======================
// AI MODEL CONFIG
// ======================
const AI_MODEL_NAME = 'GPT-5 Mini';

// ======================
// TOGGLE SWITCH COMPONENT - Professional Style (Matches Loyalty Page)
// ======================
interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}

function ToggleSwitch({ enabled, onToggle, loading }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
        enabled ? 'bg-tis-coral' : 'bg-slate-200',
        loading && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ======================
// AI AGENT TOGGLE CARD - Full Width (Matches Base Conocimiento Style)
// ======================
interface AIAgentToggleCardProps {
  aiEnabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}

function AIAgentToggleCard({ aiEnabled, onToggle, loading }: AIAgentToggleCardProps) {
  return (
    <div className={cn(
      'relative rounded-2xl border p-5 transition-all duration-200',
      aiEnabled
        ? 'border-slate-200 bg-white shadow-sm'
        : 'border-slate-200/80 bg-slate-50/50'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all',
            aiEnabled
              ? 'bg-slate-900 text-white'
              : 'bg-slate-200 text-slate-400'
          )}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">AI Agent Activo</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {aiEnabled
                ? `Usando ${AI_MODEL_NAME} para mensajería`
                : 'Las conversaciones serán atendidas manualmente'}
            </p>
            <div className="mt-2.5">
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                aiEnabled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  aiEnabled ? 'bg-emerald-500' : 'bg-slate-400'
                )} />
                {aiEnabled ? 'Activo' : 'Desactivado'}
              </span>
            </div>
          </div>
        </div>
        <ToggleSwitch enabled={aiEnabled} onToggle={onToggle} loading={loading} />
      </div>
    </div>
  );
}

// ======================
// COMPONENT
// ======================

export default function AgenteMensajesPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { vertical } = useVerticalTerminology();
  const {
    business,
    personal,
    loading: profilesLoading,
    error,
    createProfile,
    updateProfile,
    toggleProfile,
    refresh,
  } = useAgentProfiles();

  const [activeTab, setActiveTab] = useState<AgentMessagesTabKey>('resumen');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI Agent toggle state
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [aiConfigLoading, setAiConfigLoading] = useState<boolean>(true);
  const [aiToggleLoading, setAiToggleLoading] = useState<boolean>(false);

  // Separate loading states: AI config card loads independently from tabs
  const tabsLoading = tenantLoading || profilesLoading;
  const showPersonalTab = vertical === 'dental';

  // ===== FETCH AI CONFIG ON MOUNT =====
  useEffect(() => {
    const fetchAiConfig = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setAiConfigLoading(false);
          return;
        }

        const response = await fetch('/api/ai-config', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAiEnabled(data.ai_enabled ?? true);
        }
      } catch (err) {
        console.error('Error fetching AI config:', err);
      } finally {
        setAiConfigLoading(false);
      }
    };

    fetchAiConfig();
  }, []);

  // ===== TOGGLE AI HANDLER =====
  const handleToggleAI = useCallback(async () => {
    const newState = !aiEnabled;
    setAiEnabled(newState); // Optimistic update
    setAiToggleLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAiEnabled(!newState); // Revert
        setAiToggleLoading(false);
        return;
      }

      const response = await fetch('/api/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ai_enabled: newState }),
      });

      if (!response.ok) {
        setAiEnabled(!newState); // Revert on error
        console.error('Error toggling AI');
      } else {
        showSuccess(newState ? 'AI Agent activado' : 'AI Agent desactivado');
      }
    } catch (err) {
      setAiEnabled(!newState); // Revert on error
      console.error('Error toggling AI:', err);
    } finally {
      setAiToggleLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiEnabled]);

  // Show success message temporarily
  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  // ===== BUSINESS PROFILE HANDLERS =====

  const handleSaveBusinessProfile = useCallback(async (data: AgentProfileInput): Promise<boolean> => {
    try {
      if (business) {
        // Update existing profile
        const success = await updateProfile('business', data);
        if (success) {
          await refresh();
          showSuccess('Perfil de negocio actualizado');
          return true;
        }
      } else {
        // Create new profile
        const success = await createProfile('business', {
          ...data,
          is_active: true,
        });
        if (success) {
          await refresh();
          showSuccess('Perfil de negocio creado');
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error saving business profile:', err);
      return false;
    }
  }, [business, updateProfile, createProfile, refresh, showSuccess]);

  // ===== PERSONAL PROFILE HANDLERS =====

  const handleSavePersonalProfile = useCallback(async (data: AgentProfileInput): Promise<boolean> => {
    try {
      if (personal) {
        const success = await updateProfile('personal', data);
        if (success) {
          await refresh();
          showSuccess('Perfil personal actualizado');
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error saving personal profile:', err);
      return false;
    }
  }, [personal, updateProfile, refresh, showSuccess]);

  const handleActivatePersonal = useCallback(async () => {
    if (!tenant) return;

    try {
      const defaultTemplate = getDefaultTemplate((vertical || 'general') as VerticalType, 'personal');
      const success = await createProfile('personal', {
        profile_name: `${tenant.name || 'Mi'} Personal`,
        agent_template: defaultTemplate?.key || 'general_personal',
        response_style: 'professional_friendly',
        response_delay_minutes: 8,
        is_active: true,
      });

      if (success) {
        await refresh();
        showSuccess('Perfil personal activado');
      }
    } catch (err) {
      console.error('Error creating personal profile:', err);
    }
  }, [tenant, vertical, createProfile, refresh, showSuccess]);

  const handleTogglePersonal = useCallback(async (isActive: boolean) => {
    try {
      const success = await toggleProfile('personal', isActive);
      if (success) {
        await refresh();
        showSuccess(isActive ? 'Perfil personal activado' : 'Perfil personal desactivado');
      }
    } catch (err) {
      console.error('Error toggling personal profile:', err);
    }
  }, [toggleProfile, refresh, showSuccess]);

  // ===== ADVANCED SETTINGS HANDLER =====

  const handleSaveAdvancedSettings = useCallback(async (data: Partial<AgentProfileInput>): Promise<boolean> => {
    try {
      if (business) {
        // Merge settings with existing profile data
        const mergedData = {
          profile_name: business.profile_name,
          agent_template: business.agent_template,
          response_style: business.response_style,
          ...data,
          settings: {
            ...business.settings,
            ...data.settings,
          },
        };

        const success = await updateProfile('business', mergedData);
        if (success) {
          await refresh();
          showSuccess('Configuración avanzada guardada');
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error saving advanced settings:', err);
      return false;
    }
  }, [business, updateProfile, refresh, showSuccess]);

  // ===== TAB NAVIGATION HANDLERS =====

  const handleEditBusiness = useCallback(() => {
    setActiveTab('negocio');
  }, []);

  const handleEditPersonal = useCallback(() => {
    setActiveTab('personal');
  }, []);

  return (
    <PageWrapper
      title="Agente de Mensajes"
      subtitle="Configura cómo responde tu asistente en canales de mensajería"
    >
      <div className="max-w-5xl mx-auto">
        {/* Success Message Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <div className="text-red-500 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-red-800">Error al cargar perfiles</h4>
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={refresh}
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-800"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* AI Agent Toggle Card - Full Width, Above Tabs (Like Base Conocimiento) */}
        {aiConfigLoading ? (
          <div className="mb-6 h-24 bg-slate-100 rounded-2xl animate-pulse" />
        ) : (
          <div className="mb-6">
            <AIAgentToggleCard
              aiEnabled={aiEnabled}
              onToggle={handleToggleAI}
              loading={aiToggleLoading}
            />
          </div>
        )}

        {/* Tab Navigation */}
        <AgentMessagesTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showPersonalTab={showPersonalTab}
        />

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'resumen' && (
              <ResumenTab
                businessProfile={business}
                personalProfile={personal}
                tenantName={tenant?.name}
                vertical={vertical || 'general'}
                isLoading={tabsLoading}
                onEditBusiness={handleEditBusiness}
                onEditPersonal={handleEditPersonal}
              />
            )}

            {activeTab === 'negocio' && (
              <BusinessProfileTab
                profile={business}
                vertical={(vertical || 'general') as VerticalType}
                tenantName={tenant?.name}
                isLoading={tabsLoading}
                onSave={handleSaveBusinessProfile}
              />
            )}

            {activeTab === 'personal' && showPersonalTab && (
              <PersonalProfileTab
                profile={personal}
                vertical={(vertical || 'general') as VerticalType}
                tenantName={tenant?.name}
                isLoading={tabsLoading}
                onSave={handleSavePersonalProfile}
                onActivate={handleActivatePersonal}
                onToggleActive={handleTogglePersonal}
              />
            )}

            {activeTab === 'avanzado' && (
              <AdvancedTab
                businessProfile={business}
                isLoading={tabsLoading}
                onSave={handleSaveAdvancedSettings}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
