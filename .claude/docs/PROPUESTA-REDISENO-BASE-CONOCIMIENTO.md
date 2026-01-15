# Propuesta de Rediseño: Base de Conocimiento TIS TIS

## Resumen Ejecutivo

Este documento presenta una propuesta exhaustiva para rediseñar la página de **Base de Conocimiento** dentro del sistema TIS TIS, alineándola con la arquitectura interna Tool Calling + RAG implementada en v5.0.0 y optimizándola con estándares de diseño premium inspirados en Apple, Google y Lovable.

---

## Análisis de la Arquitectura Interna

### 1. Flujo de Datos: Cómo el Sistema Usa la Base de Conocimiento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO DE LA INFORMACIÓN                     │
└─────────────────────────────────────────────────────────────────────────┘

USUARIO CONFIGURA KB (Frontend)
        │
        ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│   INSTRUCCIONES   │     │    POLÍTICAS      │     │    ARTÍCULOS      │
│   Personalizadas  │     │    del Negocio    │     │  de Conocimiento  │
│                   │     │                   │     │                   │
│ • identity        │     │ • cancellation    │     │ • about_us        │
│ • greeting        │     │ • payment         │     │ • certifications  │
│ • pricing_policy  │     │ • warranty        │     │ • process         │
│ • competitors     │     │ • insurance       │     │ • aftercare       │
│ • objections      │     │ • refunds         │     │ • technology      │
│ • upsell          │     │ • emergency       │     │ • testimonials    │
│ • tone_examples   │     │ ...               │     │ ...               │
│ • forbidden       │     │                   │     │                   │
│ • always_mention  │     │                   │     │                   │
└─────────┬─────────┘     └─────────┬─────────┘     └─────────┬─────────┘
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE DATABASE                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ai_custom_        │  │ai_business_      │  │ai_knowledge_         │  │
│  │instructions      │  │policies          │  │articles              │  │
│  │                  │  │                  │  │                      │  │
│  │+ embedding       │  │+ embedding       │  │+ embedding           │  │
│  │  vector(1536)    │  │  vector(1536)    │  │  vector(1536)        │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ai_response_      │  │ai_competitor_    │  │faqs                  │  │
│  │templates         │  │handling          │  │                      │  │
│  │                  │  │                  │  │+ embedding           │  │
│  │{variables}       │  │• talking_points  │  │  vector(1536)        │  │
│  │disponibles       │  │• avoid_saying    │  │                      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │
          │ Cuando se guarda contenido...
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EMBEDDING SERVICE (OpenAI)                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  text-embedding-3-small (1536 dimensiones)                     │    │
│  │                                                                 │    │
│  │  Procesa:                                                       │    │
│  │  • Artículos de conocimiento → embedding                       │    │
│  │  • FAQs (pregunta + respuesta) → embedding                     │    │
│  │  • Políticas → embedding                                       │    │
│  │  • Servicios (ai_description) → embedding                      │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          │ Embeddings almacenados + índices IVFFlat
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                PROMPT GENERATOR SERVICE (Pre-caché)                     │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  generatePromptForTenant()                                      │    │
│  │                                                                 │    │
│  │  1. Recopila TODO el contexto del negocio                      │    │
│  │  2. Aplica template de instrucciones compiladas (48 combos)    │    │
│  │  3. Optimiza con Gemini/OpenAI                                 │    │
│  │  4. Valida con PromptValidator                                 │    │
│  │  5. Cachea en ai_generated_prompts                             │    │
│  │                                                                 │    │
│  │  Resultado: Prompt optimizado ~1,500 tokens (vs ~5,000 antes)  │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          │ Cuando llega un mensaje del usuario...
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH AI SERVICE (Runtime)                       │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  generateAIResponseWithGraph()                                  │    │
│  │                                                                 │    │
│  │  Carga en PARALELO:                                            │    │
│  │  • Prompt pre-cacheado (ai_generated_prompts)                  │    │
│  │  • Contexto del tenant (get_tenant_ai_context RPC)             │    │
│  │  • Contexto del lead + lealtad                                 │    │
│  │  • Contexto de AI Learning (patrones aprendidos)               │    │
│  │                                                                 │    │
│  │  Ejecuta GRAFO:                                                │    │
│  │  initialize → supervisor → vertical_router → AGENTE → finalize │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          │ Agente necesita información específica...
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TOOL CALLING (23 Tools)                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │  TOOLS DE CONSULTA:                                            │    │
│  │  ├─ get_service_info      → business_context.services          │    │
│  │  ├─ get_business_policy   → business_context.policies          │    │
│  │  ├─ get_faq_answer        → business_context.faqs              │    │
│  │  ├─ get_branch_info       → business_context.branches          │    │
│  │  ├─ get_staff_info        → business_context.staff             │    │
│  │  └─ search_knowledge_base → RAG SEMÁNTICO (ver abajo)          │    │
│  │                                                                 │    │
│  │  TOOLS DE ACCIÓN:                                              │    │
│  │  ├─ create_appointment    → Crea cita                          │    │
│  │  ├─ update_lead_info      → Actualiza datos del lead           │    │
│  │  ├─ create_order          → Crea pedido (restaurant)           │    │
│  │  └─ redeem_reward         → Canjea puntos de lealtad           │    │
│  │                                                                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          │ Tool: search_knowledge_base
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RAG: BÚSQUEDA SEMÁNTICA                              │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  search_knowledge_base_semantic() [PostgreSQL RPC]              │    │
│  │                                                                 │    │
│  │  1. Genera embedding de la consulta del usuario                │    │
│  │  2. Busca similitud coseno en 4 fuentes:                       │    │
│  │     • ai_knowledge_articles                                    │    │
│  │     • faqs                                                      │    │
│  │     • ai_business_policies                                      │    │
│  │     • services (ai_description)                                │    │
│  │  3. Filtra por umbral de similitud (default: 0.5)              │    │
│  │  4. Retorna TOP-N resultados ordenados por relevancia          │    │
│  │                                                                 │    │
│  │  Índices IVFFlat → Búsqueda aproximada eficiente               │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          │ Respuesta generada + Aprendizaje en background
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI LEARNING (Background)                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  MessageLearningService                                         │    │
│  │                                                                 │    │
│  │  Extrae de cada conversación:                                  │    │
│  │  • Patrones de servicio solicitados                            │    │
│  │  • Objeciones comunes                                          │    │
│  │  • Vocabulario específico del negocio                          │    │
│  │  • Preferencias de horarios                                    │    │
│  │  • Insights automáticos                                        │    │
│  │                                                                 │    │
│  │  Tablas:                                                        │    │
│  │  • ai_message_patterns                                         │    │
│  │  • ai_learned_vocabulary                                       │    │
│  │  • ai_business_insights                                        │    │
│  │                                                                 │    │
│  │  Este contexto ENRIQUECE el prompt del agente                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Relación entre Componentes

