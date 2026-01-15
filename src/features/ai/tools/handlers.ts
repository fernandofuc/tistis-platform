// =====================================================
// TIS TIS PLATFORM - Tool Handlers
// Implementación de la lógica de cada tool
// =====================================================
//
// Este archivo implementa los handlers para cada tool.
// Los handlers reciben los parámetros validados y retornan
// los datos solicitados desde el estado o la base de datos.
//
// IMPORTANTE: Los handlers acceden al business_context del estado
// para obtener la información. NO hacen queries directos a la BD
// para mantener consistencia con el modelo actual.
//
// FUTURO: Cuando implementemos RAG, search_knowledge_base
// hará queries con embeddings a Supabase.
// =====================================================

import type { TISTISAgentStateType, BusinessContext } from '../state';
import type {
  ServiceInfo,
  ServiceListItem,
  AvailableSlot,
  BranchInfo,
  PolicyInfo,
  KnowledgeBaseResult,
  StaffInfo,
  AppointmentResult,
  LeadUpdateResult,
  OperatingHours,
  FaqAnswer,
  // Restaurant types
  MenuItem,
  MenuCategory,
  OrderResult,
  OrderItem,
  ItemAvailability,
  Promotion,
} from './definitions';

// ======================
// CONTEXT TYPE
// ======================

/**
 * Contexto necesario para ejecutar tools
 * Se extrae del TISTISAgentStateType
 */
export interface ToolContext {
  tenant_id: string;
  lead_id: string;
  business_context: BusinessContext | null;
  lead: TISTISAgentStateType['lead'];
}

// ======================
// TYPE HELPERS
// ======================

type Service = NonNullable<BusinessContext['services']>[number];
type Faq = NonNullable<BusinessContext['faqs']>[number];
type MenuItemDB = NonNullable<BusinessContext['menu_items']>[number];
type MenuCategoryDB = NonNullable<BusinessContext['menu_categories']>[number];
type PromotionDB = NonNullable<BusinessContext['promotions']>[number];

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Formatea precio como string
 */
function formatPrice(min: number, max: number): string {
  if (min === max) {
    return `$${min.toLocaleString('es-MX')}`;
  }
  return `$${min.toLocaleString('es-MX')} - $${max.toLocaleString('es-MX')}`;
}

/**
 * Busca servicio por nombre (fuzzy match)
 */
function findServiceByName(
  services: Service[],
  searchName: string
): Service | null {
  const lowerSearch = searchName.toLowerCase();

  // Búsqueda exacta primero
  const exact = services.find((s) => s.name.toLowerCase() === lowerSearch);
  if (exact) return exact;

  // Búsqueda parcial
  const partial = services.find((s) => s.name.toLowerCase().includes(lowerSearch));
  if (partial) return partial;

  // Búsqueda en palabras clave
  const byKeyword = services.find((s) =>
    lowerSearch.split(' ').some((word) =>
      s.name.toLowerCase().includes(word) && word.length > 3
    )
  );
  if (byKeyword) return byKeyword;

  return null;
}

/**
 * Busca FAQ por pregunta (fuzzy match)
 */
function findFaqByQuestion(
  faqs: Faq[],
  searchQuestion: string
): Faq | null {
  const lowerSearch = searchQuestion.toLowerCase();

  // Búsqueda en pregunta
  const byQuestion = faqs.find((f) =>
    f.question.toLowerCase().includes(lowerSearch) ||
    lowerSearch.includes(f.question.toLowerCase())
  );
  if (byQuestion) return byQuestion;

  // Búsqueda en respuesta (si contiene la palabra clave)
  const byAnswer = faqs.find((f) =>
    lowerSearch.split(' ').some((word) =>
      f.answer.toLowerCase().includes(word) && word.length > 4
    )
  );
  if (byAnswer) return byAnswer;

  return null;
}

// ======================
// TOOL HANDLERS
// ======================

/**
 * Handler: get_service_info
 * Obtiene información detallada de un servicio
 */
