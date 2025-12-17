// =====================================================
// TIS TIS PLATFORM - Lead Conversion Service
// Converts qualified leads to patients
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================

export interface LeadData {
  id: string;
  tenant_id: string;
  name: string;
  email?: string;
  phone?: string;
  phone_normalized?: string;
  classification?: string;
  status?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  branch_id?: string;
  interested_service_id?: string;
}

export interface PatientData {
  id?: string;
  tenant_id: string;
  branch_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_notes?: string;
  allergies?: string[];
  medications?: string[];
  source?: string;
  lead_id?: string;
}

export interface ConversionResult {
  success: boolean;
  patient_id?: string;
  error?: string;
  already_exists?: boolean;
}

export interface ConversionRequirements {
  has_name: boolean;
  has_phone_or_email: boolean;
  has_appointment: boolean;
  ready_to_convert: boolean;
  missing_fields: string[];
}

// ======================
// CONVERSION CHECK
// ======================

/**
 * Verifica si un lead está listo para ser convertido a paciente
 */
export async function checkConversionReadiness(leadId: string): Promise<ConversionRequirements> {
  const supabase = createServerClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      id,
      name,
      email,
      phone,
      phone_normalized,
      metadata,
      appointments:appointments(id, status)
    `)
    .eq('id', leadId)
    .single();

  if (error || !lead) {
    return {
      has_name: false,
      has_phone_or_email: false,
      has_appointment: false,
      ready_to_convert: false,
      missing_fields: ['lead_not_found'],
    };
  }

  const missing: string[] = [];

  // Verificar nombre (no genérico)
  const hasValidName = lead.name &&
    lead.name !== 'Desconocido' &&
    lead.name !== 'Cliente' &&
    lead.name.trim().length > 2;

  if (!hasValidName) {
    missing.push('name');
  }

  // Verificar contacto
  const hasContact = !!(lead.email || lead.phone || lead.phone_normalized);
  if (!hasContact) {
    missing.push('email_or_phone');
  }

  // Verificar si tiene cita
  const appointments = lead.appointments as any[];
  const hasAppointment = appointments && appointments.some(
    (apt: any) => ['scheduled', 'confirmed', 'completed'].includes(apt.status)
  );

  // Criterios de conversión:
  // - Debe tener nombre válido
  // - Debe tener contacto (email o teléfono)
  // - Idealmente debe tener cita (pero no es obligatorio)
  const readyToConvert = hasValidName && hasContact;

  return {
    has_name: hasValidName,
    has_phone_or_email: hasContact,
    has_appointment: hasAppointment,
    ready_to_convert: readyToConvert,
    missing_fields: missing,
  };
}

// ======================
// LEAD TO PATIENT CONVERSION
// ======================

/**
 * Convierte un lead a paciente
 */
export async function convertLeadToPatient(
  leadId: string,
  additionalData?: Partial<PatientData>
): Promise<ConversionResult> {
  const supabase = createServerClient();

  try {
    // 1. Obtener datos del lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return { success: false, error: 'Lead no encontrado' };
    }

    // 2. Verificar si ya existe como paciente (por teléfono o email)
    // Construir condición OR correctamente para Supabase
    const orConditions: string[] = [];
    if (lead.email) {
      orConditions.push(`email.eq.${lead.email}`);
    }
    if (lead.phone_normalized) {
      orConditions.push(`phone.eq.${lead.phone_normalized}`);
    }

    let existingPatients: { id: string }[] | null = null;

    if (orConditions.length > 0) {
      const { data } = await supabase
        .from('patients')
        .select('id')
        .eq('tenant_id', lead.tenant_id)
        .or(orConditions.join(','))
        .limit(1);

      existingPatients = data;
    }

    if (existingPatients && existingPatients.length > 0) {
      // Ya existe - vincular lead con paciente existente
      await supabase
        .from('leads')
        .update({
          patient_id: existingPatients[0].id,
          status: 'converted',
          converted_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      return {
        success: true,
        patient_id: existingPatients[0].id,
        already_exists: true,
      };
    }

    // 3. Parsear nombre
    const nameParts = (lead.name || 'Cliente').split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 4. Extraer datos adicionales de metadata del lead
    const metadata = lead.metadata || {};

    // 5. Construir datos del paciente
    const patientData: PatientData = {
      tenant_id: lead.tenant_id,
      branch_id: lead.branch_id || additionalData?.branch_id,
      first_name: additionalData?.first_name || firstName,
      last_name: additionalData?.last_name || lastName,
      email: additionalData?.email || lead.email,
      phone: additionalData?.phone || lead.phone_normalized || lead.phone,
      date_of_birth: additionalData?.date_of_birth || metadata.date_of_birth as string,
      gender: additionalData?.gender || metadata.gender as PatientData['gender'],
      address: additionalData?.address || metadata.address as string,
      city: additionalData?.city || metadata.city as string,
      source: lead.source || 'lead_conversion',
      lead_id: leadId,
    };

    // 6. Crear paciente
    const { data: newPatient, error: createError } = await supabase
      .from('patients')
      .insert(patientData)
      .select('id')
      .single();

    if (createError) {
      console.error('[Lead Conversion] Error creating patient:', createError);
      return { success: false, error: createError.message };
    }

    // 7. Actualizar lead con referencia al paciente
    await supabase
      .from('leads')
      .update({
        patient_id: newPatient.id,
        status: 'converted',
        converted_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // 8. Vincular citas del lead con el nuevo paciente
    await supabase
      .from('appointments')
      .update({ patient_id: newPatient.id })
      .eq('lead_id', leadId);

    console.log(`[Lead Conversion] Lead ${leadId} converted to patient ${newPatient.id}`);

    return {
      success: true,
      patient_id: newPatient.id,
      already_exists: false,
    };

  } catch (error) {
    console.error('[Lead Conversion] Unexpected error:', error);
    return { success: false, error: 'Error inesperado en conversión' };
  }
}

// ======================
// AUTO-CONVERSION TRIGGER
// ======================

/**
 * Verifica y convierte automáticamente leads calificados
 * Se ejecuta después de eventos importantes (cita completada, etc.)
 */
export async function autoConvertQualifiedLead(leadId: string): Promise<ConversionResult | null> {
  const readiness = await checkConversionReadiness(leadId);

  // Solo convertir si está listo
  if (!readiness.ready_to_convert) {
    console.log(`[Lead Conversion] Lead ${leadId} not ready. Missing: ${readiness.missing_fields.join(', ')}`);
    return null;
  }

  // Si tiene cita, convertir automáticamente
  if (readiness.has_appointment) {
    return await convertLeadToPatient(leadId);
  }

  // Si no tiene cita pero está calificado, solo marcar como listo
  // (la conversión final se hace cuando complete una cita)
  return null;
}

// ======================
// BATCH CONVERSION
// ======================

/**
 * Convierte múltiples leads calificados a pacientes
 * Útil para migración o limpieza de datos
 */
export async function batchConvertQualifiedLeads(
  tenantId: string,
  options?: {
    onlyWithAppointments?: boolean;
    limit?: number;
  }
): Promise<{ converted: number; skipped: number; errors: string[] }> {
  const supabase = createServerClient();
  const results = { converted: 0, skipped: 0, errors: [] as string[] };

  // Obtener leads calificados sin convertir
  let query = supabase
    .from('leads')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('patient_id', null)
    .neq('name', 'Desconocido')
    .neq('name', 'Cliente')
    .in('classification', ['hot', 'warm']);

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: leads, error } = await query;

  if (error || !leads) {
    return { ...results, errors: ['Error al obtener leads'] };
  }

  for (const lead of leads) {
    const readiness = await checkConversionReadiness(lead.id);

    if (!readiness.ready_to_convert) {
      results.skipped++;
      continue;
    }

    if (options?.onlyWithAppointments && !readiness.has_appointment) {
      results.skipped++;
      continue;
    }

    const conversionResult = await convertLeadToPatient(lead.id);

    if (conversionResult.success) {
      results.converted++;
    } else {
      results.errors.push(`Lead ${lead.id}: ${conversionResult.error}`);
    }
  }

  return results;
}

// ======================
// EXPORTS
// ======================

export const LeadConversionService = {
  checkConversionReadiness,
  convertLeadToPatient,
  autoConvertQualifiedLead,
  batchConvertQualifiedLeads,
};
