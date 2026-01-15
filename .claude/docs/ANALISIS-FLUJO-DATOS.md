# Análisis de Flujo de Datos - Base de Conocimiento → Agentes IA

## 1. Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CAPA DE UI                                      │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │  AIConfiguration │  │  KnowledgeBase   │  │ ServicePriority  │           │
│  │  (Identidad,     │  │  (Instrucciones, │  │ Config           │           │
│  │   Sucursales,    │  │   Políticas,     │  │ (HOT/WARM/COLD)  │           │
│  │   Staff)         │  │   Artículos,     │  │                  │           │
│  │                  │  │   Plantillas)    │  │                  │           │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘           │
│           │                     │                     │                      │
└───────────┼─────────────────────┼─────────────────────┼──────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAPA DE API                                       │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ /api/settings/   │  │ /api/knowledge-  │  │ /api/services    │           │
│  │ branches         │  │ base             │  │                  │           │
│  │ /api/settings/   │  │                  │  │                  │           │
│  │ staff            │  │                  │  │                  │           │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘           │
│           │                     │                     │                      │
└───────────┼─────────────────────┼─────────────────────┼──────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE DATABASE                                   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   tenants    │  │   branches   │  │    staff     │  │   services   │     │
│  │              │  │              │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ ai_custom_   │  │ ai_business_ │  │ ai_knowledge_│  │ ai_response_ │     │
│  │ instructions │  │ policies     │  │ articles     │  │ templates    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │ ai_competitor│  │ ai_tenant_   │  ← generated_system_prompt stored here  │
│  │ _handling    │  │ config       │                                         │
│  └──────────────┘  └──────────────┘                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ RPC: get_tenant_ai_context()
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAPA DE GENERACIÓN DE PROMPTS                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                  prompt-generator.service.ts                        │     │
│  │                                                                     │     │
│  │  1. collectBusinessContext(tenantId)                               │     │
│  │     └─→ Llama RPC get_tenant_ai_context()                          │     │
│  │     └─→ Retorna: tenant, services, branches, staff, KB data        │     │
│  │                                                                     │     │
│  │  2. buildMetaPrompt(context)                                       │     │
│  │     └─→ Construye prompt estructurado con:                         │     │
│  │         • Identidad del negocio                                    │     │
│  │         • Servicios y precios                                      │     │
│  │         • Sucursales y horarios                                    │     │
│  │         • Staff/Doctores                                           │     │
│  │         • Instrucciones personalizadas                             │     │
│  │         • Políticas de negocio                                     │     │
│  │         • Artículos de conocimiento                                │     │
│  │         • Plantillas de respuesta                                  │     │
│  │         • Manejo de competidores                                   │     │
│  │         • Reglas de scoring de leads                               │     │
│  │                                                                     │     │
│  │  3. getFullCompiledInstructions(style, type, channel)              │     │
│  │     └─→ Instrucciones compiladas por:                              │     │
│  │         • Estilo: professional, professional_friendly, casual      │     │
│  │         • Tipo: full_assistant, appointments_only, personal_brand  │     │
│  │         • Canal: voice, messaging                                  │     │
│  │                                                                     │     │
│  │  4. generatePromptWithAI(context)                                  │     │
│  │     └─→ Gemini 3.0 Flash procesa y optimiza                        │     │
│  │     └─→ Guarda en ai_tenant_config.generated_system_prompt         │     │
│  │                                                                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Prompt generado
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE AGENTES IA                                   │
│                                                                              │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │
│  │    AGENTE DE MENSAJES       │    │     AGENTE DE VOZ           │         │
│  │    (LangGraph)              │    │     (LangGraph + VAPI)      │         │
│  │                             │    │                             │         │
│  │  Canales:                   │    │  Canales:                   │         │
│  │  • WhatsApp                 │    │  • Teléfono LADA mexicana   │         │
│  │  • Instagram                │    │                             │         │
│  │  • Messenger                │    │  Características:           │         │
│  │  • Telegram                 │    │  • Voz natural (ElevenLabs) │         │
│  │  • Web Chat                 │    │  • Transcripción            │         │
│  │                             │    │  • Análisis de llamadas     │         │
│  │  Perfiles:                  │    │                             │         │
│  │  • business (negocio)       │    │  Prompt:                    │         │
│  │  • personal (marca propia)  │    │  • system_prompt específico │         │
│  │                             │    │  • Optimizado para voz      │         │
│  └─────────────────────────────┘    └─────────────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE FINAL                                      │
│                                                                              │
│  • Recibe respuestas personalizadas según el negocio                        │
│  • Información precisa de precios, horarios, ubicaciones                    │
│  • Respuestas en el estilo configurado (formal, casual, etc.)               │
│  • Manejo adecuado de competidores                                          │
│  • Clasificación automática como lead (HOT/WARM/COLD)                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detalle del RPC get_tenant_ai_context()

