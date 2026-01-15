# FASE 6: Optimización de Prompts - Agente de Mensajes

## Objetivo
Mejorar los prompts del Agente de Mensajes usando Gemini 3.0 Flash para una mejor organización y respuestas más precisas.

---

## 1. Estado Actual

### Archivos Existentes

| Archivo | Descripción |
|---------|-------------|
| `src/features/ai/services/prompt-generator.service.ts` | Servicio principal de generación |
| `src/shared/config/response-style-instructions.ts` | Instrucciones por estilo |
| `src/shared/config/assistant-type-instructions.ts` | Instrucciones por tipo de asistente |
| `src/shared/config/prompt-instruction-compiler.ts` | Compilador de instrucciones |

### Flujo Actual

```
1. Usuario guarda configuración
   ↓
2. collectBusinessContext() - Obtiene datos del tenant
   ↓
3. buildMetaPrompt() - Construye prompt base
   ↓
4. getFullCompiledInstructions() - Agrega instrucciones de estilo/tipo
   ↓
5. generatePromptWithAI() - Gemini optimiza el prompt
   ↓
6. Guarda en agent_profiles.generated_system_prompt
```

---

## 2. Mejoras Propuestas

### 2.1 Estructura de Prompt Mejorada

```markdown
# IDENTIDAD Y ROL

Eres {assistant_name}, el asistente virtual de {business_name}.
Tu rol principal es {primary_mission}.

# INFORMACIÓN DEL NEGOCIO

## Datos Generales
- Nombre: {business_name}
- Tipo: {vertical}
- Horario general: {operating_hours_summary}

## Servicios ({services_count} disponibles)
{services_formatted}

## Ubicaciones ({branches_count} sucursales)
{branches_formatted}

## Equipo ({staff_count} especialistas)
{staff_formatted}

# INSTRUCCIONES DE COMUNICACIÓN

## Estilo de Respuesta
{response_style_instructions}

## Manejo de Situaciones
{situation_handling_instructions}

# BASE DE CONOCIMIENTO

## Instrucciones Personalizadas
{custom_instructions}

## Políticas del Negocio
{business_policies}

## Información Adicional
{knowledge_articles}

## Plantillas de Respuesta
{response_templates}

## Manejo de Competencia
{competitor_handling}

# REGLAS DE CLASIFICACIÓN

## Prioridad de Leads
{lead_scoring_rules}

## Triggers de Escalamiento
{escalation_triggers}

# RESTRICCIONES

{restrictions}

# FORMATO DE RESPUESTA

{response_format_instructions}
```

### 2.2 Meta-Prompt para Gemini

El meta-prompt que se envía a Gemini para optimizar:

```typescript
const META_PROMPT_TEMPLATE = `
Eres un experto en diseño de prompts para asistentes de IA de atención al cliente.

Tu tarea es optimizar el siguiente prompt para un asistente de {vertical} en {country}.

CONTEXTO DEL NEGOCIO:
{business_context}

INSTRUCCIONES DE ESTILO:
{style_instructions}

TIPO DE ASISTENTE:
{assistant_type_instructions}

BASE DE CONOCIMIENTO:
{knowledge_base_data}

---

REQUISITOS DEL PROMPT OPTIMIZADO:

1. ESTRUCTURA CLARA
   - Usar encabezados markdown para organizar secciones
   - Priorizar información más usada primero
   - Mantener longitud óptima (1,500-2,500 tokens)

2. INSTRUCCIONES PRECISAS
   - Ser específico sobre el tono ({response_style})
   - Incluir ejemplos de respuestas ideales
   - Definir límites claros de lo que puede/no puede hacer

3. INFORMACIÓN ACCESIBLE
   - Formatear precios de forma consistente
   - Incluir horarios en formato legible
   - Agrupar servicios por categoría

4. MANEJO DE EDGE CASES
   - Qué hacer si no sabe algo
   - Cómo manejar quejas
   - Cuándo escalar a humano

5. PERSONALIZACIÓN
   - Usar nombre del negocio naturalmente
   - Adaptar terminología al vertical ({vertical})
   - Mantener consistencia con la marca

---

Genera el prompt optimizado en español mexicano.
El prompt debe ser directo y usable, no una plantilla con placeholders.
`;
```

### 2.3 Instrucciones por Vertical

