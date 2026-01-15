// =====================================================
// TIS TIS PLATFORM - KB Suggested Templates by Vertical
// Pre-built templates to help users get started quickly
// Optimized for: dental, restaurant
// =====================================================

import type { VerticalType } from './verticals';

// ======================
// TYPES
// ======================

export type SuggestedItemType = 'instruction' | 'policy' | 'article' | 'template';

export interface SuggestedKBItem {
  id: string;
  type: SuggestedItemType;
  category: string;           // instruction_type, policy_type, category, trigger_type
  title: string;
  content: string;
  priority: 'essential' | 'recommended' | 'optional';
  description: string;        // Why this item is useful
}

export interface VerticalSuggestions {
  vertical: VerticalType;
  displayName: string;
  instructions: SuggestedKBItem[];
  policies: SuggestedKBItem[];
  articles: SuggestedKBItem[];
  templates: SuggestedKBItem[];
}

// ======================
// DENTAL VERTICAL
// ======================

const DENTAL_SUGGESTIONS: VerticalSuggestions = {
  vertical: 'dental',
  displayName: 'Clínica Dental',

  instructions: [
    {
      id: 'dental-inst-identity',
      type: 'instruction',
      category: 'identity',  // Válido en DB
      title: 'Identidad del Asistente Dental',
      content: `Eres el asistente virtual de una clínica dental profesional. Tu rol es:
- Proyectar profesionalismo médico y calidez humana
- Usar terminología dental accesible (evita jerga técnica excesiva)
- Transmitir confianza y seguridad en los tratamientos
- Mencionar que los procedimientos son realizados por odontólogos certificados
- Enfatizar la importancia de la salud bucal preventiva`,
      priority: 'essential',
      description: 'Define cómo el asistente se presenta y comunica como representante de una clínica dental',
    },
    {
      id: 'dental-inst-special-cases',
      type: 'instruction',
      category: 'special_cases',  // Válido en DB - citas y emergencias
      title: 'Manejo de Citas y Emergencias Dentales',
      content: `Al agendar citas dentales:
- Pregunta si es primera vez o paciente existente
- Identifica el motivo de consulta (revisión, dolor, limpieza, estético)
- Sugiere la duración apropiada según el procedimiento
- Menciona que se requiere llegar 10 minutos antes para pacientes nuevos

Ante emergencias dentales (dolor intenso, trauma, sangrado):
- Mostrar empatía inmediata: "Entiendo que debe ser muy incómodo"
- Si es urgencia real, buscar el primer espacio disponible del día
- Dar indicaciones temporales: analgésico, compresas frías
- Para diente caído: "Guárdelo en leche o saliva, NO lo lave"`,
      priority: 'essential',
      description: 'Instrucciones para manejo de citas y emergencias dentales',
    },
    {
      id: 'dental-inst-pricing',
      type: 'instruction',
      category: 'pricing_policy',  // Válido en DB
      title: 'Comunicación de Precios',
      content: `Al hablar de precios de tratamientos dentales:
- Proporciona rangos cuando sea posible, no precios exactos sin valoración
- Explica que el precio final depende de la evaluación clínica
- Menciona opciones de financiamiento si están disponibles
- Destaca el valor: materiales de calidad, tecnología, garantías
- Evita comparar precios con competidores
- Ofrece agendar valoración sin costo cuando aplique`,
      priority: 'recommended',
      description: 'Guía para comunicar precios de forma profesional sin comprometer ventas',
    },
    {
      id: 'dental-inst-always-mention',
      type: 'instruction',
      category: 'always_mention',  // Válido en DB
      title: 'Información Clave a Mencionar',
      content: `En cada conversación recuerda mencionar cuando sea relevante:
- La valoración inicial incluye radiografías si se requieren
- Los tratamientos son realizados por odontólogos certificados
- Contamos con tecnología de vanguardia
- Ofrecemos facilidades de pago y meses sin intereses
- Las emergencias tienen prioridad de atención`,
      priority: 'recommended',
      description: 'Puntos clave que el asistente debe mencionar en las conversaciones',
    },
  ],

  policies: [
    {
      id: 'dental-pol-cancellation',
      type: 'policy',
      category: 'cancellation',
      title: 'Política de Cancelación de Citas',
      content: `Las citas pueden cancelarse o reprogramarse con al menos 24 horas de anticipación sin cargo.
Cancelaciones con menos de 24 horas podrán generar un cargo del 50% del valor de la consulta.
Las inasistencias sin aviso ("no shows") pueden resultar en cargo completo.
Entendemos que surgen emergencias; contáctenos lo antes posible para reagendar.`,
      priority: 'essential',
      description: 'Política clara para gestionar cancelaciones y proteger el tiempo del consultorio',
    },
    {
      id: 'dental-pol-payment',
      type: 'policy',
      category: 'payment',
      title: 'Formas de Pago Aceptadas',
      content: `Aceptamos efectivo, tarjetas de débito y crédito (Visa, Mastercard, American Express).
Ofrecemos planes de pago a meses sin intereses en tratamientos mayores a $5,000 MXN.
El pago de la consulta de valoración se realiza al momento.
Para tratamientos extensos, solicitamos un anticipo del 50% para confirmar la cita.`,
      priority: 'essential',
      description: 'Información clara sobre métodos de pago y opciones de financiamiento',
    },
    {
      id: 'dental-pol-warranty',
      type: 'policy',
      category: 'warranty',
      title: 'Garantías en Tratamientos',
      content: `Nuestros tratamientos incluyen garantía:
- Restauraciones (resinas): 1 año
- Coronas y puentes: 3 años
- Implantes dentales: 5 años
- Carillas: 2 años
La garantía aplica siguiendo las indicaciones de cuidado y asistiendo a revisiones programadas.
No cubre daños por accidentes, bruxismo no tratado o falta de higiene bucal.`,
      priority: 'recommended',
      description: 'Genera confianza comunicando las garantías de los tratamientos',
    },
  ],

  articles: [
    {
      id: 'dental-art-technology',
      type: 'article',
      category: 'technology',
      title: 'Tecnología y Equipamiento',
      content: `Contamos con tecnología de vanguardia para tu comodidad y mejores resultados:
- Radiografías digitales: menor radiación, resultados inmediatos
- Escáner intraoral 3D: moldes digitales sin pasta incómoda
- Láser dental: tratamientos menos invasivos
- Sistema CEREC: coronas en una sola visita
- Sedación consciente para pacientes ansiosos
Toda nuestra tecnología cumple con las normas sanitarias más estrictas.`,
      priority: 'recommended',
      description: 'Destaca la tecnología como diferenciador y generador de confianza',
    },
    {
      id: 'dental-art-firstvisit',
      type: 'article',
      category: 'about_us',
      title: 'Tu Primera Visita',
      content: `En tu primera visita realizaremos:
1. Revisión de historial médico y dental
2. Examen clínico completo
3. Radiografías diagnósticas (si se requieren)
4. Plan de tratamiento personalizado
5. Presupuesto detallado sin compromiso

La valoración inicial dura aproximadamente 45 minutos.
Trae tu identificación y, si tienes, radiografías previas.`,
      priority: 'essential',
      description: 'Reduce ansiedad de pacientes nuevos explicando qué esperar',
    },
  ],

  templates: [
    {
      id: 'dental-tpl-greeting',
      type: 'template',
      category: 'greeting',
      title: 'Saludo Inicial',
      content: `{saludo_tiempo}, gracias por contactar a {negocio}. Soy tu asistente virtual y estoy aquí para ayudarte con información sobre nuestros servicios dentales, agendar tu cita, o resolver cualquier duda. ¿En qué puedo ayudarte hoy?`,
      priority: 'essential',
      description: 'Primer mensaje que reciben los pacientes, establece el tono profesional',
    },
    {
      id: 'dental-tpl-appointment-confirm',
      type: 'template',
      category: 'appointment_confirm',
      title: 'Confirmación de Cita',
      content: `Perfecto, {nombre}. Tu cita ha sido agendada:
- Fecha: {fecha}
- Hora: {hora}
- Servicio: {servicio}
- Sucursal: {sucursal}

Recuerda llegar 10 minutos antes. Si necesitas cancelar o reprogramar, avísanos con 24 horas de anticipación. ¡Te esperamos!`,
      priority: 'essential',
      description: 'Confirmación clara con todos los detalles importantes de la cita',
    },
    {
      id: 'dental-tpl-farewell',
      type: 'template',
      category: 'farewell',
      title: 'Despedida',
      content: `Fue un gusto atenderte. Recuerda que en {negocio} estamos para cuidar tu sonrisa. Si tienes más preguntas, no dudes en escribirnos. ¡Que tengas un excelente día!`,
      priority: 'recommended',
      description: 'Cierre amable que refuerza la marca',
    },
  ],
};