export async function handleGetServiceInfo(
  params: { service_name: string },
  context: ToolContext
): Promise<ServiceInfo | { error: string }> {
  const { business_context } = context;

  if (!business_context?.services || business_context.services.length === 0) {
    return { error: 'No hay servicios configurados en este negocio' };
  }

  const service = findServiceByName(business_context.services, params.service_name);

  if (!service) {
    // Sugerir servicios similares
    const suggestions = business_context.services
      .slice(0, 3)
      .map((s) => s.name)
      .join(', ');
    return {
      error: `No encontré un servicio llamado "${params.service_name}". Servicios disponibles: ${suggestions}`,
    };
  }

  return {
    id: service.id,
    name: service.name,
    price_min: service.price_min,
    price_max: service.price_max,
    price_note: service.price_note || null,
    duration_minutes: service.duration_minutes || 60,
    description: service.description || '',
    requires_consultation: service.requires_consultation || false,
    promotion_active: service.promotion_active || false,
    promotion_text: service.promotion_text || null,
    category: service.category || null,
  };
}

/**
 * Handler: list_services
 * Lista todos los servicios disponibles
 */
export async function handleListServices(
  params: { category?: string },
  context: ToolContext
): Promise<ServiceListItem[] | { error: string }> {
  const { business_context } = context;

  if (!business_context?.services || business_context.services.length === 0) {
    return { error: 'No hay servicios configurados en este negocio' };
  }

  let services = business_context.services;

  // Filtrar por categoría si se especifica
  if (params.category) {
    const lowerCategory = params.category.toLowerCase();
    services = services.filter((s) =>
      s.category?.toLowerCase().includes(lowerCategory)
    );

    if (services.length === 0) {
      return { error: `No hay servicios en la categoría "${params.category}"` };
    }
  }

  return services.map((s) => ({
    id: s.id,
    name: s.name,
    price_range: formatPrice(s.price_min, s.price_max),
    category: s.category || 'General',
    duration_minutes: s.duration_minutes || 60,
  }));
}

/**
 * Handler: get_available_slots
 * Obtiene horarios disponibles
 *
 * NOTA: Esta es una implementación placeholder.
 * En producción debería consultar el sistema de calendario real.
 */
export async function handleGetAvailableSlots(
  params: {
    date?: string;
    branch_id?: string;
    staff_id?: string;
    service_id?: string;
  },
  context: ToolContext
): Promise<AvailableSlot[] | { error: string }> {
  const { business_context } = context;

  // Obtener sucursal (si se especifica o usar la primera disponible)
  let branch = business_context?.branches?.[0];
  if (params.branch_id) {
    branch = business_context?.branches?.find((b) => b.id === params.branch_id);
  }

  if (!branch) {
    return { error: 'No hay sucursales configuradas' };
  }

  // Generar slots de ejemplo para los próximos 7 días
  // TODO: En producción, esto debe consultar el sistema de calendario real
  const slots: AvailableSlot[] = [];
  const today = new Date();

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);

    // Skip domingos
    if (date.getDay() === 0) continue;

    const dateStr = date.toISOString().split('T')[0];

    // Generar 3-4 slots por día
    const times = ['09:00', '11:00', '14:00', '16:00'];
    for (const time of times) {
      // Simular disponibilidad aleatoria
      const available = Math.random() > 0.3;

      slots.push({
        date: dateStr,
        time,
        branch_name: branch.name,
        branch_id: branch.id,
        staff_name: null, // TODO: Asociar con especialista
        staff_id: null,
        available,
      });
    }
  }

  // Si se especificó fecha, filtrar
  if (params.date) {
    const filteredSlots = slots.filter((s) => s.date === params.date);
    if (filteredSlots.length === 0) {
      return {
        error: `No hay horarios disponibles para ${params.date}. Prueba con otra fecha.`,
      };
    }
    return filteredSlots.filter((s) => s.available);
  }

  return slots.filter((s) => s.available).slice(0, 10);
}

/**
 * Handler: get_branch_info
 * Obtiene información de una sucursal
 */
