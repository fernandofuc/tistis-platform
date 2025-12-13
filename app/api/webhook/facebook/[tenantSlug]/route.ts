// =====================================================
// TIS TIS PLATFORM - Multi-Tenant Facebook Messenger Webhook
// Endpoint: /api/webhook/facebook/[tenantSlug]
// Handles Facebook Messenger via Meta Graph API
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';
import {
  MetaService,
  verifyMetaSignature,
} from '@/src/features/messaging/services/meta.service';
import type { MetaWebhookPayload } from '@/src/shared/types/meta-messaging';

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
// Meta envía GET para verificar el webhook durante la configuración
// ======================
export async function GET(request: NextRequest, context: RouteParams) {
  const startTime = Date.now();
  const { tenantSlug } = await context.params;

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log(`[Facebook Webhook] Verification request for tenant: ${tenantSlug}`);

    // Validar parámetros requeridos
    if (!mode || !token || !challenge) {
      console.error('[Facebook Webhook] Missing verification parameters');
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      );
    }

    // Solo aceptar mode=subscribe
    if (mode !== 'subscribe') {
      console.error(`[Facebook Webhook] Invalid mode: ${mode}`);
      return NextResponse.json(
        { error: 'Invalid mode' },
        { status: 400 }
      );
    }

    // Buscar tenant
    const supabase = createServerClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (!tenant) {
      console.error(`[Facebook Webhook] Tenant not found: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Buscar channel_connection con el verify_token
    const { data: connection } = await supabase
      .from('channel_connections')
      .select('facebook_verify_token')
      .eq('tenant_id', tenant.id)
      .eq('channel', 'facebook')
      .eq('facebook_verify_token', token)
      .single();

    if (!connection) {
      console.error(`[Facebook Webhook] Invalid verify token for tenant: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Invalid verify token' },
        { status: 403 }
      );
    }

    // Verificación exitosa
    console.log(
      `[Facebook Webhook] Verification successful for ${tenantSlug} (${Date.now() - startTime}ms)`
    );

    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('[Facebook Webhook] Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Receive Webhook Events
// Meta envía POST con mensajes de Facebook Messenger
// ======================
export async function POST(request: NextRequest, context: RouteParams) {
  const startTime = Date.now();
  const { tenantSlug } = await context.params;

  try {
    // 1. Leer body como texto para verificación de firma
    const rawBody = await request.text();

    console.log(`[Facebook Webhook] Received event for tenant: ${tenantSlug}`);

    // 2. Parsear payload
    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Facebook Webhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // 3. Verificar que es un webhook de Facebook Page
    if (payload.object !== 'page') {
      console.error('[Facebook Webhook] Invalid webhook object type:', payload.object);
      return NextResponse.json(
        { error: 'Invalid webhook type' },
        { status: 400 }
      );
    }

    // 4. Obtener app_secret para verificar firma
    const supabase = createServerClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (!tenant) {
      console.error(`[Facebook Webhook] Tenant not found: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const { data: connection } = await supabase
      .from('channel_connections')
      .select('webhook_secret')
      .eq('tenant_id', tenant.id)
      .eq('channel', 'facebook')
      .eq('status', 'connected')
      .limit(1)
      .single();

    // 5. Verificar firma X-Hub-Signature-256
    const signature = request.headers.get('x-hub-signature-256');
    const appSecret = connection?.webhook_secret || process.env.META_APP_SECRET;

    if (appSecret) {
      const isValid = verifyMetaSignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.error(`[Facebook Webhook] Invalid signature for tenant: ${tenantSlug}`);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }
    } else {
      console.warn('[Facebook Webhook] No app secret configured - skipping signature verification');
    }

    // 6. Procesar webhook en background
    processWebhookBackground(tenantSlug, payload).catch((error) => {
      console.error('[Facebook Webhook] Background processing error:', error);
    });

    // 7. Responder inmediatamente
    console.log(
      `[Facebook Webhook] Acknowledged for ${tenantSlug} (${Date.now() - startTime}ms)`
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Facebook Webhook] Error:', error);
    // Siempre devolver 200 para evitar reintentos
    return NextResponse.json({ received: true });
  }
}

// ======================
// BACKGROUND PROCESSING
// ======================

async function processWebhookBackground(
  tenantSlug: string,
  payload: MetaWebhookPayload
): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await MetaService.processWebhook(tenantSlug, 'facebook', payload);

    console.log(
      `[Facebook Webhook] Processed for ${tenantSlug}: ` +
      `${result.messages_processed} messages (${Date.now() - startTime}ms)`
    );

    if (result.errors.length > 0) {
      console.warn('[Facebook Webhook] Processing errors:', result.errors);
    }
  } catch (error) {
    console.error('[Facebook Webhook] Background processing failed:', error);
  }
}
