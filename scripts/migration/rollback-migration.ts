/**
 * TIS TIS Platform - Voice Agent v2.0
 * Migration Rollback Script
 *
 * This script provides rollback capabilities for the Voice Agent v2 migration.
 * Supports multiple rollback levels: tenant, partial, total, and data.
 *
 * Usage:
 *   npx ts-node scripts/migration/rollback-migration.ts --level <level> [options]
 *
 * Levels:
 *   tenant   - Rollback specific tenant to v1
 *   partial  - Reduce rollout percentage
 *   total    - Rollback all tenants to v1
 *   data     - Restore data from backup
 *
 * Options:
 *   --level <level>       Rollback level (required)
 *   --tenant-id <id>      Tenant ID (for level=tenant)
 *   --percentage <n>      New percentage (for level=partial)
 *   --backup-id <id>      Backup ID (for level=data)
 *   --force               Skip confirmation prompts
 *   --dry-run             Show what would be done without making changes
 *
 * @module scripts/migration/rollback-migration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// =====================================================
// TYPES
// =====================================================

type RollbackLevel = 'tenant' | 'partial' | 'total' | 'data';

interface RollbackOptions {
  level: RollbackLevel;
  tenantId?: string;
  percentage?: number;
  backupId?: string;
  force: boolean;
  dryRun: boolean;
}

interface RollbackResult {
  success: boolean;
  level: RollbackLevel;
  action: string;
  affectedRecords: number;
  duration: number;
  details: Record<string, unknown>;
}

interface BackupInfo {
  id: string;
  tables: string[];
  created_at: string;
  record_count: number;
  status: string;
}

// =====================================================
// ROLLBACK CLASS
// =====================================================

class MigrationRollback {
  private supabase: SupabaseClient;
  private options: RollbackOptions;

  constructor(supabaseUrl: string, supabaseKey: string, options: RollbackOptions) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.options = options;
  }

  /**
   * Execute rollback based on level
   */
  async execute(): Promise<RollbackResult> {
    const startTime = Date.now();

    console.log('='.repeat(70));
    console.log('VOICE AGENT v2.0 ROLLBACK');
    console.log('='.repeat(70));
    console.log(`Level: ${this.options.level.toUpperCase()}`);
    console.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('='.repeat(70));

    let result: RollbackResult;

    switch (this.options.level) {
      case 'tenant':
        result = await this.rollbackTenant();
        break;
      case 'partial':
        result = await this.rollbackPartial();
        break;
      case 'total':
        result = await this.rollbackTotal();
        break;
      case 'data':
        result = await this.rollbackData();
        break;
      default:
        throw new Error(`Invalid rollback level: ${this.options.level}`);
    }

    result.duration = Date.now() - startTime;

    this.printResults(result);

    // Log rollback action
    if (!this.options.dryRun) {
      await this.logRollback(result);
    }

    return result;
  }

  /**
   * Level 1: Rollback specific tenant to v1
   */
  private async rollbackTenant(): Promise<RollbackResult> {
    const tenantId = this.options.tenantId;

    if (!tenantId) {
      throw new Error('--tenant-id required for tenant rollback');
    }

    console.log(`\nRolling back tenant: ${tenantId}`);

    // Verify tenant exists
    const { data: config } = await this.supabase
      .from('voice_assistant_configs')
      .select('id, business_id')
      .eq('business_id', tenantId)
      .single();

    if (!config) {
      throw new Error(`No configuration found for tenant: ${tenantId}`);
    }

    if (this.options.dryRun) {
      console.log('  [DRY RUN] Would add tenant to disabled list');
      return {
        success: true,
        level: 'tenant',
        action: 'disable_tenant',
        affectedRecords: 1,
        duration: 0,
        details: { tenantId },
      };
    }

    // Add to disabled tenants list in feature flags
    const { data: flags } = await this.supabase
      .from('feature_flags')
      .select('disabled_tenants')
      .eq('name', 'voice_agent_v2')
      .single();

    const disabledTenants = flags?.disabled_tenants || [];

    if (!disabledTenants.includes(tenantId)) {
      const { error } = await this.supabase
        .from('feature_flags')
        .update({
          disabled_tenants: [...disabledTenants, tenantId],
          updated_at: new Date().toISOString(),
        })
        .eq('name', 'voice_agent_v2');

      if (error) {
        throw new Error(`Failed to disable tenant: ${error.message}`);
      }
    }

    console.log(`  ✓ Tenant ${tenantId} added to disabled list`);

    return {
      success: true,
      level: 'tenant',
      action: 'disable_tenant',
      affectedRecords: 1,
      duration: 0,
      details: { tenantId },
    };
  }

  /**
   * Level 2: Reduce rollout percentage
   */
  private async rollbackPartial(): Promise<RollbackResult> {
    const percentage = this.options.percentage;

    if (percentage === undefined || percentage < 0 || percentage > 100) {
      throw new Error('--percentage (0-100) required for partial rollback');
    }

    // Get current percentage
    const { data: flags } = await this.supabase
      .from('feature_flags')
      .select('percentage')
      .eq('name', 'voice_agent_v2')
      .single();

    const currentPercentage = flags?.percentage || 0;

    console.log(`\nReducing rollout from ${currentPercentage}% to ${percentage}%`);

    if (percentage >= currentPercentage) {
      console.log('  ⚠ Warning: New percentage is not lower than current');
    }

    if (this.options.dryRun) {
      console.log(`  [DRY RUN] Would update percentage to ${percentage}%`);
      return {
        success: true,
        level: 'partial',
        action: 'reduce_percentage',
        affectedRecords: 0,
        duration: 0,
        details: { oldPercentage: currentPercentage, newPercentage: percentage },
      };
    }

    const { error } = await this.supabase
      .from('feature_flags')
      .update({
        percentage,
        updated_at: new Date().toISOString(),
      })
      .eq('name', 'voice_agent_v2');

    if (error) {
      throw new Error(`Failed to update percentage: ${error.message}`);
    }

    // Estimate affected tenants
    const { count: totalTenants } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true });

    const affectedCount = Math.floor(
      ((totalTenants || 0) * (currentPercentage - percentage)) / 100
    );

    console.log(`  ✓ Rollout reduced to ${percentage}%`);
    console.log(`  ✓ Approximately ${affectedCount} tenants moved to v1`);

    return {
      success: true,
      level: 'partial',
      action: 'reduce_percentage',
      affectedRecords: affectedCount,
      duration: 0,
      details: { oldPercentage: currentPercentage, newPercentage: percentage },
    };
  }

  /**
   * Level 3: Total rollback - all tenants to v1
   */
  private async rollbackTotal(): Promise<RollbackResult> {
    console.log('\n⚠ TOTAL ROLLBACK - All tenants will be moved to V1');

    // Confirmation unless forced
    if (!this.options.force && !this.options.dryRun) {
      const confirmed = await this.confirm(
        'This will rollback ALL tenants to V1. Type "CONFIRM" to proceed: '
      );
      if (!confirmed) {
        console.log('Rollback cancelled');
        return {
          success: false,
          level: 'total',
          action: 'cancelled',
          affectedRecords: 0,
          duration: 0,
          details: {},
        };
      }
    }

    if (this.options.dryRun) {
      console.log('  [DRY RUN] Would disable v2 and set percentage to 0');
      return {
        success: true,
        level: 'total',
        action: 'disable_v2',
        affectedRecords: 0,
        duration: 0,
        details: {},
      };
    }

    // Get current state for logging
    const { data: flags } = await this.supabase
      .from('feature_flags')
      .select('*')
      .eq('name', 'voice_agent_v2')
      .single();

    // Update feature flags
    const { error } = await this.supabase
      .from('feature_flags')
      .update({
        enabled: false,
        percentage: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('name', 'voice_agent_v2');

    if (error) {
      throw new Error(`Failed to disable v2: ${error.message}`);
    }

    const { count: totalTenants } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true });

    console.log('  ✓ Voice Agent V2 DISABLED');
    console.log(`  ✓ All ${totalTenants} tenants now on V1`);

    return {
      success: true,
      level: 'total',
      action: 'disable_v2',
      affectedRecords: totalTenants || 0,
      duration: 0,
      details: {
        previousState: flags,
      },
    };
  }

  /**
   * Level 4: Restore data from backup
   */
  private async rollbackData(): Promise<RollbackResult> {
    let backupId = this.options.backupId;

    // List available backups if no ID provided
    if (!backupId) {
      const backups = await this.listBackups();

      if (backups.length === 0) {
        throw new Error('No backups available');
      }

      console.log('\nAvailable backups:');
      backups.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.id}`);
        console.log(`     Created: ${b.created_at}`);
        console.log(`     Tables: ${b.tables.join(', ')}`);
        console.log(`     Records: ${b.record_count}`);
      });

      throw new Error('--backup-id required. Choose from available backups above.');
    }

    // Verify backup exists
    const { data: backup } = await this.supabase
      .from('migration_backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    console.log(`\n⚠ DATA ROLLBACK from backup: ${backupId}`);
    console.log(`  Created: ${backup.created_at}`);
    console.log(`  Tables: ${backup.tables?.join(', ')}`);
    console.log('\n  WARNING: This will OVERWRITE current data!');

    // Confirmation
    if (!this.options.force && !this.options.dryRun) {
      const confirmed = await this.confirm(
        'This will overwrite current data. Type "CONFIRM" to proceed: '
      );
      if (!confirmed) {
        console.log('Rollback cancelled');
        return {
          success: false,
          level: 'data',
          action: 'cancelled',
          affectedRecords: 0,
          duration: 0,
          details: { backupId },
        };
      }
    }

    if (this.options.dryRun) {
      console.log('  [DRY RUN] Would restore data from backup');
      return {
        success: true,
        level: 'data',
        action: 'restore_backup',
        affectedRecords: backup.record_count || 0,
        duration: 0,
        details: { backupId, backup },
      };
    }

    // Execute restore
    console.log('\n  Restoring data...');

    // Clear new tables
    const { error: truncateError } = await this.supabase
      .from('voice_assistant_configs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (truncateError) {
      console.log(`  ⚠ Warning: Could not clear v2 table: ${truncateError.message}`);
    }

    // Restore via RPC if available
    const { error: restoreError } = await this.supabase.rpc('restore_from_backup', {
      backup_id: backupId,
    });

    if (restoreError) {
      // Fallback: mark as needing manual restore
      console.log(`  ⚠ Auto-restore failed: ${restoreError.message}`);
      console.log('  Manual restore may be required.');

      return {
        success: false,
        level: 'data',
        action: 'restore_failed',
        affectedRecords: 0,
        duration: 0,
        details: { backupId, error: restoreError.message },
      };
    }

    // Update backup status
    await this.supabase
      .from('migration_backups')
      .update({
        restored_at: new Date().toISOString(),
        status: 'restored',
      })
      .eq('id', backupId);

    console.log('  ✓ Data restored from backup');

    return {
      success: true,
      level: 'data',
      action: 'restore_backup',
      affectedRecords: backup.record_count || 0,
      duration: 0,
      details: { backupId },
    };
  }

  /**
   * List available backups
   */
  private async listBackups(): Promise<BackupInfo[]> {
    const { data: backups } = await this.supabase
      .from('migration_backups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return (backups || []).map((b) => ({
      id: b.id,
      tables: b.tables || [],
      created_at: b.created_at,
      record_count: b.record_count || 0,
      status: b.status || 'unknown',
    }));
  }

  /**
   * Log rollback action for audit
   */
  private async logRollback(result: RollbackResult): Promise<void> {
    try {
      await this.supabase.from('migration_rollbacks').insert({
        level: result.level,
        action: result.action,
        affected_records: result.affectedRecords,
        success: result.success,
        details: result.details,
        executed_at: new Date().toISOString(),
        executed_by: process.env.USER || 'system',
      });
    } catch (error) {
      console.log('  ⚠ Could not log rollback action');
    }
  }

  /**
   * Print results
   */
  private printResults(result: RollbackResult): void {
    console.log('\n' + '='.repeat(70));
    console.log('ROLLBACK RESULTS');
    console.log('='.repeat(70));
    console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    console.log(`Level: ${result.level}`);
    console.log(`Action: ${result.action}`);
    console.log(`Affected Records: ${result.affectedRecords}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(70));
  }

  /**
   * Confirmation prompt
   */
  private async confirm(prompt: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.toUpperCase() === 'CONFIRM');
      });
    });
  }
}