export async function handleGetBranchInfo(
  params: { branch_name?: string; branch_id?: string },
  context: ToolContext
): Promise<BranchInfo | { error: string }> {
  const { business_context } = context;

  if (!business_context?.branches || business_context.branches.length === 0) {
    return { error: 'No hay sucursales configuradas' };
  }

  let branch = business_context.branches[0];

  if (params.branch_id) {
    const found = business_context.branches.find((b) => b.id === params.branch_id);
    if (found) branch = found;
  } else if (params.branch_name) {
    const lowerName = params.branch_name.toLowerCase();
    const found = business_context.branches.find((b) =>
      b.name.toLowerCase().includes(lowerName)
    );
    if (found) branch = found;
  }

  // Usar horarios de operación de la sucursal si existen
  let operating_hours = branch.operating_hours || {};

  // Si no hay horarios configurados, usar defaults
  if (Object.keys(operating_hours).length === 0) {
    operating_hours = {};
    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    for (const day of days) {
      operating_hours[day] = {
        open: day === 'domingo' ? 'Cerrado' : '09:00',
        close: day === 'domingo' ? 'Cerrado' : '18:00',
      };
    }
  }

  return {
    id: branch.id,
    name: branch.name,
    address: branch.address || '',
    city: branch.city || '',
    phone: branch.phone || null,
    whatsapp: branch.whatsapp_number || null,
    google_maps_url: branch.google_maps_url || null,
    operating_hours,
  };
}

/**
 * Handler: get_business_policy
 * Obtiene una política del negocio
 */
export async function handleGetBusinessPolicy(
  params: {
    policy_type: 'cancellation' | 'rescheduling' | 'payment' | 'warranty' | 'refunds' | 'general';
  },
  context: ToolContext
): Promise<PolicyInfo | { error: string }> {
  const { business_context } = context;

  // Buscar en políticas configuradas (business_policies)
  const policies = business_context?.business_policies || [];

  // Mapear tipo de política a posibles nombres
  const policyKeywords: Record<string, string[]> = {
    cancellation: ['cancelación', 'cancelar', 'cancellation'],
    rescheduling: ['reagendar', 'cambiar cita', 'reprogramar', 'rescheduling'],
    payment: ['pago', 'forma de pago', 'payment', 'métodos de pago'],
    warranty: ['garantía', 'warranty'],
    refunds: ['reembolso', 'devolución', 'refund'],
    general: ['política', 'general', 'términos'],
  };

  const keywords = policyKeywords[params.policy_type] || [params.policy_type];

  // Buscar política que coincida
  for (const policyItem of policies) {
    const lowerPolicy = policyItem.policy.toLowerCase();
    const lowerTitle = (policyItem.title || '').toLowerCase();
    const lowerType = (policyItem.type || '').toLowerCase();

    if (keywords.some((k) => lowerPolicy.includes(k) || lowerTitle.includes(k) || lowerType.includes(k))) {
      return {
        title: policyItem.title || `Política de ${params.policy_type}`,
        policy: policyItem.policy,
        short_version: policyItem.short_version || null,
      };
    }
  }

  // Respuesta por defecto si no se encuentra
  const defaultPolicies: Record<string, PolicyInfo> = {
    cancellation: {
      title: 'Política de Cancelación',
      policy: 'Las citas pueden cancelarse con 24 horas de anticipación sin cargo. Cancelaciones con menos tiempo pueden tener cargo.',
      short_version: 'Cancelar con 24 hrs de anticipación.',
    },
    rescheduling: {
      title: 'Política de Reagendamiento',
      policy: 'Puedes reagendar tu cita con 24 horas de anticipación a través de WhatsApp o llamando directamente.',
      short_version: 'Reagendar con 24 hrs de anticipación.',
    },
    payment: {
      title: 'Formas de Pago',
      policy: 'Aceptamos efectivo, tarjetas de crédito/débito y transferencia bancaria.',
      short_version: 'Efectivo, tarjeta, transferencia.',
    },
    warranty: {
      title: 'Garantía',
      policy: 'Consulta las garantías específicas de cada servicio con nuestro equipo.',
      short_version: 'Consultar garantía por servicio.',
    },
    refunds: {
      title: 'Reembolsos',
      policy: 'Los reembolsos se procesan según cada caso. Contacta a nuestro equipo para más información.',
      short_version: 'Contactar para reembolsos.',
    },
    general: {
      title: 'Términos Generales',
      policy: 'Consulta nuestras políticas específicas para cancelación, pagos y garantías.',
      short_version: null,
    },
  };

  return defaultPolicies[params.policy_type] || defaultPolicies.general;
}

/**
 * Handler: search_knowledge_base
 * Busca información en la base de conocimiento usando RAG (embeddings)
 * con fallback a búsqueda por palabras clave
 *
 * ARQUITECTURA v6.0:
 * 1. Intenta búsqueda semántica con embeddings (RAG)
 * 2. Si falla o no hay embeddings, usa búsqueda por keywords
 */
