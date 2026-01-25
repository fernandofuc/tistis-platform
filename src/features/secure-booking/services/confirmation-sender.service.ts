// =====================================================
// TIS TIS PLATFORM - Confirmation Sender Service
// Service for sending booking confirmations via WhatsApp
// =====================================================
//
// SINCRONIZADO CON:
// - Templates: src/features/secure-booking/templates/confirmation-templates.ts
// - Types: src/features/secure-booking/types/index.ts
// - WhatsApp Client: src/shared/lib/whatsapp.ts
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import { whatsappClient, type WhatsAppResponse } from '@/src/shared/lib/whatsapp';
import type {
  BookingConfirmation,
  ConfirmationFormData,
  ConfirmationType,
  ConfirmationChannel,
  ConfirmationStatus,
  ReferenceType,
  AutoActionOnExpire,
} from '../types';
import {
  getTemplateBuilder,
  generateConfirmationCode,
  formatDateSpanish,
  formatTimeSpanish,
  calculateHoursUntilExpiration,
  type ConfirmationTemplateData,
  type TemplateResult,
} from '../templates/confirmation-templates';

// ======================
// CONFIGURATION
// ======================

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

// Default expiration times (hours)
const DEFAULT_EXPIRATION_HOURS: Record<ConfirmationType, number> = {
  voice_to_message: 4,
  reminder_24h: 24,
  reminder_2h: 2,
  deposit_required: 24,
  custom: 24,
};

// ======================
// TYPES
// ======================

export interface SendConfirmationInput {
  tenantId: string;
  referenceType: ReferenceType;
  referenceId: string;
  confirmationType: ConfirmationType;
  channel?: ConfirmationChannel;
  recipientPhone: string;
  recipientName: string;

  // If provided, update existing record instead of creating new
  existingConfirmationId?: string;

  // Business info
  businessName: string;
  businessPhone?: string;
  branchName?: string;
  branchAddress?: string;

  // Booking details
  bookingDatetime: Date | string;
  serviceName?: string;
  staffName?: string;
  partySize?: number;
  orderItems?: string[];
  totalAmount?: number;
  currency?: string;

  // Deposit
  depositRequired?: boolean;
  depositAmount?: number;
  depositPaymentUrl?: string;

  // Expiration
  expiresAt?: Date | string;
  autoActionOnExpire?: AutoActionOnExpire;

  // Custom
  customMessage?: string;
}

export interface SendConfirmationResult {
  success: boolean;
  confirmationId?: string;
  messageId?: string;
  error?: string;
  retryCount?: number;
}

export interface ProcessResponseInput {
  tenantId: string;  // SECURITY: Required for tenant isolation
  confirmationId: string;
  response: 'confirmed' | 'cancelled' | 'need_change' | 'other';
  rawResponse?: string;
}

export interface ProcessResponseResult {
  success: boolean;
  confirmation?: BookingConfirmation;
  action?: 'confirmed' | 'cancelled' | 'need_change' | 'other';
  error?: string;
}

// ======================
// SERVICE CLASS
// ======================

class ConfirmationSenderService {
  private static instance: ConfirmationSenderService;

  private constructor() {}

  public static getInstance(): ConfirmationSenderService {
    if (!ConfirmationSenderService.instance) {
      ConfirmationSenderService.instance = new ConfirmationSenderService();
    }
    return ConfirmationSenderService.instance;
  }

  // ======================
  // MAIN SEND METHOD
  // ======================

