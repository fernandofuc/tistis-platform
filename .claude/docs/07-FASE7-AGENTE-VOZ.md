# FASE 7: Optimización del Agente de Voz

## Objetivo
Mejorar prompts y organización del Agente de Voz, asegurar que el preview de prompt funciona correctamente y optimizar la experiencia de voz.

---

## 1. Estado Actual Analizado

### Archivos Principales

| Archivo | Descripción |
|---------|-------------|
| `app/(dashboard)/dashboard/ai-agent-voz/page.tsx` | Página principal del agente de voz |
| `src/features/voice-agent/services/voice-agent.service.ts` | Servicio principal |
| `src/features/voice-agent/services/voice-langgraph.service.ts` | Integración LangGraph |
| `src/features/voice-agent/types/index.ts` | Tipos y constantes |

### Datos Existentes

```typescript
interface VoiceAgentConfig {
  id: string;
  tenant_id: string;
  is_active: boolean;
  voice_id: string;
  assistant_name: string;
  language: string;  // 'es-MX'
  system_prompt: string | null;
  system_prompt_generated_at: string | null;
  custom_instructions: string;
  response_speed: ResponseSpeedPreset;
  voice_quality: VoiceQualityPreset;
  // ...
}
```

### API Response Actual

```typescript
interface VoiceAgentResponse {
  data?: {
    config: VoiceAgentConfig;
    generated_prompt: string | null;  // Ya existe
  };
}
```

---

## 2. Mejoras Identificadas

### 2.1 Preview de Prompt ya existe pero...

El sistema actual YA incluye `generated_prompt` en la respuesta del API:

```typescript
// En /api/voice-agent/route.ts
return {
  success: true,
  data: {
    config,
    phone_numbers,
    usage_summary,
    recent_calls,
    generated_prompt: config.system_prompt,  // Ya se envía
  }
};
```

**Pero NO hay UI para visualizarlo** en el dashboard.

---

## 3. Mejoras Propuestas

### 3.1 Agregar Sección de Preview en Dashboard de Voz