// =====================================================
// CLI ENTRY POINT
// =====================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse level
  const levelIndex = args.findIndex((a) => a === '--level');
  const level = levelIndex >= 0 ? args[levelIndex + 1] : undefined;

  if (!level || !['tenant', 'partial', 'total', 'data'].includes(level)) {
    console.log('Usage: npx ts-node scripts/migration/rollback-migration.ts --level <level> [options]');
    console.log('');
    console.log('Levels:');
    console.log('  tenant   Rollback specific tenant (requires --tenant-id)');
    console.log('  partial  Reduce rollout percentage (requires --percentage)');
    console.log('  total    Rollback all tenants to v1');
    console.log('  data     Restore from backup (requires --backup-id)');
    console.log('');
    console.log('Options:');
    console.log('  --tenant-id <id>    Tenant ID for level=tenant');
    console.log('  --percentage <n>    New percentage for level=partial');
    console.log('  --backup-id <id>    Backup ID for level=data');
    console.log('  --force             Skip confirmation prompts');
    console.log('  --dry-run           Show what would be done');
    process.exit(1);
  }

  // Parse percentage safely (undefined if not provided)
  const percentageStr = args.find((a) => a.startsWith('--percentage='))?.split('=')[1];
  const percentage = percentageStr ? parseInt(percentageStr, 10) : undefined;

  const options: RollbackOptions = {
    level: level as RollbackLevel,
    tenantId: args.find((a) => a.startsWith('--tenant-id='))?.split('=')[1],
    percentage: percentage !== undefined && !isNaN(percentage) ? percentage : undefined,
    backupId: args.find((a) => a.startsWith('--backup-id='))?.split('=')[1],
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
  };

  // Support both environment variable naming conventions
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const rollback = new MigrationRollback(supabaseUrl, supabaseKey, options);
  const result = await rollback.execute();

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { MigrationRollback };
export type { RollbackOptions, RollbackResult };
