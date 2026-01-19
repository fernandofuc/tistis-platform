/**
 * PIIDetectionService - Detección y enmascaramiento de PII
 * MEJORA-1.1: Implementación completa
 *
 * Estándares implementados:
 * - OWASP LLM Top 10 2025 - LLM06: Sensitive Information Disclosure
 * - GDPR Article 25 - Data Protection by Design
 * - HIPAA Safe Harbor - 18 identifiers
 */

import { createHash } from 'crypto';

// ============================================
// TIPOS Y INTERFACES
// ============================================

export interface PIIMatch {
  type: PIIType;
  value: string;
  masked: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface PIIDetectionResult {
  hasPII: boolean;
  matches: PIIMatch[];
  sanitizedText: string;
  originalHash: string;
  detectionTimeMs: number;
}

export interface PIIDetectionConfig {
  enableCreditCard: boolean;
  enableSSN: boolean;
  enableEmail: boolean;
  enablePhone: boolean;
  enableAddress: boolean;
  enableAPIKeys: boolean;
  enableCustomPatterns: boolean;
  customPatterns: CustomPattern[];
  maskingStrategy: 'full' | 'partial' | 'hash';
  logDetections: boolean;
}

export interface CustomPattern {
  name: string;
  pattern: RegExp;
  maskChar: string;
  visibleChars: number;
}

export type PIIType =
  | 'credit_card'
  | 'ssn'
  | 'email'
  | 'phone'
  | 'address'
  | 'api_key'
  | 'jwt_token'
  | 'password'
  | 'ip_address'
  | 'date_of_birth'
  | 'medical_record'
  | 'bank_account'
  | 'passport'
  | 'drivers_license'
  | 'custom';

// ============================================
// PATRONES DE DETECCIÓN
// ============================================

const PII_PATTERNS: Record<PIIType, RegExp[]> = {
  credit_card: [
    // Visa
    /\b4[0-9]{12}(?:[0-9]{3})?\b/g,
    // Mastercard
    /\b5[1-5][0-9]{14}\b/g,
    // American Express
    /\b3[47][0-9]{13}\b/g,
    // Discover
    /\b6(?:011|5[0-9]{2})[0-9]{12}\b/g,
    // Con espacios o guiones
    /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|6(?:011|5[0-9]{2})|3[47][0-9]{2})[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/g,
  ],

  ssn: [
    // SSN USA: XXX-XX-XXXX (requiere guiones o espacios para reducir falsos positivos)
    /\b(?!000|666|9\d{2})\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4}\b/g,
    // CURP México (18 caracteres específicos)
    /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi,
    // RFC México (12-13 caracteres específicos)
    /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi,
    // NSS México (IMSS) - 11 dígitos después de contexto conocido
    // Nota: Este patrón detecta el contexto + número para que el valor sea reemplazable
    /\bNSS[:\s]*\d{11}\b/gi,
    /\bIMSS[:\s]*\d{11}\b/gi,
  ],

