// =====================================================
// TIS TIS PLATFORM - Knowledge Base Component
// Manage AI knowledge: policies, articles, competitors
// ARQUITECTURA V7: instructions y templates se gestionan en Agente Mensajes
// Premium UI with professional design
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
// UI components - currently using inline premium styling
import { useAuthContext } from '@/src/features/auth';
import { useToast } from '@/src/shared/hooks';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';
import { KnowledgeBasePageSkeleton } from '@/src/shared/components/skeletons';
import { KBCompletenessIndicator } from './KBCompletenessIndicator';
import {
  KBScoreCardPremium,
  KBBranchSelector,
  KBCategoryNavigation,
  KBItemCard,
  KBEmptyState,
  type KBCategory
} from './kb';

// KB Scoring imports for unified score calculation
import {
  calculateKBScore,
  convertKBDataForScoring,
} from '@/src/shared/config/kb-scoring-service';
import { type VerticalType, VERTICALS } from '@/src/shared/config/verticals';
import {
  type KnowledgeBaseLimits,
  type KBItemType,
  getKBUsageStatus,
  type KBUsageStatus,
} from '@/src/shared/config/plans';
// ARQUITECTURA V7: Templates se gestionan en Agente Mensajes
// Los imports de AVAILABLE_VARIABLES, VARIABLES_BY_CATEGORY ya no son necesarios aquí

// ======================
// VERTICAL VALIDATION
// ======================
const VALID_VERTICALS = Object.keys(VERTICALS) as VerticalType[];
const DEFAULT_VERTICAL: VerticalType = 'dental';

/**
 * Validates and returns a safe vertical type
 * Falls back to 'dental' if the vertical is invalid or undefined
 */
function getValidVertical(vertical: string | undefined): VerticalType {
  if (!vertical) return DEFAULT_VERTICAL;
  return VALID_VERTICALS.includes(vertical as VerticalType)
    ? (vertical as VerticalType)
    : DEFAULT_VERTICAL;
}

// ======================
// TYPES
// ======================

