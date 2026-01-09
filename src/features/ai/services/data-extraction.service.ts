// =====================================================
// TIS TIS PLATFORM - Data Extraction Service
// Extracts structured data from conversation messages
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================

export interface ExtractedLeadData {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  gender?: 'male' | 'female' | 'other';
  notes?: string;
}

export interface ExtractedServiceInterest {
  service_name: string;
  service_id?: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  specific_concerns?: string[];
}

export interface ExtractedPreferences {
  preferred_branch?: string;
  preferred_doctor?: string;
  preferred_day?: string[];
  preferred_time?: 'morning' | 'afternoon' | 'evening' | 'any';
  language?: string;
}

export interface ExtractionResult {
  lead_data: ExtractedLeadData;
  service_interest?: ExtractedServiceInterest;
  preferences: ExtractedPreferences;
  should_update_lead: boolean;
  fields_to_update: string[];
}

// ======================
// EXTRACTION PATTERNS
// ======================

const NAME_PATTERNS = [
  /(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,3})/i,
  /(?:soy el|soy la)\s+(?:dr\.?|dra\.?|lic\.?|ing\.?)?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,3})/i,
  /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})$/m,
];

const EMAIL_PATTERN = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i;

const PHONE_PATTERNS = [
  /\b(\d{10})\b/,
  /\b(\d{2}[\s-]?\d{4}[\s-]?\d{4})\b/,
  /\b(\d{3}[\s-]?\d{3}[\s-]?\d{4})\b/,
  /\+?52\s*1?\s*(\d{10})/,
];

const DATE_OF_BIRTH_PATTERNS = [
  /(?:nací el|mi cumpleaños es|fecha de nacimiento[:\s]+)\s*(\d{1,2})[\/\-\s](?:de\s+)?(\w+|\d{1,2})[\/\-\s](?:de\s+)?(\d{2,4})/i,
  /(?:tengo|cumplo)\s+(\d{1,3})\s+años/i,
];

const GENDER_PATTERNS: Array<{ pattern: RegExp; gender: 'male' | 'female' }> = [
  { pattern: /\b(?:soy hombre|soy masculino|sexo masculino)\b/i, gender: 'male' },
  { pattern: /\b(?:soy mujer|soy femenina|sexo femenino)\b/i, gender: 'female' },
];

// ======================
// MAIN EXTRACTION FUNCTION
// ======================

/**
 * Extrae datos estructurados de un mensaje de conversación
 */
export function extractDataFromMessage(message: string): ExtractedLeadData {
  const data: ExtractedLeadData = {};

  // Extraer nombre
  for (const pattern of NAME_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const fullName = match[1].trim();
      data.name = fullName;

      // Intentar separar nombre y apellido
      const parts = fullName.split(/\s+/);
      if (parts.length >= 2) {
        data.first_name = parts[0];
        data.last_name = parts.slice(1).join(' ');
      } else {
        data.first_name = parts[0];
      }
      break;
    }
  }

  // Extraer email
  const emailMatch = message.match(EMAIL_PATTERN);
  if (emailMatch) {
    data.email = emailMatch[1].toLowerCase();
  }

  // Extraer teléfono (adicional al de WhatsApp)
  for (const pattern of PHONE_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const phone = match[1].replace(/[\s-]/g, '');
      // Solo guardar si parece diferente al formato de WhatsApp ya capturado
      if (phone.length === 10) {
        data.phone = phone;
      }
      break;
    }
  }

  // Extraer fecha de nacimiento
  for (const pattern of DATE_OF_BIRTH_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      if (match[3]) {
        // Formato completo de fecha
        const day = match[1].padStart(2, '0');
        let month = match[2];
        let year = match[3];

        // Convertir nombre de mes a número
        const monthNames: Record<string, string> = {
          'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
          'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
          'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
        };

        if (monthNames[month.toLowerCase()]) {
          month = monthNames[month.toLowerCase()];
        } else {
          month = month.padStart(2, '0');
        }

        // Ajustar año de 2 dígitos
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum > 30 ? `19${year}` : `20${year}`;
        }

        data.date_of_birth = `${year}-${month}-${day}`;
      } else if (match[1]) {
        // "Tengo X años" - calcular fecha aproximada
        const age = parseInt(match[1]);
        if (age > 0 && age < 150) {
          const birthYear = new Date().getFullYear() - age;
          data.date_of_birth = `${birthYear}-01-01`; // Fecha aproximada
        }
      }
      break;
    }
  }

  // Extraer género
  for (const { pattern, gender } of GENDER_PATTERNS) {
    if (pattern.test(message)) {
      data.gender = gender;
      break;
    }
  }

  return data;
}