```typescript
// Nuevo componente: VoicePromptPreview.tsx

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/shared/components/ui';
import { cn } from '@/src/shared/utils';

interface Props {
  prompt: string | null;
  generatedAt: string | null;
  onRegenerate: () => Promise<void>;
  regenerating?: boolean;
}

export function VoicePromptPreview({ prompt, generatedAt, onRegenerate, regenerating }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca generado';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const estimatedTokens = prompt ? Math.ceil(prompt.length / 4) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Prompt del Asistente</h4>
            <p className="text-xs text-slate-500">
              {prompt ? `~${estimatedTokens.toLocaleString()} tokens` : 'Sin generar'}
              {generatedAt && ` • Actualizado: ${formatDate(generatedAt)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-2" />
                Regenerando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerar
              </>
            )}
          </Button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg
              className={cn('w-5 h-5 transition-transform', isExpanded && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {prompt ? (
              <div className="bg-slate-900 p-4 max-h-96 overflow-y-auto">
                <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                  {prompt}
                </pre>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-600">No hay prompt generado</p>
                <p className="text-sm text-slate-500 mt-1">
                  Configura tu asistente y guarda los cambios para generar el prompt
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 3.2 Integrar en página de Voz

```typescript
// En ai-agent-voz/page.tsx - Agregar en tab 'knowledge'

{activeTab === 'knowledge' && (
  <div className="space-y-6">
    {/* Existing BusinessKnowledgeSection */}
    <BusinessKnowledgeSection config={config} onUpdate={handleSaveConfig} />

    {/* NEW: Prompt Preview */}
    <VoicePromptPreview
      prompt={data?.data?.generated_prompt || config.system_prompt}
      generatedAt={config.system_prompt_generated_at}
      onRegenerate={async () => {
        await handleSaveConfig({ ...config, force_regenerate: true });
      }}
      regenerating={saving}
    />

    {/* Existing GuidedInstructionsSection */}
    <GuidedInstructionsSection config={config} onUpdate={handleSaveConfig} />
  </div>
)}
```

---

## 4. Optimización del Prompt de Voz

### 4.1 Diferencias clave vs Mensajería

| Aspecto | Mensajería | Voz |
|---------|------------|-----|
| Longitud de respuesta | 1-3 párrafos | 2-3 oraciones |
| Formato | Markdown, emojis | Solo texto hablado |
| Pausas | Saltos de línea | Muletillas naturales |
| Confirmaciones | ✅ visual | Repetir verbalmente |
| Datos críticos | Texto plano | Deletrear |

### 4.2 Template de Prompt para Voz

```typescript
// voice-prompt-template.ts

export const VOICE_PROMPT_TEMPLATE = `
# IDENTIDAD

Soy {assistant_name}, el asistente telefónico de {business_name}.
Atiendo llamadas para {primary_mission}.

# ESTILO DE COMUNICACIÓN

## Tono
- Amigable y profesional
- Hablar con claridad y ritmo pausado
- Usar muletillas naturales: "Claro...", "Mmm, déjame ver...", "Por supuesto..."

## Estructura de Respuestas
- Respuestas cortas: 2-3 oraciones máximo
- Una idea por respuesta
- Confirmar información importante repitiéndola
- Deletrear datos críticos letra por letra

## Manejo de Llamada
- Identificarse al inicio: "Hola, gracias por llamar a {business_name}, soy {assistant_name}"
- Preguntar nombre del cliente si no lo dice
- Confirmar antes de finalizar: "¿Hay algo más en lo que pueda ayudarte?"

# INFORMACIÓN DEL NEGOCIO

## Servicios Principales
{top_services}

## Horarios
{operating_hours_spoken}

## Ubicación
{main_branch_spoken}

# CAPACIDADES

## Qué PUEDO hacer
- Agendar citas
- Dar información de precios y servicios
- Proporcionar horarios y ubicación
- Transferir a un humano si es necesario

## Qué NO PUEDO hacer
- Dar diagnósticos médicos
- Modificar citas existentes (transferir a recepción)
- Procesar pagos

# MANEJO DE SITUACIONES

## Si no entiendo
"Disculpa, no escuché bien. ¿Podrías repetirlo?"

## Si no sé la respuesta
"Mmm, déjame verificar eso. ¿Me permites un momento?"
Si aún no sé: "Para darte información precisa, te voy a transferir con mi compañera"

## Si el cliente se molesta
"Entiendo tu frustración. Déjame ver cómo puedo ayudarte mejor."
Si escala: "Voy a transferirte con alguien que pueda ayudarte mejor con esto."

## Emergencias
"Eso suena urgente. Te voy a transferir inmediatamente con nuestro equipo."

# INSTRUCCIONES PERSONALIZADAS
{custom_instructions}

# CIERRE DE LLAMADA
"Perfecto, {nombre si lo sé}. ¿Hay algo más en lo que pueda ayudarte?"
"Gracias por llamar a {business_name}. ¡Que tengas excelente día!"
`;
```

### 4.3 Función de Formateo para Voz

```typescript
// voice-prompt-formatter.ts

export function formatForVoice(text: string): string {
  // Convertir números a palabras habladas
  text = text.replace(/\$(\d+),?(\d+)?/g, (_, p1, p2) => {
    const num = p2 ? `${p1}${p2}` : p1;
    return `${parseInt(num).toLocaleString('es-MX')} pesos`;
  });

  // Convertir horarios a formato hablado
  text = text.replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => {
    const hour = parseInt(h);
    const min = parseInt(m);
    const period = hour >= 12 ? 'de la tarde' : 'de la mañana';
    const hourSpoken = hour > 12 ? hour - 12 : hour;
    const minSpoken = min > 0 ? ` con ${min} minutos` : '';
    return `${hourSpoken}${minSpoken} ${period}`;
  });

  // Eliminar emojis y caracteres especiales
  text = text.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
  text = text.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
  text = text.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');

  // Eliminar markdown
  text = text.replace(/[*_#`]/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  return text.trim();
}

export function formatOperatingHoursForVoice(hours: OperatingHours): string {
  const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const enabledDays = dayKeys
    .map((key, idx) => ({ key, name: days[idx], data: hours[key as keyof OperatingHours] }))
    .filter(d => d.data?.enabled);

  if (enabledDays.length === 0) return 'Cerrado';

  // Agrupar días consecutivos con mismo horario
  const groups: { days: string[]; open: string; close: string }[] = [];

  enabledDays.forEach(day => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.open === day.data!.open && lastGroup.close === day.data!.close) {
      lastGroup.days.push(day.name);
    } else {
      groups.push({
        days: [day.name],
        open: day.data!.open,
        close: day.data!.close,
      });
    }
  });

  return groups
    .map(g => {
      const daysText = g.days.length > 1
        ? `${g.days[0]} a ${g.days[g.days.length - 1]}`
        : g.days[0];
      return `${daysText} de ${formatTimeForVoice(g.open)} a ${formatTimeForVoice(g.close)}`;
    })
    .join(', ');
}

