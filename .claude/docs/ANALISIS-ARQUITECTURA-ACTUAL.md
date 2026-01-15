# Análisis de Arquitectura Actual - Base de Conocimiento TIS TIS

## 1. Visión General

La Base de Conocimiento de TIS TIS Platform es un sistema multi-tenant que permite a los negocios configurar información que será utilizada por los agentes de IA (mensajería y voz) para responder consultas de clientes.

---

## 2. Estructura de Componentes UI

### 2.1 Jerarquía de Componentes

```
/dashboard/ai-agents/configuracion/page.tsx
└── AIConfiguration.tsx (componente principal)
    ├── [Tab: Clínica y Sucursales]
    │   ├── Identidad del Negocio (inline form)
    │   ├── Branches List → BranchCard (inline)
    │   └── Staff Summary → StaffCard (inline)
    │
    ├── [Tab: Catálogo de Servicios]
    │   └── ServiceCatalogConfig.tsx (NO MODIFICAR)
    │
    ├── [Tab: Instrucciones]
    │   └── KnowledgeBase.tsx
    │       ├── [SubTab: Instrucciones] → ai_custom_instructions
    │       ├── [SubTab: Políticas] → ai_business_policies
    │       ├── [SubTab: Información] → ai_knowledge_articles
    │       └── [SubTab: Plantillas] → ai_response_templates
    │
    └── [Tab: Clasificación]
        └── ServicePriorityConfig.tsx
```

### 2.2 Ubicación de Archivos

| Componente | Ruta | Líneas |
|------------|------|--------|
| AIConfiguration | `src/features/settings/components/AIConfiguration.tsx` | ~1,400 |
| KnowledgeBase | `src/features/settings/components/KnowledgeBase.tsx` | 1,481 |
| ServiceCatalogConfig | `src/features/settings/components/ServiceCatalogConfig.tsx` | 558 |
| ServicePriorityConfig | `src/features/settings/components/ServicePriorityConfig.tsx` | 434 |
| BranchManagement | `src/features/settings/components/BranchManagement.tsx` | 903 |

---

## 3. Estructura de Base de Datos

### 3.1 Tablas de Knowledge Base

#### ai_custom_instructions
```sql
CREATE TABLE ai_custom_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,  -- Opcional: específico de sucursal
  instruction_type TEXT NOT NULL CHECK (instruction_type IN (
    'identity', 'greeting', 'communication_style', 'restrictions',
    'upselling', 'appointment_handling', 'emergency_handling', 'custom'
  )),
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  examples TEXT[],
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ai_business_policies
```sql
CREATE TABLE ai_business_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL CHECK (policy_type IN (
    'cancellation', 'payment', 'warranty', 'privacy', 'scheduling', 'custom'
  )),
  title TEXT NOT NULL,
  policy_text TEXT NOT NULL,
  short_version TEXT,  -- Versión corta para respuestas rápidas
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ai_knowledge_articles
```sql
CREATE TABLE ai_knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,  -- Resumen para respuestas rápidas
  keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ai_response_templates
```sql
CREATE TABLE ai_response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'greeting', 'farewell', 'appointment_confirmation',
    'out_of_hours', 'price_inquiry', 'custom'
  )),
  name TEXT NOT NULL,
  template_text TEXT NOT NULL,
  variables_available TEXT[],  -- {nombre}, {servicio}, {fecha}, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### ai_competitor_handling
```sql
CREATE TABLE ai_competitor_handling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_aliases TEXT[],  -- Nombres alternativos
  response_strategy TEXT NOT NULL,
  talking_points TEXT[],  -- Puntos a favor del negocio
  avoid_saying TEXT[],  -- Qué NO decir
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Tablas Relacionadas

#### services (extendida para AI)
```sql
-- Campos AI agregados a services
price_note TEXT,          -- Notas sobre precios para AI
ai_description TEXT,      -- Descripción optimizada para AI
special_instructions TEXT -- Instrucciones especiales
```

#### tenants
```sql
-- Campos relevantes
name TEXT,
legal_name TEXT,
vertical TEXT,  -- dental, restaurant, clinic, gym, beauty, veterinary
primary_contact_email TEXT,
primary_contact_phone TEXT
```

#### branches
```sql
-- Campos relevantes
name TEXT,
city TEXT,
address TEXT,
operating_hours JSONB,
is_headquarters BOOLEAN
```

---

## 4. API Routes

### 4.1 Knowledge Base API
**Ruta**: `/api/knowledge-base/route.ts`

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/knowledge-base?type={type}` | Obtener items por tipo |
| POST | `/api/knowledge-base` | Crear nuevo item |
| PUT | `/api/knowledge-base` | Actualizar item existente |
| DELETE | `/api/knowledge-base?id={id}&type={type}` | Eliminar item |

