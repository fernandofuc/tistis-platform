# PRP: FASE 2 - Soft Restaurant Processing Bridge

## Product Requirements Proposal (PRP)
**Versión:** 1.1
**Fecha:** Enero 2026
**Módulo:** Integrations > Soft Restaurant
**Autor:** TIS TIS Engineering

---

## 0. ALINEACIÓN CON ARQUITECTURA EXISTENTE

### 0.1 Patrones Existentes Identificados

Este PRP se alinea con los siguientes patrones ya implementados en TIS TIS:

| Patrón | Referencia | Ubicación |
|--------|------------|-----------|
| **Job Queue con RPC** | `claim_next_job` | `job-processor.service.ts:56` |
| **Cron Authentication** | `timingSafeEqual` + `CRON_SECRET` | `api/jobs/process/route.ts:38-69` |
| **Exponential Backoff** | `MAX_BACKOFF_MS = 3600000` | `job-processor.service.ts:14` |
| **Batch Processing** | `maxJobs = 50` | `api/jobs/process/route.ts:139` |
| **DLQ Pattern** | `webhook_dead_letters` | `api/cron/process-dlq/route.ts` |
| **Optimistic Locking** | `status = 'processing'` | `process-dlq/route.ts:139-146` |

### 0.2 Decisión de Arquitectura

**Opción A: Usar tabla `job_queue` existente** ❌
- Pros: Reutiliza infraestructura existente
- Contras: `job_queue` está diseñada para AI/messaging jobs, mezclar tipos añade complejidad

**Opción B: Usar tabla `sr_sales` con status transitions** ✅ SELECCIONADA
- Pros: Ya tiene campos `status`, `retry_count`, `error_message`
- Pros: Mantiene datos de SR aislados
- Pros: Permite queries específicas de SR sin afectar job_queue general
- Pattern similar: `webhook_dead_letters` usa su propia tabla con status/retries

---

## 1. RESUMEN EJECUTIVO

### 1.1 Problema Actual
El webhook de Soft Restaurant (`/api/soft-restaurant/webhook/route.ts`) implementa únicamente **FASE 1** (registro de datos crudos). Existe un **TODO crítico en línea 569-570** que indica que FASE 2 (procesamiento y deducción de inventario) nunca se ejecuta.

```typescript
// Línea 569-570 del webhook actual:
// TODO: Trigger PHASE 2 processing asynchronously
// This will be implemented in MICROFASE 4
```

### 1.2 Solución Propuesta
Implementar el **"puente"** que conecta FASE 1 (registro) con FASE 2 (procesamiento) de manera asíncrona, siguiendo la arquitectura de job queue existente en el sistema y los estándares de calidad de TIS TIS.

### 1.3 Alcance
- Conectar webhook → procesador asíncrono
- Utilizar servicios existentes (`SoftRestaurantProcessor`, `RecipeDeductionService`)
- NO modificar lógica de negocio existente
- Mantener compatibilidad con arquitectura multi-tenant

---

## 2. ARQUITECTURA ACTUAL

### 2.1 Flujo Actual (Incompleto)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUJO ACTUAL (INCOMPLETO)                        │
└─────────────────────────────────────────────────────────────────────────┘

  Soft Restaurant POS
         │
         ▼
  ┌──────────────────┐
  │   POST /api/     │
  │  soft-restaurant │
  │     /webhook     │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │   FASE 1:        │
  │  • Validación    │
  │  • Autenticación │
  │  • Registro en   │    ✅ IMPLEMENTADO
  │    sr_sales      │
  │    sr_sale_items │
  │    sr_payments   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │   TODO: FASE 2   │    ❌ NO IMPLEMENTADO
  │   (línea 569)    │
  └──────────────────┘
           │
           ✖ (desconectado)
           │
  ┌──────────────────┐
  │ SoftRestaurant   │
  │   Processor      │    ⚠️ CÓDIGO EXISTE PERO
  │  .processSale()  │       NUNCA SE INVOCA
  └──────────────────┘
```

### 2.2 Flujo Objetivo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUJO OBJETIVO (COMPLETO)                        │
└─────────────────────────────────────────────────────────────────────────┘

  Soft Restaurant POS
         │
         ▼
  ┌──────────────────┐
  │   POST /api/     │
  │  soft-restaurant │
  │     /webhook     │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │   FASE 1:        │
  │   Registro       │
  │   (existente)    │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │   NUEVO:         │
  │  Encolar Job     │   ← MICROFASE 2.1
  │  para FASE 2     │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │   Job Processor  │
  │  (Vercel Cron    │   ← MICROFASE 2.2
  │   o Edge Func)   │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ SoftRestaurant   │
  │   Processor      │   ← EXISTENTE
  │  .processSale()  │
  └────────┬─────────┘
           │
           ├──────────────────────────┐
           │                          │
           ▼                          ▼
  ┌──────────────────┐      ┌──────────────────┐
  │ ProductMapping   │      │ RecipeDeduction  │
  │   Service        │      │    Service       │
  └────────┬─────────┘      └────────┬─────────┘
           │                          │
           ▼                          ▼
  ┌──────────────────┐      ┌──────────────────┐
  │ sr_product_      │      │ inventory_       │
  │   mappings       │      │   movements      │
  │ (auto-mapping)   │      │ (deductions)     │
  └──────────────────┘      └──────────────────┘
           │                          │
           └──────────┬───────────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ restaurant_      │
             │   orders         │
             │ (orden creada)   │
             └──────────────────┘
```

