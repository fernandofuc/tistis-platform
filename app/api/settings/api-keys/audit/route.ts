// =====================================================
// TIS TIS PLATFORM - API Keys Audit Log API
// GET: List audit logs for tenant's API keys
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type {
  AuditLogListItem,
  AuditLogListResponse,
  AuditAction,
  AuditStatus,
  AuditSeverity,
} from '@/src/features/api-settings/types';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Valid filter values
const VALID_ACTIONS: AuditAction[] = [
  'api_key.created',
  'api_key.updated',
  'api_key.revoked',
  'api_key.rotated',
  'api_key.viewed',
  'api_key.used',
  'api_key.rate_limited',
  'api_key.auth_failed',
  'api_key.ip_blocked',
  'api_key.scope_denied',
  'api_key.expired',
];

const VALID_STATUSES: AuditStatus[] = ['success', 'failure', 'blocked'];
const VALID_SEVERITIES: AuditSeverity[] = ['info', 'warning', 'error', 'critical'];

// ======================
// HELPER FUNCTIONS
// ======================

function parseActions(actionsParam: string | null): AuditAction[] | null {
  if (!actionsParam) return null;

  const actions = actionsParam.split(',').filter((a): a is AuditAction =>
    VALID_ACTIONS.includes(a as AuditAction)
  );

  return actions.length > 0 ? actions : null;
}

function parseSeverities(severitiesParam: string | null): AuditSeverity[] | null {
  if (!severitiesParam) return null;

  const severities = severitiesParam.split(',').filter((s): s is AuditSeverity =>
    VALID_SEVERITIES.includes(s as AuditSeverity)
  );

  return severities.length > 0 ? severities : null;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ======================
// GET - List audit logs
// ======================
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver los logs de auditoría' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const keyId = searchParams.get('key_id');
    const actionsParam = searchParams.get('action');
    const statusParam = searchParams.get('status');
    const severityParam = searchParams.get('severity');
    const actorType = searchParams.get('actor_type');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate key_id if provided
    if (keyId && !isValidUUID(keyId)) {
      return NextResponse.json(
        { error: 'ID de API Key inválido' },
        { status: 400 }
      );
    }

    // Parse limit and offset
    const limit = Math.min(
      Math.max(parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);

    // Parse filters
    const actions = parseActions(actionsParam);
    const severities = parseSeverities(severityParam);
    const status = statusParam && VALID_STATUSES.includes(statusParam as AuditStatus)
      ? statusParam as AuditStatus
      : null;

    // Build query
    let query = supabase
      .from('api_key_audit_logs')
      .select(
        `
        id,
        action,
        status,
        severity,
        actor_email,
        actor_type,
        resource_id,
        ip_address,
        created_at,
        metadata
        `,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (keyId) {
      query = query.eq('resource_id', keyId);
    }

    if (actions && actions.length > 0) {
      query = query.in('action', actions);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (severities && severities.length > 0) {
      query = query.in('severity', severities);
    }

    if (actorType && ['user', 'system', 'api_key'].includes(actorType)) {
      query = query.eq('actor_type', actorType);
    }

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }

    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('[Audit Logs API] GET error:', error);
      return NextResponse.json(
        { error: 'Error al obtener los logs de auditoría' },
        { status: 500 }
      );
    }

    // Transform to list items
    const logsList: AuditLogListItem[] = (logs || []).map((log) => ({
      id: log.id,
      action: log.action,
      status: log.status,
      severity: log.severity,
      actor_email: log.actor_email,
      actor_type: log.actor_type,
      resource_id: log.resource_id,
      ip_address: log.ip_address,
      created_at: log.created_at,
      metadata: {
        key_name: log.metadata?.key_name,
        key_hint: log.metadata?.key_hint,
        endpoint: log.metadata?.endpoint,
        error_message: log.metadata?.error_message,
      },
    }));

    const total = count || 0;
    const response: AuditLogListResponse = {
      logs: logsList,
      total,
      has_more: offset + limit < total,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Audit Logs API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener los logs de auditoría' },
      { status: 500 }
    );
  }
}
