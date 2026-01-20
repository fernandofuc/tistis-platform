#!/usr/bin/env npx tsx
/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Tenant Script
 *
 * CLI command to manage tenant-level rollout:
 * npm run rollout:tenant -- --tenant-id=XXX --action=enable
 * npm run rollout:tenant -- --tenant-id=XXX --action=disable
 *
 * @module scripts/rollout/rollout-tenant
 */

const { Command } = require('commander');
require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const program = new Command();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TenantOptions {
  tenantId: string;
  action: 'enable' | 'disable';
  initiatedBy?: string;
  reason?: string;
}

async function main() {
  program
    .requiredOption('--tenant-id <id>', 'Tenant/Business ID')
    .requiredOption('--action <action>', 'Action: enable or disable')
    .option('--initiated-by <email>', 'Email of person initiating', 'cli-script')
    .option('--reason <reason>', 'Reason for change', 'Manual tenant update')
    .parse();

  const options = program.opts() as TenantOptions;

  if (!['enable', 'disable'].includes(options.action)) {
    console.error('❌ Error: Action must be "enable" or "disable"');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`VOICE AGENT V2 - ${options.action.toUpperCase()} TENANT`);
  console.log('='.repeat(60));
  console.log(`\nTenant ID: ${options.tenantId}`);
  console.log(`Action: ${options.action}`);

  // Verify tenant exists
  const { data: tenant, error: tenantError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', options.tenantId)
    .single();

  if (tenantError || !tenant) {
    console.error(`\n❌ Error: Tenant "${options.tenantId}" not found`);
    process.exit(1);
  }

  console.log(`Tenant Name: ${tenant.name}`);

  // Get current flag status
  const { data: flag, error: fetchError } = await supabase
    .from('platform_feature_flags')
    .select('enabled_tenants, disabled_tenants')
    .eq('name', 'voice_agent_v2')
    .single();

  if (fetchError) {
    console.error('❌ Error fetching feature flag:', fetchError.message);
    process.exit(1);
  }

  let enabledTenants: string[] = flag?.enabled_tenants ?? [];
  let disabledTenants: string[] = flag?.disabled_tenants ?? [];

  // Check current status
  const currentlyEnabled = enabledTenants.includes(options.tenantId);
  const currentlyDisabled = disabledTenants.includes(options.tenantId);

  console.log(`\nCurrent Status:`);
  console.log(`  Explicitly Enabled: ${currentlyEnabled ? 'Yes' : 'No'}`);
  console.log(`  Explicitly Disabled: ${currentlyDisabled ? 'Yes' : 'No'}`);

  if (options.action === 'enable') {
    if (currentlyEnabled) {
      console.log('\n✓ Tenant is already explicitly enabled');
      process.exit(0);
    }

    // Remove from disabled, add to enabled
    disabledTenants = disabledTenants.filter((t) => t !== options.tenantId);
    if (!enabledTenants.includes(options.tenantId)) {
      enabledTenants.push(options.tenantId);
    }
  } else {
    if (currentlyDisabled) {
      console.log('\n✓ Tenant is already explicitly disabled');
      process.exit(0);
    }

    // Remove from enabled, add to disabled
    enabledTenants = enabledTenants.filter((t) => t !== options.tenantId);
    if (!disabledTenants.includes(options.tenantId)) {
      disabledTenants.push(options.tenantId);
    }
  }

  // Update the flag
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('platform_feature_flags')
    .update({
      enabled_tenants: enabledTenants,
      disabled_tenants: disabledTenants,
      updated_at: now,
    })
    .eq('name', 'voice_agent_v2');

  if (updateError) {
    console.error('❌ Error updating tenant status:', updateError.message);
    process.exit(1);
  }

  // Log history
  await supabase.from('rollout_history').insert({
    feature_flag: 'voice_agent_v2',
    action: options.action === 'enable' ? 'enable_tenant' : 'rollback_tenant',
    from_stage: 'n/a',
    to_stage: 'n/a',
    from_percentage: 0,
    to_percentage: 0,
    initiated_by: options.initiatedBy,
    reason: `Tenant ${options.tenantId} (${tenant.name}) ${options.action}d: ${options.reason}`,
  });

  console.log(`\n✓ Tenant ${options.action}d successfully!`);
  console.log(`  Tenant: ${tenant.name} (${options.tenantId})`);
  console.log(`  V2 Status: ${options.action === 'enable' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Initiated by: ${options.initiatedBy}`);
  console.log(`  Reason: ${options.reason}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