// ======================
// RESTAURANT VERTICAL
// ======================

const RESTAURANT_SUGGESTIONS: VerticalSuggestions = {
  vertical: 'restaurant',
  displayName: 'Restaurante',

  instructions: [
    {
      id: 'rest-inst-identity',
      type: 'instruction',
      category: 'identity',  // Válido en DB
      title: 'Identidad del Asistente de Restaurante',
      content: `Eres el asistente virtual de un restaurante. Tu rol es:
- Proyectar hospitalidad y calidez
- Transmitir la esencia y ambiente del restaurante
- Ser entusiasta sobre el menú sin ser insistente
- Usar un tono amigable y acogedor
- Conocer los platillos destacados y especialidades
- Hacer sentir al cliente bienvenido desde el primer mensaje`,
      priority: 'essential',
      description: 'Define la personalidad del asistente acorde al ambiente de restaurante',
    },
    {
      id: 'rest-inst-special-cases',
      type: 'instruction',
      category: 'special_cases',  // Válido en DB - reservaciones
      title: 'Manejo de Reservaciones',
      content: `Al gestionar reservaciones:
- Siempre preguntar: fecha, hora, número de personas
- Confirmar disponibilidad antes de comprometer
- Preguntar si hay ocasión especial (cumpleaños, aniversario, negocio)
- Ofrecer opciones de área: terraza, interior, privado (si aplica)
- Mencionar tiempo de tolerancia (típicamente 15 minutos)
- Para grupos grandes (+8), sugerir menú preestablecido
- Preguntar si hay restricciones alimentarias o alergias`,
      priority: 'essential',
      description: 'Protocolo completo para reservaciones que mejora la experiencia',
    },
    {
      id: 'rest-inst-upsell',
      type: 'instruction',
      category: 'upsell',  // Válido en DB
      title: 'Recomendaciones del Menú',
      content: `Al hablar del menú y oportunidades de venta:
- Conoce los platillos estrella y recomiéndalos con entusiasmo
- Menciona opciones vegetarianas/veganas si preguntan
- Destaca las especialidades del chef y platillos de temporada
- Sugiere maridajes de vinos cuando sea apropiado
- Menciona los postres y bebidas especiales
- Informa sobre menús de degustación para ocasiones especiales`,
      priority: 'recommended',
      description: 'Guía para comunicar el menú de forma atractiva y generar ventas',
    },
    {
      id: 'rest-inst-pricing',
      type: 'instruction',
      category: 'pricing_policy',  // Válido en DB
      title: 'Comunicación de Precios',
      content: `Al hablar de precios:
- Proporciona precios de platillos específicos si los conoces
- Para presupuestos de eventos, solicita detalles primero
- Menciona si hay promociones vigentes (happy hour, etc.)
- Explica qué incluyen los menús de degustación
- Para eventos privados, ofrece cotización personalizada
- Aclara si propinas y servicio están incluidos`,
      priority: 'recommended',
      description: 'Manejo profesional de consultas sobre precios',
    },
  ],

  policies: [
    {
      id: 'rest-pol-cancellation',
      type: 'policy',
      category: 'cancellation',
      title: 'Política de Reservaciones',
      content: `Las reservaciones se mantienen por 15 minutos después de la hora confirmada.
Para cancelar o modificar, avísanos con al menos 4 horas de anticipación.
Grupos de 8 o más personas requieren anticipo del 30% para confirmar, reembolsable si cancelan con 48 horas de anticipación.
En fechas especiales (14 de febrero, Día de las Madres, Navidad), las políticas de cancelación son más estrictas.`,
      priority: 'essential',
      description: 'Política clara para gestionar reservaciones y proteger la capacidad',
    },
    {
      id: 'rest-pol-dress',
      type: 'policy',
      category: 'custom',  // Válido en DB
      title: 'Código de Vestimenta',
      content: `Nuestro código de vestimenta es casual elegante.
Se recomienda evitar ropa de playa, sandalias y playeras sin mangas para caballeros.
Para eventos privados o cenas de gala, puede aplicar código formal.
Si tienes dudas sobre tu atuendo, contáctanos con confianza.`,
      priority: 'optional',
      description: 'Para restaurantes con código de vestimenta específico',
    },
    {
      id: 'rest-pol-allergies',
      type: 'policy',
      category: 'custom',  // Válido en DB
      title: 'Alergias e Intolerancias',
      content: `Tomamos muy en serio las alergias alimentarias.
Por favor infórmanos de cualquier alergia o intolerancia al hacer tu reservación.
Podemos adaptar muchos platillos a necesidades especiales.
Para alergias severas, recomendamos hablar directamente con nuestro chef.
Manejamos opciones sin gluten, sin lácteos y veganas.`,
      priority: 'recommended',
      description: 'Demuestra compromiso con la seguridad alimentaria del cliente',
    },
  ],

  articles: [
    {
      id: 'rest-art-about',
      type: 'article',
      category: 'about_us',
      title: 'Sobre Nosotros',
      content: `Somos un restaurante comprometido con ofrecer una experiencia gastronómica memorable.
Nuestra cocina combina técnicas tradicionales con toques contemporáneos.
Utilizamos ingredientes frescos y de temporada, priorizando proveedores locales.
Nuestro equipo está dedicado a hacer de cada visita un momento especial.`,
      priority: 'essential',
      description: 'Historia y valores del restaurante para compartir con clientes',
    },
    {
      id: 'rest-art-events',
      type: 'article',
      category: 'events',  // Válido en DB
      title: 'Eventos Privados',
      content: `Ofrecemos espacios para eventos privados:
- Salón privado: hasta 30 personas
- Terraza exclusiva: hasta 50 personas
- Restaurante completo: hasta 120 personas

Incluye:
- Menú personalizado con el chef
- Decoración básica
- Audio ambiente
- Personal exclusivo

Cotizaciones sin compromiso. Contáctanos para más detalles.`,
      priority: 'recommended',
      description: 'Información para captar eventos privados y celebraciones',
    },
  ],

  templates: [
    {
      id: 'rest-tpl-greeting',
      type: 'template',
      category: 'greeting',
      title: 'Saludo Inicial',
      content: `{saludo_tiempo}, bienvenido a {negocio}. Soy tu asistente virtual. Puedo ayudarte a hacer una reservación, informarte sobre nuestro menú, o resolver cualquier duda. ¿Qué te gustaría saber?`,
      priority: 'essential',
      description: 'Bienvenida cálida que refleja la hospitalidad del restaurante',
    },
    {
      id: 'rest-tpl-reservation-confirm',
      type: 'template',
      category: 'appointment_confirm',
      title: 'Confirmación de Reservación',
      content: `Excelente, {nombre}. Tu reservación está confirmada:
- Fecha: {fecha}
- Hora: {hora}
- Personas: {servicio}
- Sucursal: {sucursal}

Recuerda que mantenemos la mesa por 15 minutos. Si hay algún cambio, avísanos con anticipación. ¡Te esperamos con gusto!`,
      priority: 'essential',
      description: 'Confirmación de reservación con todos los detalles relevantes',
    },
    {
      id: 'rest-tpl-farewell',
      type: 'template',
      category: 'farewell',
      title: 'Despedida',
      content: `Gracias por contactarnos. En {negocio} será un placer recibirte. Si tienes más preguntas, aquí estaremos. ¡Buen provecho de antemano!`,
      priority: 'recommended',
      description: 'Despedida cálida que invita a la visita',
    },
    {
      id: 'rest-tpl-after-hours',
      type: 'template',
      category: 'after_hours',
      title: 'Fuera de Horario',
      content: `Gracias por tu mensaje. En este momento nuestro restaurante está cerrado, pero puedo ayudarte a hacer una reservación para cuando abramos. Nuestro horario es de lunes a domingo de 13:00 a 23:00 hrs. ¿Te gustaría reservar una mesa?`,
      priority: 'recommended',
      description: 'Mensaje automático fuera de horario que captura la intención',
    },
  ],
};

