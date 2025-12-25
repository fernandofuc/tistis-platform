# Sistema de Cache de Prompts Pre-Generados para Agentes IA

## Resumen Ejecutivo

El sistema de cache de prompts pre-generados es una optimizacion implementada para reducir significativamente el consumo de tokens y la latencia en las respuestas de los agentes de IA (voz y mensajeria). Los prompts se generan UNA VEZ cuando el usuario guarda cambios en Business IA, y se reutilizan en cada mensaje o llamada subsecuente.

### Beneficios Clave

| Metrica | Antes | Despues | Mejora |
|---------|-------|---------|--------|
| Tokens por request | ~5000 | ~1500 | -70% |
| Latencia de respuesta | Alta | Baja | Significativa |
| Costo por mensaje | Alto | Reducido | -70% aprox |
| Regeneracion de prompts | Cada mensaje | Solo cuando cambian datos | Bajo demanda |

---

## Arquitectura del Sistema

```
+-------------------+     +------------------------+     +------------------+
|   Usuario guarda  |     |   Gemini genera        |     |   ai_generated   |
|   cambios en      | --> |   prompt optimizado    | --> |   _prompts       |
|   Business IA     |     |   por canal            |     |   (cache DB)     |
+-------------------+     +------------------------+     +------------------+
                                                                   |
                                                                   v
+-------------------+     +------------------------+     +------------------+
|   Mensaje/Llamada |     |   getOptimizedPrompt() |     |   Respuesta IA   |
|   entrante        | --> |   busca en cache       | --> |   usando prompt  |
+-------------------+     +------------------------+     |   cacheado       |
                                                         +------------------+
```

### Flujo de Datos

1. **Generacion** (cuando el usuario guarda cambios):
   - Recopila contexto del negocio (servicios, sucursales, FAQs, etc.)
   - Calcula hash SHA256 de los datos
   - Gemini genera prompt optimizado segun el canal
   - Se guarda en `ai_generated_prompts` con el hash

2. **Uso en runtime** (cada mensaje/llamada):
   - `getOptimizedPrompt()` busca prompt cacheado
   - Verifica si el hash actual coincide (datos no cambiaron)
   - Si coincide, usa prompt cacheado (sin llamar a Gemini)
   - Si no coincide, regenera y actualiza cache

---

## Componentes del Sistema

### 1. Migracion SQL

**Archivo:** `/supabase/migrations/071_AI_GENERATED_PROMPTS_CACHE.sql`

#### Tablas Creadas

##### `ai_generated_prompts`
Almacena los prompts cacheados por tenant y canal.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID | Identificador unico |
| tenant_id | UUID | FK a tenants |
| channel | VARCHAR(50) | Canal: voice, whatsapp, instagram, facebook, tiktok, webchat |
| generated_prompt | TEXT | Prompt generado por Gemini |
| system_prompt | TEXT | Prompt para el system message del LLM |
| prompt_version | INTEGER | Version del prompt (se incrementa en cada regeneracion) |
| tokens_estimated | INTEGER | Estimacion de tokens del prompt |
| source_data_hash | VARCHAR(64) | Hash SHA256 de los datos fuente |
| generator_model | VARCHAR(100) | Modelo usado (default: gemini-2.0-flash-exp) |
| status | VARCHAR(20) | active, generating, failed, archived |
| usage_count | INTEGER | Cuantas veces se ha usado |
| last_used_at | TIMESTAMPTZ | Ultima vez que se uso |

**Constraint unico:** `(tenant_id, channel)` - un prompt por tenant+canal

##### `ai_prompt_generation_history`
Historial de todas las generaciones para auditoria.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID | Identificador unico |
| tenant_id | UUID | FK a tenants |
| channel | VARCHAR(50) | Canal del prompt |
| generated_prompt | TEXT | Prompt generado |
| source_data_hash | VARCHAR(64) | Hash de los datos |
| tokens_used | INTEGER | Tokens consumidos en generacion |
| generation_time_ms | INTEGER | Tiempo de generacion |
| success | BOOLEAN | Si fue exitoso |
| triggered_by | VARCHAR(50) | user_save, api_call, cron, manual |

#### Funciones RPC

| Funcion | Proposito |
|---------|-----------|
| `get_cached_prompt(p_tenant_id, p_channel)` | Obtiene prompt cacheado y actualiza estadisticas de uso |
| `calculate_source_data_hash(p_tenant_id)` | Calcula hash SHA256 de todos los datos del negocio |
| `check_prompt_needs_regeneration(p_tenant_id, p_channel)` | Compara hash actual vs cacheado |
| `upsert_generated_prompt(...)` | Inserta o actualiza prompt, registra en historial |

---

### 2. Servicio Principal

**Archivo:** `/src/features/ai/services/prompt-generator.service.ts`

#### Tipos Exportados

