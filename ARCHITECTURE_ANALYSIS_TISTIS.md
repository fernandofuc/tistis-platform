# 🔍 TIS TIS - Diagnóstico Arquitectónico y Plan de Mejora

> **Documento para análisis de Claude Code**
> Objetivo: Evaluar factibilidad de mejoras sin dañar funcionalidades existentes
> Fecha: Diciembre 2024

---

## 📋 RESUMEN EJECUTIVO

**Estado actual:** La plataforma funciona pero tiene problemas de arquitectura que causarán fallas a medida que crezca.

**Problema principal:** Flujo secuencial (cadena) en lugar de flujo paralelo con estado (grafo).

**Riesgo si no se mejora:** Pérdida de mensajes, respuestas duplicadas, imposibilidad de escalar más allá de 20 clientes.

**Solución propuesta:** Migrar orquestación a Inngest manteniendo TODA la lógica de negocio existente.

---

## 1. PROBLEMAS IDENTIFICADOS EN EL CÓDIGO

### 🔴 PROBLEMA #1: Flujo Secuencial Sin Recuperación

**Archivo:** `src/features/messaging/services/whatsapp.service.ts`
**Función:** `processIncomingMessage()` (líneas ~280-320)

```typescript
// CÓDIGO ACTUAL - Cada paso depende del anterior
async function processIncomingMessage(...): Promise<void> {
  const parsedMessage = parseWhatsAppMessage(...);           // Paso 1
  const lead = await findOrCreateLead(...);                  // Paso 2 - Si falla, todo falla
  const conversation = await findOrCreateConversation(...);  // Paso 3 - Si falla, lead queda huérfano
  const messageId = await saveIncomingMessage(...);          // Paso 4 - Si falla, datos inconsistentes
  await enqueueAIResponseJob(...);                           // Paso 5 - Si falla, sin respuesta AI
}
```

**¿Qué pasa si falla?**
| Si falla en... | Resultado |
|----------------|-----------|
| Paso 2 (Lead) | Mensaje perdido completamente |
| Paso 3 (Conversación) | Lead existe pero sin conversación asociada |
| Paso 4 (Guardar mensaje) | Conversación existe pero sin el mensaje |
| Paso 5 (Job AI) | Mensaje guardado pero cliente nunca recibe respuesta |

**Evidencia del problema:**
- No hay `try/catch` individual por paso
- No hay transacción de base de datos que envuelva todo
- No hay mecanismo de compensación (rollback)
- Los errores se pierden en `console.error`

---

### 🔴 PROBLEMA #2: Generación AI Secuencial y Lenta

**Archivo:** `src/features/ai/services/ai.service.ts`
**Función:** `generateAIResponse()` (líneas ~400-600)

```typescript
// CÓDIGO ACTUAL - Todo es secuencial
const extractionResult = performFullExtraction(...);        // ~50ms

if (extractionResult.should_update_lead) {
  await updateLeadWithExtractedData(...);                   // ~100ms - ESPERA
}

if (extractionResult.service_interest) {
  await recordServiceInterest(...);                         // ~100ms - ESPERA
}

if (intent === 'BOOK_APPOINTMENT') {
  const bookingResult = await createBooking(...);           // ~200ms - ESPERA
}

const completion = await openai.chat.completions.create(...); // ~800-2000ms - ESPERA

// TIEMPO TOTAL: 1250-2450ms (podría ser 800-1200ms con paralelización)
```

**¿Qué pasa si no se mejora?**
- Tiempo de respuesta 2-4 segundos (competidores responden en 1-2 seg)
- Clientes se impacientan y escriben de nuevo (genera duplicados)
- Consumo innecesario de recursos de servidor

---

### 🔴 PROBLEMA #3: Sin Idempotencia en Webhooks

**Archivo:** `app/api/webhook/whatsapp/[tenantSlug]/route.ts`

```typescript
// CÓDIGO ACTUAL - No verifica duplicados
export async function POST(request: NextRequest, context: RouteParams) {
  // ...
  // Meta puede enviar el mismo webhook 2-3 veces si hay timeout
  // No hay verificación de "¿ya procesé este mensaje?"
  processWebhookBackground(tenantSlug, payload);
  return NextResponse.json({ received: true });
}
```

**¿Qué pasa si no se mejora?**
- Mensajes duplicados en conversaciones
- Respuestas AI duplicadas al mismo mensaje
- Datos de leads sobrescritos incorrectamente
- Confusión en el dashboard

---

### 🔴 PROBLEMA #4: Job Queue Básico Sin Observabilidad

