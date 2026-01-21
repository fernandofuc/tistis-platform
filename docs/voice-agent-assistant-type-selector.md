# Documentación: Selector de Tipo de Asistente para Voice Agent

## Análisis Exhaustivo del Problema

### 1. Contexto y Hallazgos

#### 1.1 Estado Actual de la UI
**Imagen 1 (Wizard Inicial):**
- El wizard de configuración inicial SÍ muestra selector de "Tipo de asistente"
- 4 opciones visibles para restaurante:
  - **Servicio Completo** (Recomendado) - Reservaciones + pedidos
  - **Asistente General** (Recomendado) - Versátil
  - **Solo Reservaciones** - Solo mesas
  - **Solo Pedidos** - Solo pedidos para recoger
- También muestra "Estilo de respuesta" (personalidad)

**Imagen 2 (Tab Configuración después del wizard):**
- Wizard de 3 pasos visible: Conocimiento → Configuración → Número ✅
- Banner "Prompt Inteligente" visible ✅
- **PROBLEMA**: NO hay selector de tipo de asistente visible
- Solo se puede cambiar: voz, nombre, mensaje de bienvenida

#### 1.2 Gap Identificado
El usuario puede seleccionar el tipo de asistente SOLO durante el wizard inicial. Después de completar el wizard, **no hay forma de cambiar el tipo de asistente** desde la UI principal.

Esto contradice el mensaje del wizard que dice: *"Siempre puedes cambiar el tipo de asistente más adelante."*

### 2. Arquitectura Existente

#### 2.1 Tipos de Asistente Predefinidos (6 Total)

| ID | Display Name | Vertical | Level | Recomendado |
|----|--------------|----------|-------|-------------|
| `rest_basic` | Reservaciones | restaurant | basic | ❌ |
| `rest_standard` | Reservaciones + Menú | restaurant | standard | ✅ |
| `rest_complete` | Completo | restaurant | complete | ❌ |
| `dental_basic` | Citas Básico | dental | basic | ❌ |
| `dental_standard` | Citas + Servicios | dental | standard | ✅ |
| `dental_complete` | Completo | dental | complete | ❌ |

#### 2.2 Persistencia en Base de Datos
- **Tabla**: `voice_assistant_configs`
- **Campo**: `assistant_type_id` (string)
- El campo EXISTE en la BD pero NO está expuesto en `VoiceAgentConfig` interface
- El servicio `updateVoiceConfig` NO permite actualizar `assistant_type_id`

#### 2.3 Archivos Relevantes
```
lib/voice-agent/types/assistant-types.ts    → Definiciones de tipos
lib/voice-agent/types/capability-definitions.ts → Capacidades/Tools por tipo
components/voice-agent/wizard/steps/StepSelectType.tsx → UI del selector en wizard
src/features/voice-agent/types/index.ts     → VoiceAgentConfig (sin assistant_type_id)
src/features/voice-agent/services/voice-agent.service.ts → Servicio (no actualiza tipo)
app/(dashboard)/dashboard/ai-agent-voz/page.tsx → Dashboard principal
```

### 3. Impacto del Tipo de Asistente

Cambiar el tipo de asistente afecta:
1. **Capacidades habilitadas** - Qué puede hacer el asistente
2. **Herramientas disponibles** - Tools de la API
3. **Prompt generado** - Instrucciones del sistema
4. **Duración máxima de llamada** - 5min/7min/10min según nivel
5. **Personalidad por defecto** - friendly vs professional

---

## Plan de Implementación

### FASE 1: Actualizar Tipos y Servicio (Backend)

#### Microfase 1.1: Agregar `assistant_type_id` a VoiceAgentConfig
**Archivo**: `src/features/voice-agent/types/index.ts`

```typescript
export interface VoiceAgentConfig {
  // ... campos existentes ...

  // NUEVO: Tipo de asistente
  assistant_type_id: string | null;
}

export interface VoiceAgentConfigInput {
  // ... campos existentes ...

  // NUEVO: Permitir cambiar tipo
  assistant_type_id?: string;
}
```

#### Microfase 1.2: Actualizar mapeo en servicio
**Archivo**: `src/features/voice-agent/services/voice-agent.service.ts`

```typescript
// En mapV2ConfigToLegacy():
function mapV2ConfigToLegacy(v2Config: Record<string, unknown>): VoiceAgentConfig {
  return {
    // ... campos existentes ...

    // NUEVO
    assistant_type_id: (v2Config.assistant_type_id as string) || null,
  };
}

// En updateVoiceConfig():
if (updates.assistant_type_id !== undefined) {
  v2Updates.assistant_type_id = updates.assistant_type_id;
  // También actualizar campos relacionados según el tipo
  const typeConfig = getAssistantTypeById(updates.assistant_type_id);
  if (typeConfig) {
    v2Updates.max_call_duration_seconds = typeConfig.maxCallDurationSeconds;
    // Marcar para regenerar prompt
    v2Updates.compiled_prompt = null;
    v2Updates.compiled_prompt_at = null;
  }
}
```

