# Voice Agent Documentation Index

**Última actualización:** Diciembre 22, 2024
**Versión:** 1.0.0

Este documento actúa como índice y guía rápida para toda la documentación relacionada con el Voice Agent System.

---

## Documentos Disponibles

### 1. VOICE_AGENT_SYSTEM.md
**Descripción:** Documentación técnica completa del sistema
**Audiencia:** Desarrolladores, Arquitectos, DevOps
**Contenido:**
- Descripción general y arquitectura
- Diagrama de flujo de llamadas
- Esquema de base de datos (5 tablas)
- Funciones PostgreSQL y sus propósitos
- Índices de optimización
- Servicio TypeScript (voice-agent.service.ts)
- Webhook VAPI y eventos soportados
- Variables de entorno requeridas
- Restricciones de plan
- Testing y troubleshooting
- Migraciones aplicadas

**Usar cuando:** Necesites entender cómo funciona el sistema completo, integrar con Voice Agent, o debuggear problemas.

**Ruta:** `/docs/VOICE_AGENT_SYSTEM.md`

---

### 2. VOICE_AGENT_FIXES.md
**Descripción:** Detalle técnico de las 9 correcciones aplicadas
**Audiencia:** Desarrolladores, QA, DevOps, Architects
**Contenido:**
- Resumen ejecutivo de correcciones
- Cada corrección con:
  - Problema específico
  - Solución implementada
  - Código antes y después
  - Impacto en el sistema
  - Ubicaciones de archivos
- Cambios en TypeScript
- Testing post-correcciones
- Impacto en producción

**Usar cuando:** Necesites entender qué se corrigió, cómo, y por qué. Útil para code reviews y validación.

**Ruta:** `/docs/VOICE_AGENT_FIXES.md`

---

### 3. INTEGRATION_GUIDE.md (Sección Voice Agent)
**Descripción:** Guía práctica para integrar Voice Agent
**Audiencia:** Integradores, Product Managers, DevOps
**Contenido:**
- Prerequisites (VAPI, 11Labs, etc)
- Variables de entorno
- Phone number setup
- Voice Agent configuration
- Auto-generate prompt
- Webhook configuration
- Available functions
- Plan restrictions
- Call analytics
- Voice ID options
- Database tables
- Testing examples
- Checklist completo

**Usar cuando:** Estés configurando Voice Agent, integrando con tu tenant, o despliegando a producción.

**Ruta:** `/docs/INTEGRATION_GUIDE.md#-voice-agent-integration-vapi` (Sección)

---

### 4. MULTI_CHANNEL_AI_SYSTEM.md
**Descripción:** Sistema de messaging multi-canal (complementario)
**Audiencia:** Desarrolladores, Architects
**Contenido:**
- WhatsApp Business API
- Instagram Direct Messages
- Facebook Messenger
- TikTok Direct Messages
- Job queue system
- Lead scoring

**Usar cuando:** Necesites integrar Voice Agent con otros canales de messaging. Voice Agent y Multi-Channel son sistemas complementarios.

**Ruta:** `/docs/MULTI_CHANNEL_AI_SYSTEM.md`

---

## Quick Start por Rol

### Soy Desarrollador
1. Lee: `/docs/VOICE_AGENT_SYSTEM.md` (completo)
2. Lee: `/docs/VOICE_AGENT_FIXES.md` (correcciones)
3. Lee: `/docs/INTEGRATION_GUIDE.md` (práctico)
4. Revisa: `/src/features/voice-agent/` (código)

**Tiempo:** 2-3 horas

---

### Soy DevOps/SRE
1. Lee: `/docs/VOICE_AGENT_FIXES.md` (qué cambió)
2. Lee: `/docs/INTEGRATION_GUIDE.md` (env vars, webhooks)
3. Ejecuta: Migración 068 en todos los ambientes
4. Valida: Índices, policies, functions en BD

**Tiempo:** 1-2 horas

---

### Soy Integrador/Tech Lead
1. Lee: `/docs/INTEGRATION_GUIDE.md` (completo)
2. Lee: `/docs/VOICE_AGENT_SYSTEM.md` (tablas, APIs)
3. Implementa: Según checklist en INTEGRATION_GUIDE
4. Contacta: Al equipo para debugging si es necesario

**Tiempo:** 1-2 horas (setup), 2-4 horas (testing)

---

