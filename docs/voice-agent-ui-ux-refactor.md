# Voice Agent UI/UX Refactor - Plan de Implementación

## Resumen Ejecutivo

Este documento detalla el plan de reestructuración completo del módulo de Voice Agent para alinearlo con la nueva arquitectura híbrida (Template + Gemini) y mejorar la experiencia de usuario siguiendo estándares Apple/Google adaptados al TIS TIS Design System.

---

## ANÁLISIS DE ESTADO ACTUAL

### Estructura Actual de Pestañas
```
┌────────────────────────────────────────────────────────────┐
│  VOZ  │  CONOCIMIENTO  │  TELÉFONOS  │  HISTORIAL  │  ANÁLISIS  │
└────────────────────────────────────────────────────────────┘
```

### Wizard de Configuración Actual (4 pasos)
```
1. Voz → 2. Instrucciones → 3. Conocimiento → 4. Número
```

### Problemas Identificados

#### 1. Wizard Obsoleto
- **Paso "Instrucciones" es redundante**: Con la arquitectura híbrida, el prompt se genera automáticamente desde templates + Gemini con Knowledge Base
- **Orden ilógico**: El usuario debería primero agregar conocimiento, luego configurar voz, y finalmente asignar número
- **Confusión del usuario**: El paso "Instrucciones" muestra campos `custom_instructions` o `system_prompt` que ya no son necesarios

#### 2. Duplicación de Funcionalidad "Probar"
- **Botón "Probar"** en el header (usa `TalkToAssistant`)
  - Interfaz simple y visual
  - Solo simula respuestas localmente (hardcoded)
  - No conecta con backend real

- **Sub-pestaña "Testing"** en Análisis (usa `CallSimulator` + `TestScenarios` + `ValidationChecklist`)
  - Interfaz más completa
  - Tiene métricas (latencia, duración, conteo de mensajes)
  - Permite input de texto
  - Tiene callback `onSendMessage` para conectar con backend
  - Incluye escenarios de prueba y validación

#### 3. Nomenclatura Confusa
| Actual | Problema |
|--------|----------|
| "Voz" | Solo configura personalidad y voz, no todo el asistente |
| "Historial" | Poco descriptivo, mejor "Llamadas" |
| "Análisis" | Mezcla métricas con pruebas |

#### 4. UI del Tab "Conocimiento"
- Sección "Templates" sin propósito claro para el usuario
- No hay indicación visual de qué información es usada para generar prompts

---

## ARQUITECTURA PROPUESTA

### Nueva Estructura de Pestañas
```
┌──────────────────────────────────────────────────────────────┐
│  CONFIGURACIÓN  │  CONOCIMIENTO  │  TELÉFONOS  │  LLAMADAS  │  MÉTRICAS  │
└──────────────────────────────────────────────────────────────┘
```

### Nuevo Wizard de Configuración (3 pasos)
```
1. Conocimiento → 2. Configuración → 3. Número
```

**Justificación del nuevo orden:**
1. **Conocimiento primero**: El Knowledge Base alimenta al template y Gemini para generar el prompt
2. **Configuración segundo**: Una vez que hay contexto del negocio, se configura voz/personalidad
3. **Número último**: Solo se necesita cuando el asistente está listo para desplegar

### Consolidación del Simulador
- El botón "Probar" usará la funcionalidad completa de `CallSimulator`
- Se eliminará la sub-pestaña "Testing" de Análisis
- Las métricas del simulador se integrarán en el modal

---

## FASES DE IMPLEMENTACIÓN

---

## FASE 1: Actualizar Wizard de Configuración

### Microfase 1.1: Modificar `VoiceAgentSetupProgress.tsx`

**Archivo:** `src/features/voice-agent/components/VoiceAgentSetupProgress.tsx`

**Cambios:**
1. Reducir de 4 a 3 pasos
2. Cambiar orden: knowledge → voice → phone
3. Eliminar paso "instructions"

