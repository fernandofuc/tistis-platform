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
// LOCAL TYPES
// =====================================================

interface AIAgentRow {
  id: string;
  channel_type: string;
  channel_identifier: string;
  is_active: boolean;
  account_number: number | null;
  profile_id: string | null;
}

interface ChannelConnectionRow {
  id: string;
  channel: string;
  account_name: string;
  account_number: number;
  status: string;
  profile_id: string | null;
  is_personal_brand: boolean;
}

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
 * RESILIENTE: Funciona incluso si la tabla agent_profiles no existe
 * En ese caso, construye un perfil virtual basado en ai_agents y voice_agent_config
 */
export async function getAgentProfiles(tenantId: string): Promise<{
  business: AgentProfileWithChannels | null;
  personal: AgentProfileWithChannels | null;
}> {
  const supabase = createServerClient();

  // Ejecutar queries en paralelo - agent_profiles puede no existir
  // Primero intentamos cargar agent_profiles, si falla asumimos que no existe
  let profilesData: AgentProfile[] = [];
  try {
    const profilesResult = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('tenant_id', tenantId);

    if (!profilesResult.error) {
      profilesData = profilesResult.data || [];
    }
  } catch {
    // Tabla no existe, continuar con perfil virtual
    console.log('[AgentProfile] agent_profiles table not found, using virtual profile');
  }

  // Cargar el resto en paralelo
  const [aiAgentsResult, channelConnectionsResult, voiceConfigResult, voicePhoneResult, tenantResult] = await Promise.all([
    supabase
      .from('ai_agents')
      .select('id, channel_type, channel_identifier, is_active, account_number, profile_id')
      .eq('tenant_id', tenantId),
    supabase
      .from('channel_connections')
      .select('id, channel, account_name, account_number, status, profile_id, is_personal_brand')
      .eq('tenant_id', tenantId),
    supabase
      .from('voice_agent_config')
      .select('voice_enabled, assistant_name, selected_voice_id, profile_id, is_active')
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('voice_phone_numbers')
      .select('phone_number, friendly_name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single(),
    supabase
      .from('tenants')
      .select('name, vertical')
      .eq('id', tenantId)
      .single(),
  ]);

  const aiAgents: AIAgentRow[] = (aiAgentsResult.data || []) as AIAgentRow[];
  const channelConnections: ChannelConnectionRow[] = (channelConnectionsResult.data || []) as ChannelConnectionRow[];
  const voiceConfig = voiceConfigResult.data;
  const voicePhone = voicePhoneResult.data;
  const tenant = tenantResult.data;

  // Buscar perfiles existentes
  let businessProfile = profilesData.find(p => p.profile_type === 'business') || null;
  let personalProfile = profilesData.find(p => p.profile_type === 'personal') || null;

  // Si no hay perfil business pero hay ai_agents o voice_config, crear perfil virtual
  if (!businessProfile && (aiAgents.length > 0 || voiceConfig)) {
    businessProfile = {
      id: 'virtual-business',
      tenant_id: tenantId,
      profile_type: 'business' as ProfileType,
      profile_name: tenant?.name ? `${tenant.name}` : 'Perfil de Negocio',
      profile_description: 'Perfil principal del negocio',
      agent_template: tenant?.vertical === 'dental' ? 'dental_full' :
                      tenant?.vertical === 'restaurant' ? 'resto_full' : 'general_full',
      response_style: 'professional_friendly' as ResponseStyle,
      response_delay_minutes: 0,
      response_delay_first_only: true,
      custom_instructions_override: undefined,
      ai_learning_enabled: true,
      ai_learning_config: {
        learn_patterns: true,
        learn_vocabulary: false,
        learn_preferences: true,
        sync_to_business_ia: true,
      },
      settings: {},
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const mapProfileWithChannels = (profile: AgentProfile | null, type: ProfileType): AgentProfileWithChannels | null => {
    if (!profile) return null;

    // Determinar si es un perfil virtual (no existe en BD)
    const isVirtualProfile = profile.id.startsWith('virtual-');

    // Filtrar canales que pertenecen a este perfil desde channel_connections
    // Prioridad: profile_id explícito > is_personal_brand boolean (legacy) > default to business
    const profileChannels = (channelConnections || [])
      .filter(c => {
        // Para perfiles virtuales, usar solo el fallback de is_personal_brand
        if (isVirtualProfile) {
          if (type === 'personal') {
            return c.is_personal_brand === true;
          }
          // Default: canales sin marca personal van a business virtual
          return !c.is_personal_brand;
        }

        // Si tiene profile_id, usarlo directamente
        if (c.profile_id) {
          return c.profile_id === profile.id;
        }
        // Fallback: usar is_personal_brand boolean (compatibilidad con datos existentes)
        if (type === 'personal') {
          return c.is_personal_brand === true;
        }
        // Por defecto, los canales sin profile_id van a business
        return type === 'business' && !c.is_personal_brand;
      })
      .map(c => ({
        channel_id: c.id,
        channel_type: c.channel as ChannelConnection['channel_type'],
        channel_identifier: c.account_name,
        account_name: c.account_name,
        is_connected: c.status === 'connected',
        account_number: (c.account_number || 1) as 1 | 2,
        profile_id: c.profile_id,
      }));

    // También incluir canales de ai_agents (legacy, para backwards compatibility)
    const legacyChannels = (aiAgents || [])
      .filter(a => {
        // Solo agregar si no está ya en channelConnections
        const alreadyExists = profileChannels.some(
          pc => pc.channel_type === a.channel_type && pc.account_number === (a.account_number || 1)
        );
        if (alreadyExists) return false;

        // Para perfiles virtuales, asignar todos los legacy channels sin profile_id a business
        if (isVirtualProfile) {
          return type === 'business' && !a.profile_id;
        }

        return a.profile_id === profile.id || (type === 'business' && !a.profile_id);
      })
      .map(a => ({
        channel_id: a.id,
        channel_type: a.channel_type as ChannelConnection['channel_type'],
        channel_identifier: a.channel_identifier,
        account_name: a.channel_identifier,
        is_connected: a.is_active,
        account_number: (a.account_number || 1) as 1 | 2,
        profile_id: a.profile_id,
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
      channels: [...profileChannels, ...legacyChannels],
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
 * RESILIENTE: Usa getAgentProfiles que maneja tabla no existente
 */
export async function getAgentProfile(
  tenantId: string,
  profileType: ProfileType
): Promise<AgentProfile | null> {
  try {
    const profiles = await getAgentProfiles(tenantId);
    const profile = profileType === 'business' ? profiles.business : profiles.personal;
    return profile ? {
      id: profile.id,
      tenant_id: profile.tenant_id,
      profile_type: profile.profile_type,
      profile_name: profile.profile_name,
      profile_description: profile.profile_description,
      agent_template: profile.agent_template,
      response_style: profile.response_style,
      response_delay_minutes: profile.response_delay_minutes,
      response_delay_first_only: profile.response_delay_first_only,
      custom_instructions_override: profile.custom_instructions_override,
      ai_learning_enabled: profile.ai_learning_enabled,
      ai_learning_config: profile.ai_learning_config,
      settings: profile.settings,
      is_active: profile.is_active,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    } : null;
  } catch (error) {
    console.error('[AgentProfile] Error fetching profile:', error);
    return null;
  }
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

    // Sincronizar campos de escalamiento con ai_tenant_config
    // para que la IA los lea correctamente (solo para perfil business)
    if (profileType === 'business') {
      const escalationFields: Record<string, unknown> = {};

      if (updates.settings.escalation_keywords !== undefined) {
        escalationFields.escalation_keywords = updates.settings.escalation_keywords;
      }
      if (updates.settings.max_turns_before_escalation !== undefined) {
        escalationFields.max_turns_before_escalation = updates.settings.max_turns_before_escalation;
      }
      if (updates.settings.escalate_on_hot_lead !== undefined) {
        escalationFields.escalate_on_hot_lead = updates.settings.escalate_on_hot_lead;
      }
      if (updates.settings.out_of_hours_enabled !== undefined) {
        escalationFields.out_of_hours_enabled = updates.settings.out_of_hours_enabled;
      }
      if (updates.settings.out_of_hours_message !== undefined) {
        escalationFields.out_of_hours_message = updates.settings.out_of_hours_message;
      }
      if (updates.settings.max_response_length !== undefined) {
        escalationFields.max_tokens = updates.settings.max_response_length;
      }

      // Solo sincronizar si hay campos de escalamiento para actualizar
      if (Object.keys(escalationFields).length > 0) {
        // Usar upsert para crear el registro si no existe
        const { error: aiConfigError } = await supabase
          .from('ai_tenant_config')
          .upsert({
            tenant_id: tenantId,
            ...escalationFields,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id',
          });

        if (aiConfigError) {
          console.warn('[AgentProfile] Could not sync escalation settings to ai_tenant_config:', aiConfigError);
          // No lanzamos error, solo warning - el perfil aún se puede guardar
        } else {
          console.log('[AgentProfile] Synced escalation settings to ai_tenant_config');
        }
      }
    }
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