### Soy Product Manager
1. Lee: `/VOICE_AGENT_UPDATES_SUMMARY.md` (overview)
2. Lee: "Plan Restrictions" en `/docs/VOICE_AGENT_SYSTEM.md`
3. Revisa: Checklist en `/docs/INTEGRATION_GUIDE.md`
4. Usa: Métricas de `/docs/VOICE_AGENT_SYSTEM.md`

**Tiempo:** 30-45 minutos

---

## Estructura de Carpetas

```
docs/
├── VOICE_AGENT_SYSTEM.md          # Documentación técnica principal
├── VOICE_AGENT_FIXES.md            # Detalles de correcciones
├── README_VOICE_AGENT.md           # Este archivo (índice)
├── INTEGRATION_GUIDE.md            # Guía de integración (incluye Voice Agent)
├── MULTI_CHANNEL_AI_SYSTEM.md      # Sistema complementario
└── esva-reference/                 # Referencia específica ESVA
    ├── PLAN_MAESTRO_PROYECTO.md
    ├── SETUP_SUPABASE.md
    └── GUIA_VISUAL.md

src/features/voice-agent/
├── services/
│   ├── voice-agent.service.ts      # Funciones principales
│   └── voice-langgraph.service.ts  # Análisis de llamadas
├── types/
│   └── index.ts                    # TypeScript interfaces
└── components/
    └── TalkToAssistant.tsx         # UI component

app/api/voice-agent/
├── webhook/
│   └── route.ts                    # VAPI webhook handler
└── [phone-number-id]/              # Endpoints de call management

supabase/migrations/
├── 067_VOICE_AGENT.sql             # Creación inicial
└── 068_VOICE_AGENT_FIXES.sql       # Correcciones y mejoras
```

---

## Conceptos Clave

### Voice Agent
Asistente de IA que responde llamadas telefónicas automáticamente. Utiliza:
- VAPI para gestión de llamadas
- Claude (Anthropic) para IA
- 11Labs para síntesis de voz
- Deepgram para transcripción

### System Prompt
Instrucciones para el LLM. Se genera automáticamente a partir de:
- Nombre y datos del negocio
- Servicios y precios
- Staff y especialidades
- Horarios de operación
- Knowledge base personalizada

### Voice Call
Registro de una llamada telefónica. Incluye:
- Metadata (duración, cost, outcome)
- Transcripts (mensajes de conversación)
- Recording URL
- Análisis automático (sentiment, intent)

### Tenant Isolation
Cada tenant tiene:
- Configuración independiente
- Números de teléfono propios
- System prompt personalizado
- Aislamiento completo de datos

---

## APIs Principales

### getOrCreateVoiceConfig(tenantId)
Obtiene o crea la configuración de Voice Agent.

```typescript
const config = await getOrCreateVoiceConfig('tenant-uuid');
```

---

### updateVoiceConfig(tenantId, updates, staffId?)
Actualiza configuración e incrementa version automáticamente.

```typescript
await updateVoiceConfig('tenant-uuid', {
  assistant_name: 'María',
  voice_id: 'EXAVITQu4vr4xnSDxMaL'
}, 'staff-uuid');
```

---

### generatePrompt(tenantId)
Genera automáticamente el system prompt.

```typescript
const prompt = await generatePrompt('tenant-uuid');
// Incluye: servicios, staff, horarios, KB, etc
```

---

### getPhoneNumbers(tenantId)
Lista números de teléfono del tenant.

```typescript
const numbers = await getPhoneNumbers('tenant-uuid');
```

---

### requestPhoneNumber(tenantId, areaCode, branchId?)
Solicita nuevo número (requiere plan Growth).

```typescript
const { success, phoneNumber } = await requestPhoneNumber('tenant-uuid', '664');
```

---

### getRecentCalls(tenantId, limit?, offset?)
Obtiene llamadas recientes.

```typescript
const calls = await getRecentCalls('tenant-uuid', 20, 0);
```

---

### getCallMessages(callId)
Obtiene transcripts de una llamada.

```typescript
const messages = await getCallMessages('call-uuid');
```

---

### getUsageSummary(tenantId, startDate?, endDate?)
Estadísticas de uso (últimos 30 días por defecto).

```typescript
const summary = await getUsageSummary('tenant-uuid');
// { total_calls, total_minutes, appointment_booking_rate, ... }
```

---

## Base de Datos

### voice_calls
Metadata de llamadas. Campos principales:
- id, tenant_id, vapi_call_id
- customer_phone, customer_name
- status, duration_seconds, cost_usd
- outcome (completed, appointment_booked, transferred, etc)
- transcript, recording_url
- escalated, escalated_reason

