# TIS TIS Platform - Voice Agent System

**Versión:** 3.0.0
**Última actualización:** 20 de Enero, 2026
**Estado:** Voice Agent v3.0 - Production Ready

---

## ⚠️ NOTA IMPORTANTE

Este documento describe la arquitectura original del Voice Agent v1.0. Para la arquitectura actual v3.0, consultar:

- **[ARQUITECTURA-AGENTES-V3.md](../.claude/docs/ARQUITECTURA-AGENTES-V3.md)** - Arquitectura completa v3.0
- **[HYBRID_PROMPT_SYSTEM.md](../.claude/docs/HYBRID_PROMPT_SYSTEM.md)** - Sistema de prompts híbridos

---

## Novedades Voice Agent v3.0 (Enero 2026)

### Security Gate (5 Capas)
1. IP Whitelist validation
2. HMAC Signature verification
3. Timestamp freshness check
4. Rate Limit enforcement
5. Content-Type validation

### Circuit Breaker
- Timeout: 8 segundos
- Failure threshold: 5 fallos consecutivos
- Reset timeout: 30 segundos

### Tools Implementados (32 total)
- **Common (5):** get_business_hours, get_business_info, transfer_to_human, request_invoice, end_call
- **Restaurant (14):** check_availability, create/modify/cancel_reservation, get_menu, search_menu, etc.
- **Dental (13):** check_appointment_availability, create/modify/cancel_appointment, get_doctors, etc.

### Capabilities (17 total)
- **Shared:** business_hours, business_info, human_transfer, faq, invoicing
- **Restaurant:** reservations, menu_info, recommendations, orders, order_status, promotions
- **Dental:** appointments, services_info, doctor_info, insurance_info, appointment_management, emergencies

### Archivos Principales v3.0
```
lib/voice-agent/
├── webhooks/
│   ├── security-gate.ts           # 5 capas de validación
│   ├── circuit-breaker.ts         # Patrón circuit breaker
│   └── handlers/                  # assistant-request, conversation-update, end-of-call
├── langgraph/
│   ├── state.ts                   # VoiceAgentState
│   ├── graph.ts                   # Grafo principal
│   └── nodes/                     # router, tool-executor, rag, response-generator
├── tools/                         # 32 tools implementados
├── types/                         # Capability, Tool types
└── services/                      # Template compiler, prompt generator
```

---

## Descripción General (v1.0 - Referencia Histórica)

El **Voice Agent System** de TIS TIS Platform es un sistema completo de atención al cliente por voz que permite:

- Responder llamadas entrantes automáticamente con un asistente de IA
- Generar prompts inteligentes basados en datos del tenant
- Integración con VAPI para gestión de llamadas
- Persistencia de llamadas y transcripciones
- Análisis de llamadas con LangGraph
- Scoring de leads basado en interacciones
- Escalamiento automático a agentes humanos

El sistema está diseñado como **multi-tenant** con aislamiento completo de datos por tenant.

---

## Arquitectura

```
LLAMADA ENTRANTE
      │
      ▼
TWILIO/VAPI WEBHOOK
      │
      ├─ Verificar tenant desde phone number
      ├─ Obtener voice_agent_config del tenant
      └─ Crear registro voice_call
      │
      ▼
GENERAR PROMPT AUTOMÁTICO
      │
      ├─ Ejecutar generate_voice_agent_prompt()
      ├─ Reemplazar variables ({services}, {doctors}, etc)
      └─ Obtener sistema_prompt final
      │
      ▼
VAPI PROCESAMIENTO DE LLAMADA
      │
      ├─ Recibir transcripts via webhook
      ├─ Guardar en voice_call_messages
      ├─ Analizar con LangGraph (intent, entities, sentiment)
      └─ Generar respuestas con AI
      │
      ▼
ALMACENAMIENTO Y ANÁLISIS
      │
      ├─ voice_calls - Metadata de llamada
      ├─ voice_call_messages - Transcripts
      └─ Scoring y estadísticas
      │
      ▼
ESCALAMIENTO (si aplica)
      │
      └─ Notificar a agentes humanos
```

---

## Tablas de Base de Datos

### voice_calls
Almacena metadata de llamadas:

