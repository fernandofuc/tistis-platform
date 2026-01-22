# TIS TIS Platform

Sistema completo de gestion empresarial con IA conversacional multi-agente, agente de voz con telefonia, WhatsApp Business API y automatizacion de procesos multi-canal.

**Version:** 5.0.0
**Estado:** Produccion - Voice Agent v3 + Messaging Agent + API Settings
**Ultima actualizacion:** 20 de Enero, 2026

---

## 🎯 Descripcion

TIS TIS Platform es una solucion SaaS multi-tenant para gestion de negocios que integra un sistema de IA multi-capa con capacidades de texto y voz:

### Sistemas de IA Integrados

- **LangGraph Multi-Agente** - Orquestacion de agentes especializados con flujo de grafo
- **Business IA (Knowledge Base)** - Base de conocimiento configurable con AI Learning
- **AI Agent Voz (VAPI)** - Agente de voz con telefonia, STT y TTS
- **AI Learning** - Aprendizaje automatico de patrones y vocabulario

### Funcionalidades Core

- Gestion de leads con scoring automatico basado en IA
- Sistema de mensajeria multi-canal (WhatsApp, Instagram, Facebook, TikTok)
- **Agente de voz con numeros telefonicos** - Llamadas entrantes/salientes con AI
- **Configuracion de AI por canal** - Personaliza el comportamiento por canal
- Sistema de citas y calendario con **recordatorios automaticos** (1 semana, 24h, 4h)
- Sistema de **membresias con validacion de pagos por transferencia** (AI Vision)
- **Integration Hub** - Conecta CRMs, POS y software externo (HubSpot, Dentrix, Square, etc.)
- Historiales clinicos con odontograma
- Cotizaciones y planes de pago con Stripe
- Notificaciones en tiempo real
- Cola de trabajos asincronos para procesamiento de mensajes

## 🧠 Arquitectura de IA Completa

TIS TIS utiliza una arquitectura de IA de multiples capas donde cada componente tiene una responsabilidad especifica:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TIS TIS AI ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   CANALES DE    │    │   CANALES DE    │    │   VOICE AGENT   │         │
│  │     TEXTO       │    │    TELEFONIA    │    │     (VAPI)      │         │
│  │  ─────────────  │    │  ─────────────  │    │  ─────────────  │         │
│  │  • WhatsApp     │    │  • Llamadas     │    │  • STT Deepgram │         │
│  │  • Instagram    │    │    Entrantes    │    │  • TTS Eleven   │         │
│  │  • Facebook     │    │  • Llamadas     │    │  • Server-Side  │         │
│  │  • TikTok       │    │    Salientes    │    │    Response     │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    BUSINESS CONTEXT LAYER                             │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  get_tenant_ai_context() RPC - Carga TODA la configuracion:           │  │
│  │  • tenant_config (identidad, tono, instrucciones)                     │  │
│  │  • services[] (catalogo de servicios con precios)                     │  │
│  │  • faqs[] (preguntas frecuentes configuradas)                         │  │
│  │  • policies (cancelacion, pagos, garantias)                           │  │
│  │  • branches[] (sucursales con horarios y personal)                    │  │
│  │  • promotions[] (promociones activas)                                 │  │
│  │  • knowledge_base[] (documentos y conocimiento)                       │  │
│  │  • ai_learning (patrones, vocabulario, insights)                      │  │
│  │  • conversation_history (ultimos 20 mensajes)                         │  │
│  │  • external_data (datos de CRM, POS, software externo) - NUEVO        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      LANGGRAPH MULTI-AGENT                            │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │                                                                       │  │
│  │     ┌──────────────┐                                                  │  │
│  │     │  SUPERVISOR  │ ◄─── Detecta intencion del mensaje               │  │
│  │     └──────┬───────┘                                                  │  │
│  │            │                                                          │  │
│  │      ┌─────┴─────┐                                                    │  │
│  │      ▼           ▼                                                    │  │
│  │ ┌─────────┐ ┌──────────┐                                              │  │
│  │ │VERTICAL │ │ESCALATION│ ◄─── Escala a humano si necesario            │  │
│  │ │ ROUTER  │ └──────────┘                                              │  │
│  │ └────┬────┘                                                           │  │
│  │      │                                                                │  │
│  │      ▼ Enruta segun vertical (dental, restaurant, medical...)         │  │
│  │ ┌────┴────┬────────┬────────┬────────┬────────┐                       │  │
│  │ ▼         ▼        ▼        ▼        ▼        ▼                       │  │
│  │┌────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌───────┐ ┌───────┐                   │  │
│  ││GREET│ │PRICING│ │BOOKING│ │ FAQ │ │GENERAL│ │URGENT │                   │  │
│  │└──┬─┘ └──┬───┘ └──┬───┘ └──┬──┘ └───┬───┘ └───┬───┘                   │  │
│  │   └──────┴────────┴────────┴────────┴─────────┘                       │  │
│  │                            │                                          │  │
│  │                            ▼                                          │  │
│  │                     ┌────────────┐                                    │  │
│  │                     │  FINALIZE  │ ◄─── Formatea respuesta final      │  │
│  │                     └────────────┘                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        AI LEARNING LAYER                              │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  • Extrae patrones de mensajes entrantes                              │  │
│  │  • Aprende vocabulario especifico del negocio                         │  │
│  │  • Detecta preferencias de horarios de clientes                       │  │
│  │  • Identifica objeciones comunes                                      │  │
│  │  • Genera insights automaticos por vertical                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🤖 LangGraph Multi-Agente (Detalle Tecnico)

### Que es LangGraph?

LangGraph es un framework para construir sistemas de IA multi-agente. En lugar de un solo "cerebro" de IA que responde todo, TIS TIS tiene un **equipo de agentes especializados** que trabajan juntos en un grafo dirigido:

```
                     +------------------+
                     |   SUPERVISOR     |
                     | (Detecta intent) |
                     +--------+---------+
                              │
                    +---------+---------+
                    │                   │
            +-------▼-------+   +-------▼-------+
            │ VERTICAL      │   │ ESCALATION    │
            │ ROUTER        │   │ (Humano)      │
            +-------+-------+   +---------------+
                    │
    +---------------+---------------+
    │       │       │       │       │
+---▼---+ +-▼---+ +-▼---+ +-▼---+ +-▼---+
│GREETING│ │PRICING│ │BOOKING│ │FAQ│ │GENERAL│
+---+---+ +--+--+ +--+--+ +-+-+ +--+--+
    │        │       │       │      │
    +--------+-------+-------+------+
                     │
              +------▼------+
              │  FINALIZE   │
              +-------------+
```

### Agentes Implementados

