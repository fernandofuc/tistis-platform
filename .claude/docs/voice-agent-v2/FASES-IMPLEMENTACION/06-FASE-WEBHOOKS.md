# FASE 06: Sistema de Webhooks VAPI

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 06 |
| **Nombre** | Webhooks VAPI |
| **Sprint** | 2 - Integracion VAPI |
| **Duracion Estimada** | 2 dias |
| **Dependencias** | Fases 01-05 (Todas del Sprint 1) |
| **Documento Referencia** | `04-ARQUITECTURA-PROPUESTA.md` |

---

## Objetivo

Implementar el endpoint de webhooks que recibe eventos de VAPI, los valida con Security Gate, los enruta al handler correcto y retorna respuestas en formato compatible con VAPI.

---

## Microfases

### MICROFASE 6.1: Crear Endpoint Principal de Webhook

**Archivo a crear:** `app/api/voice-agent/webhook/route.ts`

**Que hacer:**
1. Crear endpoint POST que:
   - Recibe webhooks de VAPI
   - Aplica Security Gate
   - Parsea el body JSON
   - Enruta al handler correcto
   - Retorna respuesta formateada

2. Estructura basica:
   ```typescript
   export async function POST(request: Request) {
     // 1. Security Gate validation
     // 2. Parse body
     // 3. Route to handler
     // 4. Return response
   }
   ```

**Verificacion:**
- [ ] Endpoint responde a POST
- [ ] Security Gate aplicado
- [ ] Body parseado correctamente

---

### MICROFASE 6.2: Integrar Security Gate

**Archivo:** `app/api/voice-agent/webhook/route.ts` (continuacion)

**Que hacer:**
1. Importar y usar WebhookSecurityGate:
   ```typescript
   const securityGate = new WebhookSecurityGate(config);
   const validation = await securityGate.validate(request);

   if (!validation.valid) {
     return new Response(JSON.stringify({
       error: 'Unauthorized',
       reason: validation.failedAt
     }), { status: 401 });
   }
   ```

2. Loguear intentos de acceso

**Verificacion:**
- [ ] Requests invalidos rechazados con 401
- [ ] Requests validos pasan
- [ ] Logs de seguridad generados

---

### MICROFASE 6.3: Crear Router de Eventos

**Archivo:** `lib/voice-agent/webhooks/event-router.ts`

**Que hacer:**
1. Crear funcion para enrutar eventos:
   ```typescript
   type VapiEventType =
     | 'assistant-request'
     | 'function-call'
     | 'end-of-call-report'
     | 'transcript'
     | 'status-update'
     | 'speech-update';

   async function routeEvent(
     eventType: VapiEventType,
     payload: VapiWebhookPayload
   ): Promise<VapiResponse>
   ```

2. Mapear tipos de evento a handlers

**Verificacion:**
- [ ] Todos los tipos de evento reconocidos
- [ ] Routing correcto a handlers
- [ ] Eventos desconocidos manejados

---

### MICROFASE 6.4: Implementar Handler assistant-request

**Archivo:** `lib/voice-agent/webhooks/handlers/assistant-request.handler.ts`

**Que hacer:**
1. Este es el handler mas importante - configura el asistente:
   ```typescript
   async function handleAssistantRequest(
     payload: AssistantRequestPayload
   ): Promise<AssistantRequestResponse> {
     // 1. Extraer phone number de la llamada
     // 2. Buscar config del negocio
     // 3. Cargar tipo de asistente
     // 4. Renderizar prompt
     // 5. Construir respuesta con assistant config
   }
   ```

2. Respuesta debe incluir:
   - model (provider, model, temperature)
   - voice (provider, voiceId, speed)
   - firstMessage
   - serverUrl (para function calls)
   - tools (definiciones)

**Verificacion:**
- [ ] Busca config por phone number
- [ ] Renderiza prompt correctamente
- [ ] Retorna assistant config completa
- [ ] Maneja phone numbers desconocidos

---

### MICROFASE 6.5: Implementar Handler function-call

**Archivo:** `lib/voice-agent/webhooks/handlers/function-call.handler.ts`

**Que hacer:**
1. Handler para cuando VAPI detecta que el usuario quiere ejecutar una funcion:
   ```typescript
   async function handleFunctionCall(
     payload: FunctionCallPayload
   ): Promise<FunctionCallResponse> {
     // 1. Extraer nombre de funcion y parametros
     // 2. Validar que la funcion existe
     // 3. Ejecutar via LangGraph (Fase 07)
     // 4. Formatear resultado para voz
     // 5. Retornar resultado
   }
   ```

2. Manejar confirmacion si es tool destructivo

**Verificacion:**
- [ ] Extrae funcion y parametros
- [ ] Ejecuta correctamente
- [ ] Formatea para voz
- [ ] Maneja errores gracefully

---

### MICROFASE 6.6: Implementar Handler end-of-call-report

**Archivo:** `lib/voice-agent/webhooks/handlers/end-of-call.handler.ts`

**Que hacer:**
1. Handler para cuando termina una llamada:
   ```typescript
   async function handleEndOfCall(
     payload: EndOfCallPayload
   ): Promise<void> {
     // 1. Extraer datos de la llamada
     // 2. Guardar en voice_calls
     // 3. Extraer structured data
     // 4. Actualizar metricas
     // 5. Procesar analysis si existe
   }
   ```

2. Datos a guardar:
   - call_id, business_id
   - started_at, ended_at, duration
   - ended_reason
   - transcript (si disponible)
   - structured_data (reservacion, cita, etc)
   - cost