// ======================
// REGISTRY
// ======================

/**
 * Registro de sugerencias por vertical
 * Solo incluye verticales activas: dental, restaurant
 */
const SUGGESTIONS_BY_VERTICAL: Partial<Record<VerticalType, VerticalSuggestions>> = {
  dental: DENTAL_SUGGESTIONS,
  restaurant: RESTAURANT_SUGGESTIONS,
};

// ======================
// API FUNCTIONS
// ======================

/**
 * Obtiene las sugerencias para una vertical específica
 */
export function getSuggestionsForVertical(vertical: VerticalType): VerticalSuggestions | null {
  return SUGGESTIONS_BY_VERTICAL[vertical] || null;
}

/**
 * Obtiene todas las verticales que tienen sugerencias disponibles
 */
export function getVerticalsWithSuggestions(): VerticalType[] {
  return Object.keys(SUGGESTIONS_BY_VERTICAL) as VerticalType[];
}

/**
 * Verifica si una vertical tiene sugerencias disponibles
 */
export function hasSuggestions(vertical: VerticalType): boolean {
  return vertical in SUGGESTIONS_BY_VERTICAL;
}

/**
 * Obtiene sugerencias filtradas por prioridad
 */
export function getSuggestionsByPriority(
  vertical: VerticalType,
  priority: 'essential' | 'recommended' | 'optional'
): SuggestedKBItem[] {
  const suggestions = getSuggestionsForVertical(vertical);
  if (!suggestions) return [];

  const allItems = [
    ...suggestions.instructions,
    ...suggestions.policies,
    ...suggestions.articles,
    ...suggestions.templates,
  ];

  return allItems.filter(item => item.priority === priority);
}