| Agente | Responsabilidad | Especialidad |
|--------|-----------------|--------------|
| **Supervisor** | Detecta intencion del mensaje y enruta | Orquestacion |
| **Vertical Router** | Enruta segun el tipo de negocio | Dental, Restaurant, Medical, etc. |
| **Greeting Agent** | Maneja saludos y bienvenidas | Primer contacto |
| **Pricing Agent** | Responde sobre precios y cotizaciones | Consultas economicas |
| **Location Agent** | Informacion de ubicaciones | Direcciones y sucursales |
| **Hours Agent** | Horarios de atencion | Disponibilidad |
| **FAQ Agent** | Preguntas frecuentes | Base de conocimiento |
| **Booking Agent** | Agenda citas (con variantes por vertical) | Dental, Medical, Restaurant |
| **General Agent** | Fallback para consultas generales | Todo lo demas |
| **Escalation Agent** | Escala a humano | Casos complejos |
| **Urgent Care Agent** | Emergencias y urgencias | Dolor, accidentes |

### Integracion con Configuraciones del Cliente

Todos los agentes tienen acceso completo al contexto del negocio:

- **Instrucciones personalizadas** - Identidad, tono, casos especiales
- **Politicas del negocio** - Cancelaciones, pagos, garantias
- **Servicios y precios** - Con promociones activas
- **FAQs personalizadas** - Respuestas pre-configuradas
- **Knowledge Base completo** - Documentos y conocimiento del negocio
- **Sucursales** - Horarios y personal por ubicacion
- **Manejo de competencia** - Respuestas ante menciones de competidores
- **Plantillas de respuesta** - Templates configurados
- **Estilo de comunicacion** - Configurado por tenant

### Beneficios del Sistema Multi-Agente

1. **Respuestas mas especializadas** - Cada agente es experto en su area
2. **Mejor manejo de verticales** - Una clinica dental responde diferente a un restaurante
3. **Sistema de handoffs** - Los agentes pueden pasarse el control entre si
4. **Trazabilidad completa** - Se sabe exactamente que agente proceso cada mensaje
5. **Escalacion inteligente** - Detecta cuando escalar a humano automaticamente
6. **Deteccion de urgencias** - Prioriza emergencias medicas/dentales

### Arquitectura de Archivos LangGraph

```
src/features/ai/
├── state/
│   └── agent-state.ts          # Estado compartido del grafo (BusinessContext extendido)
├── agents/
│   ├── supervisor/
│   │   └── supervisor.agent.ts # Orquestador principal
│   ├── routing/
│   │   └── vertical-router.agent.ts # Enrutador por vertical
│   └── specialists/
│       ├── base.agent.ts       # Clase base con buildFullBusinessContext()
│       ├── greeting.agent.ts   # Saludos
│       ├── pricing.agent.ts    # Precios
│       ├── location.agent.ts   # Ubicaciones
│       ├── hours.agent.ts      # Horarios
│       ├── faq.agent.ts        # FAQs
│       ├── booking.agent.ts    # Citas (+ variantes)
│       ├── general.agent.ts    # General
│       ├── escalation.agent.ts # Escalacion
│       └── urgent-care.agent.ts # Urgencias
├── graph/
│   └── tistis-graph.ts         # Grafo principal compilado
└── services/
    ├── langgraph-ai.service.ts # Servicio de integracion (usa get_tenant_ai_context RPC)
    └── message-learning.service.ts # Sistema de aprendizaje automatico
```

### Flujo de Procesamiento del Grafo

```
1. Mensaje Entrante
       │
       ▼
2. get_tenant_ai_context() ─────► Carga BusinessContext completo
       │
       ▼
3. SUPERVISOR.invoke()
       │
       ├── Analiza intencion del mensaje
       ├── Determina siguiente nodo (routing/escalation)
       │
       ▼
4. VERTICAL_ROUTER (si aplica)
       │
       ├── Detecta vertical del tenant (dental, restaurant, medical)
       ├── Selecciona agente especialista apropiado
       │
       ▼
5. SPECIALIST_AGENT (greeting, pricing, booking, faq, general, urgent)
       │
       ├── Recibe BusinessContext completo
       ├── Genera respuesta especializada
       ├── Puede incluir tool calls (agendar cita, etc)
       │
       ▼
6. FINALIZE
       │
       ├── Formatea respuesta final
       ├── Aplica estilo de comunicacion del tenant
       │
       ▼
7. Respuesta al Usuario
```

## 📞 AI Agent Voz (VAPI Integration)

### Que es el Voice Agent?

El Voice Agent permite a los negocios tener un **agente de IA que contesta llamadas telefonicas**. Utiliza VAPI como plataforma de voz con:

- **STT (Speech-to-Text)**: Deepgram para transcripcion
- **TTS (Text-to-Speech)**: ElevenLabs para voz natural
- **Server-Side Response Mode**: TIS TIS genera las respuestas del AI

### Arquitectura del Voice Agent v3.0

```
┌─────────────────────────────────────────────────────────────────────┐
│                   VOICE AGENT v3.0 ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐                                                   │
│   │  LLAMADA    │                                                   │
│   │  ENTRANTE   │                                                   │
│   └──────┬──────┘                                                   │
│          │                                                          │
│          ▼                                                          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    VAPI PLATFORM                            │   │
│   │  • STT: Deepgram nova-2  • TTS: ElevenLabs multilingual_v2  │   │
│   └────────────────────────┬────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              WEBHOOK HANDLER v3.0                           │   │
│   │  ───────────────────────────────────────────────────────    │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│   │  │Security Gate │──│Circuit Breaker│──│ Event Router │      │   │
│   │  │• IP Whitelist│  │• 8s timeout  │  │• assistant-req│      │   │
│   │  │• HMAC Verify │  │• 5 failures  │  │• conv-update │      │   │
│   │  │• Rate Limit  │  │• Fallback    │  │• end-of-call │      │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│   └────────────────────────┬────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  LANGGRAPH VOICE                            │   │
│   │  ───────────────────────────────────────────────────────    │   │
│   │  Router → Tool Executor → RAG → Response Generator          │   │
│   │  • 32 tools (5 common, 14 restaurant, 13 dental)           │   │
│   │  • 17 capabilities con validacion en tiempo real            │   │
│   │  • Prompts hibridos (Template + Gemini KB)                  │   │
│   └────────────────────────┬────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    VAPI TTS                                 │   │
│   │  • ElevenLabs convierte texto → voz natural                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sistema de Capabilities (v3.0)

El Voice Agent v3.0 introduce un sistema robusto de capabilities por vertical y nivel:

| Vertical | Tipo | Capabilities |
|----------|------|--------------|
| **Restaurant** | basic | reservations, business_hours, business_info, human_transfer |
| **Restaurant** | standard | + menu_info, recommendations, faq |
| **Restaurant** | complete | + orders, order_status, promotions |
| **Dental** | basic | appointments, business_hours, business_info, human_transfer |
| **Dental** | standard | + services_info, doctor_info, faq |
| **Dental** | complete | + insurance_info, appointment_management, emergencies |

### Tools Disponibles (32 total)

- **Common (5)**: get_business_hours, get_business_info, transfer_to_human, request_invoice, end_call
- **Restaurant (14)**: check_availability, create_reservation, modify/cancel_reservation, get_menu, get_menu_item, search_menu, get_recommendations, create/modify/cancel_order, get_order_status, calculate_delivery_time, get_promotions
- **Dental (13)**: check_appointment_availability, create/modify/cancel_appointment, get_services, get_service_info, get_service_prices, get_doctors, get_doctor_info, get_insurance_info, check_insurance_coverage, handle_emergency, send_reminder

### Server-Side Response Mode

A diferencia del modo standard donde VAPI usa su propio LLM, TIS TIS usa **Server-Side Response Mode**:

1. VAPI envia el transcript al webhook de TIS TIS
2. TIS TIS procesa con LangGraph (con todo el BusinessContext)
3. TIS TIS retorna la respuesta que VAPI debe decir
4. VAPI convierte a voz con ElevenLabs

**Ventaja**: La IA tiene acceso completo al conocimiento del negocio (servicios, precios, horarios, etc.)

### Configuracion en Dashboard

En **Configuracion > AI Agent Voz** los usuarios pueden:

- Comprar numeros telefonicos via VAPI
- Configurar voz (ElevenLabs voice ID)
- Personalizar instrucciones del agente de voz
- Ver llamadas recientes y estadisticas

### Archivos del Voice Agent

```
src/features/voice-agent/
├── components/
│   ├── VoiceAgentSetup.tsx      # UI de configuracion
│   ├── PhoneNumberManager.tsx   # Gestion de numeros
│   └── VoiceSettings.tsx        # Configuracion de voz
├── services/
│   ├── vapi.service.ts          # Integracion con VAPI API
│   └── voice-webhook.service.ts # Procesamiento de webhooks
├── types/
│   └── voice-agent.types.ts     # Tipos del modulo
└── hooks/
    └── useVoiceAgent.ts         # Hook principal

