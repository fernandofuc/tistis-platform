# FASE 2: Adaptar VoiceTestModal para Modo Texto

## TIS TIS Platform - Voice Agent
### Modificar Modal para Usar Backend Real

**Fase:** 2 de 4
**Prioridad:** Alta
**Complejidad:** Media
**Tiempo Estimado:** 2-3 horas
**Dependencia:** FASE 1 completada

---

## OBJETIVO

Modificar el `VoiceTestModal` para:
1. Recibir la vertical como prop y adaptar UI
2. Conectar con el endpoint `/api/voice-agent/test`
3. Mostrar quick responses dinámicas por vertical
4. Mantener fallback graceful si API falla

---

## MICROFASES

### Microfase 2.1: Agregar Props y Tipos
### Microfase 2.2: Crear Quick Responses por Vertical
### Microfase 2.3: Conectar con API Backend
### Microfase 2.4: Actualizar Página Principal

---

## MICROFASE 2.1: Agregar Props y Tipos

### Archivo a Modificar
`src/features/voice-agent/components/VoiceTestModal.tsx`

### Cambios en Interface

```typescript
// ANTES
interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  onSendMessage?: (message: string) => Promise<string>;
}

// DESPUÉS
interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  vertical: 'restaurant' | 'dental';
  accessToken: string;
  /** Modo de prueba: 'text' = chat, 'call' = VAPI Web (FASE 3) */
  mode?: 'text' | 'call';
}
```

### Nuevos Tipos a Agregar

```typescript
// Respuesta del API
interface TestApiResponse {
  success: boolean;
  response: string;
  latencyMs: number;
  toolsUsed?: string[];
  ragContext?: string;
  error?: string;
}

// Configuración de Quick Responses por Vertical
interface QuickResponseConfig {
  text: string;
  category?: 'greeting' | 'booking' | 'info' | 'farewell';
}
```

---

## MICROFASE 2.2: Crear Quick Responses por Vertical

### Constantes a Agregar

```typescript
// ======================
// QUICK RESPONSES POR VERTICAL
// ======================

const QUICK_RESPONSES_BY_VERTICAL: Record<
  'restaurant' | 'dental',
  QuickResponseConfig[]
> = {
  restaurant: [
    { text: 'Hola', category: 'greeting' },
    { text: 'Quiero hacer una reservación', category: 'booking' },
    { text: '¿Tienen mesas disponibles?', category: 'booking' },
    { text: '¿Cuál es el menú?', category: 'info' },
    { text: '¿Cuál es el horario?', category: 'info' },
    { text: '¿Tienen servicio a domicilio?', category: 'info' },
    { text: 'Gracias', category: 'farewell' },
  ],
  dental: [
    { text: 'Hola', category: 'greeting' },
    { text: 'Quiero agendar una cita', category: 'booking' },
    { text: '¿Tienen citas disponibles?', category: 'booking' },
    { text: '¿Qué servicios ofrecen?', category: 'info' },
    { text: '¿Cuál es el horario?', category: 'info' },
    { text: '¿Cuáles son los precios?', category: 'info' },
    { text: 'Gracias', category: 'farewell' },
  ],
};

// ======================
// FALLBACK RESPONSES POR VERTICAL
// (Solo se usan si API falla)
// ======================

const FALLBACK_RESPONSES_BY_VERTICAL: Record<
  'restaurant' | 'dental',
  Record<string, string>
> = {
  restaurant: {
    hola: '¡Hola! Bienvenido a nuestro restaurante. ¿En qué puedo ayudarte?',
    reserv: 'Con gusto te ayudo con una reservación. ¿Para qué día y cuántas personas?',
    mesa: 'Permíteme verificar disponibilidad. ¿Para qué día y hora te gustaría?',
    menu: 'Tenemos una variedad de platillos. ¿Te gustaría conocer nuestras especialidades?',
    horario: 'Nuestro horario está disponible en nuestra configuración. ¿Hay algo más en que pueda ayudarte?',
    domicilio: 'Sí, contamos con servicio a domicilio. ¿Te gustaría hacer un pedido?',
    gracias: '¡De nada! Fue un placer atenderte. ¡Esperamos verte pronto!',
  },
  dental: {
    hola: '¡Hola! Bienvenido a nuestra clínica dental. ¿En qué puedo ayudarte?',
    cita: 'Con gusto te ayudo a agendar una cita. ¿Qué día te gustaría venir?',
    disponib: 'Permíteme verificar nuestra agenda. ¿Tienes preferencia de horario?',
    servicio: 'Ofrecemos diversos tratamientos dentales. ¿Hay algo específico que necesites?',
    horario: 'Nuestro horario de atención está en nuestra configuración. ¿Puedo ayudarte en algo más?',
    precio: 'Los precios varían según el tratamiento. ¿Qué procedimiento te interesa?',
    gracias: '¡De nada! Gracias por contactarnos. ¡Cuida tu sonrisa!',
  },
};

/**
 * Obtiene respuesta de fallback si API falla
 */
function getFallbackResponse(message: string, vertical: 'restaurant' | 'dental'): string {
  const responses = FALLBACK_RESPONSES_BY_VERTICAL[vertical];
  const lowerMessage = message.toLowerCase();

  const key = Object.keys(responses).find(k => lowerMessage.includes(k));
  return key
    ? responses[key]
    : 'Entendido. ¿Hay algo más en lo que pueda ayudarte?';
}
```