| Componente UI | Tabla Supabase | Uso en AI |
|---------------|----------------|-----------|
| Instrucciones | `ai_custom_instructions` | Se incluyen en el prompt pre-cacheado. Definen comportamiento. |
| Políticas | `ai_business_policies` | Tool `get_business_policy` + RAG semántico |
| Artículos (Información) | `ai_knowledge_articles` | RAG semántico principal para consultas complejas |
| Plantillas | `ai_response_templates` | Template resolution con variables dinámicas |
| Competencia | `ai_competitor_handling` | Estrategias específicas cuando detecta mención de competidor |
| FAQs | `faqs` | Tool `get_faq_answer` + RAG semántico |
| Servicios | `services` | Tool `get_service_info` + RAG en `ai_description` |

### 3. Sistema de Scoring Actual (KBCompletenessIndicator)

El sistema evalúa 5 categorías con pesos específicos:

| Categoría | Peso | Qué Evalúa |
|-----------|------|------------|
| **Core Data** | 30% | Sucursales, servicios, personal, horarios |
| **Personality** | 25% | Nombre del asistente, personalidad, instrucciones de comunicación |
| **Policies** | 20% | Políticas de cancelación, pagos, garantías |
| **Knowledge** | 15% | FAQs, artículos de conocimiento |
| **Advanced** | 10% | Competidores, plantillas, detector de conflictos |

---

## Problemas Identificados en el Diseño Actual

### A. Problemas de UX/Comprensión

1. **Desconexión visual con la arquitectura interna**
   - El usuario no entiende que las "Instrucciones" van directo al prompt
   - No se muestra visualmente que los "Artículos" alimentan búsqueda RAG
   - Los "Templates" parecen estáticos cuando en realidad tienen variables dinámicas

