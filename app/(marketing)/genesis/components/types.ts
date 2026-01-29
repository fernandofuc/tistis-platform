// =====================================================
// TIS TIS Genesis - Shared Types & Constants
// Tipos y constantes para la pagina Genesis
// Preparacion para integracion robotica - Vision 2028+
// =====================================================

import type { LucideIcon } from 'lucide-react';

// Import para uso interno (extends)
import type { BaseSectionProps as CatalystBaseSectionProps } from '../../catalyst/components/types';

// =====================================================
// Re-export tipos base de Catalyst para consistencia
// =====================================================

// Type exports (requerido por isolatedModules)
export type {
  BaseSectionProps,
  FeatureItem,
  StepItem,
  BenefitItem,
  UseCaseItem,
  TestimonialItem,
} from '../../catalyst/components/types';

// Alias local para uso en extends
type BaseSectionProps = CatalystBaseSectionProps;

// Value exports (animaciones, configuraciones, constantes)
export {
  // Animation Variants
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  staggerContainer,
  staggerContainerFast,
  // Micro-interactions
  SPRING_CONFIG,
  buttonHover,
  buttonTap,
  cardHover,
  iconPulse,
  shimmer,
  // Constants
  APPLE_EASE,
  GRADIENTS,
  VIEWPORT_CONFIG,
  BREAKPOINTS,
  SECTION_SPACING,
  CONTAINER_WIDTHS,
} from '../../catalyst/components/types';

// =====================================================
// Genesis-Specific Types
// =====================================================

/**
 * Fase del proceso de integracion Genesis
 * Representa cada paso en el journey hacia la automatizacion robotica
 */
export interface GenesisPhase {
  /** Identificador unico de la fase */
  id: string;
  /** Numero de fase (1-5) */
  number: number;
  /** Icono de Lucide para representar la fase */
  icon: LucideIcon;
  /** Titulo de la fase */
  title: string;
  /** Descripcion breve de la fase */
  description: string;
  /** Detalles adicionales en lista */
  details: string[];
  /** Texto destacado opcional */
  highlight?: string;
  /** Gradiente de color para la fase */
  gradient?: string;
}

/**
 * Componente del Robot-Ready Score
 * Cada aspecto que se evalua para determinar preparacion robotica
 */
export interface RobotScoreComponent {
  /** Identificador unico */
  id: string;
  /** Etiqueta del componente */
  label: string;
  /** Puntos maximos posibles */
  maxPoints: number;
  /** Descripcion del criterio */
  description: string;
  /** Clase de color Tailwind */
  color: string;
  /** Icono representativo */
  icon: LucideIcon;
}

/**
 * Overlay de texto para ImageScrollPlayer
 * Controla cuando y como aparecen los textos durante el scroll
 */
export interface ImageScrollOverlay {
  /** Identificador unico */
  id: string;
  /** Progreso de scroll donde inicia (0-1) */
  startProgress: number;
  /** Progreso de scroll donde termina (0-1) */
  endProgress: number;
  /** Titulo del overlay */
  title: string;
  /** Subtitulo opcional */
  subtitle?: string;
  /** Icono de Lucide */
  icon: LucideIcon;
  /** Posicion en pantalla */
  position: 'left' | 'right' | 'center';
  /** Gradiente de colores */
  gradient?: string;
}

/**
 * Caso de uso de Genesis con ejemplo real
 * Muestra como un negocio especifico se beneficia
 */
export interface GenesisUseCaseItem {
  /** Identificador unico */
  id: string;
  /** Icono del tipo de negocio */
  icon: LucideIcon;
  /** Tipo de negocio */
  business: string;
  /** Anos usando TIS TIS */
  yearsWithTIS: number;
  /** Score de preparacion robotica */
  robotReadyScore: number;
  /** Datos recolectados */
  dataPoints: string[];
  /** Robots que podrian integrarse */
  robots: GenesisRobotIntegration[];
  /** Ahorros proyectados */
  savings: {
    monthly: string;
    roi: string;
  };
}

/**
 * Integracion de robot individual
 */
export interface GenesisRobotIntegration {
  /** Nombre del robot/sistema */
  name: string;
  /** Tareas que puede realizar */
  tasks: string[];
  /** Tiempo estimado de integracion */
  integrationTime: string;
}

/**
 * Props para el componente HeroSection
 * Extiende BaseSectionProps para consistencia con Catalyst
 */
export interface GenesisHeroProps extends BaseSectionProps {
  /** Mostrar indicador de scroll */
  showScrollIndicator?: boolean;
}

/**
 * Props para el componente ImageScrollPlayer
 * Extiende BaseSectionProps para consistencia con Catalyst
 */
export interface ImageScrollPlayerProps extends BaseSectionProps {
  /** Ruta de la imagen */
  imageSrc: string;
  /** Texto alternativo para accesibilidad */
  imageAlt: string;
  /** Altura del contenedor de scroll en vh (default: 400) */
  scrollHeight?: number;
  /** Overlays de texto a mostrar */
  overlays?: ImageScrollOverlay[];
  /** Mostrar indicador de progreso */
  showProgress?: boolean;
  /** Modo debug */
  debug?: boolean;
}

/**
 * Props para el componente ComingSoonCTA
 * Extiende BaseSectionProps para consistencia con Catalyst
 */
export interface ComingSoonCTAProps extends BaseSectionProps {
  /** Mostrar link de regreso */
  showBackLink?: boolean;
  /** Mostrar boton "Empieza ahora" */
  showStartNow?: boolean;
}

/**
 * Props para RobotReadyScoreSection
 * Extiende BaseSectionProps para consistencia con Catalyst
 */
