// =====================================================
// TIS TIS PLATFORM - Agent Heartbeat Endpoint
// POST /api/agent/heartbeat
// Receives heartbeat from TIS TIS Local Agent
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAgentManagerService, AGENT_ERROR_CODES } from '@/src/features/integrations';

export const dynamic = 'force-dynamic';

// ======================
// TYPES
// ======================

interface HeartbeatRequestBody {
  agent_id: string;
  auth_token: string;
  status: 'healthy' | 'degraded' | 'error';
  last_sync_at?: string;
  records_since_last_heartbeat?: number;
  cpu_usage?: number;
  memory_usage?: number;
  error_message?: string;
}

// ======================
// VALIDATION
// ======================

function validateBody(body: unknown): { valid: boolean; error?: string; data?: HeartbeatRequestBody } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const data = body as Record<string, unknown>;

  if (!data.agent_id || typeof data.agent_id !== 'string') {
    return { valid: false, error: 'agent_id is required' };
  }

  if (!data.auth_token || typeof data.auth_token !== 'string') {
    return { valid: false, error: 'auth_token is required' };
  }

  const validStatuses = ['healthy', 'degraded', 'error'];
  if (!data.status || !validStatuses.includes(data.status as string)) {
    return { valid: false, error: 'status must be one of: healthy, degraded, error' };
  }

  return {
    valid: true,
    data: {
      agent_id: data.agent_id as string,
      auth_token: data.auth_token as string,
      status: data.status as 'healthy' | 'degraded' | 'error',
      last_sync_at: data.last_sync_at as string | undefined,
      records_since_last_heartbeat: data.records_since_last_heartbeat as number | undefined,
      cpu_usage: data.cpu_usage as number | undefined,
      memory_usage: data.memory_usage as number | undefined,
      error_message: data.error_message as string | undefined,
    },
  };
}

// ======================
// POST - Record Heartbeat
// ======================

export async function POST(request: NextRequest) {
  try {
    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', errorCode: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Validate body
    const validation = validateBody(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error, errorCode: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { agent_id, auth_token, ...heartbeatData } = validation.data;

    // Get service
    const agentService = getAgentManagerService();

    // Validate token
    const tokenResult = await agentService.validateToken(agent_id, auth_token);

    if (!tokenResult.isValid) {
      const statusCode = tokenResult.errorCode === AGENT_ERROR_CODES.TOKEN_EXPIRED ? 401 : 403;
      return NextResponse.json(
        {
          error: tokenResult.errorCode === AGENT_ERROR_CODES.TOKEN_EXPIRED
            ? 'Token has expired'
            : 'Invalid credentials',
          errorCode: tokenResult.errorCode,
        },
        { status: statusCode }
      );
    }

    // Record heartbeat
    const result = await agentService.recordHeartbeat(agent_id, {
      agent_id,
      status: heartbeatData.status,
      last_sync_at: heartbeatData.last_sync_at,
      records_since_last_heartbeat: heartbeatData.records_since_last_heartbeat || 0,
      cpu_usage: heartbeatData.cpu_usage,
      memory_usage: heartbeatData.memory_usage,
      error_message: heartbeatData.error_message,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to record heartbeat',
          errorCode: 'HEARTBEAT_FAILED',
        },
        { status: 500 }
      );
    }

    // Return success with any config updates
    return NextResponse.json({
      success: true,
      sync_config: tokenResult.context?.syncConfig,
      server_time: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Agent Heartbeat] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
