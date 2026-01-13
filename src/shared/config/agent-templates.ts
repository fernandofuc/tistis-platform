// =====================================================
// TIS TIS PLATFORM - Agent Templates Configuration
// Templates predefinidos para agentes de IA
// =====================================================
//
// Este archivo define los templates que los usuarios pueden seleccionar
// para configurar el comportamiento de sus agentes de IA.
//
// Los templates son la base del prompt, pero el usuario puede
// personalizar variables como nombre del negocio, saludo, etc.
// =====================================================

// ======================
// TYPES
// ======================

export type AgentCapability =
  | 'booking'           // Agendar citas/reservaciones
  | 'pricing'           // Informar precios
  | 'faq'               // Responder preguntas frecuentes
  | 'lead_capture'      // Capturar información de leads
  | 'objections'        // Manejar objeciones
  | 'location'          // Informar ubicación
  | 'hours'             // Informar horarios
  | 'reservations'      // Reservaciones de mesa (restaurant)
  | 'ordering'          // Pedidos para recoger (restaurant)
  | 'menu_info'         // Información del menú
  | 'redirect_to_clinic'    // Derivar a clínica (personal)
  | 'redirect_to_business'  // Derivar a negocio (personal)
  | 'basic_info';       // Info básica solamente

export type ProfileType = 'business' | 'personal';

export type ResponseStyle =
  | 'professional'          // Formal y directo
  | 'professional_friendly' // Formal pero amigable
  | 'casual'                // Informal y cercano
  | 'formal';               // Muy formal

export type VerticalType =
  | 'dental'
  | 'restaurant'
  | 'medical'
  | 'gym'
  | 'beauty'
  | 'veterinary'
  | 'services'
  | 'general';

export interface AgentTemplate {
  key: string;
  name: string;
  description: string;
  vertical: VerticalType;
  profileType: ProfileType;
  capabilities: AgentCapability[];
  promptTemplate: string;
  customizableVariables: string[];
  displayOrder: number;
  isDefault: boolean;
  icon?: string;
}

export interface ResponseStyleOption {
  value: ResponseStyle;
  label: string;
  description: string;
  example: string;
  recommended?: boolean;
}

// ======================
// RESPONSE STYLES
// ======================

export const RESPONSE_STYLES: ResponseStyleOption[] = [
  {
    value: 'professional',
    label: 'Profesional',
    description: 'Formal y directo',
    example: '"El servicio tiene un costo de $800. El tiempo estimado es de 45 minutos. ¿Desea agendar?"',
  },
  {
    value: 'professional_friendly',
    label: 'Profesional Cálido',
    description: 'Formal pero amigable',
    example: '"Con gusto le informo que el servicio tiene un costo de $800 MXN e incluye atención completa. ¿Le gustaría agendar?"',
    recommended: true,
  },
  {
    value: 'casual',
    label: 'Casual',
    description: 'Informal y cercano',
    example: '"Claro que sí, el servicio te sale en $800 y tardamos como 45 mins. ¿Quieres que te aparte un espacio?"',
  },
  {
    value: 'formal',
    label: 'Muy Formal',
    description: 'Extremadamente profesional',
    example: '"Estimado/a cliente, le informo que el servicio solicitado tiene un costo de $800.00 MXN. Quedamos a sus órdenes."',
  },
];

// ======================
// AGENT TEMPLATES - DENTAL
// ======================