---

## 3. ANÁLISIS DE NO-DUPLICACIÓN

### 3.1 Por qué NO hay duplicación de deducciones

El sistema tiene **dos caminos de deducción de inventario**, diseñados para fuentes diferentes:

```
┌─────────────────────────────────────────────────────────────────────────┐
│              CAMINO A: Órdenes Internas (Manual/UI)                     │
└─────────────────────────────────────────────────────────────────────────┘

  Usuario crea orden en UI de TIS TIS
           │
           ▼
  INSERT restaurant_orders (status='pending')
           │
           ▼
  UPDATE restaurant_orders SET status='completed'
           │
           ▼ (TRIGGER: AFTER UPDATE)
  trigger_consume_order_ingredients()
           │
           ▼
  inventory_movements (reference_type='restaurant_order')

┌─────────────────────────────────────────────────────────────────────────┐
│              CAMINO B: Órdenes Soft Restaurant (Webhook)                │
└─────────────────────────────────────────────────────────────────────────┘

  SR Webhook → processSale()
           │
           ▼
  RecipeDeductionService.deduceForSale()
           │
           ▼
  inventory_movements (reference_type='sr_sale')
           │
           ▼
  INSERT restaurant_orders (status='completed')
           │
           ✖ (Trigger NO se dispara - es INSERT, no UPDATE)
```

### 3.2 Detalle Técnico del Trigger

```sql
-- Definición actual del trigger (migrations/101_INVENTORY_CONSUMPTION_SYSTEM.sql)
CREATE TRIGGER trigger_consume_order_ingredients
    AFTER UPDATE ON public.restaurant_orders  -- ← Solo UPDATE, no INSERT
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status
          AND NEW.status IN ('completed', 'delivered'))
    EXECUTE FUNCTION trigger_consume_order_ingredients();
```

**Conclusión:** Las órdenes de SR se crean directamente con `status='completed'` (INSERT), por lo que el trigger de UPDATE nunca se activa. Los dos caminos son **mutuamente excluyentes**.

---

## 4. PLAN DE IMPLEMENTACIÓN

### FASE 2: MICROFASES

```
┌────────────────────────────────────────────────────────────────────────┐
│  MICROFASE 2.1: Servicio de Encolamiento                               │
│  Estimación: ~150 líneas de código                                     │
├────────────────────────────────────────────────────────────────────────┤
│  • Crear SRJobQueueService                                             │
│  • Método: queueForProcessing(saleId)                                  │
│  • Actualizar sr_sales.status = 'queued'                               │
│  • Registrar timestamp de encolamiento                                 │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│  MICROFASE 2.2: API de Procesamiento                                   │
│  Estimación: ~200 líneas de código                                     │
├────────────────────────────────────────────────────────────────────────┤
│  • Crear /api/soft-restaurant/process/route.ts                         │
│  • Atomic claim con SELECT FOR UPDATE SKIP LOCKED                      │
│  • Invocar SoftRestaurantProcessor.processSale()                       │
│  • Manejo de errores y reintentos                                      │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│  MICROFASE 2.3: Integración Webhook → Queue                            │
│  Estimación: ~50 líneas de código                                      │
├────────────────────────────────────────────────────────────────────────┤
│  • Modificar webhook para encolar después de FASE 1                    │
│  • Llamada asíncrona (no bloquea respuesta)                            │
│  • Fallback graceful si encolamiento falla                             │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│  MICROFASE 2.4: Vercel Cron Job                                        │
│  Estimación: ~30 líneas de código + config                             │
├────────────────────────────────────────────────────────────────────────┤
│  • Agregar cron en vercel.json                                         │
│  • Endpoint: /api/cron/process-sr-sales                                │
│  • Frecuencia: cada 1 minuto (configurable)                            │
│  • Procesar batch de ventas pendientes                                 │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│  MICROFASE 2.5: Tests y Validación                                     │
│  Estimación: ~300 líneas de código                                     │
├────────────────────────────────────────────────────────────────────────┤
│  • Tests unitarios para cada servicio                                  │
│  • Tests de integración end-to-end                                     │
│  • Test de no-duplicación                                              │
│  • Test de reintentos y errores                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. ESPECIFICACIONES TÉCNICAS

### MICROFASE 2.1: SRJobQueueService

**Archivo:** `src/features/integrations/services/sr-job-queue.service.ts`

**Alineación:** Siguiendo patrón de `job-processor.service.ts` y `process-dlq/route.ts`

```typescript
// ==============================================
// Implementación completa alineada con patrones existentes
// ==============================================

import { createServerClient } from '@/src/shared/lib/supabase';

