# 🔐 TIS TIS Platform - API Settings Implementation Guide

## Documentación Técnica Completa
**Versión:** 1.0.0
**Fecha:** Enero 2026
**Autor:** Equipo TIS TIS

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Investigación de Estándares de la Industria](#2-investigación-de-estándares-de-la-industria)
3. [Arquitectura de TIS TIS](#3-arquitectura-de-tis-tis)
4. [Diseño del Sistema de API Keys](#4-diseño-del-sistema-de-api-keys)
5. [Fases de Implementación](#5-fases-de-implementación)
6. [Especificaciones Técnicas](#6-especificaciones-técnicas)
7. [Integración con LangGraph](#7-integración-con-langgraph)
8. [Esquema de Base de Datos](#8-esquema-de-base-de-datos)
9. [API Endpoints](#9-api-endpoints)
10. [Componentes de UI](#10-componentes-de-ui)
11. [Sistema de Scopes y Permisos](#11-sistema-de-scopes-y-permisos)
12. [Seguridad](#12-seguridad)
13. [Testing](#13-testing)
14. [Checklist de Implementación](#14-checklist-de-implementación)

---

## 1. Resumen Ejecutivo

### 1.1 Objetivo
Implementar una nueva pestaña **"API"** en la sección de Configuración de TIS TIS Platform que permita a los usuarios:
- Generar y gestionar API Keys de manera segura
- Configurar permisos granulares por scope
- Monitorear el uso de la API
- Acceder a webhooks y documentación

### 1.2 Ubicación en la Navegación
```
Configuración
├── Mi Perfil
├── Canales
├── Pagos
├── Notificaciones
├── Facturación
├── Integraciones
├── 🔐 API          ← NUEVA PESTAÑA
└── Seguridad
```

### 1.3 Alcance
- **Verticales soportadas:** Dental y Restaurant (con scopes específicos por vertical)
- **Planes:** Disponible para Growth y Enterprise
- **Roles:** Solo `owner` y `admin` pueden gestionar API Keys

---

## 2. Investigación de Estándares de la Industria

### 2.1 Análisis Comparativo

| Característica | Stripe | OpenAI | SendGrid | **TIS TIS (Propuesto)** |
|---------------|--------|--------|----------|-------------------------|
| Prefijos de Key | `sk_live_`, `sk_test_` | `sk-proj-` | `SG.` | `tis_live_`, `tis_test_` |
| Permisos Granulares | Por recurso (R/W/N) | Por modelo | Por scope | Por vertical + recurso |
| Mostrar Key | 1 sola vez | 1 sola vez | 1 sola vez | 1 sola vez |
| Rotación | Manual + alertas | Manual | Manual | Manual + recomendación |
| Rate Limiting | Por cuenta | Por proyecto | Por cuenta | Por key + plan |
| Tracking de Uso | Por key | Por key | Por scope | Por key + endpoint |
| IP Whitelist | No | No | Sí | Sí (opcional) |
| Expiración | No | No | No | Sí (opcional) |

### 2.2 Fuentes de Referencia
- [Stripe API Keys Documentation](https://docs.stripe.com/keys)
- [Stripe Best Practices](https://docs.stripe.com/keys-best-practices)
- [OpenAI Production Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [SendGrid API Key Permissions](https://www.twilio.com/docs/sendgrid/api-reference/api-key-permissions)
- [API Keys Complete 2025 Guide](https://dev.to/hamd_writer_8c77d9c88c188/api-keys-the-complete-2025-guide-to-security-management-and-best-practices-3980)
- [Google Cloud API Keys Best Practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)

### 2.3 Mejores Prácticas Adoptadas

1. **Generación Segura:** Usar `crypto.randomBytes()` con 32+ bytes
2. **Nunca Almacenar Plain Text:** Solo hash SHA-256 en BD
3. **Mostrar Una Vez:** Key visible solo en creación
4. **Prefijos Descriptivos:** `tis_live_` y `tis_test_` para identificación rápida
5. **Permisos Granulares:** Scopes por recurso y acción (read/write)
6. **Rotación Regular:** Recomendación cada 90 días
7. **Audit Logging:** Registrar todas las operaciones
8. **Rate Limiting:** Por key y por plan

---

## 3. Arquitectura de TIS TIS

### 3.1 Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  Next.js 14 + React 18 + TypeScript + Tailwind CSS              │
│  Framer Motion + Zustand + React Hook Form                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES                                  │
│  Next.js API Routes + auth-helper.ts + rate-limit.ts            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI AGENTS (LangGraph)                         │
│  Supervisor → Vertical Router → Specialists → Finalize          │
│  State: TISTISAgentState + messagesStateReducer                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE                                    │
│  PostgreSQL + RLS + Row Level Security + pgvector               │
│  Auth + Storage + Edge Functions + Realtime                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Patrón de Autenticación

```typescript
// SIEMPRE usar auth-helper.ts para autenticación
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';

export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId, role } = authResult;
  // tenantId SIEMPRE disponible y validado
}
```

### 3.3 Patrón Multi-Tenant

```typescript
// SIEMPRE incluir tenant_id en queries
const { data } = await supabase
  .from('api_keys')
  .select('*')
  .eq('tenant_id', tenantId)  // CRÍTICO - nunca omitir
  .eq('is_active', true);
```

### 3.4 Estructura de Features

```
src/features/[feature]/
├── components/          # Componentes React
│   ├── MainComponent.tsx
│   └── index.ts         # Barrel exports
├── hooks/               # Custom hooks
│   └── useFeatureData.ts
├── services/            # API client
│   └── feature.service.ts
├── types/               # TypeScript interfaces
│   └── feature.types.ts
└── index.ts             # Public API
```

---

## 4. Diseño del Sistema de API Keys

### 4.1 Formato de API Key

```
tis_[environment]_[timestamp]_[random]
│    │             │          │
│    │             │          └── 24 caracteres aleatorios (crypto)
│    │             └── Unix timestamp (anti-colisión)
│    └── live | test
└── Prefijo TIS TIS

Ejemplo: tis_live_1737151234_a8f3b2c9d4e5f6g7h8i9j0k1
Longitud total: ~45 caracteres
```

### 4.2 Almacenamiento Seguro

```
┌─────────────────────────────────────────────────────────────────┐
│                    NUNCA ALMACENAMOS                             │
│                  LA KEY EN TEXTO PLANO                           │
└─────────────────────────────────────────────────────────────────┘

En Base de Datos:
┌──────────────────┬─────────────────────────────────────────────┐
│ Campo            │ Contenido                                    │
├──────────────────┼─────────────────────────────────────────────┤
│ key_hash         │ SHA-256 hash de la key completa              │
│ key_hint         │ Últimos 4 caracteres para identificación     │
│ key_prefix       │ "tis_live_" o "tis_test_" para display       │
└──────────────────┴─────────────────────────────────────────────┘

Al Usuario (solo en creación):
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️ Tu API Key (guárdala ahora, no la verás de nuevo):            │
│ tis_live_1737151234_a8f3b2c9d4e5f6g7h8i9j0k1                     │
│ [📋 Copiar]                                                       │
└──────────────────────────────────────────────────────────────────┘

En la lista de keys (después):
┌──────────────────────────────────────────────────────────────────┐
│ 🔑 Mi API Key Producción                                         │
│    tis_live_...j0k1                                              │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Flujo de Validación de API Key

```
Request con Header: Authorization: Bearer tis_live_xxx
                              │
                              ▼
                    ┌─────────────────┐
                    │ Extraer Key     │
                    │ del Header      │
                    └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Validar Formato │
                    │ (prefijo, long) │
                    └────────┬────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                ✗ Inválido          ✓ Válido
                    │                   │
                    ▼                   ▼
              401 Unauthorized  ┌─────────────────┐
                                │ Calcular Hash   │
                                │ SHA-256         │
                                └────────┬────────┘
                                          │
                                          ▼
                                ┌─────────────────┐
                                │ Buscar en BD    │
                                │ por key_hash    │
                                └────────┬────────┘
                                          │
                                ┌─────────┴─────────┐
                                │                   │
                            No existe           Existe
                                │                   │
                                ▼                   ▼
                          401 Invalid       ┌─────────────────┐
                                            │ Verificar:      │
                                            │ - is_active     │
                                            │ - expires_at    │
                                            │ - ip_whitelist  │
                                            └────────┬────────┘
                                                      │
                                            ┌─────────┴─────────┐
                                            │                   │
                                        ✗ Falló            ✓ Pasó
                                            │                   │
                                            ▼                   ▼
                                      403 Forbidden   ┌─────────────────┐
                                                      │ Verificar Scope │
                                                      │ para endpoint   │
                                                      └────────┬────────┘
                                                                │
                                                      ┌─────────┴─────────┐
                                                      │                   │
                                                  Sin permiso        Con permiso
                                                      │                   │
                                                      ▼                   ▼
                                                403 Forbidden   ┌─────────────────┐
                                                                │ Rate Limit      │
                                                                │ Check           │
                                                                └────────┬────────┘
                                                                          │
                                                                ┌─────────┴─────────┐
                                                                │                   │
                                                            Excedido          OK
                                                                │                   │
                                                                ▼                   ▼
                                                          429 Too Many    ✓ PROCESAR
                                                          Requests          REQUEST
```

---

## 5. Fases de Implementación

### FASE 1: Infraestructura de Base de Datos
**Duración estimada:** 1 día
**Prioridad:** 🔴 Crítica

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 1.1 | Crear migración para tabla `api_keys` | `supabase/migrations/136_API_KEYS_SYSTEM.sql` |
| 1.2 | Crear tabla `api_key_usage_logs` | Incluido en 136 |
| 1.3 | Implementar RLS policies | Incluido en 136 |
| 1.4 | Crear funciones RPC para estadísticas | Incluido en 136 |

### FASE 2: API Backend
**Duración estimada:** 2 días
**Prioridad:** 🔴 Crítica

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 2.1 | Endpoint GET `/api/settings/api-keys` | `app/api/settings/api-keys/route.ts` |
| 2.2 | Endpoint POST (crear key) | Incluido en route.ts |
| 2.3 | Endpoint DELETE (revocar) | `app/api/settings/api-keys/[id]/route.ts` |
| 2.4 | Endpoint PATCH (actualizar) | Incluido en [id]/route.ts |
| 2.5 | Endpoint GET usage stats | `app/api/settings/api-keys/[id]/usage/route.ts` |

### FASE 3: Sistema de Scopes
**Duración estimada:** 1 día
**Prioridad:** 🔴 Crítica

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 3.1 | Definir scopes comunes | `src/features/api-settings/constants/scopes.ts` |
| 3.2 | Definir scopes por vertical | Incluido en scopes.ts |
| 3.3 | Crear validador de scopes | `src/features/api-settings/utils/scopeValidator.ts` |

### FASE 4: Middleware de Autenticación
**Duración estimada:** 2 días
**Prioridad:** 🔴 Crítica

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 4.1 | Crear middleware de API Key | `src/shared/lib/api-key-auth.ts` |
| 4.2 | Implementar rate limiting por key | `src/shared/lib/api-key-rate-limit.ts` |
| 4.3 | Crear logger de uso | `src/shared/lib/api-key-logger.ts` |
| 4.4 | Integrar con rutas públicas | Modificar rutas existentes |

### FASE 5: Componentes de UI
**Duración estimada:** 3 días
**Prioridad:** 🔴 Crítica

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 5.1 | Crear estructura de feature | `src/features/api-settings/` |
| 5.2 | Componente APISettingsTab | `components/APISettingsTab.tsx` |
| 5.3 | Componente APIKeysList | `components/APIKeysList.tsx` |
| 5.4 | Componente APIKeyCard | `components/APIKeyCard.tsx` |
| 5.5 | Modal CreateAPIKey | `components/CreateAPIKeyModal.tsx` |
| 5.6 | Modal APIKeyCreated | `components/APIKeyCreatedModal.tsx` |
| 5.7 | Drawer APIKeyDetails | `components/APIKeyDetailsDrawer.tsx` |
| 5.8 | Selector de Scopes | `components/APIScopesSelector.tsx` |
| 5.9 | Gráfico de uso | `components/APIUsageChart.tsx` |

### FASE 6: Integración con Settings
**Duración estimada:** 0.5 días
**Prioridad:** 🟡 Alta

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 6.1 | Agregar tab "API" a Settings | `app/(dashboard)/dashboard/settings/page.tsx` |
| 6.2 | Migrar Webhook URL de Integraciones | Mover a nueva pestaña |
| 6.3 | Agregar Tenant ID display | En nueva pestaña |

### FASE 7: Documentación API
**Duración estimada:** 1 día
**Prioridad:** 🟡 Alta

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 7.1 | Crear página de docs inline | `components/APIDocumentation.tsx` |
| 7.2 | Ejemplos de código | Incluido en componente |
| 7.3 | Sandbox de pruebas | `components/APISandbox.tsx` |

### FASE 8: Seguridad y Auditoría
**Duración estimada:** 1 día
**Prioridad:** 🟢 Media

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 8.1 | Implementar audit log | `src/features/api-settings/services/auditLog.ts` |
| 8.2 | Alertas de seguridad | `src/features/api-settings/utils/securityAlerts.ts` |
| 8.3 | Rotación de keys | UI + Backend |

### FASE 9: Testing
**Duración estimada:** 1 día
**Prioridad:** 🟢 Media

| Microfase | Descripción | Archivos |
|-----------|-------------|----------|
| 9.1 | Tests unitarios | `__tests__/api-settings/` |
| 9.2 | Tests de integración | `__tests__/api/api-keys.test.ts` |
| 9.3 | Tests E2E | Cypress/Playwright specs |

---

## 6. Especificaciones Técnicas

### 6.1 Estructura de Archivos

```
src/features/api-settings/
├── components/
│   ├── APISettingsTab.tsx           # Tab principal (contenedor)
│   ├── APIKeysList.tsx              # Lista de keys
│   ├── APIKeyCard.tsx               # Card individual de key
│   ├── CreateAPIKeyModal.tsx        # Modal de creación
│   ├── APIKeyCreatedModal.tsx       # Modal post-creación (muestra key)
│   ├── APIKeyDetailsDrawer.tsx      # Drawer con detalles y uso
│   ├── APIScopesSelector.tsx        # Selector de permisos
│   ├── APIUsageChart.tsx            # Gráfico de uso
│   ├── WebhookUrlDisplay.tsx        # Display de webhook URL
│   ├── APIDocumentation.tsx         # Documentación inline
│   ├── APISandbox.tsx               # Sandbox de pruebas
│   └── index.ts                     # Barrel exports
│
├── hooks/
│   ├── useAPIKeys.ts                # Hook para CRUD de keys
│   ├── useAPIKeyUsage.ts            # Hook para estadísticas
│   └── index.ts
│
├── services/
│   ├── apiKeys.service.ts           # API client para keys
│   ├── auditLog.service.ts          # Logging de operaciones
│   └── index.ts
│
├── types/
│   ├── apiKey.types.ts              # Interfaces de API Key
│   ├── scope.types.ts               # Interfaces de Scopes
│   ├── usage.types.ts               # Interfaces de Usage
│   └── index.ts
│
├── constants/
│   ├── scopes.ts                    # Definición de scopes
│   ├── rateLimits.ts                # Límites por plan
│   └── index.ts
│
├── utils/
│   ├── scopeValidator.ts            # Validación de scopes
│   ├── keyGenerator.ts              # Generación segura de keys
│   ├── securityAlerts.ts            # Alertas de seguridad
│   └── index.ts
│
└── index.ts                         # Public API
```

### 6.2 API Routes

```
app/api/settings/api-keys/
├── route.ts                         # GET (list), POST (create)
├── [id]/
│   ├── route.ts                     # GET (detail), PATCH (update), DELETE (revoke)
│   └── usage/
│       └── route.ts                 # GET (usage statistics)
```

### 6.3 Base de Datos

```
supabase/migrations/
└── 136_API_KEYS_SYSTEM.sql          # Tablas, RLS, funciones
```

---

## 7. Integración con LangGraph

### 7.1 API Keys para Acceso a Agentes

Las API Keys de TIS TIS permitirán acceso programático a los agentes de IA:

```
External System
      │
      ▼
┌─────────────────┐
│ API Request     │
│ Authorization:  │
│ Bearer tis_...  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API Key         │
│ Middleware      │
│ (validate,      │
│  rate limit)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ /api/v1/chat    │
│ Route           │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH AGENT SYSTEM                        │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ SUPERVISOR  │───▶│  VERTICAL   │───▶│ SPECIALISTS │         │
│  │  (intent)   │    │   ROUTER    │    │ (greeting,  │         │
│  └─────────────┘    └─────────────┘    │  pricing,   │         │
│                                         │  booking,   │         │
│                                         │  faq...)    │         │
│                                         └──────┬──────┘         │
│                                                │                 │
│  ┌─────────────────────────────────────────────┴──────────┐     │
│  │                   TISTISAgentState                      │     │
│  │  messages[], tenant, lead, conversation, agent_trace    │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Response        │
│ (AI-generated)  │
└─────────────────┘
```

### 7.2 Scopes Relacionados con Agentes

```typescript
// Scopes para interacción con agentes AI
const AI_SCOPES = {
  'ai:chat': 'Enviar mensajes al agente AI',
  'ai:chat:read': 'Leer historial de conversaciones AI',
  'ai:config:read': 'Leer configuración del agente',
  'ai:config:write': 'Modificar configuración del agente',
  'ai:knowledge:read': 'Acceder a base de conocimiento',
  'ai:knowledge:write': 'Modificar base de conocimiento',
};
```

### 7.3 Estado del Agente Accesible via API

```typescript
// Datos accesibles via API según scopes
interface APIAccessibleState {
  // Con scope 'ai:chat:read'
  conversation_id: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;

  // Con scope 'leads:read'
  lead?: {
    id: string;
    name: string;
    phone: string;
    classification: string;
  };

  // Con scope 'ai:config:read'
  agent_config?: {
    personality: string;
    response_style: string;
    max_turns_before_escalation: number;
  };
}
```

---

## 8. Esquema de Base de Datos

### 8.1 Tabla `api_keys`

```sql
-- =====================================================
-- TIS TIS PLATFORM - API Keys System
-- Migration: 136_API_KEYS_SYSTEM.sql
-- =====================================================

-- Tabla principal de API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),

    -- Identificación
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Key (seguridad)
    key_hash VARCHAR(64) NOT NULL,          -- SHA-256 hash
    key_hint VARCHAR(8) NOT NULL,           -- Últimos 4 chars: "...a4f7"
    key_prefix VARCHAR(20) NOT NULL,        -- "tis_live_" o "tis_test_"
    environment VARCHAR(10) NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),

    -- Permisos
    scopes JSONB NOT NULL DEFAULT '[]',     -- Array de scopes permitidos

    -- Rate Limiting
    rate_limit_rpm INTEGER DEFAULT 60,      -- Requests por minuto
    rate_limit_daily INTEGER DEFAULT 10000, -- Requests por día

    -- Restricciones opcionales
    ip_whitelist TEXT[],                    -- IPs permitidas (null = todas)
    expires_at TIMESTAMPTZ,                 -- Expiración opcional

    -- Tracking
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,
    usage_count BIGINT DEFAULT 0,

    -- Estado
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id),
    revoke_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    UNIQUE(tenant_id, name),
    UNIQUE(key_hash)
);

-- Índices
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(tenant_id, is_active);
CREATE INDEX idx_api_keys_env ON api_keys(tenant_id, environment);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_tenant_isolation" ON api_keys
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);
```

### 8.2 Tabla `api_key_usage_logs`

```sql
-- Logs de uso de API Keys
CREATE TABLE api_key_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Request info
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    scope_used VARCHAR(100),

    -- Response info
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,

    -- Client info
    ip_address INET,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para queries de estadísticas
CREATE INDEX idx_usage_logs_key ON api_key_usage_logs(api_key_id);
CREATE INDEX idx_usage_logs_tenant ON api_key_usage_logs(tenant_id);
CREATE INDEX idx_usage_logs_created ON api_key_usage_logs(created_at);
CREATE INDEX idx_usage_logs_endpoint ON api_key_usage_logs(endpoint);

-- Particionamiento por fecha (para performance)
-- CREATE INDEX idx_usage_logs_month ON api_key_usage_logs(date_trunc('month', created_at));

-- RLS
ALTER TABLE api_key_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_logs_tenant_isolation" ON api_key_usage_logs
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);
```

### 8.3 Funciones RPC

```sql
-- Estadísticas de uso de una API Key
CREATE OR REPLACE FUNCTION get_api_key_usage_stats(
    p_api_key_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_requests', COUNT(*),
        'successful_requests', COUNT(*) FILTER (WHERE status_code < 400),
        'failed_requests', COUNT(*) FILTER (WHERE status_code >= 400),
        'avg_response_time_ms', ROUND(AVG(response_time_ms)),
        'requests_by_endpoint', (
            SELECT json_agg(row_to_json(e))
            FROM (
                SELECT endpoint, COUNT(*) as count
                FROM api_key_usage_logs
                WHERE api_key_id = p_api_key_id
                AND created_at >= NOW() - (p_days || ' days')::INTERVAL
                GROUP BY endpoint
                ORDER BY count DESC
                LIMIT 10
            ) e
        ),
        'requests_by_day', (
            SELECT json_agg(row_to_json(d))
            FROM (
                SELECT date_trunc('day', created_at)::date as date, COUNT(*) as count
                FROM api_key_usage_logs
                WHERE api_key_id = p_api_key_id
                AND created_at >= NOW() - (p_days || ' days')::INTERVAL
                GROUP BY date_trunc('day', created_at)
                ORDER BY date
            ) d
        )
    ) INTO result
    FROM api_key_usage_logs
    WHERE api_key_id = p_api_key_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

    RETURN result;
END;
$$;

-- Verificar rate limit de una API Key
CREATE OR REPLACE FUNCTION check_api_key_rate_limit(
    p_api_key_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    key_record RECORD;
    requests_minute INTEGER;
    requests_today INTEGER;
    result JSON;
BEGIN
    -- Obtener configuración de la key
    SELECT rate_limit_rpm, rate_limit_daily
    INTO key_record
    FROM api_keys
    WHERE id = p_api_key_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN json_build_object('allowed', false, 'reason', 'key_not_found');
    END IF;

    -- Contar requests en el último minuto
    SELECT COUNT(*)
    INTO requests_minute
    FROM api_key_usage_logs
    WHERE api_key_id = p_api_key_id
    AND created_at >= NOW() - INTERVAL '1 minute';

    -- Contar requests hoy
    SELECT COUNT(*)
    INTO requests_today
    FROM api_key_usage_logs
    WHERE api_key_id = p_api_key_id
    AND created_at >= date_trunc('day', NOW());

    -- Verificar límites
    IF requests_minute >= key_record.rate_limit_rpm THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'rate_limit_minute',
            'limit', key_record.rate_limit_rpm,
            'current', requests_minute,
            'retry_after_seconds', 60
        );
    END IF;

    IF requests_today >= key_record.rate_limit_daily THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'rate_limit_daily',
            'limit', key_record.rate_limit_daily,
            'current', requests_today,
            'retry_after_seconds', EXTRACT(EPOCH FROM (date_trunc('day', NOW()) + INTERVAL '1 day' - NOW()))
        );
    END IF;

    RETURN json_build_object(
        'allowed', true,
        'remaining_minute', key_record.rate_limit_rpm - requests_minute,
        'remaining_daily', key_record.rate_limit_daily - requests_today
    );
END;
$$;
```

---

## 9. API Endpoints

### 9.1 GET `/api/settings/api-keys`

**Descripción:** Lista todas las API Keys del tenant

**Headers:**
```
Authorization: Bearer {supabase_access_token}
```

**Response:**
```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "Production Key",
      "description": "Main API key for production",
      "key_hint": "...a4f7",
      "key_prefix": "tis_live_",
      "environment": "live",
      "scopes": ["leads:read", "leads:write", "appointments:read"],
      "rate_limit_rpm": 60,
      "rate_limit_daily": 10000,
      "is_active": true,
      "last_used_at": "2026-01-17T10:30:00Z",
      "usage_count": 1234,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### 9.2 POST `/api/settings/api-keys`

**Descripción:** Crea una nueva API Key

**Request:**
```json
{
  "name": "My API Key",
  "description": "Optional description",
  "environment": "live",
  "scopes": ["leads:read", "leads:write"],
  "rate_limit_rpm": 60,
  "rate_limit_daily": 10000,
  "ip_whitelist": ["192.168.1.1"],
  "expires_at": "2027-01-01T00:00:00Z"
}
```

**Response (201):**
```json
{
  "key": {
    "id": "uuid",
    "name": "My API Key",
    "key_hint": "...b2c9",
    "key_prefix": "tis_live_",
    "scopes": ["leads:read", "leads:write"],
    "created_at": "2026-01-17T12:00:00Z"
  },
  "api_key_secret": "tis_live_1737151234_a8f3b2c9d4e5f6g7h8i9j0k1",
  "message": "Guarda esta key de forma segura. No la volverás a ver."
}
```

### 9.3 GET `/api/settings/api-keys/[id]`

**Descripción:** Obtiene detalles de una API Key

**Response:**
```json
{
  "key": {
    "id": "uuid",
    "name": "Production Key",
    "description": "Main API key",
    "key_hint": "...a4f7",
    "key_prefix": "tis_live_",
    "environment": "live",
    "scopes": ["leads:read", "leads:write"],
    "rate_limit_rpm": 60,
    "rate_limit_daily": 10000,
    "ip_whitelist": null,
    "expires_at": null,
    "is_active": true,
    "last_used_at": "2026-01-17T10:30:00Z",
    "last_used_ip": "192.168.1.100",
    "usage_count": 1234,
    "created_at": "2026-01-01T00:00:00Z",
    "created_by": {
      "email": "user@example.com"
    }
  }
}
```

### 9.4 PATCH `/api/settings/api-keys/[id]`

**Descripción:** Actualiza una API Key (no la key misma)

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "scopes": ["leads:read"],
  "rate_limit_rpm": 100,
  "ip_whitelist": ["10.0.0.1", "10.0.0.2"]
}
```

**Response:**
```json
{
  "key": {
    "id": "uuid",
    "name": "Updated Name",
    "scopes": ["leads:read"],
    "updated_at": "2026-01-17T12:00:00Z"
  }
}
```

### 9.5 DELETE `/api/settings/api-keys/[id]`

**Descripción:** Revoca una API Key (soft delete)

**Request:**
```json
{
  "reason": "Key compromised"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API Key revocada exitosamente"
}
```

### 9.6 GET `/api/settings/api-keys/[id]/usage`

**Descripción:** Obtiene estadísticas de uso

**Query Params:**
- `days`: Número de días (default: 30)

**Response:**
```json
{
  "stats": {
    "total_requests": 5000,
    "successful_requests": 4900,
    "failed_requests": 100,
    "avg_response_time_ms": 150,
    "requests_by_endpoint": [
      { "endpoint": "/api/v1/leads", "count": 3000 },
      { "endpoint": "/api/v1/appointments", "count": 2000 }
    ],
    "requests_by_day": [
      { "date": "2026-01-15", "count": 500 },
      { "date": "2026-01-16", "count": 600 },
      { "date": "2026-01-17", "count": 400 }
    ]
  }
}
```

---

## 10. Componentes de UI

### 10.1 Diseño de la Pestaña API

```
┌─────────────────────────────────────────────────────────────────┐
│  🔐 API de TIS TIS                                              │
│  Gestiona tus API Keys y acceso programático a la plataforma    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📖 Documentación                              [Ver Docs →] │  │
│  │ Aprende a integrar TIS TIS con tus sistemas               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─── API Keys ────────────────────────── [+ Crear API Key] ─── │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔑 Producción Principal                    [Activa] ✅    │  │
│  │    tis_live_...a4f7                                       │  │
│  │                                                           │  │
│  │    Permisos: leads:read, leads:write, appointments:read   │  │
│  │    Último uso: hace 2 horas • 1,234 requests este mes     │  │
│  │                                                           │  │
│  │    [Ver detalles]  [Editar permisos]  [🗑️ Revocar]       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔑 Desarrollo                              [Activa] ✅    │  │
│  │    tis_test_...b2c9                                       │  │
│  │                                                           │  │
│  │    Permisos: Full Access (ambiente test)                  │  │
│  │    Último uso: hace 5 min • 89 requests este mes          │  │
│  │                                                           │  │
│  │    [Ver detalles]  [Editar permisos]  [🗑️ Revocar]       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─── Información de Integración ─────────────────────────────  │
│                                                                 │
│  Webhook URL                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ https://api.tistis.ai/v1/webhook/c8d6d7e9-9a92-4ff...   │📋│
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Tenant ID                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 0641046e-a4d5-4b15-89c3-8518f6c8e019                    │📋│
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─── Rate Limits ──────────────────────────────────────────── │
│                                                                 │
│  Tu Plan: Growth                                                │
│  • 10,000 requests/día por key                                 │
│  • 100 requests/minuto por key                                 │
│                                                                 │
│  Uso este mes: 45,230 / 300,000 (15%)                          │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 15%        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Modal de Creación de API Key

```
┌─────────────────────────────────────────────────────────────────┐
│  Crear nueva API Key                                       [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nombre *                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Mi API Key de Producción                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Descripción                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Integración con sistema externo XYZ                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Ambiente                                                       │
│  ○ Live (producción)    ● Test (desarrollo)                    │
│                                                                 │
│  ─── Permisos ──────────────────────────────────────────────── │
│                                                                 │
│  📋 Leads                                                       │
│  ☑ leads:read     Leer información de leads                    │
│  ☑ leads:write    Crear y actualizar leads                     │
│                                                                 │
│  📅 Citas                                                       │
│  ☑ appointments:read     Leer citas                            │
│  ☐ appointments:write    Crear y modificar citas               │
│                                                                 │
│  💬 Conversaciones                                              │
│  ☐ conversations:read    Leer conversaciones                   │
│  ☐ conversations:write   Enviar mensajes                       │
│                                                                 │
│  🤖 AI Agent                                                    │
│  ☐ ai:chat              Enviar mensajes al agente              │
│  ☐ ai:chat:read         Leer historial de conversaciones       │
│                                                                 │
│  ─── Opciones Avanzadas ──────────────────────── [▼ Mostrar]── │
│                                                                 │
│  Rate Limit (requests/minuto)                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 60                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  IP Whitelist (opcional, separadas por coma)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  Dejar vacío para permitir cualquier IP                        │
│                                                                 │
│  Fecha de expiración (opcional)                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Seleccionar fecha...                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                     [Cancelar]  [Crear API Key] │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 Modal Post-Creación (Mostrar Key)

```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ API Key creada exitosamente                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️ IMPORTANTE: Guarda esta key ahora.                          │
│     No podrás verla de nuevo después de cerrar esta ventana.    │
│                                                                 │
│  Tu API Key:                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ tis_live_1737151234_a8f3b2c9d4e5f6g7h8i9j0k1l2m3n4o5   │📋│
│  └──────────────────────────────────────────────────────────┘  │
│                              ✓ Copiada al portapapeles         │
│                                                                 │
│  ☐ Confirmo que he guardado esta API Key de forma segura       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                          [Listo] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Sistema de Scopes y Permisos

### 11.1 Scopes Comunes (Todas las Verticales)

```typescript
// src/features/api-settings/constants/scopes.ts

export const COMMON_SCOPES = {
  // Leads
  'leads:read': {
    name: 'Leer leads',
    description: 'Acceso de lectura a información de leads',
    category: 'leads',
  },
  'leads:write': {
    name: 'Escribir leads',
    description: 'Crear y actualizar leads',
    category: 'leads',
  },

  // Conversaciones
  'conversations:read': {
    name: 'Leer conversaciones',
    description: 'Acceso de lectura al historial de mensajes',
    category: 'conversations',
  },
  'conversations:write': {
    name: 'Enviar mensajes',
    description: 'Enviar mensajes en conversaciones',
    category: 'conversations',
  },

  // Citas
  'appointments:read': {
    name: 'Leer citas',
    description: 'Acceso de lectura a citas',
    category: 'appointments',
  },
  'appointments:write': {
    name: 'Gestionar citas',
    description: 'Crear, modificar y cancelar citas',
    category: 'appointments',
  },

  // Webhooks
  'webhooks:manage': {
    name: 'Gestionar webhooks',
    description: 'Configurar webhooks y endpoints',
    category: 'webhooks',
  },

  // Analytics
  'analytics:read': {
    name: 'Leer analytics',
    description: 'Acceso a métricas y reportes',
    category: 'analytics',
  },

  // AI
  'ai:chat': {
    name: 'Chat con AI',
    description: 'Enviar mensajes al agente de IA',
    category: 'ai',
  },
  'ai:chat:read': {
    name: 'Leer chat AI',
    description: 'Leer historial de conversaciones con AI',
    category: 'ai',
  },
};
```

### 11.2 Scopes para Vertical DENTAL

```typescript
export const DENTAL_SCOPES = {
  // Pacientes
  'patients:read': {
    name: 'Leer pacientes',
    description: 'Acceso de lectura a información de pacientes',
    category: 'patients',
    vertical: 'dental',
  },
  'patients:write': {
    name: 'Gestionar pacientes',
    description: 'Crear y actualizar pacientes',
    category: 'patients',
    vertical: 'dental',
  },

  // Tratamientos
  'treatments:read': {
    name: 'Leer tratamientos',
    description: 'Acceso de lectura a tratamientos',
    category: 'treatments',
    vertical: 'dental',
  },

  // Cotizaciones
  'quotes:read': {
    name: 'Leer cotizaciones',
    description: 'Acceso de lectura a cotizaciones',
    category: 'quotes',
    vertical: 'dental',
  },
  'quotes:write': {
    name: 'Gestionar cotizaciones',
    description: 'Crear y modificar cotizaciones',
    category: 'quotes',
    vertical: 'dental',
  },
};
```

### 11.3 Scopes para Vertical RESTAURANT

```typescript
export const RESTAURANT_SCOPES = {
  // Menú
  'menu:read': {
    name: 'Leer menú',
    description: 'Acceso de lectura al menú',
    category: 'menu',
    vertical: 'restaurant',
  },
  'menu:write': {
    name: 'Modificar menú',
    description: 'Crear y actualizar items del menú',
    category: 'menu',
    vertical: 'restaurant',
  },

  // Pedidos
  'orders:read': {
    name: 'Leer pedidos',
    description: 'Acceso de lectura a pedidos',
    category: 'orders',
    vertical: 'restaurant',
  },
  'orders:write': {
    name: 'Gestionar pedidos',
    description: 'Crear y modificar pedidos',
    category: 'orders',
    vertical: 'restaurant',
  },

  // Inventario
  'inventory:read': {
    name: 'Leer inventario',
    description: 'Acceso de lectura a inventario',
    category: 'inventory',
    vertical: 'restaurant',
  },
  'inventory:write': {
    name: 'Gestionar inventario',
    description: 'Modificar cantidades de inventario',
    category: 'inventory',
    vertical: 'restaurant',
  },

  // Mesas
  'tables:read': {
    name: 'Leer mesas',
    description: 'Ver estado de mesas',
    category: 'tables',
    vertical: 'restaurant',
  },
  'tables:write': {
    name: 'Gestionar mesas',
    description: 'Modificar estado de mesas',
    category: 'tables',
    vertical: 'restaurant',
  },

  // Cocina
  'kitchen:read': {
    name: 'Ver cocina',
    description: 'Ver estado de pedidos en cocina',
    category: 'kitchen',
    vertical: 'restaurant',
  },
};
```

### 11.4 Función para Obtener Scopes por Vertical

```typescript
// src/features/api-settings/utils/getScopesForVertical.ts

export function getScopesForVertical(vertical: string): ScopeDefinition[] {
  const scopes = { ...COMMON_SCOPES };

  switch (vertical) {
    case 'dental':
      return { ...scopes, ...DENTAL_SCOPES };
    case 'restaurant':
      return { ...scopes, ...RESTAURANT_SCOPES };
    default:
      return scopes;
  }
}

export function groupScopesByCategory(scopes: ScopeDefinition[]): GroupedScopes {
  return Object.entries(scopes).reduce((groups, [key, scope]) => {
    const category = scope.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({ key, ...scope });
    return groups;
  }, {} as GroupedScopes);
}
```

---

## 12. Seguridad

### 12.1 Generación de API Keys

```typescript
// src/features/api-settings/utils/keyGenerator.ts

import crypto from 'crypto';

export function generateAPIKey(environment: 'live' | 'test'): {
  key: string;
  hash: string;
  hint: string;
  prefix: string;
} {
  const prefix = `tis_${environment}_`;
  const timestamp = Date.now().toString(36); // Base36 para compactness
  const random = crypto.randomBytes(24).toString('hex'); // 48 chars hex

  const key = `${prefix}${timestamp}_${random}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const hint = key.slice(-4); // Últimos 4 caracteres

  return {
    key,
    hash,
    hint: `...${hint}`,
    prefix,
  };
}

export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function validateAPIKeyFormat(key: string): boolean {
  // tis_live_1234567890_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  // tis_test_1234567890_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  const regex = /^tis_(live|test)_[a-z0-9]+_[a-f0-9]{48}$/;
  return regex.test(key);
}
```

### 12.2 Middleware de Autenticación API

```typescript
// src/shared/lib/api-key-auth.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashAPIKey, validateAPIKeyFormat } from '@/src/features/api-settings/utils/keyGenerator';

interface APIKeyAuthResult {
  success: boolean;
  tenantId?: string;
  scopes?: string[];
  keyId?: string;
  error?: string;
  statusCode?: number;
}

export async function authenticateAPIKey(
  request: NextRequest,
  requiredScope?: string
): Promise<APIKeyAuthResult> {
  // 1. Extraer key del header
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing or invalid Authorization header',
      statusCode: 401,
    };
  }

  const apiKey = authHeader.slice(7); // Remover "Bearer "

  // 2. Validar formato
  if (!validateAPIKeyFormat(apiKey)) {
    return {
      success: false,
      error: 'Invalid API key format',
      statusCode: 401,
    };
  }

  // 3. Hashear y buscar
  const keyHash = hashAPIKey(apiKey);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: keyRecord, error } = await supabase
    .from('api_keys')
    .select('id, tenant_id, scopes, rate_limit_rpm, rate_limit_daily, ip_whitelist, expires_at, is_active')
    .eq('key_hash', keyHash)
    .single();

  if (error || !keyRecord) {
    return {
      success: false,
      error: 'Invalid API key',
      statusCode: 401,
    };
  }

  // 4. Verificar estado
  if (!keyRecord.is_active) {
    return {
      success: false,
      error: 'API key has been revoked',
      statusCode: 401,
    };
  }

  // 5. Verificar expiración
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return {
      success: false,
      error: 'API key has expired',
      statusCode: 401,
    };
  }

  // 6. Verificar IP whitelist
  if (keyRecord.ip_whitelist?.length > 0) {
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip');

    if (clientIP && !keyRecord.ip_whitelist.includes(clientIP)) {
      return {
        success: false,
        error: 'IP address not allowed',
        statusCode: 403,
      };
    }
  }

  // 7. Verificar scope (si se requiere)
  if (requiredScope && !keyRecord.scopes.includes(requiredScope)) {
    return {
      success: false,
      error: `Missing required scope: ${requiredScope}`,
      statusCode: 403,
    };
  }

  // 8. Actualizar last_used_at (async, no bloquear)
  supabase
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      last_used_ip: request.headers.get('x-forwarded-for')?.split(',')[0],
      usage_count: keyRecord.usage_count + 1,
    })
    .eq('id', keyRecord.id)
    .then(() => {});

  return {
    success: true,
    tenantId: keyRecord.tenant_id,
    scopes: keyRecord.scopes,
    keyId: keyRecord.id,
  };
}

// Helper para crear responses de error
export function createAPIKeyErrorResponse(result: APIKeyAuthResult): NextResponse {
  return NextResponse.json(
    { error: result.error },
    {
      status: result.statusCode || 500,
      headers: {
        'WWW-Authenticate': 'Bearer',
      },
    }
  );
}
```

### 12.3 Rate Limiting por API Key

```typescript
// src/shared/lib/api-key-rate-limit.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  error?: string;
}

export async function checkAPIKeyRateLimit(
  keyId: string,
  request: NextRequest
): Promise<RateLimitResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.rpc('check_api_key_rate_limit', {
    p_api_key_id: keyId,
  });

  if (!data.allowed) {
    return {
      allowed: false,
      remaining: 0,
      reset: data.retry_after_seconds,
      limit: data.limit,
      error: data.reason,
    };
  }

  return {
    allowed: true,
    remaining: data.remaining_minute,
    reset: 60,
    limit: data.limit || 60,
  };
}

export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  return response;
}

