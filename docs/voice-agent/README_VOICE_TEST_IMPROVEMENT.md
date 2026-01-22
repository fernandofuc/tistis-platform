# 📞 Voice Test Modal - Plan de Mejoras

## TIS TIS Platform - Voice Agent

---

## 📋 ÍNDICE DE DOCUMENTOS

| Documento | Descripción | Estado |
|-----------|-------------|--------|
| [VOICE_TEST_MODAL_IMPROVEMENT.md](./VOICE_TEST_MODAL_IMPROVEMENT.md) | Análisis general y arquitectura | ✅ Completo |
| [FASE_1_API_TEST_BACKEND.md](./FASE_1_API_TEST_BACKEND.md) | Crear endpoint `/api/voice-agent/test` | ✅ Completado |
| [FASE_2_MODAL_MODO_TEXTO.md](./FASE_2_MODAL_MODO_TEXTO.md) | Adaptar modal para modo texto | ✅ Completado |
| [FASE_3_VAPI_WEB_SDK.md](./FASE_3_VAPI_WEB_SDK.md) | Integrar VAPI Web SDK para llamadas | 📋 Pendiente |
| [FASE_4_UI_TESTING.md](./FASE_4_UI_TESTING.md) | UI final y testing E2E | 📋 Pendiente |

---

## 🔴 PROBLEMAS IDENTIFICADOS

### Críticos (7)
1. **Sin conexión a backend** - Modal usa respuestas hardcodeadas
2. **Quick responses fijas** - Solo muestra opciones de dental
3. **Default responses genéricas** - No adapta por vertical
4. **Sin vertical en props** - Modal no sabe si es restaurant o dental
5. **Audio no procesado** - Micrófono se solicita pero no se usa
6. **Sin configuración real** - No usa prompt del negocio ni Knowledge Base
7. **Sin modo llamada** - No hay integración con VAPI Web SDK

### Secundarios (5)
1. Horarios genéricos (no del negocio real)
2. Sin nombre del negocio en respuestas
3. Sin herramientas reales (verificar disponibilidad)
4. Sin consulta a RAG
5. Botón de micrófono decorativo

---

## 🏗️ ARQUITECTURA PROPUESTA

```
┌─────────────────────────────────────────────────────────────────┐
│                    VoiceTestModal (UI)                          │
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │     MODO TEXTO       │    │    MODO LLAMADA      │          │
│  │   - Input de texto   │    │   - VAPI Web SDK     │          │
│  │   - Quick responses  │    │   - Audio real       │          │
│  │   - API backend      │    │   - Deepgram STT     │          │
│  └──────────┬───────────┘    │   - ElevenLabs TTS   │          │
│             │                 └──────────┬───────────┘          │
│             ▼                            ▼                       │
│  ┌────────────────────┐      ┌────────────────────────┐        │
│  │ /api/voice-agent/  │      │    VAPI Cloud          │        │
│  │      test          │      │  (WebRTC + Webhook)    │        │
│  └────────┬───────────┘      └────────────┬───────────┘        │
│           │                               │                     │
│           ▼                               ▼                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              VoiceLangGraphService                       │   │
│  │  - Prompt compilado del tenant                          │   │
│  │  - RAG con Knowledge Base                               │   │
│  │  - Tools según tipo de asistente                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 FASES DE IMPLEMENTACIÓN

### FASE 1: API Backend (Prioridad: Alta)
**Tiempo estimado:** 2-3 horas

- Crear endpoint `/api/voice-agent/test`
- Crear `VoiceTestService`
- Integrar con LangGraph

**Archivos a crear:**
- `app/api/voice-agent/test/route.ts`
- `src/features/voice-agent/services/voice-test.service.ts`

---

### FASE 2: Modal Modo Texto (Prioridad: Alta)
**Tiempo estimado:** 2-3 horas

- Agregar prop `vertical` al modal
- Quick responses dinámicas por vertical
- Conectar con API backend
- Fallback si API falla

**Archivos a modificar:**
- `src/features/voice-agent/components/VoiceTestModal.tsx`
- `app/(dashboard)/dashboard/ai-agent-voz/page.tsx`

---

### FASE 3: VAPI Web SDK (Prioridad: Alta)
**Tiempo estimado:** 4-5 horas

- Instalar `@vapi-ai/web`
- Crear hook `useVapiWebClient`
- Endpoint para assistant temporal
- Integrar en modal
- Selector de modo

**Archivos a crear:**
- `src/features/voice-agent/hooks/useVapiWebClient.ts`
- `app/api/voice-agent/test/assistant/route.ts`

**Variables de entorno:**
- `NEXT_PUBLIC_VAPI_PUBLIC_KEY` (nueva)

---

### FASE 4: UI/UX y Testing (Prioridad: Media)
**Tiempo estimado:** 2-3 horas

- Indicadores de estado mejorados
- Visualizador de audio
- Resumen de llamada
- Testing E2E
- Documentación

---

## ✅ CRITERIOS DE ÉXITO

| Criterio | Descripción |
|----------|-------------|
| Modo Texto | Chat funciona con respuestas reales del backend |
| Modo Llamada | Usuario puede iniciar llamada web real |
| Vertical | Quick responses y respuestas adaptan a restaurant/dental |
| Audio | En modo llamada, audio bidireccional funciona |
| Latencia | Texto < 2s, Llamada conexión < 3s |
| Errores | Manejo graceful con mensajes claros |

---

## 🚀 ORDEN DE EJECUCIÓN

```
FASE 1 ──► FASE 2 ──► FASE 3 ──► FASE 4
  │          │          │          │
  ▼          ▼          ▼          ▼