---

### FASE 2: Crear Componente AssistantTypeSelector

#### Microfase 2.1: Crear componente reutilizable
**Archivo NUEVO**: `src/features/voice-agent/components/AssistantTypeSelector.tsx`

Este componente será una versión adaptada de `StepSelectType.tsx` para uso fuera del wizard.

**Características:**
- Grid de 3 cards (basic, standard, complete)
- Badge "Recomendado" en tipo standard
- Badge "Actual" en tipo seleccionado
- Indicador de cambios pendientes
- Confirmación antes de cambiar (warning de regeneración de prompt)

**Props:**
```typescript
interface AssistantTypeSelectorProps {
  vertical: 'restaurant' | 'dental';
  currentTypeId: string | null;
  onTypeChange: (typeId: string) => Promise<void>;
  disabled?: boolean;
  compact?: boolean; // Para mostrar versión reducida
}
```

#### Microfase 2.2: Diseño visual
Seguir TIS TIS Design System:
- Cards con `rounded-2xl border-2`
- Gradientes por nivel:
  - basic: `from-slate-500 to-slate-600`
  - standard: `from-tis-coral to-tis-pink`
  - complete: `from-tis-purple to-indigo-600`
- Animaciones con Framer Motion
- Iconos específicos por tipo (calendar, utensils, star, tooth)

---

### FASE 3: Integrar en Tab de Configuración

#### Microfase 3.1: Agregar sección en VoicePersonalityTab
**Archivo**: `app/(dashboard)/dashboard/ai-agent-voz/page.tsx`

Ubicación: ANTES del banner "Prompt Inteligente"

```tsx
{/* Tipo de Asistente */}
<AssistantTypeSection
  config={config}
  vertical={vertical}
  onSave={handleSave}
  saving={saving}
/>

{/* Smart Prompt Banner */}
<div className="bg-gradient-to-r from-blue-50 to-indigo-50 ...">
```

#### Microfase 3.2: Crear AssistantTypeSection wrapper
**Archivo**: Dentro de `page.tsx` o como componente separado

```tsx
function AssistantTypeSection({
  config,
  vertical,
  onSave,
  saving,
}: {
  config: VoiceAgentConfig;
  vertical: 'restaurant' | 'dental' | 'medical' | 'general';
  onSave: (updates: Partial<VoiceAgentConfig>) => Promise<boolean>;
  saving: boolean;
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTypeId, setPendingTypeId] = useState<string | null>(null);

  const handleTypeChange = async (typeId: string) => {
    // Mostrar confirmación antes de cambiar
    setPendingTypeId(typeId);
    setShowConfirmModal(true);
  };

  const confirmTypeChange = async () => {
    if (!pendingTypeId) return;

    const success = await onSave({ assistant_type_id: pendingTypeId });
    if (success) {
      // Regenerar prompt automáticamente
      await regeneratePrompt();
    }
    setShowConfirmModal(false);
    setPendingTypeId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Tipo de Asistente</h3>
          <p className="text-sm text-slate-500">Define las capacidades de tu asistente</p>
        </div>
        {/* Badge del tipo actual */}
        <CurrentTypeBadge typeId={config.assistant_type_id} />
      </div>

      <AssistantTypeSelector
        vertical={vertical === 'restaurant' || vertical === 'dental' ? vertical : 'restaurant'}
        currentTypeId={config.assistant_type_id}
        onTypeChange={handleTypeChange}
        disabled={saving}
      />

      {/* Modal de confirmación */}
      <ConfirmTypeChangeModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmTypeChange}
        currentType={config.assistant_type_id}
        newType={pendingTypeId}
      />
    </div>
  );
}
```

---

### FASE 4: Modal de Confirmación de Cambio

#### Microfase 4.1: Crear ConfirmTypeChangeModal
**Archivo NUEVO**: `src/features/voice-agent/components/ConfirmTypeChangeModal.tsx`

**Contenido del modal:**
- Icono de advertencia (amber)
- Título: "¿Cambiar tipo de asistente?"
- Descripción de implicaciones:
  - "El prompt se regenerará automáticamente"
  - "Las capacidades cambiarán según el nuevo tipo"
  - "La configuración de VAPI se actualizará"
- Botones: "Cancelar" / "Confirmar cambio"

---

### FASE 5: Actualizar API Endpoint

#### Microfase 5.1: Modificar endpoint de actualización
**Archivo**: `app/api/voice-agent/config/route.ts`

```typescript
// En PATCH handler:
if (body.assistant_type_id) {
  // Validar que el tipo existe y es válido para el vertical
  const typeConfig = getAssistantTypeById(body.assistant_type_id);
  if (!typeConfig) {
    return NextResponse.json(
      { error: 'Tipo de asistente inválido' },
      { status: 400 }
    );
  }

  // Validar que coincide con el vertical del tenant
  if (typeConfig.vertical !== tenant.vertical) {
    return NextResponse.json(
      { error: 'El tipo de asistente no coincide con tu tipo de negocio' },
      { status: 400 }
    );
  }
}
```

