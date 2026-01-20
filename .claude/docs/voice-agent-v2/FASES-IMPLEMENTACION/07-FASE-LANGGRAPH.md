# FASE 07: Integracion LangGraph

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 07 |
| **Nombre** | LangGraph Voice Agent |
| **Sprint** | 2 - Integracion VAPI |
| **Duracion Estimada** | 2-3 dias |
| **Dependencias** | Fase 06 (Webhooks) |
| **Documento Referencia** | `04-ARQUITECTURA-PROPUESTA.md` |

---

## Objetivo

Implementar el grafo de LangGraph que procesa las conversaciones de voz, incluyendo routing inteligente, integracion con RAG, ejecucion de tools y generacion de respuestas optimizadas para voz.

---

## Microfases

### MICROFASE 7.1: Crear Estructura de Archivos

**Archivos a crear:**
```
lib/voice-agent/
├── langgraph/
│   ├── index.ts
│   ├── voice-agent-graph.ts
│   ├── state.ts
│   ├── nodes/
│   │   ├── router.ts
│   │   ├── rag.ts
│   │   ├── tool-executor.ts
│   │   ├── confirmation.ts
│   │   └── response-generator.ts
│   └── edges/
│       └── conditional-edges.ts
```

**Que hacer:**
1. Instalar dependencias: `npm install @langchain/langgraph @langchain/core`
2. Crear estructura de carpetas
3. Definir tipos base

**Verificacion:**
- [ ] Dependencias instaladas
- [ ] Estructura creada
- [ ] Types definidos

---

### MICROFASE 7.2: Definir State del Grafo

**Archivo:** `lib/voice-agent/langgraph/state.ts`

**Que hacer:**
1. Definir el state que fluye por el grafo:
   ```typescript
   interface VoiceAgentState {
     // Contexto de la llamada
     callId: string;
     businessId: string;
     assistantType: string;

     // Mensajes
     messages: BaseMessage[];
     currentInput: string;

     // Routing
     intent: 'tool' | 'rag' | 'direct' | 'transfer';
     confidence: number;

     // Tool execution
     pendingTool?: {
       name: string;
       parameters: Record<string, any>;
       requiresConfirmation: boolean;
     };
     toolResult?: any;
     awaitingConfirmation: boolean;

     // RAG
     ragContext?: string;
     ragSources?: string[];

     // Response
     response?: string;
     responseType: 'text' | 'audio_url';

     // Metadata
     startTime: number;
     turnCount: number;
     errors: string[];
   }
   ```

2. Crear estado inicial default

**Verificacion:**
- [ ] State completo definido
- [ ] Todos los campos necesarios
- [ ] Estado inicial creado

---

### MICROFASE 7.3: Implementar Router Node

**Archivo:** `lib/voice-agent/langgraph/nodes/router.ts`

**Que hacer:**
1. Crear nodo que determina la intencion del usuario:
   ```typescript
   async function routerNode(state: VoiceAgentState): Promise<Partial<VoiceAgentState>> {
     // 1. Analizar el input del usuario
     // 2. Determinar intent:
     //    - tool: quiere ejecutar una accion (reservar, cancelar, etc)
     //    - rag: pregunta sobre info del negocio (menu, horarios, etc)
     //    - direct: respuesta simple (saludo, despedida)
     //    - transfer: quiere hablar con humano
     // 3. Retornar intent y confidence
   }
   ```

2. Usar LLM para clasificacion o reglas

**Verificacion:**
- [ ] Clasifica intents correctamente
- [ ] Confidence score util
- [ ] Rapido (< 200ms)

---

### MICROFASE 7.4: Implementar RAG Node

**Archivo:** `lib/voice-agent/langgraph/nodes/rag.ts`

**Que hacer:**
1. Crear nodo para retrieval:
   ```typescript
   async function ragNode(state: VoiceAgentState): Promise<Partial<VoiceAgentState>> {
     // 1. Reformular query para retrieval
     // 2. Buscar en vector store del negocio
     // 3. Filtrar resultados relevantes
     // 4. Formatear contexto para el LLM
   }
   ```

2. Integrar con sistema RAG existente
3. Optimizar para latencia (< 200ms)

**Verificacion:**
- [ ] Retrieval funciona
- [ ] Resultados relevantes
- [ ] Latencia aceptable

---

