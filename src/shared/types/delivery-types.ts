// =====================================================
// TIS TIS PLATFORM - Delivery System Types
// Tipos para el sistema de delivery de restaurantes
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/shared/types/unified-assistant-types.ts (TenantServiceOptions)
// =====================================================

// ======================
// DELIVERY STATUS
// ======================

/**
 * Estados de delivery
 * SINCRONIZADO CON: 156_DELIVERY_SYSTEM.sql CHECK constraint
 */
export type DeliveryStatus =
  | 'pending_assignment' // Esperando asignacion de repartidor
  | 'driver_assigned' // Repartidor asignado, pendiente pickup
  | 'driver_arrived' // Repartidor llego al restaurante
  | 'picked_up' // Pedido recogido por repartidor
  | 'in_transit' // En camino al cliente
  | 'arriving' // Llegando al destino (< 2 min)
  | 'delivered' // Entregado exitosamente
  | 'failed' // Entrega fallida
  | 'returned'; // Devuelto al restaurante

/**
 * Array de estados para validacion runtime
 */
export const DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending_assignment',
  'driver_assigned',
  'driver_arrived',
  'picked_up',
  'in_transit',
  'arriving',
  'delivered',
  'failed',
  'returned',
];

/**
 * Transiciones de estado validas
 */
export const DELIVERY_STATUS_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending_assignment: ['driver_assigned', 'failed'],
  driver_assigned: ['driver_arrived', 'picked_up', 'failed'],
  driver_arrived: ['picked_up', 'failed'],
  picked_up: ['in_transit', 'failed', 'returned'],
  in_transit: ['arriving', 'delivered', 'failed', 'returned'],
  arriving: ['delivered', 'failed', 'returned'],
  delivered: [], // Estado final
  failed: ['pending_assignment'], // Puede reintentar
  returned: [], // Estado final
};

/**
 * Informacion de display para estados
 */
export const DELIVERY_STATUS_INFO: Record<
  DeliveryStatus,
  {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    icon: string;
  }
> = {
  pending_assignment: {
    label: 'Esperando repartidor',
    description: 'Buscando repartidor disponible',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: 'clock',
  },
  driver_assigned: {
    label: 'Repartidor asignado',
    description: 'El repartidor va en camino al restaurante',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'user-check',
  },
  driver_arrived: {
    label: 'Repartidor en restaurante',
    description: 'Esperando que la orden este lista',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'map-pin',
  },
  picked_up: {
    label: 'Recogido',
    description: 'El repartidor tiene tu pedido',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    icon: 'package',
  },
  in_transit: {
    label: 'En camino',
    description: 'Tu pedido esta en camino',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: 'truck',
  },
  arriving: {
    label: 'Llegando',
    description: 'El repartidor esta por llegar',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: 'navigation',
  },
  delivered: {
    label: 'Entregado',
    description: 'Pedido entregado exitosamente',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'check-circle',
  },
  failed: {
    label: 'Fallido',
    description: 'No se pudo entregar el pedido',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'x-circle',
  },
  returned: {
    label: 'Devuelto',
    description: 'El pedido fue devuelto al restaurante',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: 'rotate-ccw',
  },
};

// ======================
// DELIVERY ADDRESS
// ======================

/**
 * Coordenadas GPS
 */
export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number; // Precision en metros
}

/**
 * Direccion de entrega completa
 * SINCRONIZADO CON: restaurant_orders.delivery_address JSONB
 */
export interface DeliveryAddress {
  /** Calle */
  street: string;

  /** Numero exterior */
  exterior_number: string;

  /** Numero interior (depto, piso, etc) */
  interior_number?: string;

  /** Colonia/Barrio */
  colony: string;

  /** Ciudad */
  city: string;

  /** Codigo postal */
  postal_code: string;

  /** Estado/Provincia */
  state?: string;

  /** Referencia para encontrar la direccion */
  reference?: string;

  /** Telefono de contacto para la entrega */
  contact_phone: string;

