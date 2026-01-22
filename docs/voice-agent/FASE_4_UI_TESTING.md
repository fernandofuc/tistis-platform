# FASE 4: UI/UX Final y Testing

## TIS TIS Platform - Voice Agent
### Pulir Interfaz y Validación Completa

**Fase:** 4 de 4
**Prioridad:** Media
**Complejidad:** Baja
**Tiempo Estimado:** 2-3 horas
**Dependencia:** FASE 3 completada

---

## OBJETIVO

1. Pulir la interfaz del modal para ambos modos
2. Agregar indicadores visuales claros de estado
3. Mejorar feedback al usuario
4. Testing completo E2E
5. Documentar para equipo

---

## MICROFASES

### Microfase 4.1: Mejorar Indicadores de Estado
### Microfase 4.2: Agregar Feedback Visual de Audio
### Microfase 4.3: Mejorar Resumen de Llamada
### Microfase 4.4: Testing E2E
### Microfase 4.5: Documentación Final

---

## MICROFASE 4.1: Mejorar Indicadores de Estado

### Estados a Visualizar

| Estado | Modo Texto | Modo Llamada |
|--------|------------|--------------|
| `idle` | "Listo para chatear" | "Listo para llamar" |
| `connecting` | "Conectando al asistente..." | "Conectando llamada..." |
| `active` | "Escribe tu mensaje" | "Llamada activa - Habla ahora" |
| `speaking` | N/A | "El asistente está hablando..." |
| `listening` | N/A | "Te escucho..." |
| `ended` | "Chat finalizado" | "Llamada finalizada" |
| `error` | "Error de conexión" | "Error en la llamada" |

### Componente StatusIndicator

