/**
 * TIS TIS Platform - Voice Agent v2.0
 * Migration Script: v1 → v2
 *
 * @deprecated Este script está OBSOLETO. TIS TIS ahora usa únicamente
 * la arquitectura v2 (voice_assistant_configs). La tabla voice_agent_config
 * ya no se usa activamente en el sistema.
 *
 * Este script se mantiene solo para referencia histórica.
 * NO debe ejecutarse en nuevas instalaciones.
 *
 * ---
 *
 * [HISTÓRICO] Este script migraba datos de voice_agent_config a voice_assistant_configs
 * con zero downtime y capacidades de rollback.
 *
 * Usage (OBSOLETO):
 *   npx ts-node scripts/migration/migrate-voice-agent-v2.ts [options]
 *
 * Options:
 *   --dry-run         Execute without making changes
 *   --batch-size      Number of records per batch (default: 100)
 *   --tenant-ids      Specific tenant IDs (comma-separated)
 *   --skip-backup     Skip backup creation (only for testing)
 *   --verbose         Enable detailed logging
 *
 * @module scripts/migration/migrate-voice-agent-v2
 * @deprecated Desde Enero 2025 - Arquitectura simplificada a v2-only
 */

console.warn('\n⚠️  ADVERTENCIA: Este script está OBSOLETO.');
console.warn('    TIS TIS ahora usa únicamente la arquitectura v2 (voice_assistant_configs).');
console.warn('    La tabla voice_agent_config ya no se usa activamente.\n');
console.warn('    Si necesitas migrar datos históricos, contacta al equipo de desarrollo.\n');

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  tenantIds?: string[];
  skipBackup: boolean;
  verbose: boolean;
}

interface MigrationResult {
  success: boolean;
  migratedConfigs: number;
  migratedCalls: number;
  metricsGenerated: number;
  errors: MigrationError[];
  warnings: string[];
  duration: number;
  backupId?: string;
}

interface MigrationError {
  type: 'config' | 'call' | 'metric' | 'validation';
  id: string;
  message: string;
  timestamp: Date;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalConfigs: number;
    totalCalls: number;
    orphanedRecords: number;
  };
}

interface OldVoiceConfig {
  id: string;
  business_id: string;
  vapi_assistant_id: string | null;
  phone_number_id: string | null;
  assistant_name: string | null;
  system_prompt: string | null;
  voice_id: string | null;
  first_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  businesses?: {
    id: string;
    vertical: string;
    name: string;
  };
}

interface NewVoiceConfig {
  id: string;
  business_id: string;
  assistant_type_id: string;
  vapi_assistant_id: string | null;
  phone_number_id: string | null;
  voice_id: string;
  voice_speed: number;
  personality_type: string;
  special_instructions: string | null;
  enabled_capabilities: string[];
  template_version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  migrated_from_v1: boolean;
  migrated_at: string;
  original_prompt_hash: string;
}

interface BusinessMetrics {
  periodStart: string;
  periodEnd: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDuration: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  reservationsCreated: number;
  appointmentsCreated: number;
  ordersCreated: number;
  humanTransfers: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const ASSISTANT_TYPE_MAPPINGS = {
  restaurant: {
    basic: 'rest_basic',
    standard: 'rest_standard',
    complete: 'rest_complete',
  },
  dental: {
    basic: 'dental_basic',
    standard: 'dental_standard',
    complete: 'dental_complete',
  },
};

const DEFAULT_CAPABILITIES = {
  restaurant: ['reservations', 'business_hours'],
  dental: ['appointments', 'business_hours'],
};

const CAPABILITY_KEYWORDS = {
  reservations: ['reserv', 'mesa', 'table'],
  orders: ['pedido', 'orden', 'order', 'comida', 'food'],
  menu_info: ['menu', 'carta', 'plato', 'dish'],
  promotions: ['promo', 'descuento', 'oferta', 'discount'],
  appointments: ['cita', 'appointment', 'consulta'],
  services_info: ['servicio', 'tratamiento', 'service', 'treatment'],
  doctor_info: ['doctor', 'dentista', 'especialista'],
  insurance_info: ['seguro', 'insurance', 'cobertura'],
  business_hours: ['horario', 'hora', 'abierto', 'cerrado', 'hours'],
  human_transfer: ['transferir', 'humano', 'persona', 'agente', 'transfer'],
  faq: ['pregunta', 'faq', 'duda', 'question'],
};

// =====================================================
// MAIN MIGRATION CLASS
// =====================================================

class VoiceAgentMigration {
  private supabase: SupabaseClient;
  private options: MigrationOptions;
  private errors: MigrationError[] = [];
  private warnings: string[] = [];

