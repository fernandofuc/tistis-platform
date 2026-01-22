# FASE 1: API Backend para Test por Texto

## TIS TIS Platform - Voice Agent
### Crear Endpoint `/api/voice-agent/test`

**Fase:** 1 de 4
**Prioridad:** Alta
**Complejidad:** Media
**Tiempo Estimado:** 2-3 horas

---

## OBJETIVO

Crear un endpoint API que procese mensajes de prueba usando la misma lógica que el webhook de VAPI, permitiendo al usuario probar el asistente sin realizar una llamada real.

---

## MICROFASES

### Microfase 1.1: Crear el Endpoint Base
### Microfase 1.2: Crear el Servicio de Test
### Microfase 1.3: Integrar con LangGraph
### Microfase 1.4: Testing y Validación

---

## MICROFASE 1.1: Crear el Endpoint Base

### Archivo a Crear
`app/api/voice-agent/test/route.ts`

### Estructura del Endpoint

```typescript
/**
 * POST /api/voice-agent/test
 *
 * Procesa un mensaje de prueba y retorna la respuesta del asistente
 * usando la misma lógica que el webhook real de VAPI.
 *
 * Request Body:
 * {
 *   message: string;           // Mensaje del usuario
 *   conversation_history?: Array<{role: string, content: string}>;
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   response: string;          // Respuesta del asistente
 *   latencyMs: number;         // Tiempo de procesamiento
 *   toolsUsed?: string[];      // Tools ejecutados (si aplica)
 *   ragContext?: string;       // Contexto RAG usado (debug)
 * }
 */
```

### Código a Implementar

```typescript
// app/api/voice-agent/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { VoiceTestService } from '@/src/features/voice-agent/services/voice-test.service';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabase = createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    // 2. Obtener tenant_id del usuario
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole?.tenant_id) {
      return NextResponse.json(
        { success: false, error: 'Usuario sin tenant asignado' },
        { status: 403 }
      );
    }

    // 3. Parsear body
    const body = await request.json();
    const { message, conversation_history = [] } = body;

    if (!message || typeof message !== 'string' || message.trim().length < 1) {
      return NextResponse.json(
        { success: false, error: 'Mensaje requerido' },
        { status: 400 }
      );
    }

    // 4. Procesar mensaje con el servicio
    const result = await VoiceTestService.processTestMessage({
      tenantId: userRole.tenant_id,
      message: message.trim(),
      conversationHistory: conversation_history,
    });

    const latencyMs = Date.now() - startTime;

    // 5. Retornar respuesta
    return NextResponse.json({
      success: true,
      response: result.response,
      latencyMs,
      toolsUsed: result.toolsUsed,
      ragContext: result.ragContext,
    });

  } catch (error) {
    console.error('[Voice Test API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        latencyMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
```

### Validaciones Requeridas
- ✅ Autenticación con Bearer token
- ✅ Usuario pertenece a un tenant
- ✅ Mensaje no vacío
- ✅ Rate limiting (opcional, futuro)

---

## MICROFASE 1.2: Crear el Servicio de Test

### Archivo a Crear
`src/features/voice-agent/services/voice-test.service.ts`

### Estructura del Servicio