/**
 * Extrae interés en servicios del mensaje
 */
export function extractServiceInterest(
  message: string,
  availableServices: Array<{ id: string; name: string; category: string }>
): ExtractedServiceInterest | undefined {
  const messageLower = message.toLowerCase();

  // Detectar urgencia
  let urgency: ExtractedServiceInterest['urgency'] = 'low';
  if (/urgente|emergencia|ahora mismo|hoy/i.test(messageLower)) {
    urgency = 'urgent';
  } else if (/dolor|molest|duele|lastim/i.test(messageLower)) {
    urgency = 'high';
  } else if (/lo antes posible|pronto|esta semana/i.test(messageLower)) {
    urgency = 'medium';
  }

  // Buscar servicio mencionado
  for (const service of availableServices) {
    const serviceWords = service.name.toLowerCase().split(/\s+/);
    const matches = serviceWords.filter(word =>
      word.length > 3 && messageLower.includes(word)
    );

    if (matches.length >= Math.ceil(serviceWords.length / 2)) {
      // Extraer preocupaciones específicas
      const concerns: string[] = [];
      if (/dolor/i.test(messageLower)) concerns.push('dolor');
      if (/sangr/i.test(messageLower)) concerns.push('sangrado');
      if (/hincha/i.test(messageLower)) concerns.push('hinchazón');
      if (/infec/i.test(messageLower)) concerns.push('posible infección');
      if (/sensibil/i.test(messageLower)) concerns.push('sensibilidad');
      if (/estetic/i.test(messageLower)) concerns.push('estética');

      return {
        service_name: service.name,
        service_id: service.id,
        urgency,
        specific_concerns: concerns.length > 0 ? concerns : undefined,
      };
    }
  }

  // Servicios genéricos por keywords
  const genericServices: Record<string, string> = {
    'limpieza|limpiar|sarro|profilaxis': 'Limpieza Dental',
    'blanque|aclarar|blancos': 'Blanqueamiento',
    'implant': 'Implante Dental',
    'ortodoncia|brackets|frenos|alinear': 'Ortodoncia',
    'corona|funda': 'Corona Dental',
    'carilla|veneer': 'Carillas',
    'extracc|sacar|quitar.*muela|muelas? del juicio': 'Extracción',
    'endodoncia|conducto|nervio': 'Endodoncia',
    'resina|empaste|caries': 'Resinas/Empastes',
    'consulta|revision|cheque|valoracion': 'Consulta/Valoración',
  };

  for (const [pattern, serviceName] of Object.entries(genericServices)) {
    if (new RegExp(pattern, 'i').test(messageLower)) {
      // Buscar el servicio correspondiente en la lista
      const matchedService = availableServices.find(s =>
        s.name.toLowerCase().includes(serviceName.toLowerCase().split('/')[0])
      );

      return {
        service_name: serviceName,
        service_id: matchedService?.id,
        urgency,
      };
    }
  }

  return undefined;
}

/**
 * Extrae preferencias de cita del mensaje
 */
export function extractPreferences(message: string): ExtractedPreferences {
  const prefs: ExtractedPreferences = {};
  const messageLower = message.toLowerCase();

  // Preferencia de horario
  if (/mañana|temprano|antes.*12|antes del mediodía/i.test(messageLower)) {
    prefs.preferred_time = 'morning';
  } else if (/tarde|después.*12|después del mediodía|vespertino/i.test(messageLower)) {
    prefs.preferred_time = 'afternoon';
  } else if (/noche|después.*6|después de las 6/i.test(messageLower)) {
    prefs.preferred_time = 'evening';
  } else if (/cualquier|cuando sea|no importa/i.test(messageLower)) {
    prefs.preferred_time = 'any';
  }

  // Preferencia de día
  const days: string[] = [];
  const dayPatterns: Record<string, string> = {
    'lunes': 'monday',
    'martes': 'tuesday',
    'miércoles|miercoles': 'wednesday',
    'jueves': 'thursday',
    'viernes': 'friday',
    'sábado|sabado': 'saturday',
    'domingo': 'sunday',
    'entre semana|días hábiles': 'weekdays',
    'fin de semana': 'weekend',
  };

  for (const [pattern, day] of Object.entries(dayPatterns)) {
    if (new RegExp(pattern, 'i').test(messageLower)) {
      days.push(day);
    }
  }

  if (days.length > 0) {
    prefs.preferred_day = days;
  }

  return prefs;
}