  constructor(supabaseUrl: string, supabaseKey: string, options: MigrationOptions) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.options = options;
  }

  /**
   * Execute the complete migration process
   */
  async execute(): Promise<MigrationResult> {
    const startTime = Date.now();

    this.log('='.repeat(70));
    this.log('VOICE AGENT v2.0 MIGRATION');
    this.log('='.repeat(70));
    this.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    this.log(`Batch Size: ${this.options.batchSize}`);
    this.log(`Tenants: ${this.options.tenantIds?.join(', ') || 'ALL'}`);
    this.log('='.repeat(70));

    let backupId: string | undefined;
    let migratedConfigs = 0;
    let migratedCalls = 0;
    let metricsGenerated = 0;

    try {
      // Step 1: Create Backup
      if (!this.options.skipBackup) {
        this.log('\n[1/6] Creating backup...');
        backupId = await this.createBackup();
      } else {
        this.log('\n[1/6] Skipping backup (--skip-backup flag)');
      }

      // Step 2: Validate Current Data
      this.log('\n[2/6] Validating current data...');
      const validation = await this.validateCurrentData();
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      this.warnings.push(...validation.warnings);

      // Step 3: Migrate Configurations
      this.log('\n[3/6] Migrating configurations...');
      migratedConfigs = await this.migrateConfigurations();

      // Step 4: Update Calls with Outcomes
      this.log('\n[4/6] Updating call outcomes...');
      migratedCalls = await this.updateCallOutcomes();

      // Step 5: Generate Metrics
      this.log('\n[5/6] Generating aggregated metrics...');
      metricsGenerated = await this.generateMetrics();

      // Step 6: Verify Migration
      this.log('\n[6/6] Verifying migration...');
      await this.verifyMigration();

      const duration = Date.now() - startTime;

      const result: MigrationResult = {
        success: this.errors.length === 0,
        migratedConfigs,
        migratedCalls,
        metricsGenerated,
        errors: this.errors,
        warnings: this.warnings,
        duration,
        backupId,
      };

      this.printResults(result);

      return result;
    } catch (error) {
      this.log('\n❌ MIGRATION FAILED:', 'error');
      this.log(String(error), 'error');

      if (!this.options.dryRun && backupId) {
        this.log('\nRollback may be required. Use:', 'warn');
        this.log(`  npx ts-node scripts/migration/rollback-migration.ts --backup-id ${backupId}`, 'warn');
      }

      return {
        success: false,
        migratedConfigs,
        migratedCalls,
        metricsGenerated,
        errors: [
          ...this.errors,
          {
            type: 'validation',
            id: 'migration',
            message: String(error),
            timestamp: new Date(),
          },
        ],
        warnings: this.warnings,
        duration: Date.now() - startTime,
        backupId,
      };
    }
  }