```sql
CREATE TABLE voice_calls (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  voice_agent_config_id UUID REFERENCES voice_agent_config(id),
  phone_number_id UUID REFERENCES voice_phone_numbers(id),
  vapi_call_id VARCHAR(255) UNIQUE,           -- ID de VAPI

  -- Customer info
  customer_phone VARCHAR(20),
  customer_name VARCHAR(255),

  -- Call metadata
  call_direction 'inbound' | 'outbound',
  status 'queued' | 'ringing' | 'active' | 'held' | 'completed',

  -- Duration & Cost
  duration_seconds INTEGER,
  cost_usd DECIMAL(10,4),

  -- Outcomes
  outcome 'completed' | 'appointment_booked' | 'transferred' | 'disconnected',
  escalated BOOLEAN DEFAULT false,
  escalated_reason VARCHAR(500),

  -- Recording
  recording_url TEXT,
  transcript TEXT,

  -- Timestamps
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, vapi_call_id)
);
```

### voice_call_messages
Almacena mensajes/transcripts de cada llamada:

```sql
CREATE TABLE voice_call_messages (
  id UUID PRIMARY KEY,
  call_id UUID REFERENCES voice_calls(id),

  role 'user' | 'assistant' | 'system',
  content TEXT NOT NULL,

  sequence_number INTEGER,      -- Orden en la conversación
  confidence DECIMAL(3,2),      -- Para transcripción

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(call_id, sequence_number)
);
```

**Importante**: Se añadió policy RLS para permitir INSERT desde service_role:
```sql
CREATE POLICY "Service role can insert call messages"
    ON voice_call_messages
    FOR INSERT
    TO service_role
    WITH CHECK (true);
```

### voice_agent_config
Configuración del agente de voz por tenant:

```sql
CREATE TABLE voice_agent_config (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),

  -- Estado
  voice_enabled BOOLEAN DEFAULT false,
  voice_status 'inactive' | 'active' | 'paused',

  -- Assistant
  assistant_name VARCHAR(255) DEFAULT 'Asistente',
  first_message TEXT,
  first_message_mode 'assistant_speaks_first' | 'waits_for_user',

  -- System Prompt
  system_prompt TEXT,                           -- Auto-generado
  system_prompt_generated_at TIMESTAMP,
  custom_instructions TEXT,

  -- AI Model
  ai_model VARCHAR(50) DEFAULT 'claude-3-5-sonnet-20241022',
  ai_temperature DECIMAL(2,1) DEFAULT 0.7,
  ai_max_tokens INTEGER DEFAULT 500,

  -- Voice (11Labs)
  voice_id VARCHAR(100),
  voice_model VARCHAR(50) DEFAULT 'eleven_monolingual_v1',
  voice_stability DECIMAL(2,1) DEFAULT 0.75,
  voice_similarity_boost DECIMAL(2,1) DEFAULT 0.75,

  -- Transcription
  transcription_model VARCHAR(50) DEFAULT 'nova-2',
  transcription_provider VARCHAR(50) DEFAULT 'deepgram',
  transcription_language VARCHAR(10) DEFAULT 'es',

  -- Timing
  wait_seconds INTEGER DEFAULT 0,
  on_punctuation_seconds DECIMAL(3,1) DEFAULT 0.1,
  on_no_punctuation_seconds DECIMAL(3,1) DEFAULT 1.5,

  -- Call Control
  end_call_phrases TEXT[],
  recording_enabled BOOLEAN DEFAULT true,
  hipaa_enabled BOOLEAN DEFAULT false,

  -- Versioning
  configuration_version INTEGER DEFAULT 1,
  last_configured_at TIMESTAMP,
  last_configured_by UUID REFERENCES staff(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id)
);
```

### voice_phone_numbers
Números de teléfono para Voice Agent:

```sql
CREATE TABLE voice_phone_numbers (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  voice_agent_config_id UUID REFERENCES voice_agent_config(id),
  branch_id UUID REFERENCES branches(id),

  phone_number VARCHAR(20) UNIQUE,
  area_code VARCHAR(10),
  country_code VARCHAR(5) DEFAULT '+52',

  status 'pending' | 'active' | 'inactive' | 'provisioning',
  telephony_provider 'twilio' | 'vapi' | 'vonage',

  -- External IDs
  provider_phone_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, phone_number)
);
```

