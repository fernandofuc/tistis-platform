// =====================================================
// TIS TIS PLATFORM - Multi-Tenant WhatsApp Webhook
// Endpoint: /api/webhook/whatsapp/[tenantSlug]
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';
import {
  WhatsAppService,
  verifyWhatsAppSignature,
} from '@/src/features/messaging/services/whatsapp.service';
import type { WhatsAppWebhookPayload } from '@/src/shared/types/whatsapp';

// ======================
// TYPES
// ======================
interface RouteParams {
  params: Promise<{
    tenantSlug: string;
  }>;
}

// ======================
// GET - Webhook Verification
// Meta envía GET para verificar el webhook
// ======================
export async function GET(request: NextRequest, context: RouteParams) {
  const startTime = Date.now();
  const { tenantSlug } = await context.params;

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log(`[WhatsApp Webhook] Verification request for tenant: ${tenantSlug}`);

    // Validar parámetros requeridos
    if (!mode || !token || !challenge) {
      console.error('[WhatsApp Webhook] Missing verification parameters');
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      );
    }

    // Solo aceptar mode=subscribe
    if (mode !== 'subscribe') {
      console.error(`[WhatsApp Webhook] Invalid mode: ${mode}`);
      return NextResponse.json(
        { error: 'Invalid mode' },
        { status: 400 }
      );
    }

    // Buscar tenant y su verify_token
    const supabase = createServerClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (!tenant) {
      console.error(`[WhatsApp Webhook] Tenant not found: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Buscar channel_connection con el verify_token
    const { data: connection } = await supabase
      .from('channel_connections')
      .select('whatsapp_verify_token')
      .eq('tenant_id', tenant.id)
      .eq('channel', 'whatsapp')
      .eq('whatsapp_verify_token', token)
      .single();

    if (!connection) {
      console.error(`[WhatsApp Webhook] Invalid verify token for tenant: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Invalid verify token' },
        { status: 403 }
      );
    }

    // Verificación exitosa - devolver challenge
    console.log(
      `[WhatsApp Webhook] Verification successful for ${tenantSlug} (${Date.now() - startTime}ms)`
    );

    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('[WhatsApp Webhook] Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Receive Webhook Events
// Meta envía POST con mensajes y eventos
// ======================
export async function POST(request: NextRequest, context: RouteParams) {
  const startTime = Date.now();
  const { tenantSlug } = await context.params;

  try {
    // 1. Leer body como texto para verificación de firma
    const rawBody = await request.text();

    // Log inicial
    console.log(`[WhatsApp Webhook] Received event for tenant: ${tenantSlug}`);

    // Intentar parsear para verificar estructura básica
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[WhatsApp Webhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // Verificar que es un webhook de WhatsApp
    if (payload.object !== 'whatsapp_business_account') {
      console.error('[WhatsApp Webhook] Invalid webhook object type:', payload.object);
      return NextResponse.json(
        { error: 'Invalid webhook type' },
        { status: 400 }
      );
    }

    // Obtener app_secret del tenant para verificar firma
    const supabase = createServerClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (!tenant) {
      console.error(`[WhatsApp Webhook] Tenant not found: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Obtener webhook_secret para verificar firma
    const { data: connection } = await supabase
      .from('channel_connections')
      .select('webhook_secret')
      .eq('tenant_id', tenant.id)
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .limit(1)
      .single();

    // 2. Verificar firma X-Hub-Signature-256
    const signature = request.headers.get('x-hub-signature-256');
    const appSecret = connection?.webhook_secret || process.env.WHATSAPP_APP_SECRET;

    if (appSecret) {
      const isValid = verifyWhatsAppSignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.error(`[WhatsApp Webhook] Invalid signature for tenant: ${tenantSlug}`);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }
    } else {
      // En desarrollo, log warning pero continuar
      console.warn('[WhatsApp Webhook] No app secret configured - skipping signature verification');
    }

    // 3. Procesar webhook (async, no bloquea respuesta)
    // No esperamos el resultado, Meta necesita 200 rápido
    processWebhookBackground(tenantSlug, payload).catch((error) => {
      console.error('[WhatsApp Webhook] Background processing error:', error);
    });

    // 4. Responder inmediatamente
    console.log(
      `[WhatsApp Webhook] Acknowledged for ${tenantSlug} (${Date.now() - startTime}ms)`
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);

    // Siempre devolver 200 para evitar reintentos innecesarios de Meta
    // Los errores se manejan internamente
    return NextResponse.json({ received: true });
  }
}

// ======================
// BACKGROUND PROCESSING
// ======================

/**
 * Procesa el webhook en background después de responder 200
 */
async function processWebhookBackground(
  tenantSlug: string,
  payload: WhatsAppWebhookPayload
): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await WhatsAppService.processWebhook(tenantSlug, payload);

    console.log(
      `[WhatsApp Webhook] Processed for ${tenantSlug}: ` +
      `${result.messages_processed} messages, ${result.statuses_processed} statuses ` +
      `(${Date.now() - startTime}ms)`
    );

    if (result.errors.length > 0) {
      console.warn('[WhatsApp Webhook] Processing errors:', result.errors);
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] Background processing failed:', error);

    // TODO: Enviar a dead letter queue o sistema de alertas
    // await alertService.notify('webhook_processing_failed', { tenantSlug, error });
  }
}

