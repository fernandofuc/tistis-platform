// =====================================================
// TIS TIS PLATFORM - Process Ticket API Route
// Extracts data from ticket images using Gemini 2.0 Flash
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getGeminiExtractionService, getInvoiceService } from '@/src/features/invoicing';
import type { ProcessTicketRequest, TicketExtractionStatus } from '@/src/features/invoicing/types';

// ======================
// TYPES
// ======================

interface UserRole {
  tenant_id: string;
  role: string;
}

// ======================
// HELPERS
// ======================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTenantFromUser(supabase: SupabaseClient<any>, userId: string): Promise<UserRole | null> {
  const { data: userRole, error } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !userRole) {
    return null;
  }

  return userRole as UserRole;
}

// ======================
// POST - Process a ticket image
// ======================

export async function POST(request: NextRequest) {
  try {
    // Get authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client with user token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant
    const userRole = await getTenantFromUser(supabase, user.id);
    if (!userRole) {
      return NextResponse.json({ error: 'No tenant found for user' }, { status: 403 });
    }

    // Parse request body
    const body: ProcessTicketRequest = await request.json();

    if (!body.image_url && !body.image_base64) {
      return NextResponse.json(
        { error: 'Either image_url or image_base64 is required' },
        { status: 400 }
      );
    }

    const imageSource = body.image_url || body.image_base64!;

    // Create extraction record first (pending status)
    const invoiceService = getInvoiceService();
    let extraction = await invoiceService.saveExtraction({
      tenant_id: userRole.tenant_id,
      branch_id: body.branch_id || undefined,
      image_url: body.image_url || 'data:image/jpeg;base64,...', // Store URL or placeholder
      status: 'processing',
      created_by: user.id,
    });

    // Process the ticket with Gemini
    const geminiService = getGeminiExtractionService();
    const result = await geminiService.extractFromTicket(imageSource);

    // Update extraction with results
    const status: TicketExtractionStatus = result.data
      ? result.errors.some((e) => e.severity === 'error')
        ? 'failed'
        : 'completed'
      : 'failed';

    extraction = await invoiceService.updateExtraction(extraction.id, {
      status,
      extracted_data: result.data || undefined,
      confidence_score: result.confidence,
      validation_errors: result.errors.length > 0 ? result.errors : undefined,

      // Parsed fields for easy access
      ticket_number: result.data?.ticket_number || undefined,
      ticket_date: result.data?.date || undefined,
      ticket_time: result.data?.time || undefined,
      subtotal_extracted: result.data?.subtotal || undefined,
      tax_extracted: result.data?.tax || undefined,
      total_extracted: result.data?.total || undefined,
      tip_extracted: result.data?.tip || undefined,
      items_extracted: result.data?.items || undefined,
      mesa_extracted: result.data?.table_number || undefined,
      mesero_extracted: result.data?.server_name || undefined,

      // AI metadata
      model_used: 'gemini-2.0-flash-exp',
      tokens_used: result.tokens,
      processing_time_ms: result.processingTime,
    });

    return NextResponse.json({
      extraction_id: extraction.id,
      status: extraction.status,
      extracted_data: result.data,
      confidence_score: result.confidence,
      validation_errors: result.errors,
      processing_time_ms: result.processingTime,
    });
  } catch (error) {
    console.error('Error processing ticket:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ======================
// GET - Get extraction status
// ======================

export async function GET(request: NextRequest) {
  try {
    // Get authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get extraction ID from query params
    const extractionId = request.nextUrl.searchParams.get('id');
    if (!extractionId) {
      return NextResponse.json({ error: 'Extraction ID is required' }, { status: 400 });
    }

    // Get extraction
    const invoiceService = getInvoiceService();
    const extraction = await invoiceService.getExtraction(extractionId);

    if (!extraction) {
      return NextResponse.json({ error: 'Extraction not found' }, { status: 404 });
    }

    return NextResponse.json(extraction);
  } catch (error) {
    console.error('Error getting extraction:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
