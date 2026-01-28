// =====================================================
// TIS TIS PLATFORM - Setup Assistant Presigned Upload URL
// POST: Generate presigned URL for direct upload to Storage
// This bypasses Vercel's 4.5MB body limit by uploading directly
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { createServerClient } from '@/src/shared/lib/supabase';
import {
  checkRateLimit,
  getClientIP,
  aiLimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PRESIGNED_URL_EXPIRY = 60; // 60 seconds to upload

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  // Microsoft Office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Map file extensions to MIME types
const EXTENSION_TO_MIME: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'gif': 'image/gif',
  'pdf': 'application/pdf',
  'txt': 'text/plain',
  'csv': 'text/csv',
  'md': 'text/markdown',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Request body type
interface PresignedUploadRequest {
  filename: string;
  mimeType: string;
  size: number;
}

// Response type
interface PresignedUploadResponse {
  uploadUrl: string;
  path: string;
  token: string;
  expiresAt: string;
}

// ======================
// POST - Generate presigned upload URL
// ======================
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, aiLimiter);
    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId, user } = authResult;

    // Parse request body
    let body: PresignedUploadRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { filename, mimeType, size } = body;

    // Validate required fields
    if (!filename || !mimeType || !size) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, mimeType, size' },
        { status: 400 }
      );
    }

    // Validate file size (must be positive and within limits)
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        {
          error: 'Tamaño de archivo inválido',
          code: 'INVALID_FILE_SIZE',
          providedSize: size,
        },
        { status: 400 }
      );
    }

    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'Archivo demasiado grande',
          code: 'FILE_TOO_LARGE',
          maxSize: MAX_FILE_SIZE,
          maxSizeMB: MAX_FILE_SIZE / (1024 * 1024),
          providedSize: size,
        },
        { status: 400 }
      );
    }

    // Validate and detect MIME type
    let detectedMimeType = mimeType;

    // If browser sends generic MIME or empty, try to detect from extension
    if (!detectedMimeType || detectedMimeType === 'application/octet-stream') {
      const extension = filename?.split('.').pop()?.toLowerCase();
      if (extension && EXTENSION_TO_MIME[extension]) {
        detectedMimeType = EXTENSION_TO_MIME[extension];
      }
    }

    if (!ALLOWED_MIME_TYPES.includes(detectedMimeType)) {
      return NextResponse.json(
        {
          error: 'Tipo de archivo no permitido',
          code: 'INVALID_FILE_TYPE',
          allowedTypes: ['Imágenes (PNG, JPG, GIF, WebP)', 'Documentos (PDF, DOC, DOCX, TXT, CSV, XLSX, MD)'],
          providedType: mimeType || 'desconocido',
        },
        { status: 400 }
      );
    }

    // Check file upload limit using service client
    const supabaseAdmin = createServerClient();
    const { data: usageData, error: usageError } = await supabaseAdmin.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (usageError) {
      console.error('[SetupAssistant] Error checking usage:', usageError);
    }

    const usage = usageData?.[0];
    if (usage && usage.files_uploaded >= usage.files_limit) {
      return NextResponse.json(
        {
          error: 'Límite diario de archivos alcanzado',
          code: 'LIMIT_REACHED',
          usage: {
            filesUploaded: usage.files_uploaded,
            filesLimit: usage.files_limit,
            planId: usage.plan_id,
            resetAt: usage.reset_at,
          },
        },
        { status: 429 }
      );
    }

    // Generate secure filename
    const originalName = filename || 'file';
    const extension = originalName.split('.').pop()?.toLowerCase() || 'bin';
    const safeExtension = extension.replace(/[^a-z0-9]/gi, '').slice(0, 10);
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID();
    const storagePath = `${tenantId}/${user.id}/${timestamp}-${uniqueId}.${safeExtension}`;

    // Create presigned upload URL
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('setup-assistant-uploads')
      .createSignedUploadUrl(storagePath);

    if (signedError || !signedData) {
      console.error('[SetupAssistant] Error creating presigned URL:', signedError);
      return NextResponse.json(
        { error: 'Error al generar URL de subida' },
        { status: 500 }
      );
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString();

    const response: PresignedUploadResponse = {
      uploadUrl: signedData.signedUrl,
      path: signedData.path,
      token: signedData.token,
      expiresAt,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[SetupAssistant] Presigned URL error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