```typescript
// vertical-specific-instructions.ts

export const VERTICAL_INSTRUCTIONS = {
  dental: {
    terminology: {
      appointment: 'cita',
      specialist: 'doctor',
      service: 'tratamiento',
      location: 'consultorio',
    },
    commonQuestions: [
      'precios de tratamientos',
      'disponibilidad de doctores',
      'horarios de atención',
      'métodos de pago',
      'ubicación y estacionamiento',
    ],
    restrictions: [
      'No dar diagnósticos médicos',
      'No recomendar tratamientos específicos sin valoración',
      'No prometer resultados específicos',
      'No dar tiempos exactos de tratamiento sin evaluación',
    ],
    upselling: [
      'Mencionar garantías en implantes',
      'Sugerir limpieza preventiva',
      'Promocionar planes de mantenimiento',
    ],
  },

  restaurant: {
    terminology: {
      appointment: 'reservación',
      specialist: 'chef',
      service: 'experiencia',
      location: 'sucursal',
    },
    commonQuestions: [
      'disponibilidad de mesas',
      'menú y precios',
      'eventos privados',
      'estacionamiento',
      'opciones vegetarianas/veganas',
    ],
    restrictions: [
      'No garantizar mesa sin reservación',
      'No modificar precios del menú',
      'No hacer excepciones de políticas de cancelación',
    ],
    upselling: [
      'Sugerir maridaje de vinos',
      'Promocionar menú de temporada',
      'Ofrecer espacios para eventos',
    ],
  },

  // ... otros verticales
};
```

---

## 3. Optimización del Compilador

### 3.1 Nuevo formato de instrucciones compiladas

```typescript
// prompt-instruction-compiler.ts - Mejorado

export interface CompiledInstructions {
  // Secciones principales
  identity: string;
  capabilities: string;
  restrictions: string;
  communicationStyle: string;
  situationHandling: string;

  // Formato
  responseFormat: string;

  // Metadata
  tokensEstimate: number;
  compiledAt: Date;
}

export function compileInstructionsV2(
  styleKey: ResponseStyleKey,
  typeKey: AssistantTypeKey,
  channel: ChannelContext,
  vertical: VerticalType
): CompiledInstructions {
  const styleInstructions = RESPONSE_STYLE_INSTRUCTIONS[styleKey];
  const typeInstructions = ASSISTANT_TYPE_INSTRUCTIONS[typeKey];
  const verticalInstructions = VERTICAL_INSTRUCTIONS[vertical];

  // Construir sección de identidad
  const identity = buildIdentitySection(styleInstructions, typeInstructions);

  // Construir capacidades
  const capabilities = buildCapabilitiesSection(typeInstructions, verticalInstructions);

  // Construir restricciones
  const restrictions = buildRestrictionsSection(typeInstructions, verticalInstructions);

  // Construir estilo de comunicación
  const communicationStyle = buildCommunicationStyleSection(
    styleInstructions,
    channel
  );

  // Construir manejo de situaciones
  const situationHandling = buildSituationHandlingSection(
    styleInstructions,
    typeInstructions
  );

  // Construir formato de respuesta
  const responseFormat = buildResponseFormatSection(channel, styleKey);

  // Calcular tokens estimados
  const fullText = [
    identity,
    capabilities,
    restrictions,
    communicationStyle,
    situationHandling,
    responseFormat
  ].join('\n\n');

  const tokensEstimate = Math.ceil(fullText.length / 4);

  return {
    identity,
    capabilities,
    restrictions,
    communicationStyle,
    situationHandling,
    responseFormat,
    tokensEstimate,
    compiledAt: new Date(),
  };
}

function buildIdentitySection(
  style: ResponseStyleInstructions,
  type: AssistantTypeInstructions
): string {
  const lines = [
    '# IDENTIDAD Y ROL',
    '',
    '## Quién Eres',
    ...type.core.primaryMission.map(m => `- ${m}`),
    '',
    '## Tu Personalidad',
    ...style.core.emotionalTone.map(t => `- ${t}`),
  ];

  return lines.join('\n');
}

function buildCapabilitiesSection(
  type: AssistantTypeInstructions,
  vertical: VerticalInstructions
): string {
  const lines = [
    '# CAPACIDADES',
    '',
    '## Qué PUEDES hacer',
    ...type.capabilities.canProvide.map(c => `- ${c}`),
    '',
    '## Qué NO PUEDES hacer',
    ...type.capabilities.cannotProvide.map(c => `- ${c}`),
    ...vertical.restrictions.map(r => `- ${r}`),
  ];

  return lines.join('\n');
}

function buildCommunicationStyleSection(
  style: ResponseStyleInstructions,
  channel: ChannelContext
): string {
  const channelInstructions = channel === 'voice'
    ? style.voice
    : style.messaging;

  const lines = [
    '# ESTILO DE COMUNICACIÓN',
    '',
    '## Tratamiento',
    ...style.core.treatment.map(t => `- ${t}`),
    '',
    '## Estructura de Mensajes',
    ...style.core.sentenceStructure.map(s => `- ${s}`),
    '',
    '## Formato Específico',
    ...(channel === 'voice'
      ? [
          ...channelInstructions.fillerPhrases.map(f => `- Muletilla: "${f}"`),
          ...channelInstructions.pacing.map(p => `- ${p}`),
        ]
      : [
          ...channelInstructions.formatting.map(f => `- ${f}`),
          ...channelInstructions.emojiUsage.map(e => `- ${e}`),
        ]
    ),
  ];

  return lines.join('\n');
}

function buildSituationHandlingSection(
  style: ResponseStyleInstructions,
  type: AssistantTypeInstructions
): string {
  const lines = [
    '# MANEJO DE SITUACIONES',
    '',
    '## Objeciones',
    ...style.situations.objectionHandling.map(o => `- ${o}`),
    '',
    '## Errores',
    ...style.situations.errorMessages.map(e => `- ${e}`),
    '',
    '## Escalamiento',
    ...style.situations.escalation.map(e => `- ${e}`),
    '',
    '## Despedida',
    ...style.situations.closingConversation.map(c => `- ${c}`),
  ];

  return lines.join('\n');
}

function buildResponseFormatSection(
  channel: ChannelContext,
  style: ResponseStyleKey
): string {
  const lines = [
    '# FORMATO DE RESPUESTA',
    '',
  ];

  if (channel === 'messaging') {
    lines.push(
      '## Mensajería',
      '- Respuestas de 1-3 párrafos cortos',
      '- Usar saltos de línea para legibilidad',
      '- Bullet points para listas (máximo 5 items)',
      style === 'casual' ? '- Emojis permitidos: 1-2 por mensaje' : '- Emojis: solo funcionales (✅, 📍, 📅)',
      '- Links: formato corto cuando sea posible',
    );
  } else {
    lines.push(
      '## Voz',
      '- Respuestas de 2-3 oraciones',
      '- Pausas naturales entre ideas',
      '- Confirmar información importante',
      '- Deletrear datos críticos (emails, códigos)',
    );
  }

  return lines.join('\n');
}
```