```typescript
type PromptType = 'voice' | 'messaging';
type CacheChannel = 'voice' | 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat';

interface CachedPromptResult {
  found: boolean;
  prompt_id?: string;
  generated_prompt?: string;
  system_prompt?: string;
  prompt_version?: number;
  source_data_hash?: string;
  last_updated?: string;
  needs_regeneration?: boolean;
}
```

#### Funciones de Cache

| Funcion | Descripcion |
|---------|-------------|
| `calculateBusinessContextHash(context)` | Calcula hash SHA256 del contexto del negocio |
| `getCachedPrompt(tenantId, channel)` | Obtiene prompt cacheado de la DB |
| `checkNeedsRegeneration(tenantId, channel)` | Verifica si datos cambiaron via RPC |
| `saveCachedPrompt(...)` | Guarda prompt en cache via RPC |
| `generateAndCachePrompt(tenantId, channel)` | Genera y cachea un prompt para un canal |
| `generateAndCacheAllPrompts(tenantId, promptType)` | Genera para todos los canales de un tipo |
| `getOptimizedPrompt(tenantId, channel)` | **Funcion principal para runtime** |
| `invalidatePromptCache(tenantId, channel?)` | Invalida cache (fuerza regeneracion) |

#### Uso Tipico

```typescript
// En runtime (cada mensaje/llamada)
const { prompt, fromCache, version } = await getOptimizedPrompt(tenantId, 'whatsapp');

// Cuando el usuario guarda cambios
const result = await generateAndCachePrompt(tenantId, 'voice');
```

---

### 3. Integracion con LangGraph AI Service

**Archivo:** `/src/features/ai/services/langgraph-ai.service.ts`

La funcion `loadTenantContext()` fue modificada para:

1. Aceptar parametro opcional `channel: CacheChannel`
2. Llamar a `getOptimizedPrompt()` para obtener prompt cacheado
3. Usar el prompt cacheado como `system_prompt` del tenant

```typescript
async function loadTenantContext(
  tenantId: string,
  channel: CacheChannel = 'whatsapp'
): Promise<TenantInfo | null> {
  // ...
  const { prompt: cachedPrompt, fromCache, version } = await getOptimizedPrompt(tenantId, channel);

  if (fromCache) {
    console.log(`Using cached prompt v${version} for channel ${channel}`);
  }

  const systemPrompt = cachedPrompt || data.ai_config?.system_prompt || '';
  // ...
}
```

La funcion `generateAIResponseWithGraph()` ahora:

1. Determina el canal efectivo de la conversacion
2. Pasa el canal a `loadTenantContext()`
3. Soporta parametro opcional `channel` para override

---

### 4. Integracion con Voice LangGraph Service

**Archivo:** `/src/features/voice-agent/services/voice-langgraph.service.ts`

La funcion `processVoiceMessage()` fue modificada para:

1. Obtener prompt cacheado para canal 'voice' primero
2. Usar el prompt cacheado si existe
3. Fallback a generacion dinamica si no hay cache

```typescript
const { prompt: cachedVoicePrompt, fromCache, version } = await getOptimizedPrompt(
  context.tenant_id,
  'voice'
);

if (cachedVoicePrompt) {
  finalSystemPrompt = cachedVoicePrompt;
} else {
  // Fallback: generar instrucciones de voz dinamicamente
  const voiceInstructions = generateVoiceInstructions(context.voice_config);
  finalSystemPrompt = `${tenantContext.ai_config.system_prompt}\n\n${voiceInstructions}`;
}
```

---

### 5. API Routes

#### `/api/ai-config/generate-prompt`

**Archivo:** `/app/api/ai-config/generate-prompt/route.ts`

| Metodo | Descripcion |
|--------|-------------|
| POST | Genera y cachea prompt para mensajeria. Acepta `channel` en body. |
| GET | Retorna estado del cache, version, y si necesita regeneracion. |

**Respuesta GET incluye:**
```json
{
  "cache_status": {
    "channel": "whatsapp",
    "has_cached_prompt": true,
    "cached_prompt_version": 3,
    "last_generated": "2024-12-25T10:30:00Z",
    "needs_regeneration": false
  }
}
```

#### `/api/voice-agent/generate-prompt`

**Archivo:** `/app/api/voice-agent/generate-prompt/route.ts`

| Metodo | Descripcion |
|--------|-------------|
| POST | Genera y cachea prompt para voz. |
| GET | Retorna estado del cache para canal 'voice'. |

---

## Algoritmo de Hash

El hash se calcula sobre los siguientes datos del negocio:

- Nombre del tenant y vertical
- Nombre y personalidad del asistente
- Instrucciones personalizadas
- Sucursales (nombre, direccion, telefono, horarios)
- Servicios (nombre, descripcion, precios, duracion, promociones)
- Staff (nombre, rol, especialidad)
- FAQs
- Instrucciones personalizadas (Knowledge Base)
- Politicas del negocio
- Articulos de conocimiento
- Templates de respuesta
- Manejo de competidores
- Configuracion de escalacion

