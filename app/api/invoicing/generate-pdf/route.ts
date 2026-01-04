// =====================================================
// TIS TIS PLATFORM - Generate PDF & Send Email API Route
// Generates PDF for an invoice and optionally sends it via email
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getInvoiceService,
  getPDFGeneratorService,
  getInvoiceEmailService,
} from '@/src/features/invoicing';

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
// POST - Generate PDF and optionally send email
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
    const { invoice_id, send_email = false } = await request.json();

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    // Get invoice with items
    const invoiceService = getInvoiceService();
    const invoice = await invoiceService.getInvoice(invoice_id, true);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check tenant ownership
    if (invoice.tenant_id !== userRole.tenant_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get invoice config
    const config = await invoiceService.getConfig(userRole.tenant_id, invoice.branch_id);
    if (!config) {
      return NextResponse.json(
        { error: 'Invoice configuration not found' },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfService = getPDFGeneratorService();
    const pdfResult = await pdfService.generateInvoicePDF(invoice, config);

    if (!pdfResult.success) {
      return NextResponse.json(
        { error: `PDF generation failed: ${pdfResult.error}` },
        { status: 500 }
      );
    }

    // Send email if requested
    let emailResult = null;
    if (send_email && pdfResult.pdfUrl) {
      const emailService = getInvoiceEmailService();

      // Get updated invoice with PDF URL
      const updatedInvoice = await invoiceService.getInvoice(invoice_id);
      if (updatedInvoice) {
        emailResult = await emailService.sendInvoiceEmail(updatedInvoice, config);
      }
    }

    return NextResponse.json({
      success: true,
      pdf_url: pdfResult.pdfUrl,
      email_sent: emailResult?.success || false,
      email_error: emailResult?.error,
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