// Constantes alineadas con job-processor.service.ts
const MAX_BACKOFF_MS = 3600000; // 1 hour (igual que job-processor)
const DEFAULT_MAX_RETRIES = 3;

export interface SRSaleQueueResult {
  success: boolean;
  saleId?: string;
  error?: string;
}

export class SRJobQueueService {
  /**
   * Encola una venta SR para procesamiento asíncrono
   * Pattern: Similar a WhatsAppService.enqueueSendMessageJob()
   */
  static async queueForProcessing(saleId: string): Promise<SRSaleQueueResult> {
    const supabase = createServerClient();

    // Optimistic lock: Solo actualizar si está en 'pending'
    // Pattern de: process-dlq/route.ts:139-146
    const { data, error } = await supabase
      .from('sr_sales')
      .update({
        status: 'queued',
        queued_at: new Date().toISOString(),
      })
      .eq('id', saleId)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (error || !data) {
      console.warn(`[SR Queue] Failed to queue sale ${saleId}:`, error?.message);
      return { success: false, error: error?.message || 'Sale not in pending status' };
    }

    console.log(`[SR Queue] Sale ${saleId} queued for processing`);
    return { success: true, saleId };
  }

  /**
   * Obtiene y reclama el siguiente batch de ventas para procesar
   * Pattern: claim_next_job RPC con SELECT FOR UPDATE SKIP LOCKED
   * Referencia: job-processor.service.ts:52-65
   */
  static async claimNextBatch(limit: number = 10): Promise<string[]> {
    const supabase = createServerClient();

    // Usar RPC para atomic claim con SKIP LOCKED
    // Esto previene race conditions entre múltiples workers
    const { data, error } = await supabase.rpc('claim_sr_sales_batch', {
      p_limit: limit,
    });

    if (error) {
      console.error('[SR Queue] Error claiming batch:', error);
      return [];
    }

    const saleIds = (data || []).map((row: { id: string }) => row.id);

    if (saleIds.length > 0) {
      console.log(`[SR Queue] Claimed ${saleIds.length} sales for processing`);
    }

    return saleIds;
  }

  /**
   * Marca una venta como procesada exitosamente
   * Pattern: JobProcessor.completeJob()
   */
  static async markProcessed(
    saleId: string,
    restaurantOrderId?: string
  ): Promise<boolean> {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('sr_sales')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        restaurant_order_id: restaurantOrderId || null,
        error_message: null,
      })
      .eq('id', saleId);

    if (error) {
      console.error(`[SR Queue] Error marking sale ${saleId} as processed:`, error);
      return false;
    }

    console.log(`[SR Queue] Sale ${saleId} marked as processed`);
    return true;
  }

  /**
   * Marca una venta como fallida con exponential backoff
   * Pattern: JobProcessor.failJob() con backoff capped
   * Referencia: job-processor.service.ts:120-163
   */
  static async markFailed(
    saleId: string,
    errorMessage: string,
    currentRetryCount: number
  ): Promise<{ shouldRetry: boolean }> {
    const supabase = createServerClient();

    const newRetryCount = currentRetryCount + 1;
    const shouldRetry = newRetryCount < DEFAULT_MAX_RETRIES;

    // Exponential backoff with cap (igual que job-processor)
    // Formula: min(2^attempts * 1000ms, MAX_BACKOFF_MS)
    const backoffMs = Math.min(
      Math.pow(2, newRetryCount) * 1000,
      MAX_BACKOFF_MS
    );

    const nextStatus = shouldRetry ? 'queued' : 'dead_letter';
    const scheduledFor = shouldRetry
      ? new Date(Date.now() + backoffMs).toISOString()
      : null;

    const { error } = await supabase
      .from('sr_sales')
      .update({
        status: nextStatus,
        error_message: errorMessage,
        retry_count: newRetryCount,
        next_retry_at: scheduledFor,
      })
      .eq('id', saleId);

    if (error) {
      console.error(`[SR Queue] Error marking sale ${saleId} as failed:`, error);
      return { shouldRetry: false };
    }

    console.log(
      `[SR Queue] Sale ${saleId} ${shouldRetry ? 'will retry' : 'sent to dead letter'}: ${errorMessage}`
    );

    return { shouldRetry };
  }

  /**
   * Obtiene estadísticas de la cola SR
   * Pattern: JobProcessor.getQueueStats()
   */
  static async getQueueStats(): Promise<{
    pending: number;
    queued: number;
    processing: number;
    processed_today: number;
    failed_today: number;
    dead_letter: number;
  }> {
    const supabase = createServerClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: sales, error } = await supabase
      .from('sr_sales')
      .select('status, processed_at');

    if (error || !sales) {
      return {
        pending: 0, queued: 0, processing: 0,
        processed_today: 0, failed_today: 0, dead_letter: 0,
      };
    }

    const stats = {
      pending: 0, queued: 0, processing: 0,
      processed_today: 0, failed_today: 0, dead_letter: 0,
    };

    for (const sale of sales) {
      switch (sale.status) {
        case 'pending': stats.pending++; break;
        case 'queued': stats.queued++; break;
        case 'processing': stats.processing++; break;
        case 'processed':
          if (sale.processed_at && new Date(sale.processed_at) >= today) {
            stats.processed_today++;
          }
          break;
        case 'failed':
          if (sale.processed_at && new Date(sale.processed_at) >= today) {
            stats.failed_today++;
          }
          break;
        case 'dead_letter': stats.dead_letter++; break;
      }
    }

    return stats;
  }
}
```

**Estados de sr_sales.status:**
```
pending → queued → processing → processed
                            ↘ failed (retry_count < 3)
                              ↘ dead_letter (retry_count >= 3)
