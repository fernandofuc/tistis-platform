// =====================================================
// TIS TIS PLATFORM - Check Slot Availability API
// POST: Check if a slot is available (no active holds or appointments)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
} from '@/src/lib/api/auth-helper';

function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// ======================
// POST - Check Availability
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const { branch_id, slot_datetime, duration_minutes } = body;

    // Validate required fields
    if (!branch_id || !isValidUUID(branch_id as string)) {
      return errorResponse('branch_id requerido y valido', 400);
    }

    if (!slot_datetime) {
      return errorResponse('slot_datetime requerido', 400);
    }

    // Validate slot_datetime format
    const slotStart = new Date(slot_datetime as string);
    if (isNaN(slotStart.getTime())) {
      return errorResponse('slot_datetime debe ser una fecha valida en formato ISO', 400);
    }

    const duration = sanitizeNumber(duration_minutes, 5, 480, 30);
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    // Check if slot is in the past
    if (slotStart <= new Date()) {
      return successResponse({
        available: false,
        reason: 'La fecha y hora debe ser en el futuro',
      });
    }

    // Check for active holds in this time range
    const { data: activeHolds, error: holdsError } = await supabase
      .from('booking_holds')
      .select('id, slot_datetime, end_datetime')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branch_id)
      .eq('status', 'active')
      .lte('slot_datetime', slotEnd.toISOString())
      .gte('end_datetime', slotStart.toISOString())
      .limit(1);

    if (holdsError) {
      console.error('[holds/check-availability] Holds error:', holdsError);
      return errorResponse('Error al verificar holds', 500);
    }

    if (activeHolds && activeHolds.length > 0) {
      return successResponse({
        available: false,
        reason: 'Este horario ya está siendo reservado por otra persona',
        conflicting_hold_id: activeHolds[0].id,
      });
    }

    // Check for existing appointments in this time range
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branch_id)
      .not('status', 'in', '("cancelled","rescheduled")')
      .lte('scheduled_at', slotEnd.toISOString())
      .limit(10); // Get a few to filter manually

    if (apptError) {
      console.error('[holds/check-availability] Appointments error:', apptError);
      return errorResponse('Error al verificar citas', 500);
    }

    // Check for overlap with appointments
    for (const appt of appointments || []) {
      const apptStart = new Date(appt.scheduled_at);
      const apptEnd = new Date(apptStart.getTime() + (appt.duration_minutes || 30) * 60 * 1000);

      // Check overlap: (start1, end1) overlaps (start2, end2) if start1 < end2 && end1 > start2
      if (slotStart < apptEnd && slotEnd > apptStart) {
        return successResponse({
          available: false,
          reason: 'Este horario ya está ocupado por otra cita',
          conflicting_appointment_id: appt.id,
        });
      }
    }

    return successResponse({
      available: true,
    });

  } catch (error) {
    console.error('[holds/check-availability] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
