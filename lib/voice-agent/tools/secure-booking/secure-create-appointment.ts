/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tool: Secure Create Appointment
 *
 * Enhanced version of create_appointment that integrates
 * trust verification and hold management.
 */

import type {
  ToolDefinition,
  ToolContext,
  SecureCreateAppointmentParams,
  SecureBookingResult,
  TrustAction,
} from '../types';
import {
  formatDateForVoice,
  formatTimeForVoice,
  formatConfirmationCodeForVoice,
} from '../formatters';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `APT-${code}`;
}

// =====================================================
// TOOL DEFINITION
// =====================================================

export const secureCreateAppointment: ToolDefinition<SecureCreateAppointmentParams> = {
  name: 'secure_create_appointment',
  description: 'Crea una cita dental con verificación de confianza del cliente',
  category: 'secure_booking',

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'Fecha de la cita (YYYY-MM-DD)',
      },
      time: {
        type: 'string',
        description: 'Hora de la cita (HH:MM)',
      },
      patientName: {
        type: 'string',
        description: 'Nombre del paciente',
      },
      patientPhone: {
        type: 'string',
        description: 'Teléfono del paciente',
      },
      patientEmail: {
        type: 'string',
        format: 'email',
        description: 'Email del paciente (opcional)',
      },
      serviceType: {
        type: 'string',
        description: 'Tipo de servicio (limpieza, consulta, etc.)',
      },
      doctorId: {
        type: 'string',
        description: 'ID del doctor (opcional)',
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales',
      },
      skipTrustCheck: {
        type: 'boolean',
        description: 'Saltar verificación de confianza (para VIPs)',
        default: false,
      },
      holdId: {
        type: 'string',
        description: 'ID del hold si ya fue creado',
      },
    },
    required: ['date', 'time', 'patientName', 'patientPhone'],
  },

  requiredCapabilities: ['appointments', 'secure_booking'],
  requiresConfirmation: true,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete'],
  timeout: 20000,

  confirmationMessage: (params) => {
    const serviceStr = params.serviceType ? ` para ${params.serviceType}` : '';
    return `Voy a agendar una cita${serviceStr} el ${params.date} a las ${params.time} para ${params.patientName}. ¿Confirma la cita?`;
  },

  handler: async (params, context): Promise<SecureBookingResult> => {
    const {
      date,
      time,
      patientName,
      patientPhone,
      patientEmail,
      serviceType,
      doctorId,
      notes,
      skipTrustCheck = false,
      holdId,
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

    try {
      const normalizedPhone = normalizePhone(patientPhone);

      // Validate date is in the future
      const appointmentDateTime = new Date(`${date}T${time}`);
      if (appointmentDateTime < new Date()) {
        return {
          success: false,
          error: 'Date in past',
          voiceMessage: locale === 'en'
            ? 'That time has already passed. Please choose a future date and time.'
            : 'Esa fecha y hora ya pasaron. Por favor elija una fecha y hora futura.',
        };
      }

      // Step 1: Verify customer trust (unless skipped or holdId provided)
      let trustScore = 70;
      let trustAction: TrustAction = 'proceed';
      let depositRequired = false;
      let depositAmountCents = 0;
      let leadId: string | undefined;

      if (!skipTrustCheck && !holdId) {
        // Get booking policy
        const { data: policy } = await supabase
          .from('vertical_booking_policies')
          .select('trust_threshold_confirmation, trust_threshold_deposit, deposit_amount_cents, require_deposit_below_trust')
          .eq('tenant_id', tenantId)
          .eq('vertical', 'dental')
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .limit(1)
          .single();

        const thresholdConfirmation = policy?.trust_threshold_confirmation ?? 80;
        const thresholdDeposit = policy?.trust_threshold_deposit ?? 30;
        depositAmountCents = policy?.deposit_amount_cents ?? 30000;

        // Get trust score
        const { data: trustResult } = await supabase.rpc('get_customer_trust_score', {
          p_tenant_id: tenantId,
          p_lead_id: null,
          p_phone_number: normalizedPhone,
        });

        if (trustResult) {
          trustScore = trustResult.trust_score ?? 70;
          leadId = trustResult.lead_id;

          // Check if blocked
          if (trustResult.is_blocked) {
            return {
              success: false,
              error: 'Customer blocked',
              voiceMessage: locale === 'en'
                ? "I'm sorry, but we're unable to process your appointment at this time. Please contact us directly."
                : 'Lo siento, pero no podemos procesar su cita en este momento. Por favor contáctenos directamente.',
            };
          }

          // Determine action
          if (trustScore >= thresholdConfirmation || trustResult.is_vip) {
            trustAction = 'proceed';
          } else if (trustScore >= thresholdDeposit) {
            trustAction = 'require_confirmation';
          } else {
            trustAction = 'require_deposit';
            depositRequired = policy?.require_deposit_below_trust ?? true;
          }
        }
      }

      // If hold was provided, get its info
      if (holdId) {
        const { data: hold } = await supabase
          .from('booking_holds')
          .select('trust_score_at_hold, requires_deposit, deposit_amount_cents, lead_id')
          .eq('id', holdId)
          .eq('tenant_id', tenantId)
          .single();

        if (hold) {
          trustScore = hold.trust_score_at_hold ?? 70;
          depositRequired = hold.requires_deposit ?? false;
          depositAmountCents = hold.deposit_amount_cents ?? 0;
          leadId = hold.lead_id;
        }
      }

      // Step 2: If deposit required and not yet paid, inform user
      if (depositRequired && trustAction === 'require_deposit') {
        const depositAmount = (depositAmountCents / 100).toFixed(2);
        return {
          success: false,
          error: 'Deposit required',
          errorCode: 'DEPOSIT_REQUIRED',
          voiceMessage: locale === 'en'
            ? `To secure your appointment, a deposit of $${depositAmount} is required. Would you like to proceed with the payment?`
            : `Para asegurar su cita, se requiere un depósito de $${depositAmount}. ¿Desea proceder con el pago?`,
          data: {
            trustScoreAtBooking: trustScore,
            depositRequired: true,
            depositStatus: 'pending',
          },
        };
      }

      // Step 3: Get service details
      let serviceId: string | null = null;
      let serviceDuration = 30;
      let serviceName = serviceType || 'Consulta general';

      if (serviceType) {
        const { data: service } = await supabase
          .from('services')
          .select('id, name, duration_minutes')
          .eq('tenant_id', tenantId)
          .ilike('name', `%${serviceType}%`)
          .single();

        if (service) {
          serviceId = service.id;
          serviceDuration = service.duration_minutes || 30;
          serviceName = service.name;
        }
      }

      // Calculate end time
      const endDateTime = new Date(appointmentDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + serviceDuration);
      const endTime = endDateTime.toTimeString().slice(0, 5);

      // Step 4: Find available doctor
      let selectedDoctorId = doctorId;
      let doctorName = '';

      if (!selectedDoctorId) {
        const { data: availableDoctor } = await supabase
          .rpc('find_available_doctor', {
            p_tenant_id: tenantId,
            p_branch_id: branchId || null,
            p_date: date,
            p_start_time: time,
            p_end_time: endTime,
          });

        if (availableDoctor && availableDoctor.length > 0) {
          selectedDoctorId = availableDoctor[0].doctor_id;
          doctorName = availableDoctor[0].doctor_name;
        } else {
          const { data: doctors } = await supabase
            .from('doctors')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .limit(1);

          if (doctors && doctors.length > 0) {
            selectedDoctorId = doctors[0].id;
            doctorName = doctors[0].name;
          }
        }
      } else {
        const { data: doctor } = await supabase
          .from('doctors')
          .select('name')
          .eq('id', selectedDoctorId)
          .single();

        if (doctor) {
          doctorName = doctor.name;
        }
      }

      // Step 5: Check availability (including holds)
      const { data: activeHolds } = await supabase
        .from('booking_holds')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .neq('id', holdId || '')
        .lte('slot_datetime', endDateTime.toISOString())
        .gte('end_datetime', appointmentDateTime.toISOString())
        .limit(1);

      if (activeHolds && activeHolds.length > 0) {
        return {
          success: false,
          error: 'Slot held',
          voiceMessage: locale === 'en'
            ? 'Sorry, that time slot is currently being held by someone else. Would you like to check another time?'
            : 'Lo siento, ese horario está siendo reservado por otra persona. ¿Le gustaría consultar otro horario?',
        };
      }

      // Step 6: Generate confirmation code and create appointment
      const confirmationCode = generateConfirmationCode();

      const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId || null,
          doctor_id: selectedDoctorId,
          service_id: serviceId,
          date,
          start_time: time,
          end_time: endTime,
          patient_name: patientName,
          patient_phone: normalizedPhone,
          patient_email: patientEmail || null,
          notes: notes || null,
          status: 'confirmed',
          confirmation_code: confirmationCode,
          source: channel,
          source_call_id: callId,
          hold_id: holdId || null,
          trust_score_at_booking: trustScore,
          created_at: new Date().toISOString(),
        })
        .select('id, confirmation_code')
        .single();

      if (insertError) {
        console.error('[SecureCreateAppointment] Insert error:', insertError);
        return {
          success: false,
          error: insertError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem creating your appointment. Please try again.'
            : 'Hubo un problema al crear su cita. Por favor intente de nuevo.',
        };
      }

      // Step 7: If hold existed, mark as converted
      if (holdId) {
        await supabase
          .from('booking_holds')
          .update({
            status: 'converted',
            converted_at: new Date().toISOString(),
            converted_to_id: appointment.id,
            converted_to_type: 'appointment',
          })
          .eq('id', holdId);
      }

      // Step 8: Update trust score (reward)
      if (leadId) {
        await supabase.rpc('update_trust_score', {
          p_lead_id: leadId,
          p_delta: 2,
          p_reason: 'appointment_completed',
          p_reference_id: appointment.id,
        });
      }

      // Format success message
      const dateStr = formatDateForVoice(date, locale);
      const timeStr = formatTimeForVoice(time, locale);
      const codeStr = formatConfirmationCodeForVoice(confirmationCode, locale);
      const doctorStr = doctorName
        ? (locale === 'en' ? ` with Dr. ${doctorName}` : ` con el Dr. ${doctorName}`)
        : '';

      const voiceMessage = locale === 'en'
        ? `Your appointment for ${serviceName}${doctorStr} on ${dateStr} at ${timeStr} is confirmed. Your confirmation code is ${codeStr}. We'll send you a reminder before your appointment.`
        : `Su cita para ${serviceName}${doctorStr} el ${dateStr} a las ${timeStr} está confirmada. Su código de confirmación es ${codeStr}. Le enviaremos un recordatorio antes de su cita.`;

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        data: {
          appointmentId: appointment.id,
          confirmationCode: appointment.confirmation_code,
          date,
          time,
          endTime,
          doctorId: selectedDoctorId,
          doctorName,
          serviceName,
          trustScoreAtBooking: trustScore,
          depositRequired: false,
          depositStatus: 'not_required',
          convertedFromHoldId: holdId,
        },
      };
    } catch (error) {
      console.error('[SecureCreateAppointment] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't complete your appointment. Please try again."
          : 'Lo siento, no pude completar su cita. Por favor intente de nuevo.',
      };
    }
  },
};

export default secureCreateAppointment;
