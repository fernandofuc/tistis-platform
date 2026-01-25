/**
 * TIS TIS Platform - Voice Agent v2.2
 * Voice Secure Booking Service
 *
 * Orchestrates the integration between voice agent tools
 * and the Secure Booking System (Phase 2).
 *
 * Provides high-level functions for:
 * - Trust-based booking flow
 * - Hold management during voice calls
 * - Automatic hold cleanup on call end
 * - Deposit requirement handling
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

export interface SecureBookingContext {
  tenantId: string;
  branchId?: string;
  callId: string;
  phoneNumber: string;
  supabase: SupabaseClient;
  locale?: string;
}

export interface TrustVerificationResult {
  trustScore: number;
  trustLevel: 'vip' | 'trusted' | 'normal' | 'risky' | 'blocked';
  action: 'proceed' | 'require_confirmation' | 'require_deposit' | 'blocked';
  isVip: boolean;
  isBlocked: boolean;
  blockReason?: string;
  depositAmountCents?: number;
  leadId?: string;
}

export interface HoldCreationResult {
  success: boolean;
  holdId?: string;
  expiresAt?: string;
  expiresInMinutes?: number;
  requiresDeposit: boolean;
  requiresConfirmation: boolean;
  depositAmountCents?: number;
  error?: string;
}

export interface BookingConversionResult {
  success: boolean;
  bookingId?: string;
  confirmationCode?: string;
  bookingType?: 'appointment' | 'reservation';
  error?: string;
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class VoiceSecureBookingService {
  private supabase: SupabaseClient;
  private tenantId: string;
  private branchId?: string;
  private callId: string;
  private phoneNumber: string;
  private locale: string;

  // Track active holds for this call session
  private activeHolds: Map<string, string> = new Map(); // holdId -> slotDatetime

  constructor(context: SecureBookingContext) {
    this.supabase = context.supabase;
    this.tenantId = context.tenantId;
    this.branchId = context.branchId;
    this.callId = context.callId;
    this.phoneNumber = this.normalizePhone(context.phoneNumber);
    this.locale = context.locale || 'es';
  }

  // =====================================================
  // TRUST VERIFICATION
  // =====================================================

  /**
   * Verify customer trust score and determine booking action
   */
  async verifyCustomerTrust(vertical?: string): Promise<TrustVerificationResult> {
    try {
      // Get tenant vertical if not provided
      let resolvedVertical = vertical;
      if (!resolvedVertical) {
        const { data: tenant } = await this.supabase
          .from('tenants')
          .select('vertical')
          .eq('id', this.tenantId)
          .single();

        resolvedVertical = tenant?.vertical || 'restaurant';
      }

      // Get booking policy thresholds
      const { data: policy } = await this.supabase
        .from('vertical_booking_policies')
        .select('trust_threshold_confirmation, trust_threshold_deposit, deposit_amount_cents')
        .eq('tenant_id', this.tenantId)
        .eq('vertical', resolvedVertical)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .single();

      const thresholdConfirmation = policy?.trust_threshold_confirmation ?? 80;
      const thresholdDeposit = policy?.trust_threshold_deposit ?? 30;
      const depositAmountCents = policy?.deposit_amount_cents ?? 10000;

      // Get customer trust score via RPC
      const { data: trustResult } = await this.supabase.rpc('get_customer_trust_score', {
        p_tenant_id: this.tenantId,
        p_lead_id: null,
        p_phone_number: this.phoneNumber,
      });

      if (trustResult) {
        const trustScore = trustResult.trust_score ?? 70;
        const isVip = trustResult.is_vip ?? false;
        const isBlocked = trustResult.is_blocked ?? false;

        // Determine trust level
        let trustLevel: TrustVerificationResult['trustLevel'];
        if (isBlocked) {
          trustLevel = 'blocked';
        } else if (isVip) {
          trustLevel = 'vip';
        } else if (trustScore >= 80) {
          trustLevel = 'trusted';
        } else if (trustScore >= 50) {
          trustLevel = 'normal';
        } else {
          trustLevel = 'risky';
        }

        // Determine action
        let action: TrustVerificationResult['action'];
        if (isBlocked) {
          action = 'blocked';
        } else if (trustScore >= thresholdConfirmation) {
          action = 'proceed';
        } else if (trustScore >= thresholdDeposit) {
          action = 'require_confirmation';
        } else {
          action = 'require_deposit';
        }

        return {
          trustScore,
          trustLevel,
          action,
          isVip,
          isBlocked,
          blockReason: trustResult.block_reason,
          depositAmountCents: action === 'require_deposit' ? depositAmountCents : undefined,
          leadId: trustResult.lead_id,
        };
      }

      // Default for new customers
      return {
        trustScore: 70,
        trustLevel: 'normal',
        action: 'proceed',
        isVip: false,
        isBlocked: false,
      };
    } catch (error) {
      console.error('[VoiceSecureBooking] Trust verification error:', error);

      // On error, default to proceed (fail-open for better UX)
      return {
        trustScore: 70,
        trustLevel: 'normal',
        action: 'proceed',
        isVip: false,
        isBlocked: false,
      };
    }
  }

  // =====================================================
  // HOLD MANAGEMENT
  // =====================================================

  /**
   * Create a hold for a booking slot
   */
  async createHold(
    date: string,
    time: string,
    durationMinutes: number = 30,
    holdType: 'reservation' | 'appointment' | 'order' = 'appointment',
    metadata?: Record<string, unknown>
  ): Promise<HoldCreationResult> {
    try {
      // Calculate slot times
      const slotDatetime = new Date(`${date}T${time}`);
      const endDatetime = new Date(slotDatetime.getTime() + durationMinutes * 60 * 1000);

      // Validate future date
      if (slotDatetime <= new Date()) {
        return {
          success: false,
          requiresDeposit: false,
          requiresConfirmation: false,
          error: 'Slot in past',
        };
      }

      // Get policy for hold duration and requirements
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('vertical')
        .eq('id', this.tenantId)
        .single();

      const vertical = tenant?.vertical || 'restaurant';

      const { data: policy } = await this.supabase
        .from('vertical_booking_policies')
        .select('hold_duration_minutes, trust_threshold_confirmation, trust_threshold_deposit, deposit_amount_cents, require_confirmation_below_trust, require_deposit_below_trust')
        .eq('tenant_id', this.tenantId)
        .eq('vertical', vertical)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .single();

      const holdDurationMinutes = policy?.hold_duration_minutes ?? 15;
      const expiresAt = new Date(Date.now() + holdDurationMinutes * 60 * 1000);

      // Get trust score for requirements determination
      const trustVerification = await this.verifyCustomerTrust(vertical);

      if (trustVerification.isBlocked) {
        return {
          success: false,
          requiresDeposit: false,
          requiresConfirmation: false,
          error: 'Customer blocked',
        };
      }

      const requiresDeposit = trustVerification.action === 'require_deposit';
      const requiresConfirmation = trustVerification.action === 'require_confirmation';

      // Try RPC first
      const { data: holdResult, error: rpcError } = await this.supabase.rpc('create_booking_hold', {
        p_tenant_id: this.tenantId,
        p_branch_id: this.branchId || null,
        p_lead_id: trustVerification.leadId || null,
        p_phone_number: this.phoneNumber,
        p_hold_type: holdType,
        p_slot_datetime: slotDatetime.toISOString(),
        p_end_datetime: endDatetime.toISOString(),
        p_duration_minutes: durationMinutes,
        p_service_id: null,
        p_source: 'voice',
        p_source_call_id: this.callId,
        p_metadata: {
          ...metadata,
          trust_score_at_hold: trustVerification.trustScore,
          vertical,
        },
      });

      if (!rpcError && holdResult?.success) {
        const holdId = holdResult.hold_id;
        this.activeHolds.set(holdId, slotDatetime.toISOString());

        return {
          success: true,
          holdId,
          expiresAt: holdResult.expires_at || expiresAt.toISOString(),
          expiresInMinutes: Math.round((new Date(holdResult.expires_at || expiresAt).getTime() - Date.now()) / 60000),
          requiresDeposit,
          requiresConfirmation,
          depositAmountCents: requiresDeposit ? trustVerification.depositAmountCents : undefined,
        };
      }

      // Fallback to direct insert
      const { data: insertedHold, error: insertError } = await this.supabase
        .from('booking_holds')
        .insert({
          tenant_id: this.tenantId,
          branch_id: this.branchId || null,
          lead_id: trustVerification.leadId || null,
          phone_number: this.phoneNumber,
          hold_type: holdType,
          slot_datetime: slotDatetime.toISOString(),
          end_datetime: endDatetime.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: 'active',
          trust_score_at_hold: trustVerification.trustScore,
          requires_deposit: requiresDeposit,
          deposit_amount_cents: requiresDeposit ? trustVerification.depositAmountCents : null,
          source: 'voice',
          source_call_id: this.callId,
          metadata: {
            ...metadata,
            vertical,
          },
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[VoiceSecureBooking] Hold insert error:', insertError);
        return {
          success: false,
          requiresDeposit: false,
          requiresConfirmation: false,
          error: insertError.message,
        };
      }

      this.activeHolds.set(insertedHold.id, slotDatetime.toISOString());

      return {
        success: true,
        holdId: insertedHold.id,
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: holdDurationMinutes,
        requiresDeposit,
        requiresConfirmation,
        depositAmountCents: requiresDeposit ? trustVerification.depositAmountCents : undefined,
      };
    } catch (error) {
      console.error('[VoiceSecureBooking] Create hold error:', error);
      return {
        success: false,
        requiresDeposit: false,
        requiresConfirmation: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Release a specific hold
   */
  async releaseHold(holdId: string, reason: string = 'customer_cancelled'): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('booking_holds')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          release_reason: reason,
        })
        .eq('id', holdId)
        .eq('tenant_id', this.tenantId);

      if (!error) {
        this.activeHolds.delete(holdId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[VoiceSecureBooking] Release hold error:', error);
      return false;
    }
  }

  /**
   * Release all holds created during this call session
   * Should be called when the call ends without completing bookings
   */
  async releaseAllSessionHolds(): Promise<number> {
    let releasedCount = 0;

    for (const [holdId] of this.activeHolds) {
      const released = await this.releaseHold(holdId, 'call_ended');
      if (released) {
        releasedCount++;
      }
    }

    return releasedCount;
  }

  // =====================================================
  // BOOKING CONVERSION
  // =====================================================

  /**
   * Convert a hold to a confirmed booking
   */
  async convertHoldToBooking(
    holdId: string,
    additionalData?: {
      customerName?: string;
      customerEmail?: string;
      specialRequests?: string;
      notes?: string;
      depositPaymentId?: string;
    }
  ): Promise<BookingConversionResult> {
    try {
      // Get hold details
      const { data: hold, error: holdError } = await this.supabase
        .from('booking_holds')
        .select('*')
        .eq('id', holdId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (holdError || !hold) {
        return { success: false, error: 'Hold not found' };
      }

      if (hold.status !== 'active') {
        return { success: false, error: `Hold is ${hold.status}` };
      }

      if (new Date(hold.expires_at) < new Date()) {
        await this.supabase
          .from('booking_holds')
          .update({ status: 'expired' })
          .eq('id', holdId);

        return { success: false, error: 'Hold expired' };
      }

      // Check deposit requirement
      if (hold.requires_deposit && !additionalData?.depositPaymentId && !hold.deposit_paid) {
        return { success: false, error: 'Deposit required' };
      }

      // Determine booking type
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('vertical')
        .eq('id', this.tenantId)
        .single();

      const isRestaurant = tenant?.vertical === 'restaurant';
      const bookingType = hold.hold_type === 'reservation' || isRestaurant ? 'reservation' : 'appointment';

      // Extract datetime
      const slotDate = new Date(hold.slot_datetime);
      const date = slotDate.toISOString().split('T')[0];
      const time = slotDate.toTimeString().slice(0, 5);

      // Generate confirmation code
      const confirmationCode = this.generateConfirmationCode(isRestaurant ? 'RES' : 'APT');
      const customerName = additionalData?.customerName || hold.metadata?.customer_name || 'Cliente';

      let bookingId: string;

      if (bookingType === 'reservation') {
        const { data: reservation, error: insertError } = await this.supabase
          .from('reservations')
          .insert({
            tenant_id: this.tenantId,
            branch_id: this.branchId || hold.branch_id || null,
            date,
            time,
            party_size: hold.metadata?.party_size || 2,
            customer_name: customerName,
            customer_phone: hold.phone_number,
            customer_email: additionalData?.customerEmail || null,
            special_requests: additionalData?.specialRequests || null,
            confirmation_code: confirmationCode,
            status: 'confirmed',
            source: 'voice',
            source_call_id: this.callId,
            hold_id: holdId,
            trust_score_at_booking: hold.trust_score_at_hold,
          })
          .select('id')
          .single();

        if (insertError) {
          return { success: false, error: insertError.message };
        }

        bookingId = reservation.id;
      } else {
        const endSlot = new Date(hold.end_datetime);
        const endTime = endSlot.toTimeString().slice(0, 5);

        const { data: appointment, error: insertError } = await this.supabase
          .from('appointments')
          .insert({
            tenant_id: this.tenantId,
            branch_id: this.branchId || hold.branch_id || null,
            date,
            start_time: time,
            end_time: endTime,
            patient_name: customerName,
            patient_phone: hold.phone_number,
            patient_email: additionalData?.customerEmail || null,
            service_id: hold.service_id || null,
            notes: additionalData?.notes || additionalData?.specialRequests || null,
            confirmation_code: confirmationCode,
            status: 'confirmed',
            source: 'voice',
            source_call_id: this.callId,
            hold_id: holdId,
            trust_score_at_booking: hold.trust_score_at_hold,
          })
          .select('id')
          .single();

        if (insertError) {
          return { success: false, error: insertError.message };
        }

        bookingId = appointment.id;
      }

      // Update hold status
      await this.supabase
        .from('booking_holds')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          converted_to_id: bookingId,
          converted_to_type: bookingType,
        })
        .eq('id', holdId);

      // Remove from active holds tracking
      this.activeHolds.delete(holdId);

      // Update trust score (reward)
      if (hold.lead_id) {
        await this.supabase.rpc('update_trust_score', {
          p_lead_id: hold.lead_id,
          p_delta: 2,
          p_reason: 'booking_completed',
          p_reference_id: bookingId,
        });
      }

      return {
        success: true,
        bookingId,
        confirmationCode,
        bookingType,
      };
    } catch (error) {
      console.error('[VoiceSecureBooking] Convert hold error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =====================================================
  // AVAILABILITY CHECKING
  // =====================================================

  /**
   * Check if a slot is available (considering holds and bookings)
   */
  async checkAvailability(
    date: string,
    time: string,
    durationMinutes: number = 30
  ): Promise<{ available: boolean; reason?: string }> {
    try {
      const slotStart = new Date(`${date}T${time}`);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

      // Check for active holds
      const { data: holds } = await this.supabase
        .from('booking_holds')
        .select('id')
        .eq('tenant_id', this.tenantId)
        .eq('status', 'active')
        .lte('slot_datetime', slotEnd.toISOString())
        .gte('end_datetime', slotStart.toISOString())
        .limit(1);

      if (holds && holds.length > 0) {
        return { available: false, reason: 'held' };
      }

      return { available: true };
    } catch (error) {
      console.error('[VoiceSecureBooking] Check availability error:', error);
      return { available: true }; // Fail-open
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private generateConfirmationCode(prefix: string = 'TIS'): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${code}`;
  }

  /**
   * Get count of active holds for this session
   */
  getActiveHoldsCount(): number {
    return this.activeHolds.size;
  }

  /**
   * Get all active hold IDs for this session
   */
  getActiveHoldIds(): string[] {
    return Array.from(this.activeHolds.keys());
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create a new VoiceSecureBookingService instance
 */
export function createVoiceSecureBookingService(
  context: SecureBookingContext
): VoiceSecureBookingService {
  return new VoiceSecureBookingService(context);
}

export default VoiceSecureBookingService;
