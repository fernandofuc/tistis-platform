#!/usr/bin/env npx tsx
/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Set Script
 *
 * CLI command to set rollout percentage:
 * npm run rollout:set -- --percentage=25
 * npm run rollout:set -- --stage=expansion
 *
 * @module scripts/rollout/rollout-set
 */

const { Command } = require('commander');
require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { DEFAULT_STAGE_CONFIGS, STAGE_PROGRESSION } from '../../lib/voice-agent/rollout/types';
import type { RolloutStage } from '../../lib/voice-agent/rollout/types';

const program = new Command();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SetOptions {
  percentage?: string;
  stage?: RolloutStage;
  initiatedBy?: string;
  reason?: string;
  force?: boolean;
}

async function main() {
  program
    .option('--percentage <number>', 'Target rollout percentage (0-100)')
    .option('--stage <stage>', `Target stage: ${STAGE_PROGRESSION.join(', ')}`)
    .option('--initiated-by <email>', 'Email of person initiating', 'cli-script')
    .option('--reason <reason>', 'Reason for change', 'Manual rollout update')
    .option('--force', 'Skip health check validation', false)
    .parse();

  const options = program.opts() as SetOptions;

  // Validate inputs
  if (!options.percentage && !options.stage) {
    console.error('❌ Error: Either --percentage or --stage is required');
    console.log('\nUsage:');
    console.log('  npm run rollout:set -- --percentage=25');
    console.log('  npm run rollout:set -- --stage=expansion');
    process.exit(1);
  }

  // Determine target percentage
  let targetPercentage: number;

  if (options.stage) {
    if (!STAGE_PROGRESSION.includes(options.stage)) {
      console.error(`❌ Error: Invalid stage "${options.stage}"`);
      console.log(`Valid stages: ${STAGE_PROGRESSION.join(', ')}`);
      process.exit(1);
    }
    const stageConfig = DEFAULT_STAGE_CONFIGS[options.stage as RolloutStage];
    targetPercentage = stageConfig.percentage;
  } else {
    targetPercentage = parseInt(options.percentage!, 10);
    if (isNaN(targetPercentage) || targetPercentage < 0 || targetPercentage > 100) {
      console.error('❌ Error: Percentage must be between 0 and 100');
      process.exit(1);
    }
  }

  console.log('='.repeat(60));
  console.log('VOICE AGENT V2 ROLLOUT - SET PERCENTAGE');
  console.log('='.repeat(60));

  // Get current status
  const { data: current, error: fetchError } = await supabase
    .from('platform_feature_flags')
    .select('*')
    .eq('name', 'voice_agent_v2')
    .single();

  if (fetchError) {
    console.error('❌ Error fetching current status:', fetchError.message);
    process.exit(1);
  }

  const currentPercentage = current?.percentage ?? 0;
  console.log(`\nCurrent: ${currentPercentage}%`);
  console.log(`Target:  ${targetPercentage}%`);

  if (currentPercentage === targetPercentage) {
    console.log('\n✓ Already at target percentage');
    process.exit(0);
  }

  // Warn if advancing significantly
  if (targetPercentage > currentPercentage && targetPercentage - currentPercentage > 25 && !options.force) {
    console.log('\n⚠ Warning: Large percentage increase detected');
    console.log('  Use --force to skip this warning');

    if (process.stdin.isTTY) {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const answer = await new Promise<string>((resolve) => {
        rl.question('Continue? (yes/no): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('Cancelled');
        process.exit(0);
      }
    }
  }

  // Update the flag
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('platform_feature_flags')
    .update({
      percentage: targetPercentage,
      enabled: targetPercentage > 0,
      stage_started_at: now,
      stage_initiated_by: options.initiatedBy,
      updated_at: now,
    })
    .eq('name', 'voice_agent_v2');

  if (updateError) {
    console.error('❌ Error updating rollout:', updateError.message);
    process.exit(1);
  }

  // Log history
  await supabase.from('rollout_history').insert({
    feature_flag: 'voice_agent_v2',
    action: targetPercentage > currentPercentage ? 'advance' : 'rollback_partial',
    from_stage: percentageToStage(currentPercentage),
    to_stage: percentageToStage(targetPercentage),
    from_percentage: currentPercentage,
    to_percentage: targetPercentage,
    initiated_by: options.initiatedBy,
    reason: options.reason,
  });

  console.log('\n✓ Rollout updated successfully!');
  console.log(`  From: ${currentPercentage}% → To: ${targetPercentage}%`);
  console.log(`  Initiated by: ${options.initiatedBy}`);
  console.log(`  Reason: ${options.reason}`);
  console.log('='.repeat(60));
}

function percentageToStage(percentage: number): RolloutStage {
  if (percentage >= 100) return 'complete';
  if (percentage >= 50) return 'majority';
  if (percentage >= 25) return 'expansion';
  if (percentage >= 10) return 'early_adopters';
  if (percentage > 0) return 'canary';
  return 'disabled';
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