```typescript
/**
 * VoiceTestService
 *
 * Servicio para procesar mensajes de prueba del asistente de voz.
 * Usa la misma lógica que el webhook pero sin VAPI.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { VoiceLangGraphService } from './voice-langgraph.service';

export interface TestMessageInput {
  tenantId: string;
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface TestMessageResult {
  response: string;
  toolsUsed?: string[];
  ragContext?: string;
  error?: string;
}

export class VoiceTestService {
  /**
   * Procesa un mensaje de prueba
   */
  static async processTestMessage(input: TestMessageInput): Promise<TestMessageResult> {
    const { tenantId, message, conversationHistory = [] } = input;

    console.log('[VoiceTestService] Processing test message:', {
      tenantId,
      messageLength: message.length,
      historyLength: conversationHistory.length,
    });

    try {
      // 1. Cargar configuración del voice agent
      const voiceConfig = await this.loadVoiceConfig(tenantId);
      if (!voiceConfig) {
        return {
          response: 'Lo siento, el asistente no está configurado correctamente.',
          error: 'Voice config not found',
        };
      }

      // 2. Cargar contexto del negocio
      const businessContext = await this.loadBusinessContext(tenantId);

      // 3. Obtener el prompt compilado
      const compiledPrompt = voiceConfig.compiled_prompt ||
        await this.generatePromptIfNeeded(tenantId);

      // 4. Procesar con LangGraph
      const result = await VoiceLangGraphService.processMessage({
        tenantId,
        message,
        conversationHistory,
        systemPrompt: compiledPrompt,
        businessContext,
        voiceConfig,
      });

      return {
        response: result.response,
        toolsUsed: result.toolsUsed,
        ragContext: result.ragContext,
      };

    } catch (error) {
      console.error('[VoiceTestService] Error processing message:', error);

      return {
        response: 'Disculpa, tuve un problema procesando tu mensaje. ¿Podrías repetirlo?',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Carga la configuración del voice agent
   */
  private static async loadVoiceConfig(tenantId: string) {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('voice_assistant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[VoiceTestService] Error loading voice config:', error);
      return null;
    }

    return data;
  }

  /**
   * Carga el contexto del negocio para RAG
   */
  private static async loadBusinessContext(tenantId: string) {
    const supabase = createServiceClient();

    // Cargar tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, vertical')
      .eq('id', tenantId)
      .single();

    // Cargar knowledge base entries
    const { data: knowledge } = await supabase
      .from('business_knowledge')
      .select('category, title, content')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(50);

    // Cargar servicios/productos
    const { data: services } = await supabase
      .from('services')
      .select('name, description, price, duration_minutes')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(20);

    // Cargar horarios
    const { data: schedule } = await supabase
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('tenant_id', tenantId);

    return {
      tenant,
      knowledge: knowledge || [],
      services: services || [],
      schedule: schedule || [],
    };
  }

  /**
   * Genera el prompt si no existe uno compilado
   */
  private static async generatePromptIfNeeded(tenantId: string): Promise<string> {
    const supabase = createServiceClient();

    // Intentar usar RPC de generación de prompt
    const { data, error } = await supabase.rpc('generate_voice_agent_prompt', {
      p_tenant_id: tenantId,
    });

    if (error || !data) {
      console.warn('[VoiceTestService] Could not generate prompt, using fallback');
      return this.getFallbackPrompt();
    }

    return data;
  }

  /**
   * Prompt de fallback si no hay configuración
   */
  private static getFallbackPrompt(): string {
    return `Eres un asistente virtual profesional.
Tu objetivo es ayudar a los clientes de manera amable y eficiente.
Responde en español mexicano con un tono profesional pero cálido.
Si no tienes información sobre algo, indica que consultarás con el equipo.`;
  }
}
```

---

## MICROFASE 1.3: Integrar con LangGraph

### Verificar/Modificar
`src/features/voice-agent/services/voice-langgraph.service.ts`

### Interfaz Requerida

El servicio debe exponer un método `processMessage` que pueda ser usado tanto por el webhook como por el test:

```typescript
export interface ProcessMessageInput {
  tenantId: string;
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  systemPrompt: string;
  businessContext: BusinessContext;
  voiceConfig: VoiceAssistantConfig;
}

export interface ProcessMessageResult {
  response: string;
  toolsUsed?: string[];
  ragContext?: string;
}

export class VoiceLangGraphService {
  static async processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
    // Implementación existente del LangGraph
    // ...
  }
}
```

### Notas de Integración
- Si el servicio existente tiene una interfaz diferente, crear un adapter
- Asegurar que el RAG funcione con el contexto del negocio
- Verificar que los tools se ejecuten según el tipo de asistente

---

## MICROFASE 1.4: Testing y Validación

### Tests Manuales a Realizar

#### Test 1: Autenticación
```bash
# Sin token - debe fallar
curl -X POST http://localhost:3000/api/voice-agent/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola"}'
# Expected: 401 Unauthorized
```

#### Test 2: Mensaje básico
```bash
# Con token válido
curl -X POST http://localhost:3000/api/voice-agent/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"message": "¿Cuál es el horario?"}'
# Expected: 200 con response del negocio
```

#### Test 3: Mensaje con herramienta
```bash
# Pedir una cita/reservación
curl -X POST http://localhost:3000/api/voice-agent/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"message": "Quiero reservar una mesa para mañana a las 8"}'
# Expected: Response indicando que verificará disponibilidad
```

### Criterios de Aceptación

| Criterio | Descripción |
|----------|-------------|
| ✅ Auth | Endpoint protegido con Bearer token |
| ✅ Tenant | Solo procesa mensajes del tenant del usuario |
| ✅ Prompt | Usa el prompt compilado del negocio |
| ✅ RAG | Consulta Knowledge Base para respuestas |
| ✅ Vertical | Respuestas adaptadas a restaurant/dental |
| ✅ Latency | Retorna tiempo de procesamiento |
| ✅ Errors | Manejo graceful de errores |

---

## ARCHIVOS A CREAR

| Archivo | Descripción |
|---------|-------------|
| `app/api/voice-agent/test/route.ts` | Endpoint API |
| `src/features/voice-agent/services/voice-test.service.ts` | Servicio de test |

## ARCHIVOS A MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `src/features/voice-agent/services/voice-langgraph.service.ts` | Exponer método `processMessage` si no existe |

---

## SIGUIENTE FASE

Una vez completada esta fase, proceder a:
**FASE 2: Adaptar VoiceTestModal para Modo Texto** (`FASE_2_MODAL_MODO_TEXTO.md`)

---

*Documento de implementación - FASE 1*
