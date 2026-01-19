/**
 * LLMOutputSanitizer - Validación y sanitización de respuestas LLM
 * MEJORA-1.2: Implementación completa
 *
 * Estándares implementados:
 * - OWASP LLM Top 10 2025 - LLM02: Insecure Output Handling
 * - Content Security Policy compliance
 */

// ============================================
// TIPOS Y INTERFACES
// ============================================

export interface SanitizationResult {
  isValid: boolean;
  sanitizedText: string;
  issues: SanitizationIssue[];
  confidence: number;
  processingTimeMs: number;
}

export interface SanitizationIssue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  originalValue?: string;
  action: 'removed' | 'replaced' | 'flagged';
}

export type IssueType =
  | 'executable_code'
  | 'unauthorized_url'
  | 'html_injection'
  | 'markdown_exploit'
  | 'prompt_leakage'
  | 'hallucination'
  | 'contradiction'
  | 'inappropriate_content'
  | 'excessive_length'
  | 'empty_response';

export interface SanitizerConfig {
  maxResponseLength: number;
  minResponseLength: number;
  allowedDomains: string[];
  blockedPatterns: RegExp[];
  enableHallucinationCheck: boolean;
  enableCoherenceCheck: boolean;
  businessContext?: BusinessContext;
}

export interface BusinessContext {
  businessName: string;
  businessType: string;
  validServices: string[];
  validPrices: Map<string, { min: number; max: number }>;
  validLocations: string[];
  validHours: string;
}

// ============================================
// PATRONES DE DETECCIÓN
// ============================================