**Tipos soportados**:
- `instructions` → ai_custom_instructions
- `policies` → ai_business_policies
- `articles` → ai_knowledge_articles
- `templates` → ai_response_templates
- `competitors` → ai_competitor_handling

### 4.2 Services API
**Ruta**: `/api/services/route.ts`

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/services` | Obtener servicios del tenant |
| PUT | `/api/services` | Actualizar servicios (bulk) |

### 4.3 Branches API
**Ruta**: `/api/settings/branches/route.ts`

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/settings/branches` | Listar sucursales |
| POST | `/api/settings/branches` | Crear/actualizar sucursal |
| DELETE | `/api/branches?id={id}` | Eliminar sucursal |

---

## 5. RPC Function: get_tenant_ai_context

Esta función es **crítica** - agrega TODO el contexto del tenant para los agentes de IA.

```sql
CREATE OR REPLACE FUNCTION get_tenant_ai_context(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tenant', (
      SELECT jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'vertical', t.vertical,
        'primary_contact_email', t.primary_contact_email,
        'primary_contact_phone', t.primary_contact_phone
      )
      FROM tenants t WHERE t.id = p_tenant_id
    ),
    'ai_config', (
      SELECT row_to_json(ac.*)
      FROM ai_tenant_config ac WHERE ac.tenant_id = p_tenant_id
    ),
    'services', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'slug', s.slug,
        'category', s.category,
        'price_min', s.price_min,
        'price_max', s.price_max,
        'duration_minutes', s.duration_minutes,
        'price_note', s.price_note,
        'ai_description', s.ai_description,
        'special_instructions', s.special_instructions,
        'lead_priority', s.lead_priority,
        'is_active', s.is_active
      )), '[]'::jsonb)
      FROM services s WHERE s.tenant_id = p_tenant_id AND s.is_active = true
    ),
    'faqs', (
      SELECT COALESCE(jsonb_agg(row_to_json(f.*)), '[]'::jsonb)
      FROM tenant_faqs f WHERE f.tenant_id = p_tenant_id AND f.is_active = true
    ),
    'branches', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'city', b.city,
        'address', b.address,
        'phone', b.phone,
        'whatsapp_number', b.whatsapp_number,
        'operating_hours', b.operating_hours,
        'is_headquarters', b.is_headquarters,
        'latitude', b.latitude,
        'longitude', b.longitude,
        'google_maps_url', b.google_maps_url
      )), '[]'::jsonb)
      FROM branches b WHERE b.tenant_id = p_tenant_id AND b.is_active = true
    ),
    'doctors', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'first_name', s.first_name,
        'last_name', s.last_name,
        'display_name', s.display_name,
        'specialty', s.specialty,
        'license_number', s.license_number
      )), '[]'::jsonb)
      FROM staff s WHERE s.tenant_id = p_tenant_id AND s.is_active = true
    ),
    'scoring_rules', (
      SELECT row_to_json(sr.*)
      FROM lead_scoring_rules sr WHERE sr.tenant_id = p_tenant_id
    ),
    -- KB Tables
    'custom_instructions', (
      SELECT COALESCE(jsonb_agg(row_to_json(ci.*)), '[]'::jsonb)
      FROM ai_custom_instructions ci
      WHERE ci.tenant_id = p_tenant_id AND ci.is_active = true
      ORDER BY ci.priority DESC
    ),
    'business_policies', (
      SELECT COALESCE(jsonb_agg(row_to_json(bp.*)), '[]'::jsonb)
      FROM ai_business_policies bp
      WHERE bp.tenant_id = p_tenant_id AND bp.is_active = true
    ),
    'knowledge_articles', (
      SELECT COALESCE(jsonb_agg(row_to_json(ka.*)), '[]'::jsonb)
      FROM ai_knowledge_articles ka
      WHERE ka.tenant_id = p_tenant_id AND ka.is_active = true
    ),
    'response_templates', (
      SELECT COALESCE(jsonb_agg(row_to_json(rt.*)), '[]'::jsonb)
      FROM ai_response_templates rt
      WHERE rt.tenant_id = p_tenant_id AND rt.is_active = true
    ),
    'competitor_handling', (
      SELECT COALESCE(jsonb_agg(row_to_json(ch.*)), '[]'::jsonb)
      FROM ai_competitor_handling ch
      WHERE ch.tenant_id = p_tenant_id AND ch.is_active = true
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Servicios de Generación de Prompts

### 6.1 prompt-generator.service.ts

**Ubicación**: `src/features/ai/services/prompt-generator.service.ts`

**Funciones principales**:

```typescript
// Recolecta todo el contexto del negocio
async collectBusinessContext(tenantId: string): Promise<BusinessContext> {
  // Llama a get_tenant_ai_context() RPC
}

