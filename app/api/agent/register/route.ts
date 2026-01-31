// =====================================================
// TIS TIS PLATFORM - Agent Register Endpoint
// POST /api/agent/register
// Registers a TIS TIS Local Agent after installation
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAgentManagerService, AGENT_ERROR_CODES } from '@/src/features/integrations';
import {
  checkRateLimit,
  getClientIP,
  rateLimitExceeded,
  type RateLimitConfig,
} from '@/src/shared/lib/rate-limit';

export const dynamic = 'force-dynamic';

// ======================
// RATE LIMITING CONFIG
// ======================

/** Agent registration: 10 per hour per IP (strict) */
const agentRegisterLimiter: RateLimitConfig = {
  limit: 10,
  windowSeconds: 3600, // 1 hour
  identifier: 'agent-register',
};

// ======================
// VALIDATION
// ======================

interface RegisterRequestBody {
  agent_id: string;
  auth_token: string;
  agent_version: string;
  machine_name: string;
  sr_version?: string;
  sr_database_name?: string;
  sr_sql_instance?: string;
  sr_empresa_id?: string;
}

function validateBody(body: unknown): { valid: boolean; error?: string; data?: RegisterRequestBody } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const data = body as Record<string, unknown>;

  if (!data.agent_id || typeof data.agent_id !== 'string') {
    return { valid: false, error: 'agent_id is required and must be a string' };
  }

  if (!data.auth_token || typeof data.auth_token !== 'string') {
    return { valid: false, error: 'auth_token is required and must be a string' };
  }

  if (!data.agent_version || typeof data.agent_version !== 'string') {
    return { valid: false, error: 'agent_version is required and must be a string' };
  }

  if (!data.machine_name || typeof data.machine_name !== 'string') {
    return { valid: false, error: 'machine_name is required and must be a string' };
  }

  return {
    valid: true,
    data: {
      agent_id: data.agent_id as string,
      auth_token: data.auth_token as string,
      agent_version: data.agent_version as string,
      machine_name: data.machine_name as string,
      sr_version: data.sr_version as string | undefined,
      sr_database_name: data.sr_database_name as string | undefined,
      sr_sql_instance: data.sr_sql_instance as string | undefined,
      sr_empresa_id: data.sr_empresa_id as string | undefined,
    },
  };
}

// ======================
// POST - Register Agent
// ======================

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Rate limit check (10 registrations per hour per IP)
    const rateLimitResult = checkRateLimit(clientIP, agentRegisterLimiter);
    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

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

    const { agent_id, auth_token, ...registrationData } = validation.data;

    // Get service
    const agentService = getAgentManagerService();

    // Validate token first
    const tokenResult = await agentService.validateToken(agent_id, auth_token);

    if (!tokenResult.isValid) {
      const statusCode = tokenResult.errorCode === AGENT_ERROR_CODES.TOKEN_EXPIRED ? 401 : 403;
      return NextResponse.json(
        {
          error: tokenResult.errorCode === AGENT_ERROR_CODES.TOKEN_EXPIRED
            ? 'Token has expired. Please generate new credentials from dashboard.'
            : 'Invalid agent credentials',
          errorCode: tokenResult.errorCode,
        },
        { status: statusCode }
      );
    }

    // Register the agent
    const result = await agentService.registerAgent(agent_id, {
      agent_id,
      agent_version: registrationData.agent_version,
      machine_name: registrationData.machine_name,
      sr_version: registrationData.sr_version,
      sr_database_name: registrationData.sr_database_name,
      sr_sql_instance: registrationData.sr_sql_instance,
      sr_empresa_id: registrationData.sr_empresa_id,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to register agent',
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    // Return success with sync config
    return NextResponse.json({
      success: true,
      message: 'Agent registered successfully',
      status: 'registered',
      sync_config: tokenResult.context?.syncConfig,
      tenant_name: tokenResult.context?.tenantName,
    });

  } catch (error) {
    console.error('[Agent Register] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