export interface RobotReadyScoreSectionProps extends BaseSectionProps {
  /** Score ejemplo a mostrar (0-100) */
  exampleScore?: number;
}

// =====================================================
// Derived Types (for constants without LucideIcon)
// Los iconos de Lucide son componentes React, no se pueden
// serializar en constantes. Estos tipos omiten el campo icon
// para uso en datos estaticos.
// =====================================================

/**
 * Tipo derivado de GenesisPhase sin icono
 * Para uso en constantes de datos de fases
 */
export type GenesisPhaseData = Omit<GenesisPhase, 'icon'>;

/**
 * Tipo derivado de ImageScrollOverlay sin icono
 * Para uso en constantes de overlays
 */
export type ImageScrollOverlayData = Omit<ImageScrollOverlay, 'icon'>;

/**
 * Tipo derivado de RobotScoreComponent sin icono
 * Para uso en constantes de componentes de score
 */
export type RobotScoreComponentData = Omit<RobotScoreComponent, 'icon'>;

/**
 * Tipo derivado de GenesisUseCaseItem sin icono
 * Para uso en constantes de casos de uso
 */
export type GenesisUseCaseData = Omit<GenesisUseCaseItem, 'icon'>;

// =====================================================
// Genesis-Specific Constants
// =====================================================

/**
 * Gradientes especificos de Genesis
 * Complementan los gradientes base de TIS TIS
 */
export const GENESIS_GRADIENTS = {
  /** Gradiente robotico - azul a purpura */
  robotic: 'from-blue-500 via-tis-purple to-tis-pink',
  /** Gradiente futuro - coral a azul */
  future: 'from-tis-coral via-tis-pink to-blue-500',
  /** Gradiente score - verde a coral */
  score: 'from-emerald-500 via-tis-coral to-tis-pink',
  /** Gradiente data - purpura a coral */
  data: 'from-tis-purple to-tis-coral',
  /** Gradiente sutil para backgrounds */
  subtle: 'from-slate-50 via-white to-slate-50',
  /** Gradiente sutil dark mode */
  subtleDark: 'from-slate-900 via-slate-800 to-slate-900',
} as const;

/**
 * Configuracion de overlays por defecto para ImageScrollPlayer
 * Representa las 5 fases de Genesis
 */
export const DEFAULT_SCROLL_OVERLAYS: readonly ImageScrollOverlayData[] = [
  {
    id: 'data-collection',
    startProgress: 0,
    endProgress: 0.2,
    title: 'Acumula tus datos',
    subtitle: 'TIS TIS registra toda tu operacion durante anos',
    position: 'left',
    gradient: 'from-tis-coral to-tis-pink',
  },
  {
    id: 'robot-ready-score',
    startProgress: 0.2,
    endProgress: 0.4,
    title: 'Robot-Ready Score',
    subtitle: 'Medimos que tan preparado esta tu negocio (0-100)',
    position: 'right',
    gradient: 'from-tis-pink to-tis-purple',
  },
  {
    id: 'task-analysis',
    startProgress: 0.4,
    endProgress: 0.6,
    title: 'Analisis de tareas',
    subtitle: 'Identificamos que puede automatizarse',
    position: 'left',
    gradient: 'from-tis-purple to-blue-500',
  },
  {
    id: 'robot-training',
    startProgress: 0.6,
    endProgress: 0.8,
    title: 'Entrenamiento del robot',
    subtitle: 'Tus datos historicos entrenan al robot',
    position: 'right',
    gradient: 'from-blue-500 to-tis-coral',
  },
  {
    id: 'gradual-integration',
    startProgress: 0.8,
    endProgress: 1.0,
    title: 'Integracion gradual',
    subtitle: 'El robot se une a tu equipo paso a paso',
    position: 'center',
    gradient: 'from-tis-coral to-tis-pink',
  },
];

/**
 * Componentes del Robot-Ready Score
 * Sistema de puntuacion para preparacion robotica
 * @see RobotScoreComponent para el tipo completo con icono
 */
export const ROBOT_SCORE_COMPONENTS_DATA: readonly RobotScoreComponentData[] = [
  {
    id: 'operational-data',
    label: 'Datos Operativos',
    maxPoints: 25,
    description: 'Historial de citas, ventas y transacciones',
    color: 'text-tis-coral',
  },
  {
    id: 'process-mapping',
    label: 'Mapeo de Procesos',
    maxPoints: 25,
    description: 'Flujos de trabajo documentados y repetibles',
    color: 'text-tis-pink',
  },
  {
    id: 'integration-level',
    label: 'Nivel de Integracion',
    maxPoints: 25,
    description: 'Conexiones con sistemas externos activas',
    color: 'text-tis-purple',
  },
  {
    id: 'data-quality',
    label: 'Calidad de Datos',
    maxPoints: 25,
    description: 'Consistencia y completitud de la informacion',
    color: 'text-blue-500',
  },
] as const;

/**
 * Duraciones de animacion consistentes
 */
export const GENESIS_ANIMATION_DURATIONS = {
  /** Rapida para micro-interacciones */
  fast: 0.2,
  /** Normal para transiciones */
  normal: 0.4,
  /** Lenta para entradas principales */
  slow: 0.6,
  /** Muy lenta para efectos dramaticos */
  dramatic: 0.8,
} as const;

/**
 * Delays para animaciones escalonadas
 */
export const GENESIS_STAGGER_DELAYS = {
  /** Delay minimo entre elementos */
  tight: 0.05,
  /** Delay normal */
  normal: 0.1,
  /** Delay amplio para efecto dramatico */
  wide: 0.15,
} as const;
