// =====================================================
// TIS TIS PLATFORM - Prompt Sanitizer Service
// REVISIÓN 5.4 G-I4: Sanitización de prompts maliciosos
// =====================================================
// Este servicio detecta y neutraliza intentos de prompt injection
// en mensajes de usuarios antes de enviarlos al LLM.
//
// Patrones detectados:
// - Instrucciones directas al modelo ("ignora", "olvida", "actúa como")
// - Comandos de sistema ("system:", "[INST]", etc.)
// - Intentos de extracción de datos ("revela", "muestra el prompt")
// - Jailbreak patterns comunes
// =====================================================

// ======================
// TYPES
// ======================

export interface SanitizationResult {
  original: string;
  sanitized: string;
  wasModified: boolean;
  detectedPatterns: DetectedPattern[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface DetectedPattern {
  type: PromptInjectionType;
  match: string;
  position: number;
}

type PromptInjectionType =
  | 'instruction_override'    // "ignora instrucciones anteriores"
  | 'role_impersonation'      // "actúa como administrador"
  | 'system_command'          // "[SYSTEM]", "<<SYS>>"
  | 'data_extraction'         // "revela tus instrucciones"
  | 'jailbreak_attempt'       // "DAN mode", "developer mode"
  | 'encoding_bypass'         // Base64, hex encoding attempts
  | 'delimiter_injection';    // Intentos de cerrar el contexto

// ======================
// DETECTION PATTERNS
// ======================

/**
 * Patrones de prompt injection en español e inglés
 * Cada patrón tiene un tipo, regex, y nivel de riesgo
 */
const INJECTION_PATTERNS: Array<{
  type: PromptInjectionType;
  pattern: RegExp;
  risk: 'low' | 'medium' | 'high';
  description: string;
}> = [
  // =====================
  // INSTRUCTION OVERRIDE - Alta prioridad
  // =====================
  {
    type: 'instruction_override',
    pattern: /(?:ignora|olvida|descarta|omite)\s*(?:las?|tus?)?\s*(?:instrucciones?|reglas?|directrices?)\s*(?:anteriores?|previas?|del sistema)?/gi,
    risk: 'high',
    description: 'Intento de ignorar instrucciones del sistema',
  },
  {
    type: 'instruction_override',
    pattern: /(?:ignore|forget|discard|disregard)\s*(?:your|the|all|previous)?\s*(?:instructions?|rules?|guidelines?|system\s*prompt)/gi,
    risk: 'high',
    description: 'Attempt to ignore system instructions',
  },
  {
    type: 'instruction_override',
    pattern: /(?:desde\s*ahora|a\s*partir\s*de\s*ahora|from\s*now\s*on)\s*(?:eres|serás|you\s*are|act\s*as)/gi,
    risk: 'high',
    description: 'Intento de cambiar comportamiento base',
  },

  // =====================
  // ROLE IMPERSONATION
  // =====================
  {
    type: 'role_impersonation',
    pattern: /(?:actúa|comportate|responde|pretende|finge)\s*como\s*(?:si\s*fueras\s*)?(?:un|una|el|la)?\s*(?:administrador|desarrollador|hacker|sistema|root|admin)/gi,
    risk: 'high',
    description: 'Intento de suplantación de rol',
  },
  {
    type: 'role_impersonation',
    pattern: /(?:act|behave|respond|pretend|roleplay)\s*(?:as|like)\s*(?:a|an|the)?\s*(?:administrator|developer|hacker|system|root|admin|sudo)/gi,
    risk: 'high',
    description: 'Role impersonation attempt',
  },
  {
    type: 'role_impersonation',
    pattern: /(?:eres|you\s*are)\s*(?:un|una|a|an)?\s*(?:AI|IA|bot|chatbot|asistente)\s*(?:sin|without)\s*(?:restricciones|límites|restrictions|limits)/gi,
    risk: 'high',
    description: 'Intento de remover restricciones',
  },

  // =====================
  // SYSTEM COMMANDS
  // =====================
  {
    type: 'system_command',
    pattern: /\[\s*(?:SYSTEM|INST|SYS|ADMIN)\s*\]/gi,
    risk: 'high',
    description: 'Intento de inyectar comando de sistema',
  },
  {
    type: 'system_command',
    pattern: /<<\s*(?:SYS|SYSTEM|INST)\s*>>/gi,
    risk: 'high',
    description: 'Llama-style system injection',
  },
  {
    type: 'system_command',
    pattern: /<\|(?:im_start|im_end|system|user|assistant)\|>/gi,
    risk: 'high',
    description: 'ChatML injection attempt',
  },
  {
    type: 'system_command',
    pattern: /```(?:system|prompt|instructions?)\s*\n/gi,
    risk: 'medium',
    description: 'Code block system injection',
  },

  // =====================
  // DATA EXTRACTION
  // =====================
  {
    type: 'data_extraction',
    pattern: /(?:revela|muestra|dime|comparte|expón)\s*(?:tu|tus|el|la|los|las)?\s*(?:prompt|instrucciones?|sistema|configuración|datos?\s*de\s*(?:clientes?|pacientes?|usuarios?))/gi,
    risk: 'high',
    description: 'Intento de extraer información del sistema',
  },
  {
    type: 'data_extraction',
    pattern: /(?:reveal|show|tell|share|expose)\s*(?:your|the)?\s*(?:prompt|instructions?|system|configuration|customer|patient|user)\s*(?:data|info|details)?/gi,
    risk: 'high',
    description: 'Data extraction attempt',
  },
  {
    type: 'data_extraction',
    pattern: /(?:cuáles?\s*son|what\s*(?:are|is))\s*(?:tus?|your)\s*(?:instrucciones?|instructions?|rules?|reglas?)/gi,
    risk: 'medium',
    description: 'Intento de conocer reglas del sistema',
  },

  // =====================
  // JAILBREAK PATTERNS
  // =====================
  {
    type: 'jailbreak_attempt',
    pattern: /\b(?:DAN|Do\s*Anything\s*Now|Developer\s*Mode|Jailbreak|DUDE|AIM|STAN)\b/gi,
    risk: 'high',
    description: 'Known jailbreak pattern',
  },
  {
    type: 'jailbreak_attempt',
    pattern: /(?:modo|mode)\s*(?:desarrollador|developer|sin\s*filtros?|unfiltered|unrestricted)/gi,
    risk: 'high',
    description: 'Developer/unfiltered mode attempt',
  },
  {
    type: 'jailbreak_attempt',
    pattern: /(?:bypass|evade|circumvent|evadir|saltarse)\s*(?:los?|las?|your|the)?\s*(?:filtros?|restricciones?|filters?|restrictions?|safety)/gi,
    risk: 'high',
    description: 'Filter bypass attempt',
  },

  // =====================
  // DELIMITER INJECTION
  // =====================
  {
    type: 'delimiter_injection',
    pattern: /"""[\s\S]*?"""/g,
    risk: 'low',
    description: 'Triple quote delimiter',
  },
  {
    type: 'delimiter_injection',
    pattern: /---\s*(?:fin|end|nuevo|new)\s*(?:del?)?\s*(?:mensaje|message|contexto|context)\s*---/gi,
    risk: 'medium',
    description: 'Context delimiter injection',
  },

  // =====================
  // ENCODING BYPASS
  // =====================
  {
    type: 'encoding_bypass',
    pattern: /(?:base64|hex|rot13|unicode)\s*(?:decode|decodifica|descifra)/gi,
    risk: 'medium',
    description: 'Encoding bypass instruction',
  },
];

// ======================
// SANITIZATION FUNCTIONS
// ======================

/**
 * Sanitiza un mensaje de usuario detectando y neutralizando prompt injections
 *
 * REVISIÓN 5.4 G-I4: Previene manipulación del AI por usuarios maliciosos
 *
 * @param message - Mensaje original del usuario
 * @returns Resultado de sanitización con detalles de lo detectado
 */
export function sanitizeUserPrompt(message: string): SanitizationResult {
  if (!message || typeof message !== 'string') {
    return {
      original: message || '',
      sanitized: message || '',
      wasModified: false,
      detectedPatterns: [],
      riskLevel: 'none',
    };
  }

  const detectedPatterns: DetectedPattern[] = [];
  let sanitized = message;
  let maxRisk: 'none' | 'low' | 'medium' | 'high' = 'none';

  // Detectar y neutralizar cada patrón
  for (const { type, pattern, risk, description } of INJECTION_PATTERNS) {
    // Crear nueva instancia del regex para evitar problemas con lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(message)) !== null) {
      detectedPatterns.push({
        type,
        match: match[0],
        position: match.index,
      });

      // Actualizar nivel de riesgo máximo
      if (risk === 'high' || (risk === 'medium' && maxRisk !== 'high') || (risk === 'low' && maxRisk === 'none')) {
        maxRisk = risk;
      }

      // Log para monitoreo (solo en desarrollo/staging)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Prompt Sanitizer] Detected ${type}: "${match[0]}" - ${description}`);
      }
    }
  }

  // Si se detectaron patrones de alto riesgo, neutralizar el mensaje
  if (maxRisk === 'high') {
    // Reemplazar patrones de alto riesgo con versiones seguras
    for (const { pattern } of INJECTION_PATTERNS.filter(p => p.risk === 'high')) {
      const regex = new RegExp(pattern.source, pattern.flags);
      sanitized = sanitized.replace(regex, '[contenido filtrado]');
    }

    // Agregar prefijo de seguridad
    sanitized = `[Mensaje del cliente]: ${sanitized}`;

    console.warn(
      `[Prompt Sanitizer] G-I4: High-risk patterns detected and neutralized. ` +
      `Patterns: ${detectedPatterns.map(p => p.type).join(', ')}`
    );
  } else if (maxRisk === 'medium') {
    // Para riesgo medio, solo agregar prefijo
    sanitized = `[Mensaje del cliente]: ${sanitized}`;

    console.log(
      `[Prompt Sanitizer] G-I4: Medium-risk patterns detected. ` +
      `Patterns: ${detectedPatterns.map(p => p.type).join(', ')}`
    );
  }

  return {
    original: message,
    sanitized,
    wasModified: sanitized !== message,
    detectedPatterns,
    riskLevel: maxRisk,
  };
}

/**
 * Versión simplificada que solo retorna el mensaje sanitizado
 * Para uso directo en el flujo de procesamiento
 */
export function sanitize(message: string): string {
  return sanitizeUserPrompt(message).sanitized;
}

/**
 * Verifica si un mensaje contiene patrones sospechosos sin modificarlo
 * Útil para logging y métricas
 */
export function containsInjectionPatterns(message: string): {
  containsPatterns: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  patternCount: number;
} {
  const result = sanitizeUserPrompt(message);
  return {
    containsPatterns: result.detectedPatterns.length > 0,
    riskLevel: result.riskLevel,
    patternCount: result.detectedPatterns.length,
  };
}

// ======================
// EXPORTS
// ======================

export const PromptSanitizer = {
  sanitize,
  sanitizeUserPrompt,
  containsInjectionPatterns,
};
