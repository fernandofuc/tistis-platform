'use client';

// =====================================================
// TIS TIS PLATFORM - Configuración de Agentes IA Page
// Base de conocimiento compartida entre agentes
// Migrado desde Settings > AI Agent
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

import { PageWrapper } from '@/src/features/dashboard';
import { AIConfiguration } from '@/src/features/settings';

// ======================
// COMPONENT
// ======================

export default function ConfiguracionAgentesPage() {
  return (
    <PageWrapper
      title="Configuración de Agentes"
      subtitle="Base de conocimiento compartida entre todos tus agentes de IA"
    >
      <div className="max-w-6xl mx-auto">
        {/* El componente AIConfiguration ya tiene toda la UI necesaria */}
        {/* Incluye: Clínica/Sucursales, Catálogo de Servicios, Base de Conocimiento, Clasificación */}
        <AIConfiguration />
      </div>
    </PageWrapper>
  );
}