### voice_call_messages
Transcripts de conversación. Campos:
- id, call_id
- role (user, assistant, system)
- content (mensaje de texto)
- sequence_number (orden en conversación)

### voice_agent_config
Configuración del agente. Incluye:
- assistant_name, first_message
- system_prompt (auto-generado)
- ai_model, ai_temperature, ai_max_tokens
- voice_id, voice_model, voice_stability
- transcription_model, transcription_language
- configuration_version (para auditoría)

### voice_phone_numbers
Números telefónicos. Incluye:
- phone_number, area_code, country_code
- status (pending, active, inactive, provisioning)
- telephony_provider (twilio, vapi, vonage)
- provider_phone_id

### voice_prompt_templates
Templates para generar prompts. Incluye:
- vertical (dental, restaurant, services, etc)
- template_text (con variables como {services}, {doctors})
- first_message_template
- recommended_config (JSON con settings para VAPI)

---

## Restricciones Importantes

### Plan
- Solo disponible para plan **Growth**
- Otros planes ven "locked" en dashboard

### Telefonía
- Requiere número de teléfono activo para activar Voice Agent
- Números se provisionan asincronamente
- Soporte para México (+52) principalmente

### Modelo de IA
- Usa Claude 3.5 Sonnet por defecto
- Configurable por tenant
- Temperature configurable (0.0 - 1.0)

### Prompts
- Se generan automáticamente al crear config
- Se pueden personalizar manualmente
- Variables se reemplazan automáticamente

---

## Common Tasks

### Activar Voice Agent para un tenant
```typescript
// 1. Crear config
await getOrCreateVoiceConfig(tenantId);

// 2. Generar prompt
await generatePrompt(tenantId);

// 3. Solicitar número
await requestPhoneNumber(tenantId, '664');

// 4. Esperar provisioning y activar
// (Cuando status = 'active')

// 5. Activar Voice Agent
await toggleVoiceAgent(tenantId, true);
```

### Personalizar voice del asistente
```typescript
await updateVoiceConfig(tenantId, {
  assistant_name: 'Dr. García',
  voice_id: 'TxGEqnHWrfncoIPqAKQe', // Adam (male)
  voice_stability: 0.8, // Más estable
  voice_similarity_boost: 0.85, // Más similar
});
```

### Obtener analytics de llamadas
```typescript
const summary = await getUsageSummary(tenantId);
console.log(`Total llamadas: ${summary.total_calls}`);
console.log(`Minutos totales: ${summary.total_minutes}`);
console.log(`Citas agendadas: ${summary.appointment_booking_rate}%`);
console.log(`Cost: $${summary.total_cost_usd}`);
```

---

## Troubleshooting

### Webhook recibe "Tenant not found"
Ver: `/docs/VOICE_AGENT_SYSTEM.md#webhook-recibe-error-tenant-not-found`

### No se pueden insertar mensajes
Ver: `/docs/VOICE_AGENT_SYSTEM.md#no-se-pueden-insertar-mensajes-en-voice_call_messages`

### Índice no mejora performance
Ver: `/docs/VOICE_AGENT_SYSTEM.md#index-en-vapi_call_id-no-mejora-performance`

### updateVoiceConfig() falla
Ver: `/docs/VOICE_AGENT_FIXES.md#7-función-helper-get_next_voice_config_version`

---

## Updates y Versioning

### v1.0.0 (Diciembre 22, 2024)
- ✅ Sistema completo implementado
- ✅ 9 correcciones aplicadas
- ✅ Documentación completa
- ✅ Ready for production

### v0.1.0 (Noviembre 2024)
- Sistema inicial (pre-corrections)
- Documentación parcial

---

## Links Útiles

- **VAPI Docs:** https://docs.vapi.ai/
- **11Labs Docs:** https://elevenlabs.io/docs/
- **Deepgram Docs:** https://developers.deepgram.com/
- **Claude Docs:** https://docs.anthropic.com/
- **Supabase Docs:** https://supabase.com/docs

---

## Soporte

Para issues o preguntas:

1. Revisar documentación correspondiente
2. Revisar `/docs/VOICE_AGENT_SYSTEM.md#troubleshooting`
3. Revisar logs en VAPI dashboard
4. Contactar al equipo de desarrollo

---

**Status:** ✅ COMPLETO
**Última revisión:** Diciembre 22, 2024
**Documentación sincronizada con código:** SÍ