app/api/voice-agent/
├── webhook/route.ts             # Webhook que recibe llamadas VAPI
├── phone-numbers/route.ts       # API para comprar/listar numeros
└── config/route.ts              # API para configuracion
```

## 🧠 Sistema de Aprendizaje Automatico de IA (AI Learning)

### Que es?

El sistema de aprendizaje automatico analiza **todos los mensajes entrantes** para extraer patrones, vocabulario y comportamientos que mejoran las respuestas de la IA con el tiempo. Funciona tanto para mensajes de texto como para transcripciones de llamadas.

### Flujo de Aprendizaje

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI LEARNING PIPELINE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│   │  MENSAJE    │    │  LLAMADA    │    │   OTRO      │            │
│   │  WHATSAPP   │    │    VOZ      │    │   CANAL     │            │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘            │
│          │                  │                  │                    │
│          └──────────────────┼──────────────────┘                    │
│                             ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                 AI LEARNING QUEUE                           │   │
│   │  Tabla: ai_learning_queue (procesamiento asincrono)         │   │
│   └────────────────────────┬────────────────────────────────────┘   │
│                            │                                        │
│                            ▼ CRON: /api/cron/process-learning       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              MESSAGE LEARNING SERVICE                       │   │
│   │  ───────────────────────────────────────────────────────    │   │
│   │  extractPatterns()     → Detecta patrones de comportamiento │   │
│   │  extractVocabulary()   → Aprende terminos del negocio       │   │
│   │  extractPreferences()  → Horarios preferidos, preferencias  │   │
│   │  extractObjections()   → Objeciones y preocupaciones        │   │
│   │  generateInsights()    → Insights automaticos               │   │
│   └────────────────────────┬────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                 TABLAS DE APRENDIZAJE                       │   │
│   │  ───────────────────────────────────────────────────────    │   │
│   │  ai_message_patterns    → Patrones detectados               │   │
│   │  ai_learned_vocabulary  → Vocabulario aprendido             │   │
│   │  ai_business_insights   → Insights generados                │   │
│   └────────────────────────┬────────────────────────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │            BUSINESS CONTEXT (ai_learning)                   │   │
│   │  ───────────────────────────────────────────────────────    │   │
│   │  Se incluye en get_tenant_ai_context() para que todos       │   │
│   │  los agentes tengan acceso al conocimiento aprendido        │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Tipos de Patrones Extraidos

| Tipo | Descripcion | Ejemplo |
|------|-------------|---------|
| **Vocabulario** | Terminos especificos del negocio/region | "blanqueamiento", "profilaxis" |
| **Horarios Preferidos** | Cuando prefieren los clientes | "Tardes despues de las 5pm" |
| **Objeciones Comunes** | Preocupaciones frecuentes | "Es muy caro", "No tengo tiempo" |
| **Preguntas Frecuentes** | Dudas que se repiten | "Aceptan tarjeta?" |
| **Patrones de Compra** | Comportamientos de conversion | "Primero piden precio, luego horario" |

### Caracteristicas por Vertical

El sistema extrae patrones **especificos por tipo de negocio**:

- **Dental**: Urgencias, tipos de tratamiento, seguros dentales
- **Restaurant**: Reservaciones, alergias, eventos especiales
- **Medical**: Sintomas, especialidades, seguros medicos
- **General**: Patrones universales de atencion al cliente

### Disponibilidad

Solo disponible para planes **Essentials** y superiores.

### Tablas de Base de Datos

```sql
-- Patrones extraidos de mensajes
ai_message_patterns (tenant_id, pattern_type, pattern_value, frequency, confidence)

-- Vocabulario especifico del negocio
ai_learned_vocabulary (tenant_id, term, context, usage_count)

-- Insights automaticos generados
ai_business_insights (tenant_id, insight_type, insight_data, generated_at)

-- Configuracion por tenant
ai_learning_config (tenant_id, enabled, vertical_type, settings)

-- Cola de procesamiento asincrono
ai_learning_queue (tenant_id, message_id, status, processed_at)
```

### Endpoint CRON

```
POST /api/cron/process-learning
Authorization: Bearer <CRON_SECRET>
```

Procesa la cola de mensajes pendientes para extraccion de patrones. Se ejecuta cada 15 minutos.

## 💼 Business IA (Knowledge Base)

### Que es?

Business IA es la **interfaz de configuracion** donde los usuarios administran todo el conocimiento que la IA utiliza. Es el "cerebro configurable" del negocio.

### Pestanas de Configuracion

En **Configuracion > Business IA** se encuentran:

#### 1. General (Identidad del Negocio)
- Nombre del negocio
- Tipo de negocio (vertical)
- Tono de comunicacion
- Idioma preferido
- Instrucciones generales para el AI

#### 2. Servicios (Catalogo)
- Lista de servicios/productos
- Precios y duraciones
- Descripciones detalladas
- Categorias y subcategorias

#### 3. FAQs (Preguntas Frecuentes)
- Preguntas y respuestas predefinidas
- Organizadas por categoria
- Priorizacion de respuestas

#### 4. Politicas
- Politicas de cancelacion
- Politicas de pago
- Garantias y devoluciones
- Terminos especiales

#### 5. Knowledge Base (Base de Conocimiento)
- Documentos y archivos
- Informacion adicional del negocio
- **Generacion de instrucciones con IA** - Analiza el contenido y sugiere instrucciones

#### 6. AI Learning (Aprendizaje)
- Patrones detectados automaticamente
- Vocabulario aprendido
- Insights del negocio
- Configuracion de aprendizaje

### Generacion de Instrucciones con IA

El boton "Generar Instrucciones con IA" en la pestana Knowledge Base:

1. Analiza todo el contenido cargado (servicios, FAQs, politicas, documentos)
2. Genera instrucciones optimizadas para el AI
3. Sugiere mejoras basadas en el conocimiento del negocio

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BUSINESS IA DASHBOARD                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┬──────────┬──────┬──────────┬─────────────┬──────────┐  │
│  │ General │ Servicios│ FAQs │ Politicas│ Knowledge   │ Learning │  │
│  │         │          │      │          │ Base        │          │  │
│  └─────────┴──────────┴──────┴──────────┴─────────────┴──────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    CONTENIDO DE LA PESTAÑA                    │  │
│  │                                                               │  │
│  │  [Formularios de configuracion especificos]                   │  │
│  │                                                               │  │
│  │  [Boton: Guardar Cambios]                                     │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Integracion con LangGraph

Todo el contenido de Business IA se carga via `get_tenant_ai_context()` y se inyecta en cada agente del sistema multi-agente. Esto significa que cualquier cambio en la configuracion se refleja **inmediatamente** en las respuestas del AI.

### Configuracion del Feature Flag

LangGraph esta controlado por un feature flag por tenant:

```sql
-- Ver estado actual
SELECT tenant_id, use_langgraph FROM ai_tenant_config;

