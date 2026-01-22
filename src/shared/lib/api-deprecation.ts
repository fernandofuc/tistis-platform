// =====================================================
// TIS TIS PLATFORM - FASE 3: API Deprecation Strategy
// Utilities for graceful deprecation of query parameter filtering
// Timeline: 6-month phased deprecation (warning → soft → hard)
// =====================================================

import { NextResponse } from 'next/server';
import type { APIKeyAuthResult } from './api-key-auth';

// ======================
// TYPES
// ======================

export type DeprecationPhase = 'warning' | 'soft_enforcement' | 'hard_deprecation';

export interface DeprecationConfig {
  phase: DeprecationPhase;
  deprecationDate: string; // ISO date when feature will be removed
  migrationGuideUrl: string;
  enableSoftEnforcement: boolean;
  enableHardEnforcement: boolean;
}

export interface DeprecationWarning {
  feature: string;
  message: string;
  deprecationDate: string;
  migrationGuide: string;
  phase: DeprecationPhase;
}

// ======================
// CONFIGURATION
// ======================

/**
 * Global deprecation configuration
 * Update these dates based on deployment timeline
 */
const DEPRECATION_CONFIG: DeprecationConfig = {
  // Current phase: 'warning' | 'soft_enforcement' | 'hard_deprecation'
  phase: 'warning',

  // Date when query parameter filtering will be completely removed
  // Recommendation: 6 months from FASE 2 deployment
  deprecationDate: '2026-07-01',

  // URL to migration guide documentation
  migrationGuideUrl: 'https://docs.tistis.com/api/v1/migration/branch-filtering',

  // Feature flags for enforcement phases
  enableSoftEnforcement: false,  // Month 3-4: Require explicit opt-in
  enableHardEnforcement: false,  // Month 5-6: Remove feature completely
};

/**
 * Update deprecation phase (typically done via environment variable or admin panel)
 */
export function updateDeprecationPhase(phase: DeprecationPhase): void {
  DEPRECATION_CONFIG.phase = phase;

  switch (phase) {
    case 'warning':
      DEPRECATION_CONFIG.enableSoftEnforcement = false;
      DEPRECATION_CONFIG.enableHardEnforcement = false;
      break;
    case 'soft_enforcement':
      DEPRECATION_CONFIG.enableSoftEnforcement = true;
      DEPRECATION_CONFIG.enableHardEnforcement = false;
      break;
    case 'hard_deprecation':
      DEPRECATION_CONFIG.enableSoftEnforcement = true;
      DEPRECATION_CONFIG.enableHardEnforcement = true;
      break;
  }
}

// ======================
// DEPRECATION DETECTION
// ======================

/**
 * Detect if request is using deprecated query parameter filtering
 *
 * @returns true if using deprecated feature (tenant-wide key + query param)
 */
export function isUsingDeprecatedFiltering(
  auth: APIKeyAuthResult,
  queryParamBranchId?: string | null
): boolean {
  // Only warn if:
  // 1. Using tenant-wide API Key (not branch-specific)
  // 2. AND providing branch_id query parameter
  return (
    auth.scopeType === 'tenant' &&
    !!queryParamBranchId &&
    queryParamBranchId !== null
  );
}

/**
 * Create deprecation warning object
 */
export function createDeprecationWarning(): DeprecationWarning {
  return {
    feature: 'query-parameter-branch-filtering',
    message: 'Query parameter branch filtering is deprecated. Please migrate to branch-specific API Keys.',
    deprecationDate: DEPRECATION_CONFIG.deprecationDate,
    migrationGuide: DEPRECATION_CONFIG.migrationGuideUrl,
    phase: DEPRECATION_CONFIG.phase,
  };
}

// ======================
// RESPONSE HEADER INJECTION
// ======================

/**
 * Add deprecation warning headers to NextResponse
 * These headers inform clients about the deprecation without breaking functionality
 *
 * @example
 * ```typescript
 * const response = NextResponse.json(data);
 * return addDeprecationHeaders(response, auth, queryBranchId);
 * ```
 */
export function addDeprecationHeaders<T>(
  response: NextResponse<T>,
  auth: APIKeyAuthResult,
  queryParamBranchId?: string | null
): NextResponse<T> {
  if (!isUsingDeprecatedFiltering(auth, queryParamBranchId)) {
    return response;
  }

  // Standard deprecation headers (following RFC draft)
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', DEPRECATION_CONFIG.deprecationDate);

  // Custom headers for detailed information
  response.headers.set('X-API-Deprecated-Feature', 'query-parameter-filtering');
  response.headers.set('X-API-Deprecation-Phase', DEPRECATION_CONFIG.phase);
  response.headers.set('X-API-Deprecation-Date', DEPRECATION_CONFIG.deprecationDate);
  response.headers.set('X-API-Migration-Guide', DEPRECATION_CONFIG.migrationGuideUrl);

  // Warning header (following RFC 7234)
  const warningMessage = `299 - "Query parameter filtering is deprecated and will be removed on ${DEPRECATION_CONFIG.deprecationDate}. See ${DEPRECATION_CONFIG.migrationGuideUrl} for migration instructions."`;
  response.headers.set('Warning', warningMessage);

  return response;
}

// ======================
// SOFT ENFORCEMENT (Month 3-4)
// ======================

/**
 * Check if request should be blocked due to soft enforcement
 * In soft enforcement phase, deprecated usage requires explicit opt-in header
 *
 * @returns Error response if blocked, null if allowed
 */