export function createRateLimitExceededResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retry_after: result.reset,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.reset.toString(),
        'Retry-After': result.reset.toString(),
      },
    }
  );
}
```

### 12.4 Logging de Uso

```typescript
// src/shared/lib/api-key-logger.ts

import { createClient } from '@supabase/supabase-js';

interface LogEntry {
  api_key_id: string;
  tenant_id: string;
  endpoint: string;
  method: string;
  scope_used?: string;
  status_code: number;
  response_time_ms: number;
  ip_address?: string;
  user_agent?: string;
  error_message?: string;
}

// Buffer para batch inserts
const logBuffer: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export function logAPIKeyUsage(entry: LogEntry): void {
  logBuffer.push(entry);

  // Flush cada 5 segundos o cada 100 entries
  if (logBuffer.length >= 100) {
    flushLogs();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, 5000);
  }
}

async function flushLogs(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (logBuffer.length === 0) return;

  const entries = [...logBuffer];
  logBuffer.length = 0;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    await supabase.from('api_key_usage_logs').insert(entries);
  } catch (error) {
    console.error('[API Key Logger] Error flushing logs:', error);
    // Re-add entries to buffer for retry
    logBuffer.push(...entries);
  }
}

// Flush on process exit
process.on('beforeExit', flushLogs);
```

---

## 13. Testing

### 13.1 Tests Unitarios

```typescript
// __tests__/api-settings/keyGenerator.test.ts

