// =====================================================
// TIS TIS PLATFORM - Prompt Sanitizer Service
// Sprint 4: Extraído de prompt-generator.service.ts
// Sanitización de datos sensibles antes de enviar a LLMs
// =====================================================

import type { BusinessContext } from './prompt-generator.service';

// ======================
// SENSITIVE DATA PATTERNS
// ======================

/**
 * Patrones de datos sensibles que deben sanitizarse antes de enviar a LLMs
 */
export const SENSITIVE_PATTERNS = {
  // Tarjetas de crédito/débito (16 dígitos con o sin espacios/guiones)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // CVV (3-4 dígitos después de palabra clave)
  cvv: /\b(?:cvv|cvc|cv2|security code)[:\s]*\d{3,4}\b/gi,
  // Contraseñas (después de palabras clave)
  password: /\b(?:password|contraseña|clave|pwd)[:\s=]*['"]?[\w!@#$%^&*]{4,}['"]?\b/gi,
  // Tokens/API Keys (formatos comunes)
  apiKey: /\b(?:api[_-]?key|token|secret|bearer)[:\s=]*['"]?[a-zA-Z0-9_-]{20,}['"]?\b/gi,
  // SSN americano (XXX-XX-XXXX con guiones obligatorios o palabra clave)
  ssn: /\b(?:ssn|social security|seguro social)[:\s]*\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,
  // CURP mexicana (18 caracteres con formato específico)
  curp: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi,
  // RFC mexicano (12-13 caracteres con formato específico)
  rfc: /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\b/gi,
  // Correos electrónicos privados (solo sanitizar en contextos específicos)
  privateEmail: /\b[a-zA-Z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo|icloud)\.[a-zA-Z]{2,}\b/gi,
  // IPs privadas
  privateIp: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
  // CLABE mexicana (18 dígitos con palabra clave para evitar falsos positivos)
  clabe: /\b(?:clabe|cuenta|transferencia)[:\s]*\d{18}\b/gi,
} as const;

/**
 * Reemplazos seguros para cada tipo de dato sensible
 */
export const SANITIZATION_REPLACEMENTS: Record<keyof typeof SENSITIVE_PATTERNS, string> = {
  creditCard: '[TARJETA_REDACTADA]',
  cvv: '[CVV_REDACTADO]',
  password: '[CONTRASEÑA_REDACTADA]',
  apiKey: '[TOKEN_REDACTADO]',
  ssn: '[SSN_REDACTADO]',
  curp: '[CURP_REDACTADA]',
  rfc: '[RFC_REDACTADO]',
  privateEmail: '[EMAIL_PERSONAL_REDACTADO]',
  privateIp: '[IP_PRIVADA_REDACTADA]',
  clabe: '[CLABE_REDACTADA]',
};

// ======================
// TYPES
// ======================

export interface SanitizationOptions {
  /** Sanitize personal email addresses (default: false, business emails are useful) */
  sanitizeEmails?: boolean;
  /** Log redactions to console (default: true in development) */
  logRedactions?: boolean;
}

export interface SanitizationResult {
  /** Sanitized text */
  sanitized: string;
  /** Number of redactions made */
  redactionCount: number;
  /** Types of data that were redacted */
  redactedTypes: string[];
}

export interface ContextSanitizationResult {
  /** Sanitized context object */
  sanitizedContext: BusinessContext;
  /** Total number of redactions across all fields */
  totalRedactions: number;
}

// ======================
// MAIN SANITIZATION FUNCTIONS
// ======================

/**
 * Sanitiza datos sensibles de un texto antes de enviarlo a LLMs
 *
 * @param text - Texto a sanitizar
 * @param options - Opciones de sanitización
 * @returns Texto sanitizado y conteo de redacciones
 *
 * @example
 * ```typescript
 * const result = sanitizeSensitiveData('Mi tarjeta es 4111 1111 1111 1111');
 * // result.sanitized = 'Mi tarjeta es [TARJETA_REDACTADA]'
 * // result.redactionCount = 1
 * ```
 */
export function sanitizeSensitiveData(
  text: string | null | undefined,
  options: SanitizationOptions = {}
): SanitizationResult {
  // Handle null/undefined
  if (!text || typeof text !== 'string') {
    return { sanitized: '', redactionCount: 0, redactedTypes: [] };
  }

  const {
    sanitizeEmails = false,
    logRedactions = process.env.NODE_ENV === 'development',
  } = options;

  let sanitized = text;
  let redactionCount = 0;
  const redactedTypes: string[] = [];

  // Apply each sanitization pattern
  for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    // Skip emails if not requested
    if (patternName === 'privateEmail' && !sanitizeEmails) continue;

    const replacement = SANITIZATION_REPLACEMENTS[patternName as keyof typeof SENSITIVE_PATTERNS];
    const matches = sanitized.match(pattern);

    if (matches && matches.length > 0) {
      sanitized = sanitized.replace(pattern, replacement);
      redactionCount += matches.length;
      redactedTypes.push(patternName);

      if (logRedactions) {
        console.log(`[Sanitizer] Redacted ${matches.length} ${patternName} instance(s)`);
      }
    }
  }

  return { sanitized, redactionCount, redactedTypes };
}

/**
 * Sanitiza un objeto BusinessContext completo
 * Aplica sanitización a todos los campos de texto
 *
 * @param context - Business context to sanitize
 * @returns Sanitized context and total redaction count
 */
export function sanitizeBusinessContext(
  context: BusinessContext
): ContextSanitizationResult {
  let totalRedactions = 0;

  // Create deep copy to avoid mutating original
  const sanitizedContext: BusinessContext = JSON.parse(JSON.stringify(context));

  // Sanitize main text fields
  if (sanitizedContext.customInstructions) {
    const { sanitized, redactionCount } = sanitizeSensitiveData(sanitizedContext.customInstructions);
    sanitizedContext.customInstructions = sanitized;
    totalRedactions += redactionCount;
  }

  if (sanitizedContext.goodbyeMessage) {
    const { sanitized, redactionCount } = sanitizeSensitiveData(sanitizedContext.goodbyeMessage);
    sanitizedContext.goodbyeMessage = sanitized;
    totalRedactions += redactionCount;
  }

  // Sanitize string arrays
  if (sanitizedContext.fillerPhrases) {
    sanitizedContext.fillerPhrases = sanitizedContext.fillerPhrases.map(phrase => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(phrase);
      totalRedactions += redactionCount;
      return sanitized;
    });
  }

  // Sanitize FAQs
  if (sanitizedContext.faqs) {
    sanitizedContext.faqs = sanitizedContext.faqs.map(faq => {
      const { sanitized: sanitizedQ, redactionCount: countQ } = sanitizeSensitiveData(faq.question);
      const { sanitized: sanitizedA, redactionCount: countA } = sanitizeSensitiveData(faq.answer);
      totalRedactions += countQ + countA;
      return { ...faq, question: sanitizedQ, answer: sanitizedA };
    });
  }

  // Sanitize specialInstructions per service
  if (sanitizedContext.services) {
    sanitizedContext.services = sanitizedContext.services.map(service => {
      if (service.specialInstructions) {
        const { sanitized, redactionCount } = sanitizeSensitiveData(service.specialInstructions);
        totalRedactions += redactionCount;
        return { ...service, specialInstructions: sanitized };
      }
      return service;
    });
  }

  // Sanitize responseTemplates
  if (sanitizedContext.responseTemplates) {
    sanitizedContext.responseTemplates = sanitizedContext.responseTemplates.map(template => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(template.template);
      totalRedactions += redactionCount;
      return { ...template, template: sanitized };
    });
  }

  // Sanitize competitorHandling
  if (sanitizedContext.competitorHandling) {
    sanitizedContext.competitorHandling = sanitizedContext.competitorHandling.map(comp => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(comp.responseStrategy);
      totalRedactions += redactionCount;
      return { ...comp, responseStrategy: sanitized };
    });
  }

  // Sanitize customInstructionsList
  if (sanitizedContext.customInstructionsList) {
    sanitizedContext.customInstructionsList = sanitizedContext.customInstructionsList.map(item => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(item.instruction);
      totalRedactions += redactionCount;
      return { ...item, instruction: sanitized };
    });
  }

  // Sanitize businessPolicies
  if (sanitizedContext.businessPolicies) {
    sanitizedContext.businessPolicies = sanitizedContext.businessPolicies.map(policy => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(policy.policy);
      totalRedactions += redactionCount;
      return { ...policy, policy: sanitized };
    });
  }

  // Sanitize knowledgeArticles
  if (sanitizedContext.knowledgeArticles) {
    sanitizedContext.knowledgeArticles = sanitizedContext.knowledgeArticles.map(article => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(article.content);
      totalRedactions += redactionCount;
      return { ...article, content: sanitized };
    });
  }

  if (totalRedactions > 0) {
    console.log(`[Sanitizer] Total redactions in context: ${totalRedactions}`);
  }

  return { sanitizedContext, totalRedactions };
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Check if text contains potentially sensitive data
 */
export function containsSensitiveData(text: string): boolean {
  for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
    if (pattern.test(text)) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      return true;
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }
  return false;
}

/**
 * Get list of sensitive data types found in text
 */
export function detectSensitiveDataTypes(text: string): string[] {
  const types: string[] = [];

  for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    if (pattern.test(text)) {
      types.push(patternName);
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  return types;
}

// ======================
// EXPORTS
// ======================

export const PromptSanitizer = {
  sanitizeSensitiveData,
  sanitizeBusinessContext,
  containsSensitiveData,
  detectSensitiveDataTypes,
  SENSITIVE_PATTERNS,
  SANITIZATION_REPLACEMENTS,
};