### 2.1 Datos Retornados

```json
{
  "tenant": {
    "id": "uuid",
    "name": "Clínica Dental Sonrisa",
    "vertical": "dental",
    "primary_contact_email": "contacto@sonrisa.com",
    "primary_contact_phone": "+52 55 1234 5678"
  },

  "ai_config": {
    "ai_enabled": true,
    "ai_personality": "professional_friendly",
    "ai_temperature": 0.7,
    "max_tokens": 500,
    "escalation_keywords": ["queja", "gerente"],
    "max_turns_before_escalation": 10
  },

  "services": [
    {
      "id": "uuid",
      "name": "Implante Dental",
      "category": "Implantología",
      "price_min": 15000,
      "price_max": 25000,
      "duration_minutes": 120,
      "lead_priority": "hot",
      "ai_description": "Implante de titanio con corona...",
      "special_instructions": "Siempre mencionar garantía de 10 años"
    }
  ],

  "branches": [
    {
      "id": "uuid",
      "name": "Polanco",
      "city": "CDMX",
      "address": "Av. Presidente Masaryk 123",
      "operating_hours": {
        "monday": { "open": "09:00", "close": "19:00", "enabled": true }
      },
      "is_headquarters": true,
      "latitude": 19.4326,
      "longitude": -99.1332
    }
  ],

  "doctors": [
    {
      "id": "uuid",
      "first_name": "Juan",
      "last_name": "Pérez",
      "display_name": "Dr. Juan Pérez",
      "specialty": "Implantología",
      "license_number": "12345678"
    }
  ],

  "custom_instructions": [
    {
      "instruction_type": "identity",
      "title": "Identidad del Asistente",
      "instruction": "Soy Ana, asistente virtual de Clínica Dental Sonrisa",
      "examples": ["Hola, soy Ana, ¿en qué puedo ayudarte?"],
      "priority": 100
    }
  ],

  "business_policies": [
    {
      "policy_type": "cancellation",
      "title": "Política de Cancelación",
      "policy_text": "Las citas pueden cancelarse con 24 horas de anticipación...",
      "short_version": "Cancelar con 24 hrs de anticipación"
    }
  ],

  "knowledge_articles": [
    {
      "category": "Tratamientos",
      "title": "¿Qué es un implante dental?",
      "content": "Un implante dental es una raíz artificial...",
      "summary": "Raíz artificial de titanio que reemplaza un diente perdido",
      "keywords": ["implante", "titanio", "diente perdido"]
    }
  ],

  "response_templates": [
    {
      "trigger_type": "greeting",
      "name": "Saludo inicial",
      "template_text": "¡Hola {nombre}! Soy Ana de Clínica Dental Sonrisa...",
      "variables_available": ["{nombre}", "{hora_del_dia}"]
    }
  ],

  "competitor_handling": [
    {
      "competitor_name": "Dental Fix",
      "competitor_aliases": ["DentalFix", "Dental-Fix"],
      "response_strategy": "Destacar nuestra garantía y experiencia",
      "talking_points": ["15 años de experiencia", "Garantía de 10 años"],
      "avoid_saying": ["No mencionar precios de competencia"]
    }
  ],

  "scoring_rules": {
    "hot_services": ["implante", "ortodoncia"],
    "emergency_keywords": ["dolor", "urgente"],
    "hot_threshold": 70,
    "warm_threshold": 40
  }
}
```

---

## 3. Proceso de Construcción del Meta-Prompt

### 3.1 buildMetaPrompt() - Estructura

```typescript
function buildMetaPrompt(context: PromptContext): string {
  return `
# CONTEXTO DEL NEGOCIO

## Información General
- Nombre: ${context.businessName}
- Vertical: ${context.vertical}
- Idioma: ${context.language}

