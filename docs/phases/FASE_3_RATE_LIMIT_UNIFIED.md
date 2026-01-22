# FASE 3: Migración Rate Limit Unified

## Información de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 3 - Rate Limit Unified |
| **Duración Estimada** | 2-3 horas |
| **Riesgo** | 🟡 MEDIO |
| **Prerrequisitos** | Fases 0-2 completadas |
| **Resultado** | Rate limiting con Redis + fallback memory |

---

## Objetivo

Migrar de `rate-limit.ts` (in-memory simple) a `rate-limit-unified.ts` (Redis + fallback) de manera gradual y segura:

1. Usar modo "shadow" para comparar ambos sistemas
2. Migrar endpoint por endpoint
3. No perder protección en ningún momento
4. Fallback automático si Redis no está disponible

---

## ¿Por Qué es Riesgo Medio?

| Factor | Riesgo | Mitigación |
|--------|--------|------------|
| Bloqueo de usuarios legítimos | 🟡 | Shadow mode compara antes de migrar |
| No bloqueo de usuarios maliciosos | 🟡 | Fallback a memory si Redis falla |
| Comportamiento diferente | 🟡 | Tests extensivos en cada endpoint |

---

## Arquitectura de la Migración

```
                    ┌─────────────────────────┐
                    │      API Request        │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   rate-limit-wrapper    │
                    │   (nuevo, controla)     │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
    ┌─────────▼─────────┐     │     ┌───────────▼───────────┐
    │  rate-limit.ts    │     │     │ rate-limit-unified.ts │
    │  (ACTUAL)         │     │     │ (NUEVO)               │
    │  ✓ Source of truth│     │     │ ◇ Shadow mode         │
    └───────────────────┘     │     └───────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Compare Results  │
                    │  Log Differences  │
                    └───────────────────┘
```

---

## Microfases

### 3.1 Crear Wrapper de Migración

**Objetivo**: Crear un wrapper que controla qué rate limiter usar

#### Archivo: `src/shared/lib/rate-limit-migration.ts` (NUEVO)

```typescript
/**
 * TIS TIS Platform - Rate Limit Migration Wrapper
 *
 * Este wrapper permite migrar gradualmente de rate-limit.ts a rate-limit-unified.ts.
 * Soporta "shadow mode" para comparar ambos sistemas sin afectar usuarios.
 */

import {
  checkRateLimit as checkOldRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit';

import {
  checkUnifiedRateLimit,
  type UnifiedRateLimitConfig,
  type UnifiedRateLimitResult,
} from './rate-limit-unified';

import { getLogger } from './structured-logger';

const logger = getLogger();

// Flags de control (configurables via env)
const USE_NEW_RATE_LIMIT = process.env.USE_UNIFIED_RATE_LIMIT === 'true';
const SHADOW_MODE = process.env.RATE_LIMIT_SHADOW_MODE === 'true';
const LOG_COMPARISONS = process.env.RATE_LIMIT_LOG_COMPARISONS === 'true';

/**
 * Rate limit con soporte de migración gradual
 *
 * Comportamiento según flags:
 * - Default: Usa rate-limit.ts (antiguo)
 * - SHADOW_MODE=true: Ejecuta ambos, compara, usa resultado del antiguo
 * - USE_UNIFIED_RATE_LIMIT=true: Usa rate-limit-unified.ts (nuevo)
 */
export async function checkRateLimitMigration(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Si está activado el nuevo, usarlo directamente
  if (USE_NEW_RATE_LIMIT && !SHADOW_MODE) {
    const newResult = await checkUnifiedRateLimit(key, {
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      identifier: config.identifier,
    });
    return convertUnifiedToOld(newResult);
  }

  // Ejecutar el rate limiter antiguo (source of truth por ahora)
  const oldResult = checkOldRateLimit(key, config);

  // Si shadow mode está activo, ejecutar también el nuevo y comparar
  if (SHADOW_MODE) {
    try {
      const newResult = await checkUnifiedRateLimit(key, {
        limit: config.limit,
        windowSeconds: config.windowSeconds,
        identifier: config.identifier,
      });

      // Comparar resultados
      compareResults(key, config.identifier, oldResult, newResult);
    } catch (error) {
      // Si el nuevo falla, solo loggear, no afectar al usuario
      logger.warn('Shadow rate limit failed', {
        key,
        identifier: config.identifier,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Retornar resultado del antiguo (source of truth)
  return oldResult;
}

/**
 * Convierte resultado del nuevo formato al antiguo para compatibilidad
 */
function convertUnifiedToOld(result: UnifiedRateLimitResult): RateLimitResult {
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

/**
 * Compara resultados y loggea diferencias
 */
function compareResults(
  key: string,
  identifier: string,
  oldResult: RateLimitResult,
  newResult: UnifiedRateLimitResult
): void {
  const hasMismatch = oldResult.success !== newResult.success;

  if (hasMismatch) {
    logger.warn('Rate limit mismatch detected', {
      key: key.substring(0, 20) + '...', // No loggear key completa
      identifier,
      oldSuccess: oldResult.success,
      newSuccess: newResult.success,
      oldRemaining: oldResult.remaining,
      newRemaining: newResult.remaining,
      newSource: newResult.source,
    });
  } else if (LOG_COMPARISONS) {
    // Log exitoso solo si LOG_COMPARISONS está activo
    logger.debug('Rate limit comparison OK', {
      identifier,
      success: oldResult.success,
      source: newResult.source,
    });
  }
}

/**
 * Helper para migración: obtener resultado de ambos sin modificar estado
 * Útil para pruebas manuales
 */
export async function compareRateLimiters(
  key: string,
  config: RateLimitConfig
): Promise<{
  old: RateLimitResult;
  new: UnifiedRateLimitResult;
  match: boolean;
}> {
  const oldResult = checkOldRateLimit(key, config);
  const newResult = await checkUnifiedRateLimit(key, {
    limit: config.limit,
    windowSeconds: config.windowSeconds,
    identifier: config.identifier,
  });

  return {
    old: oldResult,
    new: newResult,
    match: oldResult.success === newResult.success,
  };
}

// Re-exportar tipos para compatibilidad
export type { RateLimitConfig, RateLimitResult };
```