-- Activar LangGraph para un tenant
UPDATE ai_tenant_config
SET use_langgraph = true
WHERE tenant_id = 'tu-tenant-id';

-- Desactivar (volver al sistema legacy)
UPDATE ai_tenant_config
SET use_langgraph = false
WHERE tenant_id = 'tu-tenant-id';
```

La migracion `064_LANGGRAPH_FEATURE_FLAG.sql` agrega:
- Columna `use_langgraph` (boolean, default: false)
- Columna `langgraph_config` (JSONB para configuracion avanzada)
- Indice optimizado para busqueda rapida
- Funcion helper `tenant_uses_langgraph(tenant_id)`

## 🌐 Sistema de Terminologia Dinamica Multi-Vertical

### Que es?

El sistema de terminologia dinamica adapta automaticamente todos los textos de la UI segun el tipo de negocio (vertical) del tenant. Esto permite que la misma plataforma se sienta nativa para diferentes industrias.

### Verticales Soportados

| Vertical | Paciente | Cita | Quote | Dashboard Title |
|----------|----------|------|-------|-----------------|
| **dental** | Paciente | Cita | Presupuesto | "Centro de control de tu clinica" |
| **restaurant** | Cliente | Reservacion | Cotizacion | "Centro de control de tu restaurante" |
| **clinic** | Paciente | Consulta | Cotizacion | "Centro de control de tu clinica" |
| **gym** | Miembro | Clase | Membresia | "Centro de control de tu gimnasio" |
| **beauty** | Cliente | Cita | Cotizacion | "Centro de control de tu salon" |
| **veterinary** | Paciente | Consulta | Presupuesto | "Centro de control de tu veterinaria" |

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DYNAMIC TERMINOLOGY SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────┐    │
│   │   TENANT    │    │  useTenant()    │    │  useVerticalTerminology │    │
│   │  (vertical) │───►│  hook           │───►│  hook                   │    │
│   └─────────────┘    └─────────────────┘    └───────────┬─────────────┘    │
│                                                         │                   │
│                                                         ▼                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    EXTENDED TERMINOLOGY                             │  │
│   │  ─────────────────────────────────────────────────────────────────  │  │
│   │  35+ campos dinamicos por vertical:                                 │  │
│   │  • patient, patients, appointment, appointments, quote, quotes      │  │
│   │  • dashboardTitle, dashboardSubtitle, calendarPageTitle            │  │
│   │  • scheduleAction, viewAllAction, searchPlaceholder                │  │
│   │  • appointmentScheduledStatus, newAppointmentNotification          │  │
│   │  • syncAppointments, calendarSyncDescription                       │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                         │                   │
│                                                         ▼                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    TERMINOLOGY HELPERS                              │  │
│   │  ─────────────────────────────────────────────────────────────────  │  │
│   │  Factory functions para constantes dinamicas:                       │  │
│   │  • getLeadStatuses(terminology)       - Estados de leads            │  │
│   │  • getNotificationTypes(terminology)  - Tipos de notificaciones     │  │
│   │  • getBadgeConfigs(terminology)       - Configuraciones de badges   │  │
│   │  • getSyncCapabilities(terminology)   - Capacidades de sync         │  │
│   │  • getAppointmentLabels(terminology)  - Labels de citas             │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Uso en Componentes

```typescript
import { useVerticalTerminology } from '@/src/hooks';

function DashboardPage() {
  const { terminology, t, vertical } = useVerticalTerminology();

  return (
    <div>
      <h1>{t('dashboardTitle')}</h1>
      <p>{t('dashboardSubtitle')}</p>

      <Button>{terminology.newAppointment}</Button>
      <span>Total de {terminology.patients}: 150</span>
    </div>
  );
}
```

### Archivos del Sistema

```
src/hooks/
├── useVerticalTerminology.ts    # Hook principal con 6 verticales
├── useTenant.ts                 # Lee vertical del tenant
└── index.ts                     # Barrel exports

