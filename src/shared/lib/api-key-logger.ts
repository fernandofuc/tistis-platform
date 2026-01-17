// =====================================================
// TIS TIS PLATFORM - API Key Usage Logger
// Efficient logging of API Key usage with batch inserts
// =====================================================

import { createClient } from '@supabase/supabase-js';

// ======================
// CONSTANTS
// ======================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Batch configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 5000; // 5 seconds

// ======================
// TYPES
// ======================

/**
 * Log entry for API Key usage
 */
export interface APIKeyLogEntry {
  api_key_id: string;
  tenant_id: string;
  endpoint: string;
  method: string;
  scope_used?: string;
  status_code: number;
  response_time_ms: number;
  ip_address?: string;
  user_agent?: string;
  error_message?: string;
  created_at?: string;
}

/**
 * Simplified log entry for convenience
 */
export interface LogRequestParams {
  keyId: string;
  tenantId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  scopeUsed?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
}

// ======================
// BUFFER & STATE
// ======================

// Buffer for batch inserts
let logBuffer: APIKeyLogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// ======================
// CORE LOGGING FUNCTIONS
// ======================

/**
 * Log API Key usage
 * Entries are buffered and inserted in batches for performance
 *
 * @param entry - The log entry to record
 *
 * @example
 * ```typescript
 * logAPIKeyUsage({
 *   api_key_id: auth.keyId,
 *   tenant_id: auth.tenantId,
 *   endpoint: '/api/v1/leads',
 *   method: 'GET',
 *   status_code: 200,
 *   response_time_ms: 150,
 *   ip_address: clientIP,
 * });
 * ```
 */
export function logAPIKeyUsage(entry: APIKeyLogEntry): void {
  // Don't accept new entries during shutdown
  if (isShuttingDown) {
    return;
  }

  // Add timestamp if not provided
  if (!entry.created_at) {
    entry.created_at = new Date().toISOString();
  }

  // Add to buffer
  logBuffer.push(entry);

  // Flush if buffer is full
  if (logBuffer.length >= BATCH_SIZE) {
    flushLogs();
  } else if (!flushTimeout) {
    // Schedule a flush if not already scheduled
    flushTimeout = setTimeout(flushLogs, FLUSH_INTERVAL_MS);
  }
}

/**
 * Convenience function with simpler parameter names
 */
export function logRequest(params: LogRequestParams): void {
  logAPIKeyUsage({
    api_key_id: params.keyId,
    tenant_id: params.tenantId,
    endpoint: params.endpoint,
    method: params.method,
    status_code: params.statusCode,
    response_time_ms: params.responseTimeMs,
    scope_used: params.scopeUsed,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    error_message: params.errorMessage,
  });
}

// ======================
// BATCH OPERATIONS
// ======================

/**
 * Flush all buffered log entries to the database
 */
export async function flushLogs(): Promise<void> {
  // Clear the flush timeout
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Nothing to flush
  if (logBuffer.length === 0) {
    return;
  }

  // Take current buffer and reset it
  const entries = [...logBuffer];
  logBuffer = [];

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.from('api_key_usage_logs').insert(entries);

    if (error) {
      console.error('[API Key Logger] Failed to insert logs:', error);
      // Re-add entries to buffer for retry (with limit to prevent memory issues)
      if (logBuffer.length < BATCH_SIZE * 10) {
        logBuffer.push(...entries);
      }
    }
  } catch (error) {
    console.error('[API Key Logger] Unexpected error:', error);
    // Re-add entries to buffer for retry
    if (logBuffer.length < BATCH_SIZE * 10) {
      logBuffer.push(...entries);
    }
  }
}

// ======================
// LIFECYCLE MANAGEMENT
// ======================

/**
 * Gracefully shutdown the logger
 * Flushes any remaining entries before shutdown
 */
export async function shutdownLogger(): Promise<void> {
  isShuttingDown = true;

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (logBuffer.length > 0) {
    await flushLogs();
  }
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await shutdownLogger();
  });

  process.on('SIGTERM', async () => {
    await shutdownLogger();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await shutdownLogger();
    process.exit(0);
  });
}

// ======================
// QUERY FUNCTIONS
// ======================

/**
 * Get usage statistics for an API Key
 *
 * @param keyId - The API Key ID
 * @param days - Number of days to look back (default: 30)
 * @returns Usage statistics
 */
export async function getAPIKeyUsageStats(
  keyId: string,
  days: number = 30
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  requestsByEndpoint: Array<{ endpoint: string; count: number }>;
  requestsByDay: Array<{ date: string; count: number }>;
} | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.rpc('get_api_key_usage_stats', {
      p_api_key_id: keyId,
      p_days: days,
    });

    if (error) {
      console.error('[API Key Logger] Failed to get usage stats:', error);
      return null;
    }

    if (!data) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTimeMs: 0,
        requestsByEndpoint: [],
        requestsByDay: [],
      };
    }

    return {
      totalRequests: data.total_requests || 0,
      successfulRequests: data.successful_requests || 0,
      failedRequests: data.failed_requests || 0,
      avgResponseTimeMs: data.avg_response_time_ms || 0,
      requestsByEndpoint: data.requests_by_endpoint || [],
      requestsByDay: data.requests_by_day || [],
    };
  } catch (error) {
    console.error('[API Key Logger] Unexpected error:', error);
    return null;
  }
}

/**
 * Get recent logs for an API Key
 *
 * @param keyId - The API Key ID
 * @param limit - Maximum number of logs to return (default: 100)
 * @returns Recent log entries
 */
export async function getRecentLogs(
  keyId: string,
  limit: number = 100
): Promise<APIKeyLogEntry[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase
      .from('api_key_usage_logs')
      .select('*')
      .eq('api_key_id', keyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[API Key Logger] Failed to get recent logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[API Key Logger] Unexpected error:', error);
    return [];
  }
}

/**
 * Get error logs for an API Key
 *
 * @param keyId - The API Key ID
 * @param limit - Maximum number of logs to return (default: 50)
 * @returns Recent error log entries
 */
export async function getErrorLogs(
  keyId: string,
  limit: number = 50
): Promise<APIKeyLogEntry[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase
      .from('api_key_usage_logs')
      .select('*')
      .eq('api_key_id', keyId)
      .gte('status_code', 400)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[API Key Logger] Failed to get error logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[API Key Logger] Unexpected error:', error);
    return [];
  }
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Get current buffer size (useful for monitoring)
 */
export function getBufferSize(): number {
  return logBuffer.length;
}

/**
 * Force flush logs immediately (useful for testing)
 */
export async function forceFlush(): Promise<void> {
  await flushLogs();
}

/**
 * Clear the buffer without flushing (useful for testing)
 */
export function clearBuffer(): void {
  logBuffer = [];
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

// ======================
// HIGH-LEVEL HELPERS
// ======================

/**
 * Create a log entry from request context
 * Useful for wrapping the logging in middleware
 */
export function createLogEntry(
  keyId: string,
  tenantId: string,
  request: Request,
  response: Response,
  startTime: number,
  options?: {
    scopeUsed?: string;
    errorMessage?: string;
  }
): APIKeyLogEntry {
  const url = new URL(request.url);

  return {
    api_key_id: keyId,
    tenant_id: tenantId,
    endpoint: url.pathname,
    method: request.method,
    status_code: response.status,
    response_time_ms: Date.now() - startTime,
    scope_used: options?.scopeUsed,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                request.headers.get('x-real-ip') ||
                undefined,
    user_agent: request.headers.get('user-agent') || undefined,
    error_message: options?.errorMessage,
  };
}