/**
 * Obtiene solo las sugerencias esenciales para una vertical
 */
export function getEssentialSuggestions(vertical: VerticalType): SuggestedKBItem[] {
  return getSuggestionsByPriority(vertical, 'essential');
}

/**
 * Cuenta el total de sugerencias por vertical
 */
export function countSuggestions(vertical: VerticalType): {
  total: number;
  instructions: number;
  policies: number;
  articles: number;
  templates: number;
  essential: number;
  recommended: number;
  optional: number;
} {
  const suggestions = getSuggestionsForVertical(vertical);
  if (!suggestions) {
    return {
      total: 0,
      instructions: 0,
      policies: 0,
      articles: 0,
      templates: 0,
      essential: 0,
      recommended: 0,
      optional: 0,
    };
  }

  const allItems = [
    ...suggestions.instructions,
    ...suggestions.policies,
    ...suggestions.articles,
    ...suggestions.templates,
  ];

  return {
    total: allItems.length,
    instructions: suggestions.instructions.length,
    policies: suggestions.policies.length,
    articles: suggestions.articles.length,
    templates: suggestions.templates.length,
    essential: allItems.filter(i => i.priority === 'essential').length,
    recommended: allItems.filter(i => i.priority === 'recommended').length,
    optional: allItems.filter(i => i.priority === 'optional').length,
  };
}

// ======================
// EXPORTS
// ======================

export {
  DENTAL_SUGGESTIONS,
  RESTAURANT_SUGGESTIONS,
  SUGGESTIONS_BY_VERTICAL,
};