src/shared/utils/
└── terminologyHelpers.ts        # Factory functions para constantes
```

### Flujo de Determinacion del Vertical

```
1. Discovery API analiza el negocio → clasifica como dental | restaurant | otro
2. Pricing page muestra vertical → usuario puede ajustar
3. Checkout envia vertical → se guarda en metadata de Stripe
4. Provisioning crea tenant → vertical se almacena en DB
5. useTenant hook → lee vertical de la base de datos
6. useVerticalTerminology → provee terminologia correcta a toda la UI
```

---

## 🔌 Integration Hub (Sistema de Integraciones Externas)

### Que es?

Integration Hub es el sistema que permite conectar TIS TIS con sistemas externos (CRMs, POS, software dental, calendarios) de manera bidireccional. Los datos sincronizados se almacenan en tablas separadas (`external_*`) y estan disponibles para el AI de forma opcional.

### Sistemas Soportados

| Categoria | Sistemas | Estado |
|-----------|----------|--------|
| **CRM** | HubSpot, Salesforce, Zoho CRM, Pipedrive, Freshsales | HubSpot disponible, otros proximamente |
| **Software Dental** | Dentrix, Open Dental, Eaglesoft, Curve Dental | Proximamente |
| **POS** | Square, Toast, Clover, Lightspeed, SoftRestaurant | Proximamente |
| **Calendario** | Google Calendar, Calendly, Acuity | Proximamente |
| **Medico** | Epic, Cerner, Athenahealth | Proximamente |
| **Generico** | Webhook Entrante, CSV Import, API Custom | Disponible |

### Arquitectura del Integration Hub

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION HUB ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   HubSpot   │  │   Dentrix   │  │   Square    │  │  Calendly   │        │
│  │     CRM     │  │   Dental    │  │     POS     │  │  Calendar   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                   │                                         │
│                                   ▼                                         │
│         ┌─────────────────────────────────────────────────────────┐        │
│         │               INTEGRATION CONNECTIONS                    │        │
│         │  ───────────────────────────────────────────────────    │        │
│         │  • OAuth2 / API Key / Webhook authentication            │        │
│         │  • Sync configuration (direction, frequency)            │        │
│         │  • Field mapping customization                          │        │
│         │  • Error tracking and retry logic                       │        │
│         └───────────────────────────┬─────────────────────────────┘        │
│                                     │                                       │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     EXTERNAL DATA TABLES                              │ │
│  │  ─────────────────────────────────────────────────────────────────    │ │
│  │  external_contacts     → Contactos sincronizados con deduplicacion    │ │
│  │  external_appointments → Citas de calendarios externos                │ │
│  │  external_inventory    → Inventario de POS (con alertas stock bajo)   │ │
│  │  external_products     → Productos/menus de POS                       │ │
│  │  integration_sync_logs → Auditoria de sincronizaciones                │ │
│  │  integration_actions   → Acciones bidireccionales configuradas        │ │
│  └───────────────────────────┬───────────────────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    DEDUPLICACION INTELIGENTE                          │ │
│  │  ─────────────────────────────────────────────────────────────────    │ │
│  │  • normalize_phone_number() - Normaliza telefonos para matching       │ │
│  │  • find_matching_lead_for_dedup() - Busca leads existentes            │ │
│  │  • linked_lead_id / linked_patient_id - FK a entidades TIS TIS        │ │
│  └───────────────────────────┬───────────────────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    AI CONTEXT INTEGRATION                             │ │
│  │  ─────────────────────────────────────────────────────────────────    │ │
│  │  get_tenant_external_data() RPC - Carga datos externos:               │ │
│  │  • source_systems[] (sistemas conectados)                             │ │
│  │  • low_stock_items[] (alertas de inventario bajo)                     │ │
│  │  • external_products[] (menu/catalogo externo)                        │ │
│  │  • external_appointments_count (citas proximas 7 dias)                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tablas de Base de Datos

| Tabla | Proposito |
|-------|-----------|
| `integration_connections` | Conexiones de sistemas externos (credenciales, configuracion sync) |
| `external_contacts` | Contactos sincronizados de CRM con deduplicacion inteligente |
| `external_appointments` | Citas de calendarios externos |
| `external_inventory` | Inventario de POS con alertas de stock bajo |
| `external_products` | Productos/servicios externos (menus, catalogos) |
| `integration_sync_logs` | Auditoria de sincronizaciones |
| `integration_actions` | Acciones bidireccionales (trigger-based) |

### Funciones RPC

```sql
-- Normaliza numero de telefono para deduplicacion
SELECT normalize_phone_number('+52 (555) 123-4567');
-- Resultado: 525551234567

-- Busca lead existente para vincular
SELECT * FROM find_matching_lead_for_dedup('tenant-id', '+521234567890', 'email@example.com');
-- Resultado: lead_id, match_type (phone/email), confidence (0.90-0.95)

-- Obtiene datos externos para contexto del AI
SELECT get_tenant_external_data('tenant-id');
-- Resultado: JSONB con source_systems, low_stock_items, external_products
```

### API Endpoints

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/integrations` | Lista integraciones del tenant |
| POST | `/api/integrations` | Crea nueva integracion |
| GET | `/api/integrations/[id]` | Detalle de integracion |
| PATCH | `/api/integrations/[id]` | Actualiza integracion |
| DELETE | `/api/integrations/[id]` | Elimina integracion |
| POST | `/api/integrations/[id]/sync` | Inicia sincronizacion manual |

### Acceso en Dashboard

En **Configuracion > Integraciones** los usuarios pueden:

- Ver integraciones activas con estadisticas de sync
- Conectar nuevos sistemas (OAuth2 o API Key)
- Configurar que datos sincronizar (contactos, citas, productos, inventario)
- Ver logs de sincronizacion y errores
- Iniciar sincronizacion manual

### Integracion con AI

Los datos externos se cargan en paralelo via `get_tenant_external_data()` y se incluyen en el `BusinessContext` de los agentes LangGraph. Esto permite:

- **Alertas de stock bajo** - El AI puede informar sobre productos agotandose
- **Menu externo** - El AI conoce el catalogo del POS
- **Citas externas** - El AI sabe cuantas citas hay de otros sistemas
- **Contexto enriquecido** - Respuestas mas informadas con datos de CRM

```typescript
// El campo external_data en BusinessContext incluye:
interface ExternalData {
  has_integrations: boolean;
  source_systems: string[];      // ['hubspot', 'square']
  low_stock_items: Array<{...}>;  // Productos con stock bajo
  external_products: Array<{...}>; // Menu/catalogo del POS
  external_appointments_count: number;
  last_sync_at: string;
}
```

### Tipos de Autenticacion

| Tipo | Uso | Sistemas |
|------|-----|----------|
| `oauth2` | OAuth 2.0 flow | HubSpot, Salesforce, Square, Google Calendar |
| `api_key` | API Key simple | Dentrix, Open Dental, API Custom |
| `basic_auth` | Usuario + Password | Sistemas legacy |
| `webhook_secret` | HMAC para webhooks | Webhook Entrante |

### Direccion de Sincronizacion

- **inbound** - Solo de sistema externo a TIS TIS
- **outbound** - Solo de TIS TIS a sistema externo
- **bidirectional** - Ambas direcciones

### Migracion

La migracion `078_INTEGRATION_HUB.sql` crea:
- 7 tablas nuevas para el sistema de integraciones
- 3 funciones RPC (normalize_phone_number, find_matching_lead_for_dedup, get_tenant_external_data)
- Indices optimizados para busquedas y deduplicacion
- RLS policies para aislamiento multi-tenant
- Triggers para normalizacion automatica de telefonos

## 🚀 Quick Start

### Prerrequisitos

- Node.js 18+
- PostgreSQL (vía Supabase)
- npm o pnpm

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd tistis-platform

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Ejecutar migraciones en Supabase
# Ver /supabase/migrations/README.md

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📁 Estructura del Proyecto