// Construye el meta-prompt para Gemini
buildMetaPrompt(context: PromptContext): string {
  // Incluye:
  // - Información del negocio
  // - Instrucciones personalizadas
  // - Políticas
  // - Servicios y precios
  // - Sucursales
  // - Staff/Doctores
  // - Reglas de scoring
}

// Genera el prompt final usando Gemini
async generatePromptWithAI(context: PromptContext): Promise<string> {
  // Usa Gemini 3.0 Flash para generar prompt optimizado
}

// Obtiene instrucciones compiladas por estilo/tipo/canal
getFullCompiledInstructions(
  styleKey: ResponseStyleKey,
  typeKey: AssistantTypeKey,
  channel: ChannelContext
): CompiledInstructions
```

### 6.2 Flujo de Generación

```
1. Usuario guarda configuración en UI
         ↓
2. API llama a promptGeneratorService.generatePromptForAgent()
         ↓
3. collectBusinessContext() → RPC get_tenant_ai_context()
         ↓
4. buildMetaPrompt() → combina todo el contexto
         ↓
5. generatePromptWithAI() → Gemini procesa y optimiza
         ↓
6. Prompt guardado en ai_tenant_config.generated_system_prompt
         ↓
7. LangGraph agents usan el prompt guardado
```

---

## 7. Sistema de Perfiles de Agente

### 7.1 Tipos de Perfil

| Perfil | Uso | Tabla |
|--------|-----|-------|
| **business** | Agente principal del negocio | agent_profiles |
| **personal** | Marca personal del dueño | agent_profiles |

### 7.2 Conexión Canal-Perfil

```sql
-- channel_connections tiene profile_id
ALTER TABLE channel_connections
ADD COLUMN profile_id UUID REFERENCES agent_profiles(id);
```

Esto permite que:
- WhatsApp #1 use perfil "business"
- WhatsApp #2 use perfil "personal"

---

## 8. Agente de Voz

### 8.1 Arquitectura

**Ubicación**: `src/features/voice-agent/`

```
voice-agent/
├── components/
│   ├── VoiceAgentWizard.tsx
│   ├── VoiceAgentSetupProgress.tsx
│   ├── VoicePreviewCard.tsx
│   ├── TalkToAssistant.tsx
│   └── ...
├── services/
│   ├── voice-agent.service.ts
│   └── voice-langgraph.service.ts
└── types/
    └── index.ts
```

### 8.2 Configuración de Voz

```typescript
interface VoiceAgentConfig {
  id: string;
  tenant_id: string;
  is_active: boolean;
  voice_id: string;  // ID de voz de ElevenLabs/similar
  assistant_name: string;
  language: string;  // 'es-MX'
  system_prompt: string | null;  // Prompt específico de voz
  system_prompt_generated_at: string | null;
  custom_instructions: string;
  response_speed: ResponseSpeedPreset;
  voice_quality: VoiceQualityPreset;
  // ... más configuraciones
}
```

### 8.3 Preview de Prompt en Voz

El sistema actual incluye `generated_prompt` en la respuesta del API:

```typescript
// En /api/voice-agent response
interface VoiceAgentResponse {
  data?: {
    config: VoiceAgentConfig;
    generated_prompt: string | null;  // ← Ya existe
  };
}
```

---

## 9. Gaps Identificados

### 9.1 UI Faltante

| Gap | Descripción | Tabla Existente |
|-----|-------------|-----------------|
| Competidores | No hay UI visible | ai_competitor_handling |
| Filtro Sucursal | branch_id existe pero no se filtra | Todas las KB tables |
| Variables dinámicas | Solo variables hardcoded | ai_response_templates |

### 9.2 Inconsistencias Visuales

| Componente | Problema |
|------------|----------|
| Modales | BranchManagement usa centrado, KnowledgeBase usa slide-over |
| Cards | Diferentes estilos entre componentes |
| Tabs | AIConfiguration y KnowledgeBase tienen tabs anidados |

### 9.3 Preview de Prompts

| Agente | Estado Actual |
|--------|--------------|
| Voz | `generated_prompt` existe en API |
| Mensajes (Business) | No hay preview UI |
| Mensajes (Personal) | No hay preview UI |

---

## 10. Conclusiones

La arquitectura actual es **sólida y bien diseñada**. Los principales puntos de mejora son:

1. **Consistencia visual** - Unificar patrones de UI
2. **Exposición de funcionalidades** - Competidores y filtro por sucursal ya existen en DB
3. **Preview de prompts** - Extender el patrón de voz a mensajes
4. **Organización de información** - Simplificar tabs anidados

El flujo de datos desde UI hasta agentes funciona correctamente. Las mejoras propuestas son evolutivas, no revolucionarias.
