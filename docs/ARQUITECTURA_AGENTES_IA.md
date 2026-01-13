# Arquitectura de Agentes de IA - TIS TIS Platform

> **Documento de Referencia v1.0**
> Fecha: 2026-01-13
> Autor: Sistema de Desarrollo TIS TIS

---

## 1. VISIÓN GENERAL

### 1.1 Concepto

El sistema de Agentes de IA de TIS TIS unifica tres tipos de asistentes virtuales bajo una arquitectura coherente:

1. **Agente de Mensajes (Negocio)** - Responde automáticamente en canales de mensajería (WhatsApp, Instagram, Facebook, TikTok) representando al negocio.

2. **Agente de Mensajes (Personal)** - Solo para vertical dental. Responde en redes sociales del doctor con delay simulado para parecer humano.

3. **Agente de Voz** - Asistente telefónico inteligente que atiende llamadas entrantes.

### 1.2 Principios de Diseño

- **Centralización**: Toda la configuración de IA en un solo lugar
- **Reutilización**: Base de conocimiento compartida entre agentes
- **Vertical-Aware**: Comportamiento adaptado según industria (dental, restaurant, etc.)
- **Seguridad**: RLS en todas las tablas, datos aislados por tenant

---

## 2. ESTRUCTURA DE NAVEGACIÓN

### 2.1 Sidebar (Post-Migración)

```
INTELIGENCIA ARTIFICIAL
├── Mis Agentes              ← Menú expandible
│   ├── Agente Mensajes      ← Perfiles Business/Personal
│   ├── Agente Voz           ← Configuración de voz/teléfono
│   └── Configuración        ← Base de conocimiento compartida
│       ├── Clínica y Sucursales
│       ├── Catálogo de Servicios
│       ├── Base de Conocimiento
│       └── Clasificación
│
└── Business IA              ← Insights generados por IA (independiente)
```

### 2.2 Rutas de Páginas

| Ruta | Descripción |
|------|-------------|
| `/dashboard/ai-agents` | Landing page de Mis Agentes |
| `/dashboard/ai-agents/mensajes` | Agente de Mensajes (ProfileCards) |
| `/dashboard/ai-agents/voz` | Agente de Voz (antes `/dashboard/ai-agent-voz`) |
| `/dashboard/ai-agents/configuracion` | Configuración compartida |
| `/dashboard/business-ia` | Business IA (sin cambios) |

---

## 3. ARQUITECTURA DE DATOS

### 3.1 Diagrama de Tablas

```
tenants (multi-tenant root)
  │
  ├── agent_profiles (perfiles de agente)
  │   ├── id, tenant_id
  │   ├── profile_type: 'business' | 'personal'
  │   ├── profile_name, agent_template, response_style
  │   ├── response_delay_minutes (solo personal)
  │   ├── custom_instructions_override
  │   ├── ai_learning_enabled, ai_learning_config
  │   └── is_active
  │
  ├── ai_agents (canales conectados por perfil)
  │   ├── id, tenant_id, profile_id
  │   ├── channel_type: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat'
  │   ├── channel_identifier, account_number
  │   └── is_active, messages_processed
  │
  ├── voice_agent_config (configuración de voz)
  │   ├── id, tenant_id, profile_id (siempre business)
  │   ├── assistant_name, first_message, voice_id
  │   ├── voice_enabled, voice_status
  │   ├── custom_instructions, system_prompt
  │   ├── escalation_enabled, escalation_phone
  │   └── recording_enabled, goodbye_message
  │
  ├── voice_phone_numbers (números telefónicos)
  │   ├── id, tenant_id, voice_agent_config_id
  │   ├── phone_number, area_code, branch_id
  │   ├── status: 'active' | 'pending' | 'provisioning'
  │   └── total_calls, total_minutes
  │
  ├── voice_calls (historial de llamadas)
  │   ├── id, tenant_id, phone_number_id
  │   ├── caller_phone, duration_seconds
  │   ├── status, outcome, transcript
  │   └── analysis (JSON), cost_usd
  │
  └── BASE DE CONOCIMIENTO (compartida)
      │
      ├── branches (sucursales)
      ├── staff + staff_branches (personal)
      ├── services (catálogo con lead_priority)
      │
      ├── ai_custom_instructions (instrucciones)
      ├── ai_business_policies (políticas)
      ├── ai_knowledge_articles (artículos)
      ├── ai_response_templates (plantillas)
      └── ai_competitor_handling (competencia)
```

