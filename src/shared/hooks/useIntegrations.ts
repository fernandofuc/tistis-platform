// =====================================================
// TIS TIS PLATFORM - Integrations Hook
// Unified interface for WhatsApp & n8n integrations
// =====================================================

import { useCallback, useState } from 'react';
import { whatsappClient, sendAppointmentConfirmation, sendAppointmentReminder, sendServicesMenu } from '@/src/shared/lib/whatsapp';
import { n8nClient } from '@/src/shared/lib/n8n';
import { useAppStore } from '@/src/shared/stores/appStore';

interface IntegrationStatus {
  whatsapp: boolean;
  n8n: boolean;
}

interface SendMessageOptions {
  conversationId: string;
  leadPhone: string;
  content: string;
  messageType?: 'text' | 'template' | 'interactive';
}

interface ScheduleAppointmentOptions {
  leadId: string;
  leadPhone: string;
  leadName: string;
  branchId: string;
  branchName: string;
  branchAddress: string;
  scheduledAt: string;
  serviceId?: string;
}

export function useIntegrations() {
  const { addToast } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);

  // Check integration status
  const status: IntegrationStatus = {
    whatsapp: whatsappClient.isConfigured(),
    n8n: n8nClient.isConfigured(),
  };

  // ======================
  // Send WhatsApp Message
  // ======================
  const sendWhatsAppMessage = useCallback(
    async (options: SendMessageOptions) => {
      if (!status.whatsapp) {
        console.log('[Integrations] WhatsApp not configured');
        return { success: false, error: 'WhatsApp not configured' };
      }

      setIsLoading(true);
      try {
        const response = await whatsappClient.sendTextMessage(
          options.leadPhone,
          options.content
        );

        addToast({
          type: 'success',
          title: 'Mensaje Enviado',
          message: 'El mensaje de WhatsApp fue enviado correctamente',
        });

        // Trigger n8n for tracking if available
        if (status.n8n) {
          await n8nClient.triggerWebhook('/message-sent', {
            conversation_id: options.conversationId,
            phone: options.leadPhone,
            content: options.content,
            whatsapp_message_id: response.messages[0]?.id,
          });
        }

        return { success: true, data: response };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        addToast({
          type: 'error',
          title: 'Error al Enviar',
          message: errorMessage,
        });
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [status.whatsapp, status.n8n, addToast]
  );

  // ======================
  // Send Appointment Confirmation
  // ======================
  const sendAppointmentConfirmationMessage = useCallback(
    async (options: ScheduleAppointmentOptions) => {
      if (!status.whatsapp) {
        console.log('[Integrations] WhatsApp not configured');
        return { success: false, error: 'WhatsApp not configured' };
      }

      setIsLoading(true);
      try {
        const date = new Date(options.scheduledAt);
        const dateStr = date.toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const timeStr = date.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const response = await sendAppointmentConfirmation(
          options.leadPhone,
          options.leadName,
          dateStr,
          timeStr,
          options.branchName,
          options.branchAddress
        );

        if (response) {
          addToast({
            type: 'success',
            title: 'Confirmación Enviada',
            message: `Confirmación de cita enviada a ${options.leadName}`,
          });
        }

        return { success: true, data: response };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        addToast({
          type: 'error',
          title: 'Error al Enviar Confirmación',
          message: errorMessage,
        });
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [status.whatsapp, addToast]
  );

  // ======================
  // Send Appointment Reminder
  // ======================
  const sendAppointmentReminderMessage = useCallback(
    async (
      phone: string,
      patientName: string,
      scheduledAt: string,
      branchName: string
    ) => {
      if (!status.whatsapp) {
        console.log('[Integrations] WhatsApp not configured');
        return { success: false, error: 'WhatsApp not configured' };
      }

      setIsLoading(true);
      try {
        const date = new Date(scheduledAt);
        const dateStr = date.toLocaleDateString('es-MX', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        const timeStr = date.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const response = await sendAppointmentReminder(
          phone,
          patientName,
          dateStr,
          timeStr,
          branchName
        );

        if (response) {
          addToast({
            type: 'success',
            title: 'Recordatorio Enviado',
            message: `Recordatorio enviado a ${patientName}`,
          });
        }

        return { success: true, data: response };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        addToast({
          type: 'error',
          title: 'Error al Enviar Recordatorio',
          message: errorMessage,
        });
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [status.whatsapp, addToast]
  );

  // ======================
  // Send Services Menu
  // ======================
  const sendServicesMenuMessage = useCallback(
    async (phone: string, patientName: string) => {
      if (!status.whatsapp) {
        console.log('[Integrations] WhatsApp not configured');
        return { success: false, error: 'WhatsApp not configured' };
      }

      setIsLoading(true);
      try {
        const response = await sendServicesMenu(phone, patientName);

        if (response) {
          addToast({
            type: 'success',
            title: 'Menú Enviado',
            message: `Menú de servicios enviado a ${patientName}`,
          });
        }

        return { success: true, data: response };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        addToast({
          type: 'error',
          title: 'Error al Enviar Menú',
          message: errorMessage,
        });
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [status.whatsapp, addToast]
  );

  // ======================
  // Request AI Response via n8n
  // ======================
  const requestAIResponse = useCallback(
    async (
      conversation: Record<string, unknown>,
      messages: Record<string, unknown>[],
      lead: Record<string, unknown>
    ) => {
      if (!status.n8n) {
        console.log('[Integrations] n8n not configured');
        return { success: false, error: 'n8n not configured' };
      }

      setIsLoading(true);
      try {
        const response = await n8nClient.requestAIResponse(
          conversation,
          messages,
          lead
        );

        if (response.success) {
          addToast({
            type: 'info',
            title: 'Procesando',
            message: 'Generando respuesta con IA...',
          });
        }

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        addToast({
          type: 'error',
          title: 'Error de IA',
          message: errorMessage,
        });
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [status.n8n, addToast]
  );

  // ======================
  // Escalate Conversation
  // ======================
  const escalateConversation = useCallback(
    async (conversationId: string, reason: string, staffId?: string) => {
      if (!status.n8n) {
        console.log('[Integrations] n8n not configured');
        return { success: false, error: 'n8n not configured' };
      }

      setIsLoading(true);
      try {
        const response = await n8nClient.onConversationEscalated(
          { id: conversationId },
          reason
        );

        if (response.success) {
          addToast({
            type: 'warning',
            title: 'Conversación Escalada',
            message: 'La conversación ha sido transferida a un agente humano',
          });
        }

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        addToast({
          type: 'error',
          title: 'Error al Escalar',
          message: errorMessage,
        });
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [status.n8n, addToast]
  );

  // ======================
  // Trigger Lead Scoring
  // ======================
  const triggerLeadScoring = useCallback(
    async (lead: Record<string, unknown>, interactions?: Record<string, unknown>[]) => {
      if (!status.n8n) {
        console.log('[Integrations] n8n not configured');
        return { success: false, error: 'n8n not configured' };
      }

      try {
        const response = await n8nClient.triggerWebhook('/score-lead', {
          lead,
          interactions,
        });

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        return { success: false, error: errorMessage };
      }
    },
    [status.n8n]
  );

  return {
    // Status
    status,
    isLoading,

    // WhatsApp
    sendWhatsAppMessage,
    sendAppointmentConfirmationMessage,
    sendAppointmentReminderMessage,
    sendServicesMenuMessage,

    // n8n / AI
    requestAIResponse,
    escalateConversation,
    triggerLeadScoring,
  };
}
