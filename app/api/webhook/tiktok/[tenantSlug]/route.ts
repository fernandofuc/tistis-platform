// =====================================================
// TIS TIS PLATFORM - Multi-Tenant TikTok Webhook
// Endpoint: /api/webhook/tiktok/[tenantSlug]
// Handles TikTok Direct Messages via TikTok Business API
// Note: TikTok API is different from Meta Graph API
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';
import {
  TikTokService,
  verifyTikTokSignature,
} from '@/src/features/messaging/services/tiktok.service';
import type { TikTokWebhookPayload } from '@/src/shared/types/tiktok-messaging';

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
// TikTok envía GET para verificar el webhook durante la configuración
// Similar a Meta pero con parámetros diferentes
// ======================
export async function GET(request: NextRequest, context: RouteParams) {
  const startTime = Date.now();
  const { tenantSlug } = await context.params;

  try {
    const { searchParams } = new URL(request.url);

    // TikTok usa "challenge" parameter
    const challenge = searchParams.get('challenge');

    // Algunos SDKs de TikTok también envían verify_token
    const verifyToken = searchParams.get('verify_token');

    console.log(`[TikTok Webhook] Verification request for tenant: ${tenantSlug}`);

    // Validar que hay challenge
    if (!challenge) {
      console.error('[TikTok Webhook] Missing challenge parameter');
      return NextResponse.json(
        { error: 'Missing challenge parameter' },
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
      // Log internally but return generic error to prevent tenant enumeration
      console.error(`[TikTok Webhook] Tenant not found: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      );
    }

    // Si hay verify_token, validarlo
    if (verifyToken) {
      const { data: connection } = await supabase
        .from('channel_connections')
        .select('tiktok_verify_token')
        .eq('tenant_id', tenant.id)
        .eq('channel', 'tiktok')
        .eq('tiktok_verify_token', verifyToken)
        .single();

      if (!connection) {
        console.error(`[TikTok Webhook] Invalid verify token for tenant: ${tenantSlug}`);
        return NextResponse.json(
          { error: 'Invalid verify token' },
          { status: 403 }
        );
      }
    }

    // Verificación exitosa - devolver challenge
    console.log(
      `[TikTok Webhook] Verification successful for ${tenantSlug} (${Date.now() - startTime}ms)`
    );

    // TikTok espera el challenge como respuesta plain text
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('[TikTok Webhook] Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Receive Webhook Events
// TikTok envía POST con eventos de mensajes directos
// ======================
export async function POST(request: NextRequest, context: RouteParams) {
  const startTime = Date.now();
  const { tenantSlug } = await context.params;

  try {
    // 1. Leer body como texto para verificación de firma
    const rawBody = await request.text();

    console.log(`[TikTok Webhook] Received event for tenant: ${tenantSlug}`);

    // 2. Parsear payload
    let payload: TikTokWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[TikTok Webhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // 3. Validar estructura básica del payload
    if (!payload.event || !payload.client_key) {
      console.error('[TikTok Webhook] Invalid payload structure');
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    // 4. Obtener client_secret para verificar firma
    const supabase = createServerClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (!tenant) {
      // Log internally but return generic error to prevent tenant enumeration
      console.error(`[TikTok Webhook] Tenant not found: ${tenantSlug}`);
      return NextResponse.json(
        { error: 'Invalid webhook' },
        { status: 403 }
      );
    }

    // Buscar conexión por client_key
    const { data: connection } = await supabase
      .from('channel_connections')
      .select('tiktok_client_secret')
      .eq('tenant_id', tenant.id)
      .eq('channel', 'tiktok')
      .eq('tiktok_client_key', payload.client_key)
      .eq('status', 'connected')
      .limit(1)
      .single();

    // 5. Verificar firma
    // TikTok usa: X-Tiktok-Signature header
    // Signature = SHA256(client_secret + timestamp + payload)
    const signature = request.headers.get('x-tiktok-signature');
    const timestamp = request.headers.get('x-tiktok-timestamp');
    const clientSecret = connection?.tiktok_client_secret || process.env.TIKTOK_CLIENT_SECRET;

    if (clientSecret) {
      const isValid = verifyTikTokSignature(rawBody, signature, clientSecret, timestamp);
      if (!isValid) {
        console.error(`[TikTok Webhook] Invalid signature for tenant: ${tenantSlug}`);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }
    } else {
      // In production, require signature verification
      if (process.env.NODE_ENV === 'production') {
        console.error('[TikTok Webhook] No client secret configured in production - rejecting');
        return NextResponse.json(
          { error: 'Webhook signature verification not configured' },
          { status: 500 }
        );
      }
      console.warn('[TikTok Webhook] No client secret configured - skipping signature verification in development');
    }

    // 6. Log del evento recibido
    console.log(`[TikTok Webhook] Event: ${payload.event}, Client: ${payload.client_key}`);

    // 7. Filtrar eventos que nos interesan
    const relevantEvents = [
      'direct_message.receive',
      'user.follow',
    ];

    if (!relevantEvents.includes(payload.event)) {
      console.log(`[TikTok Webhook] Ignoring event: ${payload.event}`);
      return NextResponse.json({ received: true });
    }

    // 8. Procesar webhook en background
    processWebhookBackground(tenantSlug, payload).catch((error) => {
      console.error('[TikTok Webhook] Background processing error:', error);
    });

    // 9. Responder inmediatamente (TikTok espera respuesta rápida)
    console.log(
      `[TikTok Webhook] Acknowledged for ${tenantSlug} (${Date.now() - startTime}ms)`
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[TikTok Webhook] Error:', error);
    // Siempre devolver 200 para evitar reintentos
    return NextResponse.json({ received: true });
  }
}

// ======================
// BACKGROUND PROCESSING
// ======================

async function processWebhookBackground(
  tenantSlug: string,
  payload: TikTokWebhookPayload
): Promise<void> {
  const startTime = Date.now();

  try {
    // Procesar según tipo de evento
    if (payload.event === 'direct_message.receive') {
      const result = await TikTokService.processWebhook(tenantSlug, payload);

      console.log(
        `[TikTok Webhook] Processed for ${tenantSlug}: ` +
        `${result.messages_processed} messages (${Date.now() - startTime}ms)`
      );

      if (result.errors.length > 0) {
        console.warn('[TikTok Webhook] Processing errors:', result.errors);
      }
    } else if (payload.event === 'user.follow') {
      // Procesar nuevo seguidor
      await processFollowEvent(tenantSlug, payload);
    }
  } catch (error) {
    console.error('[TikTok Webhook] Background processing failed:', error);
  }
}

// ======================
// FOLLOW EVENT HANDLER
// Crear lead cuando alguien sigue la cuenta
// ======================

async function processFollowEvent(
  tenantSlug: string,
  payload: TikTokWebhookPayload
): Promise<void> {
  const supabase = createServerClient();

  const fromUserId = payload.content.from_user_open_id;
  if (!fromUserId) {
    console.warn('[TikTok Webhook] Follow event without from_user_open_id');
    return;
  }

  // Buscar tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .eq('status', 'active')
    .single();

  if (!tenant) {
    console.error(`[TikTok Webhook] Tenant not found for follow: ${tenantSlug}`);
    return;
  }

  // Buscar conexión
  const { data: connection } = await supabase
    .from('channel_connections')
    .select('id, branch_id, tiktok_access_token')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'tiktok')
    .eq('tiktok_client_key', payload.client_key)
    .eq('status', 'connected')
    .single();

  if (!connection || !connection.tiktok_access_token) {
    console.error('[TikTok Webhook] No valid connection for follow event');
    return;
  }

  // Crear lead (si no existe)
  try {
    const lead = await TikTokService.findOrCreateLead(
      tenant.id,
      connection.branch_id,
      fromUserId,
      connection.tiktok_access_token
    );

    if (lead.isNew) {
      console.log(`[TikTok Webhook] New follower lead created: ${lead.id}`);

      // Actualizar source si es nuevo (use 'other' as 'tiktok_follow' is not valid in constraint)
      await supabase
        .from('leads')
        .update({ source: 'other', source_details: { platform: 'tiktok', type: 'follow' } })
        .eq('id', lead.id);
    }
  } catch (error) {
    console.error('[TikTok Webhook] Error creating follower lead:', error);
  }
}