---

## 4. Mejoras en buildMetaPrompt

```typescript
// prompt-generator.service.ts - buildMetaPrompt mejorado

buildMetaPrompt(context: PromptContext): string {
  const {
    businessName,
    vertical,
    services,
    branches,
    staff,
    customInstructions,
    businessPolicies,
    knowledgeArticles,
    responseTemplates,
    competitorHandling,
    scoringRules,
    assistantPersonality,
    templateKey,
    channel,
  } = context;

  // Formatear servicios por categoría
  const servicesFormatted = this.formatServicesByCategory(services);

  // Formatear sucursales con horarios
  const branchesFormatted = this.formatBranchesWithHours(branches);

  // Formatear staff por sucursal
  const staffFormatted = this.formatStaffByBranch(staff, branches);

  // Agrupar instrucciones por tipo
  const instructionsGrouped = this.groupInstructionsByType(customInstructions);

  // Agrupar políticas por tipo
  const policiesGrouped = this.groupPoliciesByType(businessPolicies);

  // Obtener instrucciones compiladas
  const compiledInstructions = getFullCompiledInstructions(
    assistantPersonality as ResponseStyleKey,
    this.mapTemplateToType(templateKey),
    channel
  );

  // Construir prompt estructurado
  return `
${compiledInstructions.identity}

# INFORMACIÓN DEL NEGOCIO: ${businessName}

## Servicios Disponibles (${services.length})
${servicesFormatted}

## Ubicaciones (${branches.length} sucursales)
${branchesFormatted}

## Equipo
${staffFormatted}

${compiledInstructions.capabilities}

${compiledInstructions.communicationStyle}

# BASE DE CONOCIMIENTO

## Instrucciones Personalizadas
${instructionsGrouped}

## Políticas del Negocio
${policiesGrouped}

## Información Adicional
${this.formatArticles(knowledgeArticles)}