#### Checklist 3.1:
- [ ] Archivo `rate-limit-migration.ts` creado
- [ ] Flags de control documentados
- [ ] Función de comparación implementada

---

### 3.2 Agregar Variables de Entorno

**Objetivo**: Controlar el comportamiento de la migración via env vars

#### Archivo: `.env.local` (AGREGAR)

```bash
# =====================================================
# RATE LIMIT MIGRATION FLAGS
# =====================================================

# Shadow mode: ejecuta ambos rate limiters, compara, pero usa el antiguo
# Usar para validar que el nuevo da los mismos resultados
RATE_LIMIT_SHADOW_MODE=false

# Usar el nuevo rate limiter como source of truth
# Solo activar después de validar con shadow mode
USE_UNIFIED_RATE_LIMIT=false

# Loggear todas las comparaciones (no solo mismatches)
# Útil para debugging, genera muchos logs
RATE_LIMIT_LOG_COMPARISONS=false

# =====================================================
# REDIS (para rate-limit-unified)
# =====================================================

# URL de conexión a Redis (opcional, usará memory si no está)
# REDIS_URL=redis://localhost:6379
```

#### Checklist 3.2:
- [ ] Variables agregadas a .env.local
- [ ] Todas empiezan en `false` (seguro)
- [ ] Documentación clara de cada flag

---

### 3.3 Agregar Export al Index

**Objetivo**: Hacer el wrapper accesible

#### Archivo: `src/shared/lib/index.ts` (MODIFICAR)

Agregar:

```typescript
// Rate Limit Migration Wrapper
export {
  checkRateLimitMigration,
  compareRateLimiters,
} from './rate-limit-migration';
```

#### Checklist 3.3:
- [ ] Export agregado a index.ts

---

### 3.4 Pilot: Endpoint No Crítico

**Objetivo**: Probar el wrapper en un endpoint de bajo riesgo

#### Archivo: `app/api/enterprise-contact/route.ts` (MODIFICAR)

**ANTES:**
```typescript
import { checkRateLimit, getClientIP, ... } from '@/src/shared/lib/rate-limit';
```

**DESPUÉS:**
```typescript
import { checkRateLimitMigration } from '@/src/shared/lib/rate-limit-migration';
import { getClientIP, ... } from '@/src/shared/lib/rate-limit'; // Mantener helpers

// En la función POST:
const rateLimit = await checkRateLimitMigration(ip, contactLimiter);
// El resto del código no cambia
```

