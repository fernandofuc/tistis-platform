// =====================================================
// TIS TIS PLATFORM - Payment Proof Validation API
// Validates transfer payment proofs using OpenAI Vision
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

async function getUserTenantAndProgram(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  const { data: program } = await supabase
    .from('loyalty_programs')
    .select('id')
    .eq('tenant_id', userRole.tenant_id)
    .single();

  return { user, userRole, program };
}

// Types
interface ValidationResult {
  isValid: boolean;
  confidence: number;
  extractedData: {
    amount?: number;
    date?: string;
    reference?: string;
    bank?: string;
    senderName?: string;
  };
  issues: string[];
  rawAnalysis: string;
}

// ======================
// POST - Validate payment proof image
// ======================
export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenantAndProgram(supabase);

    if (!context?.program) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      image_url,
      image_base64,
      expected_amount,
      membership_id,
      lead_id
    } = body;

    if (!image_url && !image_base64) {
      return NextResponse.json({
        error: 'Se requiere image_url o image_base64'
      }, { status: 400 });
    }

    if (!expected_amount) {
      return NextResponse.json({
        error: 'Se requiere expected_amount'
      }, { status: 400 });
    }

    // Prepare image for OpenAI Vision
    const imageContent = image_base64
      ? { type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
      : { type: 'image_url' as const, image_url: { url: image_url } };

    // Analyze payment proof with OpenAI Vision
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres un experto en validación de comprobantes de pago bancario en México.
Analiza la imagen del comprobante de transferencia bancaria y extrae la información relevante.
Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "isValid": boolean, // true si parece un comprobante genuino
  "confidence": number, // 0-100, confianza en la validación
  "extractedData": {
    "amount": number | null, // monto de la transferencia
    "date": string | null, // fecha en formato ISO
    "reference": string | null, // número de referencia o folio
    "bank": string | null, // banco emisor
    "senderName": string | null // nombre del ordenante
  },
  "issues": string[], // lista de problemas encontrados
  "analysis": string // breve explicación
}

Considera como problemas:
- Imagen borrosa o ilegible
- Montos que no coinciden con lo esperado
- Fechas muy antiguas (más de 7 días)
- Falta de elementos clave (referencia, monto, fecha)
- Posibles alteraciones o ediciones
- Comprobantes que no sean de transferencia bancaria`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza este comprobante de pago. El monto esperado es: $${expected_amount.toLocaleString('es-MX')} MXN.
Extrae toda la información visible y determina si es un comprobante válido.`
            },
            imageContent as OpenAI.Chat.Completions.ChatCompletionContentPart
          ]
        }
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const analysisText = completion.choices[0]?.message?.content || '{}';
    let analysis: {
      isValid: boolean;
      confidence: number;
      extractedData: {
        amount: number | null;
        date: string | null;
        reference: string | null;
        bank: string | null;
        senderName: string | null;
      };
      issues: string[];
      analysis: string;
    };

    try {
      analysis = JSON.parse(analysisText);
    } catch {
      console.error('[Payment Validation] Error parsing AI response:', analysisText);
      return NextResponse.json({
        error: 'Error al analizar el comprobante'
      }, { status: 500 });
    }

    // Additional validation: check if amount matches
    const amountMatches = analysis.extractedData?.amount
      ? Math.abs(analysis.extractedData.amount - expected_amount) < (expected_amount * 0.01) // 1% tolerance
      : false;

    if (!amountMatches && analysis.extractedData?.amount) {
      analysis.issues = analysis.issues || [];
      analysis.issues.push(
        `Monto en comprobante ($${analysis.extractedData.amount?.toLocaleString('es-MX')}) no coincide con el esperado ($${expected_amount.toLocaleString('es-MX')})`
      );
      // Don't automatically invalidate, but reduce confidence
      analysis.confidence = Math.min(analysis.confidence, 60);
    }

    const result: ValidationResult = {
      isValid: analysis.isValid && analysis.confidence >= 70,
      confidence: analysis.confidence,
      extractedData: {
        amount: analysis.extractedData?.amount ?? undefined,
        date: analysis.extractedData?.date ?? undefined,
        reference: analysis.extractedData?.reference ?? undefined,
        bank: analysis.extractedData?.bank ?? undefined,
        senderName: analysis.extractedData?.senderName ?? undefined,
      },
      issues: analysis.issues || [],
      rawAnalysis: analysis.analysis || ''
    };

    // If membership_id is provided, update the membership with validation result
    if (membership_id) {
      const supabaseAdmin = getSupabaseAdmin();

      const { data: membership } = await supabaseAdmin
        .from('loyalty_memberships')
        .select('metadata')
        .eq('id', membership_id)
        .eq('program_id', context.program.id)
        .single();

      if (membership) {
        const currentMetadata = membership.metadata || {};
        const updatedMetadata = {
          ...currentMetadata,
          payment_method: 'transfer',
          transfer_proof_url: image_url || null,
          transfer_proof_validated: result.isValid,
          transfer_validation_result: {
            confidence: result.confidence,
            extractedData: result.extractedData,
            issues: result.issues,
            validated_at: new Date().toISOString()
          }
        };

        const updateData: Record<string, unknown> = {
          metadata: updatedMetadata
        };

        // If valid with high confidence, activate the membership
        if (result.isValid && result.confidence >= 80) {
          updateData.status = 'active';
          updateData.start_date = new Date().toISOString();

          // Calculate end date based on billing cycle
          const { data: membershipData } = await supabaseAdmin
            .from('loyalty_memberships')
            .select('billing_cycle')
            .eq('id', membership_id)
            .single();

          if (membershipData) {
            const endDate = new Date();
            if (membershipData.billing_cycle === 'annual') {
              endDate.setFullYear(endDate.getFullYear() + 1);
            } else {
              endDate.setMonth(endDate.getMonth() + 1);
            }
            updateData.end_date = endDate.toISOString();
          }
        } else if (result.isValid && result.confidence >= 60) {
          // If valid but lower confidence, mark as pending review
          updateData.status = 'pending_payment';
          updatedMetadata.requires_manual_review = true;
        }

        await supabaseAdmin
          .from('loyalty_memberships')
          .update(updateData)
          .eq('id', membership_id);
      }
    }

    // Log the validation for auditing (ignore errors if table doesn't exist)
    if (lead_id) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        await supabaseAdmin
          .from('activity_log')
          .insert({
            tenant_id: context.userRole.tenant_id,
            user_id: context.user.id,
            action: 'payment_proof_validated',
            entity_type: 'membership',
            entity_id: membership_id || null,
            metadata: {
              lead_id,
              expected_amount,
              validation_result: result.isValid,
              confidence: result.confidence,
              issues: result.issues
            }
          });
      } catch {
        // Ignore if activity_log doesn't exist
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Payment Validation] Error:', error);

    // Check for specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json({
          error: 'Error de autenticación con OpenAI. Contacta al administrador.'
        }, { status: 500 });
      }
      if (error.status === 429) {
        return NextResponse.json({
          error: 'Límite de solicitudes excedido. Intenta de nuevo en unos momentos.'
        }, { status: 429 });
      }
    }

    return NextResponse.json({
      error: 'Error al validar el comprobante de pago'
    }, { status: 500 });
  }
}
