# Voice Agent v2.0 - Guía de Migración

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Pre-requisitos](#2-pre-requisitos)
3. [Arquitectura de Migración](#3-arquitectura-de-migración)
4. [Proceso de Migración](#4-proceso-de-migración)
5. [Feature Flags y Rollout Gradual](#5-feature-flags-y-rollout-gradual)
6. [Validación](#6-validación)
7. [Rollback](#7-rollback)
8. [Troubleshooting](#8-troubleshooting)
9. [Checklist de Migración](#9-checklist-de-migración)

---

## 1. Resumen Ejecutivo

Este documento describe el proceso de migración de Voice Agent v1.0 a v2.0. La migración incluye:

- **Transformación de datos**: Conversión de esquema v1 a v2
- **Rollout gradual**: Sistema de feature flags por porcentaje y tenant
- **Validación automática**: Verificación de integridad de datos
- **Rollback multinivel**: 4 niveles de rollback según severidad

### Cambios Principales v1 → v2

| Aspecto | v1 | v2 |
|---------|----|----|
| Esquema de configuración | Flat | Estructurado por dominios |
| Tipos de asistente | Implícito | Explícito (inbound/outbound/hybrid) |
| Capacidades | En prompt | Array tipado |
| Métricas | Por llamada | Agregadas con percentiles |
| Outcomes | Manual | Inferido automáticamente |

---

## 2. Pre-requisitos

### 2.1 Requisitos del Sistema

```bash
# Node.js 18+
node --version  # >= 18.0.0

# TypeScript 5+
npx tsc --version  # >= 5.0.0

# Acceso a Supabase
# Variables de entorno configuradas
```

### 2.2 Variables de Entorno Requeridas

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Opcional para notificaciones
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
MIGRATION_ADMIN_EMAIL=admin@tistis.com
```

### 2.3 Permisos Necesarios

- Acceso de lectura/escritura a tablas de configuración
- Acceso de lectura a tablas de llamadas
- Permisos para crear backups
- Acceso al sistema de feature flags

### 2.4 Backups Pre-migración

**IMPORTANTE**: Realizar backup completo de base de datos antes de iniciar.

```bash
# Backup manual recomendado via Supabase Dashboard
# O usando pg_dump si tienes acceso directo
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 3. Arquitectura de Migración

### 3.1 Componentes

```
scripts/migration/
├── migrate-voice-agent-v2.ts    # Script principal de migración
├── validate-migration.ts         # Validación de datos migrados
├── rollback-migration.ts         # Rollback multinivel
└── MIGRATION-README.md           # Esta documentación

lib/feature-flags/
├── voice-agent-v2.ts             # Feature flags para rollout
└── index.ts                      # Exports del módulo
```

### 3.2 Flujo de Migración

```
┌─────────────────┐
│   Dry Run       │ ← Verificar cambios sin modificar
└────────┬────────┘
         ▼
┌─────────────────┐
│  Create Backup  │ ← Backup automático con timestamp
└────────┬────────┘
         ▼
┌─────────────────┐
│ Validate v1     │ ← Verificar datos actuales
└────────┬────────┘
         ▼
┌─────────────────┐
│ Transform Data  │ ← Migrar configuraciones
└────────┬────────┘
         ▼
┌─────────────────┐
│ Update Outcomes │ ← Inferir outcomes de llamadas
└────────┬────────┘
         ▼
┌─────────────────┐
│ Generate Metrics│ ← Calcular métricas agregadas
└────────┬────────┘
         ▼
┌─────────────────┐
│ Verify Migration│ ← Validación post-migración
└────────┬────────┘
         ▼
┌─────────────────┐
│ Enable Flags    │ ← Activar rollout gradual
└─────────────────┘
```

### 3.3 Esquema de Datos

#### Configuración v1 (Original)
```typescript
interface VoiceAgentConfigV1 {
  id: string;
  tenant_id: string;
  name: string;
  prompt: string;
  voice_id: string;
  language: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

#### Configuración v2 (Nueva)
```typescript
interface VoiceAgentConfigV2 {
  id: string;
  tenant_id: string;

  // Identificación
  name: string;
  assistant_type: 'inbound' | 'outbound' | 'hybrid';

  // Configuración de voz
  voice_config: {
    voice_id: string;
    language: string;
    speed?: number;
    pitch?: number;
  };

  // Personalidad
  personality: {
    base_prompt: string;
    special_instructions?: string[];
    greeting_message?: string;
    farewell_message?: string;
  };

  // Capacidades
  capabilities: string[];

  // Estado
  enabled: boolean;
  schema_version: 'v2';

  // Metadata de migración
  migrated_at?: string;
  migrated_from?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

---

## 4. Proceso de Migración

### 4.1 Paso 1: Dry Run

Siempre ejecutar primero en modo dry-run para verificar cambios:

```bash
# Dry run completo
npx ts-node scripts/migration/migrate-voice-agent-v2.ts --dry-run --verbose

# Dry run para tenants específicos
npx ts-node scripts/migration/migrate-voice-agent-v2.ts \
  --dry-run \
  --tenant-ids tenant1,tenant2 \
  --verbose
```

**Output esperado:**
```
🔍 Migration Preview (Dry Run)
==============================
Configurations to migrate: 45
Calls to update: 1,234
Metrics to generate: 45

⚠️  No changes will be made in dry-run mode
```

### 4.2 Paso 2: Migración Real

```bash
# Migración completa
npx ts-node scripts/migration/migrate-voice-agent-v2.ts --verbose

# Migración por lotes (recomendado para bases grandes)
npx ts-node scripts/migration/migrate-voice-agent-v2.ts \
  --batch-size 50 \
  --verbose

# Migración de tenants específicos
npx ts-node scripts/migration/migrate-voice-agent-v2.ts \
  --tenant-ids tenant1,tenant2,tenant3 \
  --verbose
```

### 4.3 Opciones del Script de Migración

| Opción | Descripción | Default |
|--------|-------------|---------|
| `--dry-run` | Simular sin hacer cambios | false |
| `--batch-size <n>` | Registros por lote | 100 |
| `--tenant-ids <ids>` | IDs separados por coma | todos |
| `--skip-backup` | Omitir backup (no recomendado) | false |
| `--verbose` | Logs detallados | false |

### 4.4 Monitoreo Durante Migración

El script muestra progreso en tiempo real:

```
📦 Migration Progress
=====================
[====================] 100% | 45/45 configs
[==================  ]  90% | 1111/1234 calls
[================    ]  80% | 36/45 metrics

⏱️  Elapsed: 2m 34s
📊 Rate: ~8 records/sec
```

---

## 5. Feature Flags y Rollout Gradual

### 5.1 Estructura de Feature Flags

```typescript
interface VoiceAgentV2Flags {
  enabled: boolean;           // Master switch
  rollout_percentage: number; // 0-100
  tenant_overrides: {
    [tenantId: string]: boolean;
  };
  updated_at: string;
  updated_by: string;
}
```

### 5.2 Estrategia de Rollout Recomendada

```
Día 1:   5% rollout  → Monitorear 24h
Día 2:  10% rollout  → Monitorear 24h
Día 3:  25% rollout  → Monitorear 24h
Día 5:  50% rollout  → Monitorear 48h
Día 7:  75% rollout  → Monitorear 48h
Día 10: 100% rollout → Monitoreo continuo
```

### 5.3 Comandos de Rollout

```typescript
import {
  updateRolloutPercentage,
  enableTenantForV2,
  disableTenantForV2,
  getRolloutStatus,
} from '@/lib/feature-flags';

// Verificar estado actual
const status = await getRolloutStatus();
console.log(status);
// { enabled: true, percentage: 25, tenantsInV2: 123, totalTenants: 500 }

// Aumentar rollout
await updateRolloutPercentage(50, 'admin@tistis.com');

// Forzar tenant específico a v2
await enableTenantForV2('tenant-premium-1', 'admin@tistis.com');

// Excluir tenant de v2
await disableTenantForV2('tenant-problematic', 'admin@tistis.com');
```

### 5.4 Uso en Código

```typescript
import { shouldUseVoiceAgentV2Cached } from '@/lib/feature-flags';

async function handleWebhook(tenantId: string, payload: WebhookPayload) {
  const useV2 = await shouldUseVoiceAgentV2Cached(tenantId);

  if (useV2) {
    return handleWebhookV2(tenantId, payload);
  } else {
    return handleWebhookV1(tenantId, payload);
  }
}
```

### 5.5 Monitoreo de Rollout

```typescript
import { getRolloutStatus } from '@/lib/feature-flags';

// Dashboard de estado
const status = await getRolloutStatus();

console.log(`
Voice Agent v2 Rollout Status
=============================
Enabled: ${status.enabled}
Percentage: ${status.percentage}%
Tenants in v2: ${status.tenantsInV2} / ${status.totalTenants}
Version Metrics:
  - v1 calls (24h): ${status.metrics?.v1Calls || 'N/A'}
  - v2 calls (24h): ${status.metrics?.v2Calls || 'N/A'}
  - v2 error rate: ${status.metrics?.v2ErrorRate || 'N/A'}%
`);
```

---

## 6. Validación

### 6.1 Ejecutar Validación

```bash
# Validación completa
npx ts-node scripts/migration/validate-migration.ts

# Validación con auto-fix de issues menores
npx ts-node scripts/migration/validate-migration.ts --fix

# Validación de tenants específicos
npx ts-node scripts/migration/validate-migration.ts --tenant-ids tenant1,tenant2
```

### 6.2 Checks de Validación

| Check | Descripción | Severidad |
|-------|-------------|-----------|
| Record Count | Conteo de registros migrados | Critical |
| Data Integrity | Campos requeridos presentes | Critical |
| Foreign Keys | Referencias válidas | Critical |
| Schema Version | Todos en v2 | High |
| Duplicates | Sin duplicados | Medium |
| Value Constraints | Valores en rangos válidos | Medium |

### 6.3 Interpretar Resultados

```
✅ Validation Complete
======================
Total Checks: 8
Passed: 8
Failed: 0
Warnings: 2

⚠️  Warnings:
- 3 configs with empty special_instructions (auto-fixed)
- 12 calls with legacy outcome format

✅ Migration validated successfully!
```

### 6.4 Validación Manual Recomendada

```sql
-- Verificar conteo de configuraciones migradas
SELECT
  schema_version,
  COUNT(*) as count
FROM voice_agent_configs
GROUP BY schema_version;

-- Verificar distribución de tipos de asistente
SELECT
  assistant_type,
  COUNT(*) as count
FROM voice_agent_configs
WHERE schema_version = 'v2'
GROUP BY assistant_type;

-- Verificar métricas generadas
SELECT
  tenant_id,
  total_calls,
  avg_duration_seconds,
  p95_latency_ms
FROM voice_agent_metrics
ORDER BY total_calls DESC
LIMIT 10;
```

---

## 7. Rollback

### 7.1 Niveles de Rollback

| Nivel | Uso | Impacto |
|-------|-----|---------|
| `tenant` | Un tenant tiene problemas | Mínimo |
| `partial` | Varios tenants afectados | Bajo |
| `total` | Problemas sistémicos | Alto |
| `data` | Corrupción de datos | Crítico |

### 7.2 Rollback de Tenant Individual

```bash
# Deshabilitar v2 para un tenant específico
npx ts-node scripts/migration/rollback-migration.ts \
  --level tenant \
  --tenant-id tenant-problematic
```

### 7.3 Rollback Parcial (Reducir Porcentaje)

```bash
# Reducir rollout de 50% a 10%
npx ts-node scripts/migration/rollback-migration.ts \
  --level partial \
  --target-percentage 10
```

### 7.4 Rollback Total (Emergencia)

```bash
# Deshabilitar v2 completamente
npx ts-node scripts/migration/rollback-migration.ts \
  --level total \
  --reason "Critical bug in webhook handling"
```

### 7.5 Rollback de Datos (Restaurar Backup)

```bash
# Restaurar desde backup específico
npx ts-node scripts/migration/rollback-migration.ts \
  --level data \
  --backup-id backup_20240115_143022
```

**⚠️ ADVERTENCIA**: El rollback de datos es destructivo y requiere confirmación manual.

### 7.6 Verificar Backups Disponibles

```bash
# Listar backups disponibles
npx ts-node scripts/migration/rollback-migration.ts --list-backups
```

Output:
```
Available Backups
=================
1. backup_20240115_143022 (45 configs, 1234 calls) - 2h ago
2. backup_20240114_091534 (44 configs, 1200 calls) - 1d ago
3. backup_20240113_082211 (44 configs, 1150 calls) - 2d ago
```

---

## 8. Troubleshooting

### 8.1 Errores Comunes

#### Error: "Connection timeout"
```bash
# Aumentar timeout de conexión
SUPABASE_TIMEOUT=60000 npx ts-node scripts/migration/migrate-voice-agent-v2.ts
```

#### Error: "Batch too large"
```bash
# Reducir tamaño de batch
npx ts-node scripts/migration/migrate-voice-agent-v2.ts --batch-size 25
```

#### Error: "Duplicate key"
```bash
# Verificar duplicados antes de migrar
npx ts-node scripts/migration/validate-migration.ts --check duplicates
```

#### Error: "Foreign key violation"
```sql
-- Identificar registros huérfanos
SELECT c.id, c.tenant_id
FROM voice_agent_configs c
LEFT JOIN tenants t ON c.tenant_id = t.id
WHERE t.id IS NULL;
```

### 8.2 Performance Issues

#### Migración Lenta
```bash
# Usar batches más pequeños y paralelismo limitado
npx ts-node scripts/migration/migrate-voice-agent-v2.ts \
  --batch-size 25 \
  --verbose
```

#### Alto Uso de Memoria
```bash
# Aumentar memoria de Node
NODE_OPTIONS="--max-old-space-size=4096" npx ts-node scripts/migration/migrate-voice-agent-v2.ts
```

### 8.3 Logs y Debugging

```bash
# Habilitar logs detallados
DEBUG=migration:* npx ts-node scripts/migration/migrate-voice-agent-v2.ts --verbose

# Guardar logs a archivo
npx ts-node scripts/migration/migrate-voice-agent-v2.ts --verbose 2>&1 | tee migration.log
```

### 8.4 Contacto de Soporte

Para issues críticos durante migración:
- Slack: #voice-agent-migration
- Email: platform-team@tistis.com
- On-call: Ver PagerDuty

---

## 9. Checklist de Migración

### Pre-Migración
- [ ] Backup de base de datos completo realizado
- [ ] Variables de entorno configuradas
- [ ] Dry run ejecutado sin errores
- [ ] Equipo notificado de ventana de migración
- [ ] Monitoreo y alertas configurados

### Durante Migración
- [ ] Migración iniciada en horario de bajo tráfico
- [ ] Logs monitoreados en tiempo real
- [ ] Métricas de sistema estables
- [ ] Sin errores críticos reportados

### Post-Migración
- [ ] Validación ejecutada y pasando
- [ ] Feature flags configurados correctamente
- [ ] Rollout inicial (5%) activado
- [ ] Pruebas manuales de flujos críticos
- [ ] Documentación de incidentes (si aplica)

### Rollout Gradual
- [ ] 5% - 24h sin incidentes
- [ ] 10% - 24h sin incidentes
- [ ] 25% - 24h sin incidentes
- [ ] 50% - 48h sin incidentes
- [ ] 75% - 48h sin incidentes
- [ ] 100% - Migración completa

### Cierre
- [ ] Backups de v1 archivados
- [ ] Documentación actualizada
- [ ] Retrospectiva realizada
- [ ] Cleanup de código legacy planificado

---

## Apéndices

### A. Comandos Rápidos

```bash
# Dry run
npx ts-node scripts/migration/migrate-voice-agent-v2.ts --dry-run

# Migrar
npx ts-node scripts/migration/migrate-voice-agent-v2.ts --verbose

# Validar
npx ts-node scripts/migration/validate-migration.ts

# Ver estado de rollout
npx ts-node -e "import('@/lib/feature-flags').then(m => m.getRolloutStatus().then(console.log))"

# Rollback de emergencia
npx ts-node scripts/migration/rollback-migration.ts --level total --reason "Emergency"
```

### B. SQL Útiles

```sql
-- Estado de migración
SELECT
  schema_version,
  COUNT(*) as configs,
  COUNT(DISTINCT tenant_id) as tenants
FROM voice_agent_configs
GROUP BY schema_version;

-- Tenants sin migrar
SELECT DISTINCT tenant_id
FROM voice_agent_configs
WHERE schema_version IS NULL OR schema_version != 'v2';

-- Métricas de v2
SELECT
  DATE(created_at) as date,
  COUNT(*) as calls,
  AVG(duration_seconds) as avg_duration
FROM voice_agent_calls
WHERE version = 'v2'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### C. Diagrama de Estados

```
                    ┌─────────────┐
                    │   v1 Only   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Migration  │
                    │   Started   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐     │     ┌──────▼──────┐
       │   Rollback  │     │     │   Partial   │
       │   to v1     │     │     │   Rollout   │
       └─────────────┘     │     └──────┬──────┘
                           │            │
                    ┌──────▼──────┐     │
                    │    Full     │◄────┘
                    │   Rollout   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  v1 Sunset  │
                    └─────────────┘
```

---

**Documento creado:** FASE 14 Voice Agent v2.0
**Última actualización:** Enero 2024
**Mantenido por:** Platform Team @ TIS TIS