// Base type for all Knowledge Base items
interface KnowledgeBaseItem {
  id: string;
  tenant_id: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface CustomInstruction extends KnowledgeBaseItem {
  branch_id?: string;
  instruction_type: string;
  title: string;
  instruction: string;
  examples?: string;
  priority: number;
  created_at: string;
  // ARQUITECTURA V6: Flag para instrucciones que van directamente en el prompt inicial
  include_in_prompt?: boolean;
}

interface BusinessPolicy extends KnowledgeBaseItem {
  branch_id?: string;
  policy_type: string;
  title: string;
  policy_text: string;
  short_version?: string;
}

interface KnowledgeArticle extends KnowledgeBaseItem {
  branch_id?: string;
  category: string;
  title: string;
  content: string;
  summary?: string;
  display_order: number;
}

interface ResponseTemplate extends KnowledgeBaseItem {
  branch_id?: string;
  trigger_type: string;
  name: string;
  template_text: string;
  variables_available?: string[];
}

// Competitor handling type (matches ai_competitor_handling table)
interface CompetitorHandling extends KnowledgeBaseItem {
  competitor_name: string;
  competitor_aliases?: string[];
  response_strategy: string;
  talking_points?: string[];
  avoid_saying?: string[];
}

interface KnowledgeBaseData {
  instructions: CustomInstruction[];
  policies: BusinessPolicy[];
  articles: KnowledgeArticle[];
  templates: ResponseTemplate[];
  competitors: CompetitorHandling[];
}

// ARQUITECTURA V7: ActiveTab ahora solo incluye las 3 categorías visibles en KB
// (instructions y templates se gestionan en Agente Mensajes)
type ActiveTab = KBCategory;

// Tipo interno para mapeo de datos - incluye todas las categorías para la API
type InternalDataType = 'instructions' | 'policies' | 'articles' | 'templates' | 'competitors';

// Plan info from API response
interface PlanInfo {
  plan: string;
  limits: KnowledgeBaseLimits | null;
  usage: Record<KBItemType, number>;
}

// ======================
// ICONS
// ======================
// ARQUITECTURA V7: Iconos de instructions y templates eliminados - ahora en Agente Mensajes
const icons = {
  policies: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  articles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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
  delete: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  brain: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  competitors: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  checkCircle: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// INSTRUCTION TYPE OPTIONS
// ======================
// ARQUITECTURA V7: instructionTypes eliminado - Instrucciones se gestionan en Agente Mensajes

const policyTypes = [
  { value: 'cancellation', label: 'Cancelación', description: 'Política de cancelación de citas' },
  { value: 'rescheduling', label: 'Reagendamiento', description: 'Política para cambiar citas' },
  { value: 'payment', label: 'Métodos de Pago', description: 'Formas de pago aceptadas' },
  { value: 'insurance', label: 'Seguros', description: 'Seguros y convenios' },
  { value: 'warranty', label: 'Garantías', description: 'Garantías de servicios' },
  { value: 'deposits', label: 'Anticipos', description: 'Depósitos requeridos' },
  { value: 'late_arrival', label: 'Llegadas Tarde', description: 'Política de llegadas tarde' },
  { value: 'emergency', label: 'Emergencias', description: 'Manejo de emergencias' },
  { value: 'custom', label: 'Otra Política', description: 'Política personalizada' },
];

const articleCategories = [
  { value: 'about_us', label: 'Sobre Nosotros' },
  { value: 'differentiators', label: 'Lo Que Nos Diferencia' },
  { value: 'certifications', label: 'Certificaciones' },
  { value: 'technology', label: 'Tecnología' },
  { value: 'materials', label: 'Materiales/Productos' },
  { value: 'process', label: 'Procesos' },
  { value: 'aftercare', label: 'Cuidados Post-Servicio' },
  { value: 'preparation', label: 'Preparación Pre-Servicio' },
  { value: 'promotions', label: 'Promociones' },
  { value: 'testimonials', label: 'Testimonios' },
  { value: 'custom', label: 'Otro' },
];

// ARQUITECTURA V7: templateTriggers eliminado - Templates se gestionan en Agente Mensajes

// Competitor response strategies - how to handle mentions
const competitorStrategies = [
  { value: 'acknowledge_redirect', label: 'Reconocer y Redirigir', description: 'Reconoce la competencia y destaca tus ventajas' },
  { value: 'highlight_differentiators', label: 'Destacar Diferenciadores', description: 'Enfócate en lo que te hace único' },
  { value: 'price_value', label: 'Precio vs Valor', description: 'Justifica tu precio con el valor que ofreces' },
  { value: 'neutral_professional', label: 'Neutral y Profesional', description: 'Respuesta objetiva sin hablar mal' },
  { value: 'custom', label: 'Estrategia Personalizada', description: 'Define tu propia estrategia' },
];

// ======================
// MAIN COMPONENT
// ======================
export function KnowledgeBase() {
  const { tenant, isAdmin, branches } = useAuthContext();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // ARQUITECTURA V7: Default a 'policies' ya que instructions/templates se movieron a Agente Mensajes
  const [activeTab, setActiveTab] = useState<ActiveTab>('policies');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [data, setData] = useState<KnowledgeBaseData>({
    instructions: [],
    policies: [],
    articles: [],
    templates: [],
    competitors: [],
  });

  // Additional data for KB Scoring (services, staff)
  const [services, setServices] = useState<Array<{ id: string; name?: string; is_active: boolean }>>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; first_name?: string; last_name?: string; role?: string; is_active: boolean }>>([]);

  // Plan limits info
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  // ARQUITECTURA V7: Modal solo para las 3 categorías visibles
  const [modalType, setModalType] = useState<ActiveTab>('policies');
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);

  // Form States
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // ======================
  // BRANCH FILTERING
  // ======================
  // ARQUITECTURA V7: Solo filtrar las 3 categorías visibles en KB
  // (instructions y templates se mantienen en data para cálculo de score pero no se muestran)
  const filteredData = useMemo(() => {
    if (!selectedBranchId) {
      return {
        policies: data.policies,
        articles: data.articles,
        competitors: data.competitors,
      };
    }

    return {
      policies: data.policies.filter(
        p => !p.branch_id || p.branch_id === selectedBranchId
      ),
      articles: data.articles.filter(
        a => !a.branch_id || a.branch_id === selectedBranchId
      ),
      competitors: data.competitors, // Competidores son siempre globales
    };
  }, [data, selectedBranchId]);

  // ======================
  // UNIFIED KB SCORING
  // ======================
  // Get validated vertical from tenant (falls back to 'dental' if invalid/undefined)
  const tenantVertical = useMemo(() => getValidVertical(tenant?.vertical), [tenant?.vertical]);

  // Calculate KB Score using the unified scoring system (same as KBCompletenessIndicator)
  const scoringResult = useMemo(() => {
    const additionalData = {
      services: services.map(s => ({ id: s.id, name: s.name, is_active: s.is_active })),
      branches: branches?.map(b => ({
        id: b.id,
        name: b.name,
        operating_hours: b.operating_hours as Record<string, unknown> | null,
        is_active: b.is_active,
      })) || [],
      staff: staffList.map(s => ({ id: s.id, first_name: s.first_name, last_name: s.last_name, role: s.role, is_active: s.is_active })),
    };
    const convertedData = convertKBDataForScoring(data, additionalData);
    return calculateKBScore(convertedData, tenantVertical);
  }, [data, services, staffList, branches, tenantVertical]);

