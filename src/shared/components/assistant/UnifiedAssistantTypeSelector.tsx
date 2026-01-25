'use client';

// =====================================================
// TIS TIS PLATFORM - Unified Assistant Type Selector
// Componente unificado para seleccionar tipos de asistente
// Funciona para Voice Agent y Messaging Agent
//
// FEATURES:
// - Soporta ambos canales (voice/messaging)
// - Usa tipos unificados de unified-assistant-types.ts
// - Muestra capacidades y herramientas expandibles
// - Maneja deprecación de dental_basic
// - Animaciones suaves con Framer Motion
//
// Sincronizado con:
// - SQL: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
// - Types: src/shared/types/unified-assistant-types.ts
// =====================================================

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import {
  type UnifiedAssistantType,
  type UnifiedAssistantTypeId,
  type Vertical,
  type AssistantChannel,
  type Capability,
  isCapabilityEnabled,
  LEVEL_INFO,
  VERTICAL_INFO,
} from '@/src/shared/types/unified-assistant-types';

// =====================================================
// ICONS
// =====================================================

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const WrenchIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
  </svg>
);

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>
);

function getIconForVertical(vertical: Vertical) {
  switch (vertical) {
    case 'restaurant':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      );
    case 'dental':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8.5 2 6 4 6 7c0 2.5 1 4.5 1 7 0 2.5-.5 5 1 7 1 1.5 2 1 2.5 0 .5-1 1-3 2.5-3s2 2 2.5 3c.5 1 1.5 1.5 2.5 0 1.5-2 1-4.5 1-7 0-2.5 1-4.5 1-7 0-3-2.5-5-6-5z" />
        </svg>
      );
    default:
      return <SparklesIcon className="w-5 h-5" />;
  }
}

// =====================================================
// CAPABILITY LABELS (Spanish)
// =====================================================

/**
 * Etiquetas de capacidades en español
 * SINCRONIZADO CON: src/shared/types/unified-assistant-types.ts (Capability)
 */
const CAPABILITY_LABELS: Record<Capability, string> = {
  // Shared
  business_hours: 'Horarios',
  business_info: 'Info del negocio',
  location_info: 'Ubicación',
  human_transfer: 'Transferir a humano',
  faq: 'Preguntas frecuentes',
  invoicing: 'Facturación',
  leads: 'Captura de leads',
  // Restaurant
  reservations: 'Reservaciones',
  menu_info: 'Info del menú',
  recommendations: 'Recomendaciones',
  orders: 'Pedidos',
  order_status: 'Estado de pedidos',
  promotions: 'Promociones',
  delivery: 'Delivery',
  // Dental
  appointments: 'Citas',
  services_info: 'Info de servicios',
  pricing: 'Precios',
  doctor_info: 'Info de doctores',
  dentist_info: 'Info de dentistas',
  insurance_info: 'Info de seguros',
  appointment_management: 'Gestión de citas',
  emergencies: 'Emergencias',
  emergency_triage: 'Triaje de urgencias',
};

// =====================================================
// TYPES
// =====================================================

interface UnifiedAssistantTypeSelectorProps {
  /** Tipos de asistente disponibles */
  assistantTypes: UnifiedAssistantType[];
  /** Vertical del negocio */
  vertical: Vertical;
  /** Canal de comunicación */
  channel: AssistantChannel;
  /** ID del tipo actualmente guardado */
  currentTypeId: string | null;
  /** ID del tipo pendiente de confirmación */
  pendingTypeId?: string | null;
  /** Callback cuando el usuario selecciona un tipo */
  onTypeChange: (typeId: UnifiedAssistantTypeId) => void;
  /** Deshabilitar interacción */
  disabled?: boolean;
  /** Modo compacto */
  compact?: boolean;
  /** Mostrar lista de features */
  showFeatures?: boolean;
  /** Mostrar botón para expandir capacidades */
  showCapabilitiesExpander?: boolean;
  /** Color scheme */
  colorScheme?: 'coral' | 'purple' | 'green';
  /** Clase CSS adicional */
  className?: string;
}

interface TypeCardProps {
  type: UnifiedAssistantType;
  isSelected: boolean;
  isCurrent: boolean;
  hasPendingChange: boolean;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
  showFeatures?: boolean;
  showCapabilitiesExpander?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colorScheme: 'coral' | 'purple' | 'green';
}

// =====================================================
// TYPE CARD COMPONENT
// =====================================================