export async function handleSearchKnowledgeBase(
  params: { query: string; limit?: number },
  context: ToolContext
): Promise<KnowledgeBaseResult[] | { error: string }> {
  const { business_context, tenant_id } = context;
  const limit = params.limit || 3;

  // =====================================================
  // 1. INTENTAR BÚSQUEDA SEMÁNTICA (RAG)
  // =====================================================
  if (tenant_id) {
    try {
      // Dynamic import para evitar problemas de bundling
      const { EmbeddingService } = await import('../services/embedding.service');

      const semanticResults = await EmbeddingService.searchKnowledgeBase(
        tenant_id,
        params.query,
        limit,
        0.5 // similarity threshold
      );

      if (semanticResults.length > 0) {
        console.log(`[search_kb] RAG search returned ${semanticResults.length} results`);

        return semanticResults.map(r => ({
          title: r.title,
          content: r.content.substring(0, 500),
          category: r.category,
          relevance_score: r.similarity,
        }));
      }

      console.log('[search_kb] RAG search returned 0 results, falling back to keyword search');
    } catch (error) {
      // RAG no disponible (embeddings no configurados), usar fallback
      console.log('[search_kb] RAG not available, using keyword fallback:', error);
    }
  }

  // =====================================================
  // 2. FALLBACK: BÚSQUEDA POR PALABRAS CLAVE
  // =====================================================
  const results: KnowledgeBaseResult[] = [];
  const lowerQuery = params.query.toLowerCase();
  const queryWords = lowerQuery.split(' ').filter((w) => w.length > 3);

  // Buscar en artículos de conocimiento
  const articles = business_context?.knowledge_articles || [];
  for (const article of articles) {
    const lowerTitle = article.title.toLowerCase();
    const lowerContent = article.content.toLowerCase();

    // Calcular relevancia básica
    let score = 0;
    for (const word of queryWords) {
      if (lowerTitle.includes(word)) score += 0.3;
      if (lowerContent.includes(word)) score += 0.1;
    }

    if (score > 0) {
      results.push({
        title: article.title,
        content: article.content.substring(0, 500),
        category: article.category || 'General',
        relevance_score: Math.min(score, 1),
      });
    }
  }

  // Buscar en FAQs
  const faqs = business_context?.faqs || [];
  for (const faq of faqs) {
    const lowerQ = faq.question.toLowerCase();
    const lowerA = faq.answer.toLowerCase();

    let score = 0;
    for (const word of queryWords) {
      if (lowerQ.includes(word)) score += 0.4;
      if (lowerA.includes(word)) score += 0.1;
    }

    if (score > 0) {
      results.push({
        title: faq.question,
        content: faq.answer,
        category: faq.category || 'FAQ',
        relevance_score: Math.min(score, 1),
      });
    }
  }

  // Ordenar por relevancia y limitar
  results.sort((a, b) => b.relevance_score - a.relevance_score);

  if (results.length === 0) {
    return { error: `No encontré información sobre "${params.query}" en la base de conocimiento.` };
  }

  return results.slice(0, limit);
}

/**
 * Handler: get_staff_info
 * Obtiene información del equipo
 */
export async function handleGetStaffInfo(
  params: { staff_name?: string; specialty?: string },
  context: ToolContext
): Promise<StaffInfo[] | { error: string }> {
  const { business_context } = context;

  if (!business_context?.staff || business_context.staff.length === 0) {
    return { error: 'No hay información del equipo configurada' };
  }

  let staff = business_context.staff;

  // Filtrar por nombre
  if (params.staff_name) {
    const lowerName = params.staff_name.toLowerCase();
    staff = staff.filter((s) => s.name.toLowerCase().includes(lowerName));
  }

  // Filtrar por especialidad
  if (params.specialty) {
    const lowerSpec = params.specialty.toLowerCase();
    staff = staff.filter((s) =>
      s.specialty?.toLowerCase().includes(lowerSpec) ||
      s.role_title?.toLowerCase().includes(lowerSpec)
    );
  }

  if (staff.length === 0) {
    return { error: 'No encontré especialistas con esos criterios' };
  }

  return staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role_title || 'Especialista',
    specialty: s.specialty || null,
    branches: s.branch_ids || [],
  }));
}

