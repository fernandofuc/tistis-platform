// =====================================================
// TIS TIS PLATFORM - Template Resolution Service
// Resolves template variables at runtime
// Converts {nombre}, {fecha}, etc. to actual values
// =====================================================

// ======================
// TYPES
// ======================

export interface TemplateVariable {
  key: string;
  description: string;
  category: 'Cliente' | 'Cita' | 'Negocio' | 'Staff' | 'Tiempo';
}

export interface TemplateContext {
  // Cliente info (from conversation/lead)
  cliente?: {
    nombre?: string;
    telefono?: string;
    email?: string;
  };

  // Cita info (from appointment context)
  cita?: {
    fecha?: string;        // Formatted date
    hora?: string;         // Formatted time
    servicio?: string;
    precio?: string | number;
    duracion?: string;
  };

  // Negocio info (from tenant/branch)
  negocio?: {
    nombre?: string;
    sucursal?: string;
    direccion?: string;
    telefono?: string;
    whatsapp?: string;
  };

  // Staff info
  staff?: {
    nombre?: string;
    especialidad?: string;
  };

  // Current time (auto-generated if not provided)
  tiempo?: {
    hora_actual?: string;
    dia_semana?: string;
    saludo?: string;  // Buenos días/tardes/noches
  };
}

export interface ResolutionResult {
  resolved: string;
  unresolvedVariables: string[];
  resolvedCount: number;
}

// ======================
// AVAILABLE VARIABLES
// ======================

export const AVAILABLE_VARIABLES: TemplateVariable[] = [
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

// Group variables by category
export const VARIABLES_BY_CATEGORY = AVAILABLE_VARIABLES.reduce((acc, variable) => {
  if (!acc[variable.category]) {
    acc[variable.category] = [];
  }
  acc[variable.category].push(variable);
  return acc;
}, {} as Record<string, TemplateVariable[]>);

// ======================
// HELPERS
// ======================

/**
 * Gets time-based greeting in Spanish
 */
function getTimeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Gets day of week in Spanish
 */
function getDayOfWeek(date: Date): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[date.getDay()];
}

/**
 * Formats time in 12h format for display
 */