```
tistis-platform/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Rutas de autenticacion
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/                  # Rutas del dashboard
│   │   └── dashboard/
│   │       ├── page.tsx              # Dashboard principal (con skeleton loading)
│   │       ├── leads/                # Gestion de leads
│   │       ├── patients/             # Gestion de pacientes
│   │       ├── calendario/           # Calendario de citas
│   │       ├── inbox/                # Conversaciones multi-canal
│   │       ├── analytics/            # Metricas y reportes
│   │       ├── lealtad/              # Sistema de lealtad
│   │       ├── configuracion/        # Configuracion general
│   │       ├── business-ia/          # 💼 Business IA (Knowledge Base)
│   │       └── ai-agent-voz/         # 📞 AI Agent Voz (VAPI)
│   └── api/                          # API Routes
│       ├── leads/
│       ├── appointments/
│       ├── patients/
│       ├── conversations/
│       ├── voice-agent/              # 📞 Voice Agent APIs
│       │   ├── webhook/              # Webhook VAPI
│       │   ├── phone-numbers/        # Gestion de numeros
│       │   └── config/               # Configuracion
│       ├── integrations/             # 🔌 Integration Hub APIs (NUEVO)
│       │   ├── route.ts              # GET/POST integraciones
│       │   └── [id]/
│       │       ├── route.ts          # GET/PATCH/DELETE
│       │       └── sync/route.ts     # POST sync manual
│       ├── webhook/                  # Webhooks externos
│       │   ├── whatsapp/[tenantSlug]/
│       │   ├── instagram/[tenantSlug]/
│       │   ├── facebook/[tenantSlug]/
│       │   └── tiktok/[tenantSlug]/
│       ├── cron/
│       │   ├── process-learning/     # 🧠 CRON AI Learning
│       │   └── reminders/            # CRON Recordatorios
│       ├── jobs/
│       └── search/
│
├── src/
│   ├── hooks/                        # 🌐 Hooks globales (NUEVO)
│   │   ├── useTenant.ts              # Lee tenant de DB
│   │   ├── useVerticalTerminology.ts # Terminologia dinamica multi-vertical
│   │   ├── useFeatureFlags.ts        # Feature flags
│   │   └── index.ts                  # Barrel exports
│   │
│   ├── features/                     # Features por funcionalidad
│   │   ├── auth/                     # Autenticacion
│   │   ├── dashboard/                # Dashboard (con DashboardSkeleton)
│   │   ├── leads/                    # Gestion de leads
│   │   ├── appointments/             # Citas y calendario
│   │   ├── patients/                 # Pacientes
│   │   ├── conversations/            # Mensajeria multi-canal
│   │   ├── loyalty/                  # Sistema de lealtad
│   │   ├── settings/                 # Configuracion
│   │   │   └── components/
│   │   │       └── BusinessAISettings.tsx  # 💼 UI Business IA
│   │   ├── ai/                       # 🤖 Sistema LangGraph
│   │   │   ├── state/
│   │   │   │   └── agent-state.ts
│   │   │   ├── agents/
│   │   │   │   ├── supervisor/
│   │   │   │   ├── routing/
│   │   │   │   └── specialists/
│   │   │   ├── graph/
│   │   │   │   └── tistis-graph.ts
│   │   │   └── services/
│   │   │       ├── langgraph-ai.service.ts
│   │   │       └── message-learning.service.ts  # 🧠 AI Learning
│   │   ├── voice-agent/              # 📞 Voice Agent Feature
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── hooks/
│   │   └── integrations/             # 🔌 Integration Hub Feature
│   │       ├── components/
│   │       │   └── IntegrationHub.tsx # UI principal
│   │       ├── types/
│   │       │   └── integration.types.ts
│   │       └── index.ts
│   │
│   └── shared/                       # Codigo compartido
│       ├── components/
│       │   └── ui/                   # Componentes UI reutilizables
│       ├── hooks/
│       ├── stores/                   # Zustand stores
│       ├── lib/                      # Configuraciones (supabase, etc)
│       ├── utils/
│       │   └── terminologyHelpers.ts # 🌐 Factory functions para terminologia
│       └── types/
│
├── supabase/
│   └── migrations/                   # 78+ migraciones SQL
│
├── public/
└── docs/                             # Documentacion tecnica
```

## 🗄️ Base de Datos

### Schema v2.3

- **32+ tablas** principales (tenants, leads, patients, quotes, user_roles, vertical_configs, ai_learning_*, integration_connections, external_*, etc.)
- **14 funciones** PostgreSQL optimizadas con advisory locks
- **4 views** para queries complejas (incluye staff_members)
- **3 buckets** de Storage (patient-files, quotes-pdf, temp-uploads)
- **RLS policies** corregidas usando user_roles (multi-tenant seguro)
- **30+ indices** optimizados

### Migraciones Aplicadas

1. `001_initial_schema.sql` - Schema base + discovery sessions
2. `002_add_session_token.sql` - Token de sesion para onboarding
3. `003_esva_schema_v2.sql` - Schema multi-tenant completo
4. `004_esva_seed_data.sql` - Datos de ESVA (tenant inicial)
5. `005_patients_module.sql` - Modulo de pacientes
6. `006_quotes_module.sql` - Modulo de cotizaciones
7. `007_files_storage_setup.sql` - Storage buckets
8. `008_notifications_module.sql` - Sistema de notificaciones
9. `009_critical_fixes.sql` - 14 fixes criticos (seguridad + performance)
10. `010_assembly_engine.sql` - Motor de ensamblaje de propuestas
11. `011_master_correction.sql` - Correccion master critica
12. ... (migraciones 012-063) - Mejoras incrementales
13. `064_LANGGRAPH_FEATURE_FLAG.sql` - Feature flag para LangGraph multi-agente
14. `065_AI_MESSAGE_LEARNING_SYSTEM.sql` - Sistema de aprendizaje automatico de mensajes
15. ... (migraciones 066-077) - Mejoras incrementales
16. `078_INTEGRATION_HUB.sql` - **NUEVO** - Sistema de integraciones externas (CRM, POS, etc.)

### Migración 011: Corrección Master (10 Dic 2025)

**CRÍTICO - Cambios de negocio y seguridad:**

**Precios actualizados:**
- Starter: **$3,490/mes** (1 sucursal)
- Essentials: **$7,490/mes** (hasta 8 sucursales)
- Growth: **$12,490/mes** (hasta 20 sucursales)

**Seguridad multi-tenant:**
- ✅ Tabla `user_roles` creada (era referenciada pero no existía)
- ✅ RLS policies corregidas: ahora usan `user_roles` en vez de JWT claims inexistentes
- ✅ Prevención de acceso cross-tenant mejorada
- ✅ Sincronización automática staff → user_roles

**Nuevas features:**
- ✅ Tabla `vertical_configs` para configuración por tipo de negocio (dental, restaurant, etc.)
- ✅ VIEW `staff_members` como alias de `staff` (compatibilidad)
- ✅ Función helper `get_user_tenant_id()` para queries
- ✅ 6 addons actualizados con precios 2025

**Correcciones:**
- ✅ VIEW `quotes_full` corregida (l.name → l.full_name)
- ✅ Tabla `proposals` actualizada (activation_fee = 0)

Ver detalles completos en `/supabase/migrations/MIGRATION_NOTES.md`

## 🔌 API Routes

### Endpoints Disponibles

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET/POST | `/api/leads` | Lista y crea leads | ✅ |
| GET/PATCH/DELETE | `/api/leads/[id]` | CRUD de lead específico | ✅ |
| GET/POST | `/api/appointments` | Gestión de citas | ✅ |
| GET/POST | `/api/patients` | Gestión de pacientes | ✅ |
| GET/PATCH/DELETE | `/api/patients/[id]` | CRUD de paciente | ✅ |
| GET/POST | `/api/conversations` | Conversaciones multi-canal | ✅ |
| POST | `/api/webhook/whatsapp/[tenantSlug]` | Webhook WhatsApp | ⚠️ |
| POST | `/api/webhook/instagram/[tenantSlug]` | Webhook Instagram | ⚠️ |
| POST | `/api/webhook/facebook/[tenantSlug]` | Webhook Facebook | ⚠️ |
| POST | `/api/webhook/tiktok/[tenantSlug]` | Webhook TikTok | ⚠️ |
| POST | `/api/jobs/process` | Procesador de cola de trabajos | ⚠️ |
| GET/POST | `/api/integrations` | Lista y crea integraciones | ✅ |
| GET/PATCH/DELETE | `/api/integrations/[id]` | CRUD de integracion | ✅ |
| POST | `/api/integrations/[id]/sync` | Sincronizacion manual | ✅ |