const DENTAL_TEMPLATES: AgentTemplate[] = [
  {
    key: 'dental_full',
    name: 'Asistente Completo',
    description: 'Agenda citas, responde consultas, captura leads, maneja objeciones',
    vertical: 'dental',
    profileType: 'business',
    capabilities: ['booking', 'pricing', 'faq', 'lead_capture', 'objections', 'location', 'hours'],
    promptTemplate: `Eres el asistente virtual de {{business_name}}, una clínica dental profesional ubicada en {{location}}.

PERSONALIDAD: {{response_style}}

TU MISIÓN:
- Agendar citas con nuestros especialistas
- Informar sobre servicios y precios
- Resolver dudas de pacientes potenciales
- Capturar información de leads interesados

REGLAS INQUEBRANTABLES:
1. NUNCA inventar precios específicos si no los conoces
2. NUNCA diagnosticar condiciones médicas
3. SIEMPRE derivar emergencias a llamada directa
4. SIEMPRE confirmar datos antes de agendar

SALUDO: {{greeting}}
HORARIO: {{schedule}}`,
    customizableVariables: ['business_name', 'location', 'greeting', 'schedule', 'response_style'],
    displayOrder: 1,
    isDefault: true,
    icon: '🦷',
  },
  {
    key: 'dental_appointments_only',
    name: 'Solo Citas',
    description: 'Se enfoca únicamente en agendar citas con el equipo dental',
    vertical: 'dental',
    profileType: 'business',
    capabilities: ['booking', 'location', 'hours'],
    promptTemplate: `Eres el asistente de citas de {{business_name}}.

TU ÚNICA MISIÓN: Agendar citas con nuestros dentistas.

Para cualquier otra consulta, indica amablemente que tu función es agendar citas y ofrece hacerlo.

SALUDO: {{greeting}}
HORARIO: {{schedule}}`,
    customizableVariables: ['business_name', 'greeting', 'schedule'],
    displayOrder: 2,
    isDefault: false,
    icon: '📅',
  },
  {
    key: 'dental_personal',
    name: 'Marca Personal Doctor',
    description: 'Para las redes sociales personales del doctor',
    vertical: 'dental',
    profileType: 'personal',
    capabilities: ['redirect_to_clinic', 'basic_info'],
    promptTemplate: `Eres el asistente personal de {{doctor_name}}, odontólogo especialista.

Cuando alguien pregunte por citas o servicios, deriva amablemente a la clínica:
"Para agendar una cita, te invito a contactar directamente a {{clinic_name}} donde {{doctor_name}} atiende. Puedes escribirles a {{clinic_contact}}."

Puedes responder preguntas generales sobre odontología de forma educativa, pero NUNCA:
- Dar diagnósticos
- Dar precios específicos
- Agendar citas directamente`,
    customizableVariables: ['doctor_name', 'clinic_name', 'clinic_contact'],
    displayOrder: 10,
    isDefault: true,
    icon: '👨‍⚕️',
  },
];

// ======================
// AGENT TEMPLATES - RESTAURANT
// ======================

const RESTAURANT_TEMPLATES: AgentTemplate[] = [
  {
    key: 'resto_full',
    name: 'Servicio Completo',
    description: 'Reservaciones de mesas + pedidos para recoger',
    vertical: 'restaurant',
    profileType: 'business',
    capabilities: ['reservations', 'ordering', 'menu_info', 'location', 'hours'],
    promptTemplate: `Eres el asistente virtual de {{business_name}}, un restaurante ubicado en {{location}}.

PUEDES AYUDAR CON:
1. Reservaciones de mesa
2. Pedidos para recoger en sucursal
3. Información del menú
4. Horarios y ubicación

PERSONALIDAD: {{response_style}}

SALUDO: {{greeting}}
HORARIO: {{schedule}}

REGLAS:
- Para reservaciones, SIEMPRE confirma: fecha, hora, número de personas, nombre
- Para pedidos, confirma: platillos, sucursal de recogida, hora aproximada
- Si preguntan por delivery, indica que solo manejamos pedidos para recoger`,
    customizableVariables: ['business_name', 'location', 'greeting', 'schedule', 'response_style'],
    displayOrder: 1,
    isDefault: true,
    icon: '🍽️',
  },
  {
    key: 'resto_reservations_only',
    name: 'Solo Reservaciones',
    description: 'Únicamente maneja reservaciones de mesas',
    vertical: 'restaurant',
    profileType: 'business',
    capabilities: ['reservations', 'location', 'hours'],
    promptTemplate: `Eres el asistente de reservaciones de {{business_name}}.

TU ÚNICA FUNCIÓN: Reservar mesas para nuestros clientes.

Para reservar necesito:
- Fecha y hora deseada
- Número de personas
- Nombre para la reservación
- Teléfono de contacto

SALUDO: {{greeting}}
HORARIO: {{schedule}}`,
    customizableVariables: ['business_name', 'greeting', 'schedule'],
    displayOrder: 2,
    isDefault: false,
    icon: '🪑',
  },
  {
    key: 'resto_orders_only',
    name: 'Solo Pedidos',
    description: 'Únicamente maneja pedidos para recoger',
    vertical: 'restaurant',
    profileType: 'business',
    capabilities: ['ordering', 'menu_info', 'location'],
    promptTemplate: `Eres el asistente de pedidos de {{business_name}}.

TU FUNCIÓN: Tomar pedidos para recoger en sucursal.

Para tu pedido necesito:
- Qué platillos deseas
- En qué sucursal lo recogerás
- Hora aproximada de recogida
- Nombre para el pedido

NOTA: No manejamos delivery, solo pedidos para recoger.

SALUDO: {{greeting}}`,
    customizableVariables: ['business_name', 'greeting'],
    displayOrder: 3,
    isDefault: false,
    icon: '📦',
  },
];

