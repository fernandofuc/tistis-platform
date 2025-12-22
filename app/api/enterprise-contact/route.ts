import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - this API handles POST requests
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EnterpriseContactRequest {
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  industry: string;
  branchCount: string;
  businessDescription: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EnterpriseContactRequest = await request.json();

    // Validate required fields
    const requiredFields = ['contactName', 'email', 'phone', 'companyName', 'industry', 'branchCount', 'businessDescription'];
    for (const field of requiredFields) {
      if (!body[field as keyof EnterpriseContactRequest]) {
        return NextResponse.json(
          { error: `El campo ${field} es requerido` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Store in Supabase
    const { data, error } = await supabase
      .from('enterprise_leads')
      .insert({
        contact_name: body.contactName,
        email: body.email,
        phone: body.phone,
        company_name: body.companyName,
        industry: body.industry,
        branch_count: body.branchCount,
        business_description: body.businessDescription,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving enterprise lead:', error);
      // If table doesn't exist, we still want to acknowledge the request
      // In production, you'd want to send an email notification as backup
      console.log('Enterprise lead data (backup):', body);
    }

    // TODO: Send email notification to sales team
    // TODO: Send confirmation email to prospect

    console.log('✅ Enterprise lead received:', {
      company: body.companyName,
      email: body.email,
      branches: body.branchCount
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitud recibida. Te contactaremos en menos de 2 horas.'
    });

  } catch (error) {
    console.error('Error processing enterprise contact:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
