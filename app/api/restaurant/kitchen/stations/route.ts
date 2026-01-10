// =====================================================
// TIS TIS PLATFORM - Kitchen Stations API
// GET: List stations, POST: Create station
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
  canWrite,
} from '@/src/lib/api/auth-helper';

// Valid station types
const VALID_STATION_TYPES = ['main', 'grill', 'fry', 'salad', 'sushi', 'pizza', 'dessert', 'bar', 'expeditor', 'prep', 'assembly'] as const;

// Sanitize text to prevent XSS
function sanitizeText(text: unknown, maxLength = 500): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  const sanitized = text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  return sanitized.slice(0, maxLength) || null;
}

// Validate hex color
function sanitizeColor(color: unknown): string {
  if (typeof color !== 'string') return '#3B82F6';
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexRegex.test(color) ? color : '#3B82F6';
}

// Validate IP address
function sanitizeIP(ip: unknown): string | null {
  if (typeof ip !== 'string' || !ip) return null;
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip) ? ip : null;
}

// ======================
// GET - List Stations
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    const { data: stations, error } = await supabase
      .from('kitchen_stations')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching stations:', error);
      return errorResponse('Error al obtener estaciones', 500);
    }

    return successResponse(stations);

  } catch (error) {
    console.error('Get stations error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Station
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear estaciones', 403);
    }

    const body = await request.json();
    const {
      branch_id,
      code,
      name,
      description,
      station_type,
      handles_categories,
      printer_name,
      printer_ip,
      display_color,
      is_active,
      default_staff_ids,
    } = body;

    if (!branch_id || !isValidUUID(branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    // Sanitize inputs
    const sanitizedCode = sanitizeText(code, 50);
    const sanitizedName = sanitizeText(name, 100);

    if (!sanitizedCode || !sanitizedName) {
      return errorResponse('code y name son requeridos', 400);
    }

    // Validate station_type
    const validStationType = VALID_STATION_TYPES.includes(station_type) ? station_type : 'prep';

    // Sanitize other fields
    const sanitizedDescription = sanitizeText(description, 500);
    const sanitizedPrinterName = sanitizeText(printer_name, 100);
    const sanitizedPrinterIP = sanitizeIP(printer_ip);
    const sanitizedDisplayColor = sanitizeColor(display_color);

    // Validate handles_categories (array of UUIDs)
    const validCategories = Array.isArray(handles_categories)
      ? handles_categories.filter((id: unknown) => typeof id === 'string' && isValidUUID(id)).slice(0, 50)
      : [];

    // Validate default_staff_ids (array of UUIDs)
    const validStaffIds = Array.isArray(default_staff_ids)
      ? default_staff_ids.filter((id: unknown) => typeof id === 'string' && isValidUUID(id)).slice(0, 20)
      : [];

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('kitchen_stations')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('code', sanitizedCode)
      .is('deleted_at', null)
      .single();

    if (existing) {
      return errorResponse('Ya existe una estación con ese código', 400);
    }

    // Get next display order
    const { data: lastStation } = await supabase
      .from('kitchen_stations')
      .select('display_order')
      .eq('branch_id', branch_id)
      .is('deleted_at', null)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const displayOrder = (lastStation?.display_order || 0) + 1;

    const { data: station, error } = await supabase
      .from('kitchen_stations')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        code: sanitizedCode,
        name: sanitizedName,
        description: sanitizedDescription,
        station_type: validStationType,
        handles_categories: validCategories,
        printer_name: sanitizedPrinterName,
        printer_ip: sanitizedPrinterIP,
        display_color: sanitizedDisplayColor,
        display_order: displayOrder,
        is_active: is_active !== false,
        default_staff_ids: validStaffIds,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating station:', error);
      return errorResponse('Error al crear estación', 500);
    }

    return successResponse(station, 201);

  } catch (error) {
    console.error('Create station error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
