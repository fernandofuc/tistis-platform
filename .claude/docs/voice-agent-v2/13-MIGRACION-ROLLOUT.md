# 13. Migracion y Rollout - Voice Agent v2.0

## Tabla de Contenidos

1. [Estrategia de Migracion](#1-estrategia-de-migracion)
2. [Script de Migracion](#2-script-de-migracion)
3. [Plan de Rollout](#3-plan-de-rollout)
4. [Feature Flags](#4-feature-flags)
5. [Monitoreo de Rollout](#5-monitoreo-de-rollout)
6. [Rollback Plan](#6-rollback-plan)
7. [Comunicacion](#7-comunicacion)
8. [Post-Rollout](#8-post-rollout)

---

## 1. Estrategia de Migracion

### 1.1 Vision General

```
┌─────────────────────────────────────────────────────────────────┐
│                   ESTRATEGIA DE MIGRACION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FASE 1: PREPARACION                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Backup completo de datos                              │   │
│  │ • Validar integridad de datos actuales                  │   │
│  │ • Crear tablas nuevas (sin migrar datos)                │   │
│  │ • Desplegar codigo v2 con feature flag OFF              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  FASE 2: MIGRACION DE DATOS                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Ejecutar script de migracion                          │   │
│  │ • Validar datos migrados                                │   │
│  │ • Mantener datos en ambas estructuras (dual-write)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  FASE 3: ROLLOUT GRADUAL                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 10% tenants → 25% → 50% → 100%                        │   │
│  │ • Monitoreo continuo                                    │   │
│  │ • Rollback instantaneo si hay problemas                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  FASE 4: LIMPIEZA                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Remover feature flags                                 │   │
│  │ • Deprecar tablas antiguas                              │   │
│  │ • Eliminar codigo legacy                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Mapeo de Datos

```
ESTRUCTURA ACTUAL → ESTRUCTURA NUEVA
═══════════════════════════════════════════════════════════════

voice_agent_config          →  voice_assistant_configs
├── id                      →  id (mismo)
├── business_id             →  business_id (mismo)
├── vapi_assistant_id       →  vapi_assistant_id (mismo)
├── phone_number_id         →  phone_number_id (mismo)
├── assistant_name          →  (derivado de tipo)
├── system_prompt           →  (generado por template)
├── voice_id                →  voice_id (mismo)
├── first_message           →  (generado por template)
├── is_active               →  is_active (mismo)
├── created_at              →  created_at (mismo)
└── updated_at              →  updated_at (mismo)

NUEVOS CAMPOS:
├── assistant_type_id       ←  (inferido de capacidades)
├── template_version        ←  '1' (default)
├── personality_type        ←  'friendly' (default)
├── special_instructions    ←  (extraido de prompt actual)
├── enabled_capabilities    ←  (inferido de tools)
└── voice_speed             ←  1.0 (default)

voice_calls                 →  voice_calls (sin cambios mayores)
├── Todos los campos        →  (se mantienen)
└── NUEVO: outcome          ←  (inferido de status)

NUEVA TABLA: voice_assistant_metrics
├── Agregado de voice_calls existentes
└── Calculado en migracion
```

---

## 2. Script de Migracion

### 2.1 Script Principal

```typescript
// scripts/migrate-voice-agent-v2.ts

import { createClient } from '@supabase/supabase-js';
import { program } from 'commander';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  tenantIds?: string[];
  skipBackup: boolean;
}

interface MigrationResult {
  success: boolean;
  migratedConfigs: number;
  migratedCalls: number;
  errors: string[];
  duration: number;
}

/**
 * Script principal de migracion Voice Agent v1 → v2
 */
async function main() {
  program
    .option('--dry-run', 'Ejecutar sin hacer cambios', false)
    .option('--batch-size <number>', 'Tamano de batch', '100')
    .option('--tenant-ids <ids>', 'IDs de tenants especificos (comma-separated)')
    .option('--skip-backup', 'Saltar backup (solo para testing)', false)
    .parse();

  const options: MigrationOptions = {
    dryRun: program.opts().dryRun,
    batchSize: parseInt(program.opts().batchSize),
    tenantIds: program.opts().tenantIds?.split(','),
    skipBackup: program.opts().skipBackup
  };

  console.log('='.repeat(60));
  console.log('VOICE AGENT v2.0 MIGRATION');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Batch Size: ${options.batchSize}`);
  console.log(`Tenants: ${options.tenantIds?.join(', ') || 'ALL'}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Paso 1: Backup
    if (!options.skipBackup) {
      console.log('\n[1/5] Creating backup...');
      await createBackup(options);
    }

    // Paso 2: Validar datos actuales
    console.log('\n[2/5] Validating current data...');
    const validationResult = await validateCurrentData(options);
    if (!validationResult.valid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Paso 3: Migrar configuraciones
    console.log('\n[3/5] Migrating configurations...');
    const configsResult = await migrateConfigurations(options);

    // Paso 4: Migrar llamadas y calcular metricas
    console.log('\n[4/5] Migrating calls and calculating metrics...');
    const callsResult = await migrateCallsAndMetrics(options);

    // Paso 5: Verificar migracion
    console.log('\n[5/5] Verifying migration...');
    const verificationResult = await verifyMigration(options);

    const duration = Date.now() - startTime;

    // Resultado final
    const result: MigrationResult = {
      success: verificationResult.success,
      migratedConfigs: configsResult.count,
      migratedCalls: callsResult.count,
      errors: [
        ...configsResult.errors,
        ...callsResult.errors,
        ...verificationResult.errors
      ],
      duration
    };

    printResults(result);

    if (!result.success) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    console.log('\nRolling back...');
    await rollback(options);
    process.exit(1);
  }
}

/**
 * Crear backup de todas las tablas afectadas
 */
async function createBackup(options: MigrationOptions): Promise<void> {
  if (options.dryRun) {
    console.log('  [DRY RUN] Would create backup');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupTables = [
    'voice_agent_config',
    'voice_calls'
  ];

  for (const table of backupTables) {
    const backupName = `${table}_backup_${timestamp}`;

    const { error } = await supabase.rpc('create_table_backup', {
      source_table: table,
      backup_table: backupName
    });

    if (error) {
      throw new Error(`Failed to backup ${table}: ${error.message}`);
    }

    console.log(`  ✓ Backed up ${table} → ${backupName}`);
  }
}

/**
 * Validar integridad de datos actuales
 */
async function validateCurrentData(options: MigrationOptions): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Verificar que existen configuraciones
  const { data: configs, error: configError } = await supabase
    .from('voice_agent_config')
    .select('id, business_id, vapi_assistant_id')
    .limit(1);

  if (configError) {
    errors.push(`Cannot read voice_agent_config: ${configError.message}`);
  }

  // Verificar foreign keys
  const { data: orphanedCalls } = await supabase
    .from('voice_calls')
    .select('id')
    .is('business_id', null)
    .limit(10);

  if (orphanedCalls && orphanedCalls.length > 0) {
    errors.push(`Found ${orphanedCalls.length} orphaned calls without business_id`);
  }

  // Verificar que las tablas nuevas estan vacias o no existen
  const { data: existingNewConfigs } = await supabase
    .from('voice_assistant_configs')
    .select('id')
    .limit(1);

  if (existingNewConfigs && existingNewConfigs.length > 0) {
    console.log('  ⚠ Warning: voice_assistant_configs already has data');
  }

  console.log(`  ✓ Validation complete (${errors.length} issues)`);

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Migrar configuraciones de voice_agent_config a voice_assistant_configs
 */
async function migrateConfigurations(options: MigrationOptions): Promise<{
  count: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let count = 0;

  // Construir query base
  let query = supabase
    .from('voice_agent_config')
    .select(`
      *,
      businesses (
        id,
        vertical,
        name
      )
    `);

  // Filtrar por tenants si se especificaron
  if (options.tenantIds) {
    query = query.in('business_id', options.tenantIds);
  }

  const { data: configs, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch configs: ${error.message}`);
  }

  console.log(`  Found ${configs?.length || 0} configurations to migrate`);

  // Procesar en batches
  for (let i = 0; i < (configs?.length || 0); i += options.batchSize) {
    const batch = configs!.slice(i, i + options.batchSize);

    for (const oldConfig of batch) {
      try {
        const newConfig = transformConfig(oldConfig);

        if (options.dryRun) {
          console.log(`  [DRY RUN] Would migrate config ${oldConfig.id}`);
        } else {
          const { error: insertError } = await supabase
            .from('voice_assistant_configs')
            .insert(newConfig);

          if (insertError) {
            errors.push(`Config ${oldConfig.id}: ${insertError.message}`);
            continue;
          }
        }

        count++;
      } catch (err) {
        errors.push(`Config ${oldConfig.id}: ${err}`);
      }
    }

    console.log(`  Processed ${Math.min(i + options.batchSize, configs!.length)}/${configs!.length}`);
  }

  return { count, errors };
}

/**
 * Transformar configuracion v1 a v2
 */
function transformConfig(oldConfig: any): any {
  // Inferir tipo de asistente basado en el vertical y prompt actual
  const vertical = oldConfig.businesses?.vertical || 'restaurant';
  const assistantType = inferAssistantType(oldConfig, vertical);

  // Extraer instrucciones especiales del prompt actual
  const specialInstructions = extractSpecialInstructions(oldConfig.system_prompt);

  // Inferir capacidades del prompt
  const capabilities = inferCapabilities(oldConfig.system_prompt, vertical);

  return {
    id: oldConfig.id, // Mantener mismo ID para compatibilidad
    business_id: oldConfig.business_id,
    assistant_type_id: assistantType,
    vapi_assistant_id: oldConfig.vapi_assistant_id,
    phone_number_id: oldConfig.phone_number_id,
    voice_id: oldConfig.voice_id || 'elevenlabs-maria',
    voice_speed: 1.0,
    personality_type: 'friendly',
    special_instructions: specialInstructions,
    enabled_capabilities: capabilities,
    template_version: '1',
    is_active: oldConfig.is_active,
    created_at: oldConfig.created_at,
    updated_at: new Date().toISOString(),

    // Metadata de migracion
    migrated_from_v1: true,
    migrated_at: new Date().toISOString(),
    original_prompt_hash: hashString(oldConfig.system_prompt || '')
  };
}

/**
 * Inferir tipo de asistente basado en prompt y capacidades
 */
function inferAssistantType(config: any, vertical: string): string {
  const prompt = (config.system_prompt || '').toLowerCase();

  if (vertical === 'restaurant') {
    if (prompt.includes('pedido') || prompt.includes('orden') || prompt.includes('menu')) {
      if (prompt.includes('transferir') || prompt.includes('humano')) {
        return 'rest_complete';
      }
      return 'rest_standard';
    }
    return 'rest_basic';
  }

  if (vertical === 'dental') {
    if (prompt.includes('servicio') || prompt.includes('tratamiento')) {
      if (prompt.includes('transferir') || prompt.includes('humano')) {
        return 'dental_complete';
      }
      return 'dental_standard';
    }
    return 'dental_basic';
  }

  return `${vertical}_basic`;
}

/**
 * Extraer instrucciones especiales del prompt existente
 */
function extractSpecialInstructions(prompt: string | null): string | null {
  if (!prompt) return null;

  // Buscar seccion de instrucciones especiales
  const patterns = [
    /instrucciones especiales[:\s]*([\s\S]*?)(?=##|$)/i,
    /notas importantes[:\s]*([\s\S]*?)(?=##|$)/i,
    /reglas especiales[:\s]*([\s\S]*?)(?=##|$)/i
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim().slice(0, 1000); // Limitar longitud
    }
  }

  return null;
}

/**
 * Inferir capacidades del prompt
 */
function inferCapabilities(prompt: string | null, vertical: string): string[] {
  if (!prompt) {
    return vertical === 'restaurant'
      ? ['reservations']
      : ['appointments'];
  }

  const capabilities: string[] = [];
  const promptLower = prompt.toLowerCase();

  // Restaurant capabilities
  if (vertical === 'restaurant') {
    if (promptLower.includes('reserv')) capabilities.push('reservations');
    if (promptLower.includes('pedido') || promptLower.includes('orden')) capabilities.push('orders');
    if (promptLower.includes('menu')) capabilities.push('menu_info');
    if (promptLower.includes('promo')) capabilities.push('promotions');
  }

  // Dental capabilities
  if (vertical === 'dental') {
    if (promptLower.includes('cita')) capabilities.push('appointments');
    if (promptLower.includes('servicio') || promptLower.includes('tratamiento')) capabilities.push('services_info');
    if (promptLower.includes('doctor')) capabilities.push('doctor_info');
    if (promptLower.includes('seguro')) capabilities.push('insurance_info');
  }

  // Common capabilities
  if (promptLower.includes('horario')) capabilities.push('business_hours');
  if (promptLower.includes('transferir') || promptLower.includes('humano')) capabilities.push('human_transfer');
  if (promptLower.includes('faq') || promptLower.includes('pregunta')) capabilities.push('faq');

  return capabilities.length > 0 ? capabilities : ['basic'];
}

/**
 * Migrar llamadas y calcular metricas agregadas
 */
async function migrateCallsAndMetrics(options: MigrationOptions): Promise<{
  count: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let count = 0;

  // Obtener todas las llamadas agrupadas por negocio
  const { data: businesses } = await supabase
    .from('voice_calls')
    .select('business_id')
    .not('business_id', 'is', null);

  const uniqueBusinessIds = [...new Set(businesses?.map(b => b.business_id))];

  console.log(`  Found ${uniqueBusinessIds.length} businesses with calls`);

  for (const businessId of uniqueBusinessIds) {
    try {
      // Calcular metricas agregadas para este negocio
      const metrics = await calculateMetricsForBusiness(businessId);

      if (options.dryRun) {
        console.log(`  [DRY RUN] Would insert metrics for ${businessId}`);
      } else {
        const { error } = await supabase
          .from('voice_assistant_metrics')
          .insert({
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
            human_transfers: metrics.humanTransfers
          });

        if (error) {
          errors.push(`Metrics for ${businessId}: ${error.message}`);
          continue;
        }
      }

      count++;
    } catch (err) {
      errors.push(`Business ${businessId}: ${err}`);
    }
  }

  return { count, errors };
}

/**
 * Calcular metricas para un negocio
 */
async function calculateMetricsForBusiness(businessId: string): Promise<any> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: calls } = await supabase
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
      humanTransfers: 0
    };
  }

  const durations = calls.map(c => c.duration_seconds || 0).filter(d => d > 0);
  const latencies = calls.map(c => c.avg_latency_ms || 0).filter(l => l > 0);

  latencies.sort((a, b) => a - b);

  return {
    periodStart: thirtyDaysAgo.toISOString(),
    periodEnd: new Date().toISOString(),
    totalCalls: calls.length,
    successfulCalls: calls.filter(c => c.status === 'completed').length,
    failedCalls: calls.filter(c => c.status === 'failed').length,
    avgDuration: durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0,
    avgLatency: latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0,
    p50Latency: latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.5)]
      : 0,
    p95Latency: latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.95)]
      : 0,
    reservationsCreated: calls.filter(c => c.outcome === 'reservation_created').length,
    appointmentsCreated: calls.filter(c => c.outcome === 'appointment_created').length,
    ordersCreated: calls.filter(c => c.outcome === 'order_created').length,
    humanTransfers: calls.filter(c => c.outcome === 'transferred_to_human').length
  };
}

/**
 * Verificar que la migracion fue exitosa
 */
async function verifyMigration(options: MigrationOptions): Promise<{
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  if (options.dryRun) {
    console.log('  [DRY RUN] Skipping verification');
    return { success: true, errors: [] };
  }

  // Contar registros en ambas tablas
  const { count: oldCount } = await supabase
    .from('voice_agent_config')
    .select('*', { count: 'exact', head: true });

  const { count: newCount } = await supabase
    .from('voice_assistant_configs')
    .select('*', { count: 'exact', head: true });

  if (oldCount !== newCount) {
    errors.push(`Count mismatch: old=${oldCount}, new=${newCount}`);
  }

  // Verificar que todos los campos requeridos tienen valores
  const { data: nullChecks } = await supabase
    .from('voice_assistant_configs')
    .select('id')
    .or('assistant_type_id.is.null,voice_id.is.null')
    .limit(10);

  if (nullChecks && nullChecks.length > 0) {
    errors.push(`Found ${nullChecks.length} configs with null required fields`);
  }

  console.log(`  ✓ Verification complete (${errors.length} issues)`);

  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Rollback en caso de error
 */
async function rollback(options: MigrationOptions): Promise<void> {
  if (options.dryRun) {
    console.log('  [DRY RUN] No rollback needed');
    return;
  }

  // Truncar tablas nuevas
  const { error } = await supabase.rpc('truncate_table', {
    table_name: 'voice_assistant_configs'
  });

  if (error) {
    console.error('  ⚠ Rollback failed:', error.message);
    console.log('  Manual intervention required!');
  } else {
    console.log('  ✓ Rollback complete');
  }
}

/**
 * Imprimir resultados finales
 */
function printResults(result: MigrationResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION RESULTS');
  console.log('='.repeat(60));
  console.log(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`Configs migrated: ${result.migratedConfigs}`);
  console.log(`Calls processed: ${result.migratedCalls}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  console.log('='.repeat(60));
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Ejecutar
main();
```

---

## 3. Plan de Rollout

### 3.1 Fases de Rollout

```
┌─────────────────────────────────────────────────────────────────┐
│                      PLAN DE ROLLOUT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DIA 1: CANARY (5%)                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 2-3 tenants seleccionados manualmente                 │   │
│  │ • Tenants internos o de confianza                       │   │
│  │ • Monitoreo intensivo                                   │   │
│  │ • Criterio de avance: 0 errores criticos                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓ (4-8 horas)                         │
│                                                                 │
│  DIA 1-2: EARLY ADOPTERS (10%)                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 10% de tenants activos                                │   │
│  │ • Seleccionados por bajo volumen                        │   │
│  │ • Monitoreo cada hora                                   │   │
│  │ • Criterio de avance: error rate < 1%                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓ (24 horas)                          │
│                                                                 │
│  DIA 2-3: EXPANSION (25%)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 25% de tenants                                        │   │
│  │ • Mix de volumenes                                      │   │
│  │ • Monitoreo cada 2 horas                                │   │
│  │ • Criterio de avance: error rate < 2%, latencia OK      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓ (24 horas)                          │
│                                                                 │
│  DIA 3-4: MAYORIA (50%)                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • 50% de tenants                                        │   │
│  │ • Incluye tenants de alto volumen                       │   │
│  │ • Monitoreo cada 4 horas                                │   │
│  │ • Criterio de avance: metricas estables                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓ (24-48 horas)                       │
│                                                                 │
│  DIA 5-7: COMPLETO (100%)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Todos los tenants                                     │   │
│  │ • Monitoreo normal                                      │   │
│  │ • Feature flags removidos                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Criterios de Go/No-Go

| Metrica | Go | No-Go |
|---------|-----|-------|
| Error Rate | < 2% | > 5% |
| Latencia p95 | < 800ms | > 1200ms |
| Llamadas fallidas | < 3% | > 10% |
| Circuit Breaker Opens | 0 | > 2 |
| Quejas de usuarios | 0 | > 3 |

---

## 4. Feature Flags

### 4.1 Configuracion de Feature Flags

```typescript
// lib/feature-flags/voice-agent-v2.ts

import { createClient } from '@/lib/supabase/server';

interface VoiceAgentV2Flags {
  enabled: boolean;
  percentage: number;
  enabledTenants: string[];
  disabledTenants: string[];
}

/**
 * Obtener configuracion de feature flags para Voice Agent v2
 */
export async function getVoiceAgentV2Flags(): Promise<VoiceAgentV2Flags> {
  const supabase = createClient();

  const { data } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('name', 'voice_agent_v2')
    .single();

  return {
    enabled: data?.enabled ?? false,
    percentage: data?.percentage ?? 0,
    enabledTenants: data?.enabled_tenants ?? [],
    disabledTenants: data?.disabled_tenants ?? []
  };
}

/**
 * Verificar si un tenant debe usar Voice Agent v2
 */
export async function shouldUseVoiceAgentV2(tenantId: string): Promise<boolean> {
  const flags = await getVoiceAgentV2Flags();

  // Si esta globalmente deshabilitado
  if (!flags.enabled) {
    return false;
  }

  // Si el tenant esta explicitamente deshabilitado
  if (flags.disabledTenants.includes(tenantId)) {
    return false;
  }

  // Si el tenant esta explicitamente habilitado
  if (flags.enabledTenants.includes(tenantId)) {
    return true;
  }

  // Porcentaje de rollout basado en hash del tenant ID
  const hash = hashTenantId(tenantId);
  const percentile = hash % 100;

  return percentile < flags.percentage;
}

/**
 * Actualizar porcentaje de rollout
 */
export async function updateRolloutPercentage(percentage: number): Promise<void> {
  const supabase = createClient();

  await supabase
    .from('feature_flags')
    .update({ percentage })
    .eq('name', 'voice_agent_v2');
}

/**
 * Agregar tenant a lista de habilitados
 */
export async function enableTenantForV2(tenantId: string): Promise<void> {
  const supabase = createClient();
  const flags = await getVoiceAgentV2Flags();

  await supabase
    .from('feature_flags')
    .update({
      enabled_tenants: [...flags.enabledTenants, tenantId]
    })
    .eq('name', 'voice_agent_v2');
}

/**
 * Agregar tenant a lista de deshabilitados (rollback individual)
 */
export async function disableTenantForV2(tenantId: string): Promise<void> {
  const supabase = createClient();
  const flags = await getVoiceAgentV2Flags();

  await supabase
    .from('feature_flags')
    .update({
      disabled_tenants: [...flags.disabledTenants, tenantId]
    })
    .eq('name', 'voice_agent_v2');
}

function hashTenantId(tenantId: string): number {
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

### 4.2 Uso en Codigo

```typescript
// app/api/voice-agent/webhook/route.ts

import { shouldUseVoiceAgentV2 } from '@/lib/feature-flags/voice-agent-v2';
import { handleWebhookV1 } from '@/lib/voice-agent/v1/webhook-handler';
import { handleWebhookV2 } from '@/lib/voice-agent/v2/webhook-handler';

export async function POST(request: Request) {
  const body = await request.json();
  const businessId = extractBusinessId(body);

  // Determinar version a usar
  const useV2 = await shouldUseVoiceAgentV2(businessId);

  if (useV2) {
    return handleWebhookV2(request, body);
  } else {
    return handleWebhookV1(request, body);
  }
}
```

---

## 5. Monitoreo de Rollout

### 5.1 Dashboard de Rollout

```typescript
// components/admin/rollout-dashboard.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface RolloutStatus {
  percentage: number;
  tenantsOnV2: number;
  totalTenants: number;
  metrics: {
    v1: VersionMetrics;
    v2: VersionMetrics;
  };
  alerts: Alert[];
}

interface VersionMetrics {
  totalCalls: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
}

export function RolloutDashboard({ status }: { status: RolloutStatus }) {
  const isHealthy = status.metrics.v2.errorRate < 0.02 &&
                    status.metrics.v2.p95Latency < 800;

  return (
    <div className="space-y-6">
      {/* Rollout Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Rollout Progress
            <Badge variant={isHealthy ? 'default' : 'destructive'}>
              {isHealthy ? 'Healthy' : 'Issues Detected'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>V2 Rollout: {status.percentage}%</span>
                <span>{status.tenantsOnV2} / {status.totalTenants} tenants</span>
              </div>
              <Progress value={status.percentage} />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateRollout(status.percentage + 10)}
                disabled={status.percentage >= 100 || !isHealthy}
              >
                +10%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateRollout(status.percentage + 25)}
                disabled={status.percentage >= 75 || !isHealthy}
              >
                +25%
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => updateRollout(0)}
              >
                Rollback to 0%
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <MetricsCard title="V1 (Legacy)" metrics={status.metrics.v1} />
        <MetricsCard title="V2 (New)" metrics={status.metrics.v2} highlight />
      </div>

      {/* Alerts */}
      {status.alerts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {status.alerts.map((alert, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-destructive" />
                  {alert.message}
                  <span className="text-muted-foreground">
                    ({new Date(alert.timestamp).toLocaleTimeString()})
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricsCard({ title, metrics, highlight = false }) {
  return (
    <Card className={highlight ? 'border-primary' : ''}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <MetricItem
            label="Total Calls"
            value={metrics.totalCalls.toLocaleString()}
          />
          <MetricItem
            label="Error Rate"
            value={`${(metrics.errorRate * 100).toFixed(2)}%`}
            status={metrics.errorRate < 0.02 ? 'good' : 'bad'}
          />
          <MetricItem
            label="Avg Latency"
            value={`${metrics.avgLatency}ms`}
            status={metrics.avgLatency < 500 ? 'good' : 'warning'}
          />
          <MetricItem
            label="p95 Latency"
            value={`${metrics.p95Latency}ms`}
            status={metrics.p95Latency < 800 ? 'good' : 'bad'}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

### 5.2 Alertas Automaticas

```typescript
// lib/monitoring/rollout-alerts.ts

import { createClient } from '@/lib/supabase/server';
import { sendSlackAlert, sendPagerDutyAlert } from '@/lib/notifications';

interface RolloutMetrics {
  version: 'v1' | 'v2';
  errorRate: number;
  p95Latency: number;
  circuitBreakerOpens: number;
}

const THRESHOLDS = {
  errorRate: {
    warning: 0.02,
    critical: 0.05
  },
  p95Latency: {
    warning: 800,
    critical: 1200
  },
  circuitBreakerOpens: {
    warning: 1,
    critical: 3
  }
};

/**
 * Verificar metricas y enviar alertas si es necesario
 */
export async function checkRolloutHealth(): Promise<void> {
  const metrics = await getRolloutMetrics();

  // Verificar error rate
  if (metrics.v2.errorRate > THRESHOLDS.errorRate.critical) {
    await sendCriticalAlert({
      title: 'Voice Agent V2: Critical Error Rate',
      message: `Error rate is ${(metrics.v2.errorRate * 100).toFixed(2)}% (threshold: 5%)`,
      action: 'Consider immediate rollback'
    });
  } else if (metrics.v2.errorRate > THRESHOLDS.errorRate.warning) {
    await sendWarningAlert({
      title: 'Voice Agent V2: High Error Rate',
      message: `Error rate is ${(metrics.v2.errorRate * 100).toFixed(2)}% (threshold: 2%)`
    });
  }

  // Verificar latencia
  if (metrics.v2.p95Latency > THRESHOLDS.p95Latency.critical) {
    await sendCriticalAlert({
      title: 'Voice Agent V2: Critical Latency',
      message: `p95 latency is ${metrics.v2.p95Latency}ms (threshold: 1200ms)`,
      action: 'Consider immediate rollback'
    });
  } else if (metrics.v2.p95Latency > THRESHOLDS.p95Latency.warning) {
    await sendWarningAlert({
      title: 'Voice Agent V2: High Latency',
      message: `p95 latency is ${metrics.v2.p95Latency}ms (threshold: 800ms)`
    });
  }

  // Verificar circuit breakers
  if (metrics.v2.circuitBreakerOpens > THRESHOLDS.circuitBreakerOpens.critical) {
    await sendCriticalAlert({
      title: 'Voice Agent V2: Multiple Circuit Breaker Opens',
      message: `${metrics.v2.circuitBreakerOpens} circuit breakers opened in last hour`,
      action: 'Immediate investigation required'
    });
  }
}

async function sendCriticalAlert(alert: { title: string; message: string; action?: string }) {
  // Enviar a multiples canales para alertas criticas
  await Promise.all([
    sendSlackAlert({ ...alert, channel: '#voice-agent-alerts', severity: 'critical' }),
    sendPagerDutyAlert({ ...alert, severity: 'critical' })
  ]);

  // Log para auditoria
  const supabase = createClient();
  await supabase.from('rollout_alerts').insert({
    type: 'critical',
    title: alert.title,
    message: alert.message,
    action: alert.action
  });
}

async function sendWarningAlert(alert: { title: string; message: string }) {
  await sendSlackAlert({ ...alert, channel: '#voice-agent-alerts', severity: 'warning' });

  const supabase = createClient();
  await supabase.from('rollout_alerts').insert({
    type: 'warning',
    title: alert.title,
    message: alert.message
  });
}
```

---

## 6. Rollback Plan

### 6.1 Procedimiento de Rollback

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLLBACK PROCEDURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NIVEL 1: ROLLBACK INDIVIDUAL (Tenant Especifico)               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Trigger: Queja de usuario o error en tenant especifico  │   │
│  │ Accion: disableTenantForV2(tenantId)                    │   │
│  │ Tiempo: < 1 minuto                                      │   │
│  │ Impacto: Solo el tenant afectado                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  NIVEL 2: ROLLBACK PARCIAL (Reducir Porcentaje)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Trigger: Error rate > 2% o latencia > 800ms             │   │
│  │ Accion: Reducir porcentaje (ej: 50% → 25%)              │   │
│  │ Tiempo: < 1 minuto                                      │   │
│  │ Impacto: Algunos tenants vuelven a V1                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  NIVEL 3: ROLLBACK TOTAL (Emergency)                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Trigger: Error rate > 5% o fallo critico                │   │
│  │ Accion: updateRolloutPercentage(0)                      │   │
│  │ Tiempo: < 1 minuto                                      │   │
│  │ Impacto: Todos los tenants vuelven a V1                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  NIVEL 4: ROLLBACK DE DATOS (Ultima Opcion)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Trigger: Corrupcion de datos o problema grave           │   │
│  │ Accion: Restaurar desde backup                          │   │
│  │ Tiempo: 15-30 minutos                                   │   │
│  │ Impacto: Perdida de datos desde ultimo backup           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Script de Rollback

```typescript
// scripts/rollback-voice-agent-v2.ts

import { program } from 'commander';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

program
  .option('--level <level>', 'Rollback level: tenant|partial|total|data', 'total')
  .option('--tenant-id <id>', 'Tenant ID for level=tenant')
  .option('--percentage <number>', 'New percentage for level=partial')
  .option('--backup-id <id>', 'Backup ID for level=data')
  .parse();

async function main() {
  const opts = program.opts();

  console.log('='.repeat(60));
  console.log(`VOICE AGENT V2 ROLLBACK - Level: ${opts.level.toUpperCase()}`);
  console.log('='.repeat(60));

  switch (opts.level) {
    case 'tenant':
      await rollbackTenant(opts.tenantId);
      break;
    case 'partial':
      await rollbackPartial(parseInt(opts.percentage));
      break;
    case 'total':
      await rollbackTotal();
      break;
    case 'data':
      await rollbackData(opts.backupId);
      break;
    default:
      console.error('Invalid rollback level');
      process.exit(1);
  }
}

async function rollbackTenant(tenantId: string) {
  if (!tenantId) {
    console.error('--tenant-id required for tenant rollback');
    process.exit(1);
  }

  console.log(`Rolling back tenant: ${tenantId}`);

  // Agregar a lista de deshabilitados
  const { data: flags } = await supabase
    .from('feature_flags')
    .select('disabled_tenants')
    .eq('name', 'voice_agent_v2')
    .single();

  const disabledTenants = flags?.disabled_tenants || [];

  await supabase
    .from('feature_flags')
    .update({
      disabled_tenants: [...disabledTenants, tenantId]
    })
    .eq('name', 'voice_agent_v2');

  console.log(`✓ Tenant ${tenantId} rolled back to V1`);
}

async function rollbackPartial(percentage: number) {
  if (isNaN(percentage) || percentage < 0 || percentage > 100) {
    console.error('Invalid percentage');
    process.exit(1);
  }

  console.log(`Reducing rollout to ${percentage}%`);

  await supabase
    .from('feature_flags')
    .update({ percentage })
    .eq('name', 'voice_agent_v2');

  console.log(`✓ Rollout reduced to ${percentage}%`);
}

async function rollbackTotal() {
  console.log('Executing TOTAL rollback - all tenants to V1');

  await supabase
    .from('feature_flags')
    .update({
      percentage: 0,
      enabled: false
    })
    .eq('name', 'voice_agent_v2');

  console.log('✓ Total rollback complete - all tenants on V1');
}

async function rollbackData(backupId: string) {
  if (!backupId) {
    // Listar backups disponibles
    const { data: backups } = await supabase
      .from('migration_backups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('Available backups:');
    backups?.forEach(b => {
      console.log(`  ${b.id}: ${b.created_at} (${b.tables.join(', ')})`);
    });

    console.error('\n--backup-id required for data rollback');
    process.exit(1);
  }

  console.log(`Restoring from backup: ${backupId}`);
  console.log('⚠ WARNING: This will overwrite current data!');

  // Confirmar
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise<string>(resolve => {
    rl.question('Type "CONFIRM" to proceed: ', resolve);
  });

  if (answer !== 'CONFIRM') {
    console.log('Rollback cancelled');
    process.exit(0);
  }

  // Ejecutar restauracion
  const { error } = await supabase.rpc('restore_from_backup', {
    backup_id: backupId
  });

  if (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }

  console.log('✓ Data restored from backup');
}

main();
```

---

## 7. Comunicacion

### 7.1 Templates de Comunicacion

```markdown
# Email: Pre-Rollout Notification

**Subject:** Mejoras en Voice Agent - Actualizacion Programada

Estimado cliente,

Nos complace informarle que estaremos implementando mejoras significativas
en el sistema de Voice Agent durante los proximos dias.

**Que esperar:**
- Respuestas mas rapidas y naturales
- Mejor manejo de reservaciones/citas
- Nueva interfaz de configuracion

**Impacto:**
- No se requiere ninguna accion de su parte
- El servicio continuara funcionando normalmente
- Mejoras se aplicaran automaticamente

Si tiene preguntas, contactenos a soporte@tistis.com

Saludos,
El equipo de TIS TIS
```

```markdown
# Slack: Rollout Status Update

:rocket: **Voice Agent V2 Rollout Update**

**Status:** :green_circle: Healthy
**Progress:** 50% (45/90 tenants)
**Duration:** 3 days

**Metrics (V2):**
- Error Rate: 0.8% (target <2%)
- p95 Latency: 650ms (target <800ms)
- Calls Today: 1,234

**Next Step:** Expand to 75% in 24 hours if metrics stable

:eyes: @oncall-eng
```

```markdown
# Slack: Rollback Alert

:rotating_light: **URGENT: Voice Agent V2 Rollback Initiated**

**Trigger:** Error rate exceeded 5%
**Action:** Rolled back to 0%
**Time:** 2024-01-20 14:35 UTC

**Impact:**
- All tenants now on V1
- No customer impact expected

**Next Steps:**
1. Investigate root cause
2. Fix identified issues
3. Plan re-rollout

:sos: @voice-agent-team @engineering-leads
```

---

## 8. Post-Rollout

### 8.1 Checklist Post-Rollout

```markdown
# Checklist Post-Rollout Voice Agent V2

## Dia 1 Post-Rollout Completo

### Verificacion Tecnica
- [ ] Todas las metricas dentro de targets
- [ ] No hay alertas activas
- [ ] Circuit breakers en estado CLOSED
- [ ] Logs sin errores criticos

### Verificacion Funcional
- [ ] Llamadas de prueba exitosas
- [ ] Reservaciones se crean correctamente
- [ ] Citas se crean correctamente
- [ ] Transferencia a humano funciona

### Comunicacion
- [ ] Email de confirmacion enviado a clientes
- [ ] Documentacion actualizada
- [ ] Equipo de soporte informado

## Semana 1 Post-Rollout

### Monitoreo
- [ ] Revision diaria de metricas
- [ ] Analisis de feedback de usuarios
- [ ] Comparacion V1 vs V2

### Limpieza
- [ ] Feature flags removidos
- [ ] Codigo V1 deprecado
- [ ] Tablas antiguas marcadas para eliminacion

### Documentacion
- [ ] Retrospectiva completada
- [ ] Lecciones aprendidas documentadas
- [ ] Runbooks actualizados

## Semana 4 Post-Rollout

### Eliminacion Legacy
- [ ] Codigo V1 eliminado
- [ ] Tablas backup eliminadas
- [ ] Feature flags eliminados del codigo

### Metricas Finales
- [ ] Reporte de mejoras documentado
- [ ] ROI calculado
- [ ] Presentacion a stakeholders
```

### 8.2 Metricas de Exito

| Metrica | Antes (V1) | Despues (V2) | Mejora |
|---------|------------|--------------|--------|
| Latencia p50 | ~700ms | <500ms | 28% |
| Latencia p95 | ~1200ms | <800ms | 33% |
| Error Rate | ~3% | <2% | 33% |
| Reservaciones/dia | X | X+Y% | Y% |
| NPS Score | X | X+Z | +Z |

---

**Documento creado:** Enero 2024
**Ultima actualizacion:** Enero 2024
**Version:** 1.0.0