## Servicios Disponibles
${context.services.map(s => `
- ${s.name}
  - Precio: $${s.price_min} - $${s.price_max} MXN
  - Duración: ${s.duration_minutes} minutos
  - Prioridad de lead: ${s.lead_priority}
  ${s.ai_description ? `- Descripción AI: ${s.ai_description}` : ''}
  ${s.special_instructions ? `- Instrucciones: ${s.special_instructions}` : ''}
`).join('\n')}

## Sucursales
${context.branches.map(b => `
### ${b.name} ${b.is_headquarters ? '(Matriz)' : ''}
- Dirección: ${b.address}, ${b.city}
- Teléfono: ${b.phone}
- WhatsApp: ${b.whatsapp_number}
- Horarios: ${formatOperatingHours(b.operating_hours)}
${b.latitude && b.longitude ? `- Ubicación GPS: ${b.latitude}, ${b.longitude}` : ''}
`).join('\n')}

## Personal / Especialistas
${context.doctors.map(d => `
- ${d.display_name || `${d.first_name} ${d.last_name}`}
  - Especialidad: ${d.specialty}
  ${d.license_number ? `- Cédula: ${d.license_number}` : ''}
`).join('\n')}

# INSTRUCCIONES PERSONALIZADAS
${context.customInstructions.map(i => `
## ${i.title} (${i.instruction_type})
${i.instruction}
${i.examples?.length ? `Ejemplos: ${i.examples.join(', ')}` : ''}
`).join('\n')}

# POLÍTICAS DE NEGOCIO
${context.businessPolicies.map(p => `
## ${p.title} (${p.policy_type})
${p.policy_text}
${p.short_version ? `Versión corta: ${p.short_version}` : ''}
`).join('\n')}

# BASE DE CONOCIMIENTO
${context.knowledgeArticles.map(a => `
## ${a.title} (${a.category})
${a.content}
${a.summary ? `Resumen: ${a.summary}` : ''}
`).join('\n')}

# PLANTILLAS DE RESPUESTA
${context.responseTemplates.map(t => `
## ${t.name} (${t.trigger_type})
${t.template_text}
Variables: ${t.variables_available?.join(', ')}
`).join('\n')}

# MANEJO DE COMPETENCIA
${context.competitorHandling.map(c => `
## ${c.competitor_name}
- Estrategia: ${c.response_strategy}
- Puntos a destacar: ${c.talking_points?.join(', ')}
- Evitar decir: ${c.avoid_saying?.join(', ')}
`).join('\n')}

# REGLAS DE SCORING
- Servicios HOT: ${context.scoringRules?.hot_services?.join(', ')}
- Keywords de emergencia: ${context.scoringRules?.emergency_keywords?.join(', ')}
`;
}
```

### 3.2 Instrucciones Compiladas por Perfil

```typescript
// response-style-instructions.ts
const PROFESSIONAL_FRIENDLY_STYLE = {
  core: {
    treatment: [
      "Flexible entre 'tú' y 'usted' según el cliente",
      "Si el cliente usa 'tú', responder con 'tú'",
      "Diminutivos ocasionales aceptables: 'un momentito'"
    ],
    sentenceStructure: [
      "Cortesía integrada: 'Con gusto le informo que...'",
      "Preguntas amables: '¿Le gustaría...?'"
    ],
    emotionalTone: [
      "Cálido pero profesional",
      "Empatía natural: 'Entiendo perfectamente'",
      "Exclamaciones moderadas: '¡Claro!'"
    ]
  },
  voice: {
    fillerPhrases: ["Claro...", "Mmm, déjame ver...", "Por supuesto..."],
    pacing: ["Respuestas de 2-3 oraciones", "Tono conversacional"]
  },
  messaging: {
    formatting: ["Párrafos cortos", "Bullet points para listas"],
    emojiUsage: ["Solo funcionales: ✅, 📍, 📅", "Nunca más de 2 por mensaje"]
  }
};

// assistant-type-instructions.ts
const FULL_ASSISTANT_TYPE = {
  core: {
    primaryMission: [
      "Agendar citas con el equipo del negocio",
      "Proporcionar información de servicios y precios",
      "Capturar información de leads interesados"
    ],
    canProvide: [
      "Precios de servicios (exactos si los tienes)",
      "Disponibilidad de horarios",
      "Información de ubicaciones"
    ],
    cannotProvide: [
      "Diagnósticos médicos o dentales",
      "Recomendaciones de tratamiento sin valoración"
    ]
  },
  salesBehavior: {
    approach: ["Upselling proactivo permitido", "Mencionar promociones activas"],
    limitations: ["No presionar excesivamente", "Respetar 'no' del cliente"]
  }
};
```

