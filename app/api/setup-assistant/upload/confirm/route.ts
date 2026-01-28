// =====================================================
// TIS TIS PLATFORM - Setup Assistant Confirm Upload
// POST: Confirm direct upload and get signed URL for reading
// Called after successful direct upload to Storage
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
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Request body type
interface ConfirmUploadRequest {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
}

// ======================
// POST - Confirm upload and get signed URL
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
    let body: ConfirmUploadRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { path, filename, mimeType, size } = body;

    // Validate required fields
    if (!path || !filename || !mimeType || !size) {
      return NextResponse.json(
        { error: 'Missing required fields: path, filename, mimeType, size' },
        { status: 400 }
      );
    }

    // Verify the path belongs to this tenant/user (security check)
    const expectedPrefix = `${tenantId}/${user.id}/`;
    if (!path.startsWith(expectedPrefix)) {
      console.warn('[SetupAssistant] Path mismatch:', { path, expectedPrefix });
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    const supabaseAdmin = createServerClient();

    // Verify file exists in storage
    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from('setup-assistant-uploads')
      .list(path.split('/').slice(0, -1).join('/'), {
        search: path.split('/').pop(),
      });

    if (fileError) {
      console.error('[SetupAssistant] Error verifying file:', fileError);
      return NextResponse.json(
        { error: 'Error al verificar archivo' },
        { status: 500 }
      );
    }

    const uploadedFile = fileData?.find(f => path.endsWith(f.name));
    if (!uploadedFile) {
      return NextResponse.json(
        { error: 'Archivo no encontrado. El upload pudo haber fallado o expirado.' },
        { status: 404 }
      );
    }

    // For images, validate content with magic numbers
    if (ALLOWED_IMAGE_MIMES.includes(mimeType)) {
      // Download the file to validate
      const { data: fileContent, error: downloadError } = await supabaseAdmin.storage
        .from('setup-assistant-uploads')
        .download(path);

      if (downloadError || !fileContent) {
        console.error('[SetupAssistant] Error downloading for validation:', downloadError);
        return NextResponse.json(
          { error: 'Error al validar imagen' },
          { status: 500 }
        );
      }

      const buffer = await fileContent.arrayBuffer();
      const validationResult = await imageValidatorService.validateImage(
        buffer,
        mimeType,
        {
          maxFileSize: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_IMAGE_MIMES,
          maxWidth: 8192,
          maxHeight: 8192,
          minWidth: 10,
          minHeight: 10,
        }
      );

      if (!validationResult.valid) {
        // Delete invalid file
        await supabaseAdmin.storage
          .from('setup-assistant-uploads')
          .remove([path]);

        console.warn('[SetupAssistant] Image validation failed:', validationResult.errors);
        return NextResponse.json(
          {
            error: 'Validación de imagen fallida',
            code: 'INVALID_IMAGE',
            details: validationResult.errors,
          },
          { status: 400 }
        );
      }

      // Log validation success
      console.log('[SetupAssistant] Image validated:', {
        format: validationResult.metadata?.format,
        dimensions: `${validationResult.metadata?.width}x${validationResult.metadata?.height}`,
        size: validationResult.metadata?.fileSize,
      });
    }

    // Get signed URL for reading (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('setup-assistant-uploads')
      .createSignedUrl(path, 3600);

    if (signedUrlError) {
      console.error('[SetupAssistant] Error creating signed URL:', signedUrlError);
      return NextResponse.json(
        { error: 'Error al generar URL de lectura' },
        { status: 500 }
      );
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
      // Don't fail the request, just log
    }

    // Build response
    const response: UploadResponse = {
      url: signedUrlData?.signedUrl || path,
      filename: filename,
      mimeType: mimeType,
      size: size,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[SetupAssistant] Confirm upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
