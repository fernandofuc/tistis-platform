// =====================================================
// TIS TIS PLATFORM - Environment Variable Validator
// Validates required environment variables at startup
// Prevents deployment with missing critical configuration
// =====================================================

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
}

export interface EnvVarConfig {
  name: string;
  required: boolean;
  requiredInProd?: boolean;
  sensitive?: boolean;
  validator?: (value: string) => boolean;
  description?: string;
}

// ======================
// ENVIRONMENT VARIABLE DEFINITIONS
// ======================

const ENV_VARS: EnvVarConfig[] = [
  // Supabase (Required)
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validator: (v) => v.startsWith('https://') && v.includes('supabase'),
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    sensitive: true,
    description: 'Supabase anonymous key',
    validator: (v) => v.startsWith('eyJ'),
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    sensitive: true,
    description: 'Supabase service role key (server-side only)',
    validator: (v) => v.startsWith('eyJ'),
  },

  // Stripe (Required in production)
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    requiredInProd: true,
    sensitive: true,
    description: 'Stripe secret key',
    validator: (v) => v.startsWith('sk_'),
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    requiredInProd: true,
    sensitive: true,
    description: 'Stripe webhook signing secret',
    validator: (v) => v.startsWith('whsec_'),
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: false,
    requiredInProd: true,
    description: 'Stripe publishable key',
    validator: (v) => v.startsWith('pk_'),
  },

  // AI Services
  {
    name: 'ANTHROPIC_API_KEY',
    required: false,
    requiredInProd: true,
    sensitive: true,
    description: 'Anthropic API key for Claude',
    validator: (v) => v.startsWith('sk-ant-'),
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    sensitive: true,
    description: 'OpenAI API key',
    validator: (v) => v.startsWith('sk-'),
  },

  // Admin Security
  {
    name: 'ADMIN_API_KEY',
    required: false,
    requiredInProd: true,
    sensitive: true,
    description: 'Admin API key for protected endpoints',
    validator: (v) => v.length >= 32,
  },

  // VAPI (Voice)
  {
    name: 'VAPI_API_KEY',
    required: false,
    sensitive: true,
    description: 'VAPI API key for voice agents',
  },

  // WhatsApp
  {
    name: 'WHATSAPP_ACCESS_TOKEN',
    required: false,
    sensitive: true,
    description: 'WhatsApp Business API access token',
  },
  {
    name: 'WHATSAPP_PHONE_NUMBER_ID',
    required: false,
    description: 'WhatsApp phone number ID',
  },
  {
    name: 'WHATSAPP_VERIFY_TOKEN',
    required: false,
    sensitive: true,
    description: 'WhatsApp webhook verification token',
  },

  // Cron Security
  {
    name: 'CRON_SECRET',
    required: false,
    requiredInProd: true,
    sensitive: true,
    description: 'Secret for cron job authentication',
    validator: (v) => v.length >= 16,
  },

  // App URL
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    requiredInProd: true,
    description: 'Public application URL',
    validator: (v) => v.startsWith('https://') || v.startsWith('http://localhost'),
  },
];

// ======================
// VALIDATION FUNCTION
// ======================

/**
 * Validates all required environment variables
 * Call this at application startup to catch configuration issues early
 *
 * @example
 * // In instrumentation.ts or app startup
 * import { validateEnvironment } from '@/src/shared/lib/env-validator';
 *
 * const result = validateEnvironment();
 * if (!result.valid) {
 *   console.error('Environment validation failed:', result.errors);
 *   process.exit(1);
 * }
 */
export function validateEnvironment(): EnvValidationResult {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    // Check if required
    const isRequired = envVar.required || (isProduction && envVar.requiredInProd);

    if (!value) {
      if (isRequired) {
        errors.push(`Missing required env var: ${envVar.name} - ${envVar.description || ''}`);
        missing.push(envVar.name);
      } else if (envVar.requiredInProd && !isProduction) {
        warnings.push(`Missing ${envVar.name} (required in production) - ${envVar.description || ''}`);
      }
      continue;
    }

    // Run validator if defined
    if (envVar.validator && !envVar.validator(value)) {
      const maskedValue = envVar.sensitive
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value;

      if (isRequired) {
        errors.push(`Invalid format for ${envVar.name}: ${maskedValue}`);
      } else {
        warnings.push(`Invalid format for ${envVar.name}: ${maskedValue}`);
      }
    }
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /sk-ant-api03/i, message: 'Possible exposed Anthropic key in code' },
    { pattern: /sk-[a-zA-Z0-9]{48}/i, message: 'Possible exposed OpenAI key in code' },
    { pattern: /whsec_[a-zA-Z0-9]{24}/i, message: 'Possible exposed Stripe webhook secret' },
  ];

  // Additional production checks
  if (isProduction) {
    // Ensure no test/dev keys in production
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && stripeKey.includes('_test_')) {
      warnings.push('Using Stripe TEST key in production environment');
    }

    // Check ADMIN_API_KEY strength
    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey && adminKey.length < 32) {
      errors.push('ADMIN_API_KEY is too short (minimum 32 characters)');
    }

    // Check for common weak secrets
    const weakSecrets = ['password', '123456', 'admin', 'secret', 'test'];
    const cronSecret = process.env.CRON_SECRET?.toLowerCase();
    if (cronSecret && weakSecrets.some(weak => cronSecret.includes(weak))) {
      errors.push('CRON_SECRET appears to be weak');
    }
  }

  return {
    valid: errors.length === 0,
    missing,
    warnings,
    errors,
  };
}

/**
 * Get a summary of environment configuration (safe for logging)
 * Does NOT expose actual values of sensitive variables
 */
export function getEnvSummary(): Record<string, string> {
  const summary: Record<string, string> = {};

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      summary[envVar.name] = '❌ Not set';
    } else if (envVar.sensitive) {
      summary[envVar.name] = `✓ Set (${value.length} chars)`;
    } else if (envVar.validator) {
      const valid = envVar.validator(value);
      summary[envVar.name] = valid ? '✓ Valid' : '⚠️ Invalid format';
    } else {
      summary[envVar.name] = '✓ Set';
    }
  }

  return summary;
}

/**
 * Assert environment is valid - throws if not
 * Use at startup to fail fast on misconfiguration
 */
export function assertValidEnvironment(): void {
  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    console.warn('[EnvValidator] Warnings:');
    result.warnings.forEach(w => console.warn(`  ⚠️ ${w}`));
  }

  if (!result.valid) {
    console.error('[EnvValidator] Environment validation FAILED:');
    result.errors.forEach(e => console.error(`  ❌ ${e}`));

    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed: ${result.errors.join(', ')}`);
    } else {
      console.error('[EnvValidator] Continuing in development mode despite errors');
    }
  } else {
    console.log('[EnvValidator] ✅ Environment validation passed');
  }
}

export default validateEnvironment;
