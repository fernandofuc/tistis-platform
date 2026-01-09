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
      first_name,
      last_name,
      full_name,
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
  // Check full_name or first_name/last_name combination
  const leadName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
  const hasValidName = leadName &&
    leadName !== 'Desconocido' &&
    leadName !== 'Cliente' &&
    leadName.trim().length > 2;

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
 * @param leadId - ID del lead a convertir
 * @param tenantId - ID del tenant (REQUIRED for security)
 * @param additionalData - Datos adicionales para el paciente
 */
export async function convertLeadToPatient(
  leadId: string,
  tenantId?: string,  // Optional for backwards compatibility, but should be provided
  additionalData?: Partial<PatientData>
): Promise<ConversionResult> {
  const supabase = createServerClient();

  try {
    // 1. Obtener datos del lead
    // SECURITY: If tenantId provided, validate lead belongs to tenant
    let query = supabase
      .from('leads')
      .select('*')
      .eq('id', leadId);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: lead, error: leadError } = await query.single();

    if (leadError || !lead) {
      return { success: false, error: 'Lead no encontrado o no accesible' };
    }

    // SECURITY: If tenantId was provided and doesn't match, reject
    if (tenantId && lead.tenant_id !== tenantId) {
      console.warn(`[Lead Conversion] Tenant mismatch for lead ${leadId}. Expected ${tenantId}, got ${lead.tenant_id}`);
      return { success: false, error: 'Lead no accesible' };
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
    // Use first_name/last_name directly if available, otherwise parse full_name
    let firstName = lead.first_name || '';
    let lastName = lead.last_name || '';

    // Fallback: parse full_name if first_name is empty
    if (!firstName && lead.full_name) {
      const nameParts = lead.full_name.split(' ');
      firstName = nameParts[0] || 'Cliente';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Final fallback
    if (!firstName) {
      firstName = 'Cliente';
    }

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

    // 6. Crear paciente usando función RPC segura (previene race conditions)
    const { data: createResult, error: rpcError } = await supabase.rpc('create_patient_safe', {
      p_tenant_id: lead.tenant_id,
      p_first_name: patientData.first_name,
      p_last_name: patientData.last_name,
      p_phone: patientData.phone,
      p_email: patientData.email,
      p_lead_id: leadId,
      p_branch_id: patientData.branch_id,
      p_additional_data: JSON.stringify({
        source: patientData.source,
        date_of_birth: patientData.date_of_birth,
        gender: patientData.gender,
        address: patientData.address,
        city: patientData.city,
      })
    });

    // Handle RPC result
    const rpcResult = Array.isArray(createResult) ? createResult[0] : createResult;

    if (rpcError || !rpcResult?.success) {
      console.error('[Lead Conversion] Error creating patient:', rpcError || rpcResult?.error_message);
      return { success: false, error: rpcResult?.error_message || rpcError?.message || 'Error creando paciente' };
    }

    const newPatientId = rpcResult.patient_id;
    const alreadyExists = rpcResult.already_exists;

    if (alreadyExists) {
      console.log(`[Lead Conversion] Patient already exists for lead ${leadId}: ${newPatientId}`);
    }

    // 7. Actualizar lead con referencia al paciente
    await supabase
      .from('leads')
      .update({
        patient_id: newPatientId,
        status: 'converted',
        converted_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // 8. Vincular citas del lead con el nuevo paciente
    await supabase
      .from('appointments')
      .update({ patient_id: newPatientId })
      .eq('lead_id', leadId);

    console.log(`[Lead Conversion] Lead ${leadId} converted to patient ${newPatientId}`);

    return {
      success: true,
      patient_id: newPatientId,
      already_exists: alreadyExists,
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
export async function autoConvertQualifiedLead(
  leadId: string,
  options?: {
    triggeredBy?: string;
    triggeredAppointmentId?: string;
  }
): Promise<ConversionResult | null> {
  const supabase = createServerClient();
  const readiness = await checkConversionReadiness(leadId);

  // Get lead tenant_id for logging
  const { data: leadData } = await supabase
    .from('leads')
    .select('tenant_id')
    .eq('id', leadId)
    .single();

  const tenantId = leadData?.tenant_id;

  // Log the conversion attempt
  const logEntry = {
    lead_id: leadId,
    tenant_id: tenantId,
    conversion_type: 'auto_appointment_completed',
    had_name: readiness.has_name,
    had_phone_or_email: readiness.has_phone_or_email,
    had_appointment: readiness.has_appointment,
    missing_fields: readiness.missing_fields,
    triggered_by: options?.triggeredBy || 'appointment_completed',
    triggered_appointment_id: options?.triggeredAppointmentId || null,
    success: false,
    error_message: null as string | null,
    patient_id: null as string | null,
  };

  // Solo convertir si está listo
  if (!readiness.ready_to_convert) {
    console.log(`[Lead Conversion] Lead ${leadId} not ready. Missing: ${readiness.missing_fields.join(', ')}`);
    logEntry.error_message = `Not ready: missing ${readiness.missing_fields.join(', ')}`;

    // Log to database (ignore errors)
    if (tenantId) {
      await supabase.from('lead_conversion_log').insert(logEntry).select().maybeSingle();
    }

    return null;
  }

  // Si tiene cita, convertir automáticamente
  if (readiness.has_appointment) {
    const result = await convertLeadToPatient(leadId);

    // Update log with result
    logEntry.success = result.success;
    logEntry.patient_id = result.patient_id || null;
    logEntry.error_message = result.error || null;

    if (tenantId) {
      await supabase.from('lead_conversion_log').insert(logEntry).select().maybeSingle();
    }

    return result;
  }

  // Si no tiene cita pero está calificado, solo marcar como listo
  // (la conversión final se hace cuando complete una cita)
  logEntry.error_message = 'No appointment found, skipping conversion';
  if (tenantId) {
    await supabase.from('lead_conversion_log').insert(logEntry).select().maybeSingle();
  }

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