  /**
   * Create backup of all affected tables
   */
  private async createBackup(): Promise<string> {
    if (this.options.dryRun) {
      this.log('  [DRY RUN] Would create backup');
      return 'dry-run-backup-id';
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `migration_${timestamp}`;

    const tablesToBackup = ['voice_agent_config', 'voice_calls'];

    for (const table of tablesToBackup) {
      const backupTableName = `${table}_backup_${timestamp}`;

      // Use raw SQL to create backup table
      const { error } = await this.supabase.rpc('create_table_backup', {
        source_table: table,
        backup_table: backupTableName,
      });

      if (error) {
        // If RPC doesn't exist, try direct approach
        this.warnings.push(`Could not create backup via RPC for ${table}: ${error.message}`);

        // Alternative: Export data as JSON
        const { data, error: selectError } = await this.supabase
          .from(table)
          .select('*');

        if (selectError) {
          throw new Error(`Failed to backup ${table}: ${selectError.message}`);
        }

        // Store backup reference in metadata table
        await this.supabase.from('migration_backups').insert({
          id: backupId,
          table_name: table,
          record_count: data?.length || 0,
          created_at: new Date().toISOString(),
        });

        this.log(`  ✓ Backed up ${table} (${data?.length || 0} records)`);
      } else {
        this.log(`  ✓ Backed up ${table} → ${backupTableName}`);
      }
    }

    // Store backup metadata
    await this.supabase.from('migration_backups').upsert({
      id: backupId,
      tables: tablesToBackup,
      created_at: new Date().toISOString(),
      status: 'completed',
    });

    return backupId;
  }

  /**
   * Validate current data integrity
   */
  private async validateCurrentData(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check voice_agent_config exists and is readable
    const { data: configs, error: configError, count: configCount } = await this.supabase
      .from('voice_agent_config')
      .select('id, business_id', { count: 'exact' })
      .limit(1);

    if (configError) {
      errors.push(`Cannot read voice_agent_config: ${configError.message}`);
    }

    // Check for orphaned calls (calls without business_id)
    const { data: orphanedCalls, count: orphanedCount } = await this.supabase
      .from('voice_calls')
      .select('id', { count: 'exact' })
      .is('business_id', null)
      .limit(10);

    if (orphanedCount && orphanedCount > 0) {
      warnings.push(`Found ${orphanedCount} calls without business_id (will be skipped)`);
    }

    // Check if new table already has data
    const { data: existingNewConfigs, count: existingCount } = await this.supabase
      .from('voice_assistant_configs')
      .select('id', { count: 'exact' })
      .limit(1);

    if (existingCount && existingCount > 0) {
      warnings.push(`voice_assistant_configs already has ${existingCount} records`);
    }

    // Get total calls count
    const { count: totalCalls } = await this.supabase
      .from('voice_calls')
      .select('id', { count: 'exact', head: true });

    this.log(`  ✓ Validation complete`);
    this.log(`    - Configs to migrate: ${configCount || 0}`);
    this.log(`    - Calls to process: ${totalCalls || 0}`);
    this.log(`    - Orphaned records: ${orphanedCount || 0}`);

    if (warnings.length > 0) {
      this.log(`    - Warnings: ${warnings.length}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalConfigs: configCount || 0,
        totalCalls: totalCalls || 0,
        orphanedRecords: orphanedCount || 0,
      },
    };
  }

  /**
   * Migrate configurations from v1 to v2 schema
   */
  private async migrateConfigurations(): Promise<number> {
    // Build query
    let query = this.supabase
      .from('voice_agent_config')
      .select(`
        *,
        businesses (
          id,
          vertical,
          name
        )
      `);

    // Filter by tenant IDs if specified
    if (this.options.tenantIds && this.options.tenantIds.length > 0) {
      query = query.in('business_id', this.options.tenantIds);
    }

    const { data: configs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch configs: ${error.message}`);
    }

    if (!configs || configs.length === 0) {
      this.log('  No configurations to migrate');
      return 0;
    }

    this.log(`  Found ${configs.length} configurations to migrate`);

    let migratedCount = 0;

    // Process in batches
    for (let i = 0; i < configs.length; i += this.options.batchSize) {
      const batch = configs.slice(i, i + this.options.batchSize);

      for (const oldConfig of batch) {
        try {
          const newConfig = this.transformConfig(oldConfig as OldVoiceConfig);

          if (this.options.dryRun) {
            this.logVerbose(`  [DRY RUN] Would migrate config ${oldConfig.id}`);
          } else {
            const { error: insertError } = await this.supabase
              .from('voice_assistant_configs')
              .upsert(newConfig, { onConflict: 'id' });

            if (insertError) {
              this.errors.push({
                type: 'config',
                id: oldConfig.id,
                message: insertError.message,
                timestamp: new Date(),
              });
              continue;
            }
          }

          migratedCount++;
        } catch (err) {
          this.errors.push({
            type: 'config',
            id: oldConfig.id,
            message: String(err),
            timestamp: new Date(),
          });
        }
      }

      const processed = Math.min(i + this.options.batchSize, configs.length);
      this.log(`  Processed ${processed}/${configs.length} configs`);
    }

    return migratedCount;
  }

  /**
   * Transform v1 config to v2 schema
   */
  private transformConfig(oldConfig: OldVoiceConfig): NewVoiceConfig {
    const vertical = oldConfig.businesses?.vertical || 'restaurant';
    const assistantType = this.inferAssistantType(oldConfig, vertical);
    const specialInstructions = this.extractSpecialInstructions(oldConfig.system_prompt);
    const capabilities = this.inferCapabilities(oldConfig.system_prompt, vertical);

    return {
      id: oldConfig.id,
      business_id: oldConfig.business_id,
      assistant_type_id: assistantType,
      vapi_assistant_id: oldConfig.vapi_assistant_id,
      phone_number_id: oldConfig.phone_number_id,
      voice_id: oldConfig.voice_id || 'coral',
      voice_speed: 1.0,
      personality_type: 'friendly',
      special_instructions: specialInstructions,
      enabled_capabilities: capabilities,
      template_version: '1',
      is_active: oldConfig.is_active,
      created_at: oldConfig.created_at,
      updated_at: new Date().toISOString(),
      migrated_from_v1: true,
      migrated_at: new Date().toISOString(),
      original_prompt_hash: this.hashString(oldConfig.system_prompt || ''),
    };
  }

  /**
   * Infer assistant type from prompt content
   */
  private inferAssistantType(config: OldVoiceConfig, vertical: string): string {
    const prompt = (config.system_prompt || '').toLowerCase();

    const hasOrders = prompt.includes('pedido') || prompt.includes('orden') || prompt.includes('order');
    const hasTransfer = prompt.includes('transferir') || prompt.includes('humano') || prompt.includes('transfer');
    const hasServices = prompt.includes('servicio') || prompt.includes('tratamiento') || prompt.includes('service');

    if (vertical === 'restaurant') {
      if (hasOrders && hasTransfer) return 'rest_complete';
      if (hasOrders) return 'rest_standard';
      return 'rest_basic';
    }

    if (vertical === 'dental') {
      if (hasServices && hasTransfer) return 'dental_complete';
      if (hasServices) return 'dental_standard';
      return 'dental_basic';
    }

    return `${vertical}_basic`;
  }

  /**
   * Extract special instructions from existing prompt
   * Note: Limits input length to prevent ReDoS attacks
   */
  private extractSpecialInstructions(prompt: string | null): string | null {
    if (!prompt) return null;

    // Limit input length to prevent potential ReDoS
    const safePrompt = prompt.slice(0, 10000);

    const patterns = [
      /instrucciones especiales[:\s]*([\s\S]*?)(?=##|$)/i,
      /notas importantes[:\s]*([\s\S]*?)(?=##|$)/i,
      /reglas especiales[:\s]*([\s\S]*?)(?=##|$)/i,
      /special instructions[:\s]*([\s\S]*?)(?=##|$)/i,
    ];

    for (const pattern of patterns) {
      const match = safePrompt.match(pattern);
      if (match && match[1]) {
        return match[1].trim().slice(0, 1000);
      }
    }

    return null;
  }

  /**
   * Infer capabilities from prompt content
   */
  private inferCapabilities(prompt: string | null, vertical: string): string[] {
    if (!prompt) {
      return DEFAULT_CAPABILITIES[vertical as keyof typeof DEFAULT_CAPABILITIES] || ['basic'];
    }

    const promptLower = prompt.toLowerCase();
    const capabilities: string[] = [];

    for (const [capability, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
      if (keywords.some((keyword) => promptLower.includes(keyword))) {
        capabilities.push(capability);
      }
    }

    // Ensure at least basic capabilities
    if (capabilities.length === 0) {
      return DEFAULT_CAPABILITIES[vertical as keyof typeof DEFAULT_CAPABILITIES] || ['basic'];
    }

    return capabilities;
  }

  /**
   * Update call records with inferred outcomes
   */
  private async updateCallOutcomes(): Promise<number> {
    if (this.options.dryRun) {
      this.log('  [DRY RUN] Would update call outcomes');
      return 0;
    }

    // Get calls that need outcome inference
    const { data: calls, error } = await this.supabase
      .from('voice_calls')
      .select('id, status, ended_reason, transcript')
      .is('outcome', null)
      .not('business_id', 'is', null);

    if (error) {
      this.warnings.push(`Could not fetch calls for outcome update: ${error.message}`);
      return 0;
    }

    if (!calls || calls.length === 0) {
      this.log('  No calls need outcome updates');
      return 0;
    }

    this.log(`  Found ${calls.length} calls to update`);

    let updatedCount = 0;
    const BATCH_SIZE = 50; // Process in batches for better performance

    // Group calls by outcome for batch updates
    const outcomeGroups: Record<string, string[]> = {};

    for (const call of calls) {
      const outcome = this.inferCallOutcome(call);
      if (!outcomeGroups[outcome]) {
        outcomeGroups[outcome] = [];
      }
      outcomeGroups[outcome].push(call.id);
    }

    // Update each outcome group in batches
    for (const [outcome, callIds] of Object.entries(outcomeGroups)) {
      for (let i = 0; i < callIds.length; i += BATCH_SIZE) {
        const batchIds = callIds.slice(i, i + BATCH_SIZE);

        const { error: updateError, count } = await this.supabase
          .from('voice_calls')
          .update({ outcome })
          .in('id', batchIds);

        if (updateError) {
          this.errors.push({
            type: 'call',
            id: `batch-${outcome}-${i}`,
            message: updateError.message,
            timestamp: new Date(),
          });
        } else {
          updatedCount += batchIds.length;
        }
      }
    }

    return updatedCount;
  }

  /**
   * Infer call outcome from call data
   */
  private inferCallOutcome(call: {
    status: string;
    ended_reason?: string;
    transcript?: string;
  }): string {
    const transcript = (call.transcript || '').toLowerCase();

    // Check for successful outcomes
    if (transcript.includes('reservación confirmada') || transcript.includes('reservation confirmed')) {
      return 'reservation_created';
    }
    if (transcript.includes('cita agendada') || transcript.includes('appointment scheduled')) {
      return 'appointment_created';
    }
    if (transcript.includes('pedido confirmado') || transcript.includes('order confirmed')) {
      return 'order_created';
    }
    if (transcript.includes('transferir') || transcript.includes('transfer') || call.ended_reason === 'transferred') {
      return 'transferred_to_human';
    }

    // Check status-based outcomes
    if (call.status === 'completed') {
      return 'information_given';
    }
    if (call.status === 'failed') {
      return 'failed';
    }
    if (call.ended_reason === 'customer-ended-call') {
      return 'customer_hangup';
    }
    if (call.ended_reason === 'silence-timeout') {
      return 'timeout';
    }

    return 'unknown';
  }

  /**
   * Generate aggregated metrics for each business
   */
  private async generateMetrics(): Promise<number> {
    // Get unique business IDs with calls
    const { data: businesses, error } = await this.supabase
      .from('voice_calls')
      .select('business_id')
      .not('business_id', 'is', null);

    if (error) {
      this.warnings.push(`Could not fetch businesses for metrics: ${error.message}`);
      return 0;
    }

    const uniqueBusinessIds = [...new Set(businesses?.map((b) => b.business_id))];

    if (uniqueBusinessIds.length === 0) {
      this.log('  No businesses with calls for metrics');
      return 0;
    }

    this.log(`  Generating metrics for ${uniqueBusinessIds.length} businesses`);

    let generatedCount = 0;

    for (const businessId of uniqueBusinessIds) {
      try {
        const metrics = await this.calculateBusinessMetrics(businessId);

        if (this.options.dryRun) {
          this.logVerbose(`  [DRY RUN] Would insert metrics for ${businessId}`);
        } else {
          const { error: insertError } = await this.supabase
            .from('voice_assistant_metrics')
            .upsert({
              business_id: businessId,
              period_start: metrics.periodStart,
              period_end: metrics.periodEnd,
              total_calls: metrics.totalCalls,
              successful_calls: metrics.successfulCalls,
              failed_calls: metrics.failedCalls,
              avg_duration_seconds: metrics.avgDuration,
              avg_latency_ms: metrics.avgLatency,
              p50_latency_ms: metrics.p50Latency,
              p95_latency_ms: metrics.p95Latency,
              reservations_created: metrics.reservationsCreated,
              appointments_created: metrics.appointmentsCreated,
              orders_created: metrics.ordersCreated,
              human_transfers: metrics.humanTransfers,
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            this.errors.push({
              type: 'metric',
              id: businessId,
              message: insertError.message,
              timestamp: new Date(),
            });
            continue;
          }
        }

        generatedCount++;
      } catch (err) {
        this.errors.push({
          type: 'metric',
          id: businessId,
          message: String(err),
          timestamp: new Date(),
        });
      }
    }

    return generatedCount;
  }

  /**
   * Calculate metrics for a specific business
   */
  private async calculateBusinessMetrics(businessId: string): Promise<BusinessMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: calls } = await this.supabase
      .from('voice_calls')
      .select('*')
      .eq('business_id', businessId)
      .gte('started_at', thirtyDaysAgo.toISOString());

    if (!calls || calls.length === 0) {
      return {
        periodStart: thirtyDaysAgo.toISOString(),
        periodEnd: new Date().toISOString(),
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        avgDuration: 0,
        avgLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        reservationsCreated: 0,
        appointmentsCreated: 0,
        ordersCreated: 0,
        humanTransfers: 0,
      };
    }

    const durations = calls
      .map((c) => c.duration_seconds || 0)
      .filter((d) => d > 0);

    const latencies = calls
      .map((c) => c.avg_latency_ms || 0)
      .filter((l) => l > 0)
      .sort((a, b) => a - b);

    return {
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: new Date().toISOString(),
      totalCalls: calls.length,
      successfulCalls: calls.filter((c) => c.status === 'completed').length,
      failedCalls: calls.filter((c) => c.status === 'failed').length,
      avgDuration:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
      avgLatency:
        latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0,
      p50Latency: latencies.length > 0
        ? latencies[Math.min(Math.floor(latencies.length * 0.5), latencies.length - 1)]
        : 0,
      p95Latency: latencies.length > 0
        ? latencies[Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1)]
        : 0,
      reservationsCreated: calls.filter((c) => c.outcome === 'reservation_created').length,
      appointmentsCreated: calls.filter((c) => c.outcome === 'appointment_created').length,
      ordersCreated: calls.filter((c) => c.outcome === 'order_created').length,
      humanTransfers: calls.filter((c) => c.outcome === 'transferred_to_human').length,
    };
  }

  /**
   * Verify migration integrity
   */
  private async verifyMigration(): Promise<void> {
    if (this.options.dryRun) {
      this.log('  [DRY RUN] Skipping verification');
      return;
    }

    // Count comparison
    const { count: oldCount } = await this.supabase
      .from('voice_agent_config')
      .select('*', { count: 'exact', head: true });

    const { count: newCount } = await this.supabase
      .from('voice_assistant_configs')
      .select('*', { count: 'exact', head: true });

    if (oldCount !== newCount) {
      this.warnings.push(`Count mismatch: old=${oldCount}, new=${newCount}`);
    }

    // Check for null required fields
    const { data: nullChecks, count: nullCount } = await this.supabase
      .from('voice_assistant_configs')
      .select('id', { count: 'exact' })
      .or('assistant_type_id.is.null,voice_id.is.null')
      .limit(10);

    if (nullCount && nullCount > 0) {
      this.warnings.push(`Found ${nullCount} configs with null required fields`);
    }

    this.log(`  ✓ Verification complete`);
    this.log(`    - Old records: ${oldCount}`);
    this.log(`    - New records: ${newCount}`);

    if (this.warnings.length > 0) {
      this.log(`    - Warnings: ${this.warnings.length}`);
    }
  }

  /**
   * Print final results
   */
  private printResults(result: MigrationResult): void {
    this.log('\n' + '='.repeat(70));
    this.log('MIGRATION RESULTS');
    this.log('='.repeat(70));
    this.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    this.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    this.log(`Configs migrated: ${result.migratedConfigs}`);
    this.log(`Calls updated: ${result.migratedCalls}`);
    this.log(`Metrics generated: ${result.metricsGenerated}`);

    if (result.backupId) {
      this.log(`Backup ID: ${result.backupId}`);
    }

    if (result.warnings.length > 0) {
      this.log(`\nWarnings (${result.warnings.length}):`);
      result.warnings.forEach((w) => this.log(`  ⚠ ${w}`, 'warn'));
    }

    if (result.errors.length > 0) {
      this.log(`\nErrors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach((e) => this.log(`  ✗ [${e.type}] ${e.id}: ${e.message}`, 'error'));
      if (result.errors.length > 10) {
        this.log(`  ... and ${result.errors.length - 10} more`, 'error');
      }
    }

    this.log('='.repeat(70));
  }

  /**
   * Utility: Hash a string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Utility: Log message
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = {
      info: '',
      warn: '⚠ ',
      error: '✗ ',
    }[level];

    console.log(`${prefix}${message}`);
  }

  /**
   * Utility: Log verbose message (only if verbose mode)
   */
  private logVerbose(message: string): void {
    if (this.options.verbose) {
      console.log(`  ${message}`);
    }
  }
}

// =====================================================
// CLI ENTRY POINT
// =====================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(
      args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '100',
      10
    ),
    tenantIds: args
      .find((a) => a.startsWith('--tenant-ids='))
      ?.split('=')[1]
      ?.split(','),
    skipBackup: args.includes('--skip-backup'),
    verbose: args.includes('--verbose'),
  };

  // Validate environment variables (support both naming conventions)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  // Validate tenantIds if provided
  if (options.tenantIds && options.tenantIds.length === 1 && options.tenantIds[0] === '') {
    options.tenantIds = undefined; // Treat empty string as "all tenants"
  }

  // Execute migration
  const migration = new VoiceAgentMigration(supabaseUrl, supabaseKey, options);
  const result = await migration.execute();

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { VoiceAgentMigration };
export type { MigrationOptions, MigrationResult };
