import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimitMigration } from '@/src/shared/lib/rate-limit-migration';
import {
  getClientIP,
  contactLimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';
import { sendEmail } from '@/src/lib/email/sender';

// Force dynamic rendering - this API handles POST requests
export const dynamic = 'force-dynamic';

// HTML escape function to prevent XSS in emails
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

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
  // Rate limiting: 5 requests per 5 minutes per IP
  const clientIP = getClientIP(request);
  const rateLimitResult = await checkRateLimitMigration(clientIP, contactLimiter);

  if (!rateLimitResult.success) {
    return rateLimitExceeded(rateLimitResult);
  }

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
      console.error('Error saving enterprise lead:', error.message);
      // If table doesn't exist, we still want to acknowledge the request
      // In production, you'd want to send an email notification as backup
    }

    // Send email notification to sales team
    await sendEmail({
      to: { email: process.env.EMAIL_REPLY_TO || 'hola@tistis.com', name: 'TIS TIS Sales' },
      subject: `🚀 Nuevo Lead Enterprise: ${escapeHtml(body.companyName)}`,
      html: `
        <h2>Nuevo Lead Enterprise</h2>
        <p><strong>Empresa:</strong> ${escapeHtml(body.companyName)}</p>
        <p><strong>Contacto:</strong> ${escapeHtml(body.contactName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(body.phone)}</p>
        <p><strong>Industria:</strong> ${escapeHtml(body.industry)}</p>
        <p><strong>Sucursales:</strong> ${escapeHtml(body.branchCount)}</p>
        <p><strong>Descripción:</strong></p>
        <p>${escapeHtml(body.businessDescription)}</p>
        <hr>
        <p><em>Contactar en menos de 2 horas para máxima conversión.</em></p>
      `,
      tags: ['enterprise-lead', escapeHtml(body.industry)],
    });

    // Send confirmation email to prospect
    await sendEmail({
      to: { email: body.email, name: escapeHtml(body.contactName) },
      subject: '¡Recibimos tu solicitud! - TIS TIS Platform',
      html: `
        <h2>¡Hola ${escapeHtml(body.contactName)}!</h2>
        <p>Gracias por tu interés en TIS TIS Platform para <strong>${escapeHtml(body.companyName)}</strong>.</p>
        <p>Hemos recibido tu solicitud y un especialista te contactará en <strong>menos de 2 horas</strong> para:</p>
        <ul>
          <li>Entender las necesidades específicas de tu negocio</li>
          <li>Mostrarte cómo TIS TIS puede ayudarte</li>
          <li>Responder todas tus preguntas</li>
        </ul>
        <p>Mientras tanto, si tienes alguna pregunta urgente, responde a este correo.</p>
        <br>
        <p>¡Gracias por elegir TIS TIS!</p>
        <p><em>El equipo de TIS TIS</em></p>
      `,
      tags: ['enterprise-lead-confirmation'],
    });

    // Log only non-PII data
    console.log('[Enterprise Lead] Received and emails sent:', {
      industry: body.industry,
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
