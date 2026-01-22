# Voice Test Modal - Documentación de Mejoras

## TIS TIS Platform - Voice Agent
### Análisis y Plan de Implementación

**Fecha:** 2026-01-20
**Versión:** 1.0
**Estado:** En Planificación

---

## ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Análisis de Problemas](#análisis-de-problemas)
3. [Arquitectura Propuesta](#arquitectura-propuesta)
4. [Fases de Implementación](#fases-de-implementación)
5. [Dependencias y Prerrequisitos](#dependencias-y-prerrequisitos)

---

## RESUMEN EJECUTIVO

### Objetivo
Transformar el modal "Probar Asistente de Voz" de una simulación con respuestas hardcodeadas a una herramienta de prueba real que:

1. **Modo Texto:** Permite chatear con el asistente usando la misma lógica del webhook real
2. **Modo VAPI (Llamada):** Inicia una llamada web real con VAPI para probar voz completa

### Estado Actual
- ❌ Respuestas hardcodeadas (no usa configuración real)
- ❌ Quick responses fijas para dental (no adapta por vertical)
- ❌ No conecta con backend ni VAPI
- ❌ Micrófono se solicita pero audio no se procesa
- ❌ No usa Knowledge Base ni prompt generado

### Estado Objetivo
- ✅ Respuestas reales desde LangGraph con prompt del negocio
- ✅ Quick responses dinámicas por vertical
- ✅ Modo texto conectado a API backend
- ✅ Modo llamada conectado a VAPI Web SDK
- ✅ Usa Knowledge Base y configuración real del tenant

---

## ANÁLISIS DE PROBLEMAS

### Problema 1: Sin Conexión a Backend
**Severidad:** 🔴 Crítica
**Ubicación:** `src/features/voice-agent/components/VoiceTestModal.tsx:287-300`

```typescript
// CÓDIGO ACTUAL
if (onSendMessage) {
  response = await onSendMessage(messageText);  // NUNCA SE USA
} else {
  // SIEMPRE CAE AQUÍ - Respuestas simuladas
  response = DEFAULT_RESPONSES[key] || 'Entendido...';
}
```

**Problema:** El callback `onSendMessage` nunca se pasa al modal desde la página principal.

**En página:** `app/(dashboard)/dashboard/ai-agent-voz/page.tsx:1851-1855`
```typescript
<VoiceTestModal
  isOpen={showTalkToAssistant}
  onClose={() => setShowTalkToAssistant(false)}
  config={config}
  // ❌ NO SE PASA onSendMessage
/>
```

---

### Problema 2: Quick Responses Hardcodeadas para Dental
**Severidad:** 🔴 Crítica
**Ubicación:** `src/features/voice-agent/components/VoiceTestModal.tsx:93-99`

```typescript
const QUICK_RESPONSES = [
  'Hola',
  'Quiero una cita',           // ← Solo dental
  '¿Cuál es el horario?',
  '¿Cuáles son los precios?',  // ← Solo dental (procedimientos)
  'Gracias',
];
```

**Problema:** Un restaurante debería mostrar:
- "Quiero hacer una reservación"
- "¿Tienen mesas disponibles?"
- "¿Cuál es el menú?"

---

### Problema 3: Default Responses No Adaptadas
**Severidad:** 🔴 Crítica
**Ubicación:** `src/features/voice-agent/components/VoiceTestModal.tsx:105-111`

```typescript
const DEFAULT_RESPONSES: Record<string, string> = {
  'cita': 'Con gusto te ayudo a agendar una cita...',  // DENTAL
  'precio': 'Los precios varían según el servicio...',  // DENTAL
};
```

**Problema:** Si usuario dice "quiero reservar mesa" → No hay match → Respuesta genérica.

---

### Problema 4: Sin Vertical en Props
**Severidad:** 🔴 Crítica
**Ubicación:** `src/features/voice-agent/components/VoiceTestModal.tsx:35-40`

```typescript
interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  onSendMessage?: (message: string) => Promise<string>;
  // ❌ NO HAY vertical: 'restaurant' | 'dental'
}
```

---

### Problema 5: Audio Capturado pero No Procesado
**Severidad:** 🟡 Media
**Ubicación:** `src/features/voice-agent/components/VoiceTestModal.tsx:206-209`

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
streamRef.current = stream;
audioContextRef.current = new AudioContext();
// ❌ Audio nunca se envía a transcripción
```

---

### Problema 6: Sin Acceso a Configuración Real
**Severidad:** 🔴 Crítica

El modal no tiene acceso a:
- `generated_prompt` - Prompt compilado del negocio
- Knowledge Base - FAQs, servicios, horarios reales
- Tools disponibles según tipo de asistente

---

### Problema 7: Sin Modo de Llamada Real
**Severidad:** 🔴 Crítica

No existe integración con VAPI Web SDK para pruebas de voz real.
El usuario no puede escuchar cómo suena realmente el asistente.

---

## ARQUITECTURA PROPUESTA

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VoiceTestModal (UI)                            │
│  ┌────────────────────────┐    ┌────────────────────────┐          │
│  │      MODO TEXTO        │    │     MODO LLAMADA       │          │
│  │   (Chat simulado)      │    │    (VAPI Web SDK)      │          │
│  │                        │    │                        │          │
│  │  [Input de texto]      │    │  [Botón llamar]        │          │
│  │  [Quick responses]     │    │  [Micrófono activo]    │          │
│  │  [Transcript]          │    │  [Audio bidireccional] │          │
│  └───────────┬────────────┘    └───────────┬────────────┘          │
│              │                              │                       │
│              ▼                              ▼                       │
│  ┌────────────────────────┐    ┌────────────────────────┐          │
│  │  POST /api/voice-agent │    │   VAPI Web Client      │          │
│  │       /test            │    │   (WebRTC Call)        │          │
│  └───────────┬────────────┘    └───────────┬────────────┘          │
└──────────────┼──────────────────────────────┼───────────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│   VoiceLangGraphService      │  │        VAPI Cloud                │
│   .processTestMessage()      │  │                                  │
│                              │  │  ┌─────────────────────┐         │
│  - Carga prompt del tenant   │  │  │ Deepgram (STT)      │         │
│  - Consulta RAG/Knowledge    │  │  └─────────┬───────────┘         │
│  - Ejecuta tools si aplica   │  │            ▼                     │
│  - Retorna respuesta IA      │  │  ┌─────────────────────┐         │
│                              │  │  │ Webhook TIS TIS     │         │
└──────────────────────────────┘  │  │ (LangGraph)         │         │
                                  │  └─────────┬───────────┘         │
                                  │            ▼                     │
                                  │  ┌─────────────────────┐         │
                                  │  │ ElevenLabs (TTS)    │         │
                                  │  └─────────────────────┘         │
                                  └──────────────────────────────────┘
```

### Componentes a Crear/Modificar

| Componente | Acción | Descripción |
|------------|--------|-------------|
| `VoiceTestModal.tsx` | MODIFICAR | Agregar modo texto/llamada, props vertical |
| `/api/voice-agent/test/route.ts` | CREAR | Endpoint para procesar mensajes de prueba |
| `voice-test.service.ts` | CREAR | Servicio para procesar test con LangGraph |
| `useVapiWebClient.ts` | CREAR | Hook para VAPI Web SDK |
| `VoiceTestModeSelector.tsx` | CREAR | Selector de modo (texto/llamada) |

---

## FASES DE IMPLEMENTACIÓN

### FASE 1: API Backend para Test por Texto
**Prioridad:** Alta
**Complejidad:** Media
**Documento:** `FASE_1_API_TEST_BACKEND.md`

### FASE 2: Adaptar VoiceTestModal para Modo Texto
**Prioridad:** Alta
**Complejidad:** Media
**Documento:** `FASE_2_MODAL_MODO_TEXTO.md`

### FASE 3: Integración VAPI Web SDK para Modo Llamada
**Prioridad:** Alta
**Complejidad:** Alta
**Documento:** `FASE_3_VAPI_WEB_SDK.md`

### FASE 4: UI/UX Final y Testing
**Prioridad:** Media
**Complejidad:** Baja
**Documento:** `FASE_4_UI_TESTING.md`

---

## DEPENDENCIAS Y PRERREQUISITOS

### Servicios Existentes Verificados
- ✅ VAPI API Key configurada (`VAPI_API_KEY`)
- ✅ ElevenLabs configurado en VAPI
- ✅ Deepgram configurado en VAPI
- ✅ `VoiceLangGraphService` funcional
- ✅ Knowledge Base (`business_knowledge` table)
- ✅ Prompt generation (`generate_voice_agent_prompt` RPC)

### Dependencias NPM Requeridas
```json
{
  "@vapi-ai/web": "^2.0.0"  // VAPI Web SDK para llamadas en browser
}
```

### Variables de Entorno
- `VAPI_API_KEY` - Ya configurada
- `VAPI_WEBHOOK_SECRET` - Ya configurada
- `NEXT_PUBLIC_VAPI_PUBLIC_KEY` - **NUEVA** (para Web SDK)

---

## PRÓXIMOS PASOS

1. Revisar documento `FASE_1_API_TEST_BACKEND.md`
2. Implementar endpoint `/api/voice-agent/test`
3. Continuar con FASE 2

---

*Documento generado para el equipo de desarrollo TIS TIS*
