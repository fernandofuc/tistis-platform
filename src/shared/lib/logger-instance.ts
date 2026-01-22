// =====================================================
// TIS TIS PLATFORM - Logger Instance
// Singleton instance of the structured logger
// =====================================================

import { createLogger, getLogger, type LoggerConfig } from './structured-logger';

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Logger configuration based on environment
 * - Production: JSON format, info level minimum
 * - Development: Pretty print, debug level
 */
const config: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  serviceName: 'tistis-platform',
  version: process.env.npm_package_version || '1.0.0',
  prettyPrint: process.env.NODE_ENV !== 'production',
  redactFields: [
    // Authentication & Tokens
    'password',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'sessionId',
    'session_id',
    // Stripe specific
    'stripeKey',
    'stripe_key',
    'stripeSecret',
    'stripe_secret',
    'webhookSecret',
    'webhook_secret',
    // Admin & Service keys
    'adminKey',
    'admin_key',
    'serviceRoleKey',
    'service_role_key',
    'supabaseKey',
    'supabase_key',
    // PII (Personally Identifiable Information)
    'email',
    'customerEmail',
    'customer_email',
    'phone',
    'customerPhone',
    'customer_phone',
    'creditCard',
    'credit_card',
    'ssn',
    // Cryptographic
    'privateKey',
    'private_key',
    'tempPassword',
    'temp_password',
  ],
  includeStackTraces: process.env.NODE_ENV !== 'production',
};

/**
 * Default context included in all log entries
 * Useful for filtering logs by application
 */
const defaultContext = {
  environment: process.env.NODE_ENV || 'development',
};

// =====================================================
// LOGGER INSTANCE
// =====================================================

/**
 * Main application logger
 * Use this for general logging throughout the application
 *
 * @example
 * import { logger } from '@/src/shared/lib/logger-instance';
 *
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Database connection failed', {}, error);
 */
export const logger = createLogger(config, defaultContext);

// =====================================================
// COMPONENT LOGGERS
// =====================================================

/**
 * Create a child logger for a specific component
 * Inherits all configuration but adds component context
 *
 * @param component - Name of the component (e.g., 'stripe-webhook', 'whatsapp-service')
 * @returns Logger instance with component context
 *
 * @example
 * const logger = createComponentLogger('stripe-webhook');
 * logger.info('Webhook received', { eventType: 'checkout.session.completed' });
 */
export function createComponentLogger(component: string) {
  return logger.child({ component });
}

/**
 * Create a child logger for a specific API route
 * Adds route-specific context for easier filtering
 *
 * @param route - API route path (e.g., '/api/stripe/webhook')
 * @returns Logger instance with route context
 *
 * @example
 * const logger = createRouteLogger('/api/v1/leads');
 * logger.info('Request received', { method: 'GET' });
 */
export function createRouteLogger(route: string) {
  return logger.child({ route });
}

// =====================================================
// SPECIALIZED LOGGERS
// =====================================================

/**
 * Pre-configured loggers for common components
 * Use these for consistency across the codebase
 */
export const loggers = {
  /** Stripe payment processing */
  stripe: createComponentLogger('stripe'),

  /** WhatsApp messaging */
  whatsapp: createComponentLogger('whatsapp'),

  /** Voice agent (VAPI) */
  voice: createComponentLogger('voice-agent'),

  /** AI/LLM operations */
  ai: createComponentLogger('ai'),

  /** Admin operations */
  admin: createComponentLogger('admin'),

  /** Authentication */
  auth: createComponentLogger('auth'),

  /** Database operations */
  database: createComponentLogger('database'),

  /** Background jobs */
  jobs: createComponentLogger('jobs'),

  /** Webhooks (generic) */
  webhook: createComponentLogger('webhook'),
};

// =====================================================
// RE-EXPORTS
// =====================================================

// Re-export getLogger for compatibility
export { getLogger };

// Re-export types
export type { LoggerConfig };
