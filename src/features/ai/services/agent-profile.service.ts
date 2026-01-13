// =====================================================
// TIS TIS PLATFORM - Agent Profile Service
// Servicio para gestión de perfiles de agentes de IA
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type {
  AgentProfile,
  AgentProfileInput,
  AgentProfileWithChannels,
  ChannelConnection,
  VoiceConfigSummary,
  AILearningConfig,
} from '@/src/shared/types/agent-profiles';
import {
  DEFAULT_AI_LEARNING_CONFIG,
  DEFAULT_BUSINESS_PROFILE,
  DEFAULT_PERSONAL_PROFILE,
} from '@/src/shared/types/agent-profiles';
import type { ProfileType, VerticalType, ResponseStyle } from '@/src/shared/config/agent-templates';
import { getDefaultTemplate } from '@/src/shared/config/agent-templates';

// =====================================================
// SUPABASE CLIENT
// =====================================================

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// GET PROFILES
// =====================================================

/**
 * Obtiene todos los perfiles de un tenant
 */
export async function getAgentProfiles(tenantId: string): Promise<{
  business: AgentProfileWithChannels | null;
  personal: AgentProfileWithChannels | null;
}> {
  const supabase = createServerClient();

  // Ejecutar todas las queries en paralelo para mejor performance
  const [profilesResult, aiAgentsResult, voiceConfigResult, voicePhoneResult] = await Promise.all([
    supabase
      .from('agent_profiles')
      .select('*')
      .eq('tenant_id', tenantId),
    supabase
      .from('ai_agents')
      .select('id, channel_type, channel_identifier, is_active, account_number, profile_id')
      .eq('tenant_id', tenantId),
    supabase
      .from('voice_agent_config')
      .select('voice_enabled, assistant_name, selected_voice_id, profile_id')
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('voice_phone_numbers')
      .select('phone_number, friendly_name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single(),
  ]);

  if (profilesResult.error) {
    console.error('[AgentProfile] Error fetching profiles:', profilesResult.error);
    throw new Error('Error al obtener perfiles');
  }

  const profiles = profilesResult.data;
  const aiAgents = aiAgentsResult.data;
  const voiceConfig = voiceConfigResult.data;
  const voicePhone = voicePhoneResult.data;

  // Mapear perfiles con canales
  const businessProfile = profiles?.find(p => p.profile_type === 'business') || null;
  const personalProfile = profiles?.find(p => p.profile_type === 'personal') || null;

  const mapProfileWithChannels = (profile: AgentProfile | null, type: ProfileType): AgentProfileWithChannels | null => {
    if (!profile) return null;

    // Filtrar canales que pertenecen a este perfil
    const profileChannels = (aiAgents || [])
      .filter(a => a.profile_id === profile.id || (type === 'business' && !a.profile_id))
      .map(a => ({
        channel_type: a.channel_type as ChannelConnection['channel_type'],
        channel_identifier: a.channel_identifier,
        is_connected: a.is_active,
        account_number: (a.account_number || 1) as 1 | 2,
      }));

    // Voice config solo para business
    let voice: VoiceConfigSummary | undefined;
    if (type === 'business' && voiceConfig) {
      voice = {
        enabled: voiceConfig.voice_enabled || false,
        phone_number: voicePhone?.phone_number,
        voice_id: voiceConfig.selected_voice_id,
        voice_name: voiceConfig.selected_voice_id, // TODO: mapear a nombre
        assistant_name: voiceConfig.assistant_name,
      };
    }

    return {
      ...profile,
      channels: profileChannels,
      voice_config: voice,
    };
  };

  return {
    business: mapProfileWithChannels(businessProfile, 'business'),
    personal: mapProfileWithChannels(personalProfile, 'personal'),
  };
}

/**
 * Obtiene un perfil específico por tipo
 */
export async function getAgentProfile(
  tenantId: string,
  profileType: ProfileType
): Promise<AgentProfile | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('profile_type', profileType)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[AgentProfile] Error fetching profile:', error);
    throw new Error('Error al obtener perfil');
  }

  return data;
}