```

### MICROFASE 2.2: API de Procesamiento

**Archivo:** `app/api/soft-restaurant/process/route.ts`

**Alineación:** Siguiendo patrón exacto de `api/jobs/process/route.ts`

```typescript
// ==============================================
// Implementación completa alineada con api/jobs/process
// ==============================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max (igual que jobs/process)

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { SRJobQueueService } from '@/src/features/integrations/services/sr-job-queue.service';
import { SoftRestaurantProcessor } from '@/src/features/integrations/services/soft-restaurant-processor';

// ======================
// AUTHENTICATION (idéntico a api/jobs/process)
// ======================

function validateRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const internalKey = process.env.INTERNAL_API_KEY;
  const authHeader = request.headers.get('authorization');

  // Permitir CRON_SECRET o INTERNAL_API_KEY
  if (!cronSecret && !internalKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SR Process] CRITICAL: No auth configured in production');
      return false;
    }
    console.warn('[SR Process] Running without auth in development');
    return true;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  // Timing-safe comparison (patrón de jobs/process)
  try {
    const tokenBuffer = Buffer.from(token);

    // Verificar contra CRON_SECRET
    if (cronSecret) {
      const secretBuffer = Buffer.from(cronSecret);
      if (tokenBuffer.length === secretBuffer.length &&
          timingSafeEqual(tokenBuffer, secretBuffer)) {
        return true;
      }
    }

    // Verificar contra INTERNAL_API_KEY
    if (internalKey) {
      const keyBuffer = Buffer.from(internalKey);
      if (tokenBuffer.length === keyBuffer.length &&
          timingSafeEqual(tokenBuffer, keyBuffer)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ======================
// GET - Health Check + Stats
// ======================

export async function GET(request: NextRequest) {
  if (!validateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await SRJobQueueService.getQueueStats();

    return NextResponse.json({
      status: 'healthy',
      queue_stats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SR Process] Stats error:', error);
    return NextResponse.json({ error: 'Stats failed' }, { status: 500 });
  }
}

// ======================
// POST - Process Sales Batch
// ======================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!validateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxSales = Math.min(body.max_sales || 20, 50); // Max 50 (igual que jobs)
    const saleId = body.sale_id; // Opcional: procesar venta específica

    console.log(`[SR Process] Starting processing (max: ${maxSales})`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    const processor = new SoftRestaurantProcessor();

    if (saleId) {
      // Procesar venta específica
      results.processed = 1;

      try {
        const result = await processor.processSale(saleId);

        if (result.success) {
          await SRJobQueueService.markProcessed(saleId, result.restaurantOrderId);
          results.succeeded++;
        } else {
          const { data: sale } = await createServerClient()
            .from('sr_sales')
            .select('retry_count')
            .eq('id', saleId)
            .single();

          await SRJobQueueService.markFailed(
            saleId,
            result.error || 'Unknown error',
            sale?.retry_count || 0
          );
          results.failed++;
          results.errors.push(`Sale ${saleId}: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.errors.push(`Sale ${saleId}: ${errorMessage}`);
      }
    } else {
      // Procesar batch (patrón de jobs/process)
      const saleIds = await SRJobQueueService.claimNextBatch(maxSales);

      if (saleIds.length === 0) {
        console.log('[SR Process] No pending sales to process');
      }

      for (const id of saleIds) {
        results.processed++;

        try {
          console.log(`[SR Process] Processing sale ${id}`);

          const result = await processor.processSale(id);

          if (result.success) {
            await SRJobQueueService.markProcessed(id, result.restaurantOrderId);
            results.succeeded++;
          } else {
            const { data: sale } = await createServerClient()
              .from('sr_sales')
              .select('retry_count')
              .eq('id', id)
              .single();

            await SRJobQueueService.markFailed(
              id,
              result.error || 'Unknown error',
              sale?.retry_count || 0
            );
            results.failed++;
            results.errors.push(`Sale ${id}: ${result.error}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[SR Process] Sale ${id} failed:`, errorMessage);

          results.failed++;
          results.errors.push(`Sale ${id}: ${errorMessage}`);
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[SR Process] Completed: ${results.succeeded}/${results.processed} in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      ...results,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[SR Process] Processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

// Helper import (añadir al inicio)
import { createServerClient } from '@/src/shared/lib/supabase';
```

### MICROFASE 2.3: Integración Webhook → Queue

**Modificación a:** `app/api/soft-restaurant/webhook/route.ts`

**Cambios mínimos:** Solo ~15 líneas añadidas

```typescript
// ==============================================
// Añadir import al inicio del archivo
// ==============================================
import { SRJobQueueService } from '@/src/features/integrations/services/sr-job-queue.service';

// ==============================================
// Reemplazar líneas 569-570 (el TODO actual) con:
// ==============================================

// FASE 2: Encolar para procesamiento asíncrono
// Pattern: Fire-and-forget con catch (no bloquea respuesta al POS)
if (!registrationResult.isDuplicate && registrationResult.saleId) {
  // Encolar asíncronamente - no bloquear respuesta HTTP
  SRJobQueueService.queueForProcessing(registrationResult.saleId)
    .then(queueResult => {
      if (queueResult.success) {
        console.log(`[SR Webhook] Sale ${registrationResult.saleId} queued for FASE 2`);
      }
    })
    .catch(err => {
      // Log pero no fallar - la venta está registrada (FASE 1 completada)
      // El cron job puede recuperar ventas en status='pending'
      console.error('[SR Webhook] Queue failed (recoverable):', err);
    });
}
```

### MICROFASE 2.4: Vercel Cron

**Modificación a:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/jobs/process",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/generate-insights",
      "schedule": "0 3 */3 * *"
    },
    {
      "path": "/api/cron/process-sr-sales",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

> **Nota:** Frecuencia de 5 minutos en lugar de 1 minuto para evitar
> costos excesivos de Vercel Cron. El webhook encola inmediatamente,
> el cron es solo backup para ventas huérfanas.

**Archivo nuevo:** `app/api/cron/process-sr-sales/route.ts`

**Alineación:** Siguiendo patrón exacto de `api/cron/process-dlq/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Process SR Sales CRON Job
// Procesa ventas de Soft Restaurant pendientes
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ======================
// AUTHENTICATION (idéntico a process-dlq)
// ======================

function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON SR] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON SR] Running without auth in development');
    return true;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(cronSecret);
    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

// ======================
// GET - Cron Handler
// ======================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON SR] Starting SR sales processing');

    // Llamar al endpoint de procesamiento interno
    const internalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/soft-restaurant/process`;
    const cronSecret = process.env.CRON_SECRET;

    const response = await fetch(internalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        max_sales: 20, // Batch size conservador para cron
      }),
    });

    const result = await response.json();
    const duration = Date.now() - startTime;

    console.log(
      `[CRON SR] Completed in ${duration}ms: ` +
      `${result.succeeded || 0}/${result.processed || 0} processed`
    );

    return NextResponse.json({
      success: true,
      ...result,
      cron_duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON SR] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cron_duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST alias (para webhooks de cron que usan POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
```

### MICROFASE 2.5: Función RPC para Atomic Claim

**Archivo:** Nueva migración SQL

```sql
-- =====================================================
-- claim_sr_sales_batch: Atomic claim for SR sales processing
-- Pattern: Similar to claim_next_job RPC
-- =====================================================

CREATE OR REPLACE FUNCTION claim_sr_sales_batch(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT sr.id
    FROM sr_sales sr
    WHERE sr.status IN ('queued', 'pending')
      AND (sr.next_retry_at IS NULL OR sr.next_retry_at <= NOW())
    ORDER BY
      CASE sr.status
        WHEN 'queued' THEN 0  -- Prioridad a los ya encolados
        WHEN 'pending' THEN 1 -- Luego los pendientes
      END,
      sr.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE sr_sales s
  SET
    status = 'processing',
    processing_started_at = NOW()
  FROM claimed c
  WHERE s.id = c.id
  RETURNING s.id;
END;
$$;

-- Índices para optimizar la query
CREATE INDEX IF NOT EXISTS idx_sr_sales_queue_priority
ON sr_sales (status, next_retry_at, created_at)
WHERE status IN ('queued', 'pending');

COMMENT ON FUNCTION claim_sr_sales_batch IS
'Atomic claim para procesar ventas SR. Usa SKIP LOCKED para evitar race conditions entre workers.';
```

---

## 6. MODELO DE DATOS

### 6.1 Estados de sr_sales

| Estado | Descripción | Transiciones |
|--------|-------------|--------------|
| `pending` | Recién registrado por webhook | → queued |
| `queued` | En cola para procesamiento | → processing |
| `processing` | Siendo procesado actualmente | → processed, failed |
| `processed` | Procesado exitosamente | (final) |
| `failed` | Falló, pendiente reintento | → queued (si retry < 3) |
| `dead_letter` | Falló 3+ veces, requiere atención manual | (final) |

### 6.2 Campos Utilizados

```sql
-- Campos existentes en sr_sales que usaremos:
status          VARCHAR(20)  -- Estado del procesamiento
processed_at    TIMESTAMPTZ  -- Timestamp de procesamiento
error_message   TEXT         -- Mensaje de error si falló
retry_count     INTEGER      -- Número de reintentos
```

---

## 7. SEGURIDAD

### 7.1 Autenticación

| Endpoint | Método de Auth | Variable de Entorno |
|----------|----------------|---------------------|
| `/api/soft-restaurant/webhook` | API Key (x-api-key) | Almacenado en integration_connections |
| `/api/soft-restaurant/process` | Internal API Key | `INTERNAL_API_KEY` |
| `/api/cron/process-sr-sales` | Cron Secret | `CRON_SECRET` |

### 7.2 Aislamiento Multi-Tenant

- Todas las operaciones verifican `tenant_id` y `branch_id`
- RLS policies activas en todas las tablas
- Session variable `app.current_branch_id` configurada antes de operaciones

---

## 8. MANEJO DE ERRORES

### 8.1 Estrategia de Reintentos

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ESTRATEGIA DE REINTENTOS                            │
└─────────────────────────────────────────────────────────────────────────┘

  Intento 1 (inmediato)
       │
       ├─── Éxito → status='processed' ✓
       │
       └─── Fallo → status='failed', retry_count=1
                           │
                           ▼ (siguiente cron cycle, ~1 min)
  Intento 2
       │
       ├─── Éxito → status='processed' ✓
       │
       └─── Fallo → status='failed', retry_count=2
                           │
                           ▼ (siguiente cron cycle)
  Intento 3
       │
       ├─── Éxito → status='processed' ✓
       │
       └─── Fallo → status='dead_letter', retry_count=3
                           │
                           ▼
                    Requiere intervención manual
                    (dashboard de admin o soporte)
```

### 8.2 Errores Comunes y Manejo

| Error | Acción | Reintentable |
|-------|--------|--------------|
| Menu item no mapeado | Log warning, continuar con otros items | No |
| Receta sin ingredientes | Log warning, omitir item | No |
| Stock insuficiente | Log warning, permitir negativo (configurable) | No |
| Error de conexión DB | Marcar como failed, reintentar | Sí |
| Timeout de procesamiento | Marcar como failed, reintentar | Sí |

---

## 9. OBSERVABILIDAD

### 9.1 Logs

```typescript
// Formato de logs consistente
console.log('[SR Processor] Starting batch processing', { batchSize, timestamp });
console.log('[SR Processor] Sale processed', { saleId, itemsDeducted, duration });
console.error('[SR Processor] Sale failed', { saleId, error, retryCount });
```

### 9.2 Métricas (Dashboard)

- Ventas pendientes por procesar
- Ventas procesadas por hora/día
- Ventas en dead_letter (requieren atención)
- Tiempo promedio de procesamiento
- Tasa de éxito/fallo

### 9.3 Alertas

- Dead letter queue > 10 ventas
- Tiempo de procesamiento > 5 segundos
- Tasa de error > 10%

---

## 10. VALIDACIÓN Y TESTING

### 10.1 Criterios de Aceptación (Validation Gates)

| Gate | Criterio | Método | Bloqueante |
|------|----------|--------|------------|
| **G1** | Venta SR se procesa en < 30 segundos | Test de integración | ✅ |
| **G2** | Inventario se deduce correctamente por receta | Test unitario | ✅ |
| **G3** | NO hay duplicación de deducciones | Test específico | ✅ |
| **G4** | Reintentos funcionan hasta 3 veces | Test unitario | ✅ |
| **G5** | Dead letter se marca tras 3 fallos | Test unitario | ✅ |
| **G6** | Multi-tenant aislado correctamente | Test de seguridad | ✅ |
| **G7** | TypeScript sin errores | `pnpm typecheck` | ✅ |
| **G8** | ESLint sin errores | `pnpm lint` | ✅ |
| **G9** | Build exitoso | `pnpm build` | ✅ |
| **G10** | Tests actuales no regresan | `pnpm test:vitest` | ✅ |

### 10.2 Plan de Tests Detallado

**Ubicación:** `__tests__/features/integrations/soft-restaurant-fase2/`

#### MICROFASE 2.5.1: Tests Unitarios para SRJobQueueService

```typescript
// __tests__/features/integrations/soft-restaurant-fase2/sr-job-queue.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SRJobQueueService } from '@/src/features/integrations/services/sr-job-queue.service';

// Mock Supabase (patrón existente en el proyecto)
vi.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: vi.fn(() => mockSupabase),
}));

describe('SRJobQueueService', () => {
  // =====================
  // queueForProcessing
  // =====================
  describe('queueForProcessing', () => {
    it('should queue a sale in pending status', async () => {
      // Arrange
      const saleId = 'test-sale-id';
      mockSupabase.from().update().eq().eq().select().single.mockResolvedValue({
        data: { id: saleId },
        error: null,
      });

      // Act
      const result = await SRJobQueueService.queueForProcessing(saleId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.saleId).toBe(saleId);
    });

    it('should fail if sale is not in pending status', async () => {
      // Arrange
      mockSupabase.from().update().eq().eq().select().single.mockResolvedValue({
        data: null,
        error: { message: 'No rows updated' },
      });

      // Act
      const result = await SRJobQueueService.queueForProcessing('already-processed');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // =====================
  // claimNextBatch
  // =====================
  describe('claimNextBatch', () => {
    it('should claim multiple sales atomically', async () => {
      // Arrange
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: 'sale-1' }, { id: 'sale-2' }],
        error: null,
      });

      // Act
      const saleIds = await SRJobQueueService.claimNextBatch(10);

      // Assert
      expect(saleIds).toHaveLength(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_sr_sales_batch', { p_limit: 10 });
    });

    it('should return empty array when no sales pending', async () => {
      // Arrange
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      const saleIds = await SRJobQueueService.claimNextBatch(10);

      // Assert
      expect(saleIds).toHaveLength(0);
    });
  });

  // =====================
  // markFailed with exponential backoff
  // =====================
  describe('markFailed', () => {
    it('should use exponential backoff for retries', async () => {
      // Arrange
      mockSupabase.from().update().eq.mockResolvedValue({ error: null });

      // Act
      const result = await SRJobQueueService.markFailed('sale-1', 'Test error', 1);

      // Assert
      expect(result.shouldRetry).toBe(true);
      // Verify backoff was calculated: 2^2 * 1000 = 4000ms
    });

    it('should send to dead_letter after 3 retries', async () => {
      // Arrange
      mockSupabase.from().update().eq.mockResolvedValue({ error: null });

      // Act
      const result = await SRJobQueueService.markFailed('sale-1', 'Test error', 2);

      // Assert
      expect(result.shouldRetry).toBe(false);
      // Verify status was set to 'dead_letter'
    });
  });
});
```

#### MICROFASE 2.5.2: Tests de Integración End-to-End

```typescript
// __tests__/features/integrations/soft-restaurant-fase2/sr-processing-flow.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('SR Processing Flow (Integration)', () => {
  // =====================
  // G1: Performance < 30s
  // =====================
  it('G1: should process a sale in under 30 seconds', async () => {
    // Arrange
    const saleId = await createTestSale();
    const startTime = Date.now();

    // Act
    await SRJobQueueService.queueForProcessing(saleId);
    const processor = new SoftRestaurantProcessor();
    await processor.processSale(saleId);

    // Assert
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(30000);
  });

  // =====================
  // G3: No Duplication (CRITICAL)
  // =====================
  it('G3: should NOT duplicate inventory deductions when processing twice', async () => {
    // Arrange
    const saleId = await createTestSaleWithRecipe();
    const initialStock = await getInventoryStock(testItemId);

    // Act - Process twice
    const processor = new SoftRestaurantProcessor();
    await processor.processSale(saleId);
    await processor.processSale(saleId); // Second call

    // Assert
    const finalStock = await getInventoryStock(testItemId);
    const expectedDeduction = testRecipeQuantity * testSaleQuantity;

    // Stock should only be deducted ONCE
    expect(initialStock - finalStock).toBe(expectedDeduction);
    expect(initialStock - finalStock).not.toBe(expectedDeduction * 2);
  });

  // =====================
  // G3: SR vs Internal Order isolation
  // =====================
  it('G3: SR orders and internal orders should use separate deduction paths', async () => {
    // Arrange
    const srSaleId = await createTestSRSale();
    const internalOrderId = await createTestInternalOrder();

    // Act
    await processSRSale(srSaleId);
    await processInternalOrder(internalOrderId);

    // Assert
    const srMovements = await getMovementsByReference('sr_sale', srSaleId);
    const internalMovements = await getMovementsByReference('restaurant_order', internalOrderId);

    // Verify different reference types
    expect(srMovements[0].reference_type).toBe('sr_sale');
    expect(internalMovements[0].reference_type).toBe('restaurant_order');
  });
});
```

#### MICROFASE 2.5.3: Tests de Retry y Dead Letter

```typescript
// __tests__/features/integrations/soft-restaurant-fase2/sr-retry-dlq.test.ts

describe('SR Retry and Dead Letter Queue', () => {
  // =====================
  // G4: Retry mechanism
  // =====================
  it('G4: should retry failed sales up to 3 times', async () => {
    // Arrange
    const saleId = await createTestSaleThatWillFail();

    // Act - Simulate 3 failures
    for (let i = 0; i < 3; i++) {
      await SRJobQueueService.markFailed(saleId, 'Simulated failure', i);
    }

    // Assert
    const sale = await getSale(saleId);
    expect(sale.retry_count).toBe(3);
    expect(sale.status).toBe('dead_letter');
  });

  // =====================
  // G5: Dead letter marking
  // =====================
  it('G5: should mark as dead_letter after max retries', async () => {
    // Arrange
    const saleId = await createTestSale();

    // Act
    const result = await SRJobQueueService.markFailed(saleId, 'Final failure', 2);

    // Assert
    expect(result.shouldRetry).toBe(false);

    const sale = await getSale(saleId);
    expect(sale.status).toBe('dead_letter');
  });
});
```

### 10.3 Matriz de Cobertura de Tests

| Archivo | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| `sr-job-queue.service.ts` | ≥90% | ≥85% | ≥95% | ≥90% |
| `soft-restaurant/process/route.ts` | ≥85% | ≥80% | ≥90% | ≥85% |
| `cron/process-sr-sales/route.ts` | ≥85% | ≥80% | ≥90% | ≥85% |

### 10.4 Comando para Ejecutar Tests

```bash
# Ejecutar todos los tests de FASE 2
pnpm test:vitest __tests__/features/integrations/soft-restaurant-fase2/

# Ejecutar con cobertura
pnpm test:vitest --coverage __tests__/features/integrations/soft-restaurant-fase2/

# Ejecutar test específico de no-duplicación
pnpm test:vitest -t "should NOT duplicate inventory deductions"
```

---

## 11. ROLLBACK PLAN

### 11.1 Rollback de Código

1. Revertir cambios en `webhook/route.ts` (quitar llamada a queue)
2. Eliminar cron de `vercel.json`
3. Los archivos nuevos pueden quedarse (no afectan si no se llaman)

### 11.2 Rollback de Datos

```sql
-- Revertir ventas en estados intermedios
UPDATE sr_sales
SET status = 'pending',
    error_message = 'Rollback: FASE 2 deshabilitada',
    processed_at = NULL
WHERE status IN ('queued', 'processing');

-- Las deducciones de inventario requieren reversión manual si es necesario
```

---

## 12. CHECKLIST PRE-IMPLEMENTACIÓN

- [ ] Documentación PRP aprobada por usuario
- [ ] Variables de entorno verificadas (`CRON_SECRET`, `INTERNAL_API_KEY`)
- [ ] Tablas de base de datos existen (`sr_sales`, `sr_sale_items`, etc.)
- [ ] Servicios existentes funcionan (`SoftRestaurantProcessor`, `RecipeDeductionService`)
- [ ] Tests actuales pasan (282 tests)

---

## 13. CHECKLIST POST-IMPLEMENTACIÓN

- [ ] Todos los tests nuevos pasan
- [ ] TypeScript sin errores
- [ ] ESLint sin errores
- [ ] Build exitoso
- [ ] Flujo manual probado en staging
- [ ] Monitoreo configurado
- [ ] Documentación actualizada

---

## 14. RESUMEN DE ARCHIVOS A CREAR/MODIFICAR

### Archivos Nuevos (4)

| Archivo | Líneas Aprox. | Descripción |
|---------|---------------|-------------|
| `src/features/integrations/services/sr-job-queue.service.ts` | ~180 | Servicio de cola para ventas SR |
| `app/api/soft-restaurant/process/route.ts` | ~200 | API de procesamiento de ventas |
| `app/api/cron/process-sr-sales/route.ts` | ~100 | Cron job para procesar batch |
| `supabase/migrations/XXX_claim_sr_sales_batch.sql` | ~30 | RPC para atomic claim |

### Archivos Modificados (2)

| Archivo | Cambios | Líneas Añadidas |
|---------|---------|-----------------|
| `app/api/soft-restaurant/webhook/route.ts` | Import + llamada a queue | ~15 |
| `vercel.json` | Nuevo cron entry | ~4 |

### Tests Nuevos (3 archivos)

| Archivo | Tests Aprox. |
|---------|--------------|
| `__tests__/.../sr-job-queue.service.test.ts` | ~15 tests |
| `__tests__/.../sr-processing-flow.integration.test.ts` | ~8 tests |
| `__tests__/.../sr-retry-dlq.test.ts` | ~6 tests |

**Total estimado:** ~700 líneas de código + ~400 líneas de tests

---

## 15. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

```
1. MICROFASE 2.5 (SQL)    → Crear RPC claim_sr_sales_batch
                              ↓
2. MICROFASE 2.1 (Service) → Crear SRJobQueueService
                              ↓
3. MICROFASE 2.2 (API)     → Crear /api/soft-restaurant/process
                              ↓
4. MICROFASE 2.4 (Cron)    → Crear /api/cron/process-sr-sales
                              ↓
5. MICROFASE 2.3 (Webhook) → Modificar webhook (mínimo cambio)
                              ↓
6. Tests                   → Crear todos los tests
                              ↓
7. Validación              → Ejecutar validation gates G1-G10
```

---

## APROBACIÓN

**Estado:** ⏳ Pendiente de aprobación

### Decisiones Técnicas para Confirmar

| # | Decisión | Opciones | Selección Propuesta |
|---|----------|----------|---------------------|
| 1 | Arquitectura de cola | Job Queue genérico vs sr_sales status | **sr_sales status** |
| 2 | Frecuencia de cron | 1 min vs 5 min | **5 minutos** |
| 3 | Máximo de reintentos | 3 vs 5 | **3 reintentos** |
| 4 | Backoff máximo | 1 hora vs 24 horas | **1 hora** |
| 5 | Batch size por cron | 10 vs 20 vs 50 | **20 ventas** |

### Para Proceder

Al aprobar este documento:
1. ✅ Las decisiones técnicas están confirmadas
2. ✅ Los validation gates están aceptados
3. ✅ El orden de implementación está aprobado
4. ✅ Puedo proceder con MICROFASE 2.5 (SQL) inmediatamente

---

*Documento PRP v1.1 - TIS TIS Platform*
*Alineado con: job-processor.service.ts, process-dlq/route.ts, api/jobs/process/route.ts*
*Última actualización: Enero 2026*
