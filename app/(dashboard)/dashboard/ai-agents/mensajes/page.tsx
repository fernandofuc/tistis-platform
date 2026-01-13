'use client';

// =====================================================
// TIS TIS PLATFORM - Agente de Mensajes Page
// Configuración de perfiles Business/Personal para mensajería
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { PageWrapper } from '@/src/features/dashboard';
import { ProfileCard, ProfileConfigModal } from '@/src/features/ai-agents';
import { useAgentProfiles } from '@/src/hooks/useAgentProfiles';
import { useTenant } from '@/src/hooks/useTenant';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import { cn } from '@/src/shared/utils';
import type { ProfileType, VerticalType } from '@/src/shared/config/agent-templates';
import type { AgentProfileInput } from '@/src/shared/types/agent-profiles';
import { getDefaultTemplate } from '@/src/shared/config/agent-templates';

// ======================
// ICONS
// ======================

const icons = {
  robot: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  book: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  arrow: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  messages: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
};

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

  const [configuringProfile, setConfiguringProfile] = useState<ProfileType | null>(null);
  const [creatingPersonal, setCreatingPersonal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingPersonal, setIsTogglingPersonal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isLoading = tenantLoading || profilesLoading;

  // Handle configure profile
  const handleConfigure = useCallback((type: ProfileType) => {
    setConfiguringProfile(type);
  }, []);

  // Handle close modal
  const handleCloseModal = useCallback(() => {
    setConfiguringProfile(null);
  }, []);

  // Show success message temporarily
  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  // Handle save profile configuration
  const handleSaveProfile = useCallback(async (data: AgentProfileInput): Promise<boolean> => {
    if (!configuringProfile) return false;

    setIsSaving(true);
    try {
      const currentProfile = configuringProfile === 'business' ? business : personal;

      if (currentProfile) {
        // Update existing profile
        const success = await updateProfile(configuringProfile, data);
        if (success) {
          await refresh();
          showSuccess('Perfil actualizado correctamente');
          return true;
        }
      } else {
        // Create new profile
        const success = await createProfile(configuringProfile, {
          ...data,
          is_active: true,
        });
        if (success) {
          await refresh();
          showSuccess('Perfil creado correctamente');
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error saving profile:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [configuringProfile, business, personal, updateProfile, createProfile, refresh, showSuccess]);

  // Handle activate personal profile
  const handleActivatePersonal = useCallback(async () => {
    if (!tenant) return;

    setCreatingPersonal(true);
    try {
      const defaultTemplate = getDefaultTemplate((vertical || 'general') as VerticalType, 'personal');
      const success = await createProfile('personal', {
        profile_name: `${tenant.name || 'Mi'} Personal`,
        agent_template: defaultTemplate?.key || 'general_personal',
        response_style: 'professional_friendly',
        response_delay_minutes: 8, // 8 minutes delay for personal
        is_active: true,
      });

      if (success) {
        await refresh();
        showSuccess('Perfil personal activado');
      }
    } catch (err) {
      console.error('Error creating personal profile:', err);
    } finally {
      setCreatingPersonal(false);
    }
  }, [tenant, vertical, createProfile, refresh, showSuccess]);

  // Handle toggle personal profile active state
  const handleTogglePersonal = useCallback(async (isActive: boolean) => {
    setIsTogglingPersonal(true);
    try {
      const success = await toggleProfile('personal', isActive);
      if (success) {
        await refresh();
        showSuccess(isActive ? 'Perfil personal activado' : 'Perfil personal desactivado');
      }
    } catch (err) {
      console.error('Error toggling personal profile:', err);
    } finally {
      setIsTogglingPersonal(false);
    }
  }, [toggleProfile, refresh, showSuccess]);

  return (
    <PageWrapper
      title="Agente de Mensajes"
      subtitle="Configura cómo responde tu asistente en canales de mensajería"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              {icons.messages}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">Agente de Mensajes</h1>
              <p className="text-white/80 text-sm leading-relaxed max-w-xl">
                Configura tus perfiles de respuesta automática para WhatsApp, Instagram, Facebook y TikTok.
                Puedes tener un perfil para tu negocio y otro para tu marca personal.
              </p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
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
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <div className="text-red-500 mt-0.5">
              {icons.info}
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

        {/* Profiles Grid */}
        <div className={cn(
          "grid gap-6",
          // Solo mostrar 2 columnas si hay perfil personal disponible
          vertical === 'dental' ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-2xl mx-auto"
        )}>
          {/* Business Profile */}
          <ProfileCard
            profile={business}
            profileType="business"
            vertical={vertical}
            tenantName={tenant?.name}
            isLoading={isLoading}
            onConfigure={() => handleConfigure('business')}
          />

          {/* Personal Profile - Solo para vertical dental */}
          {vertical === 'dental' && (
            <ProfileCard
              profile={personal}
              profileType="personal"
              vertical={vertical}
              tenantName={tenant?.name}
              isLoading={isLoading}
              isActivating={creatingPersonal}
              isTogglingActive={isTogglingPersonal}
              onConfigure={() => handleConfigure('personal')}
              onActivate={handleActivatePersonal}
              onToggleActive={personal ? handleTogglePersonal : undefined}
            />
          )}
        </div>

        {/* Knowledge Base Quick Access */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                {icons.book}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Base de Conocimiento</h3>
                <p className="text-sm text-gray-500">
                  Configura instrucciones, políticas y plantillas que usan ambos perfiles
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/ai-agents/configuracion"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
            >
              <span>Configurar</span>
              {icons.arrow}
            </Link>
          </div>
        </div>

        {/* Tips Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-start gap-3">
            <div className="text-blue-600">
              {icons.sparkles}
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Consejos para mejores resultados</h4>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong>Perfil de Negocio:</strong> Para las cuentas oficiales de tu {vertical === 'restaurant' ? 'restaurante' : 'clínica'}.
                    Responde de manera profesional y consistente.
                  </span>
                </li>
                {vertical === 'dental' && (
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                    <span>
                      <strong>Perfil Personal:</strong> Para redes sociales del doctor. Tiene delay de respuesta
                      para parecer más humano y no mezclar consultas médicas.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <span>
                    <strong>Base de Conocimiento:</strong> Define servicios, precios, horarios y políticas.
                    El asistente usará esta información para responder.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Configuration Modal */}
      <ProfileConfigModal
        isOpen={configuringProfile !== null}
        onClose={handleCloseModal}
        profile={configuringProfile === 'business' ? business : personal}
        profileType={configuringProfile || 'business'}
        vertical={(vertical || 'general') as VerticalType}
        onSave={handleSaveProfile}
        isSaving={isSaving}
      />
    </PageWrapper>
  );
}
