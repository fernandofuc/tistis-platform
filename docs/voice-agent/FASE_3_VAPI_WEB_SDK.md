# FASE 3: Integración VAPI Web SDK para Modo Llamada

## TIS TIS Platform - Voice Agent
### Implementar Llamada Real con VAPI

**Fase:** 3 de 4
**Prioridad:** Alta
**Complejidad:** Alta
**Tiempo Estimado:** 4-5 horas
**Dependencia:** FASE 2 completada

---

## OBJETIVO

Implementar el modo "Llamada" que permite al usuario realizar una prueba de voz real usando VAPI Web SDK:

1. Iniciar llamada WebRTC con VAPI
2. Usuario habla → Deepgram transcribe → LangGraph procesa → ElevenLabs responde
3. Audio bidireccional real
4. Mismo flujo que una llamada telefónica real

---

## MICROFASES

### Microfase 3.1: Configurar VAPI Web SDK
### Microfase 3.2: Crear Hook useVapiWebClient
### Microfase 3.3: Crear Endpoint para Temporary Assistant
### Microfase 3.4: Integrar en VoiceTestModal
### Microfase 3.5: Agregar Selector de Modo (Texto/Llamada)

---

## MICROFASE 3.1: Configurar VAPI Web SDK

### Instalar Dependencia

```bash
npm install @vapi-ai/web
# o
bun add @vapi-ai/web
```

### Variable de Entorno Nueva

```env
# .env.local
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key_here
```

**Nota:** VAPI requiere una Public Key diferente a la API Key para el Web SDK.
Obtener desde: https://dashboard.vapi.ai/account

### Verificar package.json

```json
{
  "dependencies": {
    "@vapi-ai/web": "^2.0.0"
  }
}
```

---

## MICROFASE 3.2: Crear Hook useVapiWebClient

### Archivo a Crear
`src/features/voice-agent/hooks/useVapiWebClient.ts`

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Vapi from '@vapi-ai/web';

// ======================
// TYPES
// ======================

export type VapiCallStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'ended'
  | 'error';

export interface VapiTranscript {
  role: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
  timestamp: Date;
}

export interface UseVapiWebClientOptions {
  publicKey: string;
  onTranscript?: (transcript: VapiTranscript) => void;
  onStatusChange?: (status: VapiCallStatus) => void;
  onError?: (error: Error) => void;
  onCallEnd?: (report: CallEndReport) => void;
}

export interface CallEndReport {
  durationSeconds: number;
  messages: VapiTranscript[];
  endReason: string;
}

export interface UseVapiWebClientReturn {
  status: VapiCallStatus;
  transcripts: VapiTranscript[];
  durationSeconds: number;
  isMuted: boolean;
  error: Error | null;
  startCall: (assistantId: string) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
}

// ======================
// HOOK
// ======================