**Proceso:**
1. Se crea un objeto JSON con todos los datos
2. Se ordena las claves alfabeticamente (JSON estable)
3. Se calcula SHA256 del string JSON
4. El hash de 64 caracteres se almacena en la DB

---

## Casos de Uso

### Caso 1: Usuario guarda cambios en Business IA

```
1. Usuario modifica servicios/FAQs/etc en el dashboard
2. Click en "Guardar"
3. Frontend llama POST /api/ai-config/generate-prompt
4. Backend:
   a. Recopila contexto del negocio
   b. Calcula hash de los datos
   c. Compara con hash existente
   d. Si es diferente: Gemini genera nuevo prompt
   e. Se guarda en ai_generated_prompts
   f. Se registra en historial
5. Respuesta con prompt generado
```

### Caso 2: Mensaje entrante de WhatsApp

```
1. Webhook recibe mensaje
2. LangGraph service procesa
3. loadTenantContext() llama getOptimizedPrompt('whatsapp')
4. getOptimizedPrompt():
   a. Busca en cache (get_cached_prompt RPC)
   b. Verifica hash (check_prompt_needs_regeneration RPC)
   c. Si cache valido: retorna prompt (sin Gemini)
   d. Si cache invalido: regenera y cachea
5. El prompt cacheado se usa en el LLM
6. Respuesta rapida al usuario
```

### Caso 3: Llamada telefonica entrante

```
1. Vapi webhook recibe llamada
2. Voice LangGraph procesa transcripcion
3. processVoiceMessage() llama getOptimizedPrompt('voice')
4. Mismo flujo que Caso 2, pero para canal 'voice'
5. Prompt optimizado para voz se usa
6. Respuesta rapida y natural
```

---

## Mantenimiento

### Invalidar Cache Manualmente

Si es necesario forzar regeneracion:

```typescript
import { invalidatePromptCache } from '@/src/features/ai/services/prompt-generator.service';

// Invalidar todos los canales de un tenant
await invalidatePromptCache(tenantId);

// Invalidar solo un canal
await invalidatePromptCache(tenantId, 'voice');
```

### Monitoreo

Consultar estadisticas de uso:

```sql
SELECT
  channel,
  usage_count,
  last_used_at,
  prompt_version,
  status
FROM ai_generated_prompts
WHERE tenant_id = 'uuid-del-tenant';
```

Consultar historial de regeneraciones:

```sql
SELECT
  channel,
  success,
  generation_time_ms,
  tokens_used,
  triggered_by,
  created_at
FROM ai_prompt_generation_history
WHERE tenant_id = 'uuid-del-tenant'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Consideraciones de Seguridad

1. **RLS Policies**: Ambas tablas tienen Row Level Security habilitado
2. **Tenant Isolation**: Los prompts solo son accesibles por usuarios del mismo tenant
3. **Service Role**: Las funciones RPC usan `SECURITY DEFINER` para bypass de RLS cuando es necesario
4. **No Secrets**: Los prompts no contienen credenciales, solo informacion del negocio

---

## Troubleshooting

### El cache no se actualiza despues de cambios

1. Verificar que el hash esta cambiando:
```sql
SELECT source_data_hash
FROM ai_generated_prompts
WHERE tenant_id = 'xxx' AND channel = 'voice';
```

2. Comparar con hash calculado:
```sql
SELECT calculate_source_data_hash('tenant-uuid');
```

3. Si son iguales, los datos realmente no cambiaron

### Prompts no se generan

1. Verificar que Gemini esta configurado:
```typescript
import { isGeminiConfigured } from '@/src/shared/lib/gemini';
console.log(isGeminiConfigured()); // debe ser true
```

2. Revisar logs del servidor para errores de API

### Performance lenta

1. Verificar indices en la tabla:
```sql
\d+ ai_generated_prompts
```

2. Los indices `idx_ai_generated_prompts_tenant_channel` y `idx_ai_generated_prompts_hash` deben existir

---

## Archivos Relacionados

| Archivo | Descripcion |
|---------|-------------|
| `/supabase/migrations/071_AI_GENERATED_PROMPTS_CACHE.sql` | Migracion de base de datos |
| `/src/features/ai/services/prompt-generator.service.ts` | Servicio principal de cache |
| `/src/features/ai/services/langgraph-ai.service.ts` | Integracion con mensajeria |
| `/src/features/voice-agent/services/voice-langgraph.service.ts` | Integracion con voz |
| `/app/api/ai-config/generate-prompt/route.ts` | API para mensajeria |
| `/app/api/voice-agent/generate-prompt/route.ts` | API para voz |

---

## Historial de Cambios

| Fecha | Version | Descripcion |
|-------|---------|-------------|
| 2024-12-25 | 1.0 | Implementacion inicial del sistema de cache |

---

*Documento generado: 2024-12-25*
*Ultima actualizacion: 2024-12-25*
