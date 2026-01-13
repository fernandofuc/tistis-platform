'use client';

// =====================================================
// TIS TIS PLATFORM - Mis Agentes de IA Landing Page
// Página de inicio que muestra resumen y navegación a sub-secciones
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

import Link from 'next/link';
import { motion } from 'framer-motion';
import { PageWrapper } from '@/src/features/dashboard';
import { useTenant } from '@/src/hooks/useTenant';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import { useAgentProfiles } from '@/src/hooks/useAgentProfiles';
import { cn } from '@/src/shared/utils';

// ======================
// ICONS
// ======================

const icons = {
  messages: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  phone: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  config: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  arrow: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  robot: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
};

// ======================
// AGENT CARD COMPONENT
// ======================

interface AgentCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status?: 'active' | 'inactive' | 'configuring';
  stats?: { label: string; value: string | number }[];
  gradient: string;
  delay?: number;
}

function AgentCard({ title, description, icon, href, status, stats, gradient, delay = 0 }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Link
        href={href}
        className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all duration-300 overflow-hidden"
      >
        <div className={cn("p-6", gradient)}>
          <div className="flex items-start justify-between">
            <div className="p-3 bg-white/90 rounded-xl shadow-sm text-gray-700">
              {icon}
            </div>
            {status && (
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold",
                status === 'active' && "bg-green-100 text-green-700",
                status === 'inactive' && "bg-gray-100 text-gray-600",
                status === 'configuring' && "bg-amber-100 text-amber-700"
              )}>
                {status === 'active' ? 'Activo' : status === 'inactive' ? 'Inactivo' : 'Configurando'}
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-tis-coral transition-colors">
              {title}
            </h3>
            <span className="text-gray-400 group-hover:text-tis-coral group-hover:translate-x-1 transition-all">
              {icons.arrow}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">{description}</p>
          {stats && stats.length > 0 && (
            <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center">
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export default function MisAgentesPage() {
  const { tenant } = useTenant();
  const { vertical, terminology } = useVerticalTerminology();
  const { business, personal, loading: profilesLoading } = useAgentProfiles();

  // Determine status based on profiles
  const messagesStatus = business?.is_active ? 'active' : business ? 'inactive' : 'configuring';

  return (
    <PageWrapper
      title="Mis Agentes de IA"
      subtitle="Gestiona todos tus asistentes virtuales desde un solo lugar"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-xl"
        >
          <div className="flex items-start gap-5">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              {icons.robot}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-3">Bienvenido a Mis Agentes</h1>
              <p className="text-white/80 leading-relaxed max-w-2xl">
                Tus asistentes de IA están listos para atender a tus {terminology.patients.toLowerCase()} 24/7.
                Configura cada agente según tus necesidades y deja que la inteligencia artificial
                trabaje por ti.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Agente Mensajes */}
          <AgentCard
            title="Agente de Mensajes"
            description="Responde automáticamente en WhatsApp, Instagram, Facebook y TikTok"
            icon={icons.messages}
            href="/dashboard/ai-agents/mensajes"
            status={messagesStatus}
            gradient="bg-gradient-to-br from-blue-50 to-indigo-100"
            delay={0.1}
            stats={
              business
                ? [
                    { label: 'Perfiles', value: vertical === 'dental' && personal ? 2 : 1 },
                  ]
                : undefined
            }
          />

          {/* Agente Voz */}
          <AgentCard
            title="Agente de Voz"
            description="Asistente telefónico que atiende llamadas con voz natural"
            icon={icons.phone}
            href="/dashboard/ai-agents/voz"
            gradient="bg-gradient-to-br from-teal-50 to-emerald-100"
            delay={0.2}
          />

          {/* Configuración */}
          <AgentCard
            title="Configuración"
            description="Base de conocimiento, servicios, sucursales y políticas"
            icon={icons.config}
            href="/dashboard/ai-agents/configuracion"
            gradient="bg-gradient-to-br from-amber-50 to-orange-100"
            delay={0.3}
          />
        </div>

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-6 border border-gray-200"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Primeros pasos recomendados</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-tis-coral/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-tis-coral">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Configura tu Base de Conocimiento</p>
                <p className="text-xs text-gray-500">Define servicios, precios y horarios</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-tis-coral/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-tis-coral">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Activa el Agente de Mensajes</p>
                <p className="text-xs text-gray-500">Conecta tus canales de mensajería</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-tis-coral/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-tis-coral">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Configura el Agente de Voz</p>
                <p className="text-xs text-gray-500">Obtén un número telefónico con IA</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
