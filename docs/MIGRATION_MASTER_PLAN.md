# TIS TIS Platform - Plan Maestro de Migración e Integración

## Documento de Control

| Campo | Valor |
|-------|-------|
| **Versión** | 1.0.0 |
| **Fecha** | 2026-01-21 |
| **Autor** | Claude Code (Asistido) |
| **Estado** | En Planificación |
| **Ambiente Actual** | Solo usuario principal (desarrollo/staging) |

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura Actual vs Objetivo](#2-arquitectura-actual-vs-objetivo)
3. [Fases de Implementación](#3-fases-de-implementación)
4. [Matriz de Riesgos](#4-matriz-de-riesgos)
5. [Criterios de Éxito](#5-criterios-de-éxito)
6. [Rollback Plan](#6-rollback-plan)

---

## 1. Resumen Ejecutivo

### 1.1 Objetivo
Integrar de manera segura y gradual los módulos de infraestructura mejorados al sistema TIS TIS sin afectar la funcionalidad existente.

### 1.2 Módulos a Integrar

| Módulo | Propósito | Prioridad |
|--------|-----------|-----------|
| `structured-logger.ts` | Logging JSON estructurado para producción | 🟢 Alta (Bajo riesgo) |
| `env-validator.ts` | Validación de variables de entorno | 🟢 Alta (Bajo riesgo) |
| `rate-limit-unified.ts` | Rate limiting con Redis + fallback | 🟡 Media |
| `admin-auth.ts` | Autenticación centralizada para admin | 🟡 Media |

### 1.3 Principios de Migración

1. **Zero Downtime**: Ningún cambio debe causar interrupción del servicio
2. **Backwards Compatible**: El código antiguo sigue funcionando durante la transición
3. **Incremental**: Migrar endpoint por endpoint, no todo de golpe
4. **Reversible**: Cada cambio debe poder deshacerse en < 5 minutos
5. **Observable**: Logs claros de qué está usando cada endpoint

---

## 2. Arquitectura Actual vs Objetivo

### 2.1 Estado Actual

```
┌─────────────────────────────────────────────────────────────┐
│                    TIS TIS PLATFORM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │ /api/stripe │     │ /api/ai-*   │     │ /api/admin  │   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘   │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              rate-limit.ts (in-memory)              │   │
│  │              console.log (sin estructura)           │   │
│  │              verifyAdminKey (inline duplicado)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           MÓDULOS NUEVOS (NO CONECTADOS)            │   │
│  │  • rate-limit-unified.ts  ← Dormido                 │   │
│  │  • structured-logger.ts   ← Dormido                 │   │
│  │  • admin-auth.ts          ← Dormido                 │   │
│  │  • env-validator.ts       ← Dormido                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Estado Objetivo (Post-Migración)

```
┌─────────────────────────────────────────────────────────────┐
│                    TIS TIS PLATFORM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              env-validator.ts                         │  │
│  │         (Valida en startup, warn en dev)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │ /api/stripe │     │ /api/ai-*   │     │ /api/admin  │   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘   │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         rate-limit-unified.ts (Redis + Memory)      │   │
│  │         structured-logger.ts (JSON logs)            │   │
│  │         admin-auth.ts (centralizado)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Fases de Implementación

### Resumen de Fases

| Fase | Nombre | Duración Est. | Riesgo |
|------|--------|---------------|--------|
| 0 | Preparación y Backup | 30 min | 🟢 Ninguno |
| 1 | Structured Logger | 1-2 hrs | 🟢 Bajo |
| 2 | Env Validator | 1 hr | 🟢 Bajo |
| 3 | Rate Limit Unified | 2-3 hrs | 🟡 Medio |
| 4 | Admin Auth | 1-2 hrs | 🟡 Medio |
| 5 | Validación Final | 1 hr | 🟢 Bajo |

---

### FASE 0: Preparación y Backup

**Objetivo**: Crear punto de restauración seguro

**Documento detallado**: [FASE_0_PREPARACION.md](./phases/FASE_0_PREPARACION.md)

#### Microfases:

| # | Microfase | Acción | Comando/Archivo |
|---|-----------|--------|-----------------|
| 0.1 | Git Checkpoint | Crear branch de backup | `git checkout -b backup/pre-migration-$(date +%Y%m%d)` |
| 0.2 | Git Tag | Marcar versión estable | `git tag -a v1.0-stable -m "Pre-migration stable"` |
| 0.3 | Documentar Estado | Listar endpoints funcionando | Ejecutar health checks |
| 0.4 | Backup .env | Copiar configuración | `cp .env.local .env.backup` |

#### Criterios de Completitud:
- [ ] Branch de backup creado
- [ ] Tag de versión estable creado
- [ ] Lista de endpoints documentada
- [ ] .env respaldado

---

### FASE 1: Integración Structured Logger

**Objetivo**: Agregar logging JSON estructurado sin romper nada

**Documento detallado**: [FASE_1_STRUCTURED_LOGGER.md](./phases/FASE_1_STRUCTURED_LOGGER.md)

**Riesgo**: 🟢 BAJO - Solo agrega logs, no modifica lógica

#### Microfases:

| # | Microfase | Descripción | Archivos Afectados |
|---|-----------|-------------|-------------------|
| 1.1 | Logger Global | Crear instancia singleton | `instrumentation.ts` |
| 1.2 | Pilot Endpoint | Agregar a 1 endpoint no crítico | `/api/onboarding/status` |
| 1.3 | Validar Pilot | Verificar logs JSON en consola | Manual testing |
| 1.4 | Expandir Críticos | Agregar a Stripe webhooks | `/api/stripe/webhook` |
| 1.5 | Expandir General | Agregar a todos los endpoints | Todos los `/api/*` |

#### Patrón de Implementación:

```typescript
// ANTES (sin cambiar):
console.log('Webhook received:', event.type);

// DESPUÉS (agregar junto al anterior):
import { getLogger } from '@/src/shared/lib/structured-logger';
const logger = getLogger();

// Mantener console.log original + agregar structured
console.log('Webhook received:', event.type);
logger.info('Webhook received', {
  eventType: event.type,
  eventId: event.id
});
```

#### Criterios de Completitud:
- [ ] Logger funcionando en `/api/onboarding/status`
- [ ] Logs JSON visibles en consola
- [ ] Campos sensibles redactados automáticamente
- [ ] Sin errores en endpoints migrados

---

### FASE 2: Integración Env Validator

**Objetivo**: Validar variables de entorno al iniciar (solo warnings)

**Documento detallado**: [FASE_2_ENV_VALIDATOR.md](./phases/FASE_2_ENV_VALIDATOR.md)

**Riesgo**: 🟢 BAJO - Solo muestra warnings, no bloquea

#### Microfases:

| # | Microfase | Descripción | Archivos Afectados |
|---|-----------|-------------|-------------------|
| 2.1 | Crear instrumentation.ts | Archivo de startup de Next.js | `instrumentation.ts` |
| 2.2 | Modo Warning | Validar sin bloquear | Modificar `env-validator.ts` |
| 2.3 | Integrar | Llamar en startup | `instrumentation.ts` |
| 2.4 | Verificar | Reiniciar app y ver warnings | Manual testing |

#### Patrón de Implementación:

```typescript
// instrumentation.ts (NUEVO)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/src/shared/lib/env-validator');

    const result = validateEnvironment();

    // Solo warnings, NUNCA bloquear en esta fase
    if (result.warnings.length > 0) {
      console.warn('⚠️ [EnvValidator] Warnings:', result.warnings);
    }
    if (result.errors.length > 0) {
      console.error('❌ [EnvValidator] Errors (not blocking):', result.errors);
    }
  }
}
```

#### Criterios de Completitud:
- [ ] instrumentation.ts creado
- [ ] Warnings visibles al iniciar `npm run dev`
- [ ] App sigue iniciando aunque falten variables
- [ ] Lista clara de qué falta configurar

---

### FASE 3: Migración Rate Limit Unified

**Objetivo**: Migrar de rate-limit.ts a rate-limit-unified.ts gradualmente

**Documento detallado**: [FASE_3_RATE_LIMIT_UNIFIED.md](./phases/FASE_3_RATE_LIMIT_UNIFIED.md)

**Riesgo**: 🟡 MEDIO - Afecta protección de endpoints

#### Estrategia: Migración Shadow

Ejecutar AMBOS rate limiters en paralelo, comparar resultados, luego cambiar.

#### Microfases:

| # | Microfase | Descripción | Archivos Afectados |
|---|-----------|-------------|-------------------|
| 3.1 | Feature Flag | Crear flag para activar nuevo | `.env.local` |
| 3.2 | Wrapper Dual | Crear función que ejecuta ambos | Nuevo archivo |
| 3.3 | Pilot Endpoint | Migrar 1 endpoint no crítico | `/api/enterprise-contact` |
| 3.4 | Shadow Mode | Ejecutar ambos, loggear diferencias | Todos los endpoints |
| 3.5 | Validar Consistencia | Verificar que ambos dan mismo resultado | Análisis de logs |
| 3.6 | Migrar Críticos | Cambiar Stripe endpoints | `/api/stripe/*` |
| 3.7 | Migrar Resto | Cambiar todos los demás | Todos los `/api/*` |
| 3.8 | Deprecar Antiguo | Marcar rate-limit.ts como deprecated | Comentarios |

#### Patrón de Implementación (Shadow Mode):

```typescript
// lib/rate-limit-migration.ts (NUEVO)
import { checkRateLimit as checkOld } from '@/src/shared/lib/rate-limit';
import { checkUnifiedRateLimit as checkNew } from '@/src/shared/lib/rate-limit-unified';

export async function checkRateLimitWithShadow(
  key: string,
  config: RateLimitConfig
) {
  const useNew = process.env.USE_UNIFIED_RATE_LIMIT === 'true';

  // Siempre ejecutar el antiguo (source of truth por ahora)
  const oldResult = checkOld(key, config);

  // En shadow mode, también ejecutar el nuevo y comparar
  if (process.env.RATE_LIMIT_SHADOW_MODE === 'true') {
    const newResult = await checkNew(key, {
      ...config,
      identifier: config.identifier,
    });

    // Loggear si hay diferencias
    if (oldResult.success !== newResult.success) {
      console.warn('[RateLimit Shadow] Mismatch!', {
        key,
        old: oldResult,
        new: newResult,
      });
    }
  }

  // Retornar resultado según flag
  return useNew ? await checkNew(key, config) : oldResult;
}
```

#### Criterios de Completitud:
- [ ] Shadow mode funcionando sin errores
- [ ] 0 mismatches en 24 horas de uso
- [ ] Stripe endpoints migrados
- [ ] Todos los endpoints migrados
- [ ] rate-limit.ts marcado como deprecated

---

### FASE 4: Integración Admin Auth Centralizado

**Objetivo**: Reemplazar verificación inline por módulo centralizado

**Documento detallado**: [FASE_4_ADMIN_AUTH.md](./phases/FASE_4_ADMIN_AUTH.md)

**Riesgo**: 🟡 MEDIO - Afecta acceso a endpoints admin

#### Microfases:

| # | Microfase | Descripción | Archivos Afectados |
|---|-----------|-------------|-------------------|
| 4.1 | Inventario | Listar todos los admin endpoints | Análisis |
| 4.2 | Comparar Lógica | Verificar que admin-auth.ts cubre todos los casos | Código review |
| 4.3 | Pilot Endpoint | Migrar 1 endpoint admin no crítico | `/api/admin/seed-data` |
| 4.4 | Validar Acceso | Probar con key válida e inválida | Manual testing |
| 4.5 | Migrar Críticos | Migrar fix-rls, link-stripe | `/api/admin/*` |
| 4.6 | Migrar Resto | Migrar todos los demás | Todos los `/api/admin/*` |
| 4.7 | Eliminar Duplicados | Remover funciones verifyAdminKey inline | Cleanup |

#### Patrón de Implementación:

```typescript
// ANTES (en cada archivo):
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  // ... lógica duplicada ...
}

export async function POST(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}

// DESPUÉS (centralizado):
import { verifyAdminAuth } from '@/src/shared/lib/admin-auth';

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.response; // Ya incluye el error formateado
  }
  // ...
}
```

#### Criterios de Completitud:
- [ ] Todos los admin endpoints usando admin-auth.ts
- [ ] Rate limiting aplicado a admin endpoints
- [ ] Funciones verifyAdminKey inline eliminadas
- [ ] Tests pasando

---

### FASE 5: Validación Final y Documentación

**Objetivo**: Verificar que todo funciona y documentar estado final

**Documento detallado**: [FASE_5_VALIDACION.md](./phases/FASE_5_VALIDACION.md)

#### Microfases:

| # | Microfase | Descripción |
|---|-----------|-------------|
| 5.1 | Test Suite | Ejecutar todos los tests |
| 5.2 | Health Checks | Verificar todos los endpoints |
| 5.3 | Load Test Ligero | 100 requests a endpoints críticos |
| 5.4 | Revisar Logs | Verificar formato JSON correcto |
| 5.5 | Documentar | Actualizar README y docs |
| 5.6 | Git Tag | Crear tag v1.1-post-migration |

---

## 4. Matriz de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Rate limit bloquea usuarios válidos | Baja | Alto | Shadow mode primero |
| App no inicia por env validator | Media | Alto | Solo warnings, nunca bloquear |
| Admin pierde acceso | Baja | Alto | Probar con tu key antes de migrar |
| Logs llenan disco | Baja | Medio | Configurar log rotation |
| Redis no disponible | Media | Bajo | Fallback a memory automático |

---

## 5. Criterios de Éxito

### Por Fase:

| Fase | Criterio de Éxito |
|------|-------------------|
| 0 | Backup verificable creado |
| 1 | Logs JSON visibles, campos sensibles redactados |
| 2 | Warnings visibles, app no bloqueada |
| 3 | 0 mismatches en shadow mode por 24h |
| 4 | Admin endpoints funcionando con auth centralizado |
| 5 | Todos los tests pasando, 0 errores en logs |

### Globales:

- [ ] Zero downtime durante toda la migración
- [ ] Todos los endpoints responden < 500ms
- [ ] Rate limiting funciona correctamente
- [ ] Logs estructurados en todos los endpoints críticos
- [ ] Código legacy marcado como deprecated

---

## 6. Rollback Plan

### Rollback Inmediato (< 5 minutos):

```bash
# Si algo sale muy mal durante una fase:
git checkout backup/pre-migration-YYYYMMDD
npm run build
# Redeploy
```

### Rollback por Módulo:

| Módulo | Cómo revertir |
|--------|---------------|
| Structured Logger | Eliminar imports, volver a console.log |
| Env Validator | Eliminar instrumentation.ts |
| Rate Limit | Cambiar flag `USE_UNIFIED_RATE_LIMIT=false` |
| Admin Auth | Restaurar funciones verifyAdminKey inline |

### Contacto de Emergencia:

Si algo se rompe y no puedes revertir:
1. Revisar este documento
2. Consultar los docs de cada fase
3. Buscar en los commits el estado anterior

---

## Siguiente Paso

**Proceder a**: [FASE_0_PREPARACION.md](./phases/FASE_0_PREPARACION.md)

---

*Documento generado siguiendo estándares de documentación de infraestructura de software empresarial.*