export function checkSoftEnforcement(
  request: Request,
  auth: APIKeyAuthResult,
  queryParamBranchId?: string | null
): NextResponse | null {
  // If soft enforcement is disabled, allow all requests
  if (!DEPRECATION_CONFIG.enableSoftEnforcement) {
    return null;
  }

  // If not using deprecated feature, allow
  if (!isUsingDeprecatedFiltering(auth, queryParamBranchId)) {
    return null;
  }

  // Check for explicit opt-in header
  const allowLegacyFiltering = request.headers.get('X-Allow-Legacy-Filtering') === 'true';

  if (!allowLegacyFiltering) {
    const warning = createDeprecationWarning();

    return NextResponse.json(
      {
        error: 'Query parameter branch filtering is deprecated',
        code: 'DEPRECATED_FEATURE',
        message: warning.message,
        deprecation_date: warning.deprecationDate,
        migration_guide: warning.migrationGuide,
        temporary_override: 'Add header "X-Allow-Legacy-Filtering: true" to temporarily enable this feature',
        phase: 'soft_enforcement',
      },
      { status: 400 }
    );
  }

  // Opt-in header present, allow but still add deprecation headers
  return null;
}

// ======================
// HARD ENFORCEMENT (Month 5-6)
// ======================

/**
 * Check if request should be blocked due to hard deprecation
 * In hard deprecation phase, deprecated usage is completely blocked
 *
 * @returns Error response if blocked, null if allowed
 */
export function checkHardEnforcement(
  auth: APIKeyAuthResult,
  queryParamBranchId?: string | null
): NextResponse | null {
  // If hard enforcement is disabled, allow
  if (!DEPRECATION_CONFIG.enableHardEnforcement) {
    return null;
  }

  // If not using deprecated feature, allow
  if (!isUsingDeprecatedFiltering(auth, queryParamBranchId)) {
    return null;
  }

  const warning = createDeprecationWarning();

  return NextResponse.json(
    {
      error: 'Query parameter branch filtering has been removed',
      code: 'FEATURE_REMOVED',
      message: 'This feature has been permanently removed. Please migrate to branch-specific API Keys.',
      removal_date: warning.deprecationDate,
      migration_guide: warning.migrationGuide,
      phase: 'hard_deprecation',
    },
    { status: 410 } // 410 Gone - resource no longer available
  );
}

// ======================
// UNIFIED DEPRECATION CHECK
// ======================

/**
 * Apply all deprecation checks in correct order
 * This is the main function to call in API routes
 *
 * @returns Error response if blocked, null if allowed (with headers added to response)
 *
 * @example
 * ```typescript
 * // In API route:
 * const deprecationCheck = applyDeprecationChecks(request, auth, queryBranchId);
 * if (deprecationCheck) {
 *   return deprecationCheck; // Blocked
 * }
 *
 * // Continue with normal processing...
 * const response = NextResponse.json(data);
 * return addDeprecationHeaders(response, auth, queryBranchId);
 * ```
 */
export function applyDeprecationChecks(
  request: Request,
  auth: APIKeyAuthResult,
  queryParamBranchId?: string | null
): NextResponse | null {
  // Phase 1: Hard enforcement (complete block)
  const hardBlock = checkHardEnforcement(auth, queryParamBranchId);
  if (hardBlock) {
    return hardBlock;
  }

  // Phase 2: Soft enforcement (require opt-in)
  const softBlock = checkSoftEnforcement(request, auth, queryParamBranchId);
  if (softBlock) {
    return softBlock;
  }

  // Phase 3: Warning only (no block, just headers)
  // Handled by addDeprecationHeaders() in response
  return null;
}

// ======================
// MONITORING & ANALYTICS
// ======================

/**
 * Log deprecation usage for analytics
 * Helps track migration progress
 */
export interface DeprecationUsageLog {
  timestamp: string;
  keyId: string;
  tenantId: string;
  endpoint: string;
  scopeType: string;
  usedQueryParam: boolean;
  phase: DeprecationPhase;
  blocked: boolean;
}

/**
 * Create deprecation usage log entry
 */
export function createDeprecationLog(
  auth: APIKeyAuthResult,
  endpoint: string,
  queryParamBranchId?: string | null,
  blocked: boolean = false
): DeprecationUsageLog {
  return {
    timestamp: new Date().toISOString(),
    keyId: auth.keyId || 'unknown',
    tenantId: auth.tenantId || 'unknown',
    endpoint,
    scopeType: auth.scopeType || 'tenant',
    usedQueryParam: !!queryParamBranchId,
    phase: DEPRECATION_CONFIG.phase,
    blocked,
  };
}

/**
 * Get current deprecation configuration (for admin dashboard)
 */
export function getDeprecationConfig(): DeprecationConfig {
  return { ...DEPRECATION_CONFIG };
}

/**
 * Calculate days until deprecation
 */
export function getDaysUntilDeprecation(): number {
  const now = new Date();
  const deprecationDate = new Date(DEPRECATION_CONFIG.deprecationDate);
  const diffTime = deprecationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// ======================
// ENVIRONMENT-BASED CONFIG
// ======================

/**
 * Initialize deprecation config from environment variables
 * Call this on app startup
 */
export function initializeDeprecationConfig(): void {
  // Allow environment variables to override defaults
  const envPhase = process.env.DEPRECATION_PHASE as DeprecationPhase | undefined;
  if (envPhase && ['warning', 'soft_enforcement', 'hard_deprecation'].includes(envPhase)) {
    updateDeprecationPhase(envPhase);
  }

  const envDate = process.env.DEPRECATION_DATE;
  if (envDate) {
    DEPRECATION_CONFIG.deprecationDate = envDate;
  }

  const envGuideUrl = process.env.DEPRECATION_GUIDE_URL;
  if (envGuideUrl) {
    DEPRECATION_CONFIG.migrationGuideUrl = envGuideUrl;
  }
}

// Auto-initialize on module load
initializeDeprecationConfig();
