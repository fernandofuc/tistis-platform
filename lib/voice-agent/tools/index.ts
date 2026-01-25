/**
 * TIS TIS Platform - Voice Agent v2.0
 * Tool System - Main Index
 *
 * Central export point for the tool system.
 * Registers all tools and provides factory functions.
 */

// =====================================================
// TYPE EXPORTS
// =====================================================

export * from './types';

// =====================================================
// REGISTRY EXPORTS
// =====================================================

export { ToolRegistry, toolRegistry, createToolContext } from './registry';

// =====================================================
// FORMATTER EXPORTS
// =====================================================

export * from './formatters';

// =====================================================
// UTILITY EXPORTS
// =====================================================

export * from './utils';

// =====================================================
// RESTAURANT TOOL EXPORTS
// =====================================================

export {
  checkAvailability as restaurantCheckAvailability,
  createReservation,
  modifyReservation,
  cancelReservation,
  getMenu,
  createOrder,
  getOrderStatus,
  getPromotions,
} from './restaurant';

// =====================================================
// DENTAL TOOL EXPORTS
// =====================================================

export {
  checkAvailability as dentalCheckAvailability,
  createAppointment,
  modifyAppointment,
  cancelAppointment,
  getServices,
  getDoctors,
  getInsuranceInfo,
} from './dental';

// =====================================================
// COMMON TOOL EXPORTS
// =====================================================

export {
  transferToHuman,
  getBusinessHours,
  endCall,
  requestInvoice,
} from './common';

// =====================================================
// SECURE BOOKING TOOL EXPORTS (v2.2)
// =====================================================

export {
  checkCustomerTrust,
  createSecureHold,
  releaseSecureHold,
  convertHoldToBooking,
  checkSecureAvailability,
  secureCreateAppointment,
  secureCreateReservation,
} from './secure-booking';

// =====================================================
// TOOL REGISTRATION
// =====================================================

import { toolRegistry } from './registry';

// Restaurant tools
import {
  checkAvailability as restaurantCheckAvailability,
  createReservation,
  modifyReservation,
  cancelReservation,
  getMenu,
  createOrder,
  getOrderStatus,
  getPromotions,
} from './restaurant';

// Dental tools
import {
  checkAvailability as dentalCheckAvailability,
  createAppointment,
  modifyAppointment,
  cancelAppointment,
  getServices,
  getDoctors,
  getInsuranceInfo,
} from './dental';

// Common tools
import {
  transferToHuman,
  getBusinessHours,
  endCall,
  requestInvoice,
} from './common';

// Secure Booking tools (v2.2)
import {
  checkCustomerTrust,
  createSecureHold,
  releaseSecureHold,
  convertHoldToBooking,
  checkSecureAvailability,
  secureCreateAppointment,
  secureCreateReservation,
} from './secure-booking';

/**
 * Initialize and register all tools
 * Call this once at application startup
 */
export function initializeTools(): void {
  // Register restaurant tools
  // Note: We use different names to avoid conflicts
  // The check_availability tool is context-aware based on assistant type

  // For restaurant assistant types, register restaurant-specific check_availability
  toolRegistry.register({
    ...restaurantCheckAvailability,
    name: 'check_availability',
    enabledFor: ['rest_basic', 'rest_standard', 'rest_complete'],
  });

  toolRegistry.register(createReservation);
  toolRegistry.register(modifyReservation);
  toolRegistry.register(cancelReservation);
  toolRegistry.register(getMenu);
  toolRegistry.register(createOrder);
  toolRegistry.register(getOrderStatus);
  toolRegistry.register(getPromotions);

  // For dental assistant types, register dental-specific check_availability
  // We need to register as a different tool or handle via context
  toolRegistry.register({
    ...dentalCheckAvailability,
    name: 'check_dental_availability',
    enabledFor: ['dental_basic', 'dental_standard', 'dental_complete'],
  });

  toolRegistry.register(createAppointment);
  toolRegistry.register(modifyAppointment);
  toolRegistry.register(cancelAppointment);
  toolRegistry.register(getServices);
  toolRegistry.register(getDoctors);
  toolRegistry.register(getInsuranceInfo);

  // Register common tools (available for all types)
  toolRegistry.register(transferToHuman);
  toolRegistry.register(getBusinessHours);
  toolRegistry.register(endCall);
  toolRegistry.register(requestInvoice);

  // Register Secure Booking tools (v2.2 - available for all types with secure_booking capability)
  toolRegistry.register(checkCustomerTrust);
  toolRegistry.register(createSecureHold);
  toolRegistry.register(releaseSecureHold);
  toolRegistry.register(convertHoldToBooking);
  toolRegistry.register(checkSecureAvailability);

  // Register Secure Enhanced Booking tools (v2.2)
  toolRegistry.register(secureCreateAppointment);
  toolRegistry.register(secureCreateReservation);

  console.log(`[Tools] Initialized ${toolRegistry.getToolNames().length} tools`);
}

/**
 * Get tools for a specific assistant type
 * Returns VAPI-compatible function definitions
 */
export function getToolsForAssistant(assistantType: string) {
  return toolRegistry.getVAPIFunctions(assistantType);
}

/**
 * Execute a tool by name
 * Wrapper around registry.execute with additional logging
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  context: import('./types').ToolContext
) {
  const startTime = Date.now();

  try {
    const result = await toolRegistry.execute(toolName, params, context);

    const duration = Date.now() - startTime;
    console.log(`[Tools] ${toolName} executed in ${duration}ms - ${result.success ? 'success' : 'failed'}`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Tools] ${toolName} failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Check if a tool requires confirmation
 */
export function toolRequiresConfirmation(toolName: string): boolean {
  return toolRegistry.requiresConfirmation(toolName);
}

/**
 * Get confirmation message for a tool
 */
export function getToolConfirmationMessage(
  toolName: string,
  params: Record<string, unknown>
): string | null {
  return toolRegistry.getConfirmationMessage(toolName, params);
}

// =====================================================
// AUTO-INITIALIZE ON IMPORT (Optional)
// =====================================================

// Uncomment to auto-initialize when this module is imported
// initializeTools();
