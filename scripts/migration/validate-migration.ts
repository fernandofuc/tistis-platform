/**
 * TIS TIS Platform - Voice Agent v2.0
 * Migration Validation Script
 *
 * @deprecated Este script está OBSOLETO. TIS TIS ahora usa únicamente
 * la arquitectura v2 (voice_assistant_configs). La validación de migración
 * v1 → v2 ya no es necesaria.
 *
 * Este script se mantiene solo para referencia histórica.
 * NO debe ejecutarse en nuevas instalaciones.
 *
 * ---
 *
 * [HISTÓRICO] Este script validaba la integridad de datos migrados
 * y aseguraba consistencia entre esquemas v1 y v2.
 *
 * Usage (OBSOLETO):
 *   npx ts-node scripts/migration/validate-migration.ts [options]
 *
 * Options:
 *   --detailed        Show detailed validation results
 *   --fix             Attempt to fix minor issues
 *   --report-file     Output report to file
 *
 * @module scripts/migration/validate-migration
 * @deprecated Desde Enero 2025 - Arquitectura simplificada a v2-only
 */

console.warn('\n⚠️  ADVERTENCIA: Este script está OBSOLETO.');
console.warn('    TIS TIS ahora usa únicamente la arquitectura v2 (voice_assistant_configs).');
console.warn('    La validación de migración v1 → v2 ya no es necesaria.\n');
console.warn('    Para validar la integridad de datos v2, usa las herramientas estándar de Supabase.\n');

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

interface ValidationOptions {
  detailed: boolean;
  fix: boolean;
  reportFile?: string;
}

interface ValidationReport {
  timestamp: string;
  success: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: ValidationCheck[];
  summary: ValidationSummary;
  recommendations: string[];
}

interface ValidationCheck {
  name: string;
  category: 'count' | 'integrity' | 'consistency' | 'performance';
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: Record<string, unknown>;
  fixable?: boolean;
  fixed?: boolean;
}

interface ValidationSummary {
  v1Records: number;
  v2Records: number;
  matchRate: number;
  orphanedRecords: number;
  nullRequiredFields: number;
  duplicateIds: number;
  invalidTypes: number;
}

// =====================================================
// VALIDATION CHECKS
// =====================================================

const REQUIRED_FIELDS_V2 = [
  'id',
  'business_id',
  'assistant_type_id',
  'voice_id',
  'is_active',
];

const VALID_ASSISTANT_TYPES = [
  'rest_basic',
  'rest_standard',
  'rest_complete',
  'dental_basic',
  'dental_standard',
  'dental_complete',
];

const VALID_PERSONALITIES = ['friendly', 'professional', 'energetic', 'calm'];

// =====================================================
// VALIDATION CLASS
// =====================================================

class MigrationValidator {
  private supabase: SupabaseClient;
  private options: ValidationOptions;
  private checks: ValidationCheck[] = [];