**Código actual (líneas 53-88):**
```typescript
const steps = useMemo((): SetupStep[] => {
  const voiceConfigured = !!(config?.voice_id && config?.assistant_name);
  const instructionsConfigured = !!(config?.custom_instructions || config?.system_prompt);
  const phoneConfigured = phoneNumbers.some(p => p.status === 'active');

  return [
    {
      id: 'voice',
      label: 'Voz',
      // ...
    },
    {
      id: 'instructions',  // ← ELIMINAR
      label: 'Instrucciones',
      // ...
    },
    {
      id: 'knowledge',
      label: 'Conocimiento',
      // ...
    },
    {
      id: 'phone',
      label: 'Número',
      // ...
    },
  ];
}, [config, phoneNumbers, hasKnowledge]);
```

**Código propuesto:**
```typescript
const steps = useMemo((): SetupStep[] => {
  const voiceConfigured = !!(config?.voice_id && config?.assistant_name);
  const phoneConfigured = phoneNumbers.some(p => p.status === 'active');

  return [
    {
      id: 'knowledge',
      label: 'Conocimiento',
      description: 'Información de tu negocio',
      icon: <BuildingIcon className="w-4 h-4" />,
      isComplete: hasKnowledge,
    },
    {
      id: 'voice',
      label: 'Configuración',
      description: 'Voz y personalidad',
      icon: <VolumeIcon className="w-4 h-4" />,
      isComplete: voiceConfigured,
    },
    {
      id: 'phone',
      label: 'Número',
      description: 'Asigna línea telefónica',
      icon: <PhoneIcon className="w-4 h-4" />,
      isComplete: phoneConfigured,
    },
  ];
}, [config, phoneNumbers, hasKnowledge]);
```

### Microfase 1.2: Actualizar grid del wizard

**Cambio:** En línea 160, cambiar de `grid-cols-4` a `grid-cols-3`

```typescript
// Antes
<div className="grid grid-cols-4 gap-4">

// Después
<div className="grid grid-cols-3 gap-4">
```

### Microfase 1.3: Actualizar navegación por click

**Archivo:** `app/(dashboard)/dashboard/ai-agent-voz/page.tsx`

Buscar y actualizar el handler `onStepClick` para mapear correctamente:
- `knowledge` → tab `knowledge`
- `voice` → tab `voice`
- `phone` → tab `phones`

---

## FASE 2: Renombrar Pestañas

### Microfase 2.1: Actualizar tipos de Tab

**Archivo:** `app/(dashboard)/dashboard/ai-agent-voz/page.tsx`

**Cambio en línea ~60:**
```typescript
// Antes
type TabType = 'voice' | 'knowledge' | 'phones' | 'history' | 'analytics';

// Después (mantener IDs internos, solo cambiar labels)
type TabType = 'voice' | 'knowledge' | 'phones' | 'history' | 'analytics';
```

### Microfase 2.2: Actualizar etiquetas visuales en TabBar

**Buscar el componente TabBar y cambiar:**

| Tab ID | Label Actual | Label Nuevo |
|--------|--------------|-------------|
| `voice` | "Voz" | "Configuración" |
| `knowledge` | "Conocimiento" | "Conocimiento" (sin cambio) |
| `phones` | "Teléfonos" | "Teléfonos" (sin cambio) |
| `history` | "Historial" | "Llamadas" |
| `analytics` | "Análisis" | "Métricas" |

### Microfase 2.3: Eliminar sub-tabs de Analytics

**Cambio:** Eliminar la variable y lógica de `AnalyticsSubTab`

```typescript
// ELIMINAR
type AnalyticsSubTab = 'metrics' | 'testing';
const [analyticsSubTab, setAnalyticsSubTab] = useState<AnalyticsSubTab>('metrics');
```

**Simplificar AnalyticsTab para mostrar solo métricas:**
- Eliminar toggle de sub-tabs
- Eliminar renderizado condicional de Testing
- Mantener solo VoiceAgentMetrics

---

## FASE 3: Migrar Funcionalidad del Simulador

### Microfase 3.1: Crear nuevo componente híbrido

**Nuevo archivo:** `src/features/voice-agent/components/VoiceTestModal.tsx`

Este componente combinará:
- UI visual de `TalkToAssistant` (diseño del modal)
- Funcionalidad de `CallSimulator` (métricas, callback, input de texto)

