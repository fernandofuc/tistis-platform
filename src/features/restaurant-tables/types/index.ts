// =====================================================
// TIS TIS PLATFORM - Restaurant Tables Types
// Type definitions for the tables management system
// =====================================================

// ======================
// TABLE STATUS
// ======================
export type TableStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'unavailable'
  | 'maintenance';

// ======================
// TABLE ZONES
// ======================
export type TableZone =
  | 'main'
  | 'terrace'
  | 'private'
  | 'bar'
  | 'vip'
  | 'outdoor'
  | 'garden'
  | 'rooftop';

// ======================
// TABLE FEATURES
// ======================
export type TableFeature =
  | 'window_view'
  | 'booth'
  | 'quiet_corner'
  | 'near_kitchen'
  | 'near_bar'
  | 'accessible'
  | 'romantic'
  | 'family_friendly'
  | 'power_outlet'
  | 'wifi_zone';

// ======================
// MAIN TABLE INTERFACE
// ======================
export interface RestaurantTable {
  id: string;
  tenant_id: string;
  branch_id: string;
  table_number: string;
  name: string | null;
  min_capacity: number;
  max_capacity: number;
  zone: TableZone;
  floor: number;
  position_x: number | null;
  position_y: number | null;
  is_outdoor: boolean;
  is_accessible: boolean;
  is_high_top: boolean;
  has_power_outlet: boolean;
  features: TableFeature[];
  can_combine: boolean;
  combinable_with: string[] | null;
  status: TableStatus;
  priority: number;
  is_active: boolean;
  display_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined data
  branch?: {
    id: string;
    name: string;
  };
  current_reservation?: CurrentReservation | null;
}

// ======================
// CURRENT RESERVATION (for real-time display)
// ======================
export interface CurrentReservation {
  id: string;
  guest_name: string;
  party_size: number;
  scheduled_at: string;
  arrival_status: ArrivalStatus;
  occasion_type?: string | null;
  special_requests?: string | null;
}

export type ArrivalStatus =
  | 'pending'
  | 'confirmed'
  | 'en_route'
  | 'arrived'
  | 'seated'
  | 'dining'
  | 'finished'
  | 'no_show';

// ======================
// TABLE FORM DATA
// ======================
export interface TableFormData {
  table_number: string;
  name?: string;
  min_capacity: number;
  max_capacity: number;
  zone: TableZone;
  floor: number;
  position_x?: number;
  position_y?: number;
  is_outdoor: boolean;
  is_accessible: boolean;
  is_high_top: boolean;
  has_power_outlet: boolean;
  features: TableFeature[];
  can_combine: boolean;
  combinable_with?: string[];
  priority: number;
  is_active: boolean;
}

// ======================
// TABLE FILTERS
// ======================
export interface TableFilters {
  branch_id?: string;
  zone?: TableZone;
  status?: TableStatus;
  min_capacity?: number;
  is_outdoor?: boolean;
  is_accessible?: boolean;
  search?: string;
}

// ======================
// TABLE STATS
// ======================
export interface TableStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  unavailable: number;
  maintenance: number;
  total_capacity: number;
  occupancy_rate: number;
  zones: Record<TableZone, number>;
}

// ======================
// UPCOMING RESERVATION
// ======================
export interface UpcomingReservation {
  id: string;
  date: string;
  time: string;
  end_time: string;
  guest_name: string;
  party_size: number;
  status: string;
  occasion_type?: string;
}

// ======================
// TABLE WITH AVAILABILITY
// ======================
export interface TableWithAvailability extends RestaurantTable {
  upcoming_reservations: UpcomingReservation[];
}

// ======================
// API RESPONSE TYPES
// ======================
export interface TablesResponse {
  success: boolean;
  data: {
    tables: RestaurantTable[];
    stats: TableStats;
  };
  error?: string;
}

export interface TableResponse {
  success: boolean;
  data: RestaurantTable;
  error?: string;
}

export interface TableAvailabilityResponse {
  success: boolean;
  data: {
    table_id: string;
    table_number: string;
    table_name: string | null;
    max_capacity: number;
    zone: TableZone;
    features: TableFeature[];
  }[];
  error?: string;
}

// ======================
// ZONE CONFIGURATION
// ======================
export const ZONE_CONFIG: Record<TableZone, { label: string; icon: string; color: string }> = {
  main: { label: 'Salón Principal', icon: 'building', color: 'slate' },
  terrace: { label: 'Terraza', icon: 'sun', color: 'amber' },
  private: { label: 'Privado', icon: 'lock', color: 'purple' },
  bar: { label: 'Barra', icon: 'wine', color: 'rose' },
  vip: { label: 'VIP', icon: 'star', color: 'yellow' },
  outdoor: { label: 'Exterior', icon: 'tree', color: 'green' },
  garden: { label: 'Jardín', icon: 'flower', color: 'emerald' },
  rooftop: { label: 'Rooftop', icon: 'cloud', color: 'sky' },
};

// ======================
// STATUS CONFIGURATION
// ======================
export const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bgColor: string }> = {
  available: { label: 'Disponible', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  occupied: { label: 'Ocupada', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  reserved: { label: 'Reservada', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  unavailable: { label: 'No Disponible', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  maintenance: { label: 'Mantenimiento', color: 'text-red-700', bgColor: 'bg-red-50' },
};

// ======================
// FEATURE LABELS
// ======================
export const FEATURE_LABELS: Record<TableFeature, string> = {
  window_view: 'Vista a ventana',
  booth: 'Booth/Cabina',
  quiet_corner: 'Rincón tranquilo',
  near_kitchen: 'Cerca de cocina',
  near_bar: 'Cerca del bar',
  accessible: 'Accesible',
  romantic: 'Romántico',
  family_friendly: 'Para familias',
  power_outlet: 'Enchufe eléctrico',
  wifi_zone: 'Zona WiFi',
};
