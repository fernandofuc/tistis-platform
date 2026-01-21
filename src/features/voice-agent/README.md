# Voice Agent Feature

Sistema de prueba de asistentes de voz para TIS TIS Platform.

## Estructura de Archivos

```
src/features/voice-agent/
├── components/
│   ├── VoiceTestModal.tsx       # Modal principal de prueba
│   ├── StatusIndicator.tsx      # Indicador de estado de llamada/chat
│   ├── AudioVisualizer.tsx      # Visualizador de audio animado
│   ├── MicrophonePermissionBanner.tsx  # Banner de permisos de micrófono
│   └── CallSummary.tsx          # Resumen de llamada finalizada
├── hooks/
│   ├── useVapiWebClient.ts      # Hook para VAPI Web SDK
│   └── useMicrophonePermission.ts  # Hook para permisos de micrófono
├── services/
│   └── vapi-api.service.ts      # Servicio para VAPI API
├── types/
│   └── index.ts                 # Tipos TypeScript
└── README.md                    # Esta documentación
```

## Componentes

### VoiceTestModal

Modal principal que permite probar asistentes de voz en dos modos:

- **Modo Texto**: Chat de texto con respuestas del backend
- **Modo Llamada**: Llamada de voz real via VAPI Web SDK

**Props:**
```typescript
interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  vertical: 'restaurant' | 'dental';
  accessToken: string;
  initialMode?: 'text' | 'call';
}
```

**Uso:**
```tsx
<VoiceTestModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  config={voiceConfig}
  vertical="restaurant"
  accessToken={token}
/>
```

### StatusIndicator

Muestra el estado actual de la llamada/chat con iconos y animaciones.

**Props:**
```typescript
interface StatusIndicatorProps {
  status: VapiCallStatus | 'sending' | 'waiting';
  mode: 'text' | 'call';
  size?: 'sm' | 'md' | 'lg';
}
```

**Estados soportados:**
- `idle` - Inactivo
- `connecting` - Conectando
- `listening` - Escuchando (call mode)
- `speaking` - Asistente hablando
- `sending` - Enviando mensaje (text mode)
- `waiting` - Esperando respuesta
- `ended` - Finalizado
- `error` - Error

### AudioVisualizer

Visualizador de audio animado con barras que cambian según el estado.

**Props:**
```typescript
interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  bars?: number;        // default: 5
  maxHeight?: number;   // default: 24
  minHeight?: number;   // default: 8
}
```

**Variantes:**
- `AudioVisualizer` - Visualizador principal
- `MiniVisualizer` - Versión compacta para uso inline

### MicrophonePermissionBanner

Banner que muestra el estado del permiso de micrófono y permite solicitarlo.

**Props:**
```typescript
interface MicrophonePermissionBannerProps {
  status: MicrophonePermissionState;
  onRequestPermission: () => void;
  isChecking?: boolean;
}
```

**Estados:**
- `checking` - Verificando (no se muestra)
- `granted` - Concedido (no se muestra)
- `prompt` - Requiere permiso (muestra botón)
- `denied` - Denegado (muestra instrucciones)

### CallSummary

Resumen de la llamada/chat finalizado con métricas.

**Props:**
```typescript
interface CallSummaryProps {
  metrics: CallMetrics;
  mode: 'text' | 'call';
  transcript: TranscriptMessage[];
  onNewTest: () => void;
  onViewTranscript?: () => void;
  onClose: () => void;
}
```

## Hooks

### useVapiWebClient

Hook para manejar llamadas via VAPI Web SDK.

**Uso:**
```typescript
const {
  status,           // Estado actual de la llamada
  durationSeconds,  // Duración en segundos
  isMuted,          // Si el micrófono está silenciado
  error,            // Error si existe
  startCall,        // Iniciar llamada
  endCall,          // Terminar llamada
  toggleMute,       // Silenciar/activar micrófono
} = useVapiWebClient({
  publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
  onTranscript: (transcript) => { /* ... */ },
  onStatusChange: (status) => { /* ... */ },
  onError: (error) => { /* ... */ },
});
```

### useMicrophonePermission

Hook para verificar y solicitar permisos de micrófono.

**Uso:**
```typescript
const {
  permissionState,    // Estado del permiso
  isChecking,         // Si está verificando
  isGranted,          // Si está concedido
  isDenied,           // Si está denegado
  requestPermission,  // Solicitar permiso
  checkPermission,    // Re-verificar permiso
} = useMicrophonePermission();
```

## Servicios

### vapi-api.service.ts

Servicio para interactuar con VAPI API desde el servidor.

**Funciones:**
- `createAssistant(request)` - Crea un assistant temporal
- `deleteAssistant(id)` - Elimina un assistant
- `getAssistant(id)` - Obtiene detalles de un assistant

## Variables de Entorno

```env
# VAPI Configuration
NEXT_PUBLIC_VAPI_PUBLIC_KEY=  # Public key para Web SDK
VAPI_API_KEY=                  # Private key para Server API
```

## Flujo de Llamada (Modo Call)

1. Usuario hace clic en "Iniciar Llamada"
2. Se crea un assistant temporal via `/api/voice-agent/test/assistant`
3. Se inicia la llamada VAPI con el assistant ID
4. Audio bidireccional en tiempo real
5. Al finalizar, se elimina el assistant temporal

## Flujo de Chat (Modo Texto)

1. Usuario hace clic en "Iniciar Chat de Prueba"
2. Se muestra el first_message del asistente
3. Usuario envía mensajes via input o quick responses
4. Backend procesa y responde via `/api/voice-agent/test`
5. Métricas de latencia se muestran en tiempo real

## Verticales Soportadas

### Restaurant
- Quick responses para reservaciones, menú, horarios
- Fallbacks específicos de restaurante

### Dental
- Quick responses para citas, servicios, precios
- Fallbacks específicos de clínica dental

## Colores de Marca

```typescript
const TIS_CORAL = 'rgb(223, 115, 115)';  // Color principal
const TIS_GREEN = 'rgb(34, 197, 94)';    // Estado activo/escuchando
```

## Accesibilidad

Los componentes siguen las mejores prácticas de accesibilidad:

- **VoiceTestModal**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, cierra con tecla Escape
- **StatusIndicator**: `role="status"`, `aria-live="polite"` para anunciar cambios
- **MicrophonePermissionBanner**: `role="alert"`, `aria-live="polite"`
- **Botones de control**: Todos tienen `aria-label` descriptivos
- **Iconos decorativos**: Marcados con `aria-hidden="true"`
- **AudioVisualizer**: `aria-hidden="true"` (puramente decorativo)