export function useVapiWebClient(
  options: UseVapiWebClientOptions
): UseVapiWebClientReturn {
  const { publicKey, onTranscript, onStatusChange, onError, onCallEnd } = options;

  // State
  const [status, setStatus] = useState<VapiCallStatus>('idle');
  const [transcripts, setTranscripts] = useState<VapiTranscript[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize VAPI client
  useEffect(() => {
    if (!publicKey) {
      console.error('[useVapiWebClient] Public key is required');
      return;
    }

    vapiRef.current = new Vapi(publicKey);

    // Event listeners
    const vapi = vapiRef.current;

    vapi.on('call-start', () => {
      console.log('[VAPI] Call started');
      updateStatus('connected');
      startTimer();
    });

    vapi.on('call-end', () => {
      console.log('[VAPI] Call ended');
      updateStatus('ended');
      stopTimer();

      if (onCallEnd) {
        onCallEnd({
          durationSeconds,
          messages: transcripts,
          endReason: 'user_hangup',
        });
      }
    });

    vapi.on('speech-start', () => {
      updateStatus('speaking');
    });

    vapi.on('speech-end', () => {
      updateStatus('listening');
    });

    vapi.on('message', (message: any) => {
      if (message.type === 'transcript') {
        const transcript: VapiTranscript = {
          role: message.role,
          text: message.transcript,
          isFinal: message.transcriptType === 'final',
          timestamp: new Date(),
        };

        if (transcript.isFinal) {
          setTranscripts(prev => [...prev, transcript]);
        }

        if (onTranscript) {
          onTranscript(transcript);
        }
      }
    });

    vapi.on('error', (err: Error) => {
      console.error('[VAPI] Error:', err);
      setError(err);
      updateStatus('error');

      if (onError) {
        onError(err);
      }
    });

    // Cleanup
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
      stopTimer();
    };
  }, [publicKey]);

  // Helper functions
  const updateStatus = useCallback((newStatus: VapiCallStatus) => {
    setStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
  }, [onStatusChange]);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDurationSeconds(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Public methods
  const startCall = useCallback(async (assistantId: string) => {
    if (!vapiRef.current) {
      throw new Error('VAPI client not initialized');
    }

    try {
      setError(null);
      setTranscripts([]);
      setDurationSeconds(0);
      updateStatus('connecting');

      await vapiRef.current.start(assistantId);

    } catch (err) {
      console.error('[useVapiWebClient] Error starting call:', err);
      setError(err instanceof Error ? err : new Error('Failed to start call'));
      updateStatus('error');
      throw err;
    }
  }, [updateStatus]);

  const endCall = useCallback(() => {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
    stopTimer();
    updateStatus('ended');
  }, [stopTimer, updateStatus]);

  const toggleMute = useCallback(() => {
    if (vapiRef.current) {
      const newMuted = !isMuted;
      vapiRef.current.setMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  return {
    status,
    transcripts,
    durationSeconds,
    isMuted,
    error,
    startCall,
    endCall,
    toggleMute,
  };
}
```

---

## MICROFASE 3.3: Crear Endpoint para Temporary Assistant

### Propósito
Para llamadas de prueba web, necesitamos un assistant temporal en VAPI que:
1. Se crea al iniciar la prueba
2. Usa la configuración del tenant
3. Se puede eliminar después (opcional)

### Archivo a Crear
`app/api/voice-agent/test/assistant/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { VAPIService } from '@/src/features/voice-agent/services/vapi-api.service';
import { VoiceTestService } from '@/src/features/voice-agent/services/voice-test.service';

/**
 * POST /api/voice-agent/test/assistant
 *
 * Crea un assistant temporal en VAPI para pruebas web.
 * Retorna el assistantId para usar con VAPI Web SDK.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // 2. Obtener tenant_id
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole?.tenant_id) {
      return NextResponse.json({ success: false, error: 'Sin tenant' }, { status: 403 });
    }

    // 3. Cargar configuración del voice agent
    const voiceConfig = await VoiceTestService.loadVoiceConfig(userRole.tenant_id);
    if (!voiceConfig) {
      return NextResponse.json(
        { success: false, error: 'Voice agent no configurado' },
        { status: 400 }
      );
    }

    // 4. Cargar tenant para nombre
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, vertical')
      .eq('id', userRole.tenant_id)
      .single();

    // 5. Obtener prompt compilado
    const compiledPrompt = voiceConfig.compiled_prompt ||
      await VoiceTestService.generatePromptIfNeeded(userRole.tenant_id);

    // 6. Crear assistant temporal en VAPI
    const serverUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`;

    const { assistant, error: vapiError } = await VAPIService.createAssistant({
      name: `Test - ${tenant?.name || 'Assistant'} - ${Date.now()}`,
      firstMessage: voiceConfig.first_message || 'Hola, ¿en qué puedo ayudarte?',
      firstMessageMode: 'assistant-speaks-first',

      // Modelo con prompt personalizado
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: compiledPrompt,
        }],
        temperature: 0.7,
      },

      // Voz configurada
      voice: {
        provider: '11labs',
        voiceId: voiceConfig.voice_id || 'LegCbmbXKbT5PUp3QFWv',
        model: 'eleven_multilingual_v2',
        stability: voiceConfig.voice_stability || 0.5,
        similarityBoost: voiceConfig.voice_similarity_boost || 0.75,
      },

      // Transcripción
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'multi',
      },

      // Server URL para tools y respuestas avanzadas
      serverUrl,
      serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,

      // Metadata para identificar como test
      metadata: {
        tenant_id: userRole.tenant_id,
        is_test: true,
        created_at: new Date().toISOString(),
      },
    });

    if (vapiError || !assistant) {
      console.error('[Test Assistant] VAPI error:', vapiError);
      return NextResponse.json(
        { success: false, error: 'Error creando assistant en VAPI' },
        { status: 500 }
      );
    }

    // 7. Retornar assistant ID
    return NextResponse.json({
      success: true,
      assistantId: assistant.id,
      assistantName: assistant.name,
      firstMessage: assistant.firstMessage,
    });

  } catch (error) {
    console.error('[Test Assistant] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/voice-agent/test/assistant
 *
 * Elimina un assistant temporal de VAPI.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('id');

    if (!assistantId) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    // Validar auth...
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Eliminar de VAPI
    const { error } = await VAPIService.deleteAssistant(assistantId);

    if (error) {
      console.error('[Test Assistant] Delete error:', error);
      // No falla si no se puede eliminar (puede que ya no exista)
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Test Assistant] Delete error:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
```

---

## MICROFASE 3.4: Integrar en VoiceTestModal

### Agregar Lógica de Modo Llamada

```typescript
// En VoiceTestModal.tsx

import { useVapiWebClient, VapiCallStatus, VapiTranscript } from '../hooks/useVapiWebClient';

// Dentro del componente:

export function VoiceTestModal({
  isOpen,
  onClose,
  config,
  vertical,
  accessToken,
  mode = 'text',
}: VoiceTestModalProps) {
  // Estados existentes...
  const [testAssistantId, setTestAssistantId] = useState<string | null>(null);
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false);

  // Hook de VAPI (solo si modo es 'call')
  const vapiClient = useVapiWebClient({
    publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '',
    onTranscript: (transcript) => {
      if (transcript.isFinal) {
        addMessage(transcript.role, transcript.text);
      }
    },
    onStatusChange: (status) => {
      // Mapear status de VAPI a callState del modal
      if (status === 'connected') setCallState('active');
      if (status === 'ended') setCallState('ended');
      if (status === 'error') setCallState('error');
    },
    onError: (error) => {
      setError(error.message);
      setCallState('error');
    },
  });

  // Crear assistant temporal y empezar llamada
  const startVapiCall = useCallback(async () => {
    setCallState('connecting');
    setIsCreatingAssistant(true);

    try {
      // 1. Crear assistant temporal
      const response = await fetch('/api/voice-agent/test/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error creando assistant');
      }

      setTestAssistantId(data.assistantId);

      // 2. Iniciar llamada con VAPI Web SDK
      await vapiClient.startCall(data.assistantId);

    } catch (err) {
      console.error('[VoiceTestModal] Error starting VAPI call:', err);
      setError(err instanceof Error ? err.message : 'Error iniciando llamada');
      setCallState('error');
    } finally {
      setIsCreatingAssistant(false);
    }
  }, [accessToken, vapiClient]);

  // Terminar llamada VAPI
  const endVapiCall = useCallback(async () => {
    vapiClient.endCall();

    // Opcionalmente eliminar assistant temporal
    if (testAssistantId) {
      try {
        await fetch(`/api/voice-agent/test/assistant?id=${testAssistantId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
      } catch (err) {
        console.warn('[VoiceTestModal] Could not delete test assistant:', err);
      }
      setTestAssistantId(null);
    }

    setCallState('ended');
  }, [vapiClient, testAssistantId, accessToken]);

  // Decidir qué función usar según modo
  const startCall = mode === 'call' ? startVapiCall : startTextCall;
  const endCall = mode === 'call' ? endVapiCall : endTextCall;
  const toggleMute = mode === 'call' ? vapiClient.toggleMute : toggleTextMute;
  const isMuted = mode === 'call' ? vapiClient.isMuted : isMutedText;

  // ... resto del render
}
```

---

## MICROFASE 3.5: Agregar Selector de Modo

### Componente ModeSelector

```typescript
// Agregar dentro de VoiceTestModal o como componente separado

function TestModeSelector({
  mode,
  onModeChange,
  disabled,
}: {
  mode: 'text' | 'call';
  onModeChange: (mode: 'text' | 'call') => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
      <button
        onClick={() => onModeChange('text')}
        disabled={disabled}
        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          mode === 'text'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <MessageSquare className="w-4 h-4 inline mr-2" />
        Texto
      </button>
      <button
        onClick={() => onModeChange('call')}
        disabled={disabled}
        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          mode === 'call'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Phone className="w-4 h-4 inline mr-2" />
        Llamada
      </button>
    </div>
  );
}
```

### Integración en UI

En el estado `idle` del modal, mostrar el selector:

```tsx
{callState === 'idle' && (
  <div className="text-center">
    {/* Mode Selector */}
    <div className="mb-6">
      <TestModeSelector
        mode={currentMode}
        onModeChange={setCurrentMode}
        disabled={false}
      />
    </div>

    {/* Icon y descripción según modo */}
    <div className="flex justify-center mb-5">
      {/* ... */}
    </div>

    <h3 className="text-xl font-bold text-slate-900 mb-2">
      {currentMode === 'text' ? 'Prueba por Texto' : 'Prueba por Voz'}
    </h3>
    <p className="text-sm text-slate-500 mb-6">
      {currentMode === 'text'
        ? 'Chatea con tu asistente para probar sus respuestas.'
        : 'Inicia una llamada real para escuchar a tu asistente.'}
    </p>

    {/* CTA Button */}
    <button onClick={startCall}>
      {currentMode === 'text' ? 'Iniciar Chat' : 'Iniciar Llamada'}
    </button>
  </div>
)}
```

---

## CRITERIOS DE ACEPTACIÓN

| Criterio | Descripción |
|----------|-------------|
| ✅ VAPI SDK | @vapi-ai/web instalado y configurado |
| ✅ Public Key | NEXT_PUBLIC_VAPI_PUBLIC_KEY configurada |
| ✅ Hook | useVapiWebClient funciona correctamente |
| ✅ Assistant | Endpoint crea assistant temporal con config del tenant |
| ✅ Llamada | Usuario puede iniciar llamada web real |
| ✅ Audio | Audio bidireccional funciona (hablar/escuchar) |
| ✅ Transcript | Transcripciones se muestran en tiempo real |
| ✅ Cleanup | Assistant temporal se elimina al cerrar |
| ✅ Mode | Selector permite cambiar entre texto y llamada |

---

## TESTING MANUAL

### Test 1: Modo Llamada Básico
1. Abrir modal → Seleccionar "Llamada"
2. Click en "Iniciar Llamada"
3. Verificar conexión exitosa
4. Decir "Hola"
5. Verificar que asistente responde con audio

### Test 2: Transcripción
1. Durante llamada, decir frases
2. Verificar transcripciones aparecen en chat
3. Verificar tanto user como assistant transcripts

### Test 3: Finalizar Llamada
1. Durante llamada activa, click en botón colgar
2. Verificar llamada termina
3. Verificar resumen se muestra

### Test 4: Error Handling
1. Simular error (sin permiso micrófono)
2. Verificar mensaje de error apropiado
3. Verificar opción de reintentar

---

## ARCHIVOS A CREAR

| Archivo | Descripción |
|---------|-------------|
| `src/features/voice-agent/hooks/useVapiWebClient.ts` | Hook para VAPI Web SDK |
| `app/api/voice-agent/test/assistant/route.ts` | Endpoint para assistant temporal |

## ARCHIVOS A MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `src/features/voice-agent/components/VoiceTestModal.tsx` | Integrar modo llamada |
| `.env.local` | Agregar NEXT_PUBLIC_VAPI_PUBLIC_KEY |
| `package.json` | Agregar @vapi-ai/web |

---

## SIGUIENTE FASE

Una vez completada esta fase, proceder a:
**FASE 4: UI/UX Final y Testing** (`FASE_4_UI_TESTING.md`)

---

*Documento de implementación - FASE 3*