**Estructura propuesta:**
```typescript
interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  onSendMessage: (message: string) => Promise<string>;
}

export function VoiceTestModal({
  isOpen,
  onClose,
  config,
  onSendMessage,
}: VoiceTestModalProps) {
  // Estados del CallSimulator
  const [callState, setCallState] = useState<CallState>('idle');
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Métricas
  const metrics = useMemo(() => ({
    duration: callDuration,
    messageCount: messages.filter(m => m.role !== 'system').length,
    avgLatency: calculateAvgLatency(messages),
    maxLatency: calculateMaxLatency(messages),
  }), [callDuration, messages]);

  // ... UI de TalkToAssistant con funcionalidad de CallSimulator
}
```

### Microfase 3.2: Integrar métricas en el modal

**Agregar sección de métricas en el footer del modal:**
```tsx
{/* Métricas en tiempo real */}
{callState === 'active' && (
  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
    <div className="flex items-center justify-center gap-6">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" />
        <span>{formatDuration(callDuration)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <MessageSquare className="w-3.5 h-3.5" />
        <span>{metrics.messageCount} mensajes</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Zap className="w-3.5 h-3.5" />
        <span>{Math.round(metrics.avgLatency)}ms</span>
      </div>
    </div>
  </div>
)}
```

### Microfase 3.3: Agregar input de texto al modal

**Reemplazar botones de respuesta rápida con input híbrido:**
```tsx
{/* Input de mensaje + Respuestas rápidas */}
{callState === 'active' && (
  <div className="mt-3 space-y-3">
    {/* Input de texto */}
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu mensaje..."
        disabled={isSending}
        className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm
                   placeholder-slate-400 focus:outline-none
                   focus:ring-2 focus:ring-tis-coral/20"
      />
      <button
        onClick={handleSendMessage}
        disabled={!inputValue.trim() || isSending}
        className="px-4 py-2.5 bg-tis-coral text-white rounded-xl
                   text-sm font-medium disabled:opacity-50"
      >
        Enviar
      </button>
    </div>

    {/* Respuestas rápidas */}
    <div className="flex flex-wrap gap-2">
      {quickResponses.map((text) => (
        <button
          key={text}
          onClick={() => handleQuickResponse(text)}
          className="px-3 py-1.5 bg-white border border-slate-200
                     text-slate-700 rounded-lg text-sm font-medium
                     hover:bg-slate-50"
        >
          {text}
        </button>
      ))}
    </div>
  </div>
)}
```

### Microfase 3.4: Conectar con backend

**Implementar `onSendMessage` en el page.tsx:**
```typescript
const handleTestMessage = async (message: string): Promise<string> => {
  try {
    const response = await fetch('/api/voice-agent/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: currentTenantId,
        message,
        conversationHistory: testConversationHistory,
      }),
    });

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error testing voice agent:', error);
    return 'Lo siento, ocurrió un error al procesar tu mensaje.';
  }
};
```

### Microfase 3.5: Actualizar uso en page.tsx

**Reemplazar TalkToAssistant con VoiceTestModal:**
```typescript
// Antes
<TalkToAssistant
  isOpen={isTestModalOpen}
  onClose={() => setIsTestModalOpen(false)}
  config={voiceConfig}
  accessToken={accessToken}
/>

// Después
<VoiceTestModal
  isOpen={isTestModalOpen}
  onClose={() => setIsTestModalOpen(false)}
  config={voiceConfig}
  onSendMessage={handleTestMessage}
/>
```

---

## FASE 4: Limpiar Tab de Métricas

### Microfase 4.1: Simplificar AnalyticsTab

**Eliminar toggle de sub-tabs y testing:**

```typescript
// Antes
function AnalyticsTab() {
  return (
    <div>
      {/* Sub-tabs toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setSubTab('metrics')}>Métricas</button>
        <button onClick={() => setSubTab('testing')}>Pruebas</button>
      </div>

      {subTab === 'metrics' ? <MetricsContent /> : <TestingContent />}
    </div>
  );
}

// Después
function AnalyticsTab() {
  return (
    <div>
      <VoiceAgentMetrics tenantId={tenantId} />
    </div>
  );
}
```