**Verificacion:**
- [ ] Guarda llamada en DB
- [ ] Extrae structured data
- [ ] Actualiza metricas
- [ ] No falla si faltan datos

---

### MICROFASE 6.7: Implementar Handler transcript

**Archivo:** `lib/voice-agent/webhooks/handlers/transcript.handler.ts`

**Que hacer:**
1. Handler para transcripciones en tiempo real:
   ```typescript
   async function handleTranscript(
     payload: TranscriptPayload
   ): Promise<void> {
     // 1. Extraer transcript
     // 2. Guardar en cache para la llamada
     // 3. Opcionalmente guardar en DB
   }
   ```

2. Tipos de transcript:
   - partial (en progreso)
   - final (completado)

**Verificacion:**
- [ ] Maneja partial y final
- [ ] Guarda correctamente
- [ ] No bloquea la llamada

---

### MICROFASE 6.8: Implementar Handler status-update

**Archivo:** `lib/voice-agent/webhooks/handlers/status-update.handler.ts`

**Que hacer:**
1. Handler para cambios de estado de llamada:
   ```typescript
   async function handleStatusUpdate(
     payload: StatusUpdatePayload
   ): Promise<void> {
     // Estados: ringing, in-progress, ended
     // 1. Actualizar estado en cache/DB
     // 2. Loguear cambio
   }
   ```

**Verificacion:**
- [ ] Maneja todos los estados
- [ ] Actualiza correctamente
- [ ] Logging apropiado

---

### MICROFASE 6.9: Crear Formateadores de Respuesta VAPI

**Archivo:** `lib/voice-agent/webhooks/response-formatters.ts`

**Que hacer:**
1. Funciones para formatear respuestas VAPI:
   ```typescript
   // Para assistant-request
   function formatAssistantConfig(config, prompt, tools): VapiAssistantConfig

   // Para function-call
   function formatFunctionResult(result): VapiFunctionResult

   // Para errores
   function formatErrorResponse(error): VapiErrorResponse
   ```

2. Asegurar que formato cumple con spec de VAPI

**Verificacion:**
- [ ] Formatos correctos para VAPI
- [ ] Maneja todos los casos
- [ ] Errores formateados correctamente

---

### MICROFASE 6.10: Implementar Error Handling Global

**Archivo:** `lib/voice-agent/webhooks/error-handler.ts`

**Que hacer:**
1. Crear handler de errores centralizado:
   ```typescript
   function handleWebhookError(error: Error, context: WebhookContext): VapiResponse {
     // 1. Loguear error
     // 2. Determinar si es recoverable
     // 3. Retornar respuesta apropiada
     // 4. No exponer detalles internos
   }
   ```

2. Tipos de error:
   - Validation error (400)
   - Auth error (401)
   - Not found (404)
   - Internal error (500)

**Verificacion:**
- [ ] Todos los errores manejados
- [ ] No expone info sensible
- [ ] Logging completo
- [ ] Respuestas amigables

---

### MICROFASE 6.11: Tests de Webhooks

**Archivo:** `__tests__/voice-agent/webhooks/`

**Que hacer:**
1. Tests del endpoint:
   - Request valido procesado
   - Request invalido rechazado

2. Tests de cada handler:
   - assistant-request
   - function-call
   - end-of-call

3. Tests de integracion:
   - Flujo completo de llamada

**Verificacion:**
- [ ] Coverage > 80%
- [ ] Todos los handlers testeados
- [ ] Integracion testeada

---

### MICROFASE 6.12: Verificacion Final

**Que hacer:**
1. Probar con webhook real de VAPI (si posible)
2. Verificar todos los handlers
3. Verificar error handling
4. Documentar formatos de request/response

**Verificacion:**
- [ ] Endpoint funcional
- [ ] Todos los handlers implementados
- [ ] Error handling completo
- [ ] Documentado

---

## Archivos a Crear

```
app/api/voice-agent/webhook/
└── route.ts

lib/voice-agent/webhooks/
├── index.ts
├── event-router.ts
├── response-formatters.ts
├── error-handler.ts
└── handlers/
    ├── assistant-request.handler.ts
    ├── function-call.handler.ts
    ├── end-of-call.handler.ts
    ├── transcript.handler.ts
    └── status-update.handler.ts

__tests__/voice-agent/webhooks/
├── endpoint.test.ts
└── handlers/
    ├── assistant-request.test.ts
    ├── function-call.test.ts
    └── end-of-call.test.ts
```

---

## Tipos de Eventos VAPI

| Evento | Descripcion | Handler |
|--------|-------------|---------|
| assistant-request | Inicio de llamada, configura asistente | Critico |
| function-call | Usuario quiere ejecutar una funcion | Critico |
| end-of-call-report | Llamada terminada | Importante |
| transcript | Transcripcion en tiempo real | Opcional |
| status-update | Cambio de estado | Opcional |

---

## Criterios de Exito

- [ ] Endpoint seguro con Security Gate
- [ ] Todos los handlers implementados
- [ ] Respuestas en formato VAPI correcto
- [ ] Error handling completo
- [ ] Tests con coverage > 80%
- [ ] Documentado

---

## Notas Importantes

1. **assistant-request es critico** - Sin este, la llamada no funciona
2. **function-call conecta con LangGraph** - Se implementa completo en Fase 07
3. **No bloquear** - Respuestas deben ser rapidas (< 500ms)
4. **Logging** - Loguear todo para debugging, pero no datos sensibles
