/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tools - Index
 *
 * Exports all restaurant-related tools.
 */

export { checkAvailabilityRestaurant as checkAvailability } from './check-availability';
export {
  createReservation,
  modifyReservation,
  cancelReservation,
} from './create-reservation';
export { getMenu } from './get-menu';
export { createOrder } from './create-order';