### Microfase 4.2: Eliminar imports no usados

**Remover del page.tsx:**
```typescript
// ELIMINAR
import { CallSimulator } from '@/components/voice-agent/testing/CallSimulator';
import { TestScenarios } from '@/components/voice-agent/testing/TestScenarios';
import { ValidationChecklist } from '@/components/voice-agent/testing/ValidationChecklist';
```

---

## FASE 5: Mejoras UI/UX Adicionales

### Microfase 5.1: Mejorar Tab de Conocimiento

**Problema actual:** La sección "Templates" es confusa para usuarios.

**Solución:** Renombrar y agregar tooltip explicativo:

```tsx
{/* Antes: Templates sin contexto */}
<h3>Templates</h3>

{/* Después: Con explicación */}
<div className="flex items-center gap-2">
  <h3 className="text-lg font-semibold">Plantillas de Respuesta</h3>
  <Tooltip content="Las plantillas definen cómo tu asistente estructura sus respuestas para diferentes situaciones.">
    <Info className="w-4 h-4 text-slate-400" />
  </Tooltip>
</div>
```

### Microfase 5.2: Agregar indicador de prompt auto-generado

**En el Tab de Configuración (antes Voz), agregar:**
```tsx
<div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
  <div className="flex items-start gap-3">
    <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
    <div>
      <h4 className="font-medium text-blue-900">Prompt Inteligente</h4>
      <p className="text-sm text-blue-700 mt-1">
        El prompt de tu asistente se genera automáticamente usando la información
        de tu negocio y la configuración de personalidad.
      </p>
    </div>
  </div>
</div>
```

### Microfase 5.3: Corregir inconsistencia de vertical

**Problema:** En screenshots se muestra "Restaurant" cuando debería ser "Clínica".

**Solución:** Asegurar que el vertical se lea del config del tenant:
```typescript
const verticalLabel = useMemo(() => {
  const labels: Record<Vertical, string> = {
    restaurant: 'Restaurante',
    dental: 'Clínica Dental',
    generic: 'Negocio',
  };
  return labels[tenantConfig?.vertical || 'generic'];
}, [tenantConfig?.vertical]);
```

---

## FASE 6: Testing y Validación

### Microfase 6.1: Test de Wizard

**Verificar:**
- [ ] Wizard muestra 3 pasos en lugar de 4
- [ ] Orden correcto: Conocimiento → Configuración → Número
- [ ] Click en cada paso navega a la pestaña correcta
- [ ] Progreso se calcula correctamente (33%, 66%, 100%)

### Microfase 6.2: Test de Pestañas

**Verificar:**
- [ ] "Configuración" muestra contenido de personalidad/voz
- [ ] "Llamadas" muestra historial de llamadas
- [ ] "Métricas" muestra solo métricas (sin testing)

### Microfase 6.3: Test del Simulador

**Verificar:**
- [ ] Modal se abre desde botón "Probar"
- [ ] Input de texto funciona
- [ ] Respuestas rápidas funcionan
- [ ] Métricas se actualizan en tiempo real
- [ ] Conexión con backend funciona (si está disponible)

---

## ARCHIVOS A MODIFICAR

| Archivo | Acción | Prioridad |
|---------|--------|-----------|
| `src/features/voice-agent/components/VoiceAgentSetupProgress.tsx` | Modificar | Alta |
| `app/(dashboard)/dashboard/ai-agent-voz/page.tsx` | Modificar | Alta |
| `src/features/voice-agent/components/VoiceTestModal.tsx` | Crear | Alta |
| `src/features/voice-agent/components/TalkToAssistant.tsx` | Deprecar/Eliminar | Media |
| `components/voice-agent/testing/CallSimulator.tsx` | Referencia (no eliminar) | N/A |

---

## CRONOGRAMA SUGERIDO

