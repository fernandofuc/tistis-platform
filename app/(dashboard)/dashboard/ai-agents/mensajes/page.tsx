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

  const isLoading = tenantLoading || profilesLoading || aiConfigLoading;
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
                isLoading={isLoading}
                onEditBusiness={handleEditBusiness}
                onEditPersonal={handleEditPersonal}
                // AI Agent Toggle props
                aiEnabled={aiEnabled}
                aiToggleLoading={aiToggleLoading}
                onToggleAI={handleToggleAI}
              />
            )}

            {activeTab === 'negocio' && (
              <BusinessProfileTab
                profile={business}
                vertical={(vertical || 'general') as VerticalType}
                tenantName={tenant?.name}
                isLoading={isLoading}
                onSave={handleSaveBusinessProfile}
              />
            )}

            {activeTab === 'personal' && showPersonalTab && (
              <PersonalProfileTab
                profile={personal}
                vertical={(vertical || 'general') as VerticalType}
                tenantName={tenant?.name}
                isLoading={isLoading}
                onSave={handleSavePersonalProfile}
                onActivate={handleActivatePersonal}
                onToggleActive={handleTogglePersonal}
              />
            )}

            {activeTab === 'avanzado' && (
              <AdvancedTab
                businessProfile={business}
                isLoading={isLoading}
                onSave={handleSaveAdvancedSettings}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
