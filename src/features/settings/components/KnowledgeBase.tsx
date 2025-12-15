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

interface CustomInstruction {
  id: string;
  tenant_id: string;
  branch_id?: string;
  instruction_type: string;
  title: string;
  instruction: string;
  examples?: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface BusinessPolicy {
  id: string;
  tenant_id: string;
  policy_type: string;
  title: string;
  policy_text: string;
  short_version?: string;
  is_active: boolean;
}

interface KnowledgeArticle {
  id: string;
  tenant_id: string;
  branch_id?: string;
  category: string;
  title: string;
  content: string;
  summary?: string;
  display_order: number;
  is_active: boolean;
}

interface ResponseTemplate {
  id: string;
  tenant_id: string;
  branch_id?: string;
  trigger_type: string;
  name: string;
  template_text: string;
  variables_available?: string[];
  is_active: boolean;
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
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);

  // Form States
  const [formData, setFormData] = useState<Record<string, unknown>>({});

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

  const openEditModal = (type: ActiveTab, item: Record<string, unknown>) => {
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

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-white border-purple-200 shadow-sm ring-1 ring-purple-100'
                : 'bg-gray-50 border-transparent hover:bg-white hover:border-gray-200'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              activeTab === tab.id
                ? 'bg-purple-100 text-purple-600'
                : 'bg-gray-100 text-gray-500'
            )}>
              {tab.icon}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-medium text-sm',
                  activeTab === tab.id ? 'text-gray-900' : 'text-gray-600'
                )}>
                  {tab.label}
                </span>
                {tab.count > 0 && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    activeTab === tab.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          {/* Instructions Tab */}
          {activeTab === 'instructions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Instrucciones Personalizadas</h4>
                  <p className="text-sm text-gray-500">
                    Define reglas específicas para tu asistente de AI
                  </p>
                </div>
                <Button onClick={() => openAddModal('instructions')} size="sm">
                  <span className="flex items-center gap-2">
                    {icons.plus}
                    Nueva Instrucción
                  </span>
                </Button>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Políticas del Negocio</h4>
                  <p className="text-sm text-gray-500">
                    El AI comunicará estas políticas cuando sea relevante
                  </p>
                </div>
                <Button onClick={() => openAddModal('policies')} size="sm">
                  <span className="flex items-center gap-2">
                    {icons.plus}
                    Nueva Política
                  </span>
                </Button>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Información del Negocio</h4>
                  <p className="text-sm text-gray-500">
                    Conocimiento adicional que el AI debe tener sobre tu negocio
                  </p>
                </div>
                <Button onClick={() => openAddModal('articles')} size="sm">
                  <span className="flex items-center gap-2">
                    {icons.plus}
                    Nuevo Artículo
                  </span>
                </Button>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Plantillas de Respuesta</h4>
                  <p className="text-sm text-gray-500">
                    Respuestas sugeridas para situaciones comunes
                  </p>
                </div>
                <Button onClick={() => openAddModal('templates')} size="sm">
                  <span className="flex items-center gap-2">
                    {icons.plus}
                    Nueva Plantilla
                  </span>
                </Button>
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
        </CardContent>
      </Card>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setShowModal(false)}
            />

            {/* Modal Panel */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-100 px-6 py-4 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingItem ? 'Editar' : 'Nueva'} {
                        modalType === 'instructions' ? 'Instrucción' :
                        modalType === 'policies' ? 'Política' :
                        modalType === 'articles' ? 'Información' : 'Plantilla'
                      }
                    </h3>
                    <p className="text-sm text-gray-500">
                      {tabs.find(t => t.id === modalType)?.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {icons.close}
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Instructions Form */}
                {modalType === 'instructions' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Instrucción
                      </label>
                      <select
                        value={formData.instruction_type as string || ''}
                        onChange={(e) => setFormData({ ...formData, instruction_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Seleccionar tipo...</option>
                        {instructionTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label} - {type.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Título
                      </label>
                      <Input
                        value={formData.title as string || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ej: Servicio Premium Dr. Estrella"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Instrucción
                      </label>
                      <textarea
                        value={formData.instruction as string || ''}
                        onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                        placeholder="Escribe la instrucción detallada para el AI..."
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Sé específico. Ej: &quot;Cuando pregunten por ortodoncia con el Dr. Estrella, menciona que es un servicio premium con 15 años de experiencia...&quot;
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ejemplos de Respuesta (Opcional)
                      </label>
                      <textarea
                        value={formData.examples as string || ''}
                        onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                        placeholder="Ejemplos de cómo quieres que responda..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Policies Form */}
                {modalType === 'policies' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Política
                      </label>
                      <select
                        value={formData.policy_type as string || ''}
                        onChange={(e) => setFormData({ ...formData, policy_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Seleccionar tipo...</option>
                        {policyTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Título
                      </label>
                      <Input
                        value={formData.title as string || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ej: Política de Cancelación"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Política Completa
                      </label>
                      <textarea
                        value={formData.policy_text as string || ''}
                        onChange={(e) => setFormData({ ...formData, policy_text: e.target.value })}
                        placeholder="Describe la política completa..."
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Versión Corta (Opcional)
                      </label>
                      <textarea
                        value={formData.short_version as string || ''}
                        onChange={(e) => setFormData({ ...formData, short_version: e.target.value })}
                        placeholder="Resumen corto para respuestas rápidas..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Articles Form */}
                {modalType === 'articles' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Categoría
                      </label>
                      <select
                        value={formData.category as string || ''}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Seleccionar categoría...</option>
                        {articleCategories.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Título
                      </label>
                      <Input
                        value={formData.title as string || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ej: Nuestra Tecnología 3D"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contenido
                      </label>
                      <textarea
                        value={formData.content as string || ''}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Describe la información que el AI debe conocer..."
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Resumen (Opcional)
                      </label>
                      <textarea
                        value={formData.summary as string || ''}
                        onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                        placeholder="Resumen breve para respuestas rápidas..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Templates Form */}
                {modalType === 'templates' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Situación
                      </label>
                      <select
                        value={formData.trigger_type as string || ''}
                        onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Seleccionar situación...</option>
                        {templateTriggers.map((trigger) => (
                          <option key={trigger.value} value={trigger.value}>
                            {trigger.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre de la Plantilla
                      </label>
                      <Input
                        value={formData.name as string || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej: Saludo Bienvenida"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Texto de la Plantilla
                      </label>
                      <textarea
                        value={formData.template_text as string || ''}
                        onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}
                        placeholder="Escribe la plantilla de respuesta...&#10;&#10;Puedes usar variables como {nombre}, {servicio}, {fecha}"
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Variables disponibles: {'{nombre}'}, {'{servicio}'}, {'{fecha}'}, {'{hora}'}, {'{sucursal}'}
                      </p>
                    </div>
                  </>
                )}

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Activo</p>
                    <p className="text-xs text-gray-500">El AI usará este elemento en sus respuestas</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.is_active as boolean ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-6 py-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Guardando...
                      </span>
                    ) : (
                      editingItem ? 'Guardar Cambios' : 'Crear'
                    )}
                  </Button>
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
    <div className="text-center py-12 bg-gray-50 rounded-xl">
      <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-4 text-gray-400">
        {icon}
      </div>
      <h4 className="text-gray-900 font-medium mb-1">{title}</h4>
      <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">{description}</p>
      <Button onClick={action} size="sm" variant="outline">
        {actionLabel}
      </Button>
    </div>
  );
}

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
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      isActive
        ? 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-sm'
        : 'bg-gray-50 border-gray-100 opacity-60'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              {type}
            </span>
            {!isActive && (
              <span className="text-xs text-gray-400">Inactivo</span>
            )}
          </div>
          <h5 className="font-medium text-gray-900 truncate">{title}</h5>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{content}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Editar"
          >
            {icons.edit}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar"
          >
            {icons.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