  /**
   * Create and send a confirmation message
   */
  async sendConfirmation(input: SendConfirmationInput): Promise<SendConfirmationResult> {
    const supabase = createServerClient();
    const channel = input.channel || 'whatsapp';
    const confirmationCode = generateConfirmationCode();

    // Calculate expiration
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : new Date(Date.now() + DEFAULT_EXPIRATION_HOURS[input.confirmationType] * 60 * 60 * 1000);

    try {
      // 1. Get or create confirmation record in DB
      let confirmation: { id: string; tenant_id: string; [key: string]: unknown };

      if (input.existingConfirmationId) {
        // Update existing record
        const { data: existing, error: updateError } = await supabase
          .from('booking_confirmations')
          .update({
            confirmation_type: input.confirmationType,
            sent_via: channel,
            status: 'pending' as ConfirmationStatus,
            expires_at: expiresAt.toISOString(),
            auto_action_on_expire: input.autoActionOnExpire || 'cancel',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.existingConfirmationId)
          .eq('tenant_id', input.tenantId)
          .select()
          .single();

        if (updateError || !existing) {
          console.error('[ConfirmationSender] Failed to update confirmation record:', updateError);
          return {
            success: false,
            error: updateError?.message || 'Failed to update confirmation record',
          };
        }
        confirmation = existing;
      } else {
        // Create new record
        const { data: created, error: insertError } = await supabase
          .from('booking_confirmations')
          .insert({
            tenant_id: input.tenantId,
            reference_type: input.referenceType,
            reference_id: input.referenceId,
            confirmation_type: input.confirmationType,
            sent_via: channel,
            status: 'pending' as ConfirmationStatus,
            expires_at: expiresAt.toISOString(),
            auto_action_on_expire: input.autoActionOnExpire || 'cancel',
          })
          .select()
          .single();

        if (insertError || !created) {
          console.error('[ConfirmationSender] Failed to create confirmation record:', insertError);
          return {
            success: false,
            error: insertError?.message || 'Failed to create confirmation record',
          };
        }
        confirmation = created;
      }

      // 2. Build template data
      const bookingDate = typeof input.bookingDatetime === 'string'
        ? new Date(input.bookingDatetime)
        : input.bookingDatetime;

      const templateData: ConfirmationTemplateData = {
        customerName: input.recipientName,
        customerPhone: input.recipientPhone,
        businessName: input.businessName,
        businessPhone: input.businessPhone,
        branchName: input.branchName,
        branchAddress: input.branchAddress,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        confirmationCode,
        date: formatDateSpanish(bookingDate),
        time: formatTimeSpanish(bookingDate),
        dateTimeRaw: bookingDate.toISOString(),
        serviceName: input.serviceName,
        staffName: input.staffName,
        partySize: input.partySize,
        orderItems: input.orderItems,
        totalAmount: input.totalAmount,
        currency: input.currency,
        depositRequired: input.depositRequired,
        depositAmount: input.depositAmount,
        depositPaymentUrl: input.depositPaymentUrl,
        expiresAt: expiresAt.toISOString(),
        expiresInHours: calculateHoursUntilExpiration(expiresAt),
        customMessage: input.customMessage,
      };

      // 3. Build message from template
      const templateBuilder = getTemplateBuilder(input.confirmationType, input.referenceType);
      const template = templateBuilder(templateData);

      // 4. Send via WhatsApp with retry
      const sendResult = await this.sendWithRetry(
        input.recipientPhone,
        template,
        confirmation.id
      );

      if (!sendResult.success) {
        // Update confirmation as failed
        await supabase
          .from('booking_confirmations')
          .update({
            status: 'failed' as ConfirmationStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', confirmation.id);

        return {
          success: false,
          confirmationId: confirmation.id,
          error: sendResult.error,
          retryCount: sendResult.retryCount,
        };
      }

      // 5. Update confirmation with message ID and sent status
      const { error: updateError } = await supabase
        .from('booking_confirmations')
        .update({
          status: 'sent' as ConfirmationStatus,
          sent_at: new Date().toISOString(),
          whatsapp_message_id: sendResult.messageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', confirmation.id);

      if (updateError) {
        console.error('[ConfirmationSender] Failed to update confirmation status:', updateError);
      }

      console.log(`[ConfirmationSender] Confirmation sent successfully: ${confirmation.id}`);

      return {
        success: true,
        confirmationId: confirmation.id,
        messageId: sendResult.messageId,
        retryCount: sendResult.retryCount,
      };
    } catch (error) {
      console.error('[ConfirmationSender] Error sending confirmation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ======================
  // RETRY LOGIC
  // ======================

  private async sendWithRetry(
    phone: string,
    template: TemplateResult,
    confirmationId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; retryCount: number }> {
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        let response: WhatsAppResponse;

        // Use buttons if available, otherwise plain text
        if (template.buttons && template.buttons.length > 0) {
          response = await whatsappClient.sendButtonMessage(
            phone,
            template.text,
            template.buttons,
            undefined, // No header
            template.footer
          );
        } else {
          // Append footer to text if present
          const fullText = template.footer
            ? `${template.text}\n\n---\n${template.footer}`
            : template.text;

          response = await whatsappClient.sendTextMessage(phone, fullText);
        }

        const messageId = response.messages?.[0]?.id;

        if (messageId) {
          return {
            success: true,
            messageId,
            retryCount,
          };
        }

        throw new Error('No message ID returned from WhatsApp API');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt + 1;

        console.warn(
          `[ConfirmationSender] Attempt ${retryCount}/${MAX_RETRY_ATTEMPTS} failed for ${confirmationId}:`,
          lastError.message
        );

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = Math.min(
            INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
            MAX_RETRY_DELAY_MS
          );
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      retryCount,
    };
  }

  private isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      'invalid phone number',
      'phone number not registered',
      'blocked',
      'spam',
      'rate limit exceeded',
      'not configured',
    ];

    const errorLower = error.message.toLowerCase();
    return nonRetryablePatterns.some((pattern) => errorLower.includes(pattern));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ======================
  // STATUS UPDATES
  // ======================

  /**
   * Mark confirmation as delivered (called from webhook)
   * SECURITY: Requires tenantId to prevent cross-tenant updates
   */
  async markAsDelivered(tenantId: string, messageId: string): Promise<boolean> {
    if (!tenantId || !messageId) {
      console.error('[ConfirmationSender] markAsDelivered: Missing required parameters');
      return false;
    }

    const supabase = createServerClient();

    const { error, count } = await supabase
      .from('booking_confirmations')
      .update({
        status: 'delivered' as ConfirmationStatus,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('whatsapp_message_id', messageId)
      .in('status', ['sent']);

    if (error) {
      console.error('[ConfirmationSender] Failed to mark as delivered:', error);
      return false;
    }

    return (count ?? 0) > 0;
  }

  /**
   * Mark confirmation as read (called from webhook)
   * SECURITY: Requires tenantId to prevent cross-tenant updates
   */
  async markAsRead(tenantId: string, messageId: string): Promise<boolean> {
    if (!tenantId || !messageId) {
      console.error('[ConfirmationSender] markAsRead: Missing required parameters');
      return false;
    }

    const supabase = createServerClient();

    const { error, count } = await supabase
      .from('booking_confirmations')
      .update({
        status: 'read' as ConfirmationStatus,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('whatsapp_message_id', messageId)
      .in('status', ['sent', 'delivered']);

    if (error) {
      console.error('[ConfirmationSender] Failed to mark as read:', error);
      return false;
    }

    return (count ?? 0) > 0;
  }

  // ======================
  // RESPONSE PROCESSING
  // ======================

  /**
   * Process a customer's response to a confirmation
   * SECURITY: Requires tenantId for tenant isolation
   */
  async processResponse(input: ProcessResponseInput): Promise<ProcessResponseResult> {
    if (!input.tenantId || !input.confirmationId) {
      return {
        success: false,
        error: 'Missing required parameters',
      };
    }

    const supabase = createServerClient();

    try {
      // 1. Get the confirmation with tenant validation
      const { data: confirmation, error: fetchError } = await supabase
        .from('booking_confirmations')
        .select('*')
        .eq('id', input.confirmationId)
        .eq('tenant_id', input.tenantId)  // SECURITY: Tenant isolation
        .single();

      if (fetchError || !confirmation) {
        return {
          success: false,
          error: 'Confirmation not found',
        };
      }

      // 2. Check if already responded or expired
      if (confirmation.status === 'responded') {
        return {
          success: false,
          error: 'Confirmation already responded',
        };
      }

      if (confirmation.status === 'expired') {
        return {
          success: false,
          error: 'Confirmation has expired',
        };
      }

      // 3. Update confirmation with response (with tenant validation)
      const { data: updatedConfirmation, error: updateError } = await supabase
        .from('booking_confirmations')
        .update({
          status: 'responded' as ConfirmationStatus,
          response: input.response,
          response_raw: input.rawResponse,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.confirmationId)
        .eq('tenant_id', input.tenantId)  // SECURITY: Tenant isolation
        .select()
        .single();

      if (updateError) {
        console.error('[ConfirmationSender] Failed to update confirmation:', updateError);
        return {
          success: false,
          error: updateError.message,
        };
      }

      // 4. Update the referenced booking/order status
      await this.updateReferenceStatus(
        confirmation.tenant_id,
        confirmation.reference_type as ReferenceType,
        confirmation.reference_id,
        input.response
      );

      console.log(
        `[ConfirmationSender] Response processed for ${input.confirmationId}: ${input.response}`
      );

      return {
        success: true,
        confirmation: updatedConfirmation as BookingConfirmation,
        action: input.response,
      };
    } catch (error) {
      console.error('[ConfirmationSender] Error processing response:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update the referenced appointment/reservation/order based on response
   */
  private async updateReferenceStatus(
    tenantId: string,
    referenceType: ReferenceType,
    referenceId: string,
    response: 'confirmed' | 'cancelled' | 'need_change' | 'other'
  ): Promise<void> {
    const supabase = createServerClient();

    let tableName: string;
    let statusField: string;
    let confirmedStatus: string;
    let cancelledStatus: string;

    switch (referenceType) {
      case 'appointment':
        tableName = 'appointments';
        statusField = 'status';
        confirmedStatus = 'confirmed';
        cancelledStatus = 'cancelled';
        break;
      case 'reservation':
        tableName = 'appointments'; // Reservations are stored in appointments
        statusField = 'status';
        confirmedStatus = 'confirmed';
        cancelledStatus = 'cancelled';
        break;
      case 'order':
        tableName = 'restaurant_orders';
        statusField = 'status';
        confirmedStatus = 'confirmed';
        cancelledStatus = 'cancelled';
        break;
      default:
        console.warn(`[ConfirmationSender] Unknown reference type: ${referenceType}`);
        return;
    }

    // Only update status for confirmed or cancelled responses
    if (response === 'confirmed' || response === 'cancelled') {
      const newStatus = response === 'confirmed' ? confirmedStatus : cancelledStatus;

      const { error } = await supabase
        .from(tableName)
        .update({
          [statusField]: newStatus,
          confirmation_status: response,
          updated_at: new Date().toISOString(),
        })
        .eq('id', referenceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error(
          `[ConfirmationSender] Failed to update ${tableName} status:`,
          error
        );
      }
    }

    // For 'need_change', we might want to flag it for staff attention
    if (response === 'need_change') {
      // Could create a task or notification for staff
      console.log(
        `[ConfirmationSender] Customer requested change for ${referenceType} ${referenceId}`
      );
    }
  }

  // ======================
  // FIND PENDING CONFIRMATION
  // ======================

  /**
   * Find a pending confirmation for a phone number
   */
  async findPendingForPhone(
    tenantId: string,
    phone: string
  ): Promise<BookingConfirmation | null> {
    const supabase = createServerClient();

    // Normalize phone
    const normalizedPhone = this.normalizePhone(phone);

    // Get pending confirmations by looking up via reference
    // We need to join with the reference tables to get the phone
    const { data: confirmations, error } = await supabase
      .from('booking_confirmations')
      .select(`
        *,
        appointments!inner(id, lead_id, leads!inner(phone))
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'delivered', 'read'])
      .eq('reference_type', 'appointment')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[ConfirmationSender] Error finding pending confirmation:', error);
      return null;
    }

    // Filter by phone (need to check in the joined data)
    const matching = confirmations?.find((c) => {
      const appointments = c.appointments as { leads?: { phone?: string } } | undefined;
      const leadPhone = appointments?.leads?.phone;
      return leadPhone && this.normalizePhone(leadPhone) === normalizedPhone;
    });

    if (matching) {
      // Return just the confirmation part
      const { appointments: _, ...confirmation } = matching;
      return confirmation as BookingConfirmation;
    }

    return null;
  }

  /**
   * Find pending confirmation by conversation
   */
  async findPendingByConversation(
    tenantId: string,
    conversationId: string
  ): Promise<BookingConfirmation | null> {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('booking_confirmations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('conversation_id', conversationId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as BookingConfirmation;
  }

  // ======================
  // PROCESS EXPIRED CONFIRMATIONS
  // ======================

  /**
   * Process all expired confirmations (called from CRON)
   */
  async processExpired(): Promise<{ processed: number; cancelled: number; notified: number }> {
    const supabase = createServerClient();
    const now = new Date().toISOString();

    // Find expired confirmations that haven't been processed
    const { data: expired, error } = await supabase
      .from('booking_confirmations')
      .select('*')
      .in('status', ['pending', 'sent', 'delivered', 'read'])
      .lt('expires_at', now)
      .eq('auto_action_executed', false)
      .limit(100);

    if (error || !expired) {
      console.error('[ConfirmationSender] Error fetching expired confirmations:', error);
      return { processed: 0, cancelled: 0, notified: 0 };
    }

    let cancelled = 0;
    let notified = 0;

    for (const confirmation of expired) {
      try {
        // Mark as expired with atomic check to prevent race conditions
        // SECURITY: Only update if auto_action_executed is still false
        // NOTE: We use .select('id') to get the updated rows - if empty, another process already handled it
        const { data: updatedRows, error: updateError } = await supabase
          .from('booking_confirmations')
          .update({
            status: 'expired' as ConfirmationStatus,
            auto_action_executed: true,
            auto_action_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', confirmation.id)
          .eq('auto_action_executed', false) // Prevent duplicate execution
          .select('id'); // Return updated row(s) to verify update occurred

        // Skip if another process already handled this (no rows updated)
        if (updateError || !updatedRows || updatedRows.length === 0) {
          console.log(
            `[ConfirmationSender] Skipping ${confirmation.id} - already processed by another instance`
          );
          continue;
        }

        // Execute auto action
        switch (confirmation.auto_action_on_expire) {
          case 'cancel':
            await this.updateReferenceStatus(
              confirmation.tenant_id,
              confirmation.reference_type as ReferenceType,
              confirmation.reference_id,
              'cancelled'
            );
            cancelled++;
            break;

          case 'notify_staff':
            // TODO: Send notification to staff
            notified++;
            break;

          case 'keep':
          default:
            // Do nothing, just mark as expired
            break;
        }
      } catch (err) {
        console.error(
          `[ConfirmationSender] Error processing expired confirmation ${confirmation.id}:`,
          err
        );
      }
    }

    console.log(
      `[ConfirmationSender] Processed ${expired.length} expired confirmations: ${cancelled} cancelled, ${notified} notified`
    );

    return {
      processed: expired.length,
      cancelled,
      notified,
    };
  }

  // ======================
  // RESEND CONFIRMATION
  // ======================

  /**
   * Resend a failed or pending confirmation
   * SECURITY: Requires tenantId for tenant isolation
   */
  async resend(tenantId: string, confirmationId: string): Promise<SendConfirmationResult> {
    if (!tenantId || !confirmationId) {
      return {
        success: false,
        error: 'Missing required parameters',
      };
    }

    const supabase = createServerClient();

    // Get original confirmation with reference data (with tenant validation)
    const { data: confirmation, error } = await supabase
      .from('booking_confirmations')
      .select(`
        *,
        appointments(
          id,
          start_datetime,
          services(name),
          staff(first_name, last_name),
          branches(name, address),
          leads(name, phone)
        )
      `)
      .eq('id', confirmationId)
      .eq('tenant_id', tenantId)  // SECURITY: Tenant isolation
      .single();

    if (error || !confirmation) {
      return {
        success: false,
        error: 'Confirmation not found',
      };
    }

    // Check if resendable
    if (!['pending', 'sent', 'failed'].includes(confirmation.status)) {
      return {
        success: false,
        error: `Cannot resend confirmation with status: ${confirmation.status}`,
      };
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, phone')
      .eq('tenant_id', confirmation.tenant_id)
      .single();

    // Build input from existing data
    const appointment = confirmation.appointments as {
      id: string;
      start_datetime: string;
      services?: { name: string };
      staff?: { first_name: string; last_name: string };
      branches?: { name: string; address: string };
      leads?: { name: string; phone: string };
    } | undefined;

    if (!appointment || !appointment.leads) {
      return {
        success: false,
        error: 'Missing appointment or lead data',
      };
    }

    const input: SendConfirmationInput = {
      existingConfirmationId: confirmationId,
      tenantId: confirmation.tenant_id,
      referenceType: confirmation.reference_type as ReferenceType,
      referenceId: confirmation.reference_id,
      confirmationType: confirmation.confirmation_type as ConfirmationType,
      channel: confirmation.sent_via as ConfirmationChannel,
      recipientPhone: appointment.leads.phone,
      recipientName: appointment.leads.name,
      businessName: tenant?.name || 'TIS TIS',
      businessPhone: tenant?.phone,
      branchName: appointment.branches?.name,
      branchAddress: appointment.branches?.address,
      bookingDatetime: appointment.start_datetime,
      serviceName: appointment.services?.name,
      staffName: appointment.staff
        ? `${appointment.staff.first_name} ${appointment.staff.last_name}`
        : undefined,
      expiresAt: confirmation.expires_at,
      autoActionOnExpire: confirmation.auto_action_on_expire as AutoActionOnExpire,
    };

    // Update existing confirmation (using existingConfirmationId)
    return this.sendConfirmation(input);
  }

  // ======================
  // HELPERS
  // ======================

  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[^\d+]/g, '');
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
    if (normalized.length === 10) {
      normalized = `52${normalized}`;
    }
    return normalized;
  }
}

// ======================
// EXPORT SINGLETON
// ======================

export const confirmationSenderService = ConfirmationSenderService.getInstance();
