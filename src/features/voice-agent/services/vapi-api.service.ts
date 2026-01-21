// =====================================================
// TIS TIS PLATFORM - VAPI API Service
// Cliente interno para la API de VAPI
// IMPORTANTE: Este servicio es INVISIBLE para los clientes
// Los clientes solo ven TIS TIS Platform
// =====================================================

// ======================
// TYPES
// ======================

export interface VAPIAssistantCreateRequest {
  name: string;
  firstMessage: string;
  firstMessageMode?: 'assistant-speaks-first' | 'assistant-waits-for-user';

  // LLM Model (requerido para que el assistant genere respuestas)
  model?: {
    provider: 'openai' | 'anthropic' | 'google' | 'together-ai' | 'anyscale' | 'groq';
    model: string;
    messages?: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
  };

  // Transcriber (STT)
  transcriber?: {
    provider: 'deepgram' | 'google' | 'azure' | 'assembly-ai';
    model?: string;
    language?: string;
    keywords?: string[]; // Deepgram keyword boosting (e.g., 'cita:2')
  };

  // Voice (TTS)
  voice?: {
    provider: 'elevenlabs' | '11labs' | 'openai' | 'azure' | 'google';
    voiceId: string;
    model?: string;
    stability?: number;
    similarityBoost?: number;
  };

  // Server URL for Server-Side Response Mode
  serverUrl?: string;
  serverUrlSecret?: string;

  // Timing
  startSpeakingPlan?: {
    waitSeconds?: number;
    onPunctuationSeconds?: number;
    onNoPunctuationSeconds?: number;
  };

  // Call settings
  endCallPhrases?: string[];
  recordingEnabled?: boolean;
  hipaaEnabled?: boolean;

  // Metadata
  metadata?: Record<string, string>;
}

export interface VAPIAssistant {
  id: string;
  orgId: string;
  name: string;
  firstMessage: string;
  createdAt: string;
  updatedAt: string;
  serverUrl?: string;
  voice?: {
    provider: string;
    voiceId: string;
  };
  transcriber?: {
    provider: string;
    model: string;
    language: string;
  };
}

export interface VAPIPhoneNumberCreateRequest {
  // Para comprar número de VAPI (gratis o con carrier)
  provider: 'vapi' | 'twilio' | 'vonage' | 'telnyx';

  // Si provider = 'vapi', especificar área code deseado
  numberDesiredAreaCode?: string;

  // Si provider = 'twilio', importar número existente
  number?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;

  // Asociar a un asistente
  assistantId?: string;

  // Nombre para referencia
  name?: string;

  // Server URL override (opcional)
  server?: {
    url: string;
    secret?: string;
  };
}