  /** Nombre de quien recibe */
  contact_name: string;

  /** Coordenadas GPS */
  coordinates?: Coordinates;
}

/**
 * Valida que una direccion tenga los campos minimos
 */
export function isValidDeliveryAddress(
  address: Partial<DeliveryAddress>
): address is DeliveryAddress {
  return !!(
    address.street &&
    address.exterior_number &&
    address.colony &&
    address.city &&
    address.postal_code &&
    address.contact_phone &&
    address.contact_name
  );
}

// ======================
// DELIVERY DRIVER
// ======================

/**
 * Tipos de vehiculo
 */
export type VehicleType = 'motorcycle' | 'bicycle' | 'car' | 'scooter' | 'walking';

/**
 * Array de tipos de vehiculo
 */
export const VEHICLE_TYPES: VehicleType[] = ['motorcycle', 'bicycle', 'car', 'scooter', 'walking'];

/**
 * Informacion de vehiculos
 */
export const VEHICLE_TYPE_INFO: Record<
  VehicleType,
  {
    label: string;
    icon: string;
    avgSpeedKmh: number;
  }
> = {
  motorcycle: { label: 'Motocicleta', icon: 'bike', avgSpeedKmh: 35 },
  bicycle: { label: 'Bicicleta', icon: 'bicycle', avgSpeedKmh: 15 },
  car: { label: 'Automovil', icon: 'car', avgSpeedKmh: 30 },
  scooter: { label: 'Scooter', icon: 'zap', avgSpeedKmh: 25 },
  walking: { label: 'A pie', icon: 'footprints', avgSpeedKmh: 5 },
};

/**
 * Estados del repartidor
 */
export type DriverStatus = 'available' | 'busy' | 'offline' | 'break';

/**
 * Array de estados de driver
 */
export const DRIVER_STATUSES: DriverStatus[] = ['available', 'busy', 'offline', 'break'];

/**
 * Informacion de estados de driver
 */