**Archivo:** `src/features/ai/services/job-processor.service.ts`

```typescript
// CÓDIGO ACTUAL - Solo 3 reintentos, sin alertas
export async function failJob(jobId: string, errorMessage: string) {
  if (job.attempts < job.max_attempts) {
    // Retry con exponential backoff ✓
  } else {
    // Job se marca como 'failed' y... ¿qué pasa después?
    // Nadie lo revisa, nadie recibe alerta
    // El cliente nunca recibe respuesta
  }
}
```

**¿Qué pasa si no se mejora?**
- Jobs fallidos se pierden silenciosamente
- Sin forma de saber cuántos mensajes fallan por día
- Sin alertas cuando algo va mal
- Debug manual que toma horas

---

### 🟠 PROBLEMA #5: Sin Validación Post-Proceso

**Archivo:** `src/features/ai/services/ai.service.ts`

```typescript
// CÓDIGO ACTUAL - Se asume que todo funcionó
if (bookingResult.success) {
  appointmentCreated = { ... };
  // Pero... ¿realmente se creó la cita?
  // ¿Se envió la notificación?
  // ¿El calendario se actualizó?
  // No hay verificación
}
```

**¿Qué pasa si no se mejora?**
- Citas "creadas" que no existen
- Confirmaciones enviadas de citas fantasma
- Clientes que llegan a citas que nadie sabe que existen

---

## 2. IMPACTO DE NO MEJORAR

### Escenario: Próximos 6 Meses Sin Cambios

```
MES 1-2 (5-10 clientes):
├── ~50 mensajes fallidos/semana (no detectados)
├── 2-3 quejas de clientes por semana
├── Equipo investiga manualmente cada caso
└── Tiempo perdido: ~10 hrs/semana

MES 3-4 (15-20 clientes):
├── ~150 mensajes fallidos/semana
├── Clientes empiezan a cancelar suscripciones
├── Reputación comienza a dañarse
└── Equipo dedica 30% del tiempo a "apagar incendios"

MES 5-6 (intentando 30+ clientes):
├── Sistema no escala, errores frecuentes
├── Churn rate sube a 10-15% mensual
├── Nuevos clientes no se quedan
└── Decisión: reescribir todo o cerrar
```

### Costo Financiero Estimado

| Concepto | Sin Mejoras (6 meses) | Con Mejoras (6 meses) |
|----------|----------------------|----------------------|
| Clientes perdidos por fallas | 15-20 | 3-5 |
| Revenue perdido | $150-200K MXN | $30-50K MXN |
| Horas debug/soporte | 240 hrs | 60 hrs |
| Costo reescritura eventual | $300-500K MXN | $0 |

---

## 3. SOLUCIÓN PROPUESTA: INNGEST

### ¿Por Qué Inngest?

| Característica | Sistema Actual | Con Inngest |
|----------------|---------------|-------------|
| Reintentos automáticos | Básico (3x) | Configurable, con backoff inteligente |
| Ejecución paralela | No | Sí, nativo |
| Estado entre pasos | No | Sí, persistente |
| Idempotencia | Manual | Automática |
| Observabilidad | console.log | Dashboard completo con traces |
| Integración Next.js | N/A | Nativa, un archivo |
| Costo | $0 | $0 (hasta 10K eventos/mes) |

### Principio Clave de la Migración

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LA LÓGICA DE NEGOCIO NO SE MODIFICA                          │
│                                                                 │
│   Solo se cambia CÓMO se orquesta, no QUÉ se ejecuta           │
│                                                                 │
│   Las funciones existentes se IMPORTAN en Inngest              │
│   No se reescriben                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Ejemplo Concreto

**ANTES (secuencial, sin recuperación):**
```typescript
// whatsapp.service.ts
async function processIncomingMessage(...) {
  const lead = await findOrCreateLead(...);
  const conversation = await findOrCreateConversation(...);
  const messageId = await saveIncomingMessage(...);
  await enqueueAIResponseJob(...);
}
```

**DESPUÉS (Inngest orquesta, mismas funciones):**
```typescript
// inngest/functions/process-whatsapp-message.ts
import { findOrCreateLead, findOrCreateConversation, saveIncomingMessage } from '@/src/features/messaging/services/whatsapp.service';

export const processWhatsAppMessage = inngest.createFunction(
  { id: 'process-whatsapp-message', retries: 3, idempotency: 'event.data.messageId' },
  { event: 'whatsapp/message.received' },
  async ({ event, step }) => {
    // MISMAS FUNCIONES, diferente orquestación
    const lead = await step.run('create-lead', () => findOrCreateLead(...));
    const conversation = await step.run('create-conversation', () => findOrCreateConversation(...));
    const messageId = await step.run('save-message', () => saveIncomingMessage(...));
    // Inngest maneja reintentos, estado, observabilidad
  }
);
```