### MICROFASE 7.5: Implementar Tool Executor Node

**Archivo:** `lib/voice-agent/langgraph/nodes/tool-executor.ts`

**Que hacer:**
1. Crear nodo que ejecuta tools:
   ```typescript
   async function toolExecutorNode(state: VoiceAgentState): Promise<Partial<VoiceAgentState>> {
     // 1. Obtener tool del registry
     // 2. Verificar si requiere confirmacion
     // 3. Si requiere y no confirmado: ir a confirmation node
     // 4. Si no requiere o ya confirmado: ejecutar
     // 5. Formatear resultado para voz
   }
   ```

2. Integrar con Circuit Breaker
3. Manejar errores de ejecucion

**Verificacion:**
- [ ] Ejecuta tools correctamente
- [ ] Detecta necesidad de confirmacion
- [ ] Circuit Breaker protege
- [ ] Errores manejados

---

### MICROFASE 7.6: Implementar Confirmation Node

**Archivo:** `lib/voice-agent/langgraph/nodes/confirmation.ts`

**Que hacer:**
1. Crear nodo para manejo de confirmaciones:
   ```typescript
   async function confirmationNode(state: VoiceAgentState): Promise<Partial<VoiceAgentState>> {
     // Si hay pending tool sin confirmar:
     // 1. Generar mensaje de confirmacion
     // 2. Marcar awaitingConfirmation = true

     // Si ya hay confirmacion del usuario:
     // 1. Verificar si dijo "si" o "no"
     // 2. Si "si": ejecutar tool
     // 3. Si "no": cancelar y preguntar que desea hacer
   }
   ```

2. Detectar confirmacion en lenguaje natural

**Verificacion:**
- [ ] Genera mensaje de confirmacion
- [ ] Detecta "si" y "no" en variantes
- [ ] Maneja cancelacion

---

### MICROFASE 7.7: Implementar Response Generator Node

**Archivo:** `lib/voice-agent/langgraph/nodes/response-generator.ts`

**Que hacer:**
1. Crear nodo final que genera respuesta:
   ```typescript
   async function responseGeneratorNode(state: VoiceAgentState): Promise<Partial<VoiceAgentState>> {
     // 1. Tomar contexto (RAG, tool result, etc)
     // 2. Generar respuesta con LLM
     // 3. Optimizar para voz:
     //    - Frases cortas
     //    - Sin acronimos
     //    - Numeros en palabras
     // 4. Retornar response
   }
   ```

2. Usar prompt optimizado para voz

**Verificacion:**
- [ ] Respuestas coherentes
- [ ] Optimizadas para voz
- [ ] Contexto utilizado

---

### MICROFASE 7.8: Implementar Edges Condicionales

**Archivo:** `lib/voice-agent/langgraph/edges/conditional-edges.ts`

**Que hacer:**
1. Definir edges del grafo:
   ```typescript
   // Despues del router
   function routerEdge(state: VoiceAgentState): string {
     switch (state.intent) {
       case 'tool': return 'tool_executor';
       case 'rag': return 'rag';
       case 'transfer': return 'transfer';
       default: return 'response_generator';
     }
   }

   // Despues del tool executor
   function toolEdge(state: VoiceAgentState): string {
     if (state.awaitingConfirmation) return 'confirmation';
     return 'response_generator';
   }
   ```

**Verificacion:**
- [ ] Edges definidos correctamente
- [ ] Routing logico
- [ ] No hay loops infinitos

---

### MICROFASE 7.9: Construir el Grafo Completo

**Archivo:** `lib/voice-agent/langgraph/voice-agent-graph.ts`

**Que hacer:**
1. Ensamblar todos los nodos y edges:
   ```typescript
   export function createVoiceAgentGraph() {
     const workflow = new StateGraph<VoiceAgentState>({
       channels: voiceAgentChannels
     });

     // Agregar nodos
     workflow.addNode('router', routerNode);
     workflow.addNode('rag', ragNode);
     workflow.addNode('tool_executor', toolExecutorNode);
     workflow.addNode('confirmation', confirmationNode);
     workflow.addNode('response_generator', responseGeneratorNode);

     // Agregar edges
     workflow.setEntryPoint('router');
     workflow.addConditionalEdges('router', routerEdge);
     workflow.addConditionalEdges('tool_executor', toolEdge);
     workflow.addEdge('rag', 'response_generator');
     workflow.addEdge('confirmation', 'tool_executor');
     workflow.addEdge('response_generator', END);

     return workflow.compile();
   }
   ```

