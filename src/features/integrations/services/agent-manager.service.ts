// =====================================================
// TIS TIS PLATFORM - Agent Manager Service
// Manages TIS TIS Local Agent instances for Soft Restaurant
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type {
  AgentInstance,
  AgentStatus,
  AgentCredentials,
  AgentRegistrationRequest,
  AgentHeartbeatRequest,
  AgentSyncRequest,
} from '../types/integration.types';

// ======================
// TYPES
// ======================

export interface CreateAgentResult {
  success: boolean;
  agent?: AgentInstance;
  credentials?: AgentCredentials;
  error?: string;
  errorCode?: string;
}

export interface ValidateTokenResult {
  isValid: boolean;
  errorCode?: string;
  context?: {
    tenantId: string;
    integrationId: string;
    branchId?: string;
    status: AgentStatus;
    syncConfig: {
      syncIntervalSeconds: number;
      syncMenu: boolean;
      syncInventory: boolean;
      syncSales: boolean;
      syncTables: boolean;
      storeCode: string;  // For multi-branch SQL filtering
    };
    tenantName: string;
  };
}

export interface HeartbeatResult {
  success: boolean;
  error?: string;
}

export interface CreateSyncLogResult {
  success: boolean;
  logId?: string;
  error?: string;
}

export interface CompleteSyncResult {
  success: boolean;
  error?: string;
}

export interface AgentStats {
  totalAgents: number;
  connectedAgents: number;
  syncingAgents: number;
  errorAgents: number;
  offlineAgents: number;
  totalRecordsSynced: number;
  syncsToday: number;
  syncsFailedToday: number;
  lastSyncAt: string | null;
  avgSyncDurationMs: number | null;
}

export interface SyncLogEntry {
  id: string;
  agentId: string;
  tenantId: string;
  syncType: 'menu' | 'inventory' | 'sales' | 'tables' | 'full';
  batchId: string;
  batchIndex: number;
  batchTotal: number;
  status: 'started' | 'processing' | 'completed' | 'partial' | 'failed';
  recordsReceived: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
}

// ======================
// ERROR CODES
// ======================

export const AGENT_ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',

  // Status
  AGENT_OFFLINE: 'AGENT_OFFLINE',
  AGENT_DISABLED: 'AGENT_DISABLED',

  // Registration
  DUPLICATE_AGENT_ID: 'DUPLICATE_AGENT_ID',
  INTEGRATION_NOT_FOUND: 'INTEGRATION_NOT_FOUND',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Sync
  SYNC_IN_PROGRESS: 'SYNC_IN_PROGRESS',
  INVALID_SYNC_TYPE: 'INVALID_SYNC_TYPE',
  BATCH_MISMATCH: 'BATCH_MISMATCH',

  // General
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// ======================
// SERVICE CLASS
// ======================

