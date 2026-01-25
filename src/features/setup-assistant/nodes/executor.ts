// =====================================================
// TIS TIS PLATFORM - Setup Assistant Action Executor
// Executes pending actions against the database
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type { SetupAssistantStateType } from '../state/setup-state';
import type { MessageAction } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
function isValidUUID(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// =====================================================
// EXECUTOR NODE
// =====================================================

export async function executorNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  if (state.pendingActions.length === 0) {
    return { executedActions: [] };
  }

  const context = state.context;
  if (!context) {
    return {
      executedActions: state.pendingActions.map((action) => ({
        ...action,
        status: 'failure' as const,
        details: { ...action.details, error: 'No context provided' },
      })),
      errors: ['No context provided to executor'],
    };
  }

  const supabase = createServerClient();
  const executedActions: MessageAction[] = [];

  for (const action of state.pendingActions) {
    try {
      const result = await executeAction(
        supabase,
        context.tenantId,
        action
      );

      executedActions.push({
        ...action,
        status: result.success ? 'success' : 'failure',
        entityId: result.entityId,
        details: {
          ...action.details,
          ...(result.error && { error: result.error }),
        },
      });
    } catch (error) {
      console.error(`[SetupAssistant] Error executing action:`, error);
      executedActions.push({
        ...action,
        status: 'failure',
        details: {
          ...action.details,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  return {
    executedActions,
    pendingActions: [], // Clear pending after execution
  };
}

// =====================================================
// ACTION ROUTER
// =====================================================

interface ExecuteResult {
  success: boolean;
  entityId?: string;
  error?: string;
}

async function executeAction(
  supabase: SupabaseClient,
  tenantId: string,
  action: MessageAction
): Promise<ExecuteResult> {
  const { module, entityType, type, details } = action;

  switch (module) {
    case 'services':
      return executeServicesAction(supabase, tenantId, type, entityType, details);

    case 'loyalty':
      return executeLoyaltyAction(supabase, tenantId, type, entityType, details);

    case 'knowledge_base':
      return executeKnowledgeBaseAction(supabase, tenantId, type, entityType, details);

    case 'general':
      return executeGeneralAction(supabase, tenantId, type, details);

    case 'agents':
      return executeAgentsAction(supabase, tenantId, type, details);

    case 'promotions':
      return executePromotionsAction(supabase, tenantId, type, entityType, details);

    default:
      return { success: false, error: `Unknown module: ${module}` };
  }
}

// =====================================================
// SERVICES EXECUTOR
// =====================================================

async function executeServicesAction(
  supabase: SupabaseClient,
  tenantId: string,
  type: string,
  entityType: string,
  details?: Record<string, unknown>
): Promise<ExecuteResult> {
  if (type === 'create' && entityType === 'service') {
    // Validate required fields
    const name = details?.name as string;
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Service name is required' };
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        description: ((details?.description as string) || '').trim(),
        price_min: details?.price as number || 0,
        price_max: details?.price as number || 0,
        duration_minutes: details?.duration as number || 30,
        category: (details?.category as string) || 'general',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  if (type === 'update' && entityType === 'service') {
    const serviceId = details?.id;
    if (!isValidUUID(serviceId)) {
      return { success: false, error: 'Valid Service ID is required for update' };
    }

    const updateData: Record<string, unknown> = {};
    if (details?.name) updateData.name = (details.name as string).trim();
    if (details?.price) {
      updateData.price_min = details.price;
      updateData.price_max = details.price;
    }
    if (details?.duration) updateData.duration_minutes = details.duration;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    const { error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', serviceId)
      .eq('tenant_id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: serviceId };
  }

  if (type === 'delete' && entityType === 'service') {
    const serviceId = details?.id;
    if (!isValidUUID(serviceId)) {
      return { success: false, error: 'Valid Service ID is required for delete' };
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', serviceId)
      .eq('tenant_id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: serviceId };
  }

  return { success: false, error: 'Unknown services action' };
}

// =====================================================
// LOYALTY EXECUTOR
// =====================================================

async function executeLoyaltyAction(
  supabase: SupabaseClient,
  tenantId: string,
  type: string,
  entityType: string,
  details?: Record<string, unknown>
): Promise<ExecuteResult> {
  if (type === 'create' && entityType === 'loyalty_program') {
    const name = (details?.name as string)?.trim() || 'Programa de Lealtad';

    const { data, error } = await supabase
      .from('loyalty_programs')
      .insert({
        tenant_id: tenantId,
        name,
        description: ((details?.description as string) || '').trim(),
        points_per_currency: details?.pointsPerCurrency as number || 1,
        currency_symbol: '$',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  if (type === 'create' && entityType === 'loyalty_tier') {
    const programId = details?.programId;
    const name = details?.name as string;
    if (!isValidUUID(programId)) {
      return { success: false, error: 'Valid Program ID is required for tier creation' };
    }
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Tier name is required' };
    }

    // Verify program belongs to tenant (security check)
    const { data: program } = await supabase
      .from('loyalty_programs')
      .select('id')
      .eq('id', programId)
      .eq('tenant_id', tenantId)
      .single();

    if (!program) {
      return { success: false, error: 'Loyalty program not found or does not belong to tenant' };
    }

    const { data, error } = await supabase
      .from('loyalty_tiers')
      .insert({
        program_id: programId,
        name: name.trim(),
        min_points: details?.minPoints as number || 0,
        benefits: details?.benefits || {},
        sort_order: details?.sortOrder as number || 0,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  if (type === 'create' && entityType === 'loyalty_reward') {
    const programId = details?.programId;
    const name = details?.name as string;
    if (!isValidUUID(programId)) {
      return { success: false, error: 'Valid Program ID is required for reward creation' };
    }
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Reward name is required' };
    }

    // Verify program belongs to tenant (security check)
    const { data: program } = await supabase
      .from('loyalty_programs')
      .select('id')
      .eq('id', programId)
      .eq('tenant_id', tenantId)
      .single();

    if (!program) {
      return { success: false, error: 'Loyalty program not found or does not belong to tenant' };
    }

    const { data, error } = await supabase
      .from('loyalty_rewards')
      .insert({
        program_id: programId,
        tenant_id: tenantId,
        name: name.trim(),
        description: ((details?.description as string) || '').trim(),
        points_cost: details?.pointsCost as number || 100,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  return { success: false, error: 'Unknown loyalty action' };
}

// =====================================================
// KNOWLEDGE BASE EXECUTOR
// =====================================================

async function executeKnowledgeBaseAction(
  supabase: SupabaseClient,
  tenantId: string,
  type: string,
  entityType: string,
  details?: Record<string, unknown>
): Promise<ExecuteResult> {
  if (type === 'create' && entityType === 'faq') {
    const question = details?.question as string;
    const answer = details?.answer as string;
    if (!question || question.trim().length === 0) {
      return { success: false, error: 'FAQ question is required' };
    }
    if (!answer || answer.trim().length === 0) {
      return { success: false, error: 'FAQ answer is required' };
    }

    const { data, error } = await supabase
      .from('faqs')
      .insert({
        tenant_id: tenantId,
        question: question.trim(),
        answer: answer.trim(),
        category: (details?.category as string) || 'general',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  if (type === 'update' && entityType === 'faq') {
    const faqId = details?.id;
    if (!isValidUUID(faqId)) {
      return { success: false, error: 'Valid FAQ ID is required for update' };
    }

    const updateData: Record<string, unknown> = {};
    if (details?.question) updateData.question = (details.question as string).trim();
    if (details?.answer) updateData.answer = (details.answer as string).trim();
    if (details?.category) updateData.category = details.category;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    const { error } = await supabase
      .from('faqs')
      .update(updateData)
      .eq('id', faqId)
      .eq('tenant_id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: faqId };
  }

  if (type === 'delete' && entityType === 'faq') {
    const faqId = details?.id;
    if (!isValidUUID(faqId)) {
      return { success: false, error: 'Valid FAQ ID is required for delete' };
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('faqs')
      .update({ is_active: false })
      .eq('id', faqId)
      .eq('tenant_id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: faqId };
  }

  return { success: false, error: 'Unknown knowledge base action' };
}

// =====================================================
// GENERAL EXECUTOR
// =====================================================

async function executeGeneralAction(
  supabase: SupabaseClient,
  tenantId: string,
  type: string,
  details?: Record<string, unknown>
): Promise<ExecuteResult> {
  if (type === 'update') {
    const field = details?.field as string;
    const value = details?.value;

    if (!field) return { success: false, error: 'No field specified' };

    // Only allow safe fields to be updated
    const allowedFields = ['name', 'timezone', 'business_hours', 'policies', 'phone', 'email', 'address'];
    if (!allowedFields.includes(field)) {
      return { success: false, error: `Field ${field} not allowed for update` };
    }

    const { error } = await supabase
      .from('tenants')
      .update({ [field]: value })
      .eq('id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: tenantId };
  }

  return { success: false, error: 'Unknown general action' };
}

// =====================================================
// AGENTS EXECUTOR
// =====================================================

// Allowed AI settings fields that can be configured via the assistant
const ALLOWED_AI_SETTINGS_FIELDS = [
  'tone',           // formal, friendly, professional
  'greeting',       // Custom greeting message
  'farewell',       // Custom farewell message
  'language',       // Primary language
  'escalation_threshold', // When to escalate to human
  'response_style', // concise, detailed
  'personality',    // Bot personality traits
  'auto_greeting',  // Enable/disable auto greeting
];

async function executeAgentsAction(
  supabase: SupabaseClient,
  tenantId: string,
  type: string,
  details?: Record<string, unknown>
): Promise<ExecuteResult> {
  if (type === 'configure') {
    if (!details || Object.keys(details).length === 0) {
      return { success: false, error: 'No configuration provided' };
    }

    // Filter to only allowed fields
    const filteredSettings: Record<string, unknown> = {};
    for (const key of Object.keys(details)) {
      if (ALLOWED_AI_SETTINGS_FIELDS.includes(key)) {
        filteredSettings[key] = details[key];
      }
    }

    if (Object.keys(filteredSettings).length === 0) {
      return { success: false, error: 'No valid AI settings fields provided' };
    }

    // Update AI settings in tenant
    const { data: existing } = await supabase
      .from('tenants')
      .select('ai_settings')
      .eq('id', tenantId)
      .single();

    const currentSettings = (existing?.ai_settings as Record<string, unknown>) || {};
    const updatedSettings = { ...currentSettings, ...filteredSettings };

    const { error } = await supabase
      .from('tenants')
      .update({ ai_settings: updatedSettings })
      .eq('id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: tenantId };
  }

  return { success: false, error: 'Unknown agents action' };
}

// =====================================================
// PROMOTIONS EXECUTOR
// =====================================================

async function executePromotionsAction(
  supabase: SupabaseClient,
  tenantId: string,
  type: string,
  entityType: string,
  details?: Record<string, unknown>
): Promise<ExecuteResult> {
  if (type === 'create' && entityType === 'promotion') {
    const title = details?.title as string;
    if (!title || title.trim().length === 0) {
      return { success: false, error: 'Promotion title is required' };
    }

    const discountValue = details?.discountValue as number;
    if (discountValue === undefined || discountValue < 0) {
      return { success: false, error: 'Valid discount value is required' };
    }

    const { data, error } = await supabase
      .from('promotions')
      .insert({
        tenant_id: tenantId,
        title: title.trim(),
        description: ((details?.description as string) || '').trim(),
        discount_type: (details?.discountType as string) || 'percentage',
        discount_value: discountValue,
        conditions: ((details?.conditions as string) || '').trim(),
        valid_from: (details?.validFrom as string) || new Date().toISOString(),
        valid_until: details?.validUntil as string || null,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  if (type === 'delete' && entityType === 'promotion') {
    const promotionId = details?.id;
    if (!isValidUUID(promotionId)) {
      return { success: false, error: 'Valid Promotion ID is required for delete' };
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: false })
      .eq('id', promotionId)
      .eq('tenant_id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: promotionId };
  }

  return { success: false, error: 'Unknown promotions action' };
}
