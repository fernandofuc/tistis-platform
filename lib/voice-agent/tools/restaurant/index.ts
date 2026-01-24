/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tools - Index
 *
 * Exports all restaurant-related tools.
 */

// Reservation Tools
export { checkAvailabilityRestaurant as checkAvailability } from './check-availability';
export {
  createReservation,
  modifyReservation,
  cancelReservation,
} from './create-reservation';

// Menu Tools
export { getMenu } from './get-menu';

// Order Tools
export { createOrder } from './create-order';
export { getOrderStatus } from './get-order-status';

// Delivery Tools (added in v2.1 - Migration 156)
export {
  calculateDelivery,
  calculateDeliveryToolDefinition,
  type CalculateDeliveryParams,
  type CalculateDeliveryResult,
  type CalculateDeliveryContext,
} from './calculate-delivery';
export {
  getDeliveryStatus,
  getDeliveryStatusToolDefinition,
  type GetDeliveryStatusParams,
  type GetDeliveryStatusResult,
  type GetDeliveryStatusContext,
} from './get-delivery-status';

// Promotion Tools
export { getPromotions } from './get-promotions';