---

## MICROFASE 2.3: Conectar con API Backend

### Hook para API Call

```typescript
/**
 * Envía mensaje al backend y obtiene respuesta
 */
const sendMessageToBackend = useCallback(async (
  message: string,
  history: TranscriptMessage[]
): Promise<{ response: string; latencyMs: number }> => {
  const conversationHistory = history
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  try {
    const response = await fetch('/api/voice-agent/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: TestApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return {
      response: data.response,
      latencyMs: data.latencyMs,
    };

  } catch (error) {
    console.error('[VoiceTestModal] API error, using fallback:', error);

    // Usar fallback si API falla
    return {
      response: getFallbackResponse(message, vertical),
      latencyMs: 0,
    };
  }
}, [accessToken, vertical]);
```

### Modificar handleSendMessage

```typescript
// Reemplazar la lógica actual de handleSendMessage

const handleSendMessage = useCallback(async (text: string) => {
  if (!text.trim() || isSending || callState !== 'active') return;

  const messageText = text.trim();
  setInputValue('');
  setIsSending(true);
  setIsListening(false);

  // Add user message
  addMessage('user', messageText);

  try {
    // Llamar al backend
    const { response, latencyMs } = await sendMessageToBackend(messageText, transcript);

    // Add assistant response
    addMessage('assistant', response, latencyMs);

  } catch (error) {
    console.error('[VoiceTestModal] Error:', error);
    addMessage('system', 'Error al procesar mensaje');
  }

  setIsSending(false);
  setIsListening(true);
  inputRef.current?.focus();
}, [isSending, callState, transcript, sendMessageToBackend, addMessage]);
```

---

## MICROFASE 2.4: Actualizar Página Principal

### Archivo a Modificar
`app/(dashboard)/dashboard/ai-agent-voz/page.tsx`

### Cambios en el Uso del Modal

```typescript
// ANTES (líneas 1851-1855)
<VoiceTestModal
  isOpen={showTalkToAssistant}
  onClose={() => setShowTalkToAssistant(false)}
  config={config}
/>

// DESPUÉS
<VoiceTestModal
  isOpen={showTalkToAssistant}
  onClose={() => setShowTalkToAssistant(false)}
  config={config}
  vertical={vertical}
  accessToken={accessToken}
  mode="text"  // Por defecto texto, FASE 3 agregará 'call'
/>
```

### Verificar que `vertical` está Disponible

```typescript
// Ya existe en línea 1372
const vertical = (tenant?.vertical || 'dental') as 'dental' | 'restaurant' | 'medical' | 'general';

// Mapear a los dos soportados
const effectiveVertical: 'restaurant' | 'dental' =
  vertical === 'restaurant' ? 'restaurant' : 'dental';
```

---

## CÓDIGO COMPLETO MODIFICADO