---

## 4. Flujo de Regeneración de Prompt

### 4.1 Triggers de Regeneración

| Evento | Acción |
|--------|--------|
| Cambio en ai_config | Regenerar prompt |
| Nuevo servicio agregado | Regenerar prompt |
| Nueva sucursal | Regenerar prompt |
| Cambio en instrucciones KB | Regenerar prompt |
| Cambio de perfil de agente | Regenerar prompt |

### 4.2 API de Regeneración

```typescript
// POST /api/ai-config/regenerate
async function regeneratePrompt(tenantId: string, profileType: 'business' | 'personal') {
  // 1. Obtener contexto actualizado
  const context = await collectBusinessContext(tenantId);

  // 2. Obtener perfil
  const profile = await getAgentProfile(tenantId, profileType);

  // 3. Construir meta-prompt
  const metaPrompt = buildMetaPrompt({
    ...context,
    profile,
    channel: 'messaging'
  });

  // 4. Generar con Gemini
  const optimizedPrompt = await generatePromptWithAI(metaPrompt);

  // 5. Guardar en DB
  await saveGeneratedPrompt(tenantId, profileType, optimizedPrompt);

  // 6. Invalidar caché
  await invalidatePromptCache(tenantId, profileType);

  return optimizedPrompt;
}
```

---

## 5. Diferencias entre Canales

### 5.1 Mensajería vs Voz

| Aspecto | Mensajería | Voz |
|---------|------------|-----|
| **Formato** | Texto con markdown | Speech natural |
| **Emojis** | Permitidos (limitados) | N/A |
| **Longitud** | Variable, puede ser larga | Corta, concisa |
| **Muletillas** | No aplica | Sí: "Claro...", "Mmm..." |
| **Pausas** | Saltos de línea | Pausas de habla |
| **Confirmaciones** | "✅ Listo" | "Perfecto, ya quedó" |

### 5.2 Prompts Específicos

```typescript
// Mensajería
const messagingInstructions = `
- Usa formato markdown cuando sea útil
- Emojis funcionales: ✅ ❌ 📍 📅 ⏰
- Respuestas pueden tener múltiples párrafos
- Incluir botones de acción cuando sea posible
`;

// Voz
const voiceInstructions = `
- Respuestas cortas y directas (2-3 oraciones)
- Usa muletillas naturales: "Claro...", "Mmm..."
- Deletrear información importante lentamente
- Confirmar datos críticos: "Entonces, su cita es el..."
`;
```

---

## 6. Sistema de Caché

### 6.1 Estrategia de Caché

```typescript
// Caché de prompts generados
const promptCache = new Map<string, {
  prompt: string;
  generatedAt: Date;
  expiresAt: Date;
}>();

// Key format: `${tenantId}:${profileType}:${channel}`
// Ejemplo: "uuid-123:business:messaging"

// TTL: 24 horas o hasta invalidación manual
const PROMPT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
```

### 6.2 Invalidación

```typescript
async function invalidatePromptCache(tenantId: string, profileType?: string) {
  if (profileType) {
    // Invalidar solo ese perfil
    promptCache.delete(`${tenantId}:${profileType}:messaging`);
    promptCache.delete(`${tenantId}:${profileType}:voice`);
  } else {
    // Invalidar todos los prompts del tenant
    for (const key of promptCache.keys()) {
      if (key.startsWith(tenantId)) {
        promptCache.delete(key);
      }
    }
  }
}
```

---

## 7. Resumen del Flujo

1. **Usuario edita KB** → API guarda en Supabase
2. **Trigger de regeneración** → API llama a prompt-generator
3. **collectBusinessContext()** → RPC obtiene TODO el contexto
4. **buildMetaPrompt()** → Construye prompt estructurado
5. **getFullCompiledInstructions()** → Agrega instrucciones de estilo
6. **generatePromptWithAI()** → Gemini optimiza
7. **Guardar en DB** → ai_tenant_config.generated_system_prompt
8. **LangGraph usa prompt** → Agente responde con contexto completo