| Fase | Descripción | Dependencias |
|------|-------------|--------------|
| Fase 1 | Actualizar Wizard | Ninguna |
| Fase 2 | Renombrar Pestañas | Ninguna |
| Fase 3 | Migrar Simulador | Fase 2 |
| Fase 4 | Limpiar Métricas | Fase 3 |
| Fase 5 | Mejoras UI/UX | Fase 1, 2 |
| Fase 6 | Testing | Todas |

---

## CONSIDERACIONES DE DISEÑO TIS TIS

### Colores
- **Primary (Coral):** `rgb(223, 115, 115)` - Botones principales, acentos
- **Secondary (Pink):** Gradientes con coral
- **Success (Green):** Estados completados, validaciones
- **Neutral (Slate):** Textos, bordes, fondos

### Espaciado
- Padding en cards: `p-6` (24px)
- Gap entre elementos: `gap-4` (16px)
- Border radius: `rounded-2xl` (16px) para cards, `rounded-xl` (12px) para botones

### Animaciones
- Usar Framer Motion para transiciones
- `duration: 0.2` para interacciones rápidas
- `duration: 0.5` para cambios de estado

### Accesibilidad
- Botones con `min-h-[44px]` para touch targets
- Contraste adecuado en textos
- Focus states visibles

---

## NOTAS FINALES

1. **No eliminar `CallSimulator.tsx`** - Puede ser útil para pruebas internas o futuras funcionalidades
2. **Mantener compatibilidad** - Los IDs internos de tabs no cambian, solo las etiquetas visuales
3. **Feedback visual** - Agregar loading states y confirmaciones en todas las interacciones
4. **Mobile-first** - Todas las mejoras deben funcionar en dispositivos móviles

---

## IMPLEMENTACIÓN COMPLETADA

### Resumen de Cambios Realizados

#### Fase 1: Wizard de Configuración ✅
- **Archivo modificado:** `src/features/voice-agent/components/VoiceAgentSetupProgress.tsx`
- Reducido de 4 pasos a 3 pasos
- Eliminado paso "Instrucciones" (ahora se genera automáticamente)
- Nuevo orden: Conocimiento → Configuración → Número
- Actualizado grid de `grid-cols-4` a `grid-cols-3`

#### Fase 2: Renombrado de Pestañas ✅
- **Archivo modificado:** `app/(dashboard)/dashboard/ai-agent-voz/page.tsx`
- Cambios de etiquetas:
  - "Voz" → "Configuración"
  - "Historial" → "Llamadas"
  - "Análisis" → "Métricas"

#### Fase 3: Nuevo Modal de Prueba ✅
- **Archivo creado:** `src/features/voice-agent/components/VoiceTestModal.tsx`
- Combina UI de TalkToAssistant con funcionalidad de CallSimulator
- Incluye:
  - Input de texto para enviar mensajes
  - Respuestas rápidas predefinidas
  - Métricas en tiempo real (duración, mensajes, latencia)
  - Indicador de typing
  - Resumen al finalizar llamada
- Exportado en `src/features/voice-agent/components/index.ts`

#### Fase 4: Simplificación de Tab Métricas ✅
- Eliminados sub-tabs (metrics/testing)
- Eliminado tipo `AnalyticsSubTab`
- Eliminados imports de testing components en página principal
- AnalyticsTab ahora muestra solo MetricsDashboard

#### Fase 5: Mejoras UI/UX ✅
- Agregado banner "Prompt Inteligente" en tab de Configuración
- Informa al usuario que el prompt se genera automáticamente
- Diseño con gradiente azul siguiendo TIS TIS Design System

### Archivos Modificados
| Archivo | Cambios |
|---------|---------|
| `VoiceAgentSetupProgress.tsx` | Reducido a 3 pasos, nuevo orden |
| `page.tsx` (ai-agent-voz) | Renombrado tabs, simplificado AnalyticsTab, banner |
| `VoiceTestModal.tsx` | Nuevo componente |
| `index.ts` (components) | Export de VoiceTestModal |
| `voice-agent-ui-ux-refactor.md` | Documentación |

### Build Status
✅ Build exitoso sin errores

---

*Documento creado: 2025-01-20*
*Versión: 1.1 (Actualizado con implementación)*
*Autor: Claude (Voice Agent v2.0 Refactor)*