### 3.2 Relaciones Clave

```
agent_profiles 1:N ai_agents (un perfil tiene múltiples canales)
agent_profiles 1:1 voice_agent_config (voz solo para business)
voice_agent_config 1:N voice_phone_numbers (múltiples teléfonos)
voice_phone_numbers 1:N voice_calls (historial por número)
branches 1:N voice_phone_numbers (un número por sucursal)
```

---

## 4. COMPONENTES PRINCIPALES

### 4.1 Agente de Mensajes

**Ubicación**: `/app/(dashboard)/dashboard/ai-agents/mensajes/`

**Componentes**:
- `ProfileCard` - Tarjeta de perfil (Business/Personal)
- `ProfileConfigModal` - Modal de configuración de perfil
- `ChannelBadge` - Estado de conexión de canal

**APIs**:
- `GET /api/agent-profiles` - Obtener perfiles
- `POST /api/agent-profiles` - Crear/actualizar perfil
- `PATCH /api/agent-profiles/[id]/toggle` - Activar/desactivar

### 4.2 Agente de Voz

**Ubicación**: `/app/(dashboard)/dashboard/ai-agents/voz/`

**Componentes**:
- `AssistantHeroCard` - Card principal con estado
- `VoicePersonalityTab` - Selección de voz
- `KnowledgeTab` - Instrucciones personalizadas
- `PhoneNumbersTab` - Gestión de números
- `CallHistoryTab` - Historial de llamadas
- `TalkToAssistant` - Modal para probar
- `VoiceAgentWizard` - Wizard inicial

**APIs**:
- `GET/POST/PATCH /api/voice-agent` - Configuración
- `GET/POST/DELETE /api/voice-agent/phone-numbers` - Números
- `GET /api/voice-agent/calls` - Historial
- `POST /api/voice-agent/webhook` - Webhook VAPI

### 4.3 Configuración Compartida

**Ubicación**: `/app/(dashboard)/dashboard/ai-agents/configuracion/`

**Sub-tabs**:
1. **Clínica y Sucursales** - Identidad, branches, staff
2. **Catálogo de Servicios** - Precios, duración, estado
3. **Base de Conocimiento** - Instrucciones, políticas, artículos, templates
4. **Clasificación** - Scoring de servicios (HOT/WARM/COLD)

**Componentes migrados de Settings > AI Agent**:
- `AIConfiguration` (contenedor principal)
- `KnowledgeBase` (instrucciones, políticas, artículos)
- `ServiceCatalogConfig` (catálogo)
- `ServicePriorityConfig` (scoring)

**APIs**:
- `GET/POST /api/settings/branches` - Sucursales
- `GET/POST/DELETE /api/settings/staff` - Personal
- `GET/PATCH /api/services` - Catálogo
- `GET/POST/PATCH/DELETE /api/knowledge-base` - Base de conocimiento

---

## 5. FLUJO DE DATOS

### 5.1 Mensaje Entrante (WhatsApp/Instagram)

```
1. Webhook recibe mensaje
   ↓
2. Identificar tenant + perfil activo
   ↓
3. Cargar contexto:
   - agent_profiles (configuración)
   - branches (sucursales)
   - services (catálogo)
   - ai_* tables (conocimiento)
   ↓
4. LangGraph procesa con agentes especializados
   ↓
5. Generar respuesta + actualizar lead score
   ↓
6. Enviar respuesta al canal
   ↓
7. AI Learning detecta patrones
```

