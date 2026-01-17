// =====================================================
// TIS TIS PLATFORM - API Usage Types
// Type definitions for API Key usage tracking and analytics
// =====================================================

// ======================
// USAGE LOG ENTRY
// ======================

/**
 * Single API usage log entry
 */
export interface APIKeyUsageLog {
  id: string;
  api_key_id: string;
  tenant_id: string;

  // Request information
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  status_code: number;
  response_time_ms: number;

  // Client information
  ip_address?: string;
  user_agent?: string;

  // Error tracking
  error_message?: string;
  error_code?: string;

  // Metadata
  created_at: string;
}

// ======================
// USAGE STATISTICS
// ======================

/**
 * Aggregated usage statistics for an API Key
 */
export interface APIKeyUsageStats {
  /** Total number of requests in the period */
  total_requests: number;
  /** Number of successful requests (status < 400) */
  successful_requests: number;
  /** Number of failed requests (status >= 400) */
  failed_requests: number;
  /** Average response time in milliseconds */
  avg_response_time_ms: number;

  /** Top endpoints by request count */
  requests_by_endpoint: EndpointStats[];

  /** Requests per day for the period */
  requests_by_day: DailyStats[];

  /** Requests by status code */
  requests_by_status?: StatusCodeStats[];

  /** Error rate as percentage */
  error_rate?: number;
}

/**
 * Statistics for a single endpoint
 */
export interface EndpointStats {
  endpoint: string;
  count: number;
  avg_response_time_ms?: number;
  error_count?: number;
}

/**
 * Daily request statistics
 */
export interface DailyStats {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number;
  successful?: number;
  failed?: number;
}

/**
 * Statistics by HTTP status code
 */
export interface StatusCodeStats {
  status_code: number;
  count: number;
}

// ======================
// USAGE QUERY PARAMS
// ======================

/**
 * Query parameters for usage statistics endpoint
 */
export interface UsageQueryParams {
  /** Number of days to look back (default: 30) */
  days?: number;
  /** Filter by endpoint prefix */
  endpoint_prefix?: string;
  /** Filter by HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Include detailed logs (default: false) */
  include_logs?: boolean;
  /** Limit for detailed logs */
  logs_limit?: number;
}

// ======================
// USAGE RESPONSE
// ======================

/**
 * Response from usage statistics endpoint
 */
export interface APIKeyUsageResponse {
  stats: APIKeyUsageStats;
  period: {
    start: string;
    end: string;
    days: number;
  };
  logs?: APIKeyUsageLog[];
}

// ======================
// TENANT USAGE SUMMARY
// ======================

/**
 * Usage summary for the entire tenant (all API keys)
 */
export interface TenantUsageSummary {
  /** Total requests this month */
  total_requests_month: number;
  /** Plan limit for the month */
  plan_limit_month: number;
  /** Percentage of plan used */
  usage_percentage: number;
  /** Number of active API keys */
  active_keys_count: number;
  /** Total keys (including revoked) */
  total_keys_count: number;
  /** Most used key this month */
  most_used_key?: {
    id: string;
    name: string;
    request_count: number;
  };
  /** Requests per key this month */
  requests_by_key: Array<{
    key_id: string;
    key_name: string;
    count: number;
  }>;
}

// ======================
// REAL-TIME USAGE
// ======================

/**
 * Real-time usage data for dashboard display
 */
export interface RealTimeUsage {
  /** Requests in the current minute */
  requests_this_minute: number;
  /** Rate limit (RPM) */
  rate_limit_rpm: number;
  /** Requests today */
  requests_today: number;
  /** Daily rate limit */
  rate_limit_daily: number;
  /** Last request timestamp */
  last_request_at?: string;
  /** Current rate limit status */
  rate_limit_status: 'ok' | 'warning' | 'exceeded';
}

// ======================
// USAGE ALERT
// ======================

/**
 * Alert when usage reaches certain thresholds
 */
export interface UsageAlert {
  type: 'rate_limit_warning' | 'rate_limit_exceeded' | 'quota_warning' | 'quota_exceeded';
  key_id: string;
  key_name: string;
  threshold_percentage: number;
  current_usage: number;
  limit: number;
  created_at: string;
}

// ======================
// CHART DATA TYPES
// ======================

/**
 * Data point for usage chart
 */
export interface UsageChartDataPoint {
  /** Date or time label */
  label: string;
  /** Request count */
  value: number;
  /** Optional additional metrics */
  successful?: number;
  failed?: number;
}

/**
 * Complete chart data for usage visualization
 */
export interface UsageChartData {
  dataPoints: UsageChartDataPoint[];
  total: number;
  average: number;
  peak: {
    value: number;
    label: string;
  };
}