## Plantillas de Respuesta
${this.formatTemplates(responseTemplates)}

## Manejo de Competencia
${this.formatCompetitors(competitorHandling)}

${compiledInstructions.situationHandling}

# CLASIFICACIÓN DE LEADS
${this.formatScoringRules(scoringRules, services)}

${compiledInstructions.restrictions}

${compiledInstructions.responseFormat}
`;
}

// Helpers mejorados
formatServicesByCategory(services: Service[]): string {
  const byCategory = services.reduce((acc, s) => {
    const cat = s.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, Service[]>);

  return Object.entries(byCategory)
    .map(([category, categoryServices]) => {
      const servicesText = categoryServices
        .map(s => {
          const price = s.price_min && s.price_max
            ? `$${s.price_min.toLocaleString()}-$${s.price_max.toLocaleString()}`
            : s.price_min
            ? `Desde $${s.price_min.toLocaleString()}`
            : 'Consultar';
          const duration = s.duration_minutes ? ` | ${s.duration_minutes} min` : '';
          const priority = s.lead_priority === 'hot' ? ' 🔥' : '';
          return `  - ${s.name}: ${price}${duration}${priority}`;
        })
        .join('\n');

      return `### ${category}\n${servicesText}`;
    })
    .join('\n\n');
}

formatBranchesWithHours(branches: Branch[]): string {
  return branches
    .map(b => {
      const hq = b.is_headquarters ? ' (Matriz)' : '';
      const hours = this.summarizeOperatingHours(b.operating_hours);
      const location = b.google_maps_url
        ? `📍 [Ver en mapa](${b.google_maps_url})`
        : `📍 ${b.address}`;

      return `### ${b.name}${hq}
- ${location}
- 📞 ${b.phone}${b.whatsapp_number ? ` | WhatsApp: ${b.whatsapp_number}` : ''}
- ⏰ ${hours}`;
    })
    .join('\n\n');
}

groupInstructionsByType(instructions: CustomInstruction[]): string {
  const byType = instructions.reduce((acc, i) => {
    if (!acc[i.instruction_type]) acc[i.instruction_type] = [];
    acc[i.instruction_type].push(i);
    return acc;
  }, {} as Record<string, CustomInstruction[]>);

  const typeLabels: Record<string, string> = {
    identity: '### Identidad',
    greeting: '### Saludos',
    communication_style: '### Estilo de Comunicación',
    restrictions: '### Restricciones',
    upselling: '### Ventas y Promoción',
    appointment_handling: '### Manejo de Citas',
    emergency_handling: '### Emergencias',
    custom: '### Otras Instrucciones',
  };

  return Object.entries(byType)
    .map(([type, typeInstructions]) => {
      const label = typeLabels[type] || `### ${type}`;
      const content = typeInstructions
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .map(i => {
          const examples = i.examples?.length
            ? `\n  Ejemplos: ${i.examples.join(', ')}`
            : '';
          return `- **${i.title}**: ${i.instruction}${examples}`;
        })
        .join('\n');

      return `${label}\n${content}`;
    })
    .join('\n\n');
}
```

---

## 5. Checklist de Implementación

### Archivos a Modificar
- [ ] `prompt-generator.service.ts` - buildMetaPrompt mejorado
- [ ] `prompt-instruction-compiler.ts` - compileInstructionsV2
- [ ] Nuevo: `vertical-specific-instructions.ts`

### Mejoras de Formato
- [ ] Servicios agrupados por categoría
- [ ] Sucursales con horarios resumidos
- [ ] Staff por sucursal
- [ ] Instrucciones por tipo
- [ ] Políticas agrupadas

### Meta-Prompt para Gemini
- [ ] Template mejorado para optimización
- [ ] Instrucciones específicas por vertical
- [ ] Ejemplos de respuestas ideales

### Verificación
- [ ] Prompts generados son más organizados
- [ ] Información prioritaria primero
- [ ] Tokens optimizados (~1,500-2,500)
- [ ] Formato consistente
- [ ] Preview muestra prompt mejorado

---

## 6. Notas Importantes

1. **Mantener compatibilidad** con prompts existentes durante migración
2. **Longitud óptima**: 1,500-2,500 tokens para balance calidad/costo
3. **Priorizar información más usada**: precios, horarios, ubicaciones
4. **Instrucciones específicas por vertical** mejoran relevancia
5. **Gemini 3.0 Flash** es el modelo recomendado para optimización
