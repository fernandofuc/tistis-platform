// =====================================================
// TIS TIS PLATFORM - RFC Validator
// Validates Mexican RFC (Registro Federal de Contribuyentes)
// =====================================================

import type { RFCValidationResult } from '../types';
import { RFC_GENERICO_NACIONAL, RFC_GENERICO_EXTRANJERO } from '../types';

// Valid characters for RFC
const RFC_PATTERN_MORAL = /^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{3}$/;
const RFC_PATTERN_FISICA = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;

// Invalid words (SAT blacklist)
const PALABRAS_INCONVENIENTES = [
  'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO', 'COGE', 'COGI',
  'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO', 'GETA', 'GUEI',
  'GUEY', 'JETA', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KAKA', 'KAKO', 'KOGE',
  'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 'LILO', 'LOCA', 'LOCO',
  'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR', 'MION', 'MOCO',
  'MOKO', 'MULA', 'MULO', 'NACA', 'NACO', 'PEDA', 'PEDO', 'PENE', 'PIPI', 'PITO',
  'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 'ROBO', 'RUIN', 'SENO',
  'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY',
];

/**
 * Validate a Mexican RFC
 * @param rfc - The RFC to validate
 * @returns Validation result with type and errors
 */
export function validateRFC(rfc: string): RFCValidationResult {
  const errors: string[] = [];

  // Normalize RFC
  const normalizedRFC = rfc.toUpperCase().trim().replace(/\s/g, '');

  // Check for generic RFCs
  if (normalizedRFC === RFC_GENERICO_NACIONAL) {
    return {
      valid: true,
      type: 'generic',
      formatted_rfc: RFC_GENERICO_NACIONAL,
    };
  }

  if (normalizedRFC === RFC_GENERICO_EXTRANJERO) {
    return {
      valid: true,
      type: 'generic',
      formatted_rfc: RFC_GENERICO_EXTRANJERO,
    };
  }

  // Check length
  if (normalizedRFC.length !== 12 && normalizedRFC.length !== 13) {
    errors.push('El RFC debe tener 12 caracteres (persona moral) o 13 caracteres (persona física)');
    return {
      valid: false,
      type: 'invalid',
      errors,
    };
  }

  // Determine type and validate pattern
  const isPersonaFisica = normalizedRFC.length === 13;
  const pattern = isPersonaFisica ? RFC_PATTERN_FISICA : RFC_PATTERN_MORAL;

  if (!pattern.test(normalizedRFC)) {
    errors.push('El formato del RFC no es válido');
    return {
      valid: false,
      type: 'invalid',
      errors,
    };
  }

  // Check for inconvenient words
  const firstLetters = normalizedRFC.substring(0, 4);
  if (PALABRAS_INCONVENIENTES.includes(firstLetters)) {
    errors.push('El RFC contiene una combinación de letras no permitida');
    return {
      valid: false,
      type: 'invalid',
      errors,
    };
  }

  // Validate date portion
  const dateStart = isPersonaFisica ? 4 : 3;
  const year = parseInt(normalizedRFC.substring(dateStart, dateStart + 2));
  const month = parseInt(normalizedRFC.substring(dateStart + 2, dateStart + 4));
  const day = parseInt(normalizedRFC.substring(dateStart + 4, dateStart + 6));

  if (month < 1 || month > 12) {
    errors.push('El mes en el RFC no es válido');
    return {
      valid: false,
      type: 'invalid',
      errors,
    };
  }

  if (day < 1 || day > 31) {
    errors.push('El día en el RFC no es válido');
    return {
      valid: false,
      type: 'invalid',
      errors,
    };
  }

  // Validate check digit (homoclave)
  const isValidCheckDigit = validateCheckDigit(normalizedRFC);
  if (!isValidCheckDigit) {
    // This is a warning, not an error - the SAT doesn't always follow this rule
    // errors.push('El dígito verificador podría ser incorrecto');
  }

  return {
    valid: true,
    type: isPersonaFisica ? 'persona_fisica' : 'persona_moral',
    formatted_rfc: normalizedRFC,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate the RFC check digit (homoclave)
 * Based on SAT algorithm
 */
function validateCheckDigit(rfc: string): boolean {
  // Character values for check digit calculation
  const charValues: Record<string, number> = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17,
    'I': 18, 'J': 19, 'K': 20, 'L': 21, 'M': 22, 'N': 23, 'O': 25, 'P': 26,
    'Q': 27, 'R': 28, 'S': 29, 'T': 30, 'U': 31, 'V': 32, 'W': 33, 'X': 34,
    'Y': 35, 'Z': 36, '&': 24, 'Ñ': 38, ' ': 37,
  };

  const expectedCheckDigit = rfc.charAt(rfc.length - 1);

  // Calculate check digit
  const rfcWithoutCheck = rfc.substring(0, rfc.length - 1);
  let sum = 0;
  let multiplier = rfcWithoutCheck.length + 1;

  for (let i = 0; i < rfcWithoutCheck.length; i++) {
    const char = rfcWithoutCheck.charAt(i);
    const value = charValues[char];
    if (value === undefined) return false;
    sum += value * multiplier;
    multiplier--;
  }

  const remainder = sum % 11;
  let calculatedDigit: string;

  if (remainder === 0) {
    calculatedDigit = '0';
  } else {
    const digit = 11 - remainder;
    calculatedDigit = digit === 10 ? 'A' : digit.toString();
  }

  return calculatedDigit === expectedCheckDigit;
}

/**
 * Format RFC with proper spacing for display
 */
export function formatRFC(rfc: string): string {
  const normalized = rfc.toUpperCase().trim().replace(/\s/g, '');

  if (normalized.length === 12) {
    // Persona moral: AAA-000000-XXX
    return `${normalized.substring(0, 3)}-${normalized.substring(3, 9)}-${normalized.substring(9)}`;
  } else if (normalized.length === 13) {
    // Persona física: AAAA-000000-XXX
    return `${normalized.substring(0, 4)}-${normalized.substring(4, 10)}-${normalized.substring(10)}`;
  }

  return normalized;
}

/**
 * Get RFC type description
 */
export function getRFCTypeDescription(result: RFCValidationResult): string {
  switch (result.type) {
    case 'persona_fisica':
      return 'Persona Física';
    case 'persona_moral':
      return 'Persona Moral';
    case 'generic':
      return 'Público en General';
    default:
      return 'Inválido';
  }
}

/**
 * Common regimen fiscal options for display
 */
export const REGIMEN_FISCAL_OPTIONS = [
  { value: '601', label: 'General de Ley Personas Morales' },
  { value: '603', label: 'Personas Morales con Fines no Lucrativos' },
  { value: '605', label: 'Sueldos y Salarios' },
  { value: '606', label: 'Arrendamiento' },
  { value: '612', label: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { value: '616', label: 'Sin obligaciones fiscales' },
  { value: '621', label: 'Incorporación Fiscal' },
  { value: '625', label: 'Actividades Empresariales con Plataformas Tecnológicas' },
  { value: '626', label: 'Régimen Simplificado de Confianza (RESICO)' },
];

/**
 * Common uso CFDI options for display
 */
export const USO_CFDI_OPTIONS = [
  { value: 'G01', label: 'Adquisición de mercancías' },
  { value: 'G02', label: 'Devoluciones, descuentos o bonificaciones' },
  { value: 'G03', label: 'Gastos en general' },
  { value: 'D01', label: 'Honorarios médicos' },
  { value: 'D02', label: 'Gastos médicos' },
  { value: 'D04', label: 'Donativos' },
  { value: 'D08', label: 'Gastos de transportación escolar' },
  { value: 'D10', label: 'Pagos por servicios educativos' },
  { value: 'P01', label: 'Por definir' },
  { value: 'S01', label: 'Sin efectos fiscales' },
];

/**
 * Forma de pago options for display
 */
export const FORMA_PAGO_OPTIONS = [
  { value: '01', label: 'Efectivo' },
  { value: '02', label: 'Cheque nominativo' },
  { value: '03', label: 'Transferencia electrónica' },
  { value: '04', label: 'Tarjeta de crédito' },
  { value: '28', label: 'Tarjeta de débito' },
  { value: '99', label: 'Por definir' },
];
