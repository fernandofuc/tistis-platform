// =====================================================
// TIS TIS PLATFORM - Specialist Agents Exports
// =====================================================

// Base Agent
export {
  BaseAgent,
  type AgentConfig,
  type AgentResult,
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

// General/Fallback
export { GeneralAgent, generalNode } from './general.agent';

// Escalation
export { EscalationAgent, UrgentCareAgent, escalationNode, urgentCareNode } from './escalation.agent';