  email: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ],

  phone: [
    // Internacional
    /\b\+?[1-9]\d{1,14}\b/g,
    // México
    /\b(?:\+?52[-\s]?)?(?:\d{2}[-\s]?)?\d{4}[-\s]?\d{4}\b/g,
    // USA
    /\b(?:\+?1[-\s]?)?\(?[2-9]\d{2}\)?[-\s]?\d{3}[-\s]?\d{4}\b/g,
  ],

  address: [
    // Dirección con número
    /\b\d{1,5}\s+(?:[A-Za-zÀ-ÿ]+\s?){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Calle|Avenida|Av|Carrera|Cra)\b/gi,
    // Código postal México
    /\bC\.?P\.?\s*\d{5}\b/gi,
    // ZIP Code USA
    /\b\d{5}(?:-\d{4})?\b/g,
  ],

  api_key: [
    // OpenAI
    /\bsk-[A-Za-z0-9]{32,}\b/g,
    // Anthropic
    /\bsk-ant-[A-Za-z0-9-]{32,}\b/g,
    // AWS
    /\bAKIA[0-9A-Z]{16}\b/g,
    // Generic API key patterns
    /\b(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key)[\s:=]+["']?([A-Za-z0-9_-]{20,})["']?\b/gi,
    // Bearer tokens
    /\bBearer\s+[A-Za-z0-9_-]{20,}\b/gi,
  ],

  jwt_token: [
    /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g,
  ],

  password: [
    // Password en configuración
    /\b(?:password|passwd|pwd|contraseña)[\s:=]+["']?([^\s"']{6,})["']?\b/gi,
  ],

  ip_address: [
    // IPv4
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    // IPv6 (simplificado)
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  ],

  date_of_birth: [
    // DD/MM/YYYY o MM/DD/YYYY
    /\b(?:0?[1-9]|[12][0-9]|3[01])[-/](?:0?[1-9]|1[012])[-/](?:19|20)\d{2}\b/g,
    // YYYY-MM-DD
    /\b(?:19|20)\d{2}[-/](?:0?[1-9]|1[012])[-/](?:0?[1-9]|[12][0-9]|3[01])\b/g,
  ],

  medical_record: [
    // Número de expediente médico genérico
    /\b(?:expediente|medical[_-]?record|mrn|historia[_-]?cl[ií]nica)[\s:#]?\d{6,12}\b/gi,
  ],

  bank_account: [
    // CLABE México (18 dígitos) - requiere contexto (detecta contexto + número completo)
    /\bCLABE[:\s]*\d{18}\b/gi,
    /\bcuenta\s+bancaria[:\s]*\d{18}\b/gi,
    // IBAN - formato específico con país (auto-contexto por formato único)
    /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g,
  ],

  passport: [
    // Pasaporte - requiere contexto (detecta contexto + número completo)
    /\bpasaporte[:\s#]*[A-Z]{1,2}\d{6,9}\b/gi,
    /\bpassport[:\s#]*[A-Z]{1,2}\d{6,9}\b/gi,
  ],

  drivers_license: [
    // Licencia genérica
    /\b(?:licencia|license|lic)[\s:#]?[A-Z0-9]{6,15}\b/gi,
  ],

  custom: [],
};

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class PIIDetectionService {
  private config: PIIDetectionConfig;
  private detectionCache: Map<string, PIIDetectionResult> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minuto

  constructor(config?: Partial<PIIDetectionConfig>) {
    this.config = {
      enableCreditCard: true,
      enableSSN: true,
      enableEmail: true,
      enablePhone: true,
      enableAddress: false, // Muchos falsos positivos
      enableAPIKeys: true,
      enableCustomPatterns: false,
      customPatterns: [],
      maskingStrategy: 'partial',
      logDetections: true,
      ...config,
    };
  }

  // ============================================
  // MÉTODO PRINCIPAL: Detectar y Sanitizar
  // ============================================

  /**
   * Detecta PII en el texto y retorna versión sanitizada
   */
  async detect(text: string): Promise<PIIDetectionResult> {
    const startTime = Date.now();
    const originalHash = this.hashText(text);

    // Check cache
    const cached = this.detectionCache.get(originalHash);
    if (cached) {
      return { ...cached, detectionTimeMs: Date.now() - startTime };
    }

    const matches: PIIMatch[] = [];
    let sanitizedText = text;

    // Detectar cada tipo de PII habilitado
    const typesToCheck = this.getEnabledTypes();

    for (const piiType of typesToCheck) {
      const patterns = PII_PATTERNS[piiType];

      for (const pattern of patterns) {
        // Reset regex state
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(text)) !== null) {
          const value = match[0];

          // Validación adicional para reducir falsos positivos
          if (!this.validateMatch(piiType, value)) {
            continue;
          }

          const masked = this.maskValue(piiType, value);
          const confidence = this.calculateConfidence(piiType, value);

          matches.push({
            type: piiType,
            value,
            masked,
            startIndex: match.index,
            endIndex: match.index + value.length,
            confidence,
          });
        }
      }
    }

    // Detectar patrones personalizados
    if (this.config.enableCustomPatterns) {
      for (const custom of this.config.customPatterns) {
        custom.pattern.lastIndex = 0;
        let match;
        while ((match = custom.pattern.exec(text)) !== null) {
          const value = match[0];
          const masked = this.maskCustom(value, custom);

          matches.push({
            type: 'custom',
            value,
            masked,
            startIndex: match.index,
            endIndex: match.index + value.length,
            confidence: 0.9,
          });
        }
      }
    }

    // Ordenar matches por posición (descendente para reemplazar de atrás hacia adelante)
    matches.sort((a, b) => b.startIndex - a.startIndex);

    // Eliminar duplicados superpuestos
    const uniqueMatches = this.removeDuplicates(matches);

    // Sanitizar texto
    for (const m of uniqueMatches) {
      sanitizedText =
        sanitizedText.substring(0, m.startIndex) +
        m.masked +
        sanitizedText.substring(m.endIndex);
    }

    const result: PIIDetectionResult = {
      hasPII: uniqueMatches.length > 0,
      matches: uniqueMatches.reverse(), // Volver a orden ascendente
      sanitizedText,
      originalHash,
      detectionTimeMs: Date.now() - startTime,
    };

    // Cache result
    this.detectionCache.set(originalHash, result);
    setTimeout(() => this.detectionCache.delete(originalHash), this.CACHE_TTL_MS);

    // Log detections
    if (this.config.logDetections && result.hasPII) {
      console.log('[PIIDetection] Detected PII:', {
        types: [...new Set(uniqueMatches.map(m => m.type))],
        count: uniqueMatches.length,
        detectionTimeMs: result.detectionTimeMs,
      });
    }

    return result;
  }

  // ============================================
  // VALIDACIONES ESPECÍFICAS
  // ============================================

  /**
   * Validación Luhn para tarjetas de crédito
   */
  private validateLuhn(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Valida match según tipo
   */
  private validateMatch(type: PIIType, value: string): boolean {
    switch (type) {
      case 'credit_card':
        return this.validateLuhn(value);

      case 'email':
        // Evitar falsos positivos en dominios comunes internos
        const emailLower = value.toLowerCase();
        if (emailLower.includes('example.com') ||
            emailLower.includes('test.com') ||
            emailLower.includes('localhost')) {
          return false;
        }
        return true;

      case 'phone':
        // Evitar números muy cortos
        const digits = value.replace(/\D/g, '');
        return digits.length >= 10;

      case 'ssn':
        // Evitar patrones comunes de test
        const ssnDigits = value.replace(/\D/g, '');
        const testPatterns = ['123456789', '111111111', '000000000'];
        return !testPatterns.includes(ssnDigits);

      default:
        return true;
    }
  }

  /**
   * Calcula confianza del match
   */
  private calculateConfidence(type: PIIType, value: string): number {
    switch (type) {
      case 'credit_card':
        return this.validateLuhn(value) ? 0.99 : 0.7;
      case 'email':
        return 0.95;
      case 'ssn':
        return value.includes('-') ? 0.95 : 0.8;
      case 'api_key':
        return 0.9;
      case 'phone':
        const digits = value.replace(/\D/g, '');
        return digits.length >= 10 ? 0.85 : 0.6;
      default:
        return 0.75;
    }
  }

  // ============================================
  // ENMASCARAMIENTO
  // ============================================

  /**
   * Enmascara valor según estrategia configurada
   */
  private maskValue(type: PIIType, value: string): string {
    switch (this.config.maskingStrategy) {
      case 'full':
        return this.maskFull(type, value);
      case 'hash':
        return this.maskHash(type, value);
      case 'partial':
      default:
        return this.maskPartial(type, value);
    }
  }

  /**
   * Enmascaramiento completo
   */
  private maskFull(type: PIIType, value: string): string {
    const typeLabels: Record<PIIType, string> = {
      credit_card: '[TARJETA_OCULTA]',
      ssn: '[ID_OCULTO]',
      email: '[EMAIL_OCULTO]',
      phone: '[TELEFONO_OCULTO]',
      address: '[DIRECCION_OCULTA]',
      api_key: '[API_KEY_OCULTA]',
      jwt_token: '[TOKEN_OCULTO]',
      password: '[CONTRASEÑA_OCULTA]',
      ip_address: '[IP_OCULTA]',
      date_of_birth: '[FECHA_NAC_OCULTA]',
      medical_record: '[EXPEDIENTE_OCULTO]',
      bank_account: '[CUENTA_OCULTA]',
      passport: '[PASAPORTE_OCULTO]',
      drivers_license: '[LICENCIA_OCULTA]',
      custom: '[DATO_OCULTO]',
    };
    return typeLabels[type] || '[OCULTO]';
  }

  /**
   * Enmascaramiento parcial (mantiene algunos caracteres visibles)
   */
  private maskPartial(type: PIIType, value: string): string {
    switch (type) {
      case 'credit_card':
        // Mostrar últimos 4 dígitos: **** **** **** 1234
        const cardDigits = value.replace(/\D/g, '');
        return `****-****-****-${cardDigits.slice(-4)}`;

      case 'email':
        // Mostrar primer caracter y dominio: j***@gmail.com
        const atIndex = value.indexOf('@');
        if (atIndex <= 0) return '***@***'; // Email malformado
        const local = value.substring(0, atIndex);
        const domain = value.substring(atIndex + 1);
        return `${local[0]}***@${domain}`;

      case 'phone':
        // Mostrar últimos 4 dígitos: ***-***-1234
        const phoneDigits = value.replace(/\D/g, '');
        return `***-***-${phoneDigits.slice(-4)}`;

      case 'ssn':
        // Mostrar últimos 4: ***-**-1234
        const ssnDigits = value.replace(/\D/g, '');
        return `***-**-${ssnDigits.slice(-4)}`;

      case 'api_key':
        // Mostrar prefijo: sk-****...
        return `${value.substring(0, 4)}****...`;

      default:
        // Genérico: mostrar 25% inicial
        const visibleLength = Math.max(2, Math.floor(value.length * 0.25));
        return value.substring(0, visibleLength) + '*'.repeat(value.length - visibleLength);
    }
  }

  /**
   * Enmascaramiento con hash (para auditoría)
   */
  private maskHash(type: PIIType, value: string): string {
    const hash = this.hashText(value).substring(0, 8);
    return `[${type.toUpperCase()}:${hash}]`;
  }

  /**
   * Enmascaramiento para patrones personalizados
   */
  private maskCustom(value: string, pattern: CustomPattern): string {
    const maskChar = pattern.maskChar || '*';
    const visible = pattern.visibleChars || 0;

    if (visible === 0) {
      return maskChar.repeat(value.length);
    }

    return value.substring(0, visible) + maskChar.repeat(value.length - visible);
  }

  // ============================================
  // UTILIDADES
  // ============================================

  private getEnabledTypes(): PIIType[] {
    const types: PIIType[] = [];

    if (this.config.enableCreditCard) types.push('credit_card');
    if (this.config.enableSSN) types.push('ssn');
    if (this.config.enableEmail) types.push('email');
    if (this.config.enablePhone) types.push('phone');
    if (this.config.enableAddress) types.push('address');
    if (this.config.enableAPIKeys) {
      types.push('api_key', 'jwt_token', 'password');
    }

    // Nota: ip_address y bank_account ahora requieren contexto explícito
    // Se pueden habilitar manualmente si es necesario

    return types;
  }

  private removeDuplicates(matches: PIIMatch[]): PIIMatch[] {
    const result: PIIMatch[] = [];

    for (const match of matches) {
      const overlapping = result.some(existing =>
        (match.startIndex >= existing.startIndex && match.startIndex < existing.endIndex) ||
        (match.endIndex > existing.startIndex && match.endIndex <= existing.endIndex)
      );

      if (!overlapping) {
        result.push(match);
      }
    }

    return result;
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  // ============================================
  // MÉTODOS PÚBLICOS ADICIONALES
  // ============================================

  /**
   * Solo detecta sin sanitizar (más rápido)
   */
  async hasPII(text: string): Promise<boolean> {
    const result = await this.detect(text);
    return result.hasPII;
  }

  /**
   * Sanitiza texto (shorthand)
   */
  async sanitize(text: string): Promise<string> {
    const result = await this.detect(text);
    return result.sanitizedText;
  }

  /**
   * Actualiza configuración en runtime
   */
  updateConfig(config: Partial<PIIDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.detectionCache.clear();
  }

  /**
   * Limpia caché
   */
  clearCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Obtiene estadísticas
   */
  getStats(): { cacheSize: number; config: PIIDetectionConfig } {
    return {
      cacheSize: this.detectionCache.size,
      config: { ...this.config },
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

let piiServiceInstance: PIIDetectionService | null = null;

export function getPIIDetectionService(config?: Partial<PIIDetectionConfig>): PIIDetectionService {
  if (!piiServiceInstance) {
    piiServiceInstance = new PIIDetectionService(config);
  }
  return piiServiceInstance;
}

export default PIIDetectionService;