Backend   Modal      VAPI       Final
  API     Texto      Web SDK    + Test
```

**Cada fase es independiente y puede desplegarse por separado:**
- Después de FASE 1+2: Modal funciona con modo texto real
- Después de FASE 3: Modal tiene ambos modos
- Después de FASE 4: Producto pulido y testeado

---

## 📝 NOTAS IMPORTANTES

1. **VAPI Public Key** - Se necesita obtener de https://dashboard.vapi.ai/account
2. **Deepgram/ElevenLabs** - Ya configurados en VAPI, no se necesita config adicional
3. **LangGraph** - Ya existe y funciona, solo se reutiliza
4. **Knowledge Base** - Ya existe, solo se consulta

---

## 📞 CONTACTO

Para dudas sobre esta implementación, consultar la documentación de cada fase.

---

*Plan de mejoras creado: 2026-01-20*
*Última actualización: 2026-01-20*

---

## 📋 HISTORIAL DE IMPLEMENTACIÓN

### FASE 1 - Completada (2026-01-20)

**Archivos creados:**
- `app/api/voice-agent/test/route.ts` - Endpoint POST para procesar mensajes de prueba
- `src/features/voice-agent/services/voice-test.service.ts` - Servicio que conecta con LangGraph

**Características implementadas:**
- Autenticación con Bearer token
- Validación de UUID para tenant_id
- Conexión con VoiceLangGraphService existente
- Respuestas de fallback por vertical (restaurant, dental, general)
- Limitación de mensajes (1000 chars) e historial (20 mensajes)
- Métricas de latencia en respuesta
- Manejo de errores robusto con fallback

### FASE 2 - Completada (2026-01-20)

**Archivos modificados:**
- `src/features/voice-agent/components/VoiceTestModal.tsx` - Modal con conexión a backend
- `app/(dashboard)/dashboard/ai-agent-voz/page.tsx` - Página pasando props correctas

**Características implementadas:**
- Props `vertical` y `accessToken` agregadas al modal
- Quick responses dinámicas por vertical (restaurant/dental)
- Conexión con API `/api/voice-agent/test`
- Fallback responses si API falla
- Tipos `TestApiResponse` y `QuickResponseConfig` definidos
- Función `sendMessageToBackend` con manejo de errores
- Historial de conversación enviado al backend
- Latencia mostrada en cada mensaje del asistente

**Problemas críticos resueltos:**
1. ✅ Modal ahora conecta con backend real (LangGraph)
2. ✅ Quick responses adaptan según vertical
3. ✅ Fallback responses por vertical si API falla
4. ✅ Modal sabe si es restaurant o dental via prop `vertical`