/**
 * Handler: create_appointment
 * Crea una cita
 *
 * NOTA: Esta es una implementación placeholder.
 * En producción debe integrarse con el sistema de calendar real.
 */
export async function handleCreateAppointment(
  params: {
    date: string;
    time: string;
    service_id?: string;
    branch_id?: string;
    staff_id?: string;
    notes?: string;
  },
  context: ToolContext
): Promise<AppointmentResult> {
  // TODO: Integrar con sistema de calendar real
  // Por ahora, simula una creación exitosa

  const { business_context, lead } = context;

  // Validar que la fecha sea futura
  const appointmentDate = new Date(`${params.date}T${params.time}`);
  if (appointmentDate < new Date()) {
    return {
      success: false,
      error: 'La fecha de la cita debe ser en el futuro',
      confirmation_message: '',
    };
  }

  // Obtener nombre de sucursal
  let branchName = 'nuestra sucursal';
  if (params.branch_id && business_context?.branches) {
    const branch = business_context.branches.find((b) => b.id === params.branch_id);
    if (branch) branchName = branch.name;
  } else if (business_context?.branches?.[0]) {
    branchName = business_context.branches[0].name;
  }

  // Obtener nombre de servicio
  let serviceName = 'tu cita';
  if (params.service_id && business_context?.services) {
    const service = business_context.services.find((s) => s.id === params.service_id);
    if (service) serviceName = service.name;
  }

  // Simular ID de cita
  const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}`;

  // Formatear fecha para mensaje
  const dateObj = new Date(params.date);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  };
  const formattedDate = dateObj.toLocaleDateString('es-MX', options);

  const confirmationMessage = `Tu cita para ${serviceName} ha sido agendada para el ${formattedDate} a las ${params.time} en ${branchName}. Te esperamos.`;

  return {
    success: true,
    appointment_id: appointmentId,
    confirmation_message: confirmationMessage,
  };
}

/**
 * Handler: update_lead_info
 * Actualiza información del lead
 *
 * NOTA: Esta actualización es solo en memoria.
 * La persistencia real se hace al final del flujo del grafo.
 */
export async function handleUpdateLeadInfo(
  params: { name?: string; email?: string; phone?: string },
  context: ToolContext
): Promise<LeadUpdateResult> {
  const updatedFields: string[] = [];

  if (params.name) updatedFields.push('nombre');
  if (params.email) updatedFields.push('email');
  if (params.phone) updatedFields.push('teléfono');

  if (updatedFields.length === 0) {
    return {
      success: false,
      updated_fields: [],
      error: 'No se proporcionaron datos para actualizar',
    };
  }

  // TODO: La actualización real del lead se hace en el flujo del grafo
  // Este handler solo retorna confirmación

  return {
    success: true,
    updated_fields: updatedFields,
  };
}

/**
 * Handler: get_operating_hours
 * Obtiene horarios de operación
 */
export async function handleGetOperatingHours(
  params: { branch_id?: string; day?: string },
  context: ToolContext
): Promise<OperatingHours | { error: string }> {
  const { business_context } = context;

  // Obtener sucursal
  let branch = business_context?.branches?.[0];
  if (params.branch_id) {
    branch = business_context?.branches?.find((b) => b.id === params.branch_id);
  }

  const branchName = branch?.name || 'Sucursal principal';

  // TODO: Obtener horarios reales de la configuración del tenant
  // Por ahora, usar horarios de ejemplo
  const defaultHours: Record<string, { open: string; close: string; closed: boolean }> = {
    lunes: { open: '09:00', close: '18:00', closed: false },
    martes: { open: '09:00', close: '18:00', closed: false },
    miercoles: { open: '09:00', close: '18:00', closed: false },
    jueves: { open: '09:00', close: '18:00', closed: false },
    viernes: { open: '09:00', close: '18:00', closed: false },
    sabado: { open: '09:00', close: '14:00', closed: false },
    domingo: { open: '', close: '', closed: true },
  };

  // Si se solicita un día específico
  if (params.day) {
    const lowerDay = params.day.toLowerCase();
    const dayHours = defaultHours[lowerDay];

    if (!dayHours) {
      return { error: `Día "${params.day}" no reconocido. Usa: lunes, martes, etc.` };
    }

    return {
      branch_name: branchName,
      hours: { [lowerDay]: dayHours },
    };
  }

  return {
    branch_name: branchName,
    hours: defaultHours,
  };
}

/**
 * Handler: get_faq_answer
 * Busca respuesta en FAQs
 */
export async function handleGetFaqAnswer(
  params: { question: string },
  context: ToolContext
): Promise<FaqAnswer | { error: string }> {
  const { business_context } = context;

  if (!business_context?.faqs || business_context.faqs.length === 0) {
    return { error: 'No hay preguntas frecuentes configuradas' };
  }

  const faq = findFaqByQuestion(business_context.faqs, params.question);

  if (!faq) {
    return {
      question: params.question,
      answer: '',
      category: '',
      found: false,
    };
  }

  return {
    question: faq.question,
    answer: faq.answer,
    category: faq.category || 'General',
    found: true,
  };
}

// ======================
// RESTAURANT-SPECIFIC HANDLERS
// ======================

/**
 * Handler: get_menu_items
 * Obtiene items del menú del restaurante
 */
export async function handleGetMenuItems(
  params: { category_id?: string; search_term?: string; available_only?: boolean },
  context: ToolContext
): Promise<MenuItem[] | { error: string }> {
  const { business_context } = context;
  const availableOnly = params.available_only ?? true;

  if (!business_context?.menu_items || business_context.menu_items.length === 0) {
    return { error: 'No hay items de menú configurados en este negocio' };
  }

  let items = business_context.menu_items;

  // Filtrar por categoría
  if (params.category_id) {
    items = items.filter((item) => item.category_id === params.category_id);
    if (items.length === 0) {
      return { error: `No hay items en la categoría especificada` };
    }
  }

  // Filtrar por disponibilidad
  if (availableOnly) {
    items = items.filter((item) => item.is_available !== false);
  }

  // Buscar por término
  if (params.search_term) {
    const lowerSearch = params.search_term.toLowerCase();
    items = items.filter((item) =>
      item.name.toLowerCase().includes(lowerSearch) ||
      item.description?.toLowerCase().includes(lowerSearch)
    );
  }

  if (items.length === 0) {
    return { error: `No encontré items que coincidan con "${params.search_term}"` };
  }

  // Obtener categorías para mapear nombres
  const categories = business_context.menu_categories || [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || item.ai_description || '',
    price: item.base_price, // BusinessContext uses base_price
    category_id: item.category_id || '',
    category_name: item.category_name || categoryMap.get(item.category_id || '') || 'Sin categoría',
    image_url: null, // Not in BusinessContext
    available: item.is_available !== false, // BusinessContext uses is_available
    preparation_time_minutes: item.preparation_time_minutes || 15,
    modifiers: (item.modifiers || []).map((m) => ({
      id: m.id || '',
      name: m.name || '',
      options: (m.options || []).map((opt) => ({
        id: opt.id || '',
        name: opt.name || '',
        price_adjustment: opt.price_adjustment || 0,
      })),
      is_required: m.is_required || false,
      max_selections: m.max_selections || 1,
    })),
    allergens: item.allergens || [],
    tags: item.tags || [],
  }));
}

/**
 * Handler: get_menu_categories
 * Obtiene las categorías del menú
 */
export async function handleGetMenuCategories(
  params: { active_only?: boolean },
  context: ToolContext
): Promise<MenuCategory[] | { error: string }> {
  const { business_context } = context;
  const activeOnly = params.active_only ?? true;

  if (!business_context?.menu_categories || business_context.menu_categories.length === 0) {
    return { error: 'No hay categorías de menú configuradas' };
  }

  let categories = business_context.menu_categories;

  if (activeOnly) {
    categories = categories.filter((cat) => cat.is_active !== false);
  }

  // Contar items por categoría
  const menuItems = business_context.menu_items || [];
  const itemCountMap = new Map<string, number>();
  for (const item of menuItems) {
    if (item.category_id) {
      itemCountMap.set(item.category_id, (itemCountMap.get(item.category_id) || 0) + 1);
    }
  }

  return categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || null,
      display_order: cat.display_order || 0,
      active: cat.is_active !== false, // BusinessContext uses is_active
      item_count: itemCountMap.get(cat.id) || 0,
    }))
    .sort((a, b) => a.display_order - b.display_order);
}

/**
 * Handler: create_order
 * Crea un pedido de restaurante
 *
 * NOTA: Implementación placeholder. En producción debe integrarse con POS/Kitchen system.
 */
export async function handleCreateOrder(
  params: {
    order_type: 'pickup' | 'delivery' | 'dine_in';
    items: Array<{
      menu_item_id: string;
      quantity: number;
      modifiers?: string[];
      special_instructions?: string;
    }>;
    pickup_time?: string;
    delivery_address?: string;
    customer_notes?: string;
  },
  context: ToolContext
): Promise<OrderResult> {
  const { business_context } = context;

  // Validar que hay items
  if (!params.items || params.items.length === 0) {
    return {
      success: false,
      total: 0,
      items: [],
      confirmation_message: '',
      error: 'El pedido debe contener al menos un item',
    };
  }

  // Validar dirección para delivery
  if (params.order_type === 'delivery' && !params.delivery_address) {
    return {
      success: false,
      total: 0,
      items: [],
      confirmation_message: '',
      error: 'Se requiere dirección de entrega para pedidos a domicilio',
    };
  }

  const menuItems = business_context?.menu_items || [];
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

  const orderItems: OrderItem[] = [];
  let total = 0;
  let estimatedTime = 0;

  for (const orderItem of params.items) {
    const menuItem = menuItemMap.get(orderItem.menu_item_id);

    if (!menuItem) {
      return {
        success: false,
        total: 0,
        items: [],
        confirmation_message: '',
        error: `Item no encontrado: ${orderItem.menu_item_id}`,
      };
    }

    if (menuItem.is_available === false) {
      return {
        success: false,
        total: 0,
        items: [],
        confirmation_message: '',
        error: `"${menuItem.name}" no está disponible en este momento`,
      };
    }

    // Calcular precio de modificadores seleccionados
    let modifierPriceAdjustment = 0;
    const selectedModifierIds = orderItem.modifiers || [];

    if (selectedModifierIds.length > 0 && menuItem.modifiers) {
      for (const modifier of menuItem.modifiers) {
        for (const option of modifier.options || []) {
          if (selectedModifierIds.includes(option.id)) {
            modifierPriceAdjustment += option.price_adjustment || 0;
          }
        }
      }
    }

    const unitPriceWithModifiers = menuItem.base_price + modifierPriceAdjustment;
    const subtotal = unitPriceWithModifiers * orderItem.quantity;
    total += subtotal;
    estimatedTime = Math.max(estimatedTime, menuItem.preparation_time_minutes || 15);

    orderItems.push({
      menu_item_id: menuItem.id,
      menu_item_name: menuItem.name,
      quantity: orderItem.quantity,
      unit_price: unitPriceWithModifiers, // Incluye ajustes de modificadores
      modifiers: selectedModifierIds,
      special_instructions: orderItem.special_instructions || null,
      subtotal,
    });
  }

  // Añadir tiempo extra para múltiples items
  if (orderItems.length > 3) {
    estimatedTime += 10;
  }

  // Generar número de orden
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const orderId = `order_${Date.now()}`;

  // Mensaje de confirmación según tipo
  let confirmationMessage = '';
  const itemsSummary = orderItems.map((i) => `${i.quantity}x ${i.menu_item_name}`).join(', ');

  switch (params.order_type) {
    case 'pickup':
      confirmationMessage = `Tu pedido #${orderNumber} ha sido recibido: ${itemsSummary}. Total: $${total.toLocaleString('es-MX')}. Estará listo en aproximadamente ${estimatedTime} minutos${params.pickup_time ? ` a las ${params.pickup_time}` : ''}.`;
      break;
    case 'delivery':
      estimatedTime += 20; // Tiempo de entrega
      confirmationMessage = `Tu pedido #${orderNumber} ha sido recibido: ${itemsSummary}. Total: $${total.toLocaleString('es-MX')}. Llegará en aproximadamente ${estimatedTime} minutos a ${params.delivery_address}.`;
      break;
    case 'dine_in':
      confirmationMessage = `Tu pedido #${orderNumber} ha sido enviado a cocina: ${itemsSummary}. Total: $${total.toLocaleString('es-MX')}. Estará en tu mesa en aproximadamente ${estimatedTime} minutos.`;
      break;
  }

  return {
    success: true,
    order_id: orderId,
    order_number: orderNumber,
    estimated_time_minutes: estimatedTime,
    total,
    items: orderItems,
    confirmation_message: confirmationMessage,
  };
}