#### Verificación:

```bash
# 1. Reiniciar servidor
npm run dev

# 2. Hacer varios requests
for i in {1..10}; do curl -X POST http://localhost:3000/api/enterprise-contact -d '{}'; done

# 3. Verificar en logs que funciona igual que antes
```

#### Checklist 3.4:
- [ ] Import cambiado a checkRateLimitMigration
- [ ] Endpoint sigue funcionando
- [ ] Rate limiting funciona igual que antes

---

### 3.5 Activar Shadow Mode

**Objetivo**: Ejecutar ambos rate limiters en paralelo para comparar

#### Acciones:

```bash
# 1. En .env.local, cambiar:
RATE_LIMIT_SHADOW_MODE=true
RATE_LIMIT_LOG_COMPARISONS=true

# 2. Reiniciar servidor
npm run dev

# 3. Hacer varios requests al endpoint piloto
for i in {1..20}; do curl -X POST http://localhost:3000/api/enterprise-contact -d '{}'; done

# 4. Revisar logs buscando:
# - "Rate limit comparison OK" (ambos coinciden)
# - "Rate limit mismatch detected" (diferencia - investigar)
```

#### ¿Qué hacer si hay mismatches?

1. **Analizar el log**: ¿El nuevo es más o menos restrictivo?
2. **Verificar configuración**: ¿Los límites son iguales?
3. **Verificar timing**: ¿Las ventanas de tiempo coinciden?
4. **Si persiste**: NO migrar ese endpoint, investigar primero

#### Checklist 3.5:
- [ ] Shadow mode activado
- [ ] Logs muestran comparaciones
- [ ] 0 mismatches o mismatches explicados

---

### 3.6 Migrar Endpoints No Críticos

**Objetivo**: Extender la migración a más endpoints de bajo riesgo

#### Endpoints a migrar (en orden):

| # | Endpoint | Archivo | Riesgo |
|---|----------|---------|--------|
| 1 | Enterprise Contact | `app/api/enterprise-contact/route.ts` | 🟢 (ya hecho) |
| 2 | AI Learning | `app/api/ai-learning/route.ts` | 🟢 |
| 3 | Business Insights | `app/api/business-insights/route.ts` | 🟢 |
| 4 | Onboarding Status | `app/api/onboarding/status/route.ts` | 🟢 |
| 5 | Loyalty Members | `app/api/loyalty/members/route.ts` | 🟢 |

#### Patrón para cada endpoint:

```typescript
// Cambiar import
import { checkRateLimitMigration } from '@/src/shared/lib/rate-limit-migration';

// Cambiar llamada (agregar await si no lo tenía)
const rateLimit = await checkRateLimitMigration(key, config);
```

#### Después de cada migración:

```bash
# Verificar que funciona
curl http://localhost:3000/api/[endpoint]

# Verificar logs por mismatches
```

#### Checklist 3.6:
- [ ] ai-learning migrado y verificado
- [ ] business-insights migrado y verificado
- [ ] onboarding/status migrado y verificado
- [ ] loyalty/members migrado y verificado

---

### 3.7 Migrar Endpoints Críticos (Stripe)

**Objetivo**: Migrar endpoints de pagos (mayor precaución)

#### IMPORTANTE: Antes de migrar Stripe

1. ✅ Shadow mode debe haber corrido por al menos 24 horas sin mismatches
2. ✅ Tener acceso a Stripe Dashboard para monitorear
3. ✅ Tener Stripe CLI instalado para testing

#### Endpoints Stripe a migrar:

| # | Endpoint | Archivo |
|---|----------|---------|
| 1 | Create Checkout | `app/api/stripe/create-checkout/route.ts` |
| 2 | Change Plan | `app/api/stripe/change-plan/route.ts` |
| 3 | Cancel Subscription | `app/api/stripe/cancel-subscription/route.ts` |
| 4 | Customer Portal | `app/api/stripe/customer-portal/route.ts` |

#### Proceso para cada endpoint Stripe:

```bash
# 1. Migrar el endpoint (cambiar import)

# 2. Probar con Stripe CLI
stripe trigger checkout.session.completed

# 3. Verificar en logs que no hay mismatches

# 4. Verificar en Stripe Dashboard que los eventos se procesaron
```