  constructor(supabaseUrl: string, supabaseKey: string, options: ValidationOptions) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.options = options;
  }

  /**
   * Execute all validation checks
   */
  async validate(): Promise<ValidationReport> {
    console.log('='.repeat(70));
    console.log('VOICE AGENT v2.0 MIGRATION VALIDATION');
    console.log('='.repeat(70));
    console.log(`Mode: ${this.options.fix ? 'FIX' : 'CHECK ONLY'}`);
    console.log(`Detailed: ${this.options.detailed}`);
    console.log('='.repeat(70));

    // Run all checks
    console.log('\n[1/7] Checking record counts...');
    await this.checkRecordCounts();

    console.log('[2/7] Checking data integrity...');
    await this.checkDataIntegrity();

    console.log('[3/7] Checking foreign key relationships...');
    await this.checkForeignKeys();

    console.log('[4/7] Checking required fields...');
    await this.checkRequiredFields();

    console.log('[5/7] Checking value constraints...');
    await this.checkValueConstraints();

    console.log('[6/7] Checking for duplicates...');
    await this.checkDuplicates();

    console.log('[7/7] Checking migration metadata...');
    await this.checkMigrationMetadata();

    // Generate report
    const report = await this.generateReport();

    // Print results
    this.printResults(report);

    // Save report if requested
    if (this.options.reportFile) {
      await this.saveReport(report);
    }

    return report;
  }

  /**
   * Check that record counts match between v1 and v2
   */
  private async checkRecordCounts(): Promise<void> {
    const { count: v1Count } = await this.supabase
      .from('voice_agent_config')
      .select('*', { count: 'exact', head: true });

    const { count: v2Count } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true });

    const match = v1Count === v2Count;

    this.checks.push({
      name: 'Record Count Match',
      category: 'count',
      status: match ? 'pass' : 'fail',
      message: match
        ? `Record counts match: ${v1Count}`
        : `Record count mismatch: v1=${v1Count}, v2=${v2Count}`,
      details: { v1Count, v2Count },
    });

    if (this.options.detailed) {
      console.log(`  v1 records: ${v1Count}`);
      console.log(`  v2 records: ${v2Count}`);
    }
  }

  /**
   * Check data integrity (no corruption)
   */
  private async checkDataIntegrity(): Promise<void> {
    // Check for empty IDs
    const { count: emptyIdCount } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true })
      .eq('id', '');

    this.checks.push({
      name: 'Empty IDs Check',
      category: 'integrity',
      status: emptyIdCount === 0 ? 'pass' : 'fail',
      message:
        emptyIdCount === 0
          ? 'No empty IDs found'
          : `Found ${emptyIdCount} records with empty IDs`,
      details: { emptyIdCount },
    });

    // Check for invalid JSON in capabilities
    const { data: configs } = await this.supabase
      .from('voice_assistant_configs')
      .select('id, enabled_capabilities');

    let invalidJsonCount = 0;
    const invalidIds: string[] = [];

    for (const config of configs || []) {
      if (config.enabled_capabilities) {
        try {
          // enabled_capabilities should be an array
          if (!Array.isArray(config.enabled_capabilities)) {
            invalidJsonCount++;
            invalidIds.push(config.id);
          }
        } catch {
          invalidJsonCount++;
          invalidIds.push(config.id);
        }
      }
    }

    this.checks.push({
      name: 'Capabilities JSON Validation',
      category: 'integrity',
      status: invalidJsonCount === 0 ? 'pass' : 'fail',
      message:
        invalidJsonCount === 0
          ? 'All capabilities are valid arrays'
          : `Found ${invalidJsonCount} records with invalid capabilities`,
      details: { invalidJsonCount, invalidIds: invalidIds.slice(0, 5) },
      fixable: invalidJsonCount > 0,
    });

    // Fix if requested
    if (this.options.fix && invalidJsonCount > 0) {
      for (const id of invalidIds) {
        await this.supabase
          .from('voice_assistant_configs')
          .update({ enabled_capabilities: ['basic'] })
          .eq('id', id);
      }
      this.checks[this.checks.length - 1].fixed = true;
    }
  }

  /**
   * Check foreign key relationships
   */
  private async checkForeignKeys(): Promise<void> {
    // Check business_id references
    const { data: v2Configs } = await this.supabase
      .from('voice_assistant_configs')
      .select('id, business_id');

    const { data: businesses } = await this.supabase
      .from('businesses')
      .select('id');

    const businessIds = new Set(businesses?.map((b) => b.id) || []);
    const orphanedConfigs: string[] = [];

    for (const config of v2Configs || []) {
      if (!businessIds.has(config.business_id)) {
        orphanedConfigs.push(config.id);
      }
    }

    this.checks.push({
      name: 'Business FK Integrity',
      category: 'integrity',
      status: orphanedConfigs.length === 0 ? 'pass' : 'warn',
      message:
        orphanedConfigs.length === 0
          ? 'All business references are valid'
          : `Found ${orphanedConfigs.length} configs with invalid business_id`,
      details: { orphanedCount: orphanedConfigs.length, orphanedIds: orphanedConfigs.slice(0, 5) },
    });

    if (this.options.detailed && orphanedConfigs.length > 0) {
      console.log(`  Orphaned configs: ${orphanedConfigs.slice(0, 5).join(', ')}`);
    }
  }

  /**
   * Check required fields are populated
   */
  private async checkRequiredFields(): Promise<void> {
    for (const field of REQUIRED_FIELDS_V2) {
      const { count } = await this.supabase
        .from('voice_assistant_configs')
        .select('*', { count: 'exact', head: true })
        .is(field, null);

      this.checks.push({
        name: `Required Field: ${field}`,
        category: 'integrity',
        status: count === 0 ? 'pass' : 'fail',
        message:
          count === 0
            ? `All records have ${field}`
            : `Found ${count} records with null ${field}`,
        details: { field, nullCount: count },
        fixable: field === 'voice_id' || field === 'assistant_type_id',
      });

      // Fix if requested
      if (this.options.fix && count && count > 0) {
        if (field === 'voice_id') {
          await this.supabase
            .from('voice_assistant_configs')
            .update({ voice_id: 'coral' })
            .is('voice_id', null);
          this.checks[this.checks.length - 1].fixed = true;
        }
        if (field === 'assistant_type_id') {
          await this.supabase
            .from('voice_assistant_configs')
            .update({ assistant_type_id: 'rest_basic' })
            .is('assistant_type_id', null);
          this.checks[this.checks.length - 1].fixed = true;
        }
      }
    }
  }

  /**
   * Check value constraints
   */
  private async checkValueConstraints(): Promise<void> {
    // Check assistant_type_id values
    const { data: configs } = await this.supabase
      .from('voice_assistant_configs')
      .select('id, assistant_type_id');

    const invalidTypes: string[] = [];

    for (const config of configs || []) {
      if (!VALID_ASSISTANT_TYPES.includes(config.assistant_type_id)) {
        invalidTypes.push(config.id);
      }
    }

    this.checks.push({
      name: 'Valid Assistant Types',
      category: 'consistency',
      status: invalidTypes.length === 0 ? 'pass' : 'warn',
      message:
        invalidTypes.length === 0
          ? 'All assistant types are valid'
          : `Found ${invalidTypes.length} records with invalid assistant_type_id`,
      details: {
        invalidCount: invalidTypes.length,
        invalidIds: invalidTypes.slice(0, 5),
        validTypes: VALID_ASSISTANT_TYPES,
      },
    });

    // Check personality_type values
    const { data: personalities } = await this.supabase
      .from('voice_assistant_configs')
      .select('id, personality_type');

    const invalidPersonalities: string[] = [];

    for (const config of personalities || []) {
      if (config.personality_type && !VALID_PERSONALITIES.includes(config.personality_type)) {
        invalidPersonalities.push(config.id);
      }
    }

    this.checks.push({
      name: 'Valid Personality Types',
      category: 'consistency',
      status: invalidPersonalities.length === 0 ? 'pass' : 'warn',
      message:
        invalidPersonalities.length === 0
          ? 'All personality types are valid'
          : `Found ${invalidPersonalities.length} records with invalid personality_type`,
      details: {
        invalidCount: invalidPersonalities.length,
        validTypes: VALID_PERSONALITIES,
      },
    });

    // Check voice_speed range
    const { count: invalidSpeedCount } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true })
      .or('voice_speed.lt.0.5,voice_speed.gt.2.0');

    this.checks.push({
      name: 'Voice Speed Range',
      category: 'consistency',
      status: invalidSpeedCount === 0 ? 'pass' : 'warn',
      message:
        invalidSpeedCount === 0
          ? 'All voice speeds are within valid range (0.5-2.0)'
          : `Found ${invalidSpeedCount} records with voice_speed outside valid range`,
      details: { invalidCount: invalidSpeedCount, validRange: [0.5, 2.0] },
    });
  }

  /**
   * Check for duplicate records
   */
  private async checkDuplicates(): Promise<void> {
    // Check for duplicate IDs
    const { data: allIds } = await this.supabase
      .from('voice_assistant_configs')
      .select('id');

    const idCounts = new Map<string, number>();
    for (const record of allIds || []) {
      idCounts.set(record.id, (idCounts.get(record.id) || 0) + 1);
    }

    const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1);

    this.checks.push({
      name: 'Duplicate IDs',
      category: 'integrity',
      status: duplicateIds.length === 0 ? 'pass' : 'fail',
      message:
        duplicateIds.length === 0
          ? 'No duplicate IDs found'
          : `Found ${duplicateIds.length} duplicate IDs`,
      details: {
        duplicateCount: duplicateIds.length,
        duplicates: duplicateIds.slice(0, 5).map(([id, count]) => ({ id, count })),
      },
    });

    // Check for duplicate business_id (should be 1:1)
    const { data: businessIds } = await this.supabase
      .from('voice_assistant_configs')
      .select('business_id');

    const businessCounts = new Map<string, number>();
    for (const record of businessIds || []) {
      businessCounts.set(record.business_id, (businessCounts.get(record.business_id) || 0) + 1);
    }

    const duplicateBusinesses = [...businessCounts.entries()].filter(([, count]) => count > 1);

    this.checks.push({
      name: 'Duplicate Business Configs',
      category: 'consistency',
      status: duplicateBusinesses.length === 0 ? 'pass' : 'warn',
      message:
        duplicateBusinesses.length === 0
          ? 'Each business has exactly one config'
          : `Found ${duplicateBusinesses.length} businesses with multiple configs`,
      details: {
        duplicateCount: duplicateBusinesses.length,
        duplicates: duplicateBusinesses.slice(0, 5).map(([id, count]) => ({ business_id: id, count })),
      },
    });
  }

  /**
   * Check migration metadata
   */
  private async checkMigrationMetadata(): Promise<void> {
    // Check migrated_from_v1 flag
    const { count: migratedCount } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true })
      .eq('migrated_from_v1', true);

    const { count: totalCount } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true });

    this.checks.push({
      name: 'Migration Metadata',
      category: 'consistency',
      status: migratedCount === totalCount ? 'pass' : 'warn',
      message:
        migratedCount === totalCount
          ? `All ${totalCount} records have migration metadata`
          : `${migratedCount}/${totalCount} records have migration metadata`,
      details: { migratedCount, totalCount },
    });

    // Check migrated_at timestamps
    const { count: withTimestamp } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true })
      .not('migrated_at', 'is', null);

    this.checks.push({
      name: 'Migration Timestamps',
      category: 'consistency',
      status: withTimestamp === totalCount ? 'pass' : 'warn',
      message:
        withTimestamp === totalCount
          ? 'All records have migration timestamps'
          : `${withTimestamp}/${totalCount} records have migration timestamps`,
      details: { withTimestamp, totalCount },
    });
  }

  /**
   * Generate validation report
   */
  private async generateReport(): Promise<ValidationReport> {
    const passedChecks = this.checks.filter((c) => c.status === 'pass').length;
    const failedChecks = this.checks.filter((c) => c.status === 'fail').length;

    // Get summary stats
    const { count: v1Count } = await this.supabase
      .from('voice_agent_config')
      .select('*', { count: 'exact', head: true });

    const { count: v2Count } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true });

    const summary: ValidationSummary = {
      v1Records: v1Count || 0,
      v2Records: v2Count || 0,
      matchRate: v1Count && v2Count ? Math.round((v2Count / v1Count) * 100) : 0,
      orphanedRecords: 0,
      nullRequiredFields: 0,
      duplicateIds: 0,
      invalidTypes: 0,
    };

    // Calculate summary from checks
    for (const check of this.checks) {
      if (check.name.includes('Orphan')) {
        summary.orphanedRecords = (check.details?.orphanedCount as number) || 0;
      }
      if (check.name.includes('Required Field') && check.status !== 'pass') {
        summary.nullRequiredFields += (check.details?.nullCount as number) || 0;
      }
      if (check.name === 'Duplicate IDs') {
        summary.duplicateIds = (check.details?.duplicateCount as number) || 0;
      }
      if (check.name === 'Valid Assistant Types' && check.status !== 'pass') {
        summary.invalidTypes = (check.details?.invalidCount as number) || 0;
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (summary.matchRate < 100) {
      recommendations.push('Some records were not migrated. Re-run migration with --verbose flag.');
    }
    if (summary.nullRequiredFields > 0) {
      recommendations.push('Run validation with --fix flag to populate missing required fields.');
    }
    if (summary.duplicateIds > 0) {
      recommendations.push('Investigate duplicate IDs and remove extras manually.');
    }
    if (summary.invalidTypes > 0) {
      recommendations.push('Review records with invalid assistant types and correct them.');
    }
    if (failedChecks === 0 && passedChecks === this.checks.length) {
      recommendations.push('Migration validated successfully. Ready for production use.');
    }

    return {
      timestamp: new Date().toISOString(),
      success: failedChecks === 0,
      totalChecks: this.checks.length,
      passedChecks,
      failedChecks,
      checks: this.checks,
      summary,
      recommendations,
    };
  }

  /**
   * Print validation results
   */
  private printResults(report: ValidationReport): void {
    console.log('\n' + '='.repeat(70));
    console.log('VALIDATION RESULTS');
    console.log('='.repeat(70));

    console.log(`\nStatus: ${report.success ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}`);
    console.log(`Checks: ${report.passedChecks}/${report.totalChecks} passed`);

    console.log('\n--- Summary ---');
    console.log(`  v1 Records: ${report.summary.v1Records}`);
    console.log(`  v2 Records: ${report.summary.v2Records}`);
    console.log(`  Match Rate: ${report.summary.matchRate}%`);
    console.log(`  Orphaned Records: ${report.summary.orphanedRecords}`);
    console.log(`  Null Required Fields: ${report.summary.nullRequiredFields}`);
    console.log(`  Duplicate IDs: ${report.summary.duplicateIds}`);

    if (this.options.detailed) {
      console.log('\n--- Check Details ---');
      for (const check of report.checks) {
        const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
        const fixedNote = check.fixed ? ' [FIXED]' : check.fixable ? ' [FIXABLE]' : '';
        console.log(`  ${icon} ${check.name}: ${check.message}${fixedNote}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n--- Recommendations ---');
      for (const rec of report.recommendations) {
        console.log(`  • ${rec}`);
      }
    }

    console.log('\n' + '='.repeat(70));
  }

  /**
   * Save report to file
   */
  private async saveReport(report: ValidationReport): Promise<void> {
    const fs = await import('fs').then((m) => m.promises);
    const path = this.options.reportFile!;

    await fs.writeFile(path, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${path}`);
  }
}

// =====================================================
// CLI ENTRY POINT
// =====================================================

async function main() {
  const args = process.argv.slice(2);

  const options: ValidationOptions = {
    detailed: args.includes('--detailed'),
    fix: args.includes('--fix'),
    reportFile: args.find((a) => a.startsWith('--report-file='))?.split('=')[1],
  };

  // Support both environment variable naming conventions
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const validator = new MigrationValidator(supabaseUrl, supabaseKey, options);
  const report = await validator.validate();

  process.exit(report.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { MigrationValidator };
export type { ValidationOptions, ValidationReport };