### voice_prompt_templates
Templates para generar prompts automáticamente:

```sql
CREATE TABLE voice_prompt_templates (
  id UUID PRIMARY KEY,
  vertical VARCHAR(50),                 -- 'dental', 'restaurant', 'services', etc
  template_key VARCHAR(100),            -- 'system_prompt', 'greeting', etc

  template_name VARCHAR(255),
  template_text TEXT NOT NULL,

  available_variables TEXT[],           -- [{assistant_name}, {services}, etc]
  first_message_template TEXT,
  recommended_config JSONB,             -- Suggested params for VAPI

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT voice_prompt_templates_vertical_key_default_unique
    UNIQUE (vertical, template_key, is_default)
);
```

---

## Funciones PostgreSQL Clave

### generate_voice_agent_prompt(p_tenant_id UUID)

**Propósito:** Generar automáticamente el prompt del asistente de voz basándose en datos del tenant.

**Proceso:**
1. Obtiene tenant data
2. Busca template para la vertical del tenant (dental, restaurant, services, etc)
3. Si no encuentra template, usa "dental" como fallback
4. Si tampoco hay dental, devuelve prompt mínimo
5. Construye listas de:
   - Servicios (con precios y duración)
   - Doctores/Staff (con especialidades)
   - Especialidades únicas
   - Sucursales (con direcciones y teléfonos)
   - Horarios de operación
   - Knowledge base (instrucciones personalizadas)
6. Reemplaza variables en el template
7. Devuelve prompt final

**Variables reemplazables:**
- `{assistant_name}` - Nombre del asistente
- `{business_name}` - Nombre del negocio
- `{address}` - Dirección principal
- `{phone}` - Teléfono principal
- `{operating_hours}` - Horarios
- `{services}` - Lista de servicios
- `{doctors}` - Lista de personal
- `{specialties}` - Especialidades
- `{branches}` - Lista de sucursales
- `{knowledge_base}` - Instrucciones personalizadas
- `{custom_instructions}` - Instrucciones especiales
- `{menu}` - Para restaurants

**Ejemplo de output:**
```
## Personalidad:
Eres María, un asistente de voz IA de ESVA Dental. Tienes un tono profesional y amigable.

## Información del Servicio:
### Negocio
- Nombre: ESVA Dental
- Dirección: Av. Principal 123
- Teléfono: +52 664 123 4567
- Horarios: Lunes a Viernes 9:00-18:00, Sábado 9:00-13:00

### Servicios Disponibles
- Limpieza Dental ($100-150 MXN) - 60 min
- Blanqueamiento ($300-500 MXN) - 90 min
- Implantes ($5000-8000 MXN) - 120 min

### Personal
- Dr. Juan García (Dentista General)
- Dra. María López (Especialista en Implantes)

### Sucursales
- ESVA Nogales: Av. Principal 123, Nogales - Tel: +52 664 123 4567
- ESVA Hermosillo: Calle Central 456, Hermosillo - Tel: +52 662 789 0123

## Citas:
[Instrucciones para agendar]

## Base de Conocimiento
[Respuestas a preguntas frecuentes personalizadas]
```

**Roles válidos para staff:**
- `'dentist'`
- `'specialist'`
- `'owner'`
- `'doctor'` (añadido en migración 068)
- `'provider'` (añadido en migración 068)

---

### get_voice_agent_context(p_tenant_id UUID)

**Propósito:** Obtener contexto completo para el Voice Agent.

**Devuelve:**
```json
{
  "tenant_id": "uuid",
  "config": { /* voice_agent_config */ },
  "phone_numbers": [ /* lista de números activos */ ],
  "services": [ /* servicios disponibles */ ],
  "staff": [ /* personal con especialidades */ ],
  "branches": [ /* sucursales con horarios */ ],
  "knowledge_base": [ /* instrucciones personalizadas */ ],
  "system_prompt": "el prompt generado"
}
```

---

### get_next_voice_config_version(p_tenant_id UUID)

**Propósito:** Obtener la siguiente versión de configuración.

**Uso:** En `updateVoiceConfig()` para mantener versioning de cambios.

---

## Índices de Base de Datos

Se crearon los siguientes índices para optimizar queries:

```sql
-- Búsqueda rápida por VAPI call ID
CREATE INDEX idx_voice_calls_vapi_id
ON voice_calls(vapi_call_id)
WHERE vapi_call_id IS NOT NULL;

-- Queries frecuentes por tenant
CREATE INDEX idx_voice_calls_tenant_created
ON voice_calls(tenant_id, created_at DESC);
```

---

## Servicio TypeScript (voice-agent.service.ts)

### Funciones Principales

#### getOrCreateVoiceConfig(tenantId)
Obtiene o crea la configuración inicial de Voice Agent para un tenant.

```typescript
const config = await getOrCreateVoiceConfig('tenant-uuid');
```

#### updateVoiceConfig(tenantId, updates, staffId?)
Actualiza la configuración y incrementa automáticamente `configuration_version`.

**IMPORTANTE:** No usa RPC `increment_config_version` (que no existe), sino UPDATE con versioning local.

```typescript
const updated = await updateVoiceConfig('tenant-uuid', {
  assistant_name: 'María',
  voice_id: 'EXAVITQu4vr4xnSDxMaL',
  ai_temperature: 0.5
}, 'staff-uuid');
```

#### toggleVoiceAgent(tenantId, enabled)
Activa/desactiva Voice Agent. Valida que exista al menos un número activo.

```typescript
const result = await toggleVoiceAgent('tenant-uuid', true);
if (!result.success) {
  console.error(result.error);
}
```

#### generatePrompt(tenantId)
Genera automáticamente el prompt del asistente usando `generate_voice_agent_prompt()`.

```typescript
const prompt = await generatePrompt('tenant-uuid');
// Automáticamente se guarda en voice_agent_config.system_prompt
```

#### getVoiceAgentContext(tenantId)
Obtiene contexto completo (llamadas a `get_voice_agent_context()` RPC).

```typescript
const context = await getVoiceAgentContext('tenant-uuid');
// Contiene: config, phone_numbers, services, staff, branches, knowledge_base, system_prompt
```

#### getPhoneNumbers(tenantId)
Lista todos los números de teléfono del tenant.

```typescript
const numbers = await getPhoneNumbers('tenant-uuid');
```

#### requestPhoneNumber(tenantId, areaCode, branchId?)
Solicita un nuevo número de teléfono.

**Validaciones:**
- Tenant debe tener plan "growth"
- Crea registro con status 'pending'

```typescript
const result = await requestPhoneNumber('tenant-uuid', '664', 'branch-uuid');
if (result.success) {
  console.log('Número solicitado:', result.phoneNumber.id);
}
```

#### getRecentCalls(tenantId, limit?, offset?)
Obtiene llamadas recientes del tenant.

```typescript
const calls = await getRecentCalls('tenant-uuid', 20, 0);
```

#### getCallDetails(callId, tenantId)
Obtiene detalles de una llamada específica.

```typescript
const call = await getCallDetails('call-uuid', 'tenant-uuid');
```

#### getCallMessages(callId)
Obtiene mensajes/transcripts de una llamada.

```typescript
const messages = await getCallMessages('call-uuid');
// [{id, role: 'user'|'assistant'|'system', content, sequence_number, created_at}]
```

#### getUsageSummary(tenantId, startDate?, endDate?)
Obtiene estadísticas de uso (últimos 30 días por defecto).

```typescript
const summary = await getUsageSummary('tenant-uuid');
// {
//   total_calls,
//   total_minutes,
//   total_cost_usd,
//   avg_call_duration_seconds,
//   appointment_booking_rate,
//   escalation_rate,
//   by_day: [{date, calls, minutes, cost_usd}]
// }
```

#### generateVAPIConfig(config)
Genera configuración para VAPI en formato esperado.

```typescript
const vapiConfig = generateVAPIConfig(voiceAgentConfig);
// Se usa para crear/actualizar assistant en VAPI
```

#### canAccessVoiceAgent(tenantId)
Verifica si el tenant tiene acceso (plan "growth" y status "active").

```typescript
const access = await canAccessVoiceAgent('tenant-uuid');
if (access.canAccess) {
  console.log('Voice Agent disponible');
} else {
  console.error(access.reason);
}
```

---

## Webhook VAPI (route.ts)

El webhook en `/api/voice-agent/webhook` procesa eventos de VAPI:

### Eventos Soportados

#### assistant-request
**Cuándo:** VAPI solicita asistente para una llamada entrante.

**Proceso:**
1. Extraer phone_number de VAPI call
2. Buscar tenant que posee ese número
3. Obtener voice_agent_config del tenant
4. Generar VAPI assistant config
5. Retornar configuración a VAPI

#### transcript
**Cuándo:** Se recibe un transcript de VAPI.

**Proceso:**
1. Obtener o crear voice_call si no existe
2. Insertar voice_call_message (con sequence_number y rol)
3. Guardar transcript en voice_calls.transcript

#### function-call
**Cuándo:** El LLM llama a una función configurada.

**Funciones soportadas:**
- `schedule_appointment` - Agendar cita
- `transfer_to_agent` - Escalamiento a agente
- `get_business_info` - Info del negocio

#### end-of-call-report
**Cuándo:** VAPI cierra la llamada.

**Proceso:**
1. Actualizar voice_calls con metadata final
2. Guardar recording_url
3. Análisis con LangGraph (sentiment, intent, outcome)
4. Actualizar lead scoring si aplica
5. Guardar transcripción completa

#### status-update
**Cuándo:** Estado de llamada cambia (ringing, active, etc).

**Proceso:**
1. Actualizar voice_calls.status

---

## Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# VAPI
VAPI_AUTH_TOKEN=xxx              # Token de VAPI
VAPI_WEBHOOK_SECRET=xxx          # Secret para validar webhooks

# 11Labs (Voice)
ELEVENLABS_API_KEY=xxx

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxx

# Deepgram (Transcription - opcional)
DEEPGRAM_API_KEY=xxx
```

---

## Plan de Restricción

**Nota:** Voice Agent está limitado al plan **Growth**.

```typescript
// En voice-agent.service.ts
export async function canAccessVoiceAgent(tenantId: string) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, status')
    .eq('id', tenantId)
    .single();

  if (tenant.plan !== 'growth') {
    return {
      canAccess: false,
      reason: 'Voice Agent solo está disponible en el plan Growth',
      plan: tenant.plan
    };
  }
  // ...
}
```

---

## Testing

### Verificar que Voice Agent está configurado

```bash
# 1. Verificar tenant existe y tiene plan growth
SELECT id, name, plan FROM tenants WHERE slug = 'mi-empresa';

# 2. Verificar voice_agent_config existe
SELECT * FROM voice_agent_config WHERE tenant_id = '[tenant-id]';

# 3. Verificar phone numbers
SELECT * FROM voice_phone_numbers WHERE tenant_id = '[tenant-id]';

# 4. Generar prompt
SELECT public.generate_voice_agent_prompt('[tenant-id]'::UUID);
```

### Simular llamada VAPI

```bash
# Simular assistant-request
curl -X POST http://localhost:3000/api/voice-agent/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VAPI_SECRET" \
  -d '{
    "type": "assistant-request",
    "call": {
      "id": "call-123",
      "phoneNumber": { "number": "+52 664 123 4567" },
      "customer": { "number": "+52 664 999 8888" }
    }
  }'

# Simular transcript
curl -X POST http://localhost:3000/api/voice-agent/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VAPI_SECRET" \
  -d '{
    "type": "transcript",
    "call": { "id": "call-123" },
    "transcript": {
      "text": "Hola, quiero una cita",
      "role": "user",
      "isFinal": true
    }
  }'
```

---

## Flujo Completo de una Llamada

```
1. Cliente llama a número de tenant
   │
   ├─ Twilio/VAPI recibe llamada
   │
2. VAPI envía "assistant-request" al webhook
   │
   ├─ Webhook obtiene tenant_id del phone_number
   ├─ Obtiene voice_agent_config del tenant
   ├─ Genera VAPI assistant config
   ├─ Retorna config a VAPI
   │
3. VAPI conecta con LLM (Claude)
   │
   ├─ System prompt: generado automáticamente
   ├─ Modelo: claude-3-5-sonnet-20241022 (configurable)
   │
4. Cliente y AI conversan
   │
   ├─ Cliente habla
   ├─ Deepgram transcribe (speech-to-text)
   ├─ Claude procesa y genera respuesta
   ├─ 11Labs sintetiza voz (text-to-speech)
   ├─ Cliente escucha respuesta
   │
