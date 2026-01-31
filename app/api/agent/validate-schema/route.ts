// =====================================================
// TIS TIS PLATFORM - Agent Schema Validation API
// POST /api/agent/validate-schema
// Validates Soft Restaurant database schema before first sync
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  getSchemaValidatorService,
} from '@/src/features/integrations/services/schema-validator.service';
import type {
  ValidateSchemaRequest,
} from '@/src/features/integrations/types/schema-validation.types';

// ======================
// TYPES
// ======================

interface ValidationRequestBody {
  agent_id: string;
  database_name: string;
  sql_server_version?: string;
  tables: Array<{
    table_name: string;
    schema_name: string;
    columns: Array<{
      column_name: string;
      data_type: string;
      is_nullable: boolean;
    }>;
  }>;
}

interface ValidateAgentTokenResult {
  is_valid: boolean;
  tenant_id?: string;
  error_code?: string;
}

// ======================
// HELPERS
// ======================

/**
 * Validates agent token from Authorization header
 */
async function validateAgentToken(
  supabaseUrl: string,
  supabaseKey: string,
  agentId: string,
  authToken: string
): Promise<{
  isValid: boolean;
  tenantId?: string;
  errorCode?: string;
}> {
  // Hash the provided token
  const tokenHash = crypto
    .createHash('sha256')
    .update(authToken)
    .digest('hex');

  // Create a fresh client for RPC call
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Call RPC function with explicit typing
  const { data, error } = await supabase.rpc('validate_agent_token', {
    p_agent_id: agentId,
    p_token_hash: tokenHash,
  } as unknown as Record<string, unknown>);

  if (error) {
    console.error('[validate-schema] Token validation error:', error.message);
    return { isValid: false, errorCode: 'DATABASE_ERROR' };
  }

  const result = (Array.isArray(data) ? data[0] : data) as ValidateAgentTokenResult | null;

  if (!result || !result.is_valid) {
    return {
      isValid: false,
      errorCode: result?.error_code || 'INVALID_CREDENTIALS',
    };
  }

  return {
    isValid: true,
    tenantId: result.tenant_id,
  };
}

/**
 * Extracts agent credentials from request
 */
function extractCredentials(
  request: NextRequest
): { agentId: string | null; authToken: string | null } {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Format: agent_id:auth_token
    const parts = token.split(':');
    if (parts.length === 2) {
      return { agentId: parts[0], authToken: parts[1] };
    }
    return { agentId: null, authToken: token };
  }

  // Try X-Agent-Id header
  const agentId = request.headers.get('x-agent-id');
  const authToken = request.headers.get('x-auth-token');

  return { agentId, authToken };
}

// ======================
// POST HANDLER
// ======================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[validate-schema] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Extract credentials
    const { agentId, authToken } = extractCredentials(request);

    if (!agentId || !authToken) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          errorCode: 'MISSING_CREDENTIALS',
          message: 'Provide agent credentials via Authorization header or X-Agent-Id/X-Auth-Token headers',
        },
        { status: 401 }
      );
    }

    // Validate token
    const authResult = await validateAgentToken(supabaseUrl, supabaseServiceKey, agentId, authToken);

    if (!authResult.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          errorCode: authResult.errorCode,
        },
        { status: 401 }
      );
    }

    // Parse request body
    let body: ValidationRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.database_name) {
      return NextResponse.json(
        {
          error: 'Missing required field: database_name',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.tables)) {
      return NextResponse.json(
        {
          error: 'Missing required field: tables (array)',
          errorCode: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Validate schema using service
    const validatorService = getSchemaValidatorService();
    const validationRequest: ValidateSchemaRequest = {
      agent_id: agentId,
      database_name: body.database_name,
      sql_server_version: body.sql_server_version,
      tables: body.tables,
    };

    const validationResult = validatorService.validateSchema(validationRequest);

    // Generate UI summary
    const summary = validatorService.generateSummary(validationResult.validation);

    // Update agent metadata with validation results
    const { error: updateError } = await supabase
      .from('agent_instances')
      .update({
        sr_database_name: body.database_name,
        metadata: {
          schema_validation: {
            validated_at: validationResult.validation.validatedAt,
            success: validationResult.success,
            database_name: body.database_name,
            sr_version_detected: validationResult.validation.srVersionDetected,
            tables_found: validationResult.validation.tablesFound,
            tables_missing: validationResult.validation.tablesMissing,
            total_tables_expected: validationResult.validation.totalTablesExpected,
            can_sync_sales: validationResult.validation.canSyncSales,
            can_sync_menu: validationResult.validation.canSyncMenu,
            can_sync_inventory: validationResult.validation.canSyncInventory,
            can_sync_tables: validationResult.validation.canSyncTables,
            errors: validationResult.validation.errors,
            warnings: validationResult.validation.warnings,
            missing_required_tables: validationResult.validation.requiredTablesMissing,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId);

    if (updateError) {
      console.warn('[validate-schema] Failed to update agent metadata:', updateError.message);
    }

    // Log validation result
    console.log(
      `[validate-schema] Agent ${agentId}: ` +
      `${validationResult.success ? 'SUCCESS' : 'FAILED'} - ` +
      `${validationResult.validation.tablesFound}/${validationResult.validation.totalTablesExpected} tables found, ` +
      `SR version: ${validationResult.validation.srVersionDetected || 'unknown'}, ` +
      `duration: ${Date.now() - startTime}ms`
    );

    // Return response
    return NextResponse.json({
      success: validationResult.success,
      validation: {
        ...validationResult.validation,
        // Include only essential table info for response size
        tables: validationResult.validation.tables.map((t) => ({
          tableName: t.tableName,
          exists: t.exists,
          required: t.required,
          usedFor: t.usedFor,
          missingRequiredColumns: t.missingRequiredColumns,
          presentOptionalColumns: t.presentOptionalColumns,
        })),
      },
      summary,
      recommendations: validationResult.recommendations,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[validate-schema] Unexpected error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ======================
// GET HANDLER (for debugging/testing)
// ======================

export async function GET(request: NextRequest) {
  // Return expected schema documentation
  const { SR_EXPECTED_SCHEMA } = await import(
    '@/src/features/integrations/types/schema-validation.types'
  );

  return NextResponse.json({
    message: 'TIS TIS Agent Schema Validation Endpoint',
    method: 'POST',
    description: 'Validates Soft Restaurant database schema compatibility',
    expectedSchema: {
      tablesCount: SR_EXPECTED_SCHEMA.length,
      tables: SR_EXPECTED_SCHEMA.map((t) => ({
        name: `${t.schemaName}.${t.tableName}`,
        required: t.required,
        usedFor: t.usedFor,
        columnsCount: t.columns.length,
        requiredColumns: t.columns.filter((c) => c.required).map((c) => c.name),
      })),
    },
    authentication: {
      methods: [
        'Authorization: Bearer agent_id:auth_token',
        'X-Agent-Id + X-Auth-Token headers',
      ],
    },
    requestBodySchema: {
      agent_id: 'string (required)',
      database_name: 'string (required)',
      sql_server_version: 'string (optional)',
      tables: [
        {
          table_name: 'string',
          schema_name: 'string',
          columns: [
            {
              column_name: 'string',
              data_type: 'string',
              is_nullable: 'boolean',
            },
          ],
        },
      ],
    },
  });
}