// ======================
// AGENT TEMPLATES - GENERAL
// ======================

const GENERAL_TEMPLATES: AgentTemplate[] = [
  {
    key: 'general_full',
    name: 'Asistente General',
    description: 'Asistente versátil para cualquier tipo de negocio',
    vertical: 'general',
    profileType: 'business',
    capabilities: ['booking', 'pricing', 'faq', 'lead_capture', 'location', 'hours'],
    promptTemplate: `Eres el asistente virtual de {{business_name}}.

PERSONALIDAD: {{response_style}}

PUEDES AYUDAR CON:
- Agendar citas o reservaciones
- Informar sobre servicios y precios
- Resolver preguntas frecuentes
- Proporcionar información de ubicación y horarios

SALUDO: {{greeting}}
HORARIO: {{schedule}}

REGLAS:
- Sé amable y profesional
- Si no sabes algo, ofrece conectar con un humano
- Confirma siempre los datos importantes`,
    customizableVariables: ['business_name', 'greeting', 'schedule', 'response_style'],
    displayOrder: 1,
    isDefault: true,
    icon: '💼',
  },
  {
    key: 'general_personal',
    name: 'Marca Personal',
    description: 'Para perfiles personales de profesionales',
    vertical: 'general',
    profileType: 'personal',
    capabilities: ['redirect_to_business', 'basic_info'],
    promptTemplate: `Eres el asistente personal de {{owner_name}}.

Para consultas de servicios profesionales, deriva amablemente:
"Para agendar una cita o conocer servicios, te invito a contactar a {{business_name}}: {{business_contact}}"

Puedes mantener conversaciones casuales y responder preguntas generales de forma educativa.`,
    customizableVariables: ['owner_name', 'business_name', 'business_contact'],
    displayOrder: 10,
    isDefault: true,
    icon: '👤',
  },
];

// ======================
// ALL TEMPLATES
// ======================

export const AGENT_TEMPLATES: Record<string, AgentTemplate> = {
  // Dental
  dental_full: DENTAL_TEMPLATES[0],
  dental_appointments_only: DENTAL_TEMPLATES[1],
  dental_personal: DENTAL_TEMPLATES[2],

  // Restaurant
  resto_full: RESTAURANT_TEMPLATES[0],
  resto_reservations_only: RESTAURANT_TEMPLATES[1],
  resto_orders_only: RESTAURANT_TEMPLATES[2],

  // General
  general_full: GENERAL_TEMPLATES[0],
  general_personal: GENERAL_TEMPLATES[1],
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene los templates disponibles para una vertical y tipo de perfil
 */
export function getTemplatesForVertical(
  vertical: VerticalType,
  profileType: ProfileType
): AgentTemplate[] {
  const templates = Object.values(AGENT_TEMPLATES)
    .filter(t => t.profileType === profileType)
    .filter(t => t.vertical === vertical || t.vertical === 'general')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return templates;
}

/**
 * Obtiene un template por su key
 */
export function getTemplate(templateKey: string): AgentTemplate | null {
  return AGENT_TEMPLATES[templateKey] || null;
}

/**
 * Obtiene el template por defecto para una vertical y tipo de perfil
 */
export function getDefaultTemplate(
  vertical: VerticalType,
  profileType: ProfileType
): AgentTemplate | null {
  const templates = getTemplatesForVertical(vertical, profileType);
  return templates.find(t => t.isDefault) || templates[0] || null;
}

/**
 * Interpola variables en un template de prompt
 */
export function interpolatePromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
}

/**
 * Obtiene el estilo de respuesta recomendado
 */
export function getRecommendedResponseStyle(): ResponseStyle {
  const recommended = RESPONSE_STYLES.find(s => s.recommended);
  return recommended?.value || 'professional_friendly';
}

/**
 * Valida que todas las variables requeridas estén presentes
 */
export function validateTemplateVariables(
  templateKey: string,
  variables: Record<string, string>
): { valid: boolean; missing: string[] } {
  const template = getTemplate(templateKey);
  if (!template) {
    return { valid: false, missing: ['Template no encontrado'] };
  }

  const missing = template.customizableVariables.filter(
    varName => !variables[varName] || variables[varName].trim() === ''
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

// ======================
// EXPORTS
// ======================

export default AGENT_TEMPLATES;
