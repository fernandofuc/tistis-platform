// =====================================================
// TIS TIS PLATFORM - Specialist Agents Exports
// ARQUITECTURA V7.0
// =====================================================

// Base Agent
export {
  BaseAgent,
  type AgentConfig,
  type AgentResult,
  // @deprecated - V7: Los agentes usan Tool Calling, no context stuffing
  // Estas funciones se mantienen para backwards compatibility pero NO deben usarse
  formatServicesForPrompt,
  formatBranchesForPrompt,
  formatFAQsForPrompt,
  buildFullBusinessContext,
} from './base.agent';

// Greeting
export { GreetingAgent, greetingNode } from './greeting.agent';

// Pricing
export { PricingAgent, pricingNode } from './pricing.agent';

// Location
export { LocationAgent, locationNode } from './location.agent';

// Hours
export { HoursAgent, hoursNode } from './hours.agent';

// FAQ
export { FAQAgent, faqNode } from './faq.agent';

// Booking (includes vertical-specific)
export {
  BookingAgent,
  BookingDentalAgent,
  BookingRestaurantAgent,
  BookingMedicalAgent,
  bookingNode,
  bookingDentalNode,
  bookingRestaurantNode,
  bookingMedicalNode,
} from './booking.agent';

// Ordering (restaurant pickup/delivery)
export {
  OrderingRestaurantAgent,
  orderingRestaurantNode,
} from './ordering.agent';

// General/Fallback
export { GeneralAgent, generalNode } from './general.agent';

// Escalation
export { EscalationAgent, UrgentCareAgent, escalationNode, urgentCareNode } from './escalation.agent';

// Invoicing (restaurant CFDI via WhatsApp)
export {
  InvoicingRestaurantAgent,
  invoicingRestaurantNode,
} from './invoicing.agent';