function formatTime12h(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Formats price for display
 */
function formatPrice(price: string | number | undefined): string {
  if (!price) return '';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return String(price);
  return `$${numPrice.toLocaleString('es-MX')}`;
}

// ======================
// MAIN SERVICE
// ======================

/**
 * TemplateResolutionService
 *
 * Resolves template variables in text strings.
 * Supports automatic time variables and custom context.
 */
export class TemplateResolutionService {
  /**
   * Builds the variable map from context
   */
  private buildVariableMap(context: TemplateContext, now: Date): Map<string, string> {
    const map = new Map<string, string>();

    // Time variables (auto-generated)
    const timeContext = context.tiempo || {};
    map.set('{hora_actual}', timeContext.hora_actual || formatTime12h(now));
    map.set('{dia_semana}', timeContext.dia_semana || getDayOfWeek(now));
    map.set('{saludo_tiempo}', timeContext.saludo || getTimeGreeting(now.getHours()));

    // Cliente variables
    if (context.cliente) {
      if (context.cliente.nombre) map.set('{nombre}', context.cliente.nombre);
      if (context.cliente.telefono) map.set('{telefono}', context.cliente.telefono);
    }

    // Cita variables
    if (context.cita) {
      if (context.cita.fecha) map.set('{fecha}', context.cita.fecha);
      if (context.cita.hora) map.set('{hora}', context.cita.hora);
      if (context.cita.servicio) map.set('{servicio}', context.cita.servicio);
      if (context.cita.precio) map.set('{precio}', formatPrice(context.cita.precio));
      if (context.cita.duracion) map.set('{duracion}', context.cita.duracion);
    }

    // Negocio variables
    if (context.negocio) {
      if (context.negocio.nombre) map.set('{negocio}', context.negocio.nombre);
      if (context.negocio.sucursal) map.set('{sucursal}', context.negocio.sucursal);
      if (context.negocio.direccion) map.set('{direccion}', context.negocio.direccion);
      if (context.negocio.telefono) map.set('{telefono_negocio}', context.negocio.telefono);
      if (context.negocio.whatsapp) map.set('{whatsapp}', context.negocio.whatsapp);
    }

    // Staff variables
    if (context.staff) {
      if (context.staff.nombre) map.set('{especialista}', context.staff.nombre);
      if (context.staff.especialidad) map.set('{especialidad}', context.staff.especialidad);
    }

    return map;
  }

  /**
   * Resolves all variables in a template string
   *
   * @param template - The template string with {variables}
   * @param context - The context with values to substitute
   * @returns Resolution result with resolved text and unresolved variables
   */
  resolve(template: string, context: TemplateContext = {}): ResolutionResult {
    const now = new Date();
    const variableMap = this.buildVariableMap(context, now);

    const unresolvedVariables: string[] = [];
    let resolvedCount = 0;

    // Find all variables in template
    const variableRegex = /\{[a-z_]+\}/g;
    const foundVariables = template.match(variableRegex) || [];

    // Resolve each variable
    let resolved = template;
    for (const variable of foundVariables) {
      const value = variableMap.get(variable);
      if (value !== undefined) {
        resolved = resolved.replace(new RegExp(escapeRegex(variable), 'g'), value);
        resolvedCount++;
      } else {
        // Track unresolved variables (avoid duplicates)
        if (!unresolvedVariables.includes(variable)) {
          unresolvedVariables.push(variable);
        }
      }
    }

    return {
      resolved,
      unresolvedVariables,
      resolvedCount,
    };
  }

  /**
   * Resolves a template and returns just the string
   * Unresolved variables are left as-is
   */
  resolveString(template: string, context: TemplateContext = {}): string {
    return this.resolve(template, context).resolved;
  }

  /**
   * Checks if a template has any variables
   */
  hasVariables(template: string): boolean {
    return /\{[a-z_]+\}/.test(template);
  }

  /**
   * Extracts all variables from a template
   */
  extractVariables(template: string): string[] {
    const matches = template.match(/\{[a-z_]+\}/g) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Validates that all variables in a template are known
   */
  validateVariables(template: string): { valid: boolean; unknownVariables: string[] } {
    const extracted = this.extractVariables(template);
    const knownKeys = new Set(AVAILABLE_VARIABLES.map(v => v.key));
    const unknownVariables = extracted.filter(v => !knownKeys.has(v));
    return {
      valid: unknownVariables.length === 0,
      unknownVariables,
    };
  }
}

// Helper to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ======================
// SINGLETON INSTANCE
// ======================

export const templateResolver = new TemplateResolutionService();

// ======================
// CONVENIENCE FUNCTIONS
// ======================

/**
 * Resolves template variables - convenience function
 */
export function resolveTemplate(template: string, context: TemplateContext = {}): string {
  return templateResolver.resolveString(template, context);
}

/**
 * Resolves template with full result - convenience function
 */
export function resolveTemplateWithInfo(
  template: string,
  context: TemplateContext = {}
): ResolutionResult {
  return templateResolver.resolve(template, context);
}

/**
 * Builds context from business/conversation data
 * Helper to construct TemplateContext from common sources
 */
export function buildTemplateContext(params: {
  clientName?: string;
  clientPhone?: string;
  appointmentDate?: Date | string;
  appointmentService?: string;
  appointmentPrice?: number;
  appointmentDuration?: string;
  businessName?: string;
  branchName?: string;
  branchAddress?: string;
  businessPhone?: string;
  businessWhatsapp?: string;
  staffName?: string;
  staffSpecialty?: string;
}): TemplateContext {
  const context: TemplateContext = {};

  // Cliente
  if (params.clientName || params.clientPhone) {
    context.cliente = {
      nombre: params.clientName,
      telefono: params.clientPhone,
    };
  }

  // Cita
  if (params.appointmentDate || params.appointmentService) {
    const date = params.appointmentDate
      ? (typeof params.appointmentDate === 'string'
          ? new Date(params.appointmentDate)
          : params.appointmentDate)
      : undefined;

    context.cita = {
      fecha: date ? date.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : undefined,
      hora: date ? formatTime12h(date) : undefined,
      servicio: params.appointmentService,
      precio: params.appointmentPrice,
      duracion: params.appointmentDuration,
    };
  }

  // Negocio
  if (params.businessName || params.branchName) {
    context.negocio = {
      nombre: params.businessName,
      sucursal: params.branchName,
      direccion: params.branchAddress,
      telefono: params.businessPhone,
      whatsapp: params.businessWhatsapp,
    };
  }

  // Staff
  if (params.staffName || params.staffSpecialty) {
    context.staff = {
      nombre: params.staffName,
      especialidad: params.staffSpecialty,
    };
  }

  return context;
}
