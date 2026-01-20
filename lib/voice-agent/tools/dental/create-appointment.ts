/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dental Tool: Create Appointment
 *
 * Creates dental appointments with confirmation workflow.
 * Associates with doctor and service.
 */

import type {
  ToolDefinition,
  ToolContext,
  AppointmentResult,
  CreateAppointmentParams,
  ModifyAppointmentParams,
  CancelAppointmentParams,
} from '../types';
import {
  formatDateForVoice,
  formatTimeForVoice,
  formatConfirmationCodeForVoice,
} from '../formatters';

// =====================================================
// TOOL DEFINITION: CREATE APPOINTMENT
// =====================================================

export const createAppointment: ToolDefinition<CreateAppointmentParams> = {
  name: 'create_appointment',
  description: 'Crea una cita dental con un doctor',
  category: 'appointment',

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Fecha de la cita (YYYY-MM-DD)',
      },
      time: {
        type: 'string',
        description: 'Hora de la cita (HH:MM)',
      },
      serviceType: {
        type: 'string',
        description: 'Tipo de servicio (limpieza, consulta, etc.)',
      },
      patientName: {
        type: 'string',
        description: 'Nombre del paciente',
      },
      patientPhone: {
        type: 'string',
        description: 'Teléfono del paciente',
      },
      doctorId: {
        type: 'string',
        description: 'ID del doctor (opcional)',
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales',
      },
    },
    required: ['date', 'time', 'patientName', 'patientPhone'],
  },

  requiredCapabilities: ['appointments'],
  requiresConfirmation: true,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete'],
  timeout: 15000,

  confirmationMessage: (params) => {
    const serviceStr = params.serviceType
      ? ` para ${params.serviceType}`
      : '';

    return `Voy a agendar una cita${serviceStr} el ${params.date} a las ${params.time} para ${params.patientName}. ¿Confirma la cita?`;
  },

  handler: async (params, context): Promise<AppointmentResult> => {
    const {
      date,
      time,
      serviceType,
      patientName,
      patientPhone,
      doctorId,
      notes,
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

    try {
      // Validate date is not in the past
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

      // Get service details if provided
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

      // Find available doctor if not specified
      let selectedDoctorId = doctorId;
      let doctorName = '';

      if (!selectedDoctorId) {
        // Find any available doctor for this time
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
          // Fallback: get first active doctor
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
        // Get doctor name
        const { data: doctor } = await supabase
          .from('doctors')
          .select('name')
          .eq('id', selectedDoctorId)
          .single();

        if (doctor) {
          doctorName = doctor.name;
        }
      }

      // Verify slot is still available
      const { data: existingAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .eq('doctor_id', selectedDoctorId)
        .not('status', 'in', '("cancelled","no_show")')
        .or(`start_time.lte.${endTime},end_time.gte.${time}`);

      if (checkError) {
        console.error('[CreateAppointment] Check error:', checkError);
      }

      if (existingAppointments && existingAppointments.length > 0) {
        return {
          success: false,
          error: 'Slot no longer available',
          voiceMessage: locale === 'en'
            ? 'Sorry, that time slot was just taken. Would you like to check another time?'
            : 'Lo siento, ese horario acaba de ser ocupado. ¿Le gustaría consultar otro horario?',
        };
      }

      // Generate confirmation code
      const confirmationCode = generateConfirmationCode();

      // Create the appointment
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
          patient_phone: normalizePhone(patientPhone),
          notes: notes || null,
          status: 'confirmed',
          confirmation_code: confirmationCode,
          source: channel,
          source_call_id: callId,
          created_at: new Date().toISOString(),
        })
        .select('id, confirmation_code')
        .single();

      if (insertError) {
        console.error('[CreateAppointment] Insert error:', insertError);
        return {
          success: false,
          error: insertError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem creating your appointment. Please try again.'
            : 'Hubo un problema al crear su cita. Por favor intente de nuevo.',
        };
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
        },
      };
    } catch (error) {
      console.error('[CreateAppointment] Error:', error);

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

// =====================================================
// TOOL DEFINITION: MODIFY APPOINTMENT
// =====================================================

export const modifyAppointment: ToolDefinition<ModifyAppointmentParams> = {
  name: 'modify_appointment',
  description: 'Modifica una cita dental existente',
  category: 'appointment',

  parameters: {
    type: 'object',
    properties: {
      confirmationCode: {
        type: 'string',
        description: 'Código de confirmación de la cita',
      },
      patientPhone: {
        type: 'string',
        description: 'Teléfono del paciente para verificación',
      },
      newDate: {
        type: 'string',
        description: 'Nueva fecha (YYYY-MM-DD)',
      },
      newTime: {
        type: 'string',
        description: 'Nueva hora (HH:MM)',
      },
      newDoctorId: {
        type: 'string',
        description: 'Nuevo doctor (opcional)',
      },
    },
    required: ['confirmationCode', 'patientPhone'],
  },

  requiredCapabilities: ['appointments'],
  requiresConfirmation: true,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete'],
  timeout: 15000,

  confirmationMessage: (params) => {
    if (params.newDate && params.newTime) {
      return `Voy a cambiar su cita al ${params.newDate} a las ${params.newTime}. ¿Confirma el cambio?`;
    } else if (params.newDate) {
      return `Voy a cambiar su cita al ${params.newDate}. ¿Confirma el cambio?`;
    } else if (params.newTime) {
      return `Voy a cambiar su cita a las ${params.newTime}. ¿Confirma el cambio?`;
    }
    return '¿Qué cambio desea hacer en su cita?';
  },

  handler: async (params, context): Promise<AppointmentResult> => {
    const { confirmationCode, patientPhone, newDate, newTime, newDoctorId } = params;
    const { supabase, tenantId, locale } = context;

    try {
      // Find the appointment
      const { data: appointment, error: findError } = await supabase
        .from('appointments')
        .select('*, doctors(name), services(name, duration_minutes)')
        .eq('tenant_id', tenantId)
        .eq('confirmation_code', confirmationCode.toUpperCase())
        .single();

      if (findError || !appointment) {
        return {
          success: false,
          error: 'Appointment not found',
          voiceMessage: locale === 'en'
            ? "I couldn't find an appointment with that confirmation code. Could you please verify the code?"
            : 'No encontré una cita con ese código de confirmación. ¿Podría verificar el código?',
        };
      }

      // Verify phone number
      const normalizedInputPhone = normalizePhone(patientPhone);
      const normalizedStoredPhone = normalizePhone(appointment.patient_phone);

      if (!normalizedStoredPhone.endsWith(normalizedInputPhone.slice(-4))) {
        return {
          success: false,
          error: 'Phone verification failed',
          voiceMessage: locale === 'en'
            ? "The phone number doesn't match our records. Could you verify your phone number?"
            : 'El número de teléfono no coincide con nuestros registros. ¿Podría verificar su número?',
        };
      }

      // Check if appointment can be modified
      if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
        return {
          success: false,
          error: 'Cannot modify appointment',
          voiceMessage: locale === 'en'
            ? 'This appointment cannot be modified because it has been ' + appointment.status + '.'
            : `Esta cita no puede ser modificada porque ya fue ${appointment.status === 'cancelled' ? 'cancelada' : 'completada'}.`,
        };
      }

      // Prepare updates
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      const targetDate = newDate || appointment.date;
      const targetTime = newTime || appointment.start_time;

      if (newDate) {
        updates.date = newDate;
      }

      if (newTime) {
        const duration = appointment.services?.duration_minutes || 30;
        const startDateTime = new Date(`${targetDate}T${targetTime}`);
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + duration);

        updates.start_time = targetTime;
        updates.end_time = endDateTime.toTimeString().slice(0, 5);
      }

      if (newDoctorId) {
        updates.doctor_id = newDoctorId;
      }

      // If date/time changed, verify availability
      if (newDate || newTime) {
        const doctorId = newDoctorId || appointment.doctor_id;
        const endTime = updates.end_time || appointment.end_time;

        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('date', targetDate)
          .eq('doctor_id', doctorId)
          .neq('id', appointment.id)
          .not('status', 'in', '("cancelled","no_show")')
          .or(`start_time.lte.${endTime},end_time.gte.${targetTime}`);

        if (conflicts && conflicts.length > 0) {
          return {
            success: false,
            error: 'Slot not available',
            voiceMessage: locale === 'en'
              ? 'Sorry, that time slot is not available. Would you like to check another time?'
              : 'Lo siento, ese horario no está disponible. ¿Le gustaría consultar otro horario?',
          };
        }
      }

      // Update the appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', appointment.id);

      if (updateError) {
        console.error('[ModifyAppointment] Update error:', updateError);
        return {
          success: false,
          error: updateError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem updating your appointment. Please try again.'
            : 'Hubo un problema al actualizar su cita. Por favor intente de nuevo.',
        };
      }

      // Format success message
      const dateStr = formatDateForVoice(targetDate, locale);
      const timeStr = formatTimeForVoice(targetTime, locale);

      const voiceMessage = locale === 'en'
        ? `Your appointment has been updated to ${dateStr} at ${timeStr}. Is there anything else I can help you with?`
        : `Su cita ha sido actualizada para el ${dateStr} a las ${timeStr}. ¿Hay algo más en que pueda ayudarle?`;

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        data: {
          appointmentId: appointment.id,
          confirmationCode: appointment.confirmation_code,
          date: targetDate,
          time: targetTime,
        },
      };
    } catch (error) {
      console.error('[ModifyAppointment] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't update your appointment. Please try again."
          : 'Lo siento, no pude actualizar su cita. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// TOOL DEFINITION: CANCEL APPOINTMENT
// =====================================================

export const cancelAppointment: ToolDefinition<CancelAppointmentParams> = {
  name: 'cancel_appointment',
  description: 'Cancela una cita dental',
  category: 'appointment',

  parameters: {
    type: 'object',
    properties: {
      confirmationCode: {
        type: 'string',
        description: 'Código de confirmación de la cita',
      },
      patientPhone: {
        type: 'string',
        description: 'Teléfono del paciente para verificación',
      },
      reason: {
        type: 'string',
        description: 'Razón de cancelación (opcional)',
      },
    },
    required: ['confirmationCode', 'patientPhone'],
  },

  requiredCapabilities: ['appointments'],
  requiresConfirmation: true,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete'],
  timeout: 10000,

  confirmationMessage: () =>
    '¿Está seguro que desea cancelar su cita? Esta acción no se puede deshacer.',

  handler: async (params, context): Promise<AppointmentResult> => {
    const { confirmationCode, patientPhone, reason } = params;
    const { supabase, tenantId, locale } = context;

    try {
      // Find the appointment
      const { data: appointment, error: findError } = await supabase
        .from('appointments')
        .select('id, date, start_time, patient_name, patient_phone, status')
        .eq('tenant_id', tenantId)
        .eq('confirmation_code', confirmationCode.toUpperCase())
        .single();

      if (findError || !appointment) {
        return {
          success: false,
          error: 'Appointment not found',
          voiceMessage: locale === 'en'
            ? "I couldn't find an appointment with that confirmation code. Could you please verify the code?"
            : 'No encontré una cita con ese código de confirmación. ¿Podría verificar el código?',
        };
      }

      // Verify phone number
      const normalizedInputPhone = normalizePhone(patientPhone);
      const normalizedStoredPhone = normalizePhone(appointment.patient_phone);

      if (!normalizedStoredPhone.endsWith(normalizedInputPhone.slice(-4))) {
        return {
          success: false,
          error: 'Phone verification failed',
          voiceMessage: locale === 'en'
            ? "The phone number doesn't match our records. Could you verify your phone number?"
            : 'El número de teléfono no coincide con nuestros registros. ¿Podría verificar su número?',
        };
      }

      // Check if already cancelled
      if (appointment.status === 'cancelled') {
        return {
          success: false,
          error: 'Already cancelled',
          voiceMessage: locale === 'en'
            ? 'This appointment has already been cancelled.'
            : 'Esta cita ya fue cancelada anteriormente.',
        };
      }

      // Cancel the appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          cancellation_reason: reason || null,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);

      if (updateError) {
        console.error('[CancelAppointment] Update error:', updateError);
        return {
          success: false,
          error: updateError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem cancelling your appointment. Please try again.'
            : 'Hubo un problema al cancelar su cita. Por favor intente de nuevo.',
        };
      }

      const dateStr = formatDateForVoice(appointment.date, locale);
      const timeStr = formatTimeForVoice(appointment.start_time, locale);

      const voiceMessage = locale === 'en'
        ? `Your appointment for ${dateStr} at ${timeStr} has been cancelled. Would you like to schedule a new appointment?`
        : `Su cita del ${dateStr} a las ${timeStr} ha sido cancelada. ¿Le gustaría agendar una nueva cita?`;

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        data: {
          appointmentId: appointment.id,
          confirmationCode,
          cancelled: true,
        },
      };
    } catch (error) {
      console.error('[CancelAppointment] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't cancel your appointment. Please try again."
          : 'Lo siento, no pude cancelar su cita. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate a unique confirmation code
 */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export default createAppointment;
