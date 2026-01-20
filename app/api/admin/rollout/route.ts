/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout API Endpoint
 *
 * Admin API for managing Voice Agent v2 rollout:
 * - GET: Get rollout status and health
 * - POST: Execute rollout actions (advance, rollback, tenant control)
 *
 * @module app/api/admin/rollout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getRolloutService,
  getRolloutStatus,
  performRolloutHealthCheck,
  advanceRollout,
  executeRollback,
  updateTenantRolloutStatus,
  getRolloutHistory,
  getTenantRolloutStats,
} from '@/lib/voice-agent/rollout';
import type {
  RolloutStage,
  AdvanceRolloutCommand,
  RollbackCommand,
  TenantRolloutCommand,
} from '@/lib/voice-agent/rollout';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Create Supabase client with service role
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verify admin access from JWT
 */
async function verifyAdminAccess(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  const supabase = createServiceClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { valid: false, error: 'Invalid token' };
  }

  // Check if user is platform admin
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['platform_admin', 'super_admin', 'admin', 'owner'])
    .single();

  if (!role) {
    return { valid: false, error: 'Admin access required' };
  }

  return {
    valid: true,
    userId: user.id,
    email: user.email,
  };
}

// =====================================================
// GET - Get rollout status
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const section = url.searchParams.get('section'); // 'status', 'health', 'history', 'tenants', 'all'
    const includeHealth = url.searchParams.get('includeHealth') === 'true';

    const response: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    };

    switch (section) {
      case 'status':
        response.status = await getRolloutStatus();
        break;

      case 'health':
        response.health = await performRolloutHealthCheck();
        break;

      case 'history':
        const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
        response.history = await getRolloutHistory(limit);
        break;

      case 'tenants':
        response.tenants = await getTenantRolloutStats();
        break;

      case 'all':
      default:
        // Return comprehensive rollout data
        const [status, tenantStats, history] = await Promise.all([
          getRolloutStatus(),
          getTenantRolloutStats(),
          getRolloutHistory(10),
        ]);

        // Get stage config for current stage
        const { DEFAULT_STAGE_CONFIGS } = await import('@/lib/voice-agent/rollout');
        const stageConfig = DEFAULT_STAGE_CONFIGS[status.currentStage];

        response.status = status;
        response.stageConfig = stageConfig;
        response.tenantInfo = {
          total: tenantStats.total,
          onV2: tenantStats.onV2,
          explicitlyEnabled: tenantStats.explicitlyEnabled,
          explicitlyDisabled: tenantStats.explicitlyDisabled,
        };
        response.history = history;

        // Optionally include health check (can be slow)
        if (includeHealth) {
          response.health = await performRolloutHealthCheck();
        }
        break;
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Rollout API] Failed to get rollout data:', error);
    return NextResponse.json(
      { error: 'Failed to get rollout data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Execute rollout actions
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const initiatedBy = auth.email ?? auth.userId ?? 'admin';

    switch (action) {
      // =====================================================
      // ADVANCE ROLLOUT
      // =====================================================
      case 'advance': {
        const rawTarget = params.target;
        const reason = typeof params.reason === 'string' ? params.reason : 'Manual advancement via API';
        const skipHealthCheck = params.skipHealthCheck === true;

        // Validate target parameter
        if (rawTarget === undefined || rawTarget === null) {
          return NextResponse.json(
            { error: 'Missing target parameter (stage name or percentage)' },
            { status: 400 }
          );
        }

        // Validate target is either a valid stage name or a number 0-100
        const validStages = ['disabled', 'canary', 'early_adopters', 'expansion', 'majority', 'complete'];
        let target: RolloutStage | number;

        if (typeof rawTarget === 'number') {
          if (rawTarget < 0 || rawTarget > 100 || !Number.isFinite(rawTarget)) {
            return NextResponse.json(
              { error: 'Invalid percentage. Must be a number between 0 and 100' },
              { status: 400 }
            );
          }
          target = rawTarget;
        } else if (typeof rawTarget === 'string' && validStages.includes(rawTarget)) {
          target = rawTarget as RolloutStage;
        } else {
          return NextResponse.json(
            { error: `Invalid target. Must be a stage name (${validStages.join(', ')}) or percentage (0-100)` },
            { status: 400 }
          );
        }

        const command: AdvanceRolloutCommand = {
          target,
          initiatedBy,
          reason,
          skipHealthCheck,
        };

        const result = await advanceRollout(command);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error, status: result.newStatus },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'advance',
          newStatus: result.newStatus,
        });
      }

      // =====================================================
      // ROLLBACK
      // =====================================================
      case 'rollback': {
        const rawLevel = params.level;
        const reason = typeof params.reason === 'string' ? params.reason : 'Manual rollback via API';

        // Validate level parameter
        if (!rawLevel || typeof rawLevel !== 'string' || !['tenant', 'partial', 'total'].includes(rawLevel)) {
          return NextResponse.json(
            { error: 'Invalid rollback level. Must be: tenant, partial, or total' },
            { status: 400 }
          );
        }

        const level = rawLevel as 'tenant' | 'partial' | 'total';

        // Validate targetPercentage if provided
        let targetPercentage: number | undefined;
        if (params.targetPercentage !== undefined) {
          if (typeof params.targetPercentage !== 'number' || params.targetPercentage < 0 || params.targetPercentage > 100) {
            return NextResponse.json(
              { error: 'Invalid targetPercentage. Must be a number between 0 and 100' },
              { status: 400 }
            );
          }
          targetPercentage = params.targetPercentage;
        }

        // Validate tenant ID for tenant-level rollback
        let tenantId: string | undefined;
        if (level === 'tenant') {
          if (!params.tenantId || typeof params.tenantId !== 'string') {
            return NextResponse.json(
              { error: 'tenantId required for tenant-level rollback' },
              { status: 400 }
            );
          }
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(params.tenantId)) {
            return NextResponse.json(
              { error: 'Invalid tenantId format. Must be a valid UUID' },
              { status: 400 }
            );
          }
          tenantId = params.tenantId;
        }

        const command: RollbackCommand = {
          level,
          targetPercentage,
          tenantId,
          initiatedBy,
          reason,
        };

        const result = await executeRollback(command);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error, status: result.newStatus },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'rollback',
          level,
          newStatus: result.newStatus,
        });
      }

      // =====================================================
      // TENANT CONTROL
      // =====================================================
      case 'enableTenant':
      case 'disableTenant': {
        const tenantId = params.tenantId;
        const reason = typeof params.reason === 'string' ? params.reason : `Tenant ${action === 'enableTenant' ? 'enabled' : 'disabled'} via API`;

        // Validate tenantId is a non-empty string (UUID format)
        if (!tenantId || typeof tenantId !== 'string') {
          return NextResponse.json(
            { error: 'Missing or invalid tenantId parameter' },
            { status: 400 }
          );
        }

        // Basic UUID validation (Supabase uses UUIDs for IDs)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(tenantId)) {
          return NextResponse.json(
            { error: 'Invalid tenantId format. Must be a valid UUID' },
            { status: 400 }
          );
        }

        const command: TenantRolloutCommand = {
          tenantId,
          action: action === 'enableTenant' ? 'enable' : 'disable',
          initiatedBy,
          reason,
        };

        const result = await updateTenantRolloutStatus(command);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error, status: result.newStatus },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          action,
          tenantId,
          newStatus: result.newStatus,
        });
      }

      // =====================================================
      // HEALTH CHECK
      // =====================================================
      case 'healthCheck': {
        const health = await performRolloutHealthCheck();
        return NextResponse.json({
          success: true,
          action: 'healthCheck',
          health,
        });
      }

      // =====================================================
      // SET PERCENTAGE (direct)
      // =====================================================
      case 'setPercentage': {
        const percentage = params.percentage;
        const reason = params.reason ?? 'Manual percentage set via API';

        if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
          return NextResponse.json(
            { error: 'Invalid percentage. Must be 0-100' },
            { status: 400 }
          );
        }

        const command: AdvanceRolloutCommand = {
          target: percentage,
          initiatedBy,
          reason,
          skipHealthCheck: params.skipHealthCheck === true,
        };

        const result = await advanceRollout(command);

        if (!result.success) {
          return NextResponse.json(
            { error: result.error, status: result.newStatus },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'setPercentage',
          percentage,
          newStatus: result.newStatus,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Rollout API] Failed to execute action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute action' },
      { status: 500 }
    );
  }
}
