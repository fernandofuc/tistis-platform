/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dental Tools - Index
 *
 * Exports all dental-related tools.
 */

// Appointment Tools
export { checkAvailability } from './check-availability';
export {
  createAppointment,
  modifyAppointment,
  cancelAppointment,
} from './create-appointment';

// Service Tools
export { getServices } from './get-services';

// Doctor Tools
export { getDoctors } from './get-doctors';

// Insurance Tools
export { getInsuranceInfo } from './get-insurance-info';