function formatTimeForVoice(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'de la tarde' : 'de la mañana';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const min = m > 0 ? ` ${m}` : '';
  return `${hour}${min} ${period}`;
}
```

---

## 5. API para Regenerar Prompt de Voz

```typescript
// app/api/voice-agent/regenerate-prompt/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PromptGeneratorService } from '@/src/features/ai/services/prompt-generator.service';
import { formatForVoice, formatOperatingHoursForVoice } from '@/src/features/voice-agent/utils/voice-prompt-formatter';

export async function POST(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Get tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole?.tenant_id) {
      return NextResponse.json({ error: 'Sin tenant' }, { status: 403 });
    }

    // Get voice config
    const { data: voiceConfig } = await supabase
      .from('voice_agent_config')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (!voiceConfig) {
      return NextResponse.json({ error: 'Configuración de voz no encontrada' }, { status: 404 });
    }

    // Collect business context
    const service = new PromptGeneratorService();
    const context = await service.collectBusinessContext(userRole.tenant_id);

    // Build voice-specific prompt
    const voicePrompt = await service.generateVoicePrompt({
      ...context,
      assistantName: voiceConfig.assistant_name,
      customInstructions: voiceConfig.custom_instructions,
    });

    // Save
    const { error: updateError } = await supabase
      .from('voice_agent_config')
      .update({
        system_prompt: voicePrompt,
        system_prompt_generated_at: new Date().toISOString(),
      })
      .eq('id', voiceConfig.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      prompt: voicePrompt,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API voice regenerate-prompt] Error:', error);
    return NextResponse.json(
      { error: 'Error al regenerar prompt' },
      { status: 500 }
    );
  }
}
```

---

## 6. Checklist de Implementación

### Componentes
- [ ] Crear `VoicePromptPreview.tsx`
- [ ] Integrar en página de voz

### Formateo
- [ ] Crear `voice-prompt-formatter.ts`
- [ ] Implementar `formatForVoice()`
- [ ] Implementar `formatOperatingHoursForVoice()`

### API
- [ ] Crear `/api/voice-agent/regenerate-prompt/route.ts`

### Prompt Template
- [ ] Crear `voice-prompt-template.ts`
- [ ] Integrar en `prompt-generator.service.ts`

### Verificación
- [ ] Preview de prompt visible en dashboard
- [ ] Botón de regenerar funciona
- [ ] Prompt formateado para voz (sin emojis, números hablados)
- [ ] Horarios en formato hablado

---

## 7. Notas

1. **Prompt de voz debe ser más corto** que el de mensajería
2. **Eliminar todo formato visual** (markdown, emojis)
3. **Números deben estar en formato hablado** ("quince mil pesos" no "$15,000")
4. **Horarios en formato hablado** ("nueve de la mañana" no "9:00")
5. **Incluir muletillas naturales** para humanizar las respuestas