export const DRIVER_STATUS_INFO: Record<
  DriverStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  available: { label: 'Disponible', color: 'text-green-700', bgColor: 'bg-green-100' },
  busy: { label: 'Ocupado', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  offline: { label: 'Desconectado', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  break: { label: 'En descanso', color: 'text-blue-700', bgColor: 'bg-blue-100' },
};

/**
 * Repartidor
 * SINCRONIZADO CON: tabla delivery_drivers
 */
export interface DeliveryDriver {
  id: string;
  tenant_id: string;

  /** Vinculo con staff (opcional) */
  staff_id?: string;

  /** Informacion personal */
  full_name: string;
  phone: string;
  email?: string;

  /** Vehiculo */
  vehicle_type: VehicleType;
  vehicle_plate?: string;
  vehicle_description?: string;

  /** Estado */
  status: DriverStatus;

  /** Ubicacion actual */
  current_location?: Coordinates & { updated_at?: string };

  /** Metricas */
  total_deliveries: number;
  successful_deliveries: number;
  average_rating: number;

  /** Configuracion */
  max_distance_km: number;
  accepts_cash: boolean;

  /** Estado activo */
  is_active: boolean;

  /** Timestamps */
  created_at: string;
  updated_at: string;
}

/**
 * Input para crear/actualizar repartidor
 */
export interface DeliveryDriverInput {
  staff_id?: string;
  full_name: string;
  phone: string;
  email?: string;
  vehicle_type: VehicleType;
  vehicle_plate?: string;
  vehicle_description?: string;
  max_distance_km?: number;
  accepts_cash?: boolean;
  is_active?: boolean;
}

// ======================
// DELIVERY ZONE
// ======================

/**
 * Tipos de zona de delivery
 */
export type DeliveryZoneType = 'radius' | 'polygon' | 'postal_codes';

/**
 * Definicion de zona por radio
 */
export interface RadiusZoneDefinition {
  center_lat: number;
  center_lng: number;
  radius_km: number;
}

/**
 * Definicion de zona por poligono
 */
export interface PolygonZoneDefinition {
  coordinates: [number, number][]; // Array de [lat, lng]
}

/**
 * Definicion de zona por codigos postales
 */
export interface PostalCodesZoneDefinition {
  codes: string[];
}

/**
 * Definicion de zona (union)
 */
export type DeliveryZoneDefinition =
  | RadiusZoneDefinition
  | PolygonZoneDefinition
  | PostalCodesZoneDefinition;

/**
 * Horario de operacion por dia
 */
export interface DayOperatingHours {
  open: string; // HH:MM
  close: string; // HH:MM
}

/**
 * Horarios de operacion por semana
 */
export type WeekOperatingHours = {
  [K in
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday']?: DayOperatingHours;
};

/**
 * Zona de delivery
 * SINCRONIZADO CON: tabla delivery_zones
 */
export interface DeliveryZone {
  id: string;
  tenant_id: string;
  branch_id: string;

  /** Informacion de la zona */
  name: string;
  description?: string;

  /** Tipo y definicion */
  zone_type: DeliveryZoneType;
  zone_definition: DeliveryZoneDefinition;

  /** Pricing */
  delivery_fee: number;
  minimum_order_amount: number;
  free_delivery_threshold?: number;

  /** Tiempos */
  estimated_time_minutes: number;

  /** Disponibilidad */
  is_active: boolean;
  priority: number;

  /** Horarios especificos */
  operating_hours?: WeekOperatingHours;

  /** Timestamps */
  created_at: string;
  updated_at: string;
}

/**
 * Input para crear/actualizar zona
 */
export interface DeliveryZoneInput {
  branch_id: string;
  name: string;
  description?: string;
  zone_type: DeliveryZoneType;
  zone_definition: DeliveryZoneDefinition;
  delivery_fee?: number;
  minimum_order_amount?: number;
  free_delivery_threshold?: number;
  estimated_time_minutes?: number;
  is_active?: boolean;
  priority?: number;
  operating_hours?: WeekOperatingHours;
}

// ======================
// DELIVERY TRACKING
// ======================

/**
 * Evento de tracking de delivery
 * SINCRONIZADO CON: tabla delivery_tracking
 */
export interface DeliveryTrackingEvent {
  id: string;
  tenant_id: string;
  order_id: string;
  driver_id?: string;

  /** Estado del evento */
  status: DeliveryStatus;

  /** Ubicacion del repartidor */
  driver_location?: Coordinates;

  /** Notas */
  notes?: string;

  /** Evidencia (URL de foto) */
  evidence_url?: string;

  /** Metadata adicional */
  metadata?: Record<string, unknown>;

  /** Auditoria */
  created_at: string;
  created_by?: string;
}

// ======================
// DELIVERY CALCULATION
// ======================

/**
 * Resultado del calculo de delivery
 * SINCRONIZADO CON: funcion calculate_delivery_details
 */
export interface DeliveryCalculationResult {
  /** Si esta dentro de zona de cobertura */
  is_within_zone: boolean;

  /** Zona aplicable (si existe) */
  zone_id?: string;
  zone_name?: string;

  /** Distancia calculada */
  distance_km?: number;

  /** Tiempo estimado en minutos */
  estimated_minutes?: number;

  /** Costo de delivery */
  delivery_fee?: number;

  /** Monto minimo de orden */
  minimum_order?: number;

  /** Umbral para delivery gratis */
  free_delivery_threshold?: number;

  /** Mensaje de error si aplica */
  message?: string;
}

/**
 * Input para calcular delivery
 */
export interface CalculateDeliveryInput {
  tenant_id: string;
  branch_id: string;
  delivery_address: DeliveryAddress;
}

// ======================
// DRIVER ASSIGNMENT
// ======================

/**
 * Resultado de asignacion de repartidor
 * SINCRONIZADO CON: funcion assign_delivery_driver
 */
export interface DriverAssignmentResult {
  success: boolean;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  estimated_arrival_minutes?: number;
  message?: string;
}

// ======================
// DELIVERY ORDER EXTENSION
// ======================

/**
 * Extension de campos de delivery para RestaurantOrder
 * Estos campos se agregan a la orden cuando order_type = 'delivery'
 */
export interface OrderDeliveryFields {
  /** Estado de delivery (separado del status de orden) */
  delivery_status?: DeliveryStatus;

  /** Direccion de entrega */
  delivery_address?: DeliveryAddress;

  /** Costo de envio */
  delivery_fee?: number;

  /** Distancia en km */
  delivery_distance_km?: number;

  /** Tiempo estimado de entrega */
  estimated_delivery_at?: string;

  /** Tiempo real de entrega */
  actual_delivery_at?: string;

  /** Instrucciones de entrega */
  delivery_instructions?: string;

  /** Razon de fallo */
  delivery_failure_reason?: string;

  /** Repartidor asignado (columna delivery_driver_id en restaurant_orders) */
  delivery_driver_id?: string;
}

// ======================
// API RESPONSES
// ======================

/**
 * Response de calculo de delivery
 */
export interface CalculateDeliveryResponse {
  success: boolean;
  data?: DeliveryCalculationResult;
  error?: string;
}

/**
 * Response de asignacion de driver
 */
export interface AssignDriverResponse {
  success: boolean;
  data?: DriverAssignmentResult;
  error?: string;
}

/**
 * Response de actualizacion de estado
 */
export interface UpdateDeliveryStatusResponse {
  success: boolean;
  data?: {
    order_id: string;
    new_status: DeliveryStatus;
  };
  error?: string;
}

/**
 * Response de tracking
 */
export interface DeliveryTrackingResponse {
  success: boolean;
  data?: {
    current_status: DeliveryStatus;
    events: DeliveryTrackingEvent[];
    driver?: Pick<DeliveryDriver, 'id' | 'full_name' | 'phone' | 'vehicle_type' | 'current_location'>;
    estimated_delivery_at?: string;
  };
  error?: string;
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Verifica si un estado de delivery es valido
 */
export function isValidDeliveryStatus(status: string): status is DeliveryStatus {
  return DELIVERY_STATUSES.includes(status as DeliveryStatus);
}

/**
 * Verifica si una transicion de estado es valida
 */
export function isValidStatusTransition(
  currentStatus: DeliveryStatus,
  newStatus: DeliveryStatus
): boolean {
  return DELIVERY_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Obtiene los estados a los que se puede transicionar
 */
export function getValidNextStatuses(currentStatus: DeliveryStatus): DeliveryStatus[] {
  return DELIVERY_STATUS_TRANSITIONS[currentStatus];
}

/**
 * Verifica si un estado es final (no puede transicionar)
 */
export function isFinalDeliveryStatus(status: DeliveryStatus): boolean {
  return DELIVERY_STATUS_TRANSITIONS[status].length === 0;
}

/**
 * Calcula tiempo estimado de entrega en minutos
 * basado en distancia y tipo de vehiculo
 */
export function calculateDeliveryTime(
  distanceKm: number,
  vehicleType: VehicleType,
  preparationTimeMinutes: number = 15
): number {
  const avgSpeed = VEHICLE_TYPE_INFO[vehicleType].avgSpeedKmh;
  const travelTimeMinutes = Math.ceil((distanceKm / avgSpeed) * 60);
  return preparationTimeMinutes + travelTimeMinutes;
}

/**
 * Formatea una direccion para mostrar
 */
export function formatDeliveryAddress(address: DeliveryAddress): string {
  const parts = [
    address.street,
    `#${address.exterior_number}`,
    address.interior_number ? `Int. ${address.interior_number}` : null,
    address.colony,
    address.city,
    address.postal_code ? `C.P. ${address.postal_code}` : null,
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Formatea una direccion corta (solo calle y numero)
 */
export function formatShortAddress(address: DeliveryAddress): string {
  return `${address.street} #${address.exterior_number}${address.interior_number ? ` Int. ${address.interior_number}` : ''}, ${address.colony}`;
}