function TypeCard({
  type,
  isSelected,
  isCurrent,
  hasPendingChange,
  onSelect,
  disabled,
  compact,
  showFeatures = true,
  showCapabilitiesExpander = true,
  isExpanded,
  onToggleExpand,
  colorScheme,
}: TypeCardProps) {
  const enabledTools = type.availableTools.filter(t => t.enabled);

  const gradientClasses = {
    basic: 'from-slate-500 to-slate-600',
    standard: 'from-tis-coral to-tis-pink',
    complete: 'from-tis-purple to-indigo-600',
  };

  const gradientClass = gradientClasses[type.level] || gradientClasses.standard;

  const colorClasses = {
    coral: {
      selected: 'border-tis-coral ring-tis-coral/20',
      indicator: 'bg-tis-coral',
      feature: 'text-tis-coral',
    },
    purple: {
      selected: 'border-tis-purple ring-tis-purple/20',
      indicator: 'bg-tis-purple',
      feature: 'text-tis-purple',
    },
    green: {
      selected: 'border-tis-green ring-tis-green/20',
      indicator: 'bg-tis-green',
      feature: 'text-tis-green',
    },
  };

  const colors = colorClasses[colorScheme];

  const getBorderClass = () => {
    if (isSelected && hasPendingChange) {
      return `${colors.selected} bg-white shadow-lg ring-2`;
    }
    if (isCurrent && !hasPendingChange) {
      return 'border-tis-green/50 bg-tis-green/5';
    }
    if (isCurrent && hasPendingChange) {
      return 'border-tis-green/30 bg-white';
    }
    return 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md';
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  };

  return (
    <div className="flex flex-col">
      {/* Main Card */}
      <motion.button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={cn(
          'relative w-full text-left rounded-xl border-2 transition-all duration-300 group',
          compact ? 'p-3' : 'p-4',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          getBorderClass(),
          isExpanded && 'rounded-b-none border-b-0'
        )}
        whileHover={!disabled ? { y: -2 } : undefined}
        whileTap={!disabled ? { scale: 0.98 } : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div
            className={cn(
              'rounded-lg flex items-center justify-center text-white shadow-md',
              `bg-gradient-to-br ${gradientClass}`,
              compact ? 'w-9 h-9' : 'w-10 h-10'
            )}
          >
            {getIconForVertical(type.vertical)}
          </div>

          <div className="flex flex-col gap-1 items-end">
            {/* Channel badge */}
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
              type.channel === 'voice'
                ? 'text-blue-700 bg-blue-100'
                : 'text-emerald-700 bg-emerald-100'
            )}>
              {type.channel === 'voice' ? (
                <><PhoneIcon className="w-3 h-3" /> Voz</>
              ) : (
                <><ChatIcon className="w-3 h-3" /> Mensaje</>
              )}
            </span>

            {type.isRecommended && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full">
                <SparklesIcon className="w-3 h-3" />
                Recomendado
              </span>
            )}
            {isCurrent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-tis-green bg-tis-green/10 rounded-full">
                <CheckIcon className="w-3 h-3" />
                Actual
              </span>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <h4 className={cn('font-bold text-slate-900', compact ? 'text-sm' : 'text-base')}>
          {type.displayName}
        </h4>
        <p className={cn('text-slate-500 mt-0.5 line-clamp-2', compact ? 'text-xs' : 'text-sm')}>
          {type.description}
        </p>

        {/* Features list */}
        {showFeatures && !compact && type.features.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {type.features.slice(0, 4).map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-xs">
                <CheckIcon
                  className={cn(
                    'w-3.5 h-3.5 mt-0.5 flex-shrink-0',
                    isSelected ? colors.feature : 'text-tis-green'
                  )}
                />
                <span className="text-slate-600">{feature}</span>
              </li>
            ))}
            {type.features.length > 4 && (
              <li className="text-xs text-slate-400 pl-5">
                +{type.features.length - 4} más...
              </li>
            )}
          </ul>
        )}

        {/* Selection indicator */}
        <AnimatePresence>
          {isSelected && hasPendingChange && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className={cn('absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center', colors.indicator)}
            >
              <CheckIcon className="w-3 h-3 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer with stats */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{LEVEL_INFO[type.level].displayName}</span>
            {type.maxCallDurationSeconds && (
              <span>{type.maxCallDurationSeconds / 60} min</span>
            )}
          </div>

          {/* Capabilities/Tools count badges */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
              <ZapIcon className="w-3 h-3" />
              {type.enabledCapabilities.length}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
              <WrenchIcon className="w-3 h-3" />
              {enabledTools.length}
            </span>
          </div>
        </div>
      </motion.button>

      {/* Expand/Collapse Button */}
      {showCapabilitiesExpander && !compact && (
        <button
          type="button"
          onClick={handleExpandClick}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all duration-200',
            'rounded-b-xl border-2 border-t-0 border-slate-200',
            isExpanded
              ? 'bg-slate-100 text-slate-700'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          )}
        >
          {isExpanded ? (
            <>
              <ChevronUpIcon className="w-4 h-4" />
              Ocultar capacidades
            </>
          ) : (
            <>
              <ChevronDownIcon className="w-4 h-4" />
              Ver capacidades ({type.enabledCapabilities.length})
            </>
          )}
        </button>
      )}

      {/* Expandable Capabilities Panel */}
      <AnimatePresence>
        {isExpanded && !compact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-slate-50 border-2 border-t-0 border-slate-200 rounded-b-xl">
              {/* Capabilities Section */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <ZapIcon className="w-4 h-4 text-tis-coral" />
                  <span className="text-sm font-semibold text-slate-700">
                    Capacidades ({type.enabledCapabilities.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {type.enabledCapabilities.map((cap) => (
                    <span
                      key={cap}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-lg"
                    >
                      <CheckIcon className="w-3 h-3" />
                      {CAPABILITY_LABELS[cap] || cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tools Section */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <WrenchIcon className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-slate-700">
                    Herramientas ({enabledTools.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {enabledTools.map((tool) => (
                    <span
                      key={tool.name}
                      className="inline-flex items-center px-2 py-1 text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded"
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function UnifiedAssistantTypeSelector({
  assistantTypes,
  vertical,
  channel,
  currentTypeId,
  pendingTypeId,
  onTypeChange,
  disabled = false,
  compact = false,
  showFeatures = true,
  showCapabilitiesExpander = true,
  colorScheme = 'coral',
  className,
}: UnifiedAssistantTypeSelectorProps) {
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

  // Filter types for this vertical and channel
  const filteredTypes = useMemo(() => {
    return assistantTypes
      .filter(t => t.vertical === vertical && t.channel === channel && t.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [assistantTypes, vertical, channel]);

  // Determine if there's a pending change
  const hasPendingChange = pendingTypeId !== null && pendingTypeId !== undefined && pendingTypeId !== currentTypeId;

  // The visually "selected" type is pending if exists, otherwise current
  const visuallySelectedTypeId = hasPendingChange ? pendingTypeId : currentTypeId;

  const handleSelectType = useCallback((typeId: UnifiedAssistantTypeId) => {
    if (disabled) return;
    if (typeId === visuallySelectedTypeId) return;
    onTypeChange(typeId);
  }, [disabled, visuallySelectedTypeId, onTypeChange]);

  const handleToggleExpand = useCallback((typeId: string) => {
    setExpandedTypeId((prev) => (prev === typeId ? null : typeId));
  }, []);

  // Determine grid columns based on number of types
  const gridCols = filteredTypes.length <= 2
    ? 'grid-cols-1 md:grid-cols-2'
    : 'grid-cols-1 md:grid-cols-3';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Type cards grid */}
      <div className={cn('grid gap-4', compact ? 'grid-cols-3' : gridCols)}>
        {filteredTypes.map((type) => (
          <TypeCard
            key={type.id}
            type={type}
            isSelected={visuallySelectedTypeId === type.id}
            isCurrent={currentTypeId === type.id}
            hasPendingChange={hasPendingChange}
            onSelect={() => handleSelectType(type.id)}
            disabled={disabled}
            compact={compact}
            showFeatures={showFeatures}
            showCapabilitiesExpander={showCapabilitiesExpander}
            isExpanded={expandedTypeId === type.id}
            onToggleExpand={() => handleToggleExpand(type.id)}
            colorScheme={colorScheme}
          />
        ))}
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex items-center justify-center gap-4 pt-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ZapIcon className="w-3.5 h-3.5 text-tis-coral" />
            <span>Capacidades</span>
          </div>
          <div className="flex items-center gap-1.5">
            <WrenchIcon className="w-3.5 h-3.5 text-violet-500" />
            <span>Herramientas</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredTypes.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <p>No hay tipos de asistente disponibles para esta configuración.</p>
          <p className="text-sm mt-1">
            Vertical: {VERTICAL_INFO[vertical].displayName} | Canal: {channel === 'voice' ? 'Voz' : 'Mensajería'}
          </p>
        </div>
      )}
    </div>
  );
}

export default UnifiedAssistantTypeSelector;
