// =====================================================
// TIS TIS PLATFORM - Knowledge Base Component
// Manage AI knowledge: instructions, policies, articles
// Premium UI with professional design
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, Button, Input } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { cn } from '@/src/shared/utils';

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

interface KnowledgeBaseData {
  instructions: CustomInstruction[];
  policies: BusinessPolicy[];
  articles: KnowledgeArticle[];
  templates: ResponseTemplate[];
  competitors: Array<{
    id: string;
    competitor_name: string;
    response_strategy: string;
    talking_points?: string[];
    is_active: boolean;
  }>;
}

type ActiveTab = 'instructions' | 'policies' | 'articles' | 'templates';

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

// ======================
// MAIN COMPONENT
// ======================
export function KnowledgeBase() {
  const { tenant, isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('instructions');
  const [data, setData] = useState<KnowledgeBaseData>({
    instructions: [],
    policies: [],
    articles: [],
    templates: [],
    competitors: [],
  });

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ActiveTab>('instructions');
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);

  // Form States
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // ======================
  // BODY SCROLL LOCK - Simple approach
  // ======================
  useEffect(() => {
    if (showModal) {
      // Solo bloquear overflow, sin position fixed que rompe el layout
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  // ======================
  // DATA FETCHING
  // ======================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/knowledge-base');
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ======================
  // CRUD OPERATIONS
  // ======================
  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = '/api/knowledge-base';
      const method = editingItem?.id ? 'PATCH' : 'POST';
      const typeMap: Record<ActiveTab, string> = {
        instructions: 'instructions',
        policies: 'policies',
        articles: 'articles',
        templates: 'templates',
      };

      const body = editingItem?.id
        ? { type: typeMap[modalType], id: editingItem.id, data: formData }
        : { type: typeMap[modalType], data: formData };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchData();
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
      } else {
        const error = await response.json();
        console.error('Save error:', error);
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;

    try {
      const response = await fetch(`/api/knowledge-base?type=${type}&id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const openAddModal = (type: ActiveTab) => {
    setModalType(type);
    setEditingItem(null);
    setFormData({
      is_active: true,
      priority: 0,
      display_order: 0,
    });
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
  const tabs = [
    {
      id: 'instructions' as ActiveTab,
      label: 'Instrucciones',
      icon: icons.instructions,
      count: data.instructions.length,
      description: 'Define cómo debe comportarse tu asistente',
    },
    {
      id: 'policies' as ActiveTab,
      label: 'Políticas',
      icon: icons.policies,
      count: data.policies.length,
      description: 'Políticas del negocio que el AI debe conocer',
    },
    {
      id: 'articles' as ActiveTab,
      label: 'Información',
      icon: icons.articles,
      count: data.articles.length,
      description: 'Conocimiento adicional sobre tu negocio',
    },
    {
      id: 'templates' as ActiveTab,
      label: 'Plantillas',
      icon: icons.templates,
      count: data.templates.length,
      description: 'Respuestas predefinidas para situaciones comunes',
    },
  ];

  // ======================
  // RENDER
  // ======================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
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
      </div>

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

                {data.instructions.length === 0 ? (
                  <EmptyState
                    icon={icons.instructions}
                    title="Sin instrucciones aún"
                    description="Agrega instrucciones personalizadas para que tu asistente sepa exactamente cómo comportarse"
                    action={() => openAddModal('instructions')}
                    actionLabel="Agregar Instrucción"
                  />
                ) : (
                  <div className="space-y-3">
                    {data.instructions.map((item) => (
                      <ItemCard
                        key={item.id}
                        type={instructionTypes.find(t => t.value === item.instruction_type)?.label || item.instruction_type}
                        title={item.title}
                        content={item.instruction}
                        isActive={item.is_active}
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

                {data.policies.length === 0 ? (
                  <EmptyState
                    icon={icons.policies}
                    title="Sin políticas aún"
                    description="Define tus políticas de cancelación, pagos, garantías, etc."
                    action={() => openAddModal('policies')}
                    actionLabel="Agregar Política"
                  />
                ) : (
                  <div className="space-y-3">
                    {data.policies.map((item) => (
                      <ItemCard
                        key={item.id}
                        type={policyTypes.find(t => t.value === item.policy_type)?.label || item.policy_type}
                        title={item.title}
                        content={item.policy_text}
                        isActive={item.is_active}
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

                {data.articles.length === 0 ? (
                  <EmptyState
                    icon={icons.articles}
                    title="Sin información adicional"
                    description="Agrega información sobre tu negocio: diferenciadores, tecnología, certificaciones..."
                    action={() => openAddModal('articles')}
                    actionLabel="Agregar Información"
                  />
                ) : (
                  <div className="space-y-3">
                    {data.articles.map((item) => (
                      <ItemCard
                        key={item.id}
                        type={articleCategories.find(t => t.value === item.category)?.label || item.category}
                        title={item.title}
                        content={item.content}
                        isActive={item.is_active}
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

                {data.templates.length === 0 ? (
                  <EmptyState
                    icon={icons.templates}
                    title="Sin plantillas aún"
                    description="Crea plantillas para saludos, despedidas, confirmaciones, etc."
                    action={() => openAddModal('templates')}
                    actionLabel="Agregar Plantilla"
                  />
                ) : (
                  <div className="space-y-3">
                    {data.templates.map((item) => (
                      <ItemCard
                        key={item.id}
                        type={templateTriggers.find(t => t.value === item.trigger_type)?.label || item.trigger_type}
                        title={item.name}
                        content={item.template_text}
                        isActive={item.is_active}
                        onEdit={() => openEditModal('templates', item)}
                        onDelete={() => handleDelete('templates', item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Premium Modal Slide-over */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop with subtle blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-gray-900/20 backdrop-blur-[2px] z-40"
              onClick={() => setShowModal(false)}
            />

            {/* Slide-over Panel */}
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
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
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {editingItem ? 'Editar' : 'Nueva'} {
                            modalType === 'instructions' ? 'Instrucción' :
                            modalType === 'policies' ? 'Política' :
                            modalType === 'articles' ? 'Información' : 'Plantilla'
                          }
                        </h3>
                        <p className="text-sm text-purple-100 mt-0.5">
                          {tabs.find(t => t.id === modalType)?.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                    >
                      {icons.close}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content - Scrollable Area */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-6 pb-24 space-y-5">
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
                        value={formData.template_text as string || ''}
                        onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}
                        placeholder="¡Hola {nombre}! Gracias por contactarnos..."
                        rows={5}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-colors resize-none"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-xs text-gray-500">Variables:</span>
                        {['{nombre}', '{servicio}', '{fecha}', '{hora}', '{sucursal}'].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFormData({ ...formData, template_text: (formData.template_text as string || '') + ' ' + v })}
                            className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </FormSection>
                  </>
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
          </>
        )}
      </AnimatePresence>
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
  onEdit,
  onDelete,
}: {
  type: string;
  title: string;
  content: string;
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
          {/* Type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg',
              isActive
                ? 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700'
                : 'bg-gray-100 text-gray-500'
            )}>
              {type}
            </span>
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
