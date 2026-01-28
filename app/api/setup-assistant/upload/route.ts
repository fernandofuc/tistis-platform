// =====================================================
// TIS TIS PLATFORM - Setup Assistant File Upload
// POST: Upload file for analysis
// Now with server-side image validation (magic numbers)
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
import type { UploadResponse } from '@/src/features/setup-assistant';
import { imageValidatorService } from '@/src/features/setup-assistant/services/image-validator.service';

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

// Map file extensions to MIME types for fallback detection
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

// ======================
// POST - Upload file
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

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type - use extension fallback if MIME not recognized
    let detectedMimeType = file.type;

    // If browser sends generic MIME or empty, try to detect from extension
    if (!detectedMimeType || detectedMimeType === 'application/octet-stream') {
      const extension = file.name?.split('.').pop()?.toLowerCase();
      if (extension && EXTENSION_TO_MIME[extension]) {
        detectedMimeType = EXTENSION_TO_MIME[extension];
      }
    }

    if (!ALLOWED_MIME_TYPES.includes(detectedMimeType)) {
      console.warn('[SetupAssistant] File type not allowed:', {
        originalType: file.type,
        detectedType: detectedMimeType,
        filename: file.name,
      });
      return NextResponse.json(
        {
          error: 'Tipo de archivo no permitido',
          allowedTypes: ['Imágenes (PNG, JPG, GIF, WebP)', 'Documentos (PDF, DOC, DOCX, TXT, CSV, XLSX, MD)'],
          providedType: file.type || 'desconocido',
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          maxSize: MAX_FILE_SIZE,
          maxSizeMB: MAX_FILE_SIZE / (1024 * 1024),
          providedSize: file.size,
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
          error: 'Daily file upload limit reached',
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
    // Path pattern: {tenant_id}/{user_id}/{timestamp}-{uuid}.{extension}
    const originalName = file.name || 'file';
    const extension = originalName.split('.').pop()?.toLowerCase() || 'bin';
    const safeExtension = extension.replace(/[^a-z0-9]/gi, '').slice(0, 10);
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID();
    const filename = `${tenantId}/${user.id}/${timestamp}-${uniqueId}.${safeExtension}`;

    // Read file content
    const buffer = await file.arrayBuffer();

    // =====================================================
    // SERVER-SIDE VALIDATION (Magic Number + Dimensions)
    // =====================================================

    // Only validate image files (skip PDFs and text)
    if (detectedMimeType.startsWith('image/')) {
      const validationResult = await imageValidatorService.validateImage(
        buffer,
        detectedMimeType,
        {
          maxFileSize: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_MIME_TYPES.filter(t => t.startsWith('image/')),
          maxWidth: 8192,
          maxHeight: 8192,
          minWidth: 10,
          minHeight: 10,
        }
      );

      if (!validationResult.valid) {
        console.warn('[SetupAssistant] Image validation failed:', validationResult.errors);
        return NextResponse.json(
          {
            error: 'Image validation failed',
            code: 'INVALID_IMAGE',
            details: validationResult.errors,
            metadata: validationResult.metadata,
          },
          { status: 400 }
        );
      }

      // Log warnings but allow upload
      if (validationResult.warnings.length > 0) {
        console.warn('[SetupAssistant] Image validation warnings:', validationResult.warnings);
      }

      // Log validated metadata
      console.log('[SetupAssistant] Image validated:', {
        format: validationResult.metadata?.format,
        dimensions: `${validationResult.metadata?.width}x${validationResult.metadata?.height}`,
        size: validationResult.metadata?.fileSize,
      });
    }

    // Upload to Supabase Storage using admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('setup-assistant-uploads')
      .upload(filename, buffer, {
        contentType: detectedMimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[SetupAssistant] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Error al subir archivo' },
        { status: 500 }
      );
    }

    // Get signed URL for private bucket (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('setup-assistant-uploads')
      .createSignedUrl(filename, 3600);

    if (signedUrlError) {
      console.error('[SetupAssistant] Error creating signed URL:', signedUrlError);
      // Fallback to path-based URL (won't be accessible without auth)
    }

    // Increment file usage counter
    const { error: incrementError } = await supabaseAdmin.rpc('increment_setup_usage', {
      p_tenant_id: tenantId,
      p_messages: 0,
      p_files: 1,
      p_vision: 0,
      p_input_tokens: 0,
      p_output_tokens: 0,
    });

    if (incrementError) {
      console.error('[SetupAssistant] Error incrementing usage:', incrementError);
    }

    // Build response
    const response: UploadResponse = {
      url: signedUrlData?.signedUrl || `${uploadData.path}`,
      filename: originalName,
      mimeType: detectedMimeType,
      size: file.size,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[SetupAssistant] Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