/**
 * Handler: check_item_availability
 * Verifica disponibilidad de un item del menú
 */
export async function handleCheckItemAvailability(
  params: { menu_item_id: string; quantity?: number },
  context: ToolContext
): Promise<ItemAvailability | { error: string }> {
  const { business_context } = context;
  const quantity = params.quantity || 1;

  if (!business_context?.menu_items || business_context.menu_items.length === 0) {
    return { error: 'No hay menú configurado' };
  }

  const menuItem = business_context.menu_items.find((item) => item.id === params.menu_item_id);

  if (!menuItem) {
    return { error: `Item "${params.menu_item_id}" no encontrado en el menú` };
  }

  // Verificar disponibilidad
  const available = menuItem.is_available !== false;
  let reasonUnavailable: string | null = null;

  if (!available) {
    reasonUnavailable = 'No disponible temporalmente';
  }

  // TODO: En producción, verificar stock real
  // Por ahora, asumimos disponibilidad ilimitada si está marcado como disponible

  return {
    menu_item_id: menuItem.id,
    menu_item_name: menuItem.name,
    available,
    quantity_available: available ? null : 0, // null = unlimited
    reason_unavailable: reasonUnavailable,
  };
}

/**
 * Handler: get_active_promotions
 * Obtiene promociones activas
 */