---

## 4. ARCHIVOS DEL PROYECTO - CLASIFICACIÓN

### 🔴 NO MODIFICAR (Lógica de Negocio Crítica)

Estos archivos contienen lógica probada y calibrada. Modificarlos puede romper funcionalidades.

| Archivo | Razón |
|---------|-------|
| `src/features/ai/services/ai.service.ts` | System prompts optimizados, reglas de scoring, detección de intenciones |
| `src/features/ai/services/appointment-booking.service.ts` | Lógica de disponibilidad y creación de citas |
| `src/features/ai/services/data-extraction.service.ts` | Extracción de datos de mensajes |
| `src/shared/config/plans.ts` | Precios sincronizados con Stripe |
| `src/features/auth/*` | Autenticación y seguridad |
| `src/hooks/useTenant.ts` | Aislamiento multi-tenant |
| `middleware.ts` | Protección de rutas |
| `supabase/migrations/*.sql` | Migraciones ya ejecutadas |

### 🟡 MODIFICAR CON PRECAUCIÓN (Agregar Feature Flag)

Estos archivos se pueden modificar, pero usando feature flags para rollback fácil.

| Archivo | Modificación Permitida |
|---------|----------------------|
| `app/api/webhook/whatsapp/[tenantSlug]/route.ts` | Agregar dispatch a Inngest con feature flag |
| `app/api/webhook/instagram/[tenantSlug]/route.ts` | Agregar dispatch a Inngest con feature flag |
| `app/api/webhook/tiktok/[tenantSlug]/route.ts` | Agregar dispatch a Inngest con feature flag |
| `src/features/messaging/services/whatsapp.service.ts` | Solo agregar exports si faltan |

### 🟢 CREAR NUEVOS (Sin Riesgo)

Estos archivos son nuevos y no afectan código existente.

| Archivo a Crear | Propósito |
|-----------------|-----------|
| `src/lib/inngest/client.ts` | Cliente de Inngest |
| `src/lib/inngest/functions/index.ts` | Exports de funciones |
| `src/lib/inngest/functions/process-whatsapp-message.ts` | Orquestación de mensajes |
| `src/lib/inngest/functions/generate-ai-response.ts` | Orquestación de AI |
| `src/lib/inngest/functions/send-outbound-message.ts` | Orquestación de envíos |
| `app/api/inngest/route.ts` | Endpoint de Inngest |

---

## 5. PLAN DE IMPLEMENTACIÓN SEGURO

### Fase 1: Crear Sin Afectar (Riesgo: CERO)

```bash
# Solo crear archivos nuevos
npm install inngest

# Crear estructura
mkdir -p src/lib/inngest/functions
touch src/lib/inngest/client.ts
touch src/lib/inngest/functions/index.ts
touch app/api/inngest/route.ts
```

**Verificación:** El sistema sigue funcionando exactamente igual.

### Fase 2: Implementar Funciones (Riesgo: CERO)

Escribir las funciones de Inngest que IMPORTAN la lógica existente.

```typescript
// Las funciones de Inngest llaman a las funciones existentes
import { findOrCreateLead } from '@/src/features/messaging/services/whatsapp.service';
// NO reescriben la lógica
```

**Verificación:** El sistema sigue funcionando exactamente igual (Inngest aún no está activo).

### Fase 3: Agregar Feature Flag (Riesgo: BAJO)

```typescript
// En webhook, agregar condicional
const USE_INNGEST = process.env.USE_INNGEST === 'true';

if (USE_INNGEST) {
  await inngest.send({ name: 'whatsapp/message.received', data: {...} });
} else {
  await processWebhookBackground(tenantSlug, payload); // Código actual
}
```

**Variable en Vercel:** `USE_INNGEST=false` (desactivado por defecto)

**Verificación:** El sistema sigue funcionando exactamente igual (flag está en false).

### Fase 4: Activar Gradualmente (Riesgo: CONTROLADO)

```
Día 1:  USE_INNGEST=true para 1 tenant de prueba
Día 2:  Monitorear, verificar que todo funciona
Día 3:  Si OK, activar para 5 tenants
Día 7:  Si OK, activar para todos
Día 14: Si OK, remover código antiguo
```

**Rollback:** Cambiar `USE_INNGEST=false` y todo vuelve a funcionar como antes.