2. **Categorización confusa**
   - "Instrucciones" vs "Políticas" vs "Información" no es intuitivo
   - El usuario no sabe cuál usar para qué propósito
   - Falta guía contextual de qué tipo de contenido agregar

3. **Sin visualización del impacto**
   - No se muestra cómo cada item afecta las respuestas del AI
   - No hay preview de cómo el agente usará la información
   - El scoring no explica qué mejoraría las respuestas

### B. Problemas de Diseño Visual

1. **Cards genéricas sin jerarquía visual**
   - Todas las pestañas se ven igual
   - No hay diferenciación por importancia/impacto
   - Falta uso de los colores de marca TIS TIS

2. **Indicador de completitud básico**
   - El círculo de progreso no transmite premium
   - Las recomendaciones se ven como lista plana
   - No hay animaciones que comuniquen progreso

3. **Filtro de sucursal poco visible**
   - El selector de sucursal no destaca
   - No queda claro qué items son "globales" vs "por sucursal"

### C. Oportunidades de Mejora

1. **Guía inteligente basada en vertical**
   - Para dental: sugerir políticas específicas (garantías, emergencias)
   - Para restaurant: sugerir info de menú, delivery, promociones

2. **Integración visual con AI Learning**
   - Mostrar qué patrones ha aprendido el sistema
   - Sugerir contenido basado en preguntas frecuentes detectadas

3. **Preview en tiempo real**
   - Mostrar cómo quedaría una respuesta con el contenido actual
   - Simular búsqueda RAG para ver qué encontraría

---

## Propuesta de Rediseño

### Concepto: "Centro de Inteligencia del Asistente"

Renombrar "Base de Conocimiento" a **"Centro de Inteligencia"** o **"Cerebro del Asistente"** para transmitir mejor el propósito.

### Nueva Arquitectura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CENTRO DE INTELIGENCIA                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  HEADER PREMIUM                                                  │   │
│  │  ┌─────────────────┐  ┌────────────────────────────────────┐   │   │
│  │  │  Score Circular │  │  Resumen + Próximo Paso            │   │   │
│  │  │  (Apple-style)  │  │  "Completa políticas de cancelación │   │   │
│  │  │      85%        │  │   para mejorar tu score un 8%"     │   │   │
│  │  └─────────────────┘  └────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  [ Selector de Sucursal ]  [ Ver Prompt Generado ]              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  NAVEGACIÓN POR CATEGORÍAS (Tabs Premium)                       │   │
│  │                                                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │   │
│  │  │🧠 Mente  │ │📋 Reglas │ │📚 Saber  │ │💬 Hablar │ │🎯 Tácti│ │   │
│  │  │del       │ │del       │ │del       │ │del       │ │ca      │ │   │
│  │  │Asistente │ │Negocio   │ │Negocio   │ │Asistente │ │        │ │   │
│  │  │          │ │          │ │          │ │          │ │        │ │   │
│  │  │Instruc-  │ │Políticas │ │Artículos │ │Plantillas│ │Compe-  │ │   │
│  │  │ciones    │ │          │ │+ FAQs    │ │          │ │tidores │ │   │
│  │  │          │ │          │ │          │ │          │ │        │ │   │
│  │  │ 3/5 ✓   │ │ 1/3 ⚠   │ │ 8/15 ✓  │ │ 0/3 ✗   │ │ 0/2 ✗ │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CONTENIDO DE LA CATEGORÍA SELECCIONADA                         │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │  EXPLICACIÓN CONTEXTUAL (Apple-style)                       ││   │
│  │  │  "Las instrucciones definen la PERSONALIDAD de tu           ││   │
│  │  │   asistente. Se incluyen directamente en cada               ││   │
│  │  │   conversación."                                             ││   │
│  │  │                                                              ││   │
│  │  │  [Ver cómo se usa →]                                        ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  │                                                                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │   │
│  │  │  ITEM CARD  │ │  ITEM CARD  │ │  + AGREGAR  │               │   │
│  │  │  Premium    │ │  Premium    │ │             │               │   │
│  │  │             │ │             │ │             │               │   │
│  │  │  Tipo: ID   │ │  Tipo: Tone │ │             │               │   │
│  │  │  "Somos..." │ │  "Usa un..." │ │             │               │   │
│  │  │             │ │             │ │             │               │   │
│  │  │  [Edit][Del]│ │  [Edit][Del]│ │             │               │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘               │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │  SUGERENCIAS INTELIGENTES                                    ││   │
│  │  │  Basadas en tu vertical (Dental) + AI Learning               ││   │
│  │  │                                                              ││   │
│  │  │  • "Detectamos que preguntan mucho sobre garantías.         ││   │
│  │  │     Considera agregar una política de garantías."           ││   │
│  │  │                                                              ││   │
│  │  │  • "Tu competidor X fue mencionado 5 veces. Configura       ││   │
│  │  │     estrategia de competidores."                            ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Plan de Implementación por Fases