  // Get usage status for each KB item type (for plan limits UI)
  const getItemUsageStatus = useCallback((itemType: KBItemType): KBUsageStatus | null => {
    if (!planInfo?.plan || !planInfo.limits) return null;
    const currentCount = data[itemType]?.length ?? 0;
    return getKBUsageStatus(planInfo.plan, itemType, currentCount);
  }, [planInfo, data]);

  // Check if can add more items of a specific type
  const canAddItem = useCallback((itemType: KBItemType): boolean => {
    if (!planInfo?.limits) return true; // No limits = can add
    const currentCount = data[itemType]?.length ?? 0;
    const limit = planInfo.limits[itemType];
    return currentCount < limit;
  }, [planInfo, data]);

  // Helper para obtener nombre de sucursal por ID
  const getBranchName = useCallback((branchId: string | undefined | null) => {
    if (!branchId || !branches) return null;
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || null;
  }, [branches]);

  // ======================
  // BODY SCROLL LOCK
  // ======================
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (showModal) {
      // Guardar scroll position y bloquear
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else {
      // Restaurar scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
    };
  }, [showModal]);

  // ======================
  // AUTH HEADERS HELPER
  // ======================
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

  // ======================
  // DATA FETCHING
  // ======================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      // Fetch all data in parallel for better performance
      const [kbResponse, servicesResponse, staffResponse] = await Promise.all([
        fetch('/api/knowledge-base', { headers }),
        fetch('/api/services', { headers }),
        fetch('/api/staff', { headers }),
      ]);

      // Process KB data with fallback guard
      if (kbResponse.ok) {
        const result = await kbResponse.json();
        setData(result.data ?? {
          instructions: [],
          policies: [],
          articles: [],
          templates: [],
          competitors: [],
        });
        // Save plan info for limit validation
        if (result.planInfo) {
          setPlanInfo(result.planInfo);
        }
      }

      // Process services data
      if (servicesResponse.ok) {
        const servicesResult = await servicesResponse.json();
        setServices(servicesResult.data || []);
      }

      // Process staff data
      if (staffResponse.ok) {
        const staffResult = await staffResponse.json();
        setStaffList(staffResult.data || []);
      }
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      showToast({
        type: 'error',
        message: 'Error al cargar la base de conocimiento. Por favor intenta de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ======================
  // CRUD OPERATIONS
  // ======================
  const handleSave = async () => {
    // ARQUITECTURA V7: Solo validación para las 3 categorías visibles
    const requiredFields: Record<ActiveTab, string[]> = {
      policies: ['policy_type', 'title', 'policy_text'],
      articles: ['category', 'title', 'content'],
      competitors: ['competitor_name', 'response_strategy'],
    };

    const required = requiredFields[modalType];
    const missing = required.filter(field => !formData[field]);

    if (missing.length > 0) {
      showToast({
        type: 'warning',
        message: `Completa los campos requeridos: ${missing.join(', ')}`,
      });
      return;
    }

    const isEditing = !!editingItem?.id;
    setSaving(true);

    try {
      const endpoint = '/api/knowledge-base';
      const method = isEditing ? 'PATCH' : 'POST';
      // ARQUITECTURA V7: Mapeo solo para las 3 categorías visibles
      const typeMap: Record<ActiveTab, string> = {
        policies: 'policies',
        articles: 'articles',
        competitors: 'competitors',
      };

      // Preparar datos a guardar
      const dataToSave = { ...formData };

      const body = isEditing
        ? { type: typeMap[modalType], id: editingItem.id, data: dataToSave }
        : { type: typeMap[modalType], data: dataToSave };

      console.log('[KnowledgeBase] Saving:', { method, body });

      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      const result = await response.json();
      console.log('[KnowledgeBase] Response:', result);

      if (response.ok && result.success) {
        // OPTIMISTIC UPDATE - Actualizar estado local inmediatamente
        setData(prev => {
          const newData = { ...prev };
          const listKey = modalType as keyof KnowledgeBaseData;
                    const list = [...prev[listKey]] as any[];

          if (isEditing) {
            // Actualizar item existente
            const index = list.findIndex(item => item.id === editingItem.id);
            if (index !== -1) {
              list[index] = { ...list[index], ...dataToSave, ...result.data };
            }
          } else {
            // Agregar nuevo item al inicio
            list.unshift(result.data);
          }

                    (newData as any)[listKey] = list;
          return newData;
        });

        // Cerrar modal y limpiar
        setShowModal(false);
        setEditingItem(null);
        setFormData({});

        // Toast de éxito
        showToast({
          type: 'success',
          message: isEditing ? 'Actualizado correctamente' : 'Creado correctamente',
        });
      } else {
        // Handle specific error types
        if (result.error === 'plan_limit_reached') {
          showToast({
            type: 'warning',
            message: result.message || `Has alcanzado el límite de tu plan actual`,
            duration: 6000,
          });
          // Refresh plan info to ensure UI is in sync
          await fetchData();
        } else {
          showToast({
            type: 'error',
            message: result.error || 'Error al guardar',
          });
        }
        console.error('Save error:', result);
      }
    } catch (error) {
      console.error('Error saving:', error);
      showToast({
        type: 'error',
        message: 'Error de conexión al guardar',
      });
      // En caso de error, recargar para sincronizar
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;

    // Guardar copia para rollback
    const previousData = { ...data };

    // OPTIMISTIC DELETE - Remover inmediatamente de la UI
    setData(prev => {
      const listKey = type as keyof KnowledgeBaseData;
      return {
        ...prev,
                [listKey]: (prev[listKey] as any[]).filter(item => item.id !== id)
      };
    });

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/knowledge-base?type=${type}&id=${id}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        showToast({
          type: 'success',
          message: 'Eliminado correctamente',
        });
      } else {
        // ROLLBACK en caso de error
        setData(previousData);
        showToast({
          type: 'error',
          message: 'Error al eliminar',
        });
      }
    } catch (error) {
      console.error('Error deleting:', error);
      // ROLLBACK en caso de error
      setData(previousData);
      showToast({
        type: 'error',
        message: 'Error de conexión al eliminar',
      });
    }
  };

  // =====================================================
  // ARQUITECTURA V6: Toggle include_in_prompt para instrucciones
  // =====================================================
  // Permite marcar instrucciones como "críticas" que van en el prompt inicial
  // Máximo 5 instrucciones pueden tener include_in_prompt = true

  // Calcular cuántas instrucciones tienen include_in_prompt = true
  const criticalInstructionsCount = useMemo(() => {
    return data.instructions.filter(i => i.include_in_prompt === true).length;
  }, [data.instructions]);

  // Si ya hay 5, no se pueden agregar más
  const canEnableIncludeInPrompt = criticalInstructionsCount < 5;

  const handleToggleIncludeInPrompt = async (id: string, newState: boolean) => {
    // Validar límite
    if (newState && !canEnableIncludeInPrompt) {
      showToast({
        type: 'warning',
        message: 'Límite alcanzado: máximo 5 instrucciones pueden estar en el prompt inicial',
      });
      return;
    }

    // Guardar copia para rollback
    const previousData = { ...data };

    // OPTIMISTIC UPDATE - Actualizar inmediatamente la UI
    setData(prev => ({
      ...prev,
      instructions: prev.instructions.map(item =>
        item.id === id ? { ...item, include_in_prompt: newState } : item
      ),
    }));

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/knowledge-base`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'instructions',
          id,
          data: { include_in_prompt: newState },
        }),
      });

      if (response.ok) {
        showToast({
          type: 'success',
          message: newState
            ? 'Instrucción marcada como crítica (incluida en prompt)'
            : 'Instrucción quitada del prompt inicial',
        });
      } else {
        // ROLLBACK en caso de error
        setData(previousData);
        const errorData = await response.json().catch(() => ({}));
        showToast({
          type: 'error',
          message: errorData.error || 'Error al actualizar',
        });
      }
    } catch (error) {
      console.error('Error toggling include_in_prompt:', error);
      // ROLLBACK en caso de error
      setData(previousData);
      showToast({
        type: 'error',
        message: 'Error de conexión al actualizar',
      });
    }
  };

  const openAddModal = (type: ActiveTab) => {
    setModalType(type);
    setEditingItem(null);
    // Set initial form data based on type - each table has different columns
    const initialData: Record<string, unknown> = {
      is_active: true,
    };
    // ARQUITECTURA V7: Solo campos para las 3 categorías visibles
    if (type === 'articles') {
      initialData.display_order = 0;
    }
    setFormData(initialData);
    setShowModal(true);
  };

  const openEditModal = (type: ActiveTab, item: KnowledgeBaseItem) => {
    setModalType(type);
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  // ======================
  // TAB CONFIGURATION
  // ======================
  // ARQUITECTURA V7: Solo 3 categorías visibles (instructions y templates se movieron a Agente Mensajes)
  const tabs = [
    {
      id: 'policies' as ActiveTab,
      label: 'Políticas',
      icon: icons.policies,
      count: filteredData.policies.length,
      description: 'Políticas del negocio que el AI debe conocer',
    },
    {
      id: 'articles' as ActiveTab,
      label: 'Información',
      icon: icons.articles,
      count: filteredData.articles.length,
      description: 'Conocimiento adicional sobre tu negocio',
    },
    {
      id: 'competitors' as ActiveTab,
      label: 'Competencia',
      icon: icons.competitors,
      count: filteredData.competitors.length,
      description: 'Cómo responder cuando mencionan a la competencia',
    },
  ];

  // Handler for next step click - navigates to the appropriate tab
  // NOTE: Must be declared before conditional return to follow React Hooks rules
  // ARQUITECTURA V7: Solo mapea a las 3 categorías visibles
  const handleNextStepClick = useCallback((step: { category: string; fieldKey: string }) => {
    // Map field categories to tabs (solo las 3 categorías visibles)
    const categoryToTab: Record<string, ActiveTab> = {
      policies: 'policies',
      articles: 'articles',
      competitors: 'competitors',
      // Additional mappings for specific field keys
      knowledge: 'articles',
      advanced: 'competitors',
    };

    const targetTab = categoryToTab[step.category] || categoryToTab[step.fieldKey.split('_')[0]] || 'policies';
    setActiveTab(targetTab);
  }, []);

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return <KnowledgeBasePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Premium Score Card - FASE 1.1 */}
      <KBScoreCardPremium
        data={data}
        additionalData={{
          services: services.map(s => ({ id: s.id, name: s.name, is_active: s.is_active })),
          branches: branches?.map(b => ({
            id: b.id,
            name: b.name,
            operating_hours: b.operating_hours as Record<string, unknown> | null,
            is_active: b.is_active,
          })) || [],
          staff: staffList.map(s => ({ id: s.id, first_name: s.first_name, last_name: s.last_name, role: s.role, is_active: s.is_active })),
        }}
        vertical={tenantVertical}
        onNextStepClick={handleNextStepClick}
      />

      {/* Premium Branch Selector - FASE 1.3 */}
      <KBBranchSelector
        branches={branches?.map(b => ({
          id: b.id,
          name: b.name,
          is_headquarters: b.is_headquarters,
          is_active: b.is_active,
        })) || []}
        selectedBranchId={selectedBranchId}
        onBranchSelect={setSelectedBranchId}
      />

      {/* Premium Category Navigation - FASE 2 */}
      <KBCategoryNavigation
        activeCategory={activeTab}
        onCategoryChange={setActiveTab}
        counts={{
          // ARQUITECTURA V7: Solo 3 categorías (instructions y templates se movieron a Agente Mensajes)
          policies: filteredData.policies.length,
          articles: filteredData.articles.length,
          competitors: filteredData.competitors.length,
        }}
        variant="tabs"
      />

      {/* Content Area - Premium Design */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="p-6">
            {/* ARQUITECTURA V7: Instructions y Templates se eliminaron de KB */}
            {/* Ahora se gestionan en Mis Agentes → Agente Mensajes */}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Políticas del Negocio</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      El AI comunicará estas políticas cuando sea relevante
                    </p>
                    {/* Plan limit indicator */}
                    {planInfo?.limits && (
                      <LimitBadge
                        current={data.policies.length}
                        limit={planInfo.limits.policies}
                        className="mt-2"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => openAddModal('policies')}
                    disabled={!canAddItem('policies')}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
                      canAddItem('policies')
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva Política
                  </button>
                </div>

                {filteredData.policies.length === 0 ? (
                  <KBEmptyState
                    category="policies"
                    onAction={() => openAddModal('policies')}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.policies.map((item) => (
                      <KBItemCard
                        key={item.id}
                        id={item.id}
                        category="policies"
                        type={policyTypes.find(t => t.value === item.policy_type)?.label || item.policy_type}
                        title={item.title}
                        content={item.policy_text}
                        isActive={item.is_active}
                        branchName={getBranchName(item.branch_id)}
                        onEdit={() => openEditModal('policies', item)}
                        onDelete={() => handleDelete('policies', item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Articles Tab */}
            {activeTab === 'articles' && (
              <div className="space-y-6">
                {/* Info Banner - RAG Content */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900">Base de Conocimiento (RAG)</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Esta información se almacena en la base de conocimiento y el asistente la consulta
                        dinámicamente cuando es relevante para responder preguntas sobre tu negocio.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Información del Negocio</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Conocimiento adicional que el AI debe tener sobre tu negocio
                    </p>
                    {/* Plan limit indicator */}
                    {planInfo?.limits && (
                      <LimitBadge
                        current={data.articles.length}
                        limit={planInfo.limits.articles}
                        className="mt-2"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => openAddModal('articles')}
                    disabled={!canAddItem('articles')}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
                      canAddItem('articles')
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva Información
                  </button>
                </div>

                {filteredData.articles.length === 0 ? (
                  <KBEmptyState
                    category="articles"
                    onAction={() => openAddModal('articles')}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.articles.map((item) => (
                      <KBItemCard
                        key={item.id}
                        id={item.id}
                        category="articles"
                        type={articleCategories.find(t => t.value === item.category)?.label || item.category}
                        title={item.title}
                        content={item.content}
                        isActive={item.is_active}
                        branchName={getBranchName(item.branch_id)}
                        onEdit={() => openEditModal('articles', item)}
                        onDelete={() => handleDelete('articles', item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Competitors Tab */}
            {activeTab === 'competitors' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Manejo de Competencia</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Define cómo responder cuando mencionan a tus competidores
                    </p>
                    {/* Plan limit indicator */}
                    {planInfo?.limits && (
                      <LimitBadge
                        current={data.competitors.length}
                        limit={planInfo.limits.competitors}
                        className="mt-2"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => openAddModal('competitors')}
                    disabled={!canAddItem('competitors')}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
                      canAddItem('competitors')
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar Competidor
                  </button>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-900">Estrategia profesional</p>
                      <p className="text-xs text-amber-700 mt-1">
                        El AI usará esta información para responder de manera profesional cuando un cliente
                        mencione a la competencia, destacando tus ventajas sin hablar mal de otros.
                      </p>
                    </div>
                  </div>
                </div>

                {filteredData.competitors.length === 0 ? (
                  <KBEmptyState
                    category="competitors"
                    onAction={() => openAddModal('competitors')}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.competitors.map((item) => (
                      <KBItemCard
                        key={item.id}
                        id={item.id}
                        category="competitors"
                        type={competitorStrategies.find(s => s.value === item.response_strategy)?.label || item.response_strategy}
                        title={item.competitor_name}
                        content={item.talking_points?.join(', ') || 'Sin puntos clave definidos'}
                        isActive={item.is_active}
                        strategy={competitorStrategies.find(s => s.value === item.response_strategy)?.label || item.response_strategy}
                        talkingPoints={item.talking_points || []}
                        onEdit={() => openEditModal('competitors', item)}
                        onDelete={() => handleDelete('competitors', item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Section - Completeness & Preview */}
      <div className="mt-8 pt-8 border-t border-gray-200 space-y-6">
        {/* Completeness Indicator - Now with full data for accurate scoring */}
        <KBCompletenessIndicator
          data={data}
          additionalData={{
            services: services.map(s => ({ id: s.id, name: s.name, is_active: s.is_active })),
            branches: branches?.map(b => ({
              id: b.id,
              name: b.name,
              operating_hours: b.operating_hours as Record<string, unknown> | null,
              is_active: b.is_active,
            })) || [],
            staff: staffList.map(s => ({ id: s.id, first_name: s.first_name, last_name: s.last_name, role: s.role, is_active: s.is_active })),
          }}
          vertical={tenantVertical}
        />

      </div>

      {/* Premium Modal - Rendered via Portal to be above everything */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0" style={{ zIndex: 9999 }}>
              {/* Backdrop - Cubre TODA la pantalla */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowModal(false)}
              />

              {/* Slide-over Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-y-0 right-0 w-[420px] max-w-full bg-white shadow-2xl flex flex-col overflow-hidden"
              >
              {/* Modal Header - Premium Design */}
              <div className="relative overflow-hidden flex-shrink-0">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700" />

                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                      </pattern>
                    </defs>
                    <rect width="100" height="100" fill="url(#grid)" />
                  </svg>
                </div>

                {/* Header Content */}
                <div className="relative px-6 py-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {/* Dynamic Icon based on type - ARQUITECTURA V7: Solo 3 categorías */}
                      <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white">
                        {modalType === 'policies' && icons.policies}
                        {modalType === 'articles' && icons.articles}
                        {modalType === 'competitors' && icons.competitors}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {editingItem ? 'Editar' : (modalType === 'competitors' ? 'Nuevo' : 'Nueva')} {
                            modalType === 'policies' ? 'Política' :
                            modalType === 'articles' ? 'Información' : 'Competidor'
                          }
                        </h3>
                        <p className="text-sm text-purple-100 mt-0.5">
                          {tabs.find(t => t.id === modalType)?.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center hover:bg-white/10 rounded-lg active:scale-95 transition-all text-white"
                    >
                      {icons.close}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content - Área scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-6 space-y-5">
                {/* ARQUITECTURA V7: Instructions Form eliminado - ahora en Agente Mensajes */}

                {/* Policies Form - Premium Design */}
                {modalType === 'policies' && (
                  <>
                    <FormSection
                      step={1}
                      title="Tipo de política"
                      description="¿Qué tipo de política quieres que conozca tu asistente?"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {policyTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, policy_type: type.value })}
                            className={cn(
                              'p-3 rounded-xl border-2 text-left transition-all',
                              formData.policy_type === type.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            )}
                          >
                            <p className={cn(
                              'text-sm font-medium',
                              formData.policy_type === type.value ? 'text-purple-700' : 'text-gray-700'
                            )}>
                              {type.label}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                          </button>
                        ))}
                      </div>
                    </FormSection>

                    <FormSection
                      step={2}
                      title="Nombre de la política"
                      description="Un título descriptivo"
                    >
                      <input
                        type="text"
                        value={formData.title as string || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ej: Política de Cancelación 24 horas"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors"
                      />
                    </FormSection>

                    <FormSection
                      step={3}
                      title="Descripción completa"
                      description="Explica la política en detalle"
                    >
                      <textarea
                        value={formData.policy_text as string || ''}
                        onChange={(e) => setFormData({ ...formData, policy_text: e.target.value })}
                        placeholder="Las citas pueden cancelarse hasta 24 horas antes sin cargo. Las cancelaciones con menos de 24 horas de anticipación..."
                        rows={5}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                    </FormSection>

                    <FormSection
                      step={4}
                      title="Versión resumida"
                      description="Una versión corta para respuestas rápidas"
                      optional
                    >
                      <textarea
                        value={formData.short_version as string || ''}
                        onChange={(e) => setFormData({ ...formData, short_version: e.target.value })}
                        placeholder="Ej: Cancelación gratuita hasta 24h antes"
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                    </FormSection>
                  </>
                )}

                {/* Articles Form - Premium Design */}
                {modalType === 'articles' && (
                  <>
                    <FormSection
                      step={1}
                      title="Categoría"
                      description="¿Sobre qué tema es esta información?"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {articleCategories.slice(0, 8).map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, category: cat.value })}
                            className={cn(
                              'p-3 rounded-xl border-2 text-left transition-all',
                              formData.category === cat.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            )}
                          >
                            <p className={cn(
                              'text-sm font-medium',
                              formData.category === cat.value ? 'text-purple-700' : 'text-gray-700'
                            )}>
                              {cat.label}
                            </p>
                          </button>
                        ))}
                      </div>
                      <details className="mt-3">
                        <summary className="text-sm text-purple-600 cursor-pointer hover:text-purple-700">
                          Ver más categorías...
                        </summary>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {articleCategories.slice(8).map((cat) => (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, category: cat.value })}
                              className={cn(
                                'p-3 rounded-xl border-2 text-left transition-all',
                                formData.category === cat.value
                                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              )}
                            >
                              <p className={cn(
                                'text-sm font-medium',
                                formData.category === cat.value ? 'text-purple-700' : 'text-gray-700'
                              )}>
                                {cat.label}
                              </p>
                            </button>
                          ))}
                        </div>
                      </details>
                    </FormSection>

                    <FormSection
                      step={2}
                      title="Título del artículo"
                      description="Un nombre descriptivo para esta información"
                    >
                      <input
                        type="text"
                        value={formData.title as string || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ej: Nuestra Tecnología de Escaneo 3D"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors"
                      />
                    </FormSection>

                    <FormSection
                      step={3}
                      title="Contenido"
                      description="Toda la información que quieres que el AI conozca"
                    >
                      <textarea
                        value={formData.content as string || ''}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Contamos con tecnología de escaneo 3D de última generación que permite..."
                        rows={6}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                    </FormSection>

                    <FormSection
                      step={4}
                      title="Resumen"
                      description="Una versión corta para respuestas breves"
                      optional
                    >
                      <textarea
                        value={formData.summary as string || ''}
                        onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                        placeholder="Ej: Escáner 3D de última generación para diagnósticos precisos"
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                    </FormSection>
                  </>
                )}

                {/* ARQUITECTURA V7: Templates Form eliminado - ahora en Agente Mensajes */}

                {/* Competitors Form - Premium Design */}
                {modalType === 'competitors' && (
                  <>
                    <FormSection
                      step={1}
                      title="Nombre del competidor"
                      description="El nombre principal como se conoce a este competidor"
                    >
                      <input
                        type="text"
                        value={formData.competitor_name as string || ''}
                        onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })}
                        placeholder="Ej: Clínica Dental Sonrisa"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors"
                      />
                    </FormSection>

                    <FormSection
                      step={2}
                      title="Alias o nombres alternativos"
                      description="Otras formas en que los clientes podrían referirse a este competidor"
                      optional
                    >
                      <input
                        type="text"
                        value={(formData.competitor_aliases as string[])?.join(', ') || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          competitor_aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                        placeholder="Ej: La Sonrisa, DS, la clínica de la esquina"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors"
                      />
                      <p className="text-xs text-gray-400 mt-1">Separa con comas</p>
                    </FormSection>

                    <FormSection
                      step={3}
                      title="Estrategia de respuesta"
                      description="Cómo quieres que el AI maneje menciones de este competidor"
                    >
                      <div className="space-y-2">
                        {competitorStrategies.map((strategy) => (
                          <button
                            key={strategy.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, response_strategy: strategy.value })}
                            className={cn(
                              'w-full p-4 rounded-xl border-2 text-left transition-all',
                              formData.response_strategy === strategy.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            )}
                          >
                            <p className={cn(
                              'text-sm font-medium',
                              formData.response_strategy === strategy.value ? 'text-purple-700' : 'text-gray-700'
                            )}>
                              {strategy.label}
                            </p>
                            <p className={cn(
                              'text-xs mt-0.5',
                              formData.response_strategy === strategy.value ? 'text-purple-600' : 'text-gray-500'
                            )}>
                              {strategy.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </FormSection>

                    <FormSection
                      step={4}
                      title="Puntos a destacar"
                      description="Ventajas tuyas que el AI debe mencionar cuando hablen de este competidor"
                      optional
                    >
                      <textarea
                        value={(formData.talking_points as string[])?.join('\n') || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          talking_points: e.target.value.split('\n').filter(Boolean)
                        })}
                        placeholder={`Escribe una ventaja por línea:\n• Tecnología de última generación\n• 15 años de experiencia\n• Garantía extendida`}
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                    </FormSection>

                    <FormSection
                      step={5}
                      title="Lo que NO debe decir"
                      description="Frases o comparaciones que el AI debe evitar"
                      optional
                    >
                      <textarea
                        value={(formData.avoid_saying as string[])?.join('\n') || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          avoid_saying: e.target.value.split('\n').filter(Boolean)
                        })}
                        placeholder={`Una frase por línea:\n• No hablar mal de su precio\n• No mencionar problemas que hayan tenido`}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                    </FormSection>
                  </>
                )}

                {/* Branch Selector - Only show if multiple branches and not competitors */}
                {branches && branches.length > 1 && modalType !== 'competitors' && (
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          Aplica a
                        </label>
                        <select
                          value={(formData.branch_id as string) || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            branch_id: e.target.value || null
                          })}
                          className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          <option value="">Todas las sucursales (global)</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name} {branch.is_headquarters ? '(Matriz)' : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-blue-600 mt-1.5">
                          {(formData.branch_id as string)
                            ? `Solo aplica a ${getBranchName(formData.branch_id as string)}`
                            : 'Aplica a todas las sucursales del negocio'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Toggle - Premium Design */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      (formData.is_active as boolean ?? true)
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-200 text-gray-400'
                    )}>
                      {(formData.is_active as boolean ?? true) ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Estado</p>
                      <p className="text-xs text-gray-500">
                        {(formData.is_active as boolean ?? true)
                          ? 'El AI usará esta información'
                          : 'Pausado temporalmente'
                        }
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.is_active as boolean ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow-sm after:border-gray-200 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600" />
                  </label>
                </div>
                </div>
              </div>

              {/* Modal Footer - Premium Design */}
              <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                      'flex-1 px-4 py-3 font-medium rounded-xl transition-all',
                      'bg-gradient-to-r from-purple-600 to-indigo-600 text-white',
                      'hover:from-purple-700 hover:to-indigo-700',
                      'shadow-lg shadow-purple-500/25',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Guardando...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {editingItem ? (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Guardar Cambios
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Crear
                          </>
                        )}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// ======================
// SUBCOMPONENTS
// ======================

/**
 * FormSection - Premium form field wrapper with step indicator
 */
function FormSection({
  step,
  title,
  description,
  optional,
  children,
}: {
  step: number;
  title: string;
  description: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* Step indicator line */}
      <div className="flex items-start gap-4">
        {/* Step number badge */}
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-purple-500/25">
          {step}
        </div>

        {/* Content */}
        <div className="flex-1 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
            {optional && (
              <span className="text-xs text-gray-400 font-normal">(opcional)</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * LimitBadge - Shows plan limit status for KB items
 */
function LimitBadge({
  current,
  limit,
  className,
}: {
  current: number;
  limit: number;
  className?: string;
}) {
  const percentage = Math.min((current / limit) * 100, 100);
  const isAtLimit = current >= limit;
  const isNearLimit = percentage >= 80 && !isAtLimit;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Progress pill */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100/80">
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isAtLimit ? 'bg-red-500' :
              isNearLimit ? 'bg-amber-500' : 'bg-purple-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn(
          'text-xs font-medium tabular-nums',
          isAtLimit ? 'text-red-600' :
          isNearLimit ? 'text-amber-600' : 'text-gray-600'
        )}>
          {current}/{limit}
        </span>
      </div>

      {/* Warning icon if at limit */}
      {isAtLimit && (
        <div className="flex items-center gap-1 text-red-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-medium">Límite alcanzado</span>
        </div>
      )}
    </div>
  );
}

// NOTE: EmptyState, ItemCard, and CompetitorCard components have been
// replaced by the premium KBEmptyState and KBItemCard components from './kb'