Todas las rutas validan:
- Autenticación vía header `Authorization`
- Pertenencia al tenant correcto
- Formato de UUID
- Validaciones de datos específicas

### Sistema de Webhooks Multi-Canal

Los webhooks multi-tenant soportan:
- **WhatsApp Business Cloud API** - Mensajes y estados
- **Instagram Direct Messages** - Mensajes vía Meta Graph API
- **Facebook Messenger** - Mensajes vía Meta Graph API
- **TikTok Direct Messages** - Mensajes vía TikTok Business API

Cada webhook verifica firmas criptográficas y procesa mensajes de forma asíncrona mediante cola de trabajos.

## 🔐 Seguridad

### Implementado (v4.3.0 - Security Hardened)

**Prevencion de Ataques:**
- ✅ **Timing-safe token verification** - `timingSafeEqual` en todos los endpoints criticos
- ✅ **IDOR Prevention** - Sistema centralizado `getAuthenticatedContext()`
- ✅ **Rate Limiting** - Limitadores pre-configurados por tipo de endpoint
- ✅ **Filter Injection Prevention** - Sanitizacion de busquedas PostgREST
- ✅ **Security Headers** - CSP, X-Frame-Options, HSTS configurados

**Multi-Tenant Security:**
- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Validación de tenant en todas las operaciones
- ✅ Advisory locks para prevenir race conditions
- ✅ Prevención de acceso cross-tenant
- ✅ Autenticación en API routes
- ✅ Validación de permisos por rol
- ✅ Storage policies con validación de path

**Auditorias Completadas:** #11, #12, #13, #14, #15, #16 (25+ vulnerabilidades corregidas)

## 🏗️ Infrastructure (Actualizado 2026-01-21)

### Logging

El sistema utiliza logging estructurado JSON para trazabilidad completa:

```typescript
import { getLogger } from '@/src/shared/lib/structured-logger';

const logger = getLogger('voice-agent');
logger.info('Processing call', { callId, tenantId });
```

**Características:**
- Redacción automática de campos sensibles (password, token, apiKey, secret, etc.)
- Niveles: debug, info, warn, error
- Metadatos estructurados por contexto
- Compatible con servicios de agregación de logs

### Environment Validation

Validación de variables de entorno al iniciar la aplicación:

```typescript
// src/instrumentation.ts - Se ejecuta automáticamente al iniciar Next.js
import { validateEnvironment } from '@/src/shared/lib/env-validator';

export function register() {
  validateEnvironment(); // Falla el build si faltan vars críticas
}
```

**Variables Validadas:**
- `NEXT_PUBLIC_SUPABASE_URL` (requerida)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (requerida)
- `SUPABASE_SERVICE_ROLE_KEY` (requerida en producción)
- `OPENROUTER_API_KEY` (requerida para AI)
- `VAPI_API_KEY` (opcional, para Voice Agent)
- `STRIPE_SECRET_KEY` (opcional, para pagos)

### Rate Limiting

Sistema unificado de rate limiting con Redis y fallback a memoria:

```typescript
import { checkRateLimitMigration } from '@/src/shared/lib/rate-limit-migration';
import { publicAPILimiter, getClientIP } from '@/src/shared/lib/rate-limit';

// En un API route
const clientIP = getClientIP(request);
const result = await checkRateLimitMigration(clientIP, publicAPILimiter);

if (!result.success) {
  return rateLimitExceeded(result);
}
```

**Limitadores Pre-configurados:**
- `strictLimiter`: 3 req/min (admin auth)
- `standardLimiter`: 60 req/min (APIs autenticadas)
- `publicAPILimiter`: 100 req/min (APIs públicas)
- `webhookLimiter`: 200 req/min (webhooks)

**Flags de Migración:**
- `USE_UNIFIED_RATE_LIMIT`: Usa el nuevo rate limiter unificado
- `RATE_LIMIT_SHADOW_MODE`: Compara ambos sin afectar usuarios

### Admin Authentication

Autenticación centralizada para endpoints administrativos:

```typescript
import { verifyAdminAuth } from '@/src/shared/lib/admin-auth';

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }
  // ... proceso administrativo
}
```

**Características:**
- Verificación timing-safe de tokens
- Rate limiting integrado (3 req/min por defecto)
- Header: `X-Admin-Key`
- Variable de entorno: `ADMIN_API_KEY`

### Roles Disponibles

- `super_admin` - Acceso total multi-tenant
- `admin` - Gestión completa de su tenant
- `receptionist` - Gestión de leads, citas, pacientes
- `dentist` - Acceso a pacientes y citas
- `specialist` - Similar a dentist

## 🎨 Frontend

### Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- React Query
- date-fns

### Componentes Clave

| Ruta | Descripcion | Features |
|------|-------------|----------|
| `/dashboard` | Overview con stats | DashboardSkeleton, Promise.all queries |
| `/dashboard/leads` | Gestion de leads | Scoring, clasificacion, timeline |
| `/dashboard/calendario` | Calendario de citas | Recordatorios automaticos |
| `/dashboard/inbox` | Conversaciones multi-canal | WhatsApp, Instagram, FB, TikTok |
| `/dashboard/patients` | Gestion de pacientes | Odontograma, historial |
| `/dashboard/analytics` | Metricas y reportes | Charts, KPIs |
| `/dashboard/lealtad` | Sistema de lealtad | Puntos, beneficios |
| `/dashboard/business-ia` | 💼 Business IA | Knowledge Base, AI Learning |
| `/dashboard/ai-agent-voz` | 📞 Voice Agent | Numeros VAPI, config voz |

### Diseno del Dashboard

El dashboard principal utiliza un diseno premium con:

- **Sidebar colapsable** - Navegacion con animaciones suaves
- **Stats cards** - Metricas con iconos y badges
- **Leads list** - Vista previa de leads recientes
- **Quick actions** - Acciones rapidas comunes
- **Skeleton loading** - Feedback visual instantaneo

### Optimizaciones de Performance

- ✅ **DashboardSkeleton** - UI skeleton durante carga de auth
- ✅ **Promise.all()** - Queries paralelas en dashboard
- ✅ **useTransition** - Navegacion sin bloquear UI
- ✅ **NavigationProgress** - Indicador de progreso
- ✅ Debounce en busquedas (300ms)
- ✅ AbortController para cancelar requests
- ✅ Memory leaks corregidos en hooks
- ✅ Realtime subscriptions optimizadas
- ✅ Refs estables para prevenir stale closures

## 📚 Documentación