#### Checklist 3.7:
- [ ] create-checkout migrado y verificado con Stripe CLI
- [ ] change-plan migrado y verificado
- [ ] cancel-subscription migrado y verificado
- [ ] customer-portal migrado y verificado

---

### 3.8 Migrar Resto de Endpoints

**Objetivo**: Completar la migración de todos los endpoints

#### Endpoints restantes:

| Endpoint | Archivo |
|----------|---------|
| AI Config Generate | `app/api/ai-config/generate-prompt/route.ts` |
| AI Preview | `app/api/ai-preview/route.ts` |
| Voice Agent Generate | `app/api/voice-agent/generate-prompt/route.ts` |
| Messages Send | `app/api/messages/send/route.ts` |
| Webhook (interno) | `app/api/webhook/route.ts` |

#### Checklist 3.8:
- [ ] Todos los endpoints migrados
- [ ] Tests pasan
- [ ] No hay mismatches en producción

---

### 3.9 Activar Nuevo Rate Limiter

**Objetivo**: Cambiar al nuevo rate limiter como source of truth

#### Prerrequisitos:

- [ ] Al menos 48 horas en shadow mode sin mismatches
- [ ] Todos los endpoints migrados
- [ ] Tests pasando

#### Acciones:

```bash
# 1. En .env.local, cambiar:
RATE_LIMIT_SHADOW_MODE=false
USE_UNIFIED_RATE_LIMIT=true

# 2. Reiniciar servidor
npm run dev

# 3. Probar todos los endpoints críticos

# 4. Monitorear por 24 horas
```

#### Checklist 3.9:
- [ ] USE_UNIFIED_RATE_LIMIT=true
- [ ] RATE_LIMIT_SHADOW_MODE=false
- [ ] 24 horas de monitoreo sin problemas

---

### 3.10 Deprecar Rate Limiter Antiguo

**Objetivo**: Marcar el código antiguo como deprecated

#### Archivo: `src/shared/lib/rate-limit.ts` (MODIFICAR)

Agregar al inicio del archivo:

```typescript
/**
 * @deprecated Este módulo está deprecated. Usar rate-limit-unified.ts en su lugar.
 * Este archivo se mantendrá por compatibilidad hasta que todos los endpoints migren.
 * @see rate-limit-unified.ts
 */
```

#### Checklist 3.10:
- [ ] rate-limit.ts marcado como deprecated
- [ ] Comentario indica qué usar en su lugar

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/shared/lib/rate-limit-migration.ts` | NUEVO - Wrapper de migración |
| `src/shared/lib/index.ts` | MODIFICADO - Export del wrapper |
| `.env.local` | MODIFICADO - Flags de migración |
| 15+ endpoints | MODIFICADOS - Import del wrapper |
| `src/shared/lib/rate-limit.ts` | MODIFICADO - Deprecated comment |

---

## Rollback

### Si el nuevo rate limiter causa problemas:

```bash
# 1. Desactivar inmediatamente
# En .env.local:
USE_UNIFIED_RATE_LIMIT=false
RATE_LIMIT_SHADOW_MODE=false

# 2. Reiniciar servidor
npm run dev

# El wrapper automáticamente volverá a usar rate-limit.ts (antiguo)
```

### Si necesitas rollback completo:

```bash
# Restaurar los endpoints a usar rate-limit.ts directamente
git checkout backup/pre-migration-2026-01-21 -- app/api/
```

---

## Siguiente Paso

✅ **Fase 3 Completada**

Proceder a: [FASE_4_ADMIN_AUTH.md](./FASE_4_ADMIN_AUTH.md)

---

## Troubleshooting

### "Mismatches constantes entre old y new"

1. Verificar que los configs son idénticos (limit, windowSeconds)
2. Verificar que el identifier es el mismo
3. Verificar timezone del servidor

### "Redis connection failed"

No es un problema - el nuevo rate limiter tiene fallback automático a memory.
```
[UnifiedRateLimiter] Redis init failed, using in-memory
```

### "Rate limit bloquea muy rápido"

1. Verificar los límites configurados
2. Verificar que no hay múltiples instancias del servidor
3. En desarrollo, considerar aumentar los límites

### "Rate limit no bloquea nada"

1. Verificar que el endpoint usa `checkRateLimitMigration`
2. Verificar que el resultado se usa para bloquear
3. Verificar los logs para ver qué está pasando