5. VAPI envía "transcript" al webhook
   │
   ├─ Crear voice_call si no existe
   ├─ Insertar voice_call_message
   ├─ Guardar en voice_calls.transcript
   │
6. Llamada termina (sin escalamiento)
   │
7. VAPI envía "end-of-call-report" al webhook
   │
   ├─ Obtener voice_call
   ├─ Actualizar con metadata final
   ├─ Guardar recording_url
   ├─ Analizar con LangGraph
   ├─ Actualizar lead scores
   ├─ Guardar análisis final
   │
8. Registros en Supabase:
   │
   ├─ voice_calls: {id, tenant_id, vapi_call_id, customer_phone,
   │                status: 'completed', duration_seconds, transcript, ...}
   ├─ voice_call_messages: múltiples registros con la conversación
   └─ leads: actualizado con interacción de voz
```

---

## Troubleshooting

### Webhook recibe error "Tenant not found"

**Causa:** El número de teléfono no está asociado a un tenant.

**Solución:**
1. Verificar que voice_phone_numbers existe y tiene status 'active'
2. Verificar que voice_phone_numbers.tenant_id es correcto

```sql
SELECT * FROM voice_phone_numbers
WHERE phone_number = '+52 664 123 4567';
```

### Policy "Service role can insert call messages" no existe

**Causa:** La migración 068 no se aplicó.

**Solución:** Aplicar migración:
```bash
npx supabase migration up
```

### No se pueden insertar mensajes en voice_call_messages

**Causa:** Falta policy RLS o servicio role no tiene permisos.

**Solución:** Verificar policy:
```sql
SELECT * FROM pg_policies
WHERE tablename = 'voice_call_messages'
AND policyname = 'Service role can insert call messages';
```

Si no existe, ejecutar:
```sql
CREATE POLICY "Service role can insert call messages"
    ON voice_call_messages
    FOR INSERT
    TO service_role
    WITH CHECK (true);
```

### Index en vapi_call_id no mejora performance

**Causa:** El índice podría no estar siendo usado.

**Solución:** Verificar índice existe:
```sql
SELECT * FROM pg_indexes
WHERE tablename = 'voice_calls'
AND indexname = 'idx_voice_calls_vapi_id';
```

---

## Migraciones Aplicadas

### Migration 067_VOICE_AGENT.sql
- Crea tablas principales (voice_calls, voice_call_messages, etc)
- Crea tipos ENUM
- Crea funciones base (generate_voice_agent_prompt, get_voice_agent_context)
- Crea políticas RLS iniciales

### Migration 068_VOICE_AGENT_FIXES.sql
**Correcciones importantes aplicadas:**

1. **Policy INSERT en voice_call_messages** - El webhook necesitaba poder insertar
2. **Índice para vapi_call_id** - Búsquedas rápidas por VAPI call ID
3. **Función generate_voice_agent_prompt mejorada** - Mejor manejo de nulls y fallbacks
4. **Template fallback para "services"** - Vertical genérica si no hay vertical específica
5. **Roles de staff expandidos** - Añadido 'doctor' y 'provider'
6. **Políticas RLS verificadas** - Service role tiene acceso completo
7. **Función helper get_next_voice_config_version** - Para versioning de config
8. **Índice compuesto tenant_id + created_at** - Queries por tenant
9. **Constraint UNIQUE para voice_prompt_templates** - Necesario para ON CONFLICT

---

## Próximos Pasos

1. **Implementar LangGraph service** - Análisis automático de llamadas
2. **Dashboard de Voice Agent** - UI para ver calls y analytics
3. **Agendamiento automático** - Integración con appointmentService
4. **Escalamiento a agentes** - Queue de transferencias a humanos
5. **Reportes y analytics** - Dashboard de usage, sentiment, outcomes

---

## Referencias

- **VAPI Documentation:** https://docs.vapi.ai/
- **11Labs Documentation:** https://elevenlabs.io/docs/
- **Deepgram Documentation:** https://developers.deepgram.com/
- **Anthropic Claude:** https://docs.anthropic.com/

---

*Documentación técnica del Voice Agent System de TIS TIS Platform. Para soporte o cambios, contactar al equipo de desarrollo.*
