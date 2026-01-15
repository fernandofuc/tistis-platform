# FASE 5: Validaciones y Feedback

## Objetivo
Implementar indicador de completitud del Knowledge Base y preview de prompts generados para cada perfil de agente.

---

## 1. Archivos a Crear/Modificar

| Archivo | Cambios | Prioridad |
|---------|---------|-----------|
| Nuevo: `KBCompletenessIndicator.tsx` | Componente de completitud | Alta |
| Nuevo: `PromptPreview.tsx` | Componente de preview de prompts | Alta |
| `KnowledgeBase.tsx` | Integrar componentes | Alta |
| Nuevo: `/api/ai-config/preview-prompt/route.ts` | API para generar preview | Alta |

---

## 2. Componente: KBCompletenessIndicator

### Diseño

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Tu Base de Conocimiento                                                     │
│                                                                             │
│  [████████████████░░░░░░] 72% completo                                      │
│                                                                             │
│  ✅ Identidad del asistente    ✅ Saludo configurado                        │
│  ✅ Políticas de cancelación   ⚠️ Despedida sin configurar                  │
│  ⚠️ Información de servicios   ⚠️ Manejo de competencia                    │
│                                                                             │
│  Tip: Completa la despedida para mejorar la experiencia del cliente        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Código

```typescript
// components/KBCompletenessIndicator.tsx
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';

interface KBData {
  instructions: any[];
  policies: any[];
  articles: any[];
  templates: any[];
  competitors: any[];
}

interface CompletionCheck {
  key: string;
  label: string;
  tip: string;
  check: (data: KBData) => boolean;
  priority: 'essential' | 'recommended' | 'optional';
}

const COMPLETION_CHECKS: CompletionCheck[] = [
  // Esenciales
  {
    key: 'identity',
    label: 'Identidad del asistente',
    tip: 'Define quién es tu asistente (nombre, personalidad)',
    check: (data) => data.instructions.some(i => i.instruction_type === 'identity'),
    priority: 'essential',
  },
  {
    key: 'greeting',
    label: 'Saludo configurado',
    tip: 'Crea una plantilla de saludo para nuevas conversaciones',
    check: (data) => data.templates.some(t => t.trigger_type === 'greeting'),
    priority: 'essential',
  },
  {
    key: 'farewell',
    label: 'Despedida configurada',
    tip: 'Define cómo se despide tu asistente',
    check: (data) => data.templates.some(t => t.trigger_type === 'farewell'),
    priority: 'essential',
  },

  // Recomendados
  {
    key: 'cancellation',
    label: 'Política de cancelación',
    tip: 'Informa a los clientes sobre tu política de cancelación de citas',
    check: (data) => data.policies.some(p => p.policy_type === 'cancellation'),
    priority: 'recommended',
  },
  {
    key: 'payment',
    label: 'Política de pagos',
    tip: 'Explica métodos de pago y condiciones',
    check: (data) => data.policies.some(p => p.policy_type === 'payment'),
    priority: 'recommended',
  },
  {
    key: 'communication_style',
    label: 'Estilo de comunicación',
    tip: 'Define cómo debe comunicarse tu asistente',
    check: (data) => data.instructions.some(i => i.instruction_type === 'communication_style'),
    priority: 'recommended',
  },

  // Opcionales pero valiosos
  {
    key: 'articles',
    label: 'Artículos de información',
    tip: 'Agrega información útil sobre tus servicios',
    check: (data) => data.articles.length > 0,
    priority: 'optional',
  },
  {
    key: 'competitors',
    label: 'Manejo de competencia',
    tip: 'Define cómo responder cuando mencionen a la competencia',
    check: (data) => data.competitors.length > 0,
    priority: 'optional',
  },
  {
    key: 'upselling',
    label: 'Instrucciones de upselling',
    tip: 'Enseña a tu asistente a promocionar servicios premium',
    check: (data) => data.instructions.some(i => i.instruction_type === 'upselling'),
    priority: 'optional',
  },
];

interface Props {
  data: KBData;
  className?: string;
  compact?: boolean;
}

export function KBCompletenessIndicator({ data, className, compact = false }: Props) {
  const completionStatus = useMemo(() => {
    const results = COMPLETION_CHECKS.map(check => ({
      ...check,
      completed: check.check(data),
    }));

    const essentialChecks = results.filter(r => r.priority === 'essential');
    const recommendedChecks = results.filter(r => r.priority === 'recommended');
    const optionalChecks = results.filter(r => r.priority === 'optional');

    const essentialComplete = essentialChecks.filter(r => r.completed).length;
    const recommendedComplete = recommendedChecks.filter(r => r.completed).length;
    const optionalComplete = optionalChecks.filter(r => r.completed).length;

    // Peso: esenciales 50%, recomendados 35%, opcionales 15%
    const percentage = Math.round(
      (essentialComplete / essentialChecks.length) * 50 +
      (recommendedComplete / recommendedChecks.length) * 35 +
      (optionalComplete / optionalChecks.length) * 15
    );

    // Encontrar siguiente tip
    const nextIncomplete = results.find(r => !r.completed && r.priority === 'essential')
      || results.find(r => !r.completed && r.priority === 'recommended')
      || results.find(r => !r.completed);

    return {
      percentage,
      results,
      essentialComplete,
      essentialTotal: essentialChecks.length,
      recommendedComplete,
      recommendedTotal: recommendedChecks.length,
      optionalComplete,
      optionalTotal: optionalChecks.length,
      nextTip: nextIncomplete,
    };
  }, [data]);

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' };
    if (percentage >= 70) return { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50' };
    return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' };
  };

  const colors = getStatusColor(completionStatus.percentage);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionStatus.percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn('h-full rounded-full', colors.bg)}
          />
        </div>
        <span className={cn('text-sm font-medium', colors.text)}>
          {completionStatus.percentage}%
        </span>
      </div>
    );
  }

  return (
    <div className={cn('p-5 bg-white rounded-xl border border-gray-200', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">Completitud de tu Base de Conocimiento</h4>
        <span className={cn(
          'px-3 py-1 rounded-full text-sm font-bold',
          colors.light, colors.text
        )}>
          {completionStatus.percentage}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${completionStatus.percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', colors.bg)}
        />
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {completionStatus.results.map((item) => (
          <div
            key={item.key}
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg text-sm',
              item.completed ? 'bg-green-50' : 'bg-gray-50'
            )}
          >
            {item.completed ? (
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex-shrink-0',
                item.priority === 'essential' ? 'border-red-300' :
                item.priority === 'recommended' ? 'border-amber-300' : 'border-gray-300'
              )} />
            )}
            <span className={item.completed ? 'text-green-700' : 'text-gray-600'}>
              {item.label}
            </span>
            {!item.completed && item.priority === 'essential' && (
              <span className="ml-auto text-xs text-red-500 font-medium">Esencial</span>
            )}
          </div>
        ))}
      </div>

      {/* Next Tip */}
      {completionStatus.nextTip && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-purple-900">
                Siguiente paso: {completionStatus.nextTip.label}
              </p>
              <p className="text-xs text-purple-700 mt-0.5">
                {completionStatus.nextTip.tip}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Componente: PromptPreview

### Diseño

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vista Previa de Prompts                                                     │
│                                                                             │
│  Ver cómo se ve el prompt que usarán tus agentes de IA                      │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Negocio       │  │    Personal     │  │      Voz        │              │
│  │   [Ver prompt]  │  │   [Ver prompt]  │  │   [Ver prompt]  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  PREVIEW: Perfil Negocio                                     [Copiar]  ││
│  │                                                                        ││
│  │  # CONTEXTO DEL NEGOCIO                                               ││
│  │                                                                        ││
│  │  ## Información General                                               ││
│  │  - Nombre: Clínica Dental Sonrisa                                     ││
│  │  - Vertical: dental                                                   ││
│  │  ...                                                                  ││
│  │                                                                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  Tokens estimados: ~1,850  |  Última actualización: hace 2 horas           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Código

```typescript
// components/PromptPreview.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/shared/components/ui';
import { cn } from '@/src/shared/utils';
import { useToast } from '@/src/hooks/useToast';