### VoiceTestModal.tsx (Secciones Clave)

```typescript
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, X, Bot, User,
  Loader2, AlertCircle, Play, Clock, MessageSquare, Zap, Send,
} from 'lucide-react';
import type { VoiceAgentConfig } from '../types';

// ======================
// TYPES
// ======================

interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  vertical: 'restaurant' | 'dental';
  accessToken: string;
  mode?: 'text' | 'call';
}

interface TestApiResponse {
  success: boolean;
  response: string;
  latencyMs: number;
  toolsUsed?: string[];
  error?: string;
}

// ... (TranscriptMessage, CallMetrics sin cambios)

// ======================
// QUICK RESPONSES POR VERTICAL
// ======================

const QUICK_RESPONSES_BY_VERTICAL: Record<'restaurant' | 'dental', string[]> = {
  restaurant: [
    'Hola',
    'Quiero hacer una reservación',
    '¿Cuál es el horario?',
    '¿Cuál es el menú?',
    'Gracias',
  ],
  dental: [
    'Hola',
    'Quiero agendar una cita',
    '¿Cuál es el horario?',
    '¿Cuáles son los precios?',
    'Gracias',
  ],
};

// ... (FALLBACK_RESPONSES_BY_VERTICAL y getFallbackResponse)

// ======================
// COMPONENT
// ======================

export function VoiceTestModal({
  isOpen,
  onClose,
  config,
  vertical,
  accessToken,
  mode = 'text',
}: VoiceTestModalProps) {
  // ... (estados existentes)

  // Quick responses dinámicas
  const quickResponses = useMemo(() =>
    QUICK_RESPONSES_BY_VERTICAL[vertical],
    [vertical]
  );

  // Función para enviar al backend
  const sendMessageToBackend = useCallback(async (message: string) => {
    // ... (implementación de arriba)
  }, [accessToken, vertical, transcript]);

  // handleSendMessage modificado
  const handleSendMessage = useCallback(async (text: string) => {
    // ... (implementación de arriba)
  }, [/* deps */]);

  // ... (resto del componente)

  // En el render de quick responses:
  {quickResponses.map((text) => (
    <button
      key={text}
      onClick={() => handleSendMessage(text)}
      disabled={isSending}
      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
    >
      {text}
    </button>
  ))}
}
```

---

## CRITERIOS DE ACEPTACIÓN

| Criterio | Descripción |
|----------|-------------|
| ✅ Props | Modal recibe `vertical` y `accessToken` |
| ✅ Quick | Quick responses cambian según vertical |
| ✅ API | Mensajes se envían a `/api/voice-agent/test` |
| ✅ Fallback | Si API falla, usa respuestas de fallback por vertical |
| ✅ Latency | Muestra latencia real del backend |
| ✅ UI | Sin cambios visuales significativos (solo contenido) |

---

## TESTING MANUAL

### Test 1: Vertical Restaurant
1. Abrir modal en tenant de restaurante
2. Verificar quick responses: "Quiero hacer una reservación", "¿Cuál es el menú?"
3. Enviar mensaje "Quiero reservar una mesa"
4. Verificar respuesta menciona reservaciones (no citas)

### Test 2: Vertical Dental
1. Abrir modal en tenant dental
2. Verificar quick responses: "Quiero agendar una cita", "¿Cuáles son los precios?"
3. Enviar mensaje "Quiero una cita"
4. Verificar respuesta menciona citas dentales

### Test 3: Fallback
1. Desconectar red / simular error de API
2. Enviar mensaje
3. Verificar que respuesta de fallback es coherente con vertical

---

## ARCHIVOS A MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `src/features/voice-agent/components/VoiceTestModal.tsx` | Props, quick responses, API call |
| `app/(dashboard)/dashboard/ai-agent-voz/page.tsx` | Pasar props adicionales al modal |

---

## SIGUIENTE FASE

Una vez completada esta fase, proceder a:
**FASE 3: Integración VAPI Web SDK para Modo Llamada** (`FASE_3_VAPI_WEB_SDK.md`)

---

*Documento de implementación - FASE 2*