### FASE 1: Rediseño del Header y Scoring (Premium Visual)

**Objetivo:** Transformar el indicador de completitud en un componente hero premium que comunique claramente el estado y próximo paso.

#### Microfase 1.1: Nuevo Score Card Premium
- [ ] Rediseñar el círculo de progreso estilo Apple Health
- [ ] Agregar gradiente animado basado en score (verde → coral → rojo)
- [ ] Implementar micro-animaciones de entrada
- [ ] Mostrar delta de cambio ("+5% desde ayer")

#### Microfase 1.2: Próximo Paso Inteligente
- [ ] Algoritmo que determina el impacto máximo de cada acción
- [ ] Card de "Próximo Paso" con preview de impacto
- [ ] Quick action button para ir directo a completar

#### Microfase 1.3: Selector de Sucursal Mejorado
- [ ] Pill selector visual (no dropdown)
- [ ] Badge que muestra items globales vs específicos
- [ ] Indicador visual de sucursales incompletas

**Archivos a modificar:**
- `src/features/settings/components/KBCompletenessIndicator.tsx`
- `src/shared/config/kb-scoring-service.ts`

---

### FASE 2: Nuevo Sistema de Navegación por Categorías

**Objetivo:** Reemplazar las pestañas planas por un sistema de navegación que comunique propósito y estado.

#### Microfase 2.1: Tabs Premium con Iconografía
- [ ] Diseñar nuevos iconos para cada categoría (SVG custom)
- [ ] Implementar tabs con estados visuales (activo, incompleto, completo)
- [ ] Agregar contador de items y límite del plan
- [ ] Animación de transición entre tabs

#### Microfase 2.2: Renombrar Categorías (UX Writing)
- [ ] "Instrucciones" → "Mente del Asistente" (cómo piensa)
- [ ] "Políticas" → "Reglas del Negocio" (qué puede/no puede)
- [ ] "Información" → "Saber del Negocio" (qué conoce)
- [ ] "Plantillas" → "Formas de Hablar" (cómo responde)
- [ ] "Competencia" → "Táctica Comercial" (cómo diferenciarse)

#### Microfase 2.3: Tooltip Educativo en Hover
- [ ] Tooltip que explica para qué sirve cada categoría
- [ ] Mini preview de cómo el AI usa esa información
- [ ] Link a documentación/ejemplos

**Archivos a modificar:**
- `src/features/settings/components/KnowledgeBase.tsx`
- Crear nuevo: `src/features/settings/components/KBCategoryTabs.tsx`

---

### FASE 3: Rediseño de Cards de Items

**Objetivo:** Cards premium que muestren jerarquía y estado de cada item.

#### Microfase 3.1: Card Premium Base
- [ ] Sombras sutiles con hover elevado
- [ ] Badge de tipo con color distintivo
- [ ] Indicador de "Global" vs "Sucursal específica"
- [ ] Truncado inteligente con "ver más"

#### Microfase 3.2: Estados Visuales
- [ ] Estado "activo" con borde verde sutil
- [ ] Estado "inactivo" con opacidad reducida
- [ ] Estado "tiene embedding" con ícono de búsqueda
- [ ] Estado "necesita actualización" con badge naranja

#### Microfase 3.3: Quick Actions
- [ ] Botones de editar/eliminar con hover reveal
- [ ] Toggle de activo/inactivo sin abrir modal
- [ ] Duplicar item para otra sucursal
- [ ] Ver preview de cómo se usa