type ProfileType = 'business' | 'personal' | 'voice';

interface PromptData {
  prompt: string;
  tokens_estimated: number;
  generated_at: string | null;
  profile_name: string;
}

interface Props {
  className?: string;
}

export function PromptPreview({ className }: Props) {
  const [selectedProfile, setSelectedProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(false);
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const profiles: { key: ProfileType; label: string; description: string; icon: React.ReactNode }[] = [
    {
      key: 'business',
      label: 'Perfil Negocio',
      description: 'Usado en canales del negocio',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      key: 'personal',
      label: 'Perfil Personal',
      description: 'Usado en marca personal',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      key: 'voice',
      label: 'Agente de Voz',
      description: 'Usado en llamadas telefónicas',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
    },
  ];

  const fetchPrompt = async (profileType: ProfileType) => {
    setLoading(true);
    setError(null);
    setSelectedProfile(profileType);

    try {
      const response = await fetch(`/api/ai-config/preview-prompt?profile=${profileType}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener el prompt');
      }

      const data = await response.json();
      setPromptData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!promptData?.prompt) return;

    try {
      await navigator.clipboard.writeText(promptData.prompt);
      showToast({ type: 'success', message: 'Prompt copiado al portapapeles' });
    } catch {
      showToast({ type: 'error', message: 'Error al copiar' });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca generado';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-indigo-900 mb-1">Vista Previa de Prompts</h4>
            <p className="text-sm text-indigo-700">
              Visualiza cómo se ve el prompt completo que usarán tus agentes de IA.
              Incluye toda la información de tu Base de Conocimiento.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Selector */}
      <div className="grid grid-cols-3 gap-3">
        {profiles.map((profile) => (
          <button
            key={profile.key}
            onClick={() => fetchPrompt(profile.key)}
            disabled={loading}
            className={cn(
              'p-4 rounded-xl border-2 transition-all text-left',
              selectedProfile === profile.key
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-purple-200'
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center mb-2',
              selectedProfile === profile.key
                ? 'bg-purple-100 text-purple-600'
                : 'bg-gray-100 text-gray-600'
            )}>
              {profile.icon}
            </div>
            <p className="font-semibold text-gray-900">{profile.label}</p>
            <p className="text-xs text-gray-500">{profile.description}</p>
          </button>
        ))}
      </div>

      {/* Prompt Preview */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-8 bg-gray-50 rounded-xl text-center"
          >
            <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Generando preview del prompt...</p>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 rounded-xl border border-red-200"
          >
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}

        {promptData && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gray-900 rounded-xl overflow-hidden"
          >
            {/* Preview Header */}
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-gray-400 text-sm ml-2">
                  {promptData.profile_name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyToClipboard}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copiar
              </Button>
            </div>

            {/* Preview Content */}
            <div className="p-4 max-h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {promptData.prompt}
              </pre>
            </div>

            {/* Preview Footer */}
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between text-xs text-gray-500">
              <span>~{promptData.tokens_estimated.toLocaleString()} tokens</span>
              <span>Actualizado: {formatDate(promptData.generated_at)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No selection state */}
      {!selectedProfile && !loading && (
        <div className="p-8 bg-gray-50 rounded-xl text-center">
          <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-gray-600">Selecciona un perfil para ver su prompt</p>
        </div>
      )}
    </div>
  );
}
```

---

## 4. API: Preview Prompt Endpoint

```typescript
// app/api/ai-config/preview-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PromptGeneratorService } from '@/src/features/ai/services/prompt-generator.service';

export async function GET(request: NextRequest) {
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

    // Get profile type from query
    const { searchParams } = new URL(request.url);
    const profileType = searchParams.get('profile') as 'business' | 'personal' | 'voice';

    if (!profileType || !['business', 'personal', 'voice'].includes(profileType)) {
      return NextResponse.json({ error: 'Tipo de perfil inválido' }, { status: 400 });
    }

    // Generate or retrieve prompt
    let prompt: string;
    let generatedAt: string | null = null;

    if (profileType === 'voice') {
      // Get voice agent prompt
      const { data: voiceConfig } = await supabase
        .from('voice_agent_config')
        .select('system_prompt, system_prompt_generated_at')
        .eq('tenant_id', userRole.tenant_id)
        .single();

      prompt = voiceConfig?.system_prompt || 'Prompt de voz no generado';
      generatedAt = voiceConfig?.system_prompt_generated_at;
    } else {
      // Get messaging agent prompt
      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('generated_system_prompt, generated_prompt_at')
        .eq('tenant_id', userRole.tenant_id)
        .eq('profile_type', profileType)
        .single();

      if (profile?.generated_system_prompt) {
        prompt = profile.generated_system_prompt;
        generatedAt = profile.generated_prompt_at;
      } else {
        // Generate preview on the fly
        const service = new PromptGeneratorService();
        const context = await service.collectBusinessContext(userRole.tenant_id);
        prompt = service.buildMetaPrompt({
          ...context,
          profileType,
          channel: 'messaging'
        });
        generatedAt = null;
      }
    }

    // Estimate tokens (rough: ~4 chars per token)
    const tokensEstimated = Math.ceil(prompt.length / 4);

    return NextResponse.json({
      prompt,
      tokens_estimated: tokensEstimated,
      generated_at: generatedAt,
      profile_name: profileType === 'voice'
        ? 'Agente de Voz'
        : profileType === 'personal'
        ? 'Perfil Personal'
        : 'Perfil Negocio',
    });

  } catch (error) {
    console.error('[API preview-prompt] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar preview' },
      { status: 500 }
    );
  }
}
```

---

## 5. Integración en KnowledgeBase

```typescript
// En KnowledgeBase.tsx - Agregar sección al final

{/* Bottom Section - Completeness & Preview */}
<div className="mt-8 pt-8 border-t border-gray-200 space-y-6">
  {/* Completeness Indicator */}
  <KBCompletenessIndicator data={data} />

  {/* Prompt Preview */}
  <div className="pt-6">
    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      Vista Previa de Prompts
    </h4>
    <PromptPreview />
  </div>
</div>
```

---

## 6. Checklist de Implementación

### Componentes Nuevos
- [ ] Crear `KBCompletenessIndicator.tsx`
- [ ] Crear `PromptPreview.tsx`

### API
- [ ] Crear `/api/ai-config/preview-prompt/route.ts`

### Integración
- [ ] Agregar KBCompletenessIndicator a KnowledgeBase
- [ ] Agregar PromptPreview a KnowledgeBase
- [ ] Importar componentes necesarios

### Verificación
- [ ] Indicador de completitud calcula correctamente
- [ ] Checklist muestra items correctos
- [ ] Tip se actualiza según lo faltante
- [ ] Preview carga para cada perfil
- [ ] Copiar al portapapeles funciona
- [ ] Tokens estimados se muestran
- [ ] Fecha de última actualización correcta

---

## 7. Notas

1. **Pesos de completitud**:
   - Esenciales: 50% del total
   - Recomendados: 35% del total
   - Opcionales: 15% del total

2. **Preview es read-only** - no permite editar el prompt directamente

3. **Tokens son estimados** - usando aproximación de 4 caracteres por token

4. **Si no hay prompt generado**, se genera uno temporal solo para preview