---

### FASE 6: Regeneración Automática de Prompt

#### Microfase 6.1: Trigger de regeneración al cambiar tipo
Cuando el tipo cambia:
1. Invalidar prompt actual (`compiled_prompt = null`)
2. Llamar a `generatePrompt()` automáticamente
3. Actualizar VAPI assistant config si está activo

```typescript
// En voice-agent.service.ts
export async function updateAssistantType(
  tenantId: string,
  newTypeId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  // 1. Actualizar tipo
  const { error: updateError } = await supabase
    .from('voice_assistant_configs')
    .update({
      assistant_type_id: newTypeId,
      compiled_prompt: null,
      compiled_prompt_at: null,
    })
    .eq('tenant_id', tenantId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // 2. Regenerar prompt
  const newPrompt = await generatePrompt(tenantId);

  // 3. Actualizar VAPI si está activo
  const config = await getOrCreateVoiceConfig(tenantId);
  if (config?.voice_enabled) {
    await syncVAPIAssistant(tenantId, config);
  }

  return { success: true };
}
```

---

## Archivos a Crear/Modificar

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| MODIFICAR | `src/features/voice-agent/types/index.ts` | Agregar `assistant_type_id` |
| MODIFICAR | `src/features/voice-agent/services/voice-agent.service.ts` | Permitir actualizar tipo |
| CREAR | `src/features/voice-agent/components/AssistantTypeSelector.tsx` | Componente selector |
| CREAR | `src/features/voice-agent/components/ConfirmTypeChangeModal.tsx` | Modal de confirmación |
| MODIFICAR | `src/features/voice-agent/components/index.ts` | Exportar nuevos componentes |
| MODIFICAR | `app/(dashboard)/dashboard/ai-agent-voz/page.tsx` | Integrar selector en tab |
| MODIFICAR | `app/api/voice-agent/config/route.ts` | Validar cambio de tipo |

---

## Consideraciones de UX (Apple/Google Standards)

### 1. Feedback Visual
- Mostrar loading state mientras se regenera el prompt
- Toast de confirmación: "Tipo de asistente actualizado"
- Animación suave al cambiar de tipo seleccionado

### 2. Prevención de Errores
- Modal de confirmación antes de cambiar
- Explicar claramente las implicaciones
- No permitir cambiar si el agente está en llamada activa

### 3. Jerarquía Visual
- Tipo de asistente como primera sección en tab Configuración
- Cards prominentes con iconos claros
- Badge visual del tipo actual

### 4. Consistencia
- Usar mismos componentes del wizard
- Mantener gradientes y colores del TIS TIS Design System
- Animaciones consistentes con Framer Motion

---

## Testing Checklist

### Funcional
- [ ] Selector muestra 3 tipos correctos según vertical
- [ ] Cambiar tipo actualiza `assistant_type_id` en BD
- [ ] Prompt se regenera automáticamente
- [ ] VAPI se actualiza si el agente está activo
- [ ] Modal de confirmación funciona correctamente

### UI/UX
- [ ] Cards son clickeables y muestran hover state
- [ ] Badge "Recomendado" visible en tipo standard
- [ ] Badge "Actual" visible en tipo seleccionado
- [ ] Loading state mientras se procesa cambio
- [ ] Toast de confirmación después del cambio

### Edge Cases
- [ ] No permitir cambiar si saving=true
- [ ] Manejar error de regeneración de prompt
- [ ] Validar tipo coincide con vertical
- [ ] Mantener selección si usuario cancela

---

## Wireframe del Layout Propuesto

```
┌─────────────────────────────────────────────────────────────────┐
│ Tab: Configuración                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Tipo de Asistente                        [Badge: Standard]  │ │
│ │ Define las capacidades de tu asistente                      │ │
│ │                                                             │ │
│ │ ┌───────────┐  ┌───────────┐  ┌───────────┐                │ │
│ │ │           │  │ ★★★★★★★★★ │  │           │                │ │
│ │ │ 📅        │  │ 🍽️        │  │ ⭐        │                │ │
│ │ │           │  │ Recomendado│  │           │                │ │
│ │ │ Reserv.   │  │ Reserv+Menú│  │ Completo  │                │ │
│ │ │           │  │  [ACTUAL]  │  │           │                │ │
│ │ └───────────┘  └───────────┘  └───────────┘                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✨ Prompt Inteligente                                       │ │
│ │ El prompt se genera automáticamente...                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────┐  ┌─────────────────────┐               │
│ │ Voz del Asistente   │  │ Identidad           │               │
│ │ ...                 │  │ ...                 │               │
│ └─────────────────────┘  └─────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Documento creado: 2025-01-20*
*Versión: 1.0*
*Autor: Claude (Voice Agent Assistant Type Selector)*