**Archivos a modificar:**
- `src/features/settings/components/KnowledgeBase.tsx`
- Crear nuevo: `src/features/settings/components/KBItemCard.tsx`

---

### FASE 4: Panel de Explicación Contextual

**Objetivo:** Cada categoría debe tener un panel que explique exactamente cómo el AI usa esa información.

#### Microfase 4.1: Diseño del Panel Explicativo
- [ ] Card destacada al inicio de cada categoría
- [ ] Icono + título + descripción concisa
- [ ] Enlace "Ver cómo funciona" que abre modal

#### Microfase 4.2: Contenido por Categoría
- [ ] **Instrucciones:** "Estas reglas se incluyen en CADA conversación. Define la personalidad."
- [ ] **Políticas:** "El asistente consulta estas políticas cuando el cliente pregunta sobre reglas."
- [ ] **Información:** "El asistente BUSCA aquí cuando necesita datos específicos (RAG)."
- [ ] **Plantillas:** "Respuestas predefinidas para situaciones comunes. Usa variables {nombre}."
- [ ] **Competencia:** "Estrategias específicas cuando detecta mención de competidores."

#### Microfase 4.3: Visual de Flujo Simplificado
- [ ] Mini diagrama que muestra: Contenido → Sistema → Respuesta
- [ ] Animación on-scroll que ilustra el flujo

**Archivos a crear:**
- `src/features/settings/components/KBCategoryExplainer.tsx`
- `src/features/settings/config/kb-category-content.ts`

---

### FASE 5: Sugerencias Inteligentes

**Objetivo:** Sistema proactivo que sugiere qué contenido agregar basado en vertical + AI Learning.

#### Microfase 5.1: Motor de Sugerencias
- [ ] Analizar patrones de AI Learning (preguntas frecuentes)
- [ ] Detectar gaps en el KB actual
- [ ] Priorizar por impacto en score

#### Microfase 5.2: UI de Sugerencias
- [ ] Card de sugerencias al final de cada categoría
- [ ] Ordenar por impacto potencial
- [ ] Botón "Agregar esto" que pre-llena el formulario

#### Microfase 5.3: Sugerencias por Vertical
- [ ] Templates sugeridos para Dental
- [ ] Templates sugeridos para Restaurant
- [ ] Templates sugeridos para otros verticales

**Archivos a modificar:**
- `src/shared/config/kb-suggested-templates.ts`
- Crear nuevo: `src/features/settings/components/KBSuggestions.tsx`

---

### FASE 6: Modal de Edición Premium

**Objetivo:** Transformar el modal de edición en una experiencia guiada y premium.

#### Microfase 6.1: Diseño del Modal
- [ ] Full-screen modal en móvil, centered en desktop
- [ ] Animaciones de entrada/salida (Framer Motion)
- [ ] Stepper visual si hay múltiples campos

#### Microfase 6.2: Validación en Tiempo Real
- [ ] Contador de caracteres con límite visual
- [ ] Detector de contenido placeholder
- [ ] Preview de cómo se verá la información

#### Microfase 6.3: Campos Inteligentes
- [ ] Selector de tipo con descripción de cada opción
- [ ] Campo de ejemplos con sugerencias
- [ ] Selector de sucursal con explicación

**Archivos a modificar:**
- `src/features/settings/components/KnowledgeBase.tsx` (extraer modales)
- Crear nuevo: `src/features/settings/components/KBItemModal.tsx`

---

### FASE 7: Integración Visual con AI Learning

**Objetivo:** Mostrar al usuario qué ha aprendido el sistema de las conversaciones.

#### Microfase 7.1: Sección "Lo que el AI ha Aprendido"
- [ ] Card que muestra top 5 patrones detectados
- [ ] Vocabulario específico aprendido
- [ ] Horarios preferidos detectados

#### Microfase 7.2: Convertir Aprendizaje en Contenido
- [ ] Botón "Crear instrucción basada en este patrón"
- [ ] Sugerir FAQ basada en preguntas frecuentes
- [ ] Crear artículo basado en respuestas exitosas

#### Microfase 7.3: Insights Accionables
- [ ] Mostrar insights de `ai_business_insights`
- [ ] Botón para "actuar" sobre cada insight
- [ ] Marcar insights como "revisados"