---

## 6. INSTRUCCIONES PARA CLAUDE CODE

### Reglas Absolutas

```
✅ PERMITIDO:
- Crear archivos nuevos en src/lib/inngest/
- Leer cualquier archivo para entender la lógica
- Agregar feature flags a webhooks
- Agregar variables de entorno nuevas
- Crear tests

⚠️ REQUIERE CONFIRMACIÓN:
- Modificar cualquier archivo en src/features/
- Agregar dependencias nuevas (excepto inngest)
- Modificar tipos en src/shared/types/

❌ PROHIBIDO:
- Modificar lógica de ai.service.ts (prompts, scoring, intenciones)
- Modificar lógica de appointment-booking.service.ts
- Modificar autenticación o middleware
- Eliminar código existente sin feature flag
- Modificar migraciones SQL
- Modificar configuración de Stripe/planes
```

### Orden de Trabajo Sugerido

```
1. Leer y entender:
   - src/features/messaging/services/whatsapp.service.ts
   - src/features/ai/services/ai.service.ts
   - app/api/webhook/whatsapp/[tenantSlug]/route.ts

2. Crear estructura base:
   - src/lib/inngest/client.ts
   - app/api/inngest/route.ts

3. Implementar función principal:
   - src/lib/inngest/functions/process-whatsapp-message.ts
   (importando funciones existentes, NO reescribiendo)

4. Implementar función AI:
   - src/lib/inngest/functions/generate-ai-response.ts
   (importando funciones existentes, NO reescribiendo)

5. Implementar función de envío:
   - src/lib/inngest/functions/send-outbound-message.ts

6. Modificar webhook con feature flag:
   - app/api/webhook/whatsapp/[tenantSlug]/route.ts

7. Documentar y probar
```

### Preguntas que Claude Code Debe Hacerse

```
Antes de modificar cualquier archivo:

□ ¿Este archivo está en la lista de "NO MODIFICAR"?
  → Si SÍ: No tocarlo, buscar alternativa

□ ¿Estoy reescribiendo lógica o solo importándola?
  → Si reescribiendo: PARAR, debe importar la existente

□ ¿El cambio es reversible con un feature flag?
  → Si NO: Reconsiderar approach

□ ¿Puedo probar este cambio sin afectar producción?
  → Si NO: Agregar feature flag primero
```

### Cómo Verificar que No Se Rompió Nada

```typescript
// Test básico: El webhook sigue funcionando
// 1. Enviar mensaje de prueba a WhatsApp
// 2. Verificar en Supabase:
//    - Lead creado/actualizado
//    - Conversación creada/actualizada
//    - Mensaje guardado
//    - Respuesta AI generada
//    - Mensaje de respuesta enviado

// 3. Verificar tiempos:
//    - Respuesta en < 5 segundos
//    - Sin errores en logs
```

---

## 7. RESUMEN PARA CLAUDE CODE

### El Problema en Una Frase
> El código actual procesa mensajes en cadena secuencial, si un paso falla todo falla y no hay recuperación automática.

### La Solución en Una Frase
> Usar Inngest para orquestar los MISMOS pasos pero con reintentos automáticos, paralelización y observabilidad.

### Lo Que NO Debe Cambiar
> La lógica de negocio: cómo se crean leads, cómo se genera AI, cómo se crean citas, cómo se calculan scores.

### Lo Que SÍ Debe Cambiar
> La orquestación: en lugar de `await` secuenciales, usar `step.run()` de Inngest que maneja errores y reintentos.

### Criterio de Éxito
> - Sistema funciona igual que antes (mismos resultados)
> - Pero con reintentos automáticos
> - Pero con observabilidad (dashboard Inngest)
> - Pero con paralelización donde sea posible
> - Pero sin duplicados (idempotencia)

---

## ANEXO: Dependencias y Configuración

### Instalar
```bash
npm install inngest
```

### Variables de Entorno
```bash
# .env.local
INNGEST_SIGNING_KEY=signkey_xxx     # Desde dashboard Inngest
INNGEST_EVENT_KEY=eventkey_xxx      # Desde dashboard Inngest  
USE_INNGEST=false                    # Feature flag
```

### Estructura Final de Archivos Nuevos
```
src/lib/inngest/
├── client.ts
└── functions/
    ├── index.ts
    ├── process-whatsapp-message.ts
    ├── generate-ai-response.ts
    └── send-outbound-message.ts

app/api/inngest/
└── route.ts
```

---

**Fin del documento**
**Para uso de Claude Code en análisis de factibilidad**
