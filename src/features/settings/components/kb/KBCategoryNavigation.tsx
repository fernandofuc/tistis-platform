// =====================================================
// TIS TIS PLATFORM - KB Category Navigation
// Premium category navigation with semantic naming
// Part of Knowledge Base Redesign - FASE 2
// =====================================================

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================
// ARQUITECTURA V7: Instrucciones y Plantillas ahora se gestionan en Mis Agentes → Agente Mensajes
// Solo mantenemos: Políticas, Información/Artículos, y Competencia en Base de Conocimiento
export type KBCategory = 'policies' | 'articles' | 'competitors';

interface CategoryConfig {
  id: KBCategory;
  label: string;
  semanticName: string;
  description: string;
  icon: React.ReactNode;
  color: {
    gradient: string;
    bg: string;
    text: string;
    border: string;
    iconBg: string;
  };
  tooltip: string;
}

interface Props {
  activeCategory: KBCategory;
  onCategoryChange: (category: KBCategory) => void;
  counts: Record<KBCategory, number>;
  className?: string;
  variant?: 'tabs' | 'cards';
}

// ======================
// CATEGORY CONFIGURATIONS
// ======================
// ARQUITECTURA V7: Solo 3 categorías (Políticas, Información, Competencia)
// Instrucciones y Plantillas se gestionan en Mis Agentes → Agente Mensajes
const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 'policies',
    label: 'Políticas',
    semanticName: 'Reglas del Negocio',
    description: 'Normas y políticas que debe comunicar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: {
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-100',
    },
    tooltip: 'Cancelaciones, pagos, garantías, horarios',
  },
  {
    id: 'articles',
    label: 'Información',
    semanticName: 'Saber del Negocio',
    description: 'Conocimiento profundo de tu empresa',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    color: {
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
    },
    tooltip: 'Historia, diferenciadores, tecnología, equipo',
  },
  {
    id: 'competitors',
    label: 'Competencia',
    semanticName: 'Saber Competir',
    description: 'Estrategia frente a competidores',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: {
      gradient: 'from-rose-500 to-pink-600',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      iconBg: 'bg-rose-100',
    },
    tooltip: 'Cómo destacar cuando mencionan competidores',
  },
];

// ======================
// TAB ITEM
// ======================
function TabItem({
  config,
  isActive,
  count,
  onClick,
}: {
  config: CategoryConfig;
  isActive: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: isActive ? 1 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl transition-all duration-200',
        isActive
          ? `bg-gradient-to-r ${config.color.gradient} text-white shadow-lg`
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
      style={{
        boxShadow: isActive ? `0 10px 30px -10px ${config.color.gradient.includes('violet') ? 'rgba(139, 92, 246, 0.4)' :
          config.color.gradient.includes('emerald') ? 'rgba(16, 185, 129, 0.4)' :
          config.color.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.4)' :
          config.color.gradient.includes('amber') ? 'rgba(245, 158, 11, 0.4)' : 'rgba(244, 63, 94, 0.4)'}` : undefined
      }}
    >
      {/* Icon */}
      <motion.div
        animate={{ scale: isActive ? 1.1 : 1, rotate: isActive ? 5 : 0 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {config.icon}
      </motion.div>

      {/* Label - Hide on mobile */}
      <span className="font-medium text-sm hidden sm:block">
        {config.label}
      </span>

      {/* Count Badge */}
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              'text-xs font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full',
              isActive
                ? 'bg-white/25 text-white'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Active indicator line */}
      {isActive && (
        <motion.div
          layoutId="activeTabIndicator"
          className="absolute inset-0 rounded-xl -z-10"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

// ======================
// CARD ITEM (Alternative view)
// ======================
function CardItem({
  config,
  isActive,
  count,
  onClick,
}: {
  config: CategoryConfig;
  isActive: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-4 rounded-xl border-2 transition-all duration-200 text-left group',
        isActive
          ? `border-transparent bg-gradient-to-br ${config.color.gradient} text-white shadow-lg`
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}
    >
      {/* Top row: Icon + Count */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          isActive ? 'bg-white/20' : config.color.iconBg
        )}>
          <span className={isActive ? '' : config.color.text}>
            {config.icon}
          </span>
        </div>

        {count > 0 && (
          <span className={cn(
            'text-sm font-bold px-2 py-0.5 rounded-full',
            isActive
              ? 'bg-white/20 text-white'
              : 'bg-gray-100 text-gray-600'
          )}>
            {count}
          </span>
        )}
      </div>

      {/* Semantic Name */}
      <h4 className={cn(
        'font-semibold text-sm mb-1',
        isActive ? 'text-white' : 'text-gray-900'
      )}>
        {config.semanticName}
      </h4>

      {/* Description */}
      <p className={cn(
        'text-xs line-clamp-2',
        isActive ? 'text-white/80' : 'text-gray-500'
      )}>
        {config.description}
      </p>

      {/* Hover effect */}
      {!isActive && (
        <div className={cn(
          'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
          `bg-gradient-to-br ${config.color.gradient} opacity-5`
        )} />
      )}
    </motion.button>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function KBCategoryNavigation({
  activeCategory,
  onCategoryChange,
  counts,
  className,
  variant = 'tabs',
}: Props) {
  const activeConfig = CATEGORY_CONFIGS.find(c => c.id === activeCategory);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Tab Navigation */}
      {variant === 'tabs' && (
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-1.5">
          <div className="flex gap-1">
            {CATEGORY_CONFIGS.map((config) => (
              <TabItem
                key={config.id}
                config={config}
                isActive={activeCategory === config.id}
                count={counts[config.id]}
                onClick={() => onCategoryChange(config.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Card Navigation */}
      {variant === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CATEGORY_CONFIGS.map((config) => (
            <CardItem
              key={config.id}
              config={config}
              isActive={activeCategory === config.id}
              count={counts[config.id]}
              onClick={() => onCategoryChange(config.id)}
            />
          ))}
        </div>
      )}

      {/* Category Description with semantic naming */}
      <AnimatePresence mode="wait">
        {activeConfig && (
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl',
              activeConfig.color.bg,
              'border',
              activeConfig.color.border
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              activeConfig.color.iconBg
            )}>
              <span className={activeConfig.color.text}>
                {activeConfig.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={cn('text-sm font-semibold', activeConfig.color.text)}>
                {activeConfig.semanticName}
              </h4>
              <p className="text-xs text-gray-600 truncate">
                {activeConfig.tooltip}
              </p>
            </div>
            <span className={cn(
              'text-xs font-medium px-2 py-1 rounded-full',
              activeConfig.color.bg,
              activeConfig.color.text
            )}>
              {counts[activeCategory]} items
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======================
// EXPORTS
// ======================
export { CATEGORY_CONFIGS };
export type { CategoryConfig, Props as KBCategoryNavigationProps };
