// =====================================================
// TIS TIS PLATFORM - Restaurant Tables API
// GET: List tables, POST: Create table
// Security: H1-H12 hardening applied
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite,
  isValidUUID,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, sanitizeInteger, isSafeKey, LIMITS } from '@/src/lib/api/sanitization-helper';

// Constants for tables
const MAX_TABLES_PER_PAGE = 200; // H5: Pagination limit
const MAX_CAPACITY = 100; // H7: Reasonable max capacity
const MAX_FEATURES = 20; // H6: Limit features array
const MAX_COMBINABLE = 50; // H12: Limit combinable_with array
const MAX_ZONES_IN_STATS = 50; // H20: Limit zones in stats object
const MAX_DISPLAY_ORDER = 2147483640; // H17: Safe max before INT overflow
const VALID_STATUSES = ['available', 'occupied', 'reserved', 'unavailable', 'maintenance']; // H8: Enum validation
const VALID_ZONES = ['main', 'terrace', 'bar', 'vip', 'private', 'outdoor', 'patio', 'garden']; // Zone enum

// H1/H21: Sanitize search pattern for ilike (escape special SQL/regex chars)
// H21: Single regex instead of chained replaces for better performance
function sanitizeSearchPattern(search: string): string {
  // Single pass sanitization to avoid ReDoS
  const sanitized = search.slice(0, 100).replace(/[\x00%_\\'"<>]/g, '').trim();
  return sanitized;
}

// H6/H13: Sanitize features array with prototype pollution protection
function sanitizeFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  const result: string[] = [];
  for (const f of features) {
    // H13: Strict type check - reject anything that's not a primitive string
    if (typeof f !== 'string') continue;
    // H13: Check for prototype pollution attempts in string content
    if (f.includes('__proto__') || f.includes('constructor') || f.includes('prototype')) continue;
    const sanitized = sanitizeText(f, 50);
    if (sanitized && sanitized.length > 0) {
      result.push(sanitized);
    }
    if (result.length >= MAX_FEATURES) break;
  }
  return result;
}

// H12: Sanitize combinable_with array (must be valid UUIDs)
function sanitizeCombinableWith(ids: unknown): string[] | null {
  if (!ids) return null;
  if (!Array.isArray(ids)) return null;
  return ids
    .filter((id): id is string => typeof id === 'string' && isValidUUID(id))
    .slice(0, MAX_COMBINABLE);
}

// ======================
// GET - List Tables (H11: Using centralized auth helper)
// ======================
export async function GET(request: NextRequest) {
  try {
    // H11: Use centralized auth helper
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const tenantId = userRole.tenant_id;

    // Parse query params with validation
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branch_id');
    const zone = searchParams.get('zone');
    const status = searchParams.get('status');
    const minCapacity = searchParams.get('min_capacity');
    const isOutdoor = searchParams.get('is_outdoor');
    const isAccessible = searchParams.get('is_accessible');
    const search = searchParams.get('search');

    // H2: Validate UUID parameters
    if (branchId && !isValidUUID(branchId)) {
      return errorResponse('branch_id inválido', 400);
    }

    // H8: Validate status enum
    if (status && !VALID_STATUSES.includes(status)) {
      return errorResponse('status inválido', 400);
    }

    // H8: Validate zone (allow custom zones but sanitize)
    const sanitizedZone = zone ? sanitizeText(zone, 50) : null;

    // Build query with H5: pagination limit
    let query = supabase
      .from('restaurant_tables')
      .select(`
        *,
        branch:branches(id, name)
      `)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('table_number', { ascending: true })
      .limit(MAX_TABLES_PER_PAGE); // H5: Pagination limit

    // Apply filters
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (sanitizedZone) {
      query = query.eq('zone', sanitizedZone);
    }
    if (status) {
      query = query.eq('status', status);
    }
    // H4: Safe parseInt with validation
    if (minCapacity) {
      const minCap = sanitizeInteger(minCapacity, 1, MAX_CAPACITY, -1);
      if (minCap !== undefined && minCap > 0) {
        query = query.gte('max_capacity', minCap);
      }
    }
    if (isOutdoor === 'true') {
      query = query.eq('is_outdoor', true);
    }
    if (isAccessible === 'true') {
      query = query.eq('is_accessible', true);
    }
    // H1: Sanitize search pattern
    if (search) {
      const safeSearch = sanitizeSearchPattern(search);
      if (safeSearch) {
        query = query.or(`table_number.ilike.%${safeSearch}%,name.ilike.%${safeSearch}%`);
      }
    }

    const { data: tables, error: tablesError } = await query;

    if (tablesError) {
      console.error('Error fetching tables:', JSON.stringify(tablesError));
      return errorResponse('Error al cargar mesas', 500);
    }

    // Calculate stats
    const allTables = tables || [];
    const stats = {
      total: allTables.filter((t: { is_active: boolean }) => t.is_active).length,
      available: allTables.filter((t: { status: string; is_active: boolean }) => t.status === 'available' && t.is_active).length,
      occupied: allTables.filter((t: { status: string; is_active: boolean }) => t.status === 'occupied' && t.is_active).length,
      reserved: allTables.filter((t: { status: string; is_active: boolean }) => t.status === 'reserved' && t.is_active).length,
      unavailable: allTables.filter((t: { status: string; is_active: boolean }) => t.status === 'unavailable' && t.is_active).length,
      maintenance: allTables.filter((t: { status: string; is_active: boolean }) => t.status === 'maintenance' && t.is_active).length,
      total_capacity: allTables.filter((t: { is_active: boolean }) => t.is_active).reduce((sum: number, t: { max_capacity: number }) => sum + t.max_capacity, 0),
      occupancy_rate: 0,
      zones: {} as Record<string, number>,
    };

    // Calculate occupancy rate
    const activeOccupied = stats.occupied + stats.reserved;
    stats.occupancy_rate = stats.total > 0 ? Math.round((activeOccupied / stats.total) * 100) : 0;

    // Group by zone (H20: Limit number of unique zones to prevent object explosion)
    let zoneCount = 0;
    allTables.forEach((t: { is_active: boolean; zone: string }) => {
      if (t.is_active) {
        // H20: Only add new zones if under limit
        if (stats.zones[t.zone] !== undefined) {
          stats.zones[t.zone] = stats.zones[t.zone] + 1;
        } else if (zoneCount < MAX_ZONES_IN_STATS) {
          stats.zones[t.zone] = 1;
          zoneCount++;
        }
        // If over limit, zone is silently ignored in stats
      }
    });

    // H9: Optimized reservation fetch - batch query instead of N+1
    // H16: Use UTC date range that covers full day in any timezone (-12 to +14)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    // Extend window to cover timezone differences (up to 14 hours ahead)
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);
    todayEnd.setTime(todayEnd.getTime() + 14 * 60 * 60 * 1000); // +14 hours

    // Single query for all reservations
    // H15: Only fetch necessary fields, avoid sensitive PII where possible
    const { data: allReservations } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        status,
        lead:leads(full_name),
        restaurant_details:appointment_restaurant_details(
          table_id,
          party_size,
          arrival_status,
          occasion_type
        )
      `)
      .eq('tenant_id', tenantId)
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .not('status', 'in', '("cancelled","no_show")')
      .order('scheduled_at', { ascending: true });

    // Build reservation map by table_id
    // H15: Sanitize/mask sensitive data before sending to client
    const reservationsByTable = new Map<string, unknown>();
    (allReservations || []).forEach((r: { restaurant_details: unknown; lead: unknown; id: string; scheduled_at: string }) => {
      const details = r.restaurant_details as { table_id?: string; party_size?: number; arrival_status?: string; occasion_type?: string } | null;
      const tableId = details?.table_id;
      if (tableId && !reservationsByTable.has(tableId)) {
        const lead = r.lead as { full_name?: string } | null;
        // H15: Mask guest name to first name + initial only
        const fullName = lead?.full_name || 'Reservación';
        const nameParts = fullName.split(' ');
        const maskedName = nameParts.length > 1
          ? `${nameParts[0]} ${nameParts[1]?.charAt(0) || ''}.`
          : nameParts[0];

        reservationsByTable.set(tableId, {
          id: r.id,
          guest_name: maskedName,
          party_size: details?.party_size || 0,
          scheduled_at: r.scheduled_at,
          arrival_status: details?.arrival_status || 'pending',
          occasion_type: details?.occasion_type,
          // H15: Removed special_requests from list view (contains sensitive info)
        });
      }
    });

    // Map tables with reservations
    const tablesWithReservations = allTables.map((table: { id: string }) => ({
      ...table,
      current_reservation: reservationsByTable.get(table.id) || null,
    }));

    return successResponse({
      tables: tablesWithReservations,
      stats,
    });

  } catch (error: unknown) {
    console.error('Tables API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    return errorResponse(`Error interno: ${errorMessage}`, 500);
  }
}

// ======================
// POST - Create Table (H11: Using centralized auth helper)
// ======================
export async function POST(request: NextRequest) {
  try {
    // H11: Use centralized auth helper
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions using canWrite helper
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear mesas', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();

    // H2: Validate required UUIDs
    const branch_id = body.branch_id;
    if (!branch_id) {
      return errorResponse('branch_id es requerido', 400);
    }
    if (!isValidUUID(branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    // H3: Sanitize text fields
    const table_number = sanitizeText(body.table_number, 20);
    if (!table_number) {
      return errorResponse('table_number es requerido', 400);
    }

    const name = body.name ? sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM) : null;
    const zone = sanitizeText(body.zone, 50) || 'main';

    // H7: Validate and sanitize capacity with range check
    const minCapRaw = sanitizeInteger(body.min_capacity, 1, MAX_CAPACITY, 1);
    const maxCapRaw = sanitizeInteger(body.max_capacity, 1, MAX_CAPACITY, 4);
    const min_capacity = minCapRaw ?? 1;
    const max_capacity = maxCapRaw ?? 4;

    // H7: Ensure min <= max
    if (min_capacity > max_capacity) {
      return errorResponse('min_capacity no puede ser mayor que max_capacity', 400);
    }

    // Sanitize other numeric fields
    const floor = sanitizeInteger(body.floor, -10, 100, 1) ?? 1;
    const position_x = body.position_x !== undefined ? sanitizeInteger(body.position_x, 0, 10000, 0) : null;
    const position_y = body.position_y !== undefined ? sanitizeInteger(body.position_y, 0, 10000, 0) : null;
    const priority = sanitizeInteger(body.priority, 0, 1000, 0) ?? 0;

    // Boolean fields
    const is_outdoor = Boolean(body.is_outdoor);
    const is_accessible = body.is_accessible !== false; // Default true
    const is_high_top = Boolean(body.is_high_top);
    const has_power_outlet = Boolean(body.has_power_outlet);
    const can_combine = body.can_combine !== false; // Default true
    const is_active = body.is_active !== false; // Default true

    // H6: Sanitize features array
    const features = sanitizeFeatures(body.features);

    // H12: Sanitize combinable_with array (UUIDs only)
    const rawCombinableWith = sanitizeCombinableWith(body.combinable_with);

    // Verify branch belongs to tenant
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branch_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!branch) {
      return errorResponse('Sucursal no encontrada', 404);
    }

    // Check if table_number already exists in this branch
    const { data: existingTable } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('table_number', table_number)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingTable) {
      return errorResponse('Ya existe una mesa con ese número en esta sucursal', 409);
    }

    // H18: Validate combinable_with - ensure all referenced tables exist in same tenant
    let combinable_with: string[] | null = null;
    if (rawCombinableWith && rawCombinableWith.length > 0) {
      const { data: validTables } = await supabase
        .from('restaurant_tables')
        .select('id')
        .in('id', rawCombinableWith)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      // Only keep IDs that exist and belong to this tenant
      const validIds = new Set(validTables?.map((t: { id: string }) => t.id) || []);
      combinable_with = rawCombinableWith.filter(id => validIds.has(id));
      if (combinable_with.length === 0) combinable_with = null;
    }

    // Get max display_order (H17: Check for overflow)
    const { data: maxOrderResult } = await supabase
      .from('restaurant_tables')
      .select('display_order')
      .eq('branch_id', branch_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    // H17: Prevent integer overflow - reset to 1 if approaching max
    const currentMax = maxOrderResult?.display_order || 0;
    const nextOrder = currentMax >= MAX_DISPLAY_ORDER ? 1 : currentMax + 1;

    // Insert table with sanitized values
    const { data: newTable, error: insertError } = await supabase
      .from('restaurant_tables')
      .insert({
        tenant_id: tenantId,
        branch_id,
        table_number,
        name,
        min_capacity,
        max_capacity,
        zone,
        floor,
        position_x,
        position_y,
        is_outdoor,
        is_accessible,
        is_high_top,
        has_power_outlet,
        features,
        can_combine,
        combinable_with,
        status: 'available', // H8: Always start as available
        priority,
        is_active,
        display_order: nextOrder,
      })
      .select(`
        *,
        branch:branches(id, name)
      `)
      .single();

    if (insertError) {
      console.error('Error creating table:', JSON.stringify(insertError));
      if (insertError.code === '23505') {
        return errorResponse('Ya existe una mesa con ese número', 409);
      }
      return errorResponse('Error al crear mesa', 500);
    }

    return successResponse(newTable);

  } catch (error: unknown) {
    console.error('Create table error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    return errorResponse(`Error interno: ${errorMessage}`, 500);
  }
}
