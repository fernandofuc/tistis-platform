// =====================================================
// TIS TIS PLATFORM - Restaurant Tables Service
// API client for tables management system
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  RestaurantTable,
  TableFormData,
  TableFilters,
  TableStats,
  TablesResponse,
  TableResponse,
  TableStatus,
  TableAvailabilityResponse,
} from '../types';

// ======================
// HELPER
// ======================
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// ======================
// GET TABLES
// ======================
export async function getTables(filters: TableFilters = {}): Promise<TablesResponse> {
  const params = new URLSearchParams();

  if (filters.branch_id) params.set('branch_id', filters.branch_id);
  if (filters.zone) params.set('zone', filters.zone);
  if (filters.status) params.set('status', filters.status);
  if (filters.min_capacity) params.set('min_capacity', filters.min_capacity.toString());
  if (filters.is_outdoor !== undefined) params.set('is_outdoor', filters.is_outdoor.toString());
  if (filters.is_accessible !== undefined) params.set('is_accessible', filters.is_accessible.toString());
  if (filters.search) params.set('search', filters.search);

  const queryString = params.toString();
  const url = `/api/restaurant/tables${queryString ? `?${queryString}` : ''}`;

  return fetchWithAuth(url);
}

// ======================
// GET SINGLE TABLE
// ======================
export async function getTable(id: string): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${id}`);
}

// ======================
// CREATE TABLE
// ======================
export async function createTable(data: TableFormData, branchId: string): Promise<TableResponse> {
  return fetchWithAuth('/api/restaurant/tables', {
    method: 'POST',
    body: JSON.stringify({ ...data, branch_id: branchId }),
  });
}

// ======================
// UPDATE TABLE
// ======================
export async function updateTable(id: string, data: Partial<TableFormData>): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ======================
// DELETE TABLE (soft delete)
// ======================
export async function deleteTable(id: string): Promise<{ success: boolean }> {
  return fetchWithAuth(`/api/restaurant/tables/${id}`, {
    method: 'DELETE',
  });
}

// ======================
// UPDATE TABLE STATUS
// ======================
export async function updateTableStatus(id: string, status: TableStatus): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ======================
// GET TABLE STATS
// ======================
export async function getTableStats(branchId?: string): Promise<{ success: boolean; data: TableStats }> {
  const url = branchId
    ? `/api/restaurant/tables/stats?branch_id=${branchId}`
    : '/api/restaurant/tables/stats';
  return fetchWithAuth(url);
}

// ======================
// GET AVAILABLE TABLES
// ======================
export async function getAvailableTables(
  branchId: string,
  date: string,
  time: string,
  partySize: number,
  durationMinutes: number = 120
): Promise<TableAvailabilityResponse> {
  const params = new URLSearchParams({
    branch_id: branchId,
    date,
    time,
    party_size: partySize.toString(),
    duration_minutes: durationMinutes.toString(),
  });

  return fetchWithAuth(`/api/restaurant/tables/availability?${params}`);
}

// ======================
// BULK UPDATE TABLES ORDER
// ======================
export async function updateTablesOrder(
  updates: Array<{ id: string; display_order: number }>
): Promise<{ success: boolean }> {
  return fetchWithAuth('/api/restaurant/tables/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  });
}

// ======================
// TOGGLE TABLE ACTIVE
// ======================
export async function toggleTableActive(id: string, isActive: boolean): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  });
}

// ======================
// COMBINE TABLES
// ======================
export async function combineTables(
  tableId: string,
  combineWithIds: string[]
): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${tableId}/combine`, {
    method: 'POST',
    body: JSON.stringify({ combine_with: combineWithIds }),
  });
}

// ======================
// UNCOMBINE TABLES
// ======================
export async function uncombineTables(tableId: string): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${tableId}/combine`, {
    method: 'DELETE',
  });
}

// ======================
// GET TABLE RESERVATIONS FOR DATE
// ======================
export async function getTableReservations(
  tableId: string,
  date: string
): Promise<{
  success: boolean;
  data: Array<{
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    party_size: number;
    guest_name: string;
    status: string;
    arrival_status: string;
  }>;
}> {
  const params = new URLSearchParams({ date });
  return fetchWithAuth(`/api/restaurant/tables/${tableId}/reservations?${params}`);
}

// ======================
// UPDATE TABLE POSITION (for floor plan editor)
// ======================
export async function updateTablePosition(
  id: string,
  positionX: number,
  positionY: number
): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ position_x: positionX, position_y: positionY }),
  });
}

// ======================
// DUPLICATE TABLE
// ======================
export async function duplicateTable(id: string, newTableNumber: string): Promise<TableResponse> {
  return fetchWithAuth(`/api/restaurant/tables/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ table_number: newTableNumber }),
  });
}

// ======================
// BULK CREATE TABLES
// ======================
export async function bulkCreateTables(
  branchId: string,
  startNumber: number,
  count: number,
  defaults: Partial<TableFormData>
): Promise<TablesResponse> {
  return fetchWithAuth('/api/restaurant/tables/bulk', {
    method: 'POST',
    body: JSON.stringify({
      branch_id: branchId,
      start_number: startNumber,
      count,
      defaults,
    }),
  });
}