```typescript
function StatusIndicator({
  status,
  mode,
}: {
  status: VapiCallStatus | CallState;
  mode: 'text' | 'call';
}) {
  const getStatusConfig = () => {
    if (mode === 'call') {
      switch (status) {
        case 'speaking':
          return {
            icon: <Volume2 className="w-4 h-4" />,
            text: 'El asistente está hablando...',
            color: 'text-tis-coral',
            bgColor: 'bg-tis-coral/10',
            animate: true,
          };
        case 'listening':
          return {
            icon: <Mic className="w-4 h-4" />,
            text: 'Te escucho...',
            color: 'text-tis-green',
            bgColor: 'bg-tis-green/10',
            animate: true,
          };
        case 'connected':
        case 'active':
          return {
            icon: <Phone className="w-4 h-4" />,
            text: 'Llamada activa',
            color: 'text-tis-green',
            bgColor: 'bg-tis-green/10',
            animate: false,
          };
        default:
          return null;
      }
    }

    // Modo texto
    switch (status) {
      case 'active':
        return {
          icon: <MessageSquare className="w-4 h-4" />,
          text: 'Chat activo',
          color: 'text-tis-green',
          bgColor: 'bg-tis-green/10',
          animate: false,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor}`}>
      <span className={`${config.color} ${config.animate ? 'animate-pulse' : ''}`}>
        {config.icon}
      </span>
      <span className={`text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    </div>
  );
}
```

---

## MICROFASE 4.2: Agregar Feedback Visual de Audio

### Visualizador de Audio (Modo Llamada)

```typescript
function AudioVisualizer({
  isActive,
  isSpeaking,
}: {
  isActive: boolean;
  isSpeaking: boolean;
}) {
  const bars = 5;

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full ${
            isSpeaking ? 'bg-tis-coral' : 'bg-tis-green'
          }`}
          animate={isActive ? {
            height: [8, 24, 8],
          } : {
            height: 8,
          }}
          transition={{
            duration: 0.5,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}
```

### Indicador de Permiso de Micrófono

```typescript
function MicrophonePermissionBanner({
  status,
  onRequestPermission,
}: {
  status: 'granted' | 'denied' | 'prompt';
  onRequestPermission: () => void;
}) {
  if (status === 'granted') return null;

  return (
    <div className={`p-4 rounded-xl mb-4 ${
      status === 'denied'
        ? 'bg-red-50 border border-red-200'
        : 'bg-amber-50 border border-amber-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          status === 'denied' ? 'bg-red-100' : 'bg-amber-100'
        }`}>
          {status === 'denied' ? (
            <MicOff className="w-4 h-4 text-red-600" />
          ) : (
            <Mic className="w-4 h-4 text-amber-600" />
          )}
        </div>
        <div className="flex-1">
          <p className={`font-medium ${
            status === 'denied' ? 'text-red-800' : 'text-amber-800'
          }`}>
            {status === 'denied'
              ? 'Acceso al micrófono denegado'
              : 'Se requiere acceso al micrófono'}
          </p>
          <p className={`text-sm mt-1 ${
            status === 'denied' ? 'text-red-700' : 'text-amber-700'
          }`}>
            {status === 'denied'
              ? 'Por favor, habilita el micrófono en la configuración de tu navegador.'
              : 'Para usar el modo de llamada, necesitamos acceso a tu micrófono.'}
          </p>
          {status === 'prompt' && (
            <button
              onClick={onRequestPermission}
              className="mt-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              Permitir Micrófono
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## MICROFASE 4.3: Mejorar Resumen de Llamada

### Componente CallSummary

```typescript
function CallSummary({
  metrics,
  mode,
  transcript,
}: {
  metrics: CallMetrics;
  mode: 'text' | 'call';
  transcript: TranscriptMessage[];
}) {
  // Calcular estadísticas
  const userMessages = transcript.filter(m => m.role === 'user').length;
  const assistantMessages = transcript.filter(m => m.role === 'assistant').length;

  return (
    <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-tis-green/10 rounded-full">
          <CheckCircle className="w-4 h-4 text-tis-green" />
          <span className="text-sm font-medium text-tis-green">
            {mode === 'call' ? 'Llamada finalizada' : 'Chat finalizado'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        {/* Duración */}
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            {formatDuration(metrics.duration)}
          </p>
          <p className="text-xs text-slate-500">Duración</p>
        </div>

        {/* Mensajes */}
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <MessageSquare className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            {userMessages + assistantMessages}
          </p>
          <p className="text-xs text-slate-500">Mensajes</p>
        </div>

        {/* Latencia promedio */}
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            {Math.round(metrics.avgLatency)}ms
          </p>
          <p className="text-xs text-slate-500">Latencia</p>
        </div>
      </div>

      {/* Acciones post-llamada */}
      <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
        <button className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">
          Ver Transcripción
        </button>
        <button className="flex-1 px-4 py-2 bg-tis-coral text-white text-sm font-medium rounded-lg hover:bg-tis-coral/90 transition-colors">
          Nueva Prueba
        </button>
      </div>
    </div>
  );
}
```

---

## MICROFASE 4.4: Testing E2E

### Casos de Prueba

#### Suite 1: Modo Texto - Restaurant
| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| 1.1 | Abrir modal | Click "Probar" | Modal abre con quick responses de restaurant |
| 1.2 | Quick response | Click "Quiero hacer una reservación" | Mensaje se envía, respuesta sobre reservaciones |
| 1.3 | Mensaje custom | Escribir "Mesa para 4 mañana" | Respuesta menciona verificar disponibilidad |
| 1.4 | Horario | Preguntar horario | Respuesta con horarios del negocio (no genéricos) |
| 1.5 | Cerrar | Click X | Modal cierra, estado se resetea |

#### Suite 2: Modo Texto - Dental
| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| 2.1 | Abrir modal | Click "Probar" | Modal abre con quick responses de dental |
| 2.2 | Cita | Click "Quiero agendar una cita" | Respuesta sobre citas dentales |
| 2.3 | Precios | Preguntar precios | Respuesta sobre tratamientos |
| 2.4 | Servicios | "¿Qué servicios ofrecen?" | Respuesta con servicios del negocio |

#### Suite 3: Modo Llamada
| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| 3.1 | Seleccionar modo | Click "Llamada" | UI cambia a modo llamada |
| 3.2 | Iniciar | Click "Iniciar Llamada" | Conexión, audio activo |
| 3.3 | Hablar | Decir "Hola" | Transcripción aparece, asistente responde con audio |
| 3.4 | Colgar | Click botón rojo | Llamada termina, resumen aparece |
| 3.5 | Mute | Click mute durante llamada | Micrófono se silencia |

#### Suite 4: Error Handling
| # | Caso | Pasos | Esperado |
|---|------|-------|----------|
| 4.1 | Sin micrófono | Denegar permiso | Banner de error, opción de reintentar |
| 4.2 | API error | Simular error de red | Fallback a respuestas locales |
| 4.3 | VAPI error | Simular error de VAPI | Mensaje de error, opción de reintentar |

### Checklist de Validación

```markdown
## Validación Pre-Release

### Funcionalidad
- [ ] Modo texto funciona con API real
- [ ] Quick responses cambian por vertical
- [ ] Fallback funciona si API falla
- [ ] Modo llamada conecta con VAPI
- [ ] Audio bidireccional funciona
- [ ] Transcripciones se muestran correctamente
- [ ] Mute/unmute funciona
- [ ] Llamada termina correctamente
- [ ] Resumen muestra métricas correctas

### UI/UX
- [ ] Selector de modo es claro
- [ ] Estados de conexión visibles
- [ ] Indicadores de speaking/listening claros
- [ ] Responsive en móvil
- [ ] Animaciones suaves
- [ ] Sin flickering

### Errores
- [ ] Sin permiso de micrófono se maneja
- [ ] Error de API muestra mensaje claro
- [ ] Error de VAPI muestra mensaje claro
- [ ] Reintentar funciona después de error

### Performance
- [ ] Modal abre rápido (<200ms)
- [ ] Primera respuesta <2s (modo texto)
- [ ] Conexión VAPI <3s
- [ ] Sin memory leaks al cerrar
```

---

## MICROFASE 4.5: Documentación Final

### Actualizar README del Feature

Agregar sección en `src/features/voice-agent/README.md`:

```markdown
## Probar Asistente de Voz

El modal de prueba permite verificar el funcionamiento del asistente antes de activarlo.

### Modos Disponibles

#### Modo Texto
- Chat simulado con el asistente
- Usa la misma lógica que llamadas reales (LangGraph)
- Quick responses adaptadas por vertical
- No requiere micrófono

#### Modo Llamada
- Llamada WebRTC real con VAPI
- Audio bidireccional
- Transcripción en tiempo real
- Requiere permiso de micrófono

### Configuración Requerida

```env
# Para modo texto
# (Usa las variables existentes)

# Para modo llamada
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_public_key
```

### Uso

```tsx
<VoiceTestModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  config={voiceConfig}
  vertical="restaurant"
  accessToken={session.access_token}
  mode="text"  // o "call"
/>
```
```

---

## ARCHIVOS A MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `VoiceTestModal.tsx` | Agregar componentes de UI mejorados |
| `src/features/voice-agent/README.md` | Documentación del feature |

## ARCHIVOS A CREAR

| Archivo | Descripción |
|---------|-------------|
| `src/features/voice-agent/components/StatusIndicator.tsx` | Componente de estado (opcional, puede ir inline) |
| `src/features/voice-agent/components/AudioVisualizer.tsx` | Visualizador de audio (opcional) |

---

## ENTREGABLES FINALES

Al completar esta fase:

1. ✅ Modal de prueba funcional con dos modos
2. ✅ Modo texto conectado a backend real
3. ✅ Modo llamada conectado a VAPI Web SDK
4. ✅ UI adaptada por vertical
5. ✅ Manejo de errores robusto
6. ✅ Testing completo documentado
7. ✅ Documentación actualizada

---

## MÉTRICAS DE ÉXITO

| Métrica | Objetivo |
|---------|----------|
| Tiempo de conexión (texto) | < 500ms |
| Tiempo de conexión (llamada) | < 3s |
| Tasa de éxito de llamadas test | > 95% |
| Satisfacción de usuario | Positiva |

---

*Documento de implementación - FASE 4 (Final)*
