#!/usr/bin/env npx tsx
/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Status Script
 *
 * CLI command to view rollout status:
 * npm run rollout:status
 * npm run rollout:status -- --detailed
 *
 * @module scripts/rollout/rollout-status
 */

const { Command } = require('commander');
require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { DEFAULT_STAGE_CONFIGS } from '../../lib/voice-agent/rollout/types';
import type { RolloutStage } from '../../lib/voice-agent/rollout/types';

const program = new Command();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface StatusOptions {
  detailed?: boolean;
  json?: boolean;
}

async function main() {
  program
    .option('--detailed', 'Show detailed metrics', false)
    .option('--json', 'Output as JSON', false)
    .parse();

  const options = program.opts() as StatusOptions;

  // Get feature flag
  const { data: flag, error: fetchError } = await supabase
    .from('platform_feature_flags')
    .select('*')
    .eq('name', 'voice_agent_v2')
    .single();

  if (fetchError) {
    if (options.json) {
      console.log(JSON.stringify({ error: fetchError.message }, null, 2));
    } else {
      console.error('❌ Error fetching status:', fetchError.message);
    }
    process.exit(1);
  }

  const percentage = flag?.percentage ?? 0;
  const enabled = flag?.enabled ?? false;
  const stage = percentageToStage(percentage);
  const enabledTenants = flag?.enabled_tenants ?? [];
  const disabledTenants = flag?.disabled_tenants ?? [];
  const stageStartedAt = flag?.stage_started_at;

  // Get tenant counts
  const { count: totalTenants } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true });

  // Get recent metrics
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: v2Calls } = await supabase
    .from('voice_calls')
    .select('id, status, latency_ms')
    .eq('api_version', 'v2')
    .gte('created_at', oneHourAgo);

  const { data: v1Calls } = await supabase
    .from('voice_calls')
    .select('id, status, latency_ms')
    .eq('api_version', 'v1')
    .gte('created_at', oneHourAgo);

  // Calculate metrics
  const v2Total = v2Calls?.length ?? 0;
  const v2Failed = v2Calls?.filter((c) => c.status === 'failed').length ?? 0;
  const v2ErrorRate = v2Total > 0 ? v2Failed / v2Total : 0;
  const v2Latencies = (v2Calls ?? [])
    .filter((c) => c.latency_ms != null)
    .map((c) => c.latency_ms as number)
    .sort((a, b) => a - b);
  const v2P95 = v2Latencies.length > 0
    ? v2Latencies[Math.floor(v2Latencies.length * 0.95)] ?? 0
    : 0;

  const v1Total = v1Calls?.length ?? 0;
  const v1Failed = v1Calls?.filter((c) => c.status === 'failed').length ?? 0;
  const v1ErrorRate = v1Total > 0 ? v1Failed / v1Total : 0;

  // Get recent history
  const { data: history } = await supabase
    .from('rollout_history')
    .select('*')
    .eq('feature_flag', 'voice_agent_v2')
    .order('created_at', { ascending: false })
    .limit(5);

  if (options.json) {
    console.log(JSON.stringify({
      status: {
        enabled,
        percentage,
        stage,
        stageStartedAt,
        enabledTenants: enabledTenants.length,
        disabledTenants: disabledTenants.length,
      },
      tenants: {
        total: totalTenants,
        onV2: Math.floor((totalTenants ?? 0) * (percentage / 100)) + enabledTenants.length,
      },
      metrics: {
        v2: { calls: v2Total, errorRate: v2ErrorRate, p95Latency: v2P95 },
        v1: { calls: v1Total, errorRate: v1ErrorRate },
      },
      history: history?.map((h) => ({
        action: h.action,
        from: h.from_percentage,
        to: h.to_percentage,
        timestamp: h.created_at,
        initiatedBy: h.initiated_by,
      })),
    }, null, 2));
    return;
  }

  // Console output
  console.log('='.repeat(60));
  console.log('VOICE AGENT V2 ROLLOUT STATUS');
  console.log('='.repeat(60));

  // Status indicator
  const statusIcon = enabled ? '🟢' : '🔴';
  console.log(`\n${statusIcon} Status: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`📊 Percentage: ${percentage}%`);
  console.log(`🎯 Stage: ${stage.toUpperCase()}`);

  if (stageStartedAt) {
    const stageStart = new Date(stageStartedAt);
    const duration = formatDuration(Date.now() - stageStart.getTime());
    console.log(`⏱  Stage Duration: ${duration}`);
  }

  // Stage config info
  const stageConfig = DEFAULT_STAGE_CONFIGS[stage];
  console.log(`\n📋 Stage Configuration:`);
  console.log(`   Min Duration: ${stageConfig.minDurationHours}h`);
  console.log(`   Go Criteria: error < ${(stageConfig.goCriteria.maxErrorRate * 100).toFixed(1)}%, p95 < ${stageConfig.goCriteria.maxP95LatencyMs}ms`);
  console.log(`   No-Go: error > ${(stageConfig.noGoCriteria.maxErrorRate * 100).toFixed(1)}%, p95 > ${stageConfig.noGoCriteria.maxP95LatencyMs}ms`);

  // Tenant info
  console.log(`\n👥 Tenants:`);
  console.log(`   Total: ${totalTenants ?? 'Unknown'}`);
  console.log(`   Explicitly Enabled: ${enabledTenants.length}`);
  console.log(`   Explicitly Disabled: ${disabledTenants.length}`);

  // Metrics
  console.log(`\n📈 Metrics (Last Hour):`);
  console.log(`   V2 Calls: ${v2Total} | Error Rate: ${(v2ErrorRate * 100).toFixed(2)}% | p95: ${v2P95}ms`);
  console.log(`   V1 Calls: ${v1Total} | Error Rate: ${(v1ErrorRate * 100).toFixed(2)}%`);

  // Health assessment
  const isHealthy = v2ErrorRate <= stageConfig.goCriteria.maxErrorRate &&
                   v2P95 <= stageConfig.goCriteria.maxP95LatencyMs;
  const isCritical = v2ErrorRate > stageConfig.noGoCriteria.maxErrorRate ||
                    v2P95 > stageConfig.noGoCriteria.maxP95LatencyMs;

  console.log(`\n🏥 Health: ${isCritical ? '🔴 CRITICAL' : isHealthy ? '🟢 HEALTHY' : '🟡 WARNING'}`);

  if (options.detailed && history && history.length > 0) {
    console.log(`\n📜 Recent History:`);
    for (const entry of history) {
      const time = new Date(entry.created_at).toLocaleString();
      console.log(`   [${time}] ${entry.action}: ${entry.from_percentage}% → ${entry.to_percentage}%`);
      if (entry.reason) {
        console.log(`      Reason: ${entry.reason}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));

  // Quick commands
  console.log('Quick Commands:');
  if (percentage < 100) {
    const nextStage = getNextStage(stage);
    if (nextStage) {
      console.log(`  Advance: npm run rollout:set -- --stage=${nextStage}`);
    }
  }
  console.log(`  Rollback: npm run rollout:set -- --percentage=0`);
  console.log(`  Enable Tenant: npm run rollout:tenant -- --tenant-id=XXX --action=enable`);
}

function percentageToStage(percentage: number): RolloutStage {
  if (percentage >= 100) return 'complete';
  if (percentage >= 50) return 'majority';
  if (percentage >= 25) return 'expansion';
  if (percentage >= 10) return 'early_adopters';
  if (percentage > 0) return 'canary';
  return 'disabled';
}

function getNextStage(current: RolloutStage): RolloutStage | null {
  const order: RolloutStage[] = ['disabled', 'canary', 'early_adopters', 'expansion', 'majority', 'complete'];
  const idx = order.indexOf(current);
  if (idx === -1 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
