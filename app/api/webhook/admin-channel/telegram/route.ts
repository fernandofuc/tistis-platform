/**
 * TIS TIS PLATFORM - Admin Channel Telegram Webhook
 *
 * Webhook para recibir mensajes del bot @TISTISBot.
 * Procesa mensajes entrantes y callbacks de botones inline.
 *
 * @module api/webhook/admin-channel/telegram
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

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: Array<{ file_id: string; file_size: number; width: number; height: number }>;
  document?: { file_id: string; file_name: string; mime_type: string };
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/TG]';

// =====================================================
// SECURITY - Verify Telegram Secret Token
// =====================================================

function verifyTelegramSecret(request: NextRequest): boolean {
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = process.env.ADMIN_CHANNEL_TELEGRAM_SECRET;

  if (!expectedSecret) {
    console.error(`${LOG_PREFIX} TELEGRAM_SECRET not configured`);
    return false;
  }

  if (!secretToken) {
    console.error(`${LOG_PREFIX} Missing X-Telegram-Bot-Api-Secret-Token header`);
    return false;
  }

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(secretToken),
      Buffer.from(expectedSecret)
    );
  } catch {
    return false;
  }
}

// =====================================================
// POST - Process Updates
// =====================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verificar secret token (seguridad)
    if (!verifyTelegramSecret(request)) {
      console.error(`${LOG_PREFIX} Invalid secret token - rejecting request`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 2. Parse update
    const update: TelegramUpdate = await request.json();

    console.log(`${LOG_PREFIX} Update ${update.update_id}`);

    // Procesar mensaje
    if (update.message) {
      await processIncomingMessage(update.message);
    }

    // Procesar callback (para botones inline)
    if (update.callback_query) {
      await processCallbackQuery(update.callback_query);
    }

    console.log(`${LOG_PREFIX} Processed in ${Date.now() - startTime}ms`);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Processing error:`, error);
    // Siempre retornar 200 para evitar retries de Telegram
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

// =====================================================
// PROCESS INCOMING MESSAGE
// =====================================================

async function processIncomingMessage(message: TelegramMessage) {
  const service = getAdminChannelService();

  try {
    // Solo procesar mensajes privados
    if (message.chat.type !== 'private') {
      return;
    }

    const telegramUserId = message.from.id.toString();
    const telegramUsername = message.from.username;
    const chatId = message.chat.id;
    const senderName = `${message.from.first_name}${message.from.last_name ? ' ' + message.from.last_name : ''}`;

    // SEGURIDAD: No logueamos IDs completos
    console.log(`${LOG_PREFIX} Message from user (has_username: ${!!telegramUsername})`);

    // 1. Buscar usuario vinculado
    const userContext = await service.getFullUserContext('telegram', telegramUserId);

    // 2. Si no esta vinculado, verificar codigo
    if (!userContext) {
      if (message.text) {
        const text = message.text.trim();

        // Comando /start
        if (text === '/start') {
          await sendTelegramMessage(
            chatId,
            `Hola ${senderName}!\n\n` +
              `Soy el asistente administrativo de TIS TIS.\n\n` +
              `Para vincular tu cuenta:\n` +
              `1. Ingresa a tu dashboard TIS TIS\n` +
              `2. Ve a Configuracion > Admin Channel\n` +
              `3. Genera un codigo de vinculacion\n` +
              `4. Enviame el codigo de 6 digitos\n\n` +
              `Si ya tienes un codigo, enviamelo aqui.`
          );
          return;
        }

        // Verificar codigo de 6 digitos
        if (/^\d{6}$/.test(text)) {
          const linkResult = await service.verifyLinkCode(
            text,
            undefined, // phoneNormalized
            telegramUserId,
            telegramUsername
          );

          if (linkResult.success && linkResult.tenantId && linkResult.userId) {
            await sendTelegramMessage(
              chatId,
              `Cuenta vinculada exitosamente!\n\n` +
                `Ahora puedes:\n` +
                `/reporte - Ver resumen del dia\n` +
                `/ventas - Ver ventas\n` +
                `/leads - Ver leads\n` +
                `/config - Configurar tu negocio\n` +
                `/alertas - Configurar notificaciones\n` +
                `/ayuda - Ver todos los comandos\n\n` +
                `Tambien puedes escribir en lenguaje natural.`
            );

            await service.logAuditAction({
              tenantId: linkResult.tenantId,
              userId: linkResult.userId,
              action: 'telegram_linked',
              actionCategory: 'auth',
              description: 'Telegram vinculado exitosamente',
              channel: 'telegram',
            });
            return;
          } else {
            await sendTelegramMessage(
              chatId,
              `Codigo invalido o expirado.\n\n` + `Por favor genera un nuevo codigo en tu dashboard.`
            );
            return;
          }
        }

        // Usuario no vinculado
        await sendTelegramMessage(
          chatId,
          `Tu cuenta no esta vinculada.\n\n` + `Envia /start para ver las instrucciones.`
        );
        return;
      }
      return;
    }

    // 3. Verificar rate limit
    const rateLimit = await service.checkRateLimit(userContext.user.userId);
    if (!rateLimit.canSend) {
      await sendTelegramMessage(
        chatId,
        `Limite de mensajes excedido.\n\n` +
          `Restante hora: ${rateLimit.messagesRemainingHour}\n` +
          `Restante dia: ${rateLimit.messagesRemainingDay}`
      );
      return;
    }

    // 4. Extraer contenido
    let content = message.text || '[media]';

    // Procesar comandos de Telegram
    if (content.startsWith('/')) {
      content = mapTelegramCommand(content);
    }

    // 5. Guardar mensaje
    const savedMessage = await service.saveIncomingMessage(
      userContext.conversationId,
      content,
      message.message_id.toString()
    );

    if (!savedMessage) {
      console.error(`${LOG_PREFIX} Failed to save incoming message`);
      return;
    }

    // 6. Procesar con message processor (conectado a LangGraph)
    const result = await processAdminMessage({
      user: userContext.user,
      conversationId: userContext.conversationId,
      message: content,
      messageId: savedMessage.id,
      channel: 'telegram',
      conversationHistory: userContext.conversationHistory || [],
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

    await sendTelegramMessage(chatId, result.response, result.keyboard ?? undefined);

    // 8. Auditoria
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
      channel: 'telegram',
      requestData: { contentLength: content.length },
      responseData: { intent: result.intent },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Process message error:`, error);
  }
}

// =====================================================
// PROCESS CALLBACK QUERY (Inline Buttons)
// =====================================================

async function processCallbackQuery(callback: TelegramCallbackQuery) {
  const service = getAdminChannelService();

  try {
    const telegramUserId = callback.from.id.toString();
    const chatId = callback.message?.chat.id;

    if (!chatId) return;

    // Obtener contexto
    const userContext = await service.getFullUserContext('telegram', telegramUserId);
    if (!userContext) {
      await answerCallbackQuery(callback.id, 'Sesion expirada');
      return;
    }

    // Procesar accion del boton
    const data = callback.data || '';

    // Convertir callback data a mensaje
    let content = 'confirmar';
    if (data.startsWith('cancel_')) {
      content = 'cancelar';
    } else if (data === 'pause_notifications') {
      content = 'pausar alertas';
    } else if (data === 'config_notifications') {
      content = 'configurar notificaciones';
    }

    // Procesar como mensaje normal (conectado a LangGraph)
    const result = await processAdminMessage({
      user: userContext.user,
      conversationId: userContext.conversationId,
      message: content,
      messageId: callback.id,
      channel: 'telegram',
      conversationHistory: userContext.conversationHistory || [],
      callbackData: { action: data.split('_')[0], actionId: data },
    });

    await sendTelegramMessage(chatId, result.response);

    // Responder al callback
    await answerCallbackQuery(callback.id);
  } catch (error) {
    console.error(`${LOG_PREFIX} Callback error:`, error);
    await answerCallbackQuery(callback.id, 'Error procesando');
  }
}

// =====================================================
// TELEGRAM COMMAND MAPPING
// =====================================================

function mapTelegramCommand(command: string): string {
  const commandMap: Record<string, string> = {
    '/start': 'ayuda',
    '/ayuda': 'ayuda',
    '/help': 'ayuda',
    '/reporte': 'resumen del dia',
    '/ventas': 'ventas de hoy',
    '/leads': 'leads nuevos',
    '/config': 'configuracion',
    '/alertas': 'notificaciones',
    '/pausar': 'pausar alertas',
    '/reanudar': 'reanudar alertas',
  };

  const baseCommand = command.split(' ')[0].toLowerCase();
  return commandMap[baseCommand] || command;
}

// =====================================================
// TELEGRAM API HELPERS
// =====================================================

async function sendTelegramMessage(
  chatId: number,
  text: string,
  keyboard?: Array<Array<{ text: string; callback_data: string }>>
): Promise<void> {
  const botToken = process.env.ADMIN_CHANNEL_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error(`${LOG_PREFIX} Bot token not configured`);
    return;
  }

  try {
    // Sanitizar HTML básico para evitar errores de parsing
    const sanitizedText = text
      .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;')
      .replace(/<(?!\/?(?:b|i|u|s|code|pre|a)[>\s])/g, '&lt;');

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: sanitizedText,
      parse_mode: 'HTML',
    };

    if (keyboard && keyboard.length > 0) {
      body.reply_markup = {
        inline_keyboard: keyboard,
      };
    }

    // Timeout de 10 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!data.ok) {
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

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const botToken = process.env.ADMIN_CHANNEL_TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`${LOG_PREFIX} Answer callback timeout`);
    } else {
      console.error(`${LOG_PREFIX} Answer callback error:`, error);
    }
  }
}