2. Crear metodo `invoke` para ejecutar

**Verificacion:**
- [ ] Grafo compila sin errores
- [ ] Flujo funciona end-to-end
- [ ] Entry y exit points correctos

---

### MICROFASE 7.10: Integrar con Webhook Handler

**Archivo:** `lib/voice-agent/webhooks/handlers/function-call.handler.ts` (actualizar)

**Que hacer:**
1. Conectar el handler de function-call con LangGraph:
   ```typescript
   async function handleFunctionCall(payload) {
     const graph = createVoiceAgentGraph();

     const result = await graph.invoke({
       callId: payload.call.id,
       businessId: await getBusinessIdFromCall(payload.call),
       currentInput: payload.functionCall.parameters,
       pendingTool: {
         name: payload.functionCall.name,
         parameters: payload.functionCall.parameters
       }
     });

     return formatFunctionResult(result);
   }
   ```

**Verificacion:**
- [ ] Handler usa LangGraph
- [ ] Resultado formateado correctamente
- [ ] Errores manejados

---

### MICROFASE 7.11: Tests de LangGraph

**Archivo:** `__tests__/voice-agent/langgraph/`

**Que hacer:**
1. Tests de cada nodo:
   - Router classifica correctamente
   - RAG retorna contexto
   - Tool executor ejecuta
   - Confirmation maneja flujo

2. Tests de integracion:
   - Flujo de reservacion completo
   - Flujo de pregunta FAQ
   - Flujo con confirmacion

3. Tests de edge cases:
   - Errores de LLM
   - Timeouts
   - Intents ambiguos

**Verificacion:**
- [ ] Coverage > 80%
- [ ] Todos los nodos testeados
- [ ] Flujos completos testeados

---

### MICROFASE 7.12: Verificacion Final

**Que hacer:**
1. Probar flujos completos:
   - "Quiero reservar para 4 personas manana"
   - "Cual es el menu?"
   - "Cancela mi reservacion"

2. Verificar latencia total < 800ms
3. Verificar que Circuit Breaker protege
4. Documentar el grafo

**Verificacion:**
- [ ] Flujos funcionan
- [ ] Latencia aceptable
- [ ] Resiliencia implementada
- [ ] Documentado

---

## Archivos a Crear

```
lib/voice-agent/langgraph/
├── index.ts
├── voice-agent-graph.ts
├── state.ts
├── nodes/
│   ├── router.ts
│   ├── rag.ts
│   ├── tool-executor.ts
│   ├── confirmation.ts
│   └── response-generator.ts
└── edges/
    └── conditional-edges.ts

__tests__/voice-agent/langgraph/
├── voice-agent-graph.test.ts
├── nodes/
│   ├── router.test.ts
│   ├── rag.test.ts
│   └── tool-executor.test.ts
└── integration/
    └── full-flow.test.ts
```

---

## Diagrama del Grafo

```
                    ┌─────────┐
                    │  START  │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │ ROUTER  │
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │   RAG   │    │  TOOL   │    │ DIRECT  │
    └────┬────┘    │EXECUTOR │    └────┬────┘
         │         └────┬────┘         │
         │              │              │
         │         ┌────▼────┐         │
         │         │CONFIRM? │         │
         │         └────┬────┘         │
         │              │              │
         └──────────────┼──────────────┘
                        │
                   ┌────▼────┐
                   │RESPONSE │
                   │GENERATOR│
                   └────┬────┘
                        │
                   ┌────▼────┐
                   │   END   │
                   └─────────┘
```

---

## Criterios de Exito

- [ ] Grafo completo con 5 nodos
- [ ] Router clasifica correctamente
- [ ] RAG integrado
- [ ] Tools ejecutan con confirmacion
- [ ] Respuestas optimizadas para voz
- [ ] Latencia total < 800ms
- [ ] Tests con coverage > 80%

---

## Notas Importantes

1. **Latencia es critica** - Cada nodo debe ser rapido
2. **Circuit Breaker** - Envolver ejecucion de tools
3. **Respuestas para voz** - Cortas, naturales, sin jerga
4. **Estado persistente** - Para conversaciones multi-turno