### 5.2 Llamada Telefónica (Voice Agent)

```
1. VAPI recibe llamada entrante
   ↓
2. Webhook → /api/voice-agent/webhook
   ↓
3. Cargar voice_agent_config + context
   ↓
4. VoiceLangGraphService procesa
   ↓
5. Respuesta en tiempo real (streaming)
   ↓
6. Guardar voice_call con análisis
   ↓
7. Actualizar estadísticas
```

---

## 6. SEGURIDAD (RLS)

### 6.1 Políticas por Tabla

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `agent_profiles` | user_roles | owner/admin | owner/admin | owner |
| `ai_agents` | user_roles | owner/admin | owner/admin | owner |
| `voice_agent_config` | user_roles | owner/admin | owner/admin | owner |
| `voice_phone_numbers` | user_roles | owner/admin | owner/admin | owner |
| `voice_calls` | user_roles | service_role | service_role | - |

### 6.2 Service Role Bypass

Todas las tablas incluyen política `service_role` para operaciones del servidor.

---

## 7. VERTICAL-AWARENESS

### 7.1 Diferencias por Vertical

| Aspecto | Dental | Restaurant |
|---------|--------|------------|
| Perfil Personal | ✅ Disponible | ❌ No disponible |
| Terminología | Pacientes, Citas, Doctores | Clientes, Reservaciones, Meseros |
| Servicios | Tratamientos dentales | Platillos del menú |
| Lead Priority | Implantes=HOT | Eventos privados=HOT |

### 7.2 Hooks de Terminología

```typescript
// Uso en componentes
const { terminology } = useVerticalTerminology();
// terminology.appointment → "Cita" (dental) | "Reservación" (restaurant)
// terminology.patient → "Paciente" (dental) | "Cliente" (restaurant)
```

---

## 8. MIGRACIONES PENDIENTES

### 8.1 SQL 124 - Agent Profiles System

Estado: **Pendiente de ejecutar en Supabase**

Crea:
- Tabla `ai_agents`
- Tabla `agent_profiles`
- Tabla `agent_templates`
- Función `migrate_existing_agents_to_profiles()`
- Trigger para crear perfil business automático

### 8.2 Migración de UI (Este documento)

Estado: **En progreso**

Cambios:
- Sidebar con submenús expandibles
- Nuevas rutas anidadas
- Componentes reorganizados

---

## 9. ROADMAP FUTURO

### 9.1 Fase Actual: Migración de UI
- Reorganizar navegación
- Mover componentes sin cambiar funcionalidad
- Verificar integridad de datos

### 9.2 Fase Siguiente: Mejoras UI/UX
- Rediseño de ProfileCards
- Wizard de configuración unificado
- Dashboard de métricas en Mis Agentes

### 9.3 Fase Final: Arquitectura Interna
- Unificar generación de prompts
- Centralizar AI Learning
- Optimizar queries de contexto

---

## 10. REFERENCIAS

### 10.1 Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src/features/ai-agents/` | Componentes de perfiles |
| `src/features/voice-agent/` | Componentes de voz |
| `src/features/settings/components/AIConfiguration.tsx` | Config actual (a migrar) |
| `src/features/dashboard/components/Sidebar.tsx` | Navegación |
| `app/api/voice-agent/` | APIs de voz |
| `app/api/ai-config/` | APIs de config IA |
| `supabase/migrations/124_AGENT_PROFILES_SYSTEM.sql` | Migración de tablas |

### 10.2 Hooks Utilizados

- `useAuth()` - Autenticación
- `useTenant()` - Datos del tenant
- `useVerticalTerminology()` - Terminología dinámica
- `useAgentProfiles()` - Perfiles de agentes

---

**Última actualización**: 2026-01-13
**Próxima revisión**: Después de completar migración de UI
