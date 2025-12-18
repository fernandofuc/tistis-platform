// =====================================================
// TIS TIS PLATFORM - Channels Service
// API client for channel connections
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  ChannelConnection,
  ChannelType,
  AccountNumber,
  CreateChannelRequest,
  UpdateChannelRequest,
  EffectiveChannelAIConfig,
  ChannelGroup,
  CHANNEL_METADATA,
} from '../types/channels.types';

// ======================
// HELPER
// ======================

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// ======================
// GET ALL CHANNELS
// ======================

export async function getChannels(): Promise<ChannelConnection[]> {
  const result = await fetchWithAuth('/api/channels');
  return result.data || [];
}

// ======================
// GET CHANNELS BY TYPE
// ======================

export async function getChannelsByType(channel: ChannelType): Promise<ChannelConnection[]> {
  const result = await fetchWithAuth(`/api/channels?channel=${channel}`);
  return result.data || [];
}

// ======================
// GET SINGLE CHANNEL
// ======================

export async function getChannel(id: string): Promise<ChannelConnection> {
  const result = await fetchWithAuth(`/api/channels?id=${id}`);
  return result.data;
}

// ======================
// CREATE CHANNEL
// ======================

export async function createChannel(data: CreateChannelRequest): Promise<ChannelConnection> {
  const result = await fetchWithAuth('/api/channels', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

// ======================
// UPDATE CHANNEL
// ======================

export async function updateChannel(id: string, data: Partial<UpdateChannelRequest>): Promise<ChannelConnection> {
  const result = await fetchWithAuth('/api/channels', {
    method: 'PUT',
    body: JSON.stringify({ id, ...data }),
  });
  return result.data;
}

// ======================
// DELETE CHANNEL
// ======================

export async function deleteChannel(id: string): Promise<void> {
  await fetchWithAuth(`/api/channels?id=${id}`, {
    method: 'DELETE',
  });
}

// ======================
// GET CHANNEL AI CONFIG
// ======================

export async function getChannelAIConfig(channelId: string): Promise<EffectiveChannelAIConfig> {
  const result = await fetchWithAuth(`/api/channels/${channelId}/ai-config`);
  return result.data;
}

// ======================
// UPDATE CHANNEL AI CONFIG
// ======================

export async function updateChannelAIConfig(
  channelId: string,
  config: Partial<EffectiveChannelAIConfig>
): Promise<ChannelConnection> {
  const result = await fetchWithAuth(`/api/channels/${channelId}/ai-config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
  return result.data;
}

// ======================
// TOGGLE AI FOR CHANNEL
// ======================

export async function toggleChannelAI(channelId: string, enabled: boolean): Promise<ChannelConnection> {
  return updateChannel(channelId, { ai_enabled: enabled });
}

// ======================
// TEST CHANNEL CONNECTION
// ======================

export async function testWhatsAppConnection(phoneNumberId: string, accessToken: string): Promise<{
  success: boolean;
  message: string;
  phoneNumber?: string;
}> {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();

    if (response.ok && data.id) {
      return {
        success: true,
        message: `Conexión exitosa! Número: ${data.display_phone_number || data.id}`,
        phoneNumber: data.display_phone_number,
      };
    }
    return {
      success: false,
      message: data.error?.message || 'Error al verificar credenciales',
    };
  } catch {
    return {
      success: false,
      message: 'Error de conexión',
    };
  }
}

export async function testInstagramConnection(accountId: string, accessToken: string): Promise<{
  success: boolean;
  message: string;
  username?: string;
}> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}?fields=id,username,name&access_token=${accessToken}`
    );
    const data = await response.json();

    if (response.ok && data.id) {
      return {
        success: true,
        message: `Conexión exitosa! Cuenta: @${data.username || data.name || data.id}`,
        username: data.username,
      };
    }
    return {
      success: false,
      message: data.error?.message || 'Error al verificar credenciales',
    };
  } catch {
    return {
      success: false,
      message: 'Error de conexión',
    };
  }
}

export async function testFacebookConnection(pageId: string, accessToken: string): Promise<{
  success: boolean;
  message: string;
  pageName?: string;
}> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=id,name&access_token=${accessToken}`
    );
    const data = await response.json();

    if (response.ok && data.id) {
      return {
        success: true,
        message: `Conexión exitosa! Página: ${data.name || data.id}`,
        pageName: data.name,
      };
    }
    return {
      success: false,
      message: data.error?.message || 'Error al verificar credenciales',
    };
  } catch {
    return {
      success: false,
      message: 'Error de conexión',
    };
  }
}

export function testTikTokConnection(accessToken: string): {
  success: boolean;
  message: string;
} {
  // TikTok requires server-side API calls due to CORS
  // We validate format only
  if (accessToken.startsWith('act.') && accessToken.length > 20) {
    return {
      success: true,
      message: 'Formato de token válido. La conexión se verificará al recibir el primer mensaje.',
    };
  }
  return {
    success: false,
    message: 'El formato del Access Token no parece correcto. Debe comenzar con "act."',
  };
}

// ======================
// GROUP CHANNELS BY TYPE
// ======================

export function groupChannelsByType(
  connections: ChannelConnection[],
  metadata: typeof CHANNEL_METADATA
): ChannelGroup[] {
  const channelTypes: ChannelType[] = ['whatsapp', 'instagram', 'facebook', 'tiktok'];

  return channelTypes.map(type => {
    const accounts = connections.filter(c => c.channel === type);
    return {
      type,
      metadata: metadata[type],
      accounts,
      canAddMore: accounts.length < 2,
    };
  });
}

// ======================
// GET NEXT ACCOUNT NUMBER
// ======================

export function getNextAccountNumber(connections: ChannelConnection[], channel: ChannelType): AccountNumber | null {
  const existing = connections.filter(c => c.channel === channel);
  if (existing.length === 0) return 1;
  if (existing.length === 1) {
    return existing[0].account_number === 1 ? 2 : 1;
  }
  return null; // Both accounts exist
}

// ======================
// FORMAT DELAY FOR DISPLAY
// ======================

export function formatDelay(seconds: number): string {
  if (seconds === 0) return 'Inmediato';
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes} minutos`;
  return `${minutes}m ${remainingSeconds}s`;
}