import { generateAPIKey, hashAPIKey, validateAPIKeyFormat } from '@/src/features/api-settings/utils/keyGenerator';

describe('API Key Generator', () => {
  describe('generateAPIKey', () => {
    it('should generate a live key with correct prefix', () => {
      const result = generateAPIKey('live');
      expect(result.key).toMatch(/^tis_live_/);
      expect(result.prefix).toBe('tis_live_');
    });

    it('should generate a test key with correct prefix', () => {
      const result = generateAPIKey('test');
      expect(result.key).toMatch(/^tis_test_/);
      expect(result.prefix).toBe('tis_test_');
    });

    it('should generate unique keys', () => {
      const key1 = generateAPIKey('live');
      const key2 = generateAPIKey('live');
      expect(key1.key).not.toBe(key2.key);
      expect(key1.hash).not.toBe(key2.hash);
    });

    it('should generate correct hint (last 4 chars)', () => {
      const result = generateAPIKey('live');
      const last4 = result.key.slice(-4);
      expect(result.hint).toBe(`...${last4}`);
    });
  });

  describe('hashAPIKey', () => {
    it('should produce consistent hash for same key', () => {
      const key = 'tis_live_test_123456';
      const hash1 = hashAPIKey(key);
      const hash2 = hashAPIKey(key);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashAPIKey('tis_live_key1');
      const hash2 = hashAPIKey('tis_live_key2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex hash (SHA-256)', () => {
      const hash = hashAPIKey('tis_live_test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('validateAPIKeyFormat', () => {
    it('should accept valid live key format', () => {
      const key = 'tis_live_abcd1234_' + 'a'.repeat(48);
      expect(validateAPIKeyFormat(key)).toBe(true);
    });

    it('should accept valid test key format', () => {
      const key = 'tis_test_abcd1234_' + 'b'.repeat(48);
      expect(validateAPIKeyFormat(key)).toBe(true);
    });

    it('should reject invalid prefix', () => {
      const key = 'invalid_live_abcd1234_' + 'a'.repeat(48);
      expect(validateAPIKeyFormat(key)).toBe(false);
    });

    it('should reject short random part', () => {
      const key = 'tis_live_abcd1234_' + 'a'.repeat(10);
      expect(validateAPIKeyFormat(key)).toBe(false);
    });
  });
});
```

### 13.2 Tests de Integración

```typescript
// __tests__/api/api-keys.test.ts

import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/settings/api-keys/route';

describe('API Keys Routes', () => {
  describe('GET /api/settings/api-keys', () => {
    it('should return 401 without auth', async () => {
      const { req } = createMocks({ method: 'GET' });
      const response = await GET(req as any);
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      // Mock authenticated user with 'user' role
      // ...
    });

    it('should return keys for admin users', async () => {
      // Mock authenticated admin user
      // ...
    });
  });

  describe('POST /api/settings/api-keys', () => {
    it('should create a new API key', async () => {
      // ...
    });

    it('should return the secret key only once', async () => {
      // ...
    });

    it('should hash the key before storing', async () => {
      // ...
    });
  });
});
```

---

## 14. Checklist de Implementación

### FASE 1: Base de Datos
- [ ] Crear migración `136_API_KEYS_SYSTEM.sql`
- [ ] Tabla `api_keys` con todos los campos
- [ ] Tabla `api_key_usage_logs`
- [ ] Índices para performance
- [ ] RLS policies
- [ ] Funciones RPC (`get_api_key_usage_stats`, `check_api_key_rate_limit`)
- [ ] Ejecutar migración en desarrollo
- [ ] Verificar en Supabase Studio

### FASE 2: Backend
- [ ] Crear `app/api/settings/api-keys/route.ts`
- [ ] Implementar GET (listar keys)
- [ ] Implementar POST (crear key)
- [ ] Crear `app/api/settings/api-keys/[id]/route.ts`
- [ ] Implementar GET (detalle)
- [ ] Implementar PATCH (actualizar)
- [ ] Implementar DELETE (revocar)
- [ ] Crear `app/api/settings/api-keys/[id]/usage/route.ts`
- [ ] Tests de API routes

### FASE 3: Scopes
- [ ] Crear `src/features/api-settings/constants/scopes.ts`
- [ ] Definir COMMON_SCOPES
- [ ] Definir DENTAL_SCOPES
- [ ] Definir RESTAURANT_SCOPES
- [ ] Crear `getScopesForVertical` utility
- [ ] Crear `groupScopesByCategory` utility

### FASE 4: Middleware
- [ ] Crear `src/shared/lib/api-key-auth.ts`
- [ ] Implementar `authenticateAPIKey`
- [ ] Crear `src/shared/lib/api-key-rate-limit.ts`
- [ ] Implementar rate limiting
- [ ] Crear `src/shared/lib/api-key-logger.ts`
- [ ] Implementar logging con batch inserts
- [ ] Tests de middleware

### FASE 5: UI
- [ ] Crear estructura `src/features/api-settings/`
- [ ] Types: `apiKey.types.ts`, `scope.types.ts`, `usage.types.ts`
- [ ] Service: `apiKeys.service.ts`
- [ ] Hook: `useAPIKeys.ts`
- [ ] Componente: `APISettingsTab.tsx`
- [ ] Componente: `APIKeysList.tsx`
- [ ] Componente: `APIKeyCard.tsx`
- [ ] Componente: `CreateAPIKeyModal.tsx`
- [ ] Componente: `APIKeyCreatedModal.tsx`
- [ ] Componente: `APIKeyDetailsDrawer.tsx`
- [ ] Componente: `APIScopesSelector.tsx`
- [ ] Componente: `APIUsageChart.tsx`
- [ ] Componente: `WebhookUrlDisplay.tsx`
- [ ] Barrel exports en `index.ts`

### FASE 6: Integración Settings
- [ ] Agregar tab "API" en settings page
- [ ] Agregar ícono apropiado
- [ ] Conectar con `APISettingsTab`
- [ ] Migrar Webhook URL display
- [ ] Agregar Tenant ID display
- [ ] Verificar responsive design

### FASE 7: Documentación
- [ ] Componente `APIDocumentation.tsx`
- [ ] Ejemplos de código (cURL, JS, Python)
- [ ] Componente `APISandbox.tsx` (opcional)
- [ ] Link a docs desde tab

### FASE 8: Seguridad
- [ ] Audit logging de operaciones
- [ ] Alertas de expiración próxima
- [ ] UI para rotación de keys
- [ ] Verificar que keys nunca se logueen

### FASE 9: Testing
- [ ] Tests unitarios de utilities
- [ ] Tests de integración de API routes
- [ ] Tests E2E del flujo completo
- [ ] Verificar en staging

### Deployment
- [ ] Ejecutar migración en producción
- [ ] Verificar RLS en producción
- [ ] Monitorear errores post-deploy
- [ ] Documentar en changelog

---

## Apéndice: Código de Referencia

### A. Ejemplo de Uso de API Key

```bash
# cURL
curl -X GET "https://api.tistis.ai/v1/leads" \
  -H "Authorization: Bearer tis_live_1737151234_a8f3b2c9d4e5f6g7h8i9j0k1l2m3n4o5"
```

```javascript
// JavaScript/Node.js
const response = await fetch('https://api.tistis.ai/v1/leads', {
  headers: {
    'Authorization': 'Bearer tis_live_1737151234_a8f3b2c9d4e5f6g7h8i9j0k1l2m3n4o5',
    'Content-Type': 'application/json',
  },
});

const leads = await response.json();
```

```python
# Python
import requests

headers = {
    'Authorization': 'Bearer tis_live_1737151234_a8f3b2c9d4e5f6g7h8i9j0k1l2m3n4o5',
    'Content-Type': 'application/json',
}

response = requests.get('https://api.tistis.ai/v1/leads', headers=headers)
leads = response.json()
```

### B. Respuestas de Error Estándar

```json
// 401 Unauthorized
{
  "error": "Invalid API key"
}

// 403 Forbidden
{
  "error": "Missing required scope: leads:write"
}

// 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

---

**Documento generado para TIS TIS Platform**
**Última actualización:** Enero 2026
