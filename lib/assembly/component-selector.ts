import { SupabaseClient } from '@supabase/supabase-js';
import { ClientConfig, Component } from './types';

const PLAN_HIERARCHY = ['starter', 'essentials', 'growth', 'scale'];

/**
 * Verifies if the client's plan is sufficient for the component
 */
function isPlanSufficient(clientPlan: string, requiredPlan: string | null): boolean {
  if (!requiredPlan) return true;

  const clientIndex = PLAN_HIERARCHY.indexOf(clientPlan);
  const requiredIndex = PLAN_HIERARCHY.indexOf(requiredPlan);

  return clientIndex >= requiredIndex;
}

/**
 * Selects all applicable components for a client based on their configuration
 */
export async function selectComponents(
  supabase: SupabaseClient,
  config: ClientConfig
): Promise<Component[]> {
  console.log('[ComponentSelector] 🔍 Starting selection for:', {
    client_id: config.client_id,
    vertical: config.vertical,
    plan: config.plan,
    addons: config.addons
  });

  // 1. Get all active components
  const { data: allComponents, error } = await supabase
    .from('component_registry')
    .select('*')
    .eq('is_active', true)
    .eq('is_deprecated', false)
    .order('deployment_order', { ascending: true });

  if (error) {
    throw new Error(`Error fetching components: ${error.message}`);
  }

  if (!allComponents || allComponents.length === 0) {
    console.warn('[ComponentSelector] ⚠️ No active components found in registry');
    return [];
  }

  console.log(`[ComponentSelector] 📦 Total active components: ${allComponents.length}`);

  // 2. Filter applicable components
  const selectedComponents: Component[] = [];
  const clientPlanIndex = PLAN_HIERARCHY.indexOf(config.plan);

  for (const component of allComponents) {
    let shouldInclude = false;
    let reason = '';

    // CORE: Always include
    if (component.component_type === 'core') {
      shouldInclude = true;
      reason = 'CORE component (always included)';
    }

    // PLAN_FEATURE: Include if client plan >= required plan
    else if (component.component_type === 'plan_feature') {
      if (isPlanSufficient(config.plan, component.min_plan_required)) {
        shouldInclude = true;
        reason = `Plan ${config.plan} includes ${component.min_plan_required || 'all'} features`;
      }
    }

    // VERTICAL_MODULE: Include if matches vertical AND plan
    else if (component.component_type === 'vertical_module') {
      const verticalMatch = !component.vertical_applicable ||
        component.vertical_applicable.includes(config.vertical) ||
        component.vertical_applicable.includes('all');

      if (verticalMatch && isPlanSufficient(config.plan, component.min_plan_required)) {
        shouldInclude = true;
        reason = `Vertical ${config.vertical} with plan ${config.plan}`;
      }
    }

    // ADDON: Include only if explicitly selected
    else if (component.component_type === 'addon') {
      if (config.addons.includes(component.component_name)) {
        shouldInclude = true;
        reason = `Addon selected: ${component.component_name}`;
      }
    }

    // INTEGRATION: Include if matches legacy system
    else if (component.component_type === 'integration') {
      if (config.legacy_system) {
        const integrationName = component.component_name.toLowerCase();
        const legacyName = config.legacy_system.toLowerCase();

        if (integrationName.includes(legacyName) || legacyName.includes(integrationName)) {
          shouldInclude = true;
          reason = `Legacy integration: ${config.legacy_system}`;
        }
      }
    }

    // Apply feature overrides
    if (config.feature_overrides[component.component_name] === false) {
      shouldInclude = false;
      reason = 'Disabled by feature override';
    } else if (config.feature_overrides[component.component_name] === true) {
      shouldInclude = true;
      reason = 'Enabled by feature override';
    }

    if (shouldInclude) {
      selectedComponents.push(component);
      console.log(`[ComponentSelector] ✅ ${component.component_name}: ${reason}`);
    }
  }

  console.log(`[ComponentSelector] 📋 Total selected: ${selectedComponents.length} components`);

  return selectedComponents;
}