**Archivos a crear:**
- `src/features/settings/components/KBAILearningSection.tsx`

---

### FASE 8: Preview y Simulación

**Objetivo:** Permitir al usuario ver cómo el AI usaría su contenido.

#### Microfase 8.1: Preview de Prompt Generado
- [ ] Botón "Ver Prompt Completo" que abre modal
- [ ] Highlight de secciones (instrucciones, contexto, etc.)
- [ ] Contador de tokens estimados

#### Microfase 8.2: Simulador de Búsqueda RAG
- [ ] Input para escribir pregunta de prueba
- [ ] Mostrar qué contenido encontraría el RAG
- [ ] Ordenado por relevancia con score de similitud

#### Microfase 8.3: Chat de Prueba (Opcional)
- [ ] Mini chat para probar respuestas
- [ ] Mostrar qué tools usó y qué encontró
- [ ] Feedback para mejorar contenido

**Archivos a modificar:**
- `src/features/settings/components/PromptPreview.tsx`
- Crear nuevo: `src/features/settings/components/KBRAGSimulator.tsx`

---

### FASE 9: Responsive y Animaciones

**Objetivo:** Experiencia premium en todos los dispositivos.

#### Microfase 9.1: Mobile-First Redesign
- [ ] Navigation tabs como pills horizontales scrollables
- [ ] Cards en stack vertical
- [ ] Gestos de swipe para cambiar categoría

#### Microfase 9.2: Animaciones Premium
- [ ] Stagger animations en lista de items
- [ ] Morphing de score circle al cambiar
- [ ] Skeleton loaders estilo Apple

#### Microfase 9.3: Micro-interacciones
- [ ] Feedback táctil en botones
- [ ] Ripple effect en clicks
- [ ] Bounce en acciones completadas

**Archivos a modificar:**
- Todos los componentes de KB
- `app/globals.css` (nuevas animaciones)

---

### FASE 10: Testing y Pulido Final

**Objetivo:** Asegurar calidad y rendimiento.

#### Microfase 10.1: Testing de UX
- [ ] Verificar flujos completos
- [ ] Test de accesibilidad (ARIA)
- [ ] Test en diferentes resoluciones

#### Microfase 10.2: Optimización
- [ ] Lazy loading de componentes pesados
- [ ] Memoización de cálculos de scoring
- [ ] Reducir re-renders innecesarios

#### Microfase 10.3: Documentación
- [ ] Tooltips de ayuda en cada sección
- [ ] Link a guía de mejores prácticas
- [ ] Onboarding para nuevos usuarios

---

## Paleta de Colores (TIS TIS Brand)

| Uso | Color | Variable |
|-----|-------|----------|
| Primario (CTA) | Coral `#DF7373` | `--tis-coral` |
| Acento | Pink `#C23350` | `--tis-pink` |
| Éxito | Green `#9DB8A1` | `--tis-green` |
| Info | Purple `#667eea` | `--tis-purple` |
| Texto primario | Slate 900 `#0f172a` | `--text-primary` |
| Texto secundario | Slate 600 `#475569` | `--text-secondary` |
| Fondo | White/Slate 50 | `--bg-primary/secondary` |

## Tipografía

- **Display:** Plus Jakarta Sans (headers)
- **Body:** Plus Jakarta Sans/Inter (texto)
- **Metric:** 2rem, 800 weight (números grandes)
- **Label:** 0.75rem, uppercase, tracking wide

## Componentes Base (Shadcn/UI)

- Card con `rounded-2xl`, `shadow-card`
- Badge con variantes de color
- Button con estados hover/active/disabled
- Modal con AnimatePresence
- Input con focus rings

---

## Métricas de Éxito

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| Completitud KB promedio | ~45% | 75%+ |
| Items de KB por tenant | ~8 | 15+ |
| Tiempo para agregar item | ~2 min | <1 min |
| Usuarios que completan KB | ~30% | 60%+ |
| NPS de la sección | No medido | 8+ |

---

## Próximos Pasos

1. **Revisar y aprobar** este documento
2. **Priorizar fases** según impacto vs esfuerzo
3. **Crear mockups** de las fases prioritarias
4. **Implementar** fase por fase con validación

---

*Documento creado: 2026-01-15*
*Versión: 1.0*
*Autor: Claude Code + TIS TIS Team*