export interface VAPIPhoneNumber {
  id: string;
  orgId: string;
  provider: string;
  number: string;
  name?: string;
  assistantId?: string;
  status: 'active' | 'activating' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface VAPIError {
  message: string;
  statusCode: number;
  error: string;
}

// ======================
// VAPI API CLIENT
// ======================

const VAPI_API_BASE = 'https://api.vapi.ai';

/**
 * Obtiene el API Key de VAPI desde variables de entorno
 * IMPORTANTE: Esta key es de TIS TIS, NO de cada cliente
 */
function getVAPIKey(): string {
  const key = process.env.VAPI_API_KEY;
  if (!key) {
    throw new Error('VAPI_API_KEY no está configurada. Contacta al administrador de TIS TIS.');
  }
  return key;
}

/**
 * Realiza una petición a la API de VAPI
 */
async function vapiRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
  } = {}
): Promise<{ data?: T; error?: VAPIError }> {
  const { method = 'GET', body } = options;

  try {
    const response = await fetch(`${VAPI_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${getVAPIKey()}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[VAPI API] Error response:', data);
      return {
        error: {
          message: data.message || 'Error en VAPI API',
          statusCode: response.status,
          error: data.error || 'Unknown error',
        },
      };
    }

    return { data };
  } catch (error) {
    console.error('[VAPI API] Network error:', error);
    return {
      error: {
        message: error instanceof Error ? error.message : 'Error de red',
        statusCode: 0,
        error: 'NetworkError',
      },
    };
  }
}

// ======================
// ASSISTANT MANAGEMENT
// ======================

/**
 * Crea un nuevo asistente en VAPI
 * Si se proporciona 'model', VAPI usará ese LLM para generar respuestas.
 * Si no se proporciona, se usa Server-Side Response Mode (TIS TIS genera respuestas via webhook).
 */
export async function createAssistant(
  request: VAPIAssistantCreateRequest
): Promise<{ assistant?: VAPIAssistant; error?: VAPIError }> {
  console.log('[VAPI API] Creating assistant:', request.name);

  // Construir el body - model es opcional
  const body: VAPIAssistantCreateRequest = {
    name: request.name,
    firstMessage: request.firstMessage,
    firstMessageMode: request.firstMessageMode || 'assistant-speaks-first',

    // LLM Model (si se proporciona, VAPI genera respuestas)
    ...(request.model && { model: request.model }),

    // Transcriber (Deepgram - Multi-language con español principal)
    // Usa detección automática para soportar inglés y otros idiomas
    transcriber: request.transcriber || {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'multi', // Auto-detect: soporta español, inglés y más
      keywords: ['cita:2', 'appointment:2', 'agendar:2', 'reservar:2'], // Boost keywords
    },

    // Voice (ElevenLabs - Javier por defecto)
    voice: request.voice || {
      provider: '11labs',
      voiceId: 'LegCbmbXKbT5PUp3QFWv', // Javier
      model: 'eleven_multilingual_v2',
      stability: 0.5,
      similarityBoost: 0.75,
    },

    // Server URL para Server-Side Response
    serverUrl: request.serverUrl,
    serverUrlSecret: request.serverUrlSecret,

    // Timing
    startSpeakingPlan: request.startSpeakingPlan || {
      waitSeconds: 0.6,
      onPunctuationSeconds: 0.2,
      onNoPunctuationSeconds: 1.2,
    },

    // Frases de fin de llamada (español + inglés)
    endCallPhrases: request.endCallPhrases || [
      'adiós',
      'hasta luego',
      'bye',
      'chao',
      'eso es todo',
      'gracias, eso es todo',
      'goodbye',
      'that is all',
      'thank you, goodbye',
      'thanks, bye',
    ],

    recordingEnabled: request.recordingEnabled ?? true,
    hipaaEnabled: request.hipaaEnabled ?? false,

    metadata: request.metadata,
  };

  const result = await vapiRequest<VAPIAssistant>('/assistant', {
    method: 'POST',
    body,
  });

  if (result.error) {
    console.error('[VAPI API] Failed to create assistant:', result.error);
    return { error: result.error };
  }

  console.log('[VAPI API] Assistant created:', result.data?.id);
  return { assistant: result.data };
}

/**
 * Obtiene un asistente por ID
 */
export async function getAssistant(
  assistantId: string
): Promise<{ assistant?: VAPIAssistant; error?: VAPIError }> {
  const result = await vapiRequest<VAPIAssistant>(`/assistant/${assistantId}`);

  if (result.error) {
    return { error: result.error };
  }

  return { assistant: result.data };
}

/**
 * Actualiza un asistente existente
 */
export async function updateAssistant(
  assistantId: string,
  updates: Partial<VAPIAssistantCreateRequest>
): Promise<{ assistant?: VAPIAssistant; error?: VAPIError }> {
  console.log('[VAPI API] Updating assistant:', assistantId);

  const result = await vapiRequest<VAPIAssistant>(`/assistant/${assistantId}`, {
    method: 'PATCH',
    body: updates,
  });

  if (result.error) {
    console.error('[VAPI API] Failed to update assistant:', result.error);
    return { error: result.error };
  }

  console.log('[VAPI API] Assistant updated:', result.data?.id);
  return { assistant: result.data };
}

/**
 * Elimina un asistente
 */
export async function deleteAssistant(
  assistantId: string
): Promise<{ success: boolean; error?: VAPIError }> {
  console.log('[VAPI API] Deleting assistant:', assistantId);

  const result = await vapiRequest(`/assistant/${assistantId}`, {
    method: 'DELETE',
  });

  if (result.error) {
    console.error('[VAPI API] Failed to delete assistant:', result.error);
    return { success: false, error: result.error };
  }

  return { success: true };
}

// ======================
// PHONE NUMBER MANAGEMENT
// ======================

/**
 * Compra/provisiona un número de teléfono en VAPI
 *
 * Para México, usamos provider 'vapi' con área code deseado
 * VAPI internamente usa Twilio para provisionar
 */
export async function createPhoneNumber(
  request: VAPIPhoneNumberCreateRequest
): Promise<{ phoneNumber?: VAPIPhoneNumber; error?: VAPIError }> {
  console.log('[VAPI API] Creating phone number, area code:', request.numberDesiredAreaCode);

  const result = await vapiRequest<VAPIPhoneNumber>('/phone-number', {
    method: 'POST',
    body: request,
  });

  if (result.error) {
    console.error('[VAPI API] Failed to create phone number:', result.error);
    return { error: result.error };
  }

  console.log('[VAPI API] Phone number created:', result.data?.number);
  return { phoneNumber: result.data };
}

/**
 * Obtiene un número de teléfono por ID
 */
export async function getPhoneNumber(
  phoneNumberId: string
): Promise<{ phoneNumber?: VAPIPhoneNumber; error?: VAPIError }> {
  const result = await vapiRequest<VAPIPhoneNumber>(`/phone-number/${phoneNumberId}`);

  if (result.error) {
    return { error: result.error };
  }

  return { phoneNumber: result.data };
}

/**
 * Lista todos los números de teléfono
 */
export async function listPhoneNumbers(): Promise<{ phoneNumbers?: VAPIPhoneNumber[]; error?: VAPIError }> {
  const result = await vapiRequest<VAPIPhoneNumber[]>('/phone-number');

  if (result.error) {
    return { error: result.error };
  }

  return { phoneNumbers: result.data };
}

/**
 * Actualiza un número de teléfono (ej: cambiar asistente asociado)
 */
export async function updatePhoneNumber(
  phoneNumberId: string,
  updates: {
    assistantId?: string;
    name?: string;
    server?: { url: string; secret?: string };
  }
): Promise<{ phoneNumber?: VAPIPhoneNumber; error?: VAPIError }> {
  console.log('[VAPI API] Updating phone number:', phoneNumberId);

  const result = await vapiRequest<VAPIPhoneNumber>(`/phone-number/${phoneNumberId}`, {
    method: 'PATCH',
    body: updates,
  });

  if (result.error) {
    console.error('[VAPI API] Failed to update phone number:', result.error);
    return { error: result.error };
  }

  return { phoneNumber: result.data };
}

/**
 * Libera/elimina un número de teléfono
 */
export async function deletePhoneNumber(
  phoneNumberId: string
): Promise<{ success: boolean; error?: VAPIError }> {
  console.log('[VAPI API] Deleting phone number:', phoneNumberId);

  const result = await vapiRequest(`/phone-number/${phoneNumberId}`, {
    method: 'DELETE',
  });

  if (result.error) {
    console.error('[VAPI API] Failed to delete phone number:', result.error);
    return { success: false, error: result.error };
  }

  return { success: true };
}

// ======================
// HELPER: Provisionar número completo
// ======================

export interface ProvisioningResult {
  success: boolean;
  assistant?: VAPIAssistant;
  phoneNumber?: VAPIPhoneNumber;
  error?: string;
}

/**
 * Provisiona un número de teléfono completo para un tenant
 *
 * Este es el método principal que usará TIS TIS Platform
 * Crea el asistente + compra el número + los asocia
 */
export async function provisionPhoneNumberForTenant(options: {
  tenantId: string;
  tenantName: string;
  areaCode: string;
  firstMessage: string;
  voiceId?: string;
  webhookUrl: string;
  webhookSecret?: string;
}): Promise<ProvisioningResult> {
  const {
    tenantId,
    tenantName,
    areaCode,
    firstMessage,
    voiceId,
    webhookUrl,
    webhookSecret,
  } = options;

  console.log('[VAPI API] Starting provisioning for tenant:', tenantId);

  // 1. Crear asistente en VAPI
  const assistantResult = await createAssistant({
    name: `TIS TIS - ${tenantName}`,
    firstMessage,
    firstMessageMode: 'assistant-speaks-first',
    voice: voiceId ? {
      provider: '11labs',
      voiceId,
      model: 'eleven_multilingual_v2',
      stability: 0.5,
      similarityBoost: 0.75,
    } : undefined,
    serverUrl: webhookUrl,
    serverUrlSecret: webhookSecret,
    metadata: {
      tenant_id: tenantId,
      platform: 'tistis',
    },
  });

  if (assistantResult.error || !assistantResult.assistant) {
    return {
      success: false,
      error: `Error creando asistente: ${assistantResult.error?.message || 'Unknown'}`,
    };
  }

  // 2. Comprar número de teléfono
  const phoneResult = await createPhoneNumber({
    provider: 'vapi',
    numberDesiredAreaCode: areaCode,
    assistantId: assistantResult.assistant.id,
    name: `${tenantName} - ${areaCode}`,
  });

  if (phoneResult.error || !phoneResult.phoneNumber) {
    // Rollback: eliminar asistente si falló el número
    console.log('[VAPI API] Phone creation failed, rolling back assistant');
    await deleteAssistant(assistantResult.assistant.id);

    return {
      success: false,
      error: `Error comprando número: ${phoneResult.error?.message || 'Unknown'}`,
    };
  }

  console.log('[VAPI API] Provisioning complete!', {
    assistantId: assistantResult.assistant.id,
    phoneNumber: phoneResult.phoneNumber.number,
  });

  return {
    success: true,
    assistant: assistantResult.assistant,
    phoneNumber: phoneResult.phoneNumber,
  };
}

/**
 * Libera recursos de un tenant (asistente + número)
 */
export async function releasePhoneNumberForTenant(
  vapiAssistantId: string,
  vapiPhoneNumberId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[VAPI API] Releasing resources:', { vapiAssistantId, vapiPhoneNumberId });

  // 1. Eliminar número primero
  const phoneResult = await deletePhoneNumber(vapiPhoneNumberId);
  if (!phoneResult.success) {
    return {
      success: false,
      error: `Error liberando número: ${phoneResult.error?.message}`,
    };
  }

  // 2. Eliminar asistente
  const assistantResult = await deleteAssistant(vapiAssistantId);
  if (!assistantResult.success) {
    return {
      success: false,
      error: `Error eliminando asistente: ${assistantResult.error?.message}`,
    };
  }

  return { success: true };
}

// ======================
// EXPORTS
// ======================

export const VAPIApiService = {
  // Assistants
  createAssistant,
  getAssistant,
  updateAssistant,
  deleteAssistant,

  // Phone Numbers
  createPhoneNumber,
  getPhoneNumber,
  listPhoneNumbers,
  updatePhoneNumber,
  deletePhoneNumber,

  // High-level operations
  provisionPhoneNumberForTenant,
  releasePhoneNumberForTenant,
};