- `STATUS_PROYECTO.md` - Estado completo del proyecto
- `docs/INTEGRATION_GUIDE.md` - Guía de integraciones (WhatsApp, Stripe, AI)
- `docs/MULTI_CHANNEL_AI_SYSTEM.md` - Sistema de AI multi-canal completo
- `supabase/migrations/MIGRATION_NOTES.md` - Guía completa de migraciones
- `.claude/docs/` - Documentación técnica adicional

### Documentacion Tecnica AI Multi-Canal

El archivo `docs/MULTI_CHANNEL_AI_SYSTEM.md` contiene:
- **Arquitectura LangGraph Multi-Agente** - Sistema de agentes especializados
- Arquitectura completa del sistema de mensajeria
- Especificacion de webhooks para cada plataforma (WhatsApp, Instagram, Facebook, TikTok)
- Sistema de cola de trabajos (jobs queue) con procesamiento asincrono
- Integracion con sistema de agentes para respuestas especializadas
- Lead scoring automatico basado en senales del AI
- **Configuracion de AI por canal** - Personalizacion por canal conectado
- Sistema de **recordatorios automaticos de citas**
- **Validacion de pagos por transferencia** con OpenAI Vision
- Variables de entorno requeridas
- Flujo completo de procesamiento de mensajes

### Documentacion Sistema Multi-Agente

La arquitectura LangGraph se documenta en:
- `src/features/ai/state/agent-state.ts` - Definicion del estado compartido
- `src/features/ai/graph/tistis-graph.ts` - Grafo principal con todos los nodos
- `src/features/ai/agents/` - Implementacion de cada agente especializado
- `supabase/migrations/064_LANGGRAPH_FEATURE_FLAG.sql` - Feature flag y configuracion

## 🧪 Testing

```bash
npm run test              # Ejecutar tests (pendiente)
npm run lint              # ESLint
npm run typecheck         # TypeScript check
```

## 📊 Estado del Proyecto

### Version 5.0.0 - Voice Agent v3 + Messaging Agent + API Settings (Enero 2026)

**Voice Agent v3.0 (NUEVO):**
- ✅ Security Gate con 5 capas de validacion (IP, HMAC, timestamp, rate limit, content-type)
- ✅ Circuit Breaker con timeout de 8s y fallback automatico
- ✅ 32 tools implementados (5 common, 14 restaurant, 13 dental)
- ✅ 17 capabilities con matriz por vertical y nivel
- ✅ Sistema de prompts hibridos (Template Handlebars + Gemini KB enrichment)
- ✅ Tipos de asistente: 6 tipos (3 por vertical)
- ✅ Templates por personalidad: professional, friendly, energetic, calm
- ✅ Sincronizacion de ToolCapability con Capability types

**Messaging Agent v2.0 (MEJORADO):**
- ✅ Sistema de prompts hibridos compartido con Voice
- ✅ Diferenciacion por canal (emojis, markdown, botones para WhatsApp)
- ✅ RAG con 4000 tokens de contexto
- ✅ Respuestas hasta 2000 caracteres
- ✅ Integracion con Meta (WhatsApp, Instagram, Facebook)

**API Settings Tab (NUEVO):**
- ✅ Gestion completa de API Keys (crear, ver, revocar, rotar)
- ✅ Scopes granulares por endpoint
- ✅ Rate limiting configurable (por minuto y diario)
- ✅ IP whitelist opcional
- ✅ Documentacion interactiva inline
- ✅ Sandbox para pruebas de endpoints
- ✅ Historial de auditoria

**Sistema de Terminologia Dinamica (v4.6.0):**
- ✅ Hook `useVerticalTerminology` con 6 verticales soportados
- ✅ 35+ campos de terminologia por vertical
- ✅ Factory functions para constantes dinamicas (`terminologyHelpers.ts`)
- ✅ Verticales activos: dental, restaurant
- ✅ Verticales preparados: clinic, gym, beauty, veterinary

**Integration Hub (v4.4.0):**
- ✅ Sistema de integraciones externas (CRM, POS, dental software, calendarios)
- ✅ 7 tablas nuevas para manejo de datos externos
- ✅ Deduplicacion inteligente de contactos (phone/email matching)
- ✅ Sincronizacion bidireccional configurable

**Seguridad (v4.3.0):**
- ✅ 6 Auditorias de seguridad completadas (#11-#16)
- ✅ 25+ vulnerabilidades corregidas
- ✅ Sistema de autenticacion centralizado
- ✅ Rate limiting expandido
- ✅ Timing-safe token verification
- ✅ Filter injection prevention

**Sistemas de IA Implementados:**
- ✅ LangGraph Multi-Agente (100%)
- ✅ Business IA / Knowledge Base (100%)
- ✅ AI Agent Voz con VAPI v3.0 (100%)
- ✅ AI Learning automatico (100%)
- ✅ Messaging Agent v2.0 (100%)

**Core Features:**
- ✅ Modulo de pacientes (100%)
- ✅ Sistema de archivos (100%)
- ✅ Sistema de notificaciones (100%)
- ✅ Modulo de cotizaciones - DB (100%)
- ✅ Seguridad multi-tenant (100%)
- ✅ API Routes + API Settings (100%)
- ✅ Mensajeria multi-canal (100%)
- ✅ Integration Hub - CRM, POS, External Systems (100%)
- ✅ Sistema de Terminologia Dinamica Multi-Vertical (100%)

**Dashboard:**
- ✅ Diseno premium actualizado
- ✅ DashboardSkeleton para carga instantanea
- ✅ Optimizaciones de performance
- ✅ Sidebar colapsable con animaciones
- ✅ Pestana API en Configuracion

**Pendiente:**
- ⏸️ Modulo de cotizaciones - API/UI
- ⏸️ Testing automatizado
- ⏸️ Implementar request_invoice tool (facturacion CFDI)
- ⏸️ Implementar end_call tool

Ver detalles completos en `STATUS_PROYECTO.md`

## 🚀 Deploy

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Variables de Entorno

Configurar en Vercel Dashboard:

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**AI Providers:**
- `OPENROUTER_API_KEY` - Para LangGraph (OpenRouter como LLM provider)
- `OPENAI_API_KEY` - Para validacion de comprobantes (Vision)

**Voice Agent (VAPI):**
- `VAPI_API_KEY` - API key de VAPI
- `VAPI_PHONE_NUMBER_ID` - ID del numero telefonico
- `ELEVENLABS_API_KEY` - Para TTS (opcional, VAPI lo maneja)

**Pagos:**
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

**Sistema:**
- `CRON_SECRET` - Para cron jobs seguros
- `NEXTAUTH_SECRET` - Para autenticacion

## 🤝 Contribuir

Este proyecto sigue arquitectura Feature-First optimizada para desarrollo con IA.

### Guidelines

1. Una feature por carpeta en `/src/features/`
2. RLS policies obligatorias en nuevas tablas
3. Validación de tenant en todos los endpoints
4. Tests para funcionalidad crítica
5. Documentación actualizada

## 📞 Soporte

Para reportar issues o solicitar features, ver `STATUS_PROYECTO.md` para estado actual.

---

**Powered by Next.js, Supabase & Claude AI**