// =====================================================
// CREATE PROFILE
// =====================================================

/**
 * Crea un nuevo perfil de agente
 */
export async function createAgentProfile(
  tenantId: string,
  profileType: ProfileType,
  input: AgentProfileInput,
  userId?: string
): Promise<AgentProfile> {
  const supabase = createServerClient();

  // Verificar que no exista ya un perfil de este tipo
  const existing = await getAgentProfile(tenantId, profileType);
  if (existing) {
    throw new Error(`Ya existe un perfil de tipo ${profileType} para este tenant`);
  }

  // Obtener defaults según tipo
  const defaults = profileType === 'business'
    ? DEFAULT_BUSINESS_PROFILE
    : DEFAULT_PERSONAL_PROFILE;

  const profileData = {
    tenant_id: tenantId,
    profile_type: profileType,
    profile_name: input.profile_name,
    profile_description: input.profile_description,
    agent_template: input.agent_template,
    response_style: input.response_style || defaults.response_style,
    response_delay_minutes: input.response_delay_minutes ?? defaults.response_delay_minutes,
    response_delay_first_only: input.response_delay_first_only ?? defaults.response_delay_first_only,
    custom_instructions_override: input.custom_instructions_override,
    ai_learning_enabled: input.ai_learning_enabled ?? defaults.ai_learning_enabled,
    ai_learning_config: {
      ...DEFAULT_AI_LEARNING_CONFIG,
      ...input.ai_learning_config,
    },
    settings: {
      ...defaults.settings,
      ...input.settings,
    },
    is_active: input.is_active ?? true,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('agent_profiles')
    .insert(profileData)
    .select()
    .single();

  if (error) {
    console.error('[AgentProfile] Error creating profile:', error);
    throw new Error('Error al crear perfil');
  }

  console.log(`[AgentProfile] Created ${profileType} profile for tenant ${tenantId}`);
  return data;
}

// =====================================================
// UPDATE PROFILE
// =====================================================

/**
 * Actualiza un perfil existente
 */
export async function updateAgentProfile(
  tenantId: string,
  profileType: ProfileType,
  updates: Partial<AgentProfileInput>
): Promise<AgentProfile> {
  const supabase = createServerClient();

  // Construir objeto de actualización
  const updateData: Record<string, unknown> = {};

  if (updates.profile_name !== undefined) updateData.profile_name = updates.profile_name;
  if (updates.profile_description !== undefined) updateData.profile_description = updates.profile_description;
  if (updates.agent_template !== undefined) updateData.agent_template = updates.agent_template;
  if (updates.response_style !== undefined) updateData.response_style = updates.response_style;
  if (updates.response_delay_minutes !== undefined) updateData.response_delay_minutes = updates.response_delay_minutes;
  if (updates.response_delay_first_only !== undefined) updateData.response_delay_first_only = updates.response_delay_first_only;
  if (updates.custom_instructions_override !== undefined) updateData.custom_instructions_override = updates.custom_instructions_override;
  if (updates.ai_learning_enabled !== undefined) updateData.ai_learning_enabled = updates.ai_learning_enabled;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  // Merge configs si se proporcionan
  if (updates.ai_learning_config) {
    const current = await getAgentProfile(tenantId, profileType);
    updateData.ai_learning_config = {
      ...(current?.ai_learning_config || DEFAULT_AI_LEARNING_CONFIG),
      ...updates.ai_learning_config,
    };
  }

  if (updates.settings) {
    const current = await getAgentProfile(tenantId, profileType);
    updateData.settings = {
      ...(current?.settings || {}),
      ...updates.settings,
    };
  }

  const { data, error } = await supabase
    .from('agent_profiles')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('profile_type', profileType)
    .select()
    .single();

  if (error) {
    console.error('[AgentProfile] Error updating profile:', error);
    throw new Error('Error al actualizar perfil');
  }

  console.log(`[AgentProfile] Updated ${profileType} profile for tenant ${tenantId}`);
  return data;
}

// =====================================================
// TOGGLE PROFILE
// =====================================================

/**
 * Activa o desactiva un perfil
 */
export async function toggleAgentProfile(
  tenantId: string,
  profileType: ProfileType,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  // El perfil business no se puede desactivar
  if (profileType === 'business' && !isActive) {
    return {
      success: false,
      error: 'El perfil de negocio no puede ser desactivado',
    };
  }

  const { error } = await supabase
    .from('agent_profiles')
    .update({ is_active: isActive })
    .eq('tenant_id', tenantId)
    .eq('profile_type', profileType);

  if (error) {
    console.error('[AgentProfile] Error toggling profile:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =====================================================
// DELETE PROFILE
// =====================================================

/**
 * Elimina un perfil (solo personal, business no se puede eliminar)
 */
export async function deleteAgentProfile(
  tenantId: string,
  profileType: ProfileType
): Promise<{ success: boolean; error?: string }> {
  if (profileType === 'business') {
    return {
      success: false,
      error: 'El perfil de negocio no puede ser eliminado',
    };
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('agent_profiles')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('profile_type', profileType);

  if (error) {
    console.error('[AgentProfile] Error deleting profile:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =====================================================
// ENSURE DEFAULT PROFILE
// =====================================================

/**
 * Asegura que exista un perfil business por defecto
 */
export async function ensureDefaultBusinessProfile(
  tenantId: string,
  tenantName: string,
  vertical: VerticalType,
  userId?: string
): Promise<AgentProfile> {
  const existing = await getAgentProfile(tenantId, 'business');
  if (existing) return existing;

  const defaultTemplate = getDefaultTemplate(vertical, 'business');

  return createAgentProfile(tenantId, 'business', {
    profile_name: tenantName || 'Mi Negocio',
    agent_template: defaultTemplate?.key || 'general_full',
    response_style: 'professional_friendly',
  }, userId);
}

// =====================================================
// GET PROFILE FOR AI
// =====================================================

/**
 * Obtiene el perfil activo para usar en el AI
 * Incluye la configuración necesaria para generar prompts
 */
export async function getProfileForAI(
  tenantId: string,
  profileType: ProfileType = 'business'
): Promise<{
  profile: AgentProfile | null;
  template_key: string;
  response_style: ResponseStyle;
  custom_instructions: string | null;
  delay_config: {
    minutes: number;
    first_only: boolean;
  };
  learning_config: AILearningConfig;
} | null> {
  const profile = await getAgentProfile(tenantId, profileType);

  if (!profile || !profile.is_active) {
    // Si no hay perfil activo del tipo solicitado, usar business
    if (profileType === 'personal') {
      return getProfileForAI(tenantId, 'business');
    }
    return null;
  }

  return {
    profile,
    template_key: profile.agent_template,
    response_style: profile.response_style,
    custom_instructions: profile.custom_instructions_override ?? null,
    delay_config: {
      minutes: profile.response_delay_minutes,
      first_only: profile.response_delay_first_only,
    },
    learning_config: profile.ai_learning_config,
  };
}

// =====================================================
// LINK CHANNEL TO PROFILE
// =====================================================

/**
 * Vincula un canal (ai_agent) a un perfil
 */
export async function linkChannelToProfile(
  tenantId: string,
  channelId: string,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ai_agents')
    .update({ profile_id: profileId })
    .eq('id', channelId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[AgentProfile] Error linking channel:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =====================================================
// EXPORTS
// =====================================================

export const AgentProfileService = {
  getProfiles: getAgentProfiles,
  getProfile: getAgentProfile,
  createProfile: createAgentProfile,
  updateProfile: updateAgentProfile,
  toggleProfile: toggleAgentProfile,
  deleteProfile: deleteAgentProfile,
  ensureDefaultProfile: ensureDefaultBusinessProfile,
  getProfileForAI,
  linkChannelToProfile,
};

export default AgentProfileService;
