// =====================================================
// TIS TIS PLATFORM - Generate Report API Route
// Generates PDF reports from analytics data
// Fixed: UUID validation, rate limiting
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import {
  checkRateLimit,
  getClientIP,
  rateLimitExceeded,
  addRateLimitHeaders,
} from '@/src/shared/lib/rate-limit';
import { getReportGeneratorService } from '@/src/features/reports';
import type { ReportPeriod, ReportType } from '@/src/features/reports';

// ======================
// RATE LIMIT CONFIG
// ======================

const REPORT_RATE_LIMIT = {
  limit: 10,           // 10 reports
  windowSeconds: 3600, // per hour
  identifier: 'reports-generate',
};

// ======================
// VALIDATION
// ======================

const VALID_PERIODS: ReportPeriod[] = ['7d', '30d', '90d'];
const VALID_TYPES: ReportType[] = [
  'resumen',
  'ventas',
  'operaciones',
  'inventario',
  'clientes',
  'ai_insights',
];

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPeriod(period: unknown): period is ReportPeriod {
  return typeof period === 'string' && VALID_PERIODS.includes(period as ReportPeriod);
}

function isValidType(type: unknown): type is ReportType {
  return typeof type === 'string' && VALID_TYPES.includes(type as ReportType);
}

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// ======================
// POST - Generate Report
// ======================

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (check before auth to prevent abuse)
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, REPORT_RATE_LIMIT);

    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    // Authenticate
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId } = authResult;

    // Parse request body
    const body = await request.json();
    const { period, type, branchId } = body;

    // Validate period
    if (!isValidPeriod(period)) {
      return NextResponse.json(
        {
          error: 'Invalid period',
          message: `Period must be one of: ${VALID_PERIODS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate type
    if (!isValidType(type)) {
      return NextResponse.json(
        {
          error: 'Invalid report type',
          message: `Type must be one of: ${VALID_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate branchId if provided (must be valid UUID)
    if (branchId !== undefined && branchId !== null && branchId !== '') {
      if (!isValidUUID(branchId)) {
        return NextResponse.json(
          {
            error: 'Invalid branch ID',
            message: 'Branch ID must be a valid UUID',
          },
          { status: 400 }
        );
      }
    }

    // Generate report
    const reportService = getReportGeneratorService();
    const result = await reportService.generateReport(tenantId, {
      period,
      type,
      branchId: branchId || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Report generation failed',
          message: result.error,
        },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      pdfUrl: result.pdfUrl,
      filename: result.filename,
    });

    // Add rate limit headers to response
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('[API reports/generate] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}