const DANGEROUS_PATTERNS = {
  // Código ejecutable
  javascript: [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /eval\s*\(/gi,
    /new\s+Function\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
  ],

  // HTML peligroso
  html: [
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<object\b[^>]*>[\s\S]*?<\/object>/gi,
    /<embed\b[^>]*>/gi,
    /<form\b[^>]*>[\s\S]*?<\/form>/gi,
    /<input\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
  ],

  // Markdown exploits
  markdown: [
    /\[.*?\]\(javascript:.*?\)/gi,
    /\[.*?\]\(data:.*?\)/gi,
    /!\[.*?\]\(.*?onerror.*?\)/gi,
  ],

  // Prompt leakage
  promptLeakage: [
    /system\s*prompt/gi,
    /you\s+are\s+an?\s+AI/gi,
    /as\s+an?\s+AI\s+language\s+model/gi,
    /I\s+am\s+(?:an?\s+)?AI/gi,
    /my\s+instructions\s+(?:are|say)/gi,
    /ignore\s+(?:all\s+)?previous\s+instructions/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
  ],

  // Contenido inapropiado
  inappropriate: [
    // Solo patrones muy específicos, no palabras comunes
    /\b(?:hack|exploit|inject|bypass\s+security)\b/gi,
  ],
};

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class LLMOutputSanitizer {
  private config: SanitizerConfig;

  constructor(config?: Partial<SanitizerConfig>) {
    this.config = {
      maxResponseLength: 4000,
      minResponseLength: 10,
      allowedDomains: [
        // Dominios permitidos por defecto
        'wa.me',
        'whatsapp.com',
        'maps.google.com',
        'goo.gl',
        'bit.ly',
        // Agregar dominios del negocio
      ],
      blockedPatterns: [],
      enableHallucinationCheck: true,
      enableCoherenceCheck: true,
      ...config,
    };
  }

  // ============================================
  // MÉTODO PRINCIPAL
  // ============================================

  async sanitize(
    response: string,
    context?: { userMessage?: string; businessContext?: BusinessContext }
  ): Promise<SanitizationResult> {
    const startTime = Date.now();
    const issues: SanitizationIssue[] = [];
    let sanitizedText = response;
    let isValid = true;

    // 1. Validar longitud
    const lengthIssues = this.validateLength(response);
    issues.push(...lengthIssues);
    if (lengthIssues.some(i => i.severity === 'critical')) {
      isValid = false;
    }

    // 2. Detectar y remover código ejecutable
    const codeResult = this.removeExecutableCode(sanitizedText);
    sanitizedText = codeResult.text;
    issues.push(...codeResult.issues);

    // 3. Validar URLs
    const urlResult = this.validateURLs(sanitizedText);
    sanitizedText = urlResult.text;
    issues.push(...urlResult.issues);

    // 4. Detectar prompt leakage
    const leakageResult = this.detectPromptLeakage(sanitizedText);
    sanitizedText = leakageResult.text;
    issues.push(...leakageResult.issues);
    if (leakageResult.issues.length > 0) {
      isValid = false; // Crítico
    }

    // 5. Validar HTML/Markdown peligroso
    const markdownResult = this.sanitizeMarkdown(sanitizedText);
    sanitizedText = markdownResult.text;
    issues.push(...markdownResult.issues);

    // 6. Check de coherencia (si está habilitado y hay contexto)
    if (this.config.enableCoherenceCheck && context?.businessContext) {
      const coherenceIssues = this.checkCoherence(sanitizedText, context.businessContext);
      issues.push(...coherenceIssues);
    }

    // 7. Detectar respuesta vacía o sin sentido
    const emptyIssues = this.checkEmptyResponse(sanitizedText);
    issues.push(...emptyIssues);
    if (emptyIssues.some(i => i.severity === 'critical')) {
      isValid = false;
    }

    // Calcular confianza basada en issues
    const confidence = this.calculateConfidence(issues);

    return {
      isValid,
      sanitizedText: sanitizedText.trim(),
      issues,
      confidence,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ============================================
  // VALIDACIONES ESPECÍFICAS
  // ============================================

  private validateLength(text: string): SanitizationIssue[] {
    const issues: SanitizationIssue[] = [];

    if (text.length === 0) {
      issues.push({
        type: 'empty_response',
        severity: 'critical',
        description: 'Respuesta vacía del LLM',
        action: 'flagged',
      });
    } else if (text.length < this.config.minResponseLength) {
      issues.push({
        type: 'empty_response',
        severity: 'high',
        description: `Respuesta muy corta (${text.length} caracteres)`,
        action: 'flagged',
      });
    } else if (text.length > this.config.maxResponseLength) {
      issues.push({
        type: 'excessive_length',
        severity: 'medium',
        description: `Respuesta excede límite (${text.length}/${this.config.maxResponseLength})`,
        action: 'flagged',
      });
    }

    return issues;
  }

  private removeExecutableCode(text: string): { text: string; issues: SanitizationIssue[] } {
    const issues: SanitizationIssue[] = [];
    let result = text;

    // JavaScript
    for (const pattern of DANGEROUS_PATTERNS.javascript) {
      const matches = result.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            type: 'executable_code',
            severity: 'critical',
            description: 'Código JavaScript detectado y removido',
            originalValue: match.substring(0, 50) + '...',
            action: 'removed',
          });
        }
        result = result.replace(pattern, '[CÓDIGO_REMOVIDO]');
      }
    }

    // HTML peligroso
    for (const pattern of DANGEROUS_PATTERNS.html) {
      const matches = result.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            type: 'html_injection',
            severity: 'high',
            description: 'HTML peligroso detectado y removido',
            originalValue: match.substring(0, 50) + '...',
            action: 'removed',
          });
        }
        result = result.replace(pattern, '');
      }
    }

    return { text: result, issues };
  }

  private validateURLs(text: string): { text: string; issues: SanitizationIssue[] } {
    const issues: SanitizationIssue[] = [];
    let result = text;

    const urls = text.match(URL_PATTERN) || [];

    for (const url of urls) {
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.toLowerCase();

        // Verificar si el dominio está permitido
        const isAllowed = this.config.allowedDomains.some(allowed =>
          domain === allowed || domain.endsWith('.' + allowed)
        );

        if (!isAllowed) {
          issues.push({
            type: 'unauthorized_url',
            severity: 'high',
            description: `URL no autorizada: ${domain}`,
            originalValue: url,
            action: 'replaced',
          });
          result = result.replace(url, '[URL_REMOVIDA]');
        }
      } catch {
        // URL malformada
        issues.push({
          type: 'unauthorized_url',
          severity: 'medium',
          description: 'URL malformada detectada',
          originalValue: url,
          action: 'removed',
        });
        result = result.replace(url, '');
      }
    }

    return { text: result, issues };
  }

  private detectPromptLeakage(text: string): { text: string; issues: SanitizationIssue[] } {
    const issues: SanitizationIssue[] = [];
    const result = text;

    for (const pattern of DANGEROUS_PATTERNS.promptLeakage) {
      const matches = result.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            type: 'prompt_leakage',
            severity: 'critical',
            description: 'Posible filtración de prompt del sistema',
            originalValue: match,
            action: 'flagged',
          });
        }
        // No removemos automáticamente, solo flaggeamos
        // porque puede ser coincidencia legítima
      }
    }

    return { text: result, issues };
  }

  private sanitizeMarkdown(text: string): { text: string; issues: SanitizationIssue[] } {
    const issues: SanitizationIssue[] = [];
    let result = text;

    for (const pattern of DANGEROUS_PATTERNS.markdown) {
      const matches = result.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            type: 'markdown_exploit',
            severity: 'high',
            description: 'Markdown malicioso detectado',
            originalValue: match,
            action: 'removed',
          });
        }
        result = result.replace(pattern, '[ENLACE_REMOVIDO]');
      }
    }

    return { text: result, issues };
  }

  private checkCoherence(
    text: string,
    context: BusinessContext
  ): SanitizationIssue[] {
    const issues: SanitizationIssue[] = [];

    // Verificar precios mencionados
    const priceMatches = text.match(/\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:pesos|mxn|usd|dólares)/gi);
    if (priceMatches && context.validPrices) {
      for (const priceMatch of priceMatches) {
        const numericValue = parseFloat(priceMatch.replace(/[^\d.]/g, ''));

        // Verificar si el precio está en rango válido para algún servicio
        let priceValid = false;
        for (const [, range] of context.validPrices) {
          if (numericValue >= range.min && numericValue <= range.max) {
            priceValid = true;
            break;
          }
        }

        if (!priceValid && numericValue > 0) {
          issues.push({
            type: 'hallucination',
            severity: 'medium',
            description: `Precio posiblemente incorrecto: ${priceMatch}`,
            originalValue: priceMatch,
            action: 'flagged',
          });
        }
      }
    }

    // Verificar servicios mencionados
    if (context.validServices && context.validServices.length > 0) {
      // Buscar servicios que no existen
      const servicePatterns = [
        /(?:ofrecemos|tenemos|hacemos|realizamos)\s+([^.!?]+)/gi,
        /(?:servicio|tratamiento|procedimiento)\s+(?:de\s+)?([^.!?]+)/gi,
      ];

      for (const pattern of servicePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const mentionedService = match[1].toLowerCase().trim();
          const isValid = context.validServices.some(valid =>
            mentionedService.includes(valid.toLowerCase())
          );

          if (!isValid && mentionedService.length > 5) {
            // Solo flaggear si es suficientemente específico
            issues.push({
              type: 'hallucination',
              severity: 'low',
              description: `Servicio no verificado: "${mentionedService}"`,
              originalValue: mentionedService,
              action: 'flagged',
            });
          }
        }
      }
    }

    return issues;
  }

  private checkEmptyResponse(text: string): SanitizationIssue[] {
    const issues: SanitizationIssue[] = [];
    const trimmed = text.trim();

    // Respuestas problemáticas comunes
    const problematicResponses = [
      /^\.+$/,  // Solo puntos
      /^[\s\n]+$/,  // Solo espacios
      /^(?:ok|okay|sí|si|no|hola|gracias)\.?$/i,  // Respuestas de una palabra
      /^I\s+(?:don't|cannot|can't)\s+(?:know|help|answer)/i,  // Incapacidad
      /^Lo siento,?\s+(?:no\s+)?(?:puedo|tengo)/i,  // Incapacidad en español
    ];

    for (const pattern of problematicResponses) {
      if (pattern.test(trimmed)) {
        issues.push({
          type: 'empty_response',
          severity: 'high',
          description: 'Respuesta insuficiente o vacía',
          originalValue: trimmed.substring(0, 50),
          action: 'flagged',
        });
        break;
      }
    }

    return issues;
  }

  private calculateConfidence(issues: SanitizationIssue[]): number {
    let confidence = 1.0;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          confidence -= 0.3;
          break;
        case 'high':
          confidence -= 0.15;
          break;
        case 'medium':
          confidence -= 0.05;
          break;
        case 'low':
          confidence -= 0.02;
          break;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // ============================================
  // MÉTODOS PÚBLICOS ADICIONALES
  // ============================================

  /**
   * Crea una instancia con dominios adicionales (NO modifica el singleton)
   * @deprecated Usar createSanitizerWithDomains() en su lugar
   */
  addAllowedDomains(domains: string[]): void {
    // NOTA: Este método modifica la instancia. Si se usa el singleton,
    // los dominios persisten entre requests. Usar con cuidado.
    this.config.allowedDomains.push(...domains);
  }

  /**
   * Crea una copia de configuración con dominios adicionales
   * Retorna nueva configuración sin modificar la instancia
   */
  getConfigWithDomains(additionalDomains: string[]): SanitizerConfig {
    return {
      ...this.config,
      allowedDomains: [...this.config.allowedDomains, ...additionalDomains],
    };
  }

  /**
   * Establece contexto de negocio
   * @deprecated Pasar contexto directamente a sanitize() en su lugar
   */
  setBusinessContext(context: BusinessContext): void {
    this.config.businessContext = context;
  }

  /**
   * Obtiene la configuración actual (copia defensiva)
   */
  getConfig(): SanitizerConfig {
    return {
      ...this.config,
      allowedDomains: [...this.config.allowedDomains],
    };
  }

  /**
   * Validación rápida sin sanitización
   */
  async quickValidate(response: string): Promise<boolean> {
    // Solo verificar patrones críticos
    for (const pattern of DANGEROUS_PATTERNS.javascript) {
      if (pattern.test(response)) return false;
    }
    for (const pattern of DANGEROUS_PATTERNS.promptLeakage) {
      if (pattern.test(response)) return false;
    }
    return response.length >= this.config.minResponseLength;
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Crea un sanitizer con dominios específicos para un tenant
 * Esta función SIEMPRE crea una nueva instancia para evitar contaminación entre tenants
 */
export function createSanitizerForTenant(
  tenantDomains: string[],
  businessContext?: BusinessContext
): LLMOutputSanitizer {
  const config: Partial<SanitizerConfig> = {
    allowedDomains: [
      // Dominios permitidos por defecto
      'wa.me',
      'whatsapp.com',
      'maps.google.com',
      'goo.gl',
      'bit.ly',
      // Dominios del tenant
      ...tenantDomains,
    ],
    businessContext,
  };
  return new LLMOutputSanitizer(config);
}

// ============================================
// SINGLETON EXPORT (solo para uso en validación rápida sin contexto de tenant)
// ============================================

let sanitizerInstance: LLMOutputSanitizer | null = null;

/**
 * Obtiene el sanitizer singleton base
 * ADVERTENCIA: NO usar addAllowedDomains() con esta instancia
 * Para sanitización por tenant, usar createSanitizerForTenant()
 */
export function getLLMOutputSanitizer(config?: Partial<SanitizerConfig>): LLMOutputSanitizer {
  if (!sanitizerInstance) {
    sanitizerInstance = new LLMOutputSanitizer(config);
  }
  return sanitizerInstance;
}

export default LLMOutputSanitizer;
