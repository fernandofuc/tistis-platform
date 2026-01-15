// =====================================================
// TIS TIS PLATFORM - Knowledge Base Component
// Manage AI knowledge: instructions, policies, articles
// Premium UI with professional design
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, Button, Input } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { useToast } from '@/src/shared/hooks';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';
import {
  KnowledgeBasePageSkeleton,
  KnowledgeBaseListSkeleton,
} from '@/src/shared/components/skeletons';
import { KBCompletenessIndicator } from './KBCompletenessIndicator';
import { PromptPreview } from './PromptPreview';

// KB Scoring imports for unified score calculation
import {
  calculateKBScore,
  convertKBDataForScoring,
  getKBStatusSummary,
} from '@/src/shared/config/kb-scoring-service';
import { type VerticalType, VERTICALS } from '@/src/shared/config/verticals';

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

type ActiveTab = 'instructions' | 'policies' | 'articles' | 'templates' | 'competitors';

// ======================
// ICONS
// ======================
const icons = {
  instructions: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
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
  templates: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
const instructionTypes = [
  { value: 'identity', label: 'Identidad del Negocio', description: 'Cómo presentarte, tu propuesta de valor' },
  { value: 'greeting', label: 'Saludo', description: 'Cómo saludar a los clientes' },
  { value: 'farewell', label: 'Despedida', description: 'Cómo despedirte' },
  { value: 'pricing_policy', label: 'Política de Precios', description: 'Cómo manejar preguntas de precio' },
  { value: 'special_cases', label: 'Casos Especiales', description: 'Situaciones específicas de tu negocio' },
  { value: 'objections', label: 'Manejo de Objeciones', description: 'Respuestas a objeciones comunes' },
  { value: 'upsell', label: 'Ventas Adicionales', description: 'Oportunidades de upsell/cross-sell' },
  { value: 'tone_examples', label: 'Ejemplos de Tono', description: 'Ejemplos de cómo quieres que suene' },
  { value: 'forbidden', label: 'Nunca Decir', description: 'Lo que NUNCA debe mencionar' },
  { value: 'always_mention', label: 'Siempre Mencionar', description: 'Lo que SIEMPRE debe incluir' },
  { value: 'custom', label: 'Personalizado', description: 'Instrucción libre' },
];

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

const templateTriggers = [
  { value: 'greeting', label: 'Saludo Inicial' },
  { value: 'after_hours', label: 'Fuera de Horario' },
  { value: 'appointment_confirm', label: 'Confirmación de Cita' },
  { value: 'price_inquiry', label: 'Consulta de Precio' },
  { value: 'location_inquiry', label: 'Consulta de Ubicación' },
  { value: 'emergency', label: 'Emergencia' },
  { value: 'farewell', label: 'Despedida' },
  { value: 'thank_you', label: 'Agradecimiento' },
  { value: 'follow_up', label: 'Seguimiento' },
  { value: 'custom', label: 'Personalizado' },
];

// Competitor response strategies - how to handle mentions
const competitorStrategies = [
  { value: 'acknowledge_redirect', label: 'Reconocer y Redirigir', description: 'Reconoce la competencia y destaca tus ventajas' },
  { value: 'highlight_differentiators', label: 'Destacar Diferenciadores', description: 'Enfócate en lo que te hace único' },
  { value: 'price_value', label: 'Precio vs Valor', description: 'Justifica tu precio con el valor que ofreces' },
  { value: 'neutral_professional', label: 'Neutral y Profesional', description: 'Respuesta objetiva sin hablar mal' },
  { value: 'custom', label: 'Estrategia Personalizada', description: 'Define tu propia estrategia' },
];

// ======================
// TEMPLATE VARIABLES
// ======================
// Variables disponibles para usar en plantillas de respuesta
const AVAILABLE_VARIABLES = [
  // Variables de cliente
  { key: '{nombre}', description: 'Nombre del cliente', category: 'Cliente' },
  { key: '{telefono}', description: 'Teléfono del cliente', category: 'Cliente' },

  // Variables de cita
  { key: '{fecha}', description: 'Fecha de la cita', category: 'Cita' },
  { key: '{hora}', description: 'Hora de la cita', category: 'Cita' },
  { key: '{servicio}', description: 'Nombre del servicio', category: 'Cita' },
  { key: '{precio}', description: 'Precio del servicio', category: 'Cita' },
  { key: '{duracion}', description: 'Duración estimada', category: 'Cita' },

  // Variables de negocio
  { key: '{negocio}', description: 'Nombre del negocio', category: 'Negocio' },
  { key: '{sucursal}', description: 'Nombre de la sucursal', category: 'Negocio' },
  { key: '{direccion}', description: 'Dirección de la sucursal', category: 'Negocio' },
  { key: '{telefono_negocio}', description: 'Teléfono del negocio', category: 'Negocio' },
  { key: '{whatsapp}', description: 'WhatsApp del negocio', category: 'Negocio' },

  // Variables de staff
  { key: '{especialista}', description: 'Nombre del especialista', category: 'Staff' },
  { key: '{especialidad}', description: 'Especialidad del profesional', category: 'Staff' },

  // Variables de tiempo
  { key: '{hora_actual}', description: 'Hora actual', category: 'Tiempo' },
  { key: '{dia_semana}', description: 'Día de la semana', category: 'Tiempo' },
  { key: '{saludo_tiempo}', description: 'Buenos días/tardes/noches', category: 'Tiempo' },
];

// Tipo para una variable individual
type TemplateVariable = {
  key: string;
  description: string;
  category: string;
};

// Agrupar variables por categoría
const VARIABLES_BY_CATEGORY = AVAILABLE_VARIABLES.reduce((acc, variable) => {
  if (!acc[variable.category]) {
    acc[variable.category] = [];
  }
  acc[variable.category].push(variable);
  return acc;
}, {} as Record<string, TemplateVariable[]>);

// ======================
// MAIN COMPONENT
// ======================
export function KnowledgeBase() {
  const { tenant, isAdmin, branches } = useAuthContext();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('instructions');
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

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ActiveTab>('instructions');
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);

  // Form States
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // ======================
  // BRANCH FILTERING
  // ======================
  // Filtrar datos por sucursal seleccionada
  const filteredData = useMemo(() => {
    if (!selectedBranchId) {
      return data; // Mostrar todos si no hay filtro
    }

    return {
      instructions: data.instructions.filter(
        i => !i.branch_id || i.branch_id === selectedBranchId
      ),
      policies: data.policies.filter(
        p => !p.branch_id || p.branch_id === selectedBranchId
      ),
      articles: data.articles.filter(
        a => !a.branch_id || a.branch_id === selectedBranchId
      ),
      templates: data.templates.filter(
        t => !t.branch_id || t.branch_id === selectedBranchId
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

  // Get status summary for UI
  const statusSummary = useMemo(() => getKBStatusSummary(scoringResult), [scoringResult]);

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
    // Validación del formulario según el tipo
    const requiredFields: Record<ActiveTab, string[]> = {
      instructions: ['instruction_type', 'title', 'instruction'],
      policies: ['policy_type', 'title', 'policy_text'],
      articles: ['category', 'title', 'content'],
      templates: ['trigger_type', 'name', 'template_text'],
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
      const typeMap: Record<ActiveTab, string> = {
        instructions: 'instructions',
        policies: 'policies',
        articles: 'articles',
        templates: 'templates',
        competitors: 'competitors',
      };

      // Preparar datos a guardar
      let dataToSave = { ...formData };

      // Si es plantilla, auto-detectar variables usadas
      if (modalType === 'templates' && formData.template_text) {
        const detectedVariables = AVAILABLE_VARIABLES
          .filter(v => (formData.template_text as string).includes(v.key))
          .map(v => v.key);

        dataToSave.variables_available = detectedVariables;
      }

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
        showToast({
          type: 'error',
          message: result.error || 'Error al guardar',
        });
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

  const openAddModal = (type: ActiveTab) => {
    setModalType(type);
    setEditingItem(null);
    // Set initial form data based on type - each table has different columns
    const initialData: Record<string, unknown> = {
      is_active: true,
    };
    // Only add type-specific fields
    if (type === 'instructions') {
      initialData.priority = 0;
    } else if (type === 'articles') {
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
  // Usar filteredData para los contadores para reflejar el filtro de sucursal
  const tabs = [
    {
      id: 'instructions' as ActiveTab,
      label: 'Instrucciones',
      icon: icons.instructions,
      count: filteredData.instructions.length,
      description: 'Define cómo debe comportarse tu asistente',
    },
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
      id: 'templates' as ActiveTab,
      label: 'Plantillas',
      icon: icons.templates,
      count: filteredData.templates.length,
      description: 'Respuestas predefinidas para situaciones comunes',
    },
    {
      id: 'competitors' as ActiveTab,
      label: 'Competencia',
      icon: icons.competitors,
      count: filteredData.competitors.length,
      description: 'Cómo responder cuando mencionan a la competencia',
    },
  ];

  // ======================
  // QUICK STATS CALCULATION
  // ======================
  const totalItems = data.instructions.length + data.policies.length + data.articles.length + data.templates.length + data.competitors.length;
  const activeItems =
    data.instructions.filter(i => i.is_active).length +
    data.policies.filter(p => p.is_active).length +
    data.articles.filter(a => a.is_active).length +
    data.templates.filter(t => t.is_active).length +
    data.competitors.filter(c => c.is_active).length;

  // Use unified scoring result for completion percentage
  // This ensures header and KBCompletenessIndicator show the same score
  const completionScore = scoringResult.totalScore;

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return <KnowledgeBasePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient and QuickStats */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 rounded-2xl p-6 border border-purple-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            {icons.brain}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Base de Conocimiento
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                {icons.sparkles}
                Pro
              </span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Personaliza completamente cómo tu asistente de AI conoce y representa tu negocio.
              Esta información se inyecta automáticamente en cada conversación.
            </p>
          </div>
        </div>

        {/* Quick Stats - Premium Design */}
        <div className="mt-5 pt-5 border-t border-purple-200/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Completion Score */}
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white/50">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-purple-100"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${completionScore * 1.256} 125.6`}
                      className={cn(
                        statusSummary.color === 'green' ? 'text-green-500' :
                        statusSummary.color === 'blue' ? 'text-blue-500' :
                        statusSummary.color === 'amber' ? 'text-amber-500' : 'text-red-500'
                      )}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn(
                      'text-xs font-bold',
                      statusSummary.color === 'green' ? 'text-green-600' :
                      statusSummary.color === 'blue' ? 'text-blue-600' :
                      statusSummary.color === 'amber' ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {completionScore}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Completado</p>
                  <p className={cn(
                    'text-sm font-semibold',
                    statusSummary.color === 'green' ? 'text-green-600' :
                    statusSummary.color === 'blue' ? 'text-blue-600' :
                    statusSummary.color === 'amber' ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {statusSummary.title}
                  </p>
                </div>
              </div>
            </div>

            {/* Total Items */}
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                  {icons.chart}
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total</p>
                  <p className="text-xl font-bold text-gray-900">{totalItems}</p>
                </div>
              </div>
            </div>

            {/* Active Items */}
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white">
                  {icons.checkCircle}
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Activos</p>
                  <p className="text-xl font-bold text-green-600">{activeItems}</p>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
                  {icons.articles}
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Categorías</p>
                  <p className="text-xl font-bold text-gray-900">5</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress hint */}
          {completionScore < 100 && (
            <div className="mt-4 flex items-center gap-2 text-xs text-purple-700 bg-purple-100/50 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {completionScore < 50
                  ? 'Agrega más instrucciones y políticas para que tu asistente sea más efectivo'
                  : completionScore < 80
                    ? 'Estás en buen camino. Considera agregar plantillas de respuesta'
                    : 'Casi completo. Agrega información sobre la competencia para maximizar tu base'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Branch Filter - Only show if multiple branches */}
      {branches && branches.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Filtrar por sucursal:
            </div>

            {/* All branches button */}
            <button
              onClick={() => setSelectedBranchId(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                selectedBranchId === null
                  ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-purple-200 hover:bg-purple-50'
              )}
            >
              Todas
            </button>

            {/* Individual branch buttons */}
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  selectedBranchId === branch.id
                    ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-purple-200 hover:bg-purple-50'
                )}
              >
                {branch.name}
                {branch.is_headquarters && (
                  <span className="ml-1 text-xs text-purple-400">(Matriz)</span>
                )}
              </button>
            ))}
          </div>

          {/* Info hint */}
          <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Los items sin sucursal asignada aplican a todo el negocio
          </p>
        </div>
      )}

      {/* Premium Tab Navigation */}
      <div className="relative">
        {/* Tab Container with subtle shadow */}
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-1.5">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                {/* Icon */}
                <div className={cn(
                  'transition-transform duration-200',
                  activeTab === tab.id && 'scale-110'
                )}>
                  {tab.icon}
                </div>

                {/* Label */}
                <span className={cn(
                  'font-medium text-sm hidden sm:block',
                  activeTab === tab.id ? 'text-white' : ''
                )}>
                  {tab.label}
                </span>

                {/* Count Badge */}
                {tab.count > 0 && (
                  <span className={cn(
                    'text-xs font-semibold min-w-[20px] h-5 flex items-center justify-center rounded-full',
                    activeTab === tab.id
                      ? 'bg-white/25 text-white'
                      : 'bg-gray-100 text-gray-600'
                  )}>
                    {tab.count}
                  </span>
                )}

                {/* Active indicator glow effect */}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabGlow"
                    className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl -z-10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeTab}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-gray-500 text-center mt-3"
          >
            {tabs.find(t => t.id === activeTab)?.description}
          </motion.p>
        </AnimatePresence>
      </div>

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
            {/* Instructions Tab */}
            {activeTab === 'instructions' && (
              <div className="space-y-6">
                {/* Header with action button */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Instrucciones Personalizadas</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Define reglas específicas para tu asistente de AI
                    </p>
                  </div>
                  <button
                    onClick={() => openAddModal('instructions')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva Instrucción
                  </button>
                </div>

                {filteredData.instructions.length === 0 ? (
                  <EmptyState
                    icon={icons.instructions}
                    title="Sin instrucciones aún"
                    description="Agrega instrucciones personalizadas para que tu asistente sepa exactamente cómo comportarse"
                    action={() => openAddModal('instructions')}
                    actionLabel="Agregar Instrucción"
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.instructions.map((item) => (
                      <ItemCard
                        key={item.id}
                        type={instructionTypes.find(t => t.value === item.instruction_type)?.label || item.instruction_type}
                        title={item.title}
                        content={item.instruction}
                        isActive={item.is_active}
                        branchName={getBranchName(item.branch_id)}
                        onEdit={() => openEditModal('instructions', item)}
                        onDelete={() => handleDelete('instructions', item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Políticas del Negocio</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      El AI comunicará estas políticas cuando sea relevante
                    </p>
                  </div>
                  <button
                    onClick={() => openAddModal('policies')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva Política
                  </button>
                </div>

                {filteredData.policies.length === 0 ? (
                  <EmptyState
                    icon={icons.policies}
                    title="Sin políticas aún"
                    description="Define tus políticas de cancelación, pagos, garantías, etc."
                    action={() => openAddModal('policies')}
                    actionLabel="Agregar Política"
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.policies.map((item) => (
                      <ItemCard
                        key={item.id}
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
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Información del Negocio</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Conocimiento adicional que el AI debe tener sobre tu negocio
                    </p>
                  </div>
                  <button
                    onClick={() => openAddModal('articles')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva Información
                  </button>
                </div>

                {filteredData.articles.length === 0 ? (
                  <EmptyState
                    icon={icons.articles}
                    title="Sin información adicional"
                    description="Agrega información sobre tu negocio: diferenciadores, tecnología, certificaciones..."
                    action={() => openAddModal('articles')}
                    actionLabel="Agregar Información"
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.articles.map((item) => (
                      <ItemCard
                        key={item.id}
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

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Plantillas de Respuesta</h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Respuestas sugeridas para situaciones comunes
                    </p>
                  </div>
                  <button
                    onClick={() => openAddModal('templates')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva Plantilla
                  </button>
                </div>

                {filteredData.templates.length === 0 ? (
                  <EmptyState
                    icon={icons.templates}
                    title="Sin plantillas aún"
                    description="Crea plantillas para saludos, despedidas, confirmaciones, etc."
                    action={() => openAddModal('templates')}
                    actionLabel="Agregar Plantilla"
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.templates.map((item) => (
                      <ItemCard
                        key={item.id}
                        type={templateTriggers.find(t => t.value === item.trigger_type)?.label || item.trigger_type}
                        title={item.name}
                        content={item.template_text}
                        isActive={item.is_active}
                        branchName={getBranchName(item.branch_id)}
                        onEdit={() => openEditModal('templates', item)}
                        onDelete={() => handleDelete('templates', item.id)}
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
                  </div>
                  <button
                    onClick={() => openAddModal('competitors')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
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
                  <EmptyState
                    icon={icons.competitors}
                    title="Sin competidores configurados"
                    description="Agrega competidores y define cómo quieres que el AI responda cuando los mencionen"
                    action={() => openAddModal('competitors')}
                    actionLabel="Agregar Competidor"
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredData.competitors.map((item) => (
                      <CompetitorCard
                        key={item.id}
                        name={item.competitor_name}
                        strategy={competitorStrategies.find(s => s.value === item.response_strategy)?.label || item.response_strategy}
                        talkingPoints={item.talking_points || []}
                        isActive={item.is_active}
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

        {/* Prompt Preview */}
        <div className="pt-4">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Vista Previa de Prompts
          </h4>
          <PromptPreview />
        </div>
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
                      {/* Dynamic Icon based on type */}
                      <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white">
                        {modalType === 'instructions' && icons.instructions}
                        {modalType === 'policies' && icons.policies}
                        {modalType === 'articles' && icons.articles}
                        {modalType === 'templates' && icons.templates}
                        {modalType === 'competitors' && icons.competitors}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {editingItem ? 'Editar' : (modalType === 'competitors' ? 'Nuevo' : 'Nueva')} {
                            modalType === 'instructions' ? 'Instrucción' :
                            modalType === 'policies' ? 'Política' :
                            modalType === 'articles' ? 'Información' :
                            modalType === 'templates' ? 'Plantilla' : 'Competidor'
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
                {/* Instructions Form - Premium Design */}
                {modalType === 'instructions' && (
                  <>
                    {/* Step 1: Type Selection */}
                    <FormSection
                      step={1}
                      title="¿Qué tipo de instrucción?"
                      description="Selecciona la categoría que mejor describe esta instrucción"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {instructionTypes.slice(0, 6).map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, instruction_type: type.value })}
                            className={cn(
                              'p-3 rounded-xl border-2 text-left transition-all',
                              formData.instruction_type === type.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            )}
                          >
                            <p className={cn(
                              'text-sm font-medium',
                              formData.instruction_type === type.value ? 'text-purple-700' : 'text-gray-700'
                            )}>
                              {type.label}
                            </p>
                          </button>
                        ))}
                      </div>

                      {/* More options dropdown */}
                      <details className="mt-3">
                        <summary className="text-sm text-purple-600 cursor-pointer hover:text-purple-700">
                          Ver más opciones...
                        </summary>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {instructionTypes.slice(6).map((type) => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, instruction_type: type.value })}
                              className={cn(
                                'p-3 rounded-xl border-2 text-left transition-all',
                                formData.instruction_type === type.value
                                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              )}
                            >
                              <p className={cn(
                                'text-sm font-medium',
                                formData.instruction_type === type.value ? 'text-purple-700' : 'text-gray-700'
                              )}>
                                {type.label}
                              </p>
                            </button>
                          ))}
                        </div>
                      </details>
                    </FormSection>

                    {/* Step 2: Title */}
                    <FormSection
                      step={2}
                      title="Nombre de la instrucción"
                      description="Un título corto para identificarla fácilmente"
                    >
                      <input
                        type="text"
                        value={formData.title as string || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ej: Servicio Premium Dr. Estrella"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors"
                      />
                    </FormSection>

                    {/* Step 3: Instruction */}
                    <FormSection
                      step={3}
                      title="La instrucción"
                      description="Describe exactamente cómo debe comportarse tu asistente"
                    >
                      <textarea
                        value={formData.instruction as string || ''}
                        onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                        placeholder="Cuando el cliente pregunte por..."
                        rows={5}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                      <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-amber-700">
                          <strong>Tip:</strong> Sé específico. En lugar de &quot;habla bien del servicio&quot;, di &quot;menciona que tiene 15 años de experiencia y certificación internacional&quot;.
                        </p>
                      </div>
                    </FormSection>

                    {/* Step 4: Examples (Optional) */}
                    <FormSection
                      step={4}
                      title="Ejemplos de respuesta"
                      description="Opcional: Muestra cómo debería responder idealmente"
                      optional
                    >
                      <textarea
                        value={formData.examples as string || ''}
                        onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                        placeholder="Ejemplo de respuesta ideal:&#10;&#10;&quot;El Dr. Estrella es nuestro especialista premium en ortodoncia...&quot;"
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                    </FormSection>
                  </>
                )}

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

                {/* Templates Form - Premium Design */}
                {modalType === 'templates' && (
                  <>
                    <FormSection
                      step={1}
                      title="¿Cuándo usar esta plantilla?"
                      description="Selecciona la situación donde el AI debería usar esta respuesta"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {templateTriggers.map((trigger) => (
                          <button
                            key={trigger.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, trigger_type: trigger.value })}
                            className={cn(
                              'p-3 rounded-xl border-2 text-left transition-all',
                              formData.trigger_type === trigger.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            )}
                          >
                            <p className={cn(
                              'text-sm font-medium',
                              formData.trigger_type === trigger.value ? 'text-purple-700' : 'text-gray-700'
                            )}>
                              {trigger.label}
                            </p>
                          </button>
                        ))}
                      </div>
                    </FormSection>

                    <FormSection
                      step={2}
                      title="Nombre de la plantilla"
                      description="Un nombre para identificarla"
                    >
                      <input
                        type="text"
                        value={formData.name as string || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej: Bienvenida Amigable"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors"
                      />
                    </FormSection>

                    <FormSection
                      step={3}
                      title="Texto de la plantilla"
                      description="El mensaje que usará el AI como referencia"
                    >
                      <textarea
                        id="template-textarea"
                        value={formData.template_text as string || ''}
                        onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}
                        placeholder="¡Hola {nombre}! Gracias por contactarnos. Tu cita para {servicio} está programada el {fecha} a las {hora}..."
                        rows={5}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none font-mono text-sm"
                      />

                      {/* Variables Section - Premium Design */}
                      <div className="mt-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-purple-700">Variables dinámicas disponibles</p>
                          <button
                            type="button"
                            onClick={() => {
                              // Toggle variable panel
                              const panel = document.getElementById('variables-panel');
                              if (panel) panel.classList.toggle('hidden');
                            }}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Ver todas
                          </button>
                        </div>

                        {/* Quick variables - most used */}
                        <div className="flex flex-wrap gap-1.5">
                          {['{nombre}', '{servicio}', '{fecha}', '{hora}', '{sucursal}', '{saludo_tiempo}'].map((v) => {
                            const isUsed = (formData.template_text as string || '').includes(v);
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => {
                                  const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
                                  const start = textarea?.selectionStart || (formData.template_text as string || '').length;
                                  const before = (formData.template_text as string || '').substring(0, start);
                                  const after = (formData.template_text as string || '').substring(start);
                                  setFormData({ ...formData, template_text: before + v + after });
                                }}
                                className={cn(
                                  'text-xs px-2 py-1 rounded-md transition-colors font-mono',
                                  isUsed
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : 'bg-white text-purple-700 hover:bg-purple-100 border border-purple-200'
                                )}
                              >
                                {v}
                                {isUsed && ' ✓'}
                              </button>
                            );
                          })}
                        </div>

                        {/* Expandable full variables panel */}
                        <div id="variables-panel" className="hidden mt-3 pt-3 border-t border-purple-200/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(Object.entries(VARIABLES_BY_CATEGORY) as [string, TemplateVariable[]][]).map(([category, variables]) => (
                              <div key={category}>
                                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1.5">
                                  {category}
                                </p>
                                <div className="space-y-1">
                                  {variables.map((variable) => {
                                    const isUsed = (formData.template_text as string || '').includes(variable.key);
                                    return (
                                      <button
                                        key={variable.key}
                                        type="button"
                                        onClick={() => {
                                          const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
                                          const start = textarea?.selectionStart || (formData.template_text as string || '').length;
                                          const before = (formData.template_text as string || '').substring(0, start);
                                          const after = (formData.template_text as string || '').substring(start);
                                          setFormData({ ...formData, template_text: before + variable.key + after });
                                        }}
                                        className={cn(
                                          'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-colors',
                                          isUsed
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-white hover:bg-purple-50 text-gray-700'
                                        )}
                                      >
                                        <span>
                                          <code className={cn('font-mono', isUsed ? 'text-green-600' : 'text-purple-600')}>
                                            {variable.key}
                                          </code>
                                          <span className="text-gray-500 ml-1">- {variable.description}</span>
                                        </span>
                                        {isUsed && <span className="text-green-500 text-xs">✓</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Preview of used variables */}
                      {typeof formData.template_text === 'string' && formData.template_text && AVAILABLE_VARIABLES.some(v => (formData.template_text as string).includes(v.key)) && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Variables en uso:</p>
                          <div className="flex flex-wrap gap-1">
                            {AVAILABLE_VARIABLES
                              .filter(v => (formData.template_text as string).includes(v.key))
                              .map(v => (
                                <span
                                  key={v.key}
                                  className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full font-mono"
                                >
                                  {v.key}
                                </span>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </FormSection>
                  </>
                )}

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
 * EmptyState - Premium empty state with illustration
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
}) {
  return (
    <div className="relative overflow-hidden text-center py-16 px-6 bg-gradient-to-br from-gray-50 via-white to-purple-50/30 rounded-2xl border border-gray-100">
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="emptyGrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#emptyGrid)" />
        </svg>
      </div>

      <div className="relative">
        {/* Icon container with gradient */}
        <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-purple-500 shadow-lg shadow-purple-500/10">
          {icon}
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
        <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed">{description}</p>

        <button
          onClick={action}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * ItemCard - Premium card for knowledge base items
 */
function ItemCard({
  type,
  title,
  content,
  isActive,
  branchName,
  onEdit,
  onDelete,
}: {
  type: string;
  title: string;
  content: string;
  isActive: boolean;
  branchName?: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative p-5 rounded-2xl border-2 transition-all duration-200',
        isActive
          ? 'bg-white border-gray-100 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-500/5'
          : 'bg-gray-50/50 border-gray-100 opacity-50'
      )}
    >
      {/* Active indicator dot */}
      <div className={cn(
        'absolute top-4 right-4 w-2.5 h-2.5 rounded-full transition-colors',
        isActive ? 'bg-green-400' : 'bg-gray-300'
      )} />

      <div className="flex items-start gap-4">
        {/* Left side: Content */}
        <div className="flex-1 min-w-0">
          {/* Type and Branch badges */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg',
              isActive
                ? 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700'
                : 'bg-gray-100 text-gray-500'
            )}>
              {type}
            </span>
            {/* Branch Badge - Only show if item has a specific branch */}
            {branchName && (
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg',
                isActive
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'bg-gray-100 text-gray-500'
              )}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {branchName}
              </span>
            )}
            {!isActive && (
              <span className="text-xs text-gray-400 italic">Pausado</span>
            )}
          </div>

          {/* Title */}
          <h5 className={cn(
            'font-semibold text-base mb-1.5',
            isActive ? 'text-gray-900' : 'text-gray-500'
          )}>
            {title}
          </h5>

          {/* Preview content */}
          <p className={cn(
            'text-sm leading-relaxed line-clamp-2',
            isActive ? 'text-gray-600' : 'text-gray-400'
          )}>
            {content}
          </p>
        </div>

        {/* Right side: Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Eliminar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * CompetitorCard - Premium card for competitor handling configuration
 */
function CompetitorCard({
  name,
  strategy,
  talkingPoints,
  isActive,
  onEdit,
  onDelete,
}: {
  name: string;
  strategy: string;
  talkingPoints: string[];
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative p-5 rounded-2xl border-2 transition-all duration-200',
        isActive
          ? 'bg-white border-gray-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/5'
          : 'bg-gray-50/50 border-gray-100 opacity-50'
      )}
    >
      {/* Active indicator dot */}
      <div className={cn(
        'absolute top-4 right-4 w-2.5 h-2.5 rounded-full transition-colors',
        isActive ? 'bg-green-400' : 'bg-gray-300'
      )} />

      <div className="flex items-start gap-4">
        {/* Left side: Icon */}
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          isActive
            ? 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600'
            : 'bg-gray-100 text-gray-400'
        )}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>

        {/* Middle: Content */}
        <div className="flex-1 min-w-0">
          {/* Strategy badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg',
              isActive
                ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700'
                : 'bg-gray-100 text-gray-500'
            )}>
              {strategy}
            </span>
            {!isActive && (
              <span className="text-xs text-gray-400 italic">Pausado</span>
            )}
          </div>

          {/* Name */}
          <h5 className={cn(
            'font-semibold text-base mb-1.5',
            isActive ? 'text-gray-900' : 'text-gray-500'
          )}>
            {name}
          </h5>

          {/* Talking points preview */}
          {talkingPoints.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {talkingPoints.slice(0, 3).map((point, index) => (
                <span
                  key={index}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-md',
                    isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {point.length > 30 ? point.substring(0, 30) + '...' : point}
                </span>
              ))}
              {talkingPoints.length > 3 && (
                <span className="text-xs text-gray-400">+{talkingPoints.length - 3} más</span>
              )}
            </div>
          )}
        </div>

        {/* Right side: Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Eliminar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
