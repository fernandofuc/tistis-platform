/**
 * TIS TIS PLATFORM - Admin Channel WhatsApp Webhook
 *
 * Webhook para recibir mensajes del numero central de TIS TIS.
 * Procesa mensajes entrantes y actualiza estados de entrega.
 *
 * @module api/webhook/admin-channel/whatsapp
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminChannelService } from '@/src/features/admin-channel';
import { processAdminMessage } from '@/src/features/admin-channel/services/message-processor.service';

// =====================================================
// TYPES
// =====================================================

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: WhatsAppMessage[];
      statuses?: WhatsAppStatus[];
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/WA]';

// =====================================================
// SIGNATURE VERIFICATION
// =====================================================

function verifySignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) {
    console.error(`${LOG_PREFIX} Missing X-Hub-Signature-256 header`);
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// =====================================================
// PHONE NORMALIZATION
// =====================================================

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
}

// =====================================================
// GET - Webhook Verification (Meta Challenge)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Validar parametros requeridos
    if (!mode || !token || !challenge) {
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      );
    }

    if (mode !== 'subscribe') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // Verificar token
    const expectedToken = process.env.ADMIN_CHANNEL_WA_VERIFY_TOKEN;
    if (!expectedToken || token !== expectedToken) {
      console.error(`${LOG_PREFIX} Invalid verify token`);
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    console.log(`${LOG_PREFIX} Webhook verified successfully`);
    return new NextResponse(challenge, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Verification error:`, error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// =====================================================
// POST - Process Incoming Messages
// =====================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Extraer firma y payload
    const signature = request.headers.get('x-hub-signature-256');
    const payload = await request.text();

    // 2. Verificar firma (seguridad)
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error(`${LOG_PREFIX} META_APP_SECRET not configured`);
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (!verifySignature(payload, signature, appSecret)) {
      console.error(`${LOG_PREFIX} Invalid signature - possible tampering`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 3. Parse payload
    const webhookData: WhatsAppWebhookPayload = JSON.parse(payload);

    // 4. Validar estructura
    if (webhookData.object !== 'whatsapp_business_account') {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 5. Procesar cada entry
    for (const entry of webhookData.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const { value } = change;

        // Procesar mensajes entrantes
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await processIncomingMessage(
              message,
              value.metadata.phone_number_id,
              value.contacts?.[0]
            );
          }
        }

        // Procesar actualizaciones de estado
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await processStatusUpdate(status);
          }
        }
      }
    }

    console.log(`${LOG_PREFIX} Processed in ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Processing error:`, error);
    // Siempre retornar 200 para evitar retries infinitos de Meta
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

// =====================================================
// PROCESS INCOMING MESSAGE
// =====================================================

async function processIncomingMessage(
  message: WhatsAppMessage,
  phoneNumberId: string,
  contact?: { profile: { name: string }; wa_id: string }
) {
  const service = getAdminChannelService();

  try {
    const senderPhone = normalizePhone(message.from);
    const senderName = contact?.profile?.name || 'Usuario';

    // SEGURIDAD: No logueamos el telefono completo
    console.log(`${LOG_PREFIX} Message type: ${message.type}`);

    // 1. Buscar usuario vinculado
    const userContext = await service.getFullUserContext('whatsapp', senderPhone);

    // 2. Si no esta vinculado, verificar si es codigo de vinculacion
    if (!userContext) {
      if (message.type === 'text' && message.text?.body) {
        const text = message.text.body.trim();

        // Verificar si es codigo de 6 digitos
        if (/^\d{6}$/.test(text)) {
          const linkResult = await service.verifyLinkCode(text, senderPhone, undefined, undefined);

          if (linkResult.success && linkResult.tenantId && linkResult.userId) {
            // Enviar mensaje de bienvenida
            await sendWhatsAppResponse(
              senderPhone,
              phoneNumberId,
              `Hola ${senderName}!\n\n` +
                `Tu cuenta ha sido vinculada exitosamente.\n\n` +
                `Ahora puedes:\n` +
                `- Pedir reportes: "dame el reporte de hoy"\n` +
                `- Configurar: "agregar servicio"\n` +
                `- Ver alertas: "notificaciones"\n\n` +
                `Escribe "ayuda" para ver todos los comandos.`
            );

            await service.logAuditAction({
              tenantId: linkResult.tenantId,
              userId: linkResult.userId,
              action: 'whatsapp_linked',
              actionCategory: 'auth',
              description: 'WhatsApp vinculado exitosamente',
              channel: 'whatsapp',
            });
            return;
          }
        }

        // Usuario no vinculado - enviar instrucciones
        await sendWhatsAppResponse(
          senderPhone,
          phoneNumberId,
          `Hola!\n\n` +
            `Este es el canal administrativo de TIS TIS.\n\n` +
            `Para vincular tu cuenta:\n` +
            `1. Ingresa a tu dashboard TIS TIS\n` +
            `2. Ve a Configuracion > Admin Channel\n` +
            `3. Genera un codigo de vinculacion\n` +
            `4. Enviame el codigo de 6 digitos\n\n` +
            `Si ya tienes un codigo, enviamelo aqui.`
        );
        return;
      }
      return;
    }

    // 3. Verificar rate limit
    const rateLimit = await service.checkRateLimit(userContext.user.userId);
    if (!rateLimit.canSend) {
      await sendWhatsAppResponse(
        senderPhone,
        phoneNumberId,
        `Has excedido el limite de mensajes.\n\n` +
          `Limite: 30/hora, 100/dia\n` +
          `Restante hora: ${rateLimit.messagesRemainingHour}\n` +
          `Restante dia: ${rateLimit.messagesRemainingDay}\n\n` +
          `Intenta de nuevo mas tarde.`
      );
      return;
    }

    // 4. Extraer contenido del mensaje
    let content = '';
    if (message.type === 'text' && message.text?.body) {
      content = message.text.body;
    } else if (message.type === 'image' && message.image?.caption) {
      content = message.image.caption;
    } else if (message.type === 'interactive') {
      if (message.interactive?.button_reply) {
        content = message.interactive.button_reply.title;
      } else if (message.interactive?.list_reply) {
        content = message.interactive.list_reply.title;
      }
    } else {
      content = `[${message.type}]`;
    }

    // 5. Guardar mensaje entrante
    const savedMessage = await service.saveIncomingMessage(
      userContext.conversationId,
      content,
      message.id
    );

    if (!savedMessage) {
      console.error(`${LOG_PREFIX} Failed to save incoming message`);
      return;
    }

    // 6. Procesar con el message processor
    const result = await processAdminMessage({
      user: userContext.user,
      conversationId: userContext.conversationId,
      message: content,
      messageId: savedMessage.id,
    });

    // 7. Guardar y enviar respuesta
    await service.saveAssistantMessage(
      userContext.conversationId,
      result.response,
      result.intent,
      result.confidence,
      result.extractedData,
      result.actionsExecuted,
      result.tokens
    );

    await sendWhatsAppResponse(senderPhone, phoneNumberId, result.response);

    // 8. Log de auditoria
    await service.logAuditAction({
      tenantId: userContext.tenantId,
      userId: userContext.user.userId,
      conversationId: userContext.conversationId,
      messageId: savedMessage.id,
      action: 'message_processed',
      actionCategory: result.intent.startsWith('analytics')
        ? 'analytics'
        : result.intent.startsWith('config')
          ? 'config'
          : 'system',
      channel: 'whatsapp',
      requestData: { contentLength: content.length },
      responseData: { intent: result.intent },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Process message error:`, error);
  }
}

// =====================================================
// PROCESS STATUS UPDATE
// =====================================================

async function processStatusUpdate(status: WhatsAppStatus) {
  const service = getAdminChannelService();

  try {
    const statusMap: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
    };

    const mappedStatus = statusMap[status.status];
    if (!mappedStatus) return;

    // Actualizar estado del mensaje en BD
    await service.updateMessageDeliveryStatus(status.id, mappedStatus);
  } catch (error) {
    console.error(`${LOG_PREFIX} Status update error:`, error);
  }
}

// =====================================================
// SEND WHATSAPP RESPONSE
// =====================================================

async function sendWhatsAppResponse(
  to: string,
  phoneNumberId: string,
  message: string
): Promise<void> {
  const accessToken = process.env.ADMIN_CHANNEL_WA_ACCESS_TOKEN;
  if (!accessToken) {
    console.error(`${LOG_PREFIX} Access token not configured`);
    return;
  }

  // Meta API version - use env var with fallback
  const apiVersion = process.env.META_API_VERSION || 'v18.0';

  try {
    // Timeout de 10 segundos para evitar requests colgados
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace('+', ''),
          type: 'text',
          text: { body: message },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      console.error(`${LOG_PREFIX} Send error:`, data);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`${LOG_PREFIX} Send timeout after 10s`);
    } else {
      console.error(`${LOG_PREFIX} Send error:`, error);
    }
  }
}