export async function handleGetActivePromotions(
  params: { vertical?: 'dental' | 'restaurant' | 'all' },
  context: ToolContext
): Promise<Promotion[] | { error: string }> {
  const { business_context } = context;
  const vertical = params.vertical || 'all';

  // Verificar en promociones configuradas
  const promotions = business_context?.promotions || [];

  if (promotions.length === 0) {
    // Buscar promociones en servicios (para dental/medical)
    const services = business_context?.services || [];
    const servicePromos: Promotion[] = [];

    for (const service of services) {
      if (service.promotion_active && service.promotion_text) {
        servicePromos.push({
          id: `promo_${service.id}`,
          title: `Promoción: ${service.name}`,
          description: service.promotion_text,
          discount_type: 'percentage',
          discount_value: 0, // No especificado
          applicable_items: [service.id],
          valid_from: new Date().toISOString(),
          valid_until: '', // Indefinido
          conditions: null,
          active: true,
        });
      }
    }

    if (servicePromos.length === 0) {
      return { error: 'No hay promociones activas en este momento' };
    }

    return servicePromos;
  }

  // Filtrar promociones activas
  const now = new Date();
  let activePromos = promotions.filter((promo) => {
    if (promo.active === false) return false;

    // Verificar fechas
    if (promo.valid_from && new Date(promo.valid_from) > now) return false;
    if (promo.valid_until && new Date(promo.valid_until) < now) return false;

    // Filtrar por vertical si se especifica
    if (vertical !== 'all' && promo.vertical && promo.vertical !== vertical) {
      return false;
    }

    return true;
  });

  if (activePromos.length === 0) {
    return { error: 'No hay promociones activas en este momento' };
  }

  return activePromos.map((promo) => ({
    id: promo.id,
    title: promo.title,
    description: promo.description || '',
    discount_type: promo.discount_type || 'percentage',
    discount_value: promo.discount_value || 0,
    applicable_items: promo.applicable_items || [],
    valid_from: promo.valid_from || '',
    valid_until: promo.valid_until || '',
    conditions: promo.conditions || null,
    active: true,
  }));
}

// ======================
// EXPORTS
// ======================

export const toolHandlers = {
  // Common tools
  get_service_info: handleGetServiceInfo,
  list_services: handleListServices,
  get_available_slots: handleGetAvailableSlots,
  get_branch_info: handleGetBranchInfo,
  get_business_policy: handleGetBusinessPolicy,
  search_knowledge_base: handleSearchKnowledgeBase,
  get_staff_info: handleGetStaffInfo,
  create_appointment: handleCreateAppointment,
  update_lead_info: handleUpdateLeadInfo,
  get_operating_hours: handleGetOperatingHours,
  get_faq_answer: handleGetFaqAnswer,
  // Restaurant-specific tools
  get_menu_items: handleGetMenuItems,
  get_menu_categories: handleGetMenuCategories,
  create_order: handleCreateOrder,
  check_item_availability: handleCheckItemAvailability,
  get_active_promotions: handleGetActivePromotions,
};

export default toolHandlers;