class AgentManagerService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables for AgentManagerService');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // ======================
  // AGENT CREATION
  // ======================

  /**
   * Creates a new agent instance with credentials.
   * Called when user generates installer from dashboard.
   *
   * @param params.branchId - TIS TIS branch ID (required for sales sync)
   * @param params.storeCode - SR CodigoTienda for multi-branch SQL filtering
   */
  async createAgent(params: {
    tenantId: string;
    integrationId: string;
    branchId?: string;
    storeCode?: string;  // SR CodigoTienda for multi-branch filtering
    syncMenu: boolean;
    syncInventory: boolean;
    syncSales: boolean;
    syncTables: boolean;
    syncIntervalSeconds?: number;
  }): Promise<CreateAgentResult> {
    try {
      // Generate unique agent ID
      const agentId = `tis-agent-${crypto.randomBytes(8).toString('hex')}`;

      // Generate auth token (32 bytes = 64 hex chars)
      const authToken = crypto.randomBytes(32).toString('hex');

      // Hash the token for storage (SHA-256)
      const authTokenHash = crypto
        .createHash('sha256')
        .update(authToken)
        .digest('hex');

      // Token expires in 30 days
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

      // Insert agent instance
      const { data: agent, error } = await this.supabase
        .from('agent_instances')
        .insert({
          tenant_id: params.tenantId,
          integration_id: params.integrationId,
          branch_id: params.branchId || null,
          store_code: params.storeCode || null,  // For multi-branch SQL filtering
          agent_id: agentId,
          agent_version: '1.0.0',
          status: 'pending',
          sync_interval_seconds: params.syncIntervalSeconds || 300,
          sync_menu: params.syncMenu,
          sync_inventory: params.syncInventory,
          sync_sales: params.syncSales,
          sync_tables: params.syncTables,
          auth_token_hash: authTokenHash,
          token_expires_at: tokenExpiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return {
            success: false,
            error: 'Ya existe un agente con este ID',
            errorCode: AGENT_ERROR_CODES.DUPLICATE_AGENT_ID,
          };
        }
        return {
          success: false,
          error: error.message,
          errorCode: AGENT_ERROR_CODES.DATABASE_ERROR,
        };
      }

      // Build webhook URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';
      const webhookUrl = `${baseUrl}/api/agent/sync`;

      // Transform to interface type
      const agentInstance = this.transformAgentRow(agent);

      // Return credentials (shown only once!)
      const credentials: AgentCredentials = {
        agent_id: agentId,
        auth_token: authToken, // Plain text, shown once
        webhook_url: webhookUrl,
        expires_at: tokenExpiresAt.toISOString(),
      };

      return {
        success: true,
        agent: agentInstance,
        credentials,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        errorCode: AGENT_ERROR_CODES.UNKNOWN_ERROR,
      };
    }
  }

  // ======================
  // TOKEN VALIDATION
  // ======================

  /**
   * Validates agent token and returns context.
   * Used by all agent API endpoints.
   */
  async validateToken(agentId: string, authToken: string): Promise<ValidateTokenResult> {
    try {
      // Hash the provided token
      const tokenHash = crypto
        .createHash('sha256')
        .update(authToken)
        .digest('hex');

      // Call RPC function
      const { data, error } = await this.supabase.rpc('validate_agent_token', {
        p_agent_id: agentId,
        p_token_hash: tokenHash,
      });

      if (error) {
        return {
          isValid: false,
          errorCode: AGENT_ERROR_CODES.DATABASE_ERROR,
        };
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result || !result.is_valid) {
        return {
          isValid: false,
          errorCode: result?.error_code || AGENT_ERROR_CODES.INVALID_CREDENTIALS,
        };
      }

      // Parse sync config from JSONB
      const syncConfig = result.sync_config || {};

      return {
        isValid: true,
        context: {
          tenantId: result.tenant_id,
          integrationId: result.integration_id,
          branchId: result.branch_id || undefined,
          status: result.status as AgentStatus,
          syncConfig: {
            syncIntervalSeconds: syncConfig.sync_interval_seconds || 300,
            syncMenu: syncConfig.sync_menu || false,
            syncInventory: syncConfig.sync_inventory || false,
            syncSales: syncConfig.sync_sales || false,
            syncTables: syncConfig.sync_tables || false,
            storeCode: syncConfig.store_code || '',  // For multi-branch SQL filtering
          },
          tenantName: result.tenant_name || '',
        },
      };
    } catch (err) {
      return {
        isValid: false,
        errorCode: AGENT_ERROR_CODES.UNKNOWN_ERROR,
      };
    }
  }

  // ======================
  // AGENT REGISTRATION
  // ======================

  /**
   * Registers agent after installation.
   * Updates agent info and sets status to 'registered'.
   */
  async registerAgent(
    agentId: string,
    request: AgentRegistrationRequest
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> {
    try {
      const { error } = await this.supabase
        .from('agent_instances')
        .update({
          agent_version: request.agent_version,
          machine_name: request.machine_name,
          sr_version: request.sr_version || null,
          sr_database_name: request.sr_database_name || null,
          sr_sql_instance: request.sr_sql_instance || null,
          sr_empresa_id: request.sr_empresa_id || null,
          status: 'registered',
          last_heartbeat_at: new Date().toISOString(),
        })
        .eq('agent_id', agentId);

      if (error) {
        return {
          success: false,
          error: error.message,
          errorCode: AGENT_ERROR_CODES.DATABASE_ERROR,
        };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        errorCode: AGENT_ERROR_CODES.UNKNOWN_ERROR,
      };
    }
  }

  // ======================
  // HEARTBEAT
  // ======================

  /**
   * Records heartbeat from agent.
   */
  async recordHeartbeat(
    agentId: string,
    request: AgentHeartbeatRequest
  ): Promise<HeartbeatResult> {
    try {
      // Map client status to DB status
      const statusMap: Record<string, AgentStatus> = {
        healthy: 'connected',
        degraded: 'connected',
        error: 'error',
      };
      const dbStatus = statusMap[request.status] || 'connected';

      // Call RPC function
      const { data, error } = await this.supabase.rpc('record_agent_heartbeat', {
        p_agent_id: agentId,
        p_status: dbStatus,
        p_last_sync_records: request.records_since_last_heartbeat || null,
        p_error_message: request.error_message || null,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: data === true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ======================
  // SYNC OPERATIONS
  // ======================

  /**
   * Creates a sync log entry at the start of a sync batch.
   */
  async createSyncLog(
    agentId: string,
    tenantId: string,
    request: AgentSyncRequest
  ): Promise<CreateSyncLogResult> {
    try {
      // Update agent status to syncing
      await this.supabase
        .from('agent_instances')
        .update({ status: 'syncing' })
        .eq('agent_id', agentId);

      // Create sync log entry
      const { data, error } = await this.supabase
        .from('agent_sync_logs')
        .insert({
          agent_id: agentId,
          tenant_id: tenantId,
          sync_type: request.sync_type,
          batch_id: request.batch_id,
          batch_index: request.batch_number,
          batch_total: request.total_batches,
          status: 'started',
          records_received: request.records?.length || 0,
          raw_payload_size_bytes: JSON.stringify(request.records || []).length,
        })
        .select('id')
        .single();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        logId: data.id,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Completes a sync log entry after processing.
   */
  async completeSyncLog(
    logId: string,
    result: {
      status: 'completed' | 'partial' | 'failed';
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsSkipped: number;
      recordsFailed: number;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      failedRecords?: unknown[];
    }
  ): Promise<CompleteSyncResult> {
    try {
      const { error } = await this.supabase.rpc('complete_agent_sync', {
        p_log_id: logId,
        p_status: result.status,
        p_records_processed: result.recordsProcessed,
        p_records_created: result.recordsCreated,
        p_records_updated: result.recordsUpdated,
        p_records_skipped: result.recordsSkipped,
        p_records_failed: result.recordsFailed,
        p_error_message: result.errorMessage || null,
        p_error_details: result.errorDetails || null,
        p_failed_records: result.failedRecords || null,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ======================
  // QUERIES
  // ======================

  /**
   * Gets agent by ID.
   */
  async getAgent(agentId: string): Promise<AgentInstance | null> {
    const { data, error } = await this.supabase
      .from('agent_instances')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.transformAgentRow(data);
  }

  /**
   * Gets agent by internal UUID.
   */
  async getAgentById(id: string): Promise<AgentInstance | null> {
    const { data, error } = await this.supabase
      .from('agent_instances')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.transformAgentRow(data);
  }

  /**
   * Lists all agents for a tenant.
   */
  async listAgents(
    tenantId: string,
    filters?: {
      status?: AgentStatus;
      branchId?: string;
      integrationId?: string;
    }
  ): Promise<AgentInstance[]> {
    let query = this.supabase
      .from('agent_instances')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }
    if (filters?.integrationId) {
      query = query.eq('integration_id', filters.integrationId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.transformAgentRow(row));
  }

  /**
   * Gets aggregated stats for a tenant.
   */
  async getAgentStats(tenantId: string): Promise<AgentStats | null> {
    const { data, error } = await this.supabase.rpc('get_agent_stats', {
      p_tenant_id: tenantId,
    });

    if (error) {
      return null;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return {
        totalAgents: 0,
        connectedAgents: 0,
        syncingAgents: 0,
        errorAgents: 0,
        offlineAgents: 0,
        totalRecordsSynced: 0,
        syncsToday: 0,
        syncsFailedToday: 0,
        lastSyncAt: null,
        avgSyncDurationMs: null,
      };
    }

    return {
      totalAgents: result.total_agents || 0,
      connectedAgents: result.connected_agents || 0,
      syncingAgents: result.syncing_agents || 0,
      errorAgents: result.error_agents || 0,
      offlineAgents: result.offline_agents || 0,
      totalRecordsSynced: result.total_records_synced || 0,
      syncsToday: result.syncs_today || 0,
      syncsFailedToday: result.syncs_failed_today || 0,
      lastSyncAt: result.last_sync_at || null,
      avgSyncDurationMs: result.avg_sync_duration_ms || null,
    };
  }

  /**
   * Gets sync logs for an agent.
   */
  async getSyncLogs(
    agentId: string,
    limit: number = 50
  ): Promise<SyncLogEntry[]> {
    const { data, error } = await this.supabase
      .from('agent_sync_logs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      tenantId: row.tenant_id,
      syncType: row.sync_type,
      batchId: row.batch_id,
      batchIndex: row.batch_index,
      batchTotal: row.batch_total,
      status: row.status,
      recordsReceived: row.records_received || 0,
      recordsProcessed: row.records_processed || 0,
      recordsCreated: row.records_created || 0,
      recordsUpdated: row.records_updated || 0,
      recordsSkipped: row.records_skipped || 0,
      recordsFailed: row.records_failed || 0,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      durationMs: row.duration_ms || undefined,
      errorMessage: row.error_message || undefined,
      createdAt: row.created_at,
    }));
  }

  // ======================
  // AGENT MANAGEMENT
  // ======================

  /**
   * Updates agent status.
   */
  async updateAgentStatus(
    agentId: string,
    status: AgentStatus
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('agent_instances')
      .update({ status })
      .eq('agent_id', agentId);

    return !error;
  }

  /**
   * Updates agent sync configuration.
   * Now supports storeCode and branchId for multi-branch configurations.
   *
   * @param agentId - The agent's unique identifier
   * @param config - Partial configuration to update
   * @param tenantId - Optional tenant ID for RLS validation (recommended)
   */
  async updateAgentConfig(
    agentId: string,
    config: Partial<{
      syncIntervalSeconds: number;
      syncMenu: boolean;
      syncInventory: boolean;
      syncSales: boolean;
      syncTables: boolean;
      storeCode: string | null;  // For multi-branch SQL filtering
      branchId: string | null;   // TIS TIS branch ID
    }>,
    tenantId?: string  // For RLS validation
  ): Promise<boolean> {
    const updateData: Record<string, unknown> = {};

    if (config.syncIntervalSeconds !== undefined) {
      updateData.sync_interval_seconds = config.syncIntervalSeconds;
    }
    if (config.syncMenu !== undefined) {
      updateData.sync_menu = config.syncMenu;
    }
    if (config.syncInventory !== undefined) {
      updateData.sync_inventory = config.syncInventory;
    }
    if (config.syncSales !== undefined) {
      updateData.sync_sales = config.syncSales;
    }
    if (config.syncTables !== undefined) {
      updateData.sync_tables = config.syncTables;
    }
    // Multi-branch support
    if (config.storeCode !== undefined) {
      // Validate storeCode: alphanumeric, underscores, hyphens only (max 50 chars)
      if (config.storeCode !== null) {
        const sanitized = config.storeCode.trim().slice(0, 50);
        if (!/^[a-zA-Z0-9_-]*$/.test(sanitized)) {
          console.warn('[AgentManager] Invalid storeCode format, skipping:', sanitized);
        } else {
          updateData.store_code = sanitized || null;
        }
      } else {
        updateData.store_code = null;
      }
    }
    if (config.branchId !== undefined) {
      // Validate branchId is a valid UUID if provided
      if (config.branchId !== null) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(config.branchId)) {
          console.warn('[AgentManager] Invalid branchId UUID format, skipping:', config.branchId);
        } else {
          updateData.branch_id = config.branchId;
        }
      } else {
        updateData.branch_id = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return true;
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Build query with optional tenant isolation
    let query = this.supabase
      .from('agent_instances')
      .update(updateData)
      .eq('agent_id', agentId);

    // Add tenant isolation if provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    if (error) {
      console.error('[AgentManager] updateAgentConfig error:', error.message);
    }

    return !error;
  }

  /**
   * Regenerates auth token for an agent.
   * Returns new credentials.
   */
  async regenerateToken(agentId: string): Promise<{
    success: boolean;
    credentials?: AgentCredentials;
    error?: string;
  }> {
    try {
      // Generate new token
      const authToken = crypto.randomBytes(32).toString('hex');
      const authTokenHash = crypto
        .createHash('sha256')
        .update(authToken)
        .digest('hex');

      // Token expires in 30 days
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

      // Update agent
      const { error } = await this.supabase
        .from('agent_instances')
        .update({
          auth_token_hash: authTokenHash,
          token_expires_at: tokenExpiresAt.toISOString(),
        })
        .eq('agent_id', agentId);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';

      return {
        success: true,
        credentials: {
          agent_id: agentId,
          auth_token: authToken,
          webhook_url: `${baseUrl}/api/agent/sync`,
          expires_at: tokenExpiresAt.toISOString(),
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Deletes an agent instance.
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('agent_instances')
      .delete()
      .eq('agent_id', agentId);

    return !error;
  }

  // ======================
  // HELPERS
  // ======================

  /**
   * Transforms database row to AgentInstance interface.
   */
  private transformAgentRow(row: Record<string, unknown>): AgentInstance {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      integration_id: row.integration_id as string,
      branch_id: row.branch_id as string | undefined,
      agent_id: row.agent_id as string,
      agent_version: row.agent_version as string,
      machine_name: row.machine_name as string | undefined,
      status: row.status as AgentStatus,
      sr_version: row.sr_version as string | undefined,
      sr_database_name: row.sr_database_name as string | undefined,
      sr_sql_instance: row.sr_sql_instance as string | undefined,
      sr_empresa_id: row.sr_empresa_id as string | undefined,
      store_code: row.store_code as string | undefined,  // Multi-branch SQL filtering
      sync_interval_seconds: row.sync_interval_seconds as number,
      sync_menu: row.sync_menu as boolean,
      sync_inventory: row.sync_inventory as boolean,
      sync_sales: row.sync_sales as boolean,
      sync_tables: row.sync_tables as boolean,
      last_heartbeat_at: row.last_heartbeat_at as string | undefined,
      last_sync_at: row.last_sync_at as string | undefined,
      last_sync_records: (row.last_sync_records as number) || 0,
      total_records_synced: (row.total_records_synced as number) || 0,
      consecutive_errors: (row.consecutive_errors as number) || 0,
      last_error_message: row.last_error_message as string | undefined,
      last_error_at: row.last_error_at as string | undefined,
      token_expires_at: row.token_expires_at as string | undefined,
      allowed_ips: row.allowed_ips as string[] | undefined,
      metadata: (row.metadata as Record<string, unknown>) || {},
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let instance: AgentManagerService | null = null;

export function getAgentManagerService(): AgentManagerService {
  if (!instance) {
    instance = new AgentManagerService();
  }
  return instance;
}

export { AgentManagerService };
export type { AgentManagerService as AgentManagerServiceType };