// ======================
// UPDATE LEAD DATA
// ======================

/**
 * Actualiza los datos del lead con la información extraída
 */
export async function updateLeadWithExtractedData(
  leadId: string,
  extractedData: ExtractedLeadData
): Promise<{ success: boolean; fieldsUpdated: string[] }> {
  const supabase = createServerClient();
  const fieldsUpdated: string[] = [];

  // Solo actualizar campos que tienen valor y que el lead actual no tiene
  const { data: currentLead, error: fetchError } = await supabase
    .from('leads')
    .select('first_name, last_name, full_name, email, phone, metadata')
    .eq('id', leadId)
    .single();

  if (fetchError || !currentLead) {
    return { success: false, fieldsUpdated: [] };
  }

  const updates: Record<string, unknown> = {};
  const metadataUpdates: Record<string, unknown> = {};

  // Nombre - solo si actual es genérico
  // Build current name from available fields
  const currentName = currentLead.full_name || `${currentLead.first_name || ''} ${currentLead.last_name || ''}`.trim();
  const isGenericName = !currentName || currentName === 'Desconocido' || currentName === 'Cliente';

  if (extractedData.name && isGenericName) {
    // Parse extracted name into first_name and last_name
    const nameParts = extractedData.name.trim().split(' ');
    updates.first_name = nameParts[0];
    updates.last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
    updates.full_name = extractedData.name.trim();
    fieldsUpdated.push('name');
  }

  // Email - solo si no tiene
  if (extractedData.email && !currentLead.email) {
    updates.email = extractedData.email;
    fieldsUpdated.push('email');
  }

  // Fecha de nacimiento - guardar en metadata
  if (extractedData.date_of_birth) {
    metadataUpdates.date_of_birth = extractedData.date_of_birth;
    fieldsUpdated.push('date_of_birth');
  }

  // Género - guardar en metadata
  if (extractedData.gender) {
    metadataUpdates.gender = extractedData.gender;
    fieldsUpdated.push('gender');
  }

  // Dirección - guardar en metadata
  if (extractedData.address) {
    metadataUpdates.address = extractedData.address;
    fieldsUpdated.push('address');
  }

  // Actualizar metadata si hay cambios
  if (Object.keys(metadataUpdates).length > 0) {
    updates.metadata = {
      ...(currentLead.metadata || {}),
      ...metadataUpdates,
    };
  }

  // Ejecutar actualización si hay cambios
  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId);

    if (updateError) {
      console.error('[Data Extraction] Error updating lead:', updateError);
      return { success: false, fieldsUpdated: [] };
    }
  }

  return { success: true, fieldsUpdated };
}

/**
 * Registra interés en un servicio para el lead
 */
export async function recordServiceInterest(
  leadId: string,
  conversationId: string,
  interest: ExtractedServiceInterest
): Promise<void> {
  const supabase = createServerClient();

  // Actualizar lead con servicio de interés
  await supabase
    .from('leads')
    .update({
      interested_service_id: interest.service_id || null,
      metadata: {
        interested_service_name: interest.service_name,
        urgency: interest.urgency,
        specific_concerns: interest.specific_concerns,
      },
    })
    .eq('id', leadId);

  // Registrar evento en la conversación
  await supabase
    .from('conversation_events')
    .insert({
      conversation_id: conversationId,
      event_type: 'service_interest',
      event_data: interest,
    });
}

// ======================
// FULL EXTRACTION
// ======================

/**
 * Realiza extracción completa de un mensaje
 */
export function performFullExtraction(
  message: string,
  availableServices: Array<{ id: string; name: string; category: string }>
): ExtractionResult {
  const leadData = extractDataFromMessage(message);
  const serviceInterest = extractServiceInterest(message, availableServices);
  const preferences = extractPreferences(message);

  const fieldsToUpdate: string[] = [];
  if (leadData.name) fieldsToUpdate.push('name');
  if (leadData.email) fieldsToUpdate.push('email');
  if (leadData.date_of_birth) fieldsToUpdate.push('date_of_birth');
  if (leadData.gender) fieldsToUpdate.push('gender');

  return {
    lead_data: leadData,
    service_interest: serviceInterest,
    preferences,
    should_update_lead: fieldsToUpdate.length > 0,
    fields_to_update: fieldsToUpdate,
  };
}

// ======================
// EXPORTS
// ======================

export const DataExtractionService = {
  extractDataFromMessage,
  extractServiceInterest,
  extractPreferences,
  updateLeadWithExtractedData,
  recordServiceInterest,
  performFullExtraction,
};
