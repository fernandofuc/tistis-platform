# Especificación Maestra: TIS TIS Local Agent para Soft Restaurant

**Versión:** 1.0.0
**Estado:** Borrador para Aprobación
**Autor:** Claude Code (Anthropic)
**Fecha:** 30 de Enero, 2026
**Plataforma Target:** TIS TIS Platform v4.8.x

---

## Índice de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Mapa de Fases](#3-mapa-de-fases)
4. [FASE 1: UI/UX en Dashboard TIS TIS](#fase-1-uiux-en-dashboard-tis-tis)
5. [FASE 2: Infraestructura Backend](#fase-2-infraestructura-backend)
6. [FASE 3: Agente Windows - Core](#fase-3-agente-windows---core)
7. [FASE 4: Agente Windows - Instalador](#fase-4-agente-windows---instalador)
8. [FASE 5: Sincronización y Transformación](#fase-5-sincronización-y-transformación)
9. [FASE 6: Seguridad y Autenticación](#fase-6-seguridad-y-autenticación)
10. [FASE 7: Monitoreo y Observabilidad](#fase-7-monitoreo-y-observabilidad)
11. [FASE 8: Testing y QA](#fase-8-testing-y-qa)
12. [FASE 9: Documentación y Rollout](#fase-9-documentación-y-rollout)
13. [Apéndices](#apéndices)

---

## 1. Resumen Ejecutivo

### 1.1 Problema a Resolver

El módulo oficial "Interface para ERP y PMS" de National Soft tiene las siguientes limitaciones:

1. **Costo adicional** - Requiere compra de módulo separado
2. **Dependencia de tercero** - Requiere coordinación con National Soft
3. **Disponibilidad incierta** - No siempre disponible en todas versiones de SR
4. **Soporte limitado** - Solo cubre ventas, no menú/inventario completo

### 1.2 Solución Propuesta

Desarrollar un **Agente Local TIS TIS** que:

- Se instala en el servidor del cliente donde corre Soft Restaurant
- Lee directamente la base de datos SQL Server de SR
- Transforma y envía datos al webhook de TIS TIS
- Opera de forma autónoma sin dependencia de National Soft

### 1.3 Beneficios

| Beneficio | Descripción |
|-----------|-------------|
| **Control Total** | No dependemos de módulos de terceros |
| **Costos Reducidos** | Sin licencias adicionales para el cliente |
| **Funcionalidad Extendida** | Podemos sincronizar menú, inventario, mesas, etc. |
| **Soporte Propio** | Control total del ciclo de soporte |
| **Flexibilidad** | Adaptable a cualquier versión de SR |

### 1.4 Alcance del Documento

Este documento especifica:

- UI/UX para configuración en Dashboard TIS TIS
- API endpoints para gestión del agente
- Arquitectura del agente Windows (C#/.NET)
- Instalador con detección automática de SR
- Lógica de sincronización de datos
- Seguridad, monitoreo y testing

### 1.5 Tecnologías Principales

| Componente | Tecnología |
|------------|------------|
| Dashboard UI | Next.js 15, React, Tailwind CSS |
| Backend API | Next.js API Routes, Supabase |
| Agente Windows | .NET 8.0, C#, Worker Service |
| Instalador | WiX Toolset, Custom UI |
| Base de Datos SR | SQL Server (MSSQL) |
| Comunicación | HTTPS, JSON, Bearer Token Auth |

---

## 2. Arquitectura General

### 2.1 Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NUBE TIS TIS                                       │
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐   │
│  │   Dashboard     │     │   API Routes    │     │     Supabase        │   │
│  │   Next.js       │────▶│   /api/agent/*  │────▶│   PostgreSQL        │   │
│  │                 │     │                 │     │                     │   │
│  │ Settings >      │     │ - /register     │     │ - agent_instances   │   │
│  │ Integraciones > │     │ - /heartbeat    │     │ - integration_*     │   │
│  │ Soft Restaurant │     │ - /sync         │     │ - sr_sales          │   │
│  └─────────────────┘     └─────────────────┘     └─────────────────────┘   │
│                                   ▲                                         │
└───────────────────────────────────│─────────────────────────────────────────┘
                                    │ HTTPS (TLS 1.3)
                                    │ Bearer Token Auth
                                    │
┌───────────────────────────────────│─────────────────────────────────────────┐
│                         SERVIDOR CLIENTE                                     │
│                                   │                                         │
│  ┌─────────────────┐     ┌────────┴────────┐     ┌─────────────────────┐   │
│  │ Soft Restaurant │     │  TIS TIS Agent  │     │   Instalador        │   │
│  │ POS v10/11      │◀────│  Windows Service│◀────│   MSI + WiX         │   │
│  │                 │     │                 │     │                     │   │
│  │ - SQL Server    │     │ - Polling 30s   │     │ - Detección Auto    │   │
│  │ - DVSOFT DB     │     │ - Transformación│     │ - Configuración     │   │
│  │ - Ventas, Menú  │     │ - Retry Logic   │     │ - Servicio Windows  │   │
│  └─────────────────┘     └─────────────────┘     └─────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de Datos Principal

```
1. DESCARGA
   Dashboard TIS TIS → Genera Instalador Personalizado → Cliente Descarga

2. INSTALACIÓN
   Instalador → Detecta SQL Server → Encuentra BD DVSOFT → Configura Servicio

3. REGISTRO
   Agente → POST /api/agent/register → Valida Credenciales → Registra Instancia

4. SINCRONIZACIÓN (cada 30 segundos)
   Agente → Query SQL Server → Transforma Datos → POST /api/agent/sync → TIS TIS procesa

5. HEARTBEAT (cada 60 segundos)
   Agente → POST /api/agent/heartbeat → TIS TIS actualiza estado

6. MONITOREO
   Dashboard → GET /api/agent/status → Muestra estado de agentes
```

### 2.3 Modelo de Datos del Agente

```sql
-- Nueva tabla: agent_instances
CREATE TABLE agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  integration_id UUID NOT NULL REFERENCES integration_connections(id),
  branch_id UUID REFERENCES branches(id),

  -- Identificación del agente
  agent_id VARCHAR(64) NOT NULL UNIQUE,  -- Hash único del agente
  agent_version VARCHAR(20) NOT NULL,     -- e.g., "1.0.0"
  machine_name VARCHAR(255),              -- Hostname del servidor

  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | registered | connected | syncing | error | offline

  -- Conexión SR detectada
  sr_version VARCHAR(50),                 -- "Soft Restaurant 10.5.2"
  sr_database_name VARCHAR(100),          -- "DVSOFT_RESTAURANTE"
  sr_sql_instance VARCHAR(100),           -- "SQLEXPRESS" o "MSSQL$DVSOFT"
  sr_empresa_id VARCHAR(100),             -- ID de empresa en SR

  -- Configuración de sync
  sync_interval_seconds INT DEFAULT 30,
  sync_menu BOOLEAN DEFAULT true,
  sync_inventory BOOLEAN DEFAULT true,
  sync_sales BOOLEAN DEFAULT true,
  sync_tables BOOLEAN DEFAULT false,

  -- Estadísticas
  last_heartbeat_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_sync_records INT DEFAULT 0,
  total_records_synced BIGINT DEFAULT 0,
  consecutive_errors INT DEFAULT 0,
  last_error_message TEXT,
  last_error_at TIMESTAMPTZ,

  -- Seguridad
  auth_token_hash VARCHAR(64),           -- SHA-256 del token
  token_expires_at TIMESTAMPTZ,
  allowed_ips JSONB,                      -- IPs permitidas (opcional)

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Mapa de Fases

### 3.1 Vista General de Fases

| Fase | Nombre | Microfases | Dependencias | Esfuerzo Est. |
|------|--------|------------|--------------|---------------|
| **1** | UI/UX en Dashboard | 1.1 - 1.5 | Ninguna | 3-4 días |
| **2** | Infraestructura Backend | 2.1 - 2.4 | Fase 1 | 2-3 días |
| **3** | Agente Windows Core | 3.1 - 3.6 | Fase 2 | 5-7 días |
| **4** | Instalador Windows | 4.1 - 4.5 | Fase 3 | 3-4 días |
| **5** | Sincronización | 5.1 - 5.5 | Fase 3, 4 | 4-5 días |
| **6** | Seguridad | 6.1 - 6.4 | Fase 2, 3 | 2-3 días |
| **7** | Monitoreo | 7.1 - 7.4 | Fase 3, 5 | 2-3 días |
| **8** | Testing | 8.1 - 8.5 | Todas | 3-5 días |
| **9** | Documentación | 9.1 - 9.3 | Todas | 2-3 días |

**Total Estimado:** 26-37 días de desarrollo

### 3.2 Diagrama de Dependencias

```
FASE 1 ─────┬─────▶ FASE 2 ─────┬─────▶ FASE 3 ─────┬─────▶ FASE 4
(UI/UX)     │       (Backend)   │       (Core)      │       (Installer)
            │                   │                   │
            │                   ├─────▶ FASE 6 ◀────┤
            │                   │       (Security)  │
            │                   │                   │
            │                   │       ┌───────────┘
            │                   │       │
            │                   └───────┼─────▶ FASE 5
            │                           │       (Sync)
            │                           │
            │                           └─────▶ FASE 7
            │                                   (Monitoring)
            │
            └─────────────────────────────────▶ FASE 8 ─────▶ FASE 9
                                                (Testing)     (Docs)
```

---

## FASE 1: UI/UX en Dashboard TIS TIS

### Objetivo

Diseñar e implementar la interfaz de usuario para configurar, descargar y monitorear el Agente Local TIS TIS desde el Dashboard de Settings > Integraciones.

### 1.1 Actualización de SoftRestaurantConfigModal

**Archivos a modificar:**
- `src/features/integrations/components/SoftRestaurantConfigModal.tsx`

**Cambios:**

```typescript
// Nuevo estado para selección de método de integración
type IntegrationMethod = 'webhook_official' | 'local_agent';

interface SoftRestaurantConfigModalProps {
  // ... props existentes
  selectedMethod?: IntegrationMethod;
  onMethodChange?: (method: IntegrationMethod) => void;
}
```

**Nueva UI - Paso 0: Selector de Método**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════╗│
│  ║  🍽️  Integración con Soft Restaurant                             ║│
│  ║                                                                  ║│
│  ║  Selecciona el método de integración:                           ║│
│  ╚══════════════════════════════════════════════════════════════════╝│
│                                                                      │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────┐│
│  │ ○ Webhook Oficial               │  │ ● Agente Local TIS TIS     ││
│  │                                 │  │   (Recomendado)            ││
│  │ Requiere módulo adicional de   │  │                             ││
│  │ National Soft                   │  │ Instalación en tu servidor ││
│  │                                 │  │ Sin módulos adicionales    ││
│  │ • Costo: $X MXN/mes            │  │                             ││
│  │ • Solo ventas                  │  │ • Sin costo adicional      ││
│  │ • Dependencia de tercero       │  │ • Menú + Inventario + Ventas││
│  │                                 │  │ • Control total            ││
│  │ [Contactar National Soft]      │  │ • Soporte TIS TIS          ││
│  └─────────────────────────────────┘  └─────────────────────────────┘│
│                                                                      │
│                    [Cancelar]  [Continuar ▶]                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Diseño en Tailwind:**

```tsx
// Método selector card
<div className={cn(
  "relative p-6 rounded-2xl border-2 cursor-pointer transition-all",
  selected
    ? "border-tis-coral bg-tis-coral/5 ring-2 ring-tis-coral/20"
    : "border-gray-200 dark:border-[#404040] hover:border-tis-coral/50"
)}>
  {/* Radio indicator */}
  <div className="absolute top-4 right-4">
    <div className={cn(
      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
      selected
        ? "border-tis-coral bg-tis-coral"
        : "border-gray-300 dark:border-gray-600"
    )}>
      {selected && <Check className="w-3 h-3 text-white" />}
    </div>
  </div>

  {/* Badge recomendado */}
  {isRecommended && (
    <span className="absolute -top-3 left-4 px-2 py-1 text-xs font-medium
                     bg-green-100 dark:bg-green-900/30 text-green-700
                     dark:text-green-400 rounded-full">
      Recomendado
    </span>
  )}

  {/* Content */}
  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
    {title}
  </h4>
  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
    {description}
  </p>

  {/* Feature list */}
  <ul className="space-y-2">
    {features.map((feature, i) => (
      <li key={i} className="flex items-center gap-2 text-sm">
        {feature.positive ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <X className="w-4 h-4 text-gray-400" />
        )}
        <span className={feature.positive ? "text-gray-700" : "text-gray-500"}>
          {feature.text}
        </span>
      </li>
    ))}
  </ul>
</div>
```

### 1.2 Nuevo Componente: LocalAgentSetupWizard

**Archivo nuevo:**
- `src/features/integrations/components/LocalAgentSetupWizard.tsx`

**Estructura de pasos:**

| Paso | Nombre | Contenido |
|------|--------|-----------|
| 1 | Información | Explicación del agente y requisitos |
| 2 | Configuración | Opciones de sync (menú, inventario, ventas) |
| 3 | Descarga | Generar y descargar instalador personalizado |
| 4 | Instalación | Instrucciones paso a paso |
| 5 | Verificación | Verificar conexión del agente |

**Diseño del Paso 3 - Descarga:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Paso 3 de 5: Descarga del Agente                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  📦  Tu instalador personalizado está listo                    │ │
│  │                                                                │ │
│  │  El instalador incluye:                                        │ │
│  │  ✓ Credenciales pre-configuradas para tu cuenta               │ │
│  │  ✓ Detección automática de Soft Restaurant                    │ │
│  │  ✓ Configuración como servicio Windows                        │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  TIS-TIS-Agent-SR-{tenant_id_short}.msi                  │ │ │
│  │  │  Tamaño: ~15 MB                                          │ │ │
│  │  │  Requisitos: Windows 10/11/Server 2016+, .NET 8.0        │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  [⬇️  Descargar Instalador]                                   │ │
│  │                                                                │ │
│  │  ─────────────────────────────────────────────────────────── │ │
│  │                                                                │ │
│  │  Credenciales de conexión (guardadas en el instalador):       │ │
│  │                                                                │ │
│  │  Webhook URL:                                                  │ │
│  │  ┌────────────────────────────────────────────────────────┐   │ │
│  │  │ https://app.tistis.com/api/agent/sync/{tenant_id}  📋 │   │ │
│  │  └────────────────────────────────────────────────────────┘   │ │
│  │                                                                │ │
│  │  Token de autenticación:                                       │ │
│  │  ┌────────────────────────────────────────────────────────┐   │ │
│  │  │ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●  👁️ Mostrar  📋      │   │ │
│  │  └────────────────────────────────────────────────────────┘   │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ⚠️  Guarda estas credenciales en un lugar seguro.                  │
│     Solo se mostrarán una vez.                                       │
│                                                                      │
│                    [◀ Anterior]  [Siguiente: Instalación ▶]         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.3 Componente: AgentStatusCard

**Archivo nuevo:**
- `src/features/integrations/components/AgentStatusCard.tsx`

**Propósito:** Mostrar el estado del agente en la tarjeta de integración activa.

**Estados visuales:**

| Estado | Color | Icono | Descripción |
|--------|-------|-------|-------------|
| `pending` | Amber | ⏳ | Esperando instalación |
| `registered` | Blue | 📝 | Registrado, no conectado |
| `connected` | Green | ✓ | Conectado y activo |
| `syncing` | Blue pulsante | 🔄 | Sincronizando datos |
| `error` | Red | ⚠️ | Error de conexión |
| `offline` | Gray | ○ | Sin conexión |

**Diseño:**

```tsx
<div className="mt-4 p-4 bg-gray-50 dark:bg-[#262626] rounded-xl">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {/* Status indicator */}
      <div className={cn(
        "w-3 h-3 rounded-full",
        status === 'connected' && "bg-green-500 animate-pulse",
        status === 'syncing' && "bg-blue-500 animate-pulse",
        status === 'error' && "bg-red-500",
        status === 'offline' && "bg-gray-400"
      )} />

      {/* Info */}
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Agente Local TIS TIS
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {agent.machine_name} • v{agent.agent_version}
        </p>
      </div>
    </div>

    {/* Last sync */}
    <div className="text-right">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Última sincronización
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {formatRelativeTime(agent.last_sync_at)}
      </p>
    </div>
  </div>

  {/* Stats */}
  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-[#404040]">
    <div>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {formatNumber(agent.total_records_synced)}
      </p>
      <p className="text-xs text-gray-500">Registros sincronizados</p>
    </div>
    <div>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {agent.sync_interval_seconds}s
      </p>
      <p className="text-xs text-gray-500">Intervalo</p>
    </div>
    <div>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {agent.consecutive_errors || 0}
      </p>
      <p className="text-xs text-gray-500">Errores consecutivos</p>
    </div>
  </div>

  {/* Error message */}
  {agent.last_error_message && (
    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
      <p className="text-xs text-red-600 dark:text-red-400 truncate">
        {agent.last_error_message}
      </p>
    </div>
  )}
</div>
```

### 1.4 Actualización de IntegrationHub

**Archivo a modificar:**
- `src/features/integrations/components/IntegrationHub.tsx`

**Cambios:**

1. **Agregar lógica para mostrar AgentStatusCard:**

```tsx
// En el render de una conexión activa de tipo 'softrestaurant'
{connection.integration_type === 'softrestaurant' &&
 connection.metadata?.integration_method === 'local_agent' && (
  <AgentStatusCard
    integrationId={connection.id}
    tenantId={tenantId}
  />
)}
```

2. **Agregar badge de método de integración:**

```tsx
{connection.integration_type === 'softrestaurant' && (
  <span className={cn(
    "text-xs px-2 py-0.5 rounded-full",
    connection.metadata?.integration_method === 'local_agent'
      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  )}>
    {connection.metadata?.integration_method === 'local_agent'
      ? '🖥️ Agente Local'
      : '🔗 Webhook'}
  </span>
)}
```

### 1.5 Tipos TypeScript

**Archivo a modificar:**
- `src/features/integrations/types/integration.types.ts`

**Nuevos tipos:**

```typescript
// ======================
// LOCAL AGENT TYPES
// ======================

export type AgentStatus =
  | 'pending'     // Instalador descargado, esperando instalación
  | 'registered'  // Agente registrado pero no conectado
  | 'connected'   // Conectado y enviando heartbeats
  | 'syncing'     // Activamente sincronizando datos
  | 'error'       // Error de conexión o sync
  | 'offline';    // Sin heartbeat por > 5 minutos

export interface AgentInstance {
  id: string;
  tenant_id: string;
  integration_id: string;
  branch_id: string | null;

  // Identification
  agent_id: string;
  agent_version: string;
  machine_name: string | null;

  // Status
  status: AgentStatus;

  // SR Detection
  sr_version: string | null;
  sr_database_name: string | null;
  sr_sql_instance: string | null;
  sr_empresa_id: string | null;

  // Sync Config
  sync_interval_seconds: number;
  sync_menu: boolean;
  sync_inventory: boolean;
  sync_sales: boolean;
  sync_tables: boolean;

  // Stats
  last_heartbeat_at: string | null;
  last_sync_at: string | null;
  last_sync_records: number;
  total_records_synced: number;
  consecutive_errors: number;
  last_error_message: string | null;
  last_error_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AgentRegistrationRequest {
  tenant_id: string;
  integration_id: string;
  agent_id: string;
  agent_version: string;
  machine_name: string;
  sr_version: string;
  sr_database_name: string;
  sr_sql_instance: string;
  sr_empresa_id: string;
}

export interface AgentHeartbeatRequest {
  agent_id: string;
  status: 'connected' | 'syncing' | 'error';
  last_sync_at?: string;
  last_sync_records?: number;
  error_message?: string;
}

export interface AgentSyncPayload {
  agent_id: string;
  sync_type: 'menu' | 'inventory' | 'sales' | 'tables';
  data: unknown; // Typed per sync_type
  batch_id: string;
  batch_total: number;
  batch_index: number;
}

export interface GenerateInstallerRequest {
  tenant_id: string;
  integration_id: string;
  sync_menu: boolean;
  sync_inventory: boolean;
  sync_sales: boolean;
  sync_tables: boolean;
}

export interface GenerateInstallerResponse {
  download_url: string;
  filename: string;
  expires_at: string;
  webhook_url: string;
  auth_token: string; // Solo se muestra una vez
  installation_id: string;
}
```

### 1.6 Archivos a Crear/Modificar (Resumen Fase 1)

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| Modificar | `SoftRestaurantConfigModal.tsx` | Agregar selector de método |
| Crear | `LocalAgentSetupWizard.tsx` | Wizard de 5 pasos |
| Crear | `AgentStatusCard.tsx` | Card de estado del agente |
| Modificar | `IntegrationHub.tsx` | Integrar nuevos componentes |
| Modificar | `integration.types.ts` | Agregar tipos de agente |
| Crear | `useAgentStatus.ts` | Hook para polling de estado |

### 1.7 Criterios de Aceptación Fase 1

- [ ] Usuario puede seleccionar entre "Webhook Oficial" y "Agente Local"
- [ ] Wizard de 5 pasos funciona correctamente
- [ ] Instalador se descarga con credenciales embebidas
- [ ] AgentStatusCard muestra estado en tiempo real
- [ ] UI es responsive (mobile-first)
- [ ] Dark mode funciona correctamente
- [ ] Accesibilidad (labels, focus, keyboard nav)

---

## FASE 2: Infraestructura Backend

### Objetivo

Implementar la API y base de datos necesarios para soportar el registro, comunicación y monitoreo del agente.

### 2.1 Migración de Base de Datos

**Archivo nuevo:**
- `supabase/migrations/XXX_AGENT_INSTANCES.sql`

```sql
-- =====================================================
-- TIS TIS PLATFORM - Agent Instances Schema
-- Migration: XXX_AGENT_INSTANCES.sql
-- Purpose: Store and track local agent installations
-- =====================================================

-- ======================
-- AGENT INSTANCES TABLE
-- ======================

CREATE TABLE IF NOT EXISTS public.agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

  -- Agent identification (unique per installation)
  agent_id VARCHAR(64) NOT NULL,
  agent_version VARCHAR(20) NOT NULL,
  machine_name VARCHAR(255),

  -- Current status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'registered', 'connected', 'syncing', 'error', 'offline')),

  -- Soft Restaurant detection results
  sr_version VARCHAR(50),
  sr_database_name VARCHAR(100),
  sr_sql_instance VARCHAR(100),
  sr_empresa_id VARCHAR(100),

  -- Sync configuration
  sync_interval_seconds INT DEFAULT 30 CHECK (sync_interval_seconds >= 10 AND sync_interval_seconds <= 300),
  sync_menu BOOLEAN DEFAULT true,
  sync_inventory BOOLEAN DEFAULT true,
  sync_sales BOOLEAN DEFAULT true,
  sync_tables BOOLEAN DEFAULT false,

  -- Operational statistics
  last_heartbeat_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_sync_records INT DEFAULT 0,
  total_records_synced BIGINT DEFAULT 0,
  consecutive_errors INT DEFAULT 0 CHECK (consecutive_errors >= 0),
  last_error_message TEXT,
  last_error_at TIMESTAMPTZ,

  -- Security
  auth_token_hash VARCHAR(64) NOT NULL,  -- SHA-256 of auth token
  token_expires_at TIMESTAMPTZ NOT NULL,
  allowed_ips JSONB DEFAULT '[]',         -- Optional IP whitelist

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT unique_agent_id UNIQUE (agent_id),
  CONSTRAINT unique_tenant_integration UNIQUE (tenant_id, integration_id)
);

-- ======================
-- INDEXES
-- ======================

-- Fast lookup by tenant
CREATE INDEX idx_agent_instances_tenant ON public.agent_instances(tenant_id);

-- Fast lookup by integration
CREATE INDEX idx_agent_instances_integration ON public.agent_instances(integration_id);

-- Status monitoring
CREATE INDEX idx_agent_instances_status ON public.agent_instances(status);

-- Heartbeat monitoring (find offline agents)
CREATE INDEX idx_agent_instances_heartbeat ON public.agent_instances(last_heartbeat_at)
  WHERE status IN ('connected', 'syncing');

-- Auth token lookup
CREATE INDEX idx_agent_instances_token ON public.agent_instances(auth_token_hash);

-- ======================
-- RLS POLICIES
-- ======================

ALTER TABLE public.agent_instances ENABLE ROW LEVEL SECURITY;

-- Tenant isolation (owner/admin access)
CREATE POLICY "agent_instances_tenant_isolation" ON public.agent_instances
  FOR ALL
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
    )
  );

-- Service role bypass (for agent API endpoints)
CREATE POLICY "agent_instances_service_role" ON public.agent_instances
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ======================
-- TRIGGERS
-- ======================

-- Auto-update updated_at
CREATE TRIGGER trg_agent_instances_updated_at
  BEFORE UPDATE ON public.agent_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- AGENT SYNC LOGS TABLE
-- (Separate from integration_sync_logs for better querying)
-- ======================

CREATE TABLE IF NOT EXISTS public.agent_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_instances(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Sync details
  sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('menu', 'inventory', 'sales', 'tables', 'full')),
  batch_id VARCHAR(64),          -- For multi-batch syncs
  batch_index INT,
  batch_total INT,

  -- Results
  status VARCHAR(20) NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'processing', 'completed', 'partial', 'failed')),
  records_received INT DEFAULT 0,
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  records_failed INT DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,

  -- Error handling
  error_message TEXT,
  error_details JSONB,
  failed_records JSONB,  -- Array of failed record IDs

  -- Debug info
  raw_payload_size_bytes INT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for agent_sync_logs
CREATE INDEX idx_agent_sync_logs_agent ON public.agent_sync_logs(agent_id);
CREATE INDEX idx_agent_sync_logs_tenant ON public.agent_sync_logs(tenant_id);
CREATE INDEX idx_agent_sync_logs_recent ON public.agent_sync_logs(created_at DESC);
CREATE INDEX idx_agent_sync_logs_status ON public.agent_sync_logs(status) WHERE status IN ('started', 'processing');

-- RLS for agent_sync_logs
ALTER TABLE public.agent_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_sync_logs_tenant_isolation" ON public.agent_sync_logs
  FOR ALL
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "agent_sync_logs_service_role" ON public.agent_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ======================
-- HELPER FUNCTIONS
-- ======================

-- Mark offline agents (called by cron job)
CREATE OR REPLACE FUNCTION mark_offline_agents()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.agent_instances
  SET
    status = 'offline',
    updated_at = now()
  WHERE
    status IN ('connected', 'syncing')
    AND last_heartbeat_at < now() - INTERVAL '5 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Get agent stats for dashboard
CREATE OR REPLACE FUNCTION get_agent_stats(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_agents', COUNT(*),
    'connected', COUNT(*) FILTER (WHERE status = 'connected'),
    'syncing', COUNT(*) FILTER (WHERE status = 'syncing'),
    'error', COUNT(*) FILTER (WHERE status = 'error'),
    'offline', COUNT(*) FILTER (WHERE status = 'offline'),
    'total_records_synced', COALESCE(SUM(total_records_synced), 0),
    'avg_sync_interval', ROUND(AVG(sync_interval_seconds)),
    'last_sync_at', MAX(last_sync_at)
  )
  INTO result
  FROM public.agent_instances
  WHERE tenant_id = p_tenant_id;

  RETURN result;
END;
$$;

-- Validate agent auth token
CREATE OR REPLACE FUNCTION validate_agent_token(p_agent_id VARCHAR, p_token_hash VARCHAR)
RETURNS TABLE (
  is_valid BOOLEAN,
  agent_instance_id UUID,
  tenant_id UUID,
  integration_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ai.auth_token_hash = p_token_hash AND ai.token_expires_at > now()) AS is_valid,
    ai.id AS agent_instance_id,
    ai.tenant_id,
    ai.integration_id
  FROM public.agent_instances ai
  WHERE ai.agent_id = p_agent_id;
END;
$$;

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE public.agent_instances IS
  'Stores TIS TIS Local Agent installations for Soft Restaurant integration';

COMMENT ON COLUMN public.agent_instances.agent_id IS
  'Unique identifier for the agent, generated during installation';

COMMENT ON COLUMN public.agent_instances.auth_token_hash IS
  'SHA-256 hash of the authentication token, never store plain token';

COMMENT ON FUNCTION mark_offline_agents() IS
  'Called by cron job every minute to mark agents without recent heartbeats as offline';
```

### 2.2 API Endpoints

**Nuevos archivos:**

```
app/api/agent/
├── register/route.ts      # POST - Registrar nuevo agente
├── heartbeat/route.ts     # POST - Actualizar estado del agente
├── sync/route.ts          # POST - Recibir datos sincronizados
├── status/[agentId]/route.ts  # GET - Obtener estado de un agente
├── installer/route.ts     # POST - Generar instalador personalizado
└── [tenantId]/route.ts    # GET - Listar agentes del tenant
```

#### 2.2.1 POST /api/agent/register

```typescript
// app/api/agent/register/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Rate limiter para registro de agentes
const REGISTER_RATE_LIMIT = {
  limit: 10,
  windowSeconds: 3600, // 10 registros por hora
  identifier: 'agent-register',
};

interface RegisterRequest {
  tenant_id: string;
  integration_id: string;
  agent_id: string;
  agent_version: string;
  machine_name: string;
  sr_version: string;
  sr_database_name: string;
  sr_sql_instance: string;
  sr_empresa_id: string;
  auth_token: string; // Token generado durante descarga del instalador
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    // ... (implementar)

    // 2. Parse body
    const body: RegisterRequest = await request.json();

    // 3. Validate required fields
    const required = ['tenant_id', 'integration_id', 'agent_id', 'auth_token'];
    for (const field of required) {
      if (!body[field as keyof RegisterRequest]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // 4. Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 5. Hash the token
    const tokenHash = createHash('sha256').update(body.auth_token).digest('hex');

    // 6. Verify token exists and is valid
    const { data: validation, error: validationError } = await supabase
      .rpc('validate_agent_token', {
        p_agent_id: body.agent_id,
        p_token_hash: tokenHash
      });

    if (validationError || !validation?.[0]?.is_valid) {
      return NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      );
    }

    // 7. Update agent instance with registration info
    const { data: agent, error: updateError } = await supabase
      .from('agent_instances')
      .update({
        status: 'registered',
        agent_version: body.agent_version,
        machine_name: body.machine_name,
        sr_version: body.sr_version,
        sr_database_name: body.sr_database_name,
        sr_sql_instance: body.sr_sql_instance,
        sr_empresa_id: body.sr_empresa_id,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', body.agent_id)
      .select()
      .single();

    if (updateError) {
      console.error('[Agent Register] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to register agent' },
        { status: 500 }
      );
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      agent_id: agent.agent_id,
      status: agent.status,
      sync_config: {
        interval_seconds: agent.sync_interval_seconds,
        sync_menu: agent.sync_menu,
        sync_inventory: agent.sync_inventory,
        sync_sales: agent.sync_sales,
        sync_tables: agent.sync_tables,
      },
      message: 'Agent registered successfully',
    });

  } catch (error) {
    console.error('[Agent Register] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 2.2.2 POST /api/agent/heartbeat

```typescript
// app/api/agent/heartbeat/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

interface HeartbeatRequest {
  agent_id: string;
  auth_token: string;
  status: 'connected' | 'syncing' | 'error';
  last_sync_at?: string;
  last_sync_records?: number;
  error_message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: HeartbeatRequest = await request.json();

    // Validate
    if (!body.agent_id || !body.auth_token) {
      return NextResponse.json(
        { error: 'Missing agent_id or auth_token' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tokenHash = createHash('sha256').update(body.auth_token).digest('hex');

    // Validate token
    const { data: validation } = await supabase
      .rpc('validate_agent_token', {
        p_agent_id: body.agent_id,
        p_token_hash: tokenHash
      });

    if (!validation?.[0]?.is_valid) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Update heartbeat
    const updateData: Record<string, unknown> = {
      status: body.status,
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (body.status === 'connected') {
      updateData.consecutive_errors = 0;
    }

    if (body.status === 'error' && body.error_message) {
      updateData.last_error_message = body.error_message;
      updateData.last_error_at = new Date().toISOString();
      // Increment consecutive_errors
      const { data: current } = await supabase
        .from('agent_instances')
        .select('consecutive_errors')
        .eq('agent_id', body.agent_id)
        .single();
      updateData.consecutive_errors = (current?.consecutive_errors || 0) + 1;
    }

    if (body.last_sync_at) {
      updateData.last_sync_at = body.last_sync_at;
    }

    if (body.last_sync_records !== undefined) {
      updateData.last_sync_records = body.last_sync_records;
    }

    const { error: updateError } = await supabase
      .from('agent_instances')
      .update(updateData)
      .eq('agent_id', body.agent_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update heartbeat' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Agent Heartbeat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 2.2.3 POST /api/agent/sync

```typescript
// app/api/agent/sync/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Rate limit: 1000 requests per minute (high throughput for sync)
const SYNC_RATE_LIMIT = {
  limit: 1000,
  windowSeconds: 60,
  identifier: 'agent-sync',
};

interface SyncRequest {
  agent_id: string;
  auth_token: string;
  sync_type: 'menu' | 'inventory' | 'sales' | 'tables';
  batch_id: string;
  batch_index: number;
  batch_total: number;
  data: unknown;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: SyncRequest = await request.json();

    // Validate
    const required = ['agent_id', 'auth_token', 'sync_type', 'data'];
    for (const field of required) {
      if (!body[field as keyof SyncRequest]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tokenHash = createHash('sha256').update(body.auth_token).digest('hex');

    // Validate token and get context
    const { data: validation } = await supabase
      .rpc('validate_agent_token', {
        p_agent_id: body.agent_id,
        p_token_hash: tokenHash
      });

    if (!validation?.[0]?.is_valid) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { tenant_id, integration_id, agent_instance_id } = validation[0];

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('agent_sync_logs')
      .insert({
        agent_id: agent_instance_id,
        tenant_id,
        sync_type: body.sync_type,
        batch_id: body.batch_id,
        batch_index: body.batch_index,
        batch_total: body.batch_total,
        status: 'processing',
        records_received: Array.isArray(body.data) ? body.data.length : 1,
        raw_payload_size_bytes: JSON.stringify(body.data).length,
      })
      .select()
      .single();

    if (logError) {
      console.error('[Agent Sync] Log creation error:', logError);
    }

    // Process data based on sync_type
    let result;
    try {
      switch (body.sync_type) {
        case 'sales':
          result = await processSalesSync(supabase, tenant_id, integration_id, body.data);
          break;
        case 'menu':
          result = await processMenuSync(supabase, tenant_id, body.data);
          break;
        case 'inventory':
          result = await processInventorySync(supabase, tenant_id, body.data);
          break;
        case 'tables':
          result = await processTablesSync(supabase, tenant_id, body.data);
          break;
        default:
          return NextResponse.json(
            { error: `Unknown sync_type: ${body.sync_type}` },
            { status: 400 }
          );
      }
    } catch (processError) {
      // Update sync log with failure
      if (syncLog) {
        await supabase
          .from('agent_sync_logs')
          .update({
            status: 'failed',
            error_message: processError instanceof Error ? processError.message : 'Processing failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
          })
          .eq('id', syncLog.id);
      }

      throw processError;
    }

    // Update sync log with success
    if (syncLog) {
      await supabase
        .from('agent_sync_logs')
        .update({
          status: 'completed',
          records_processed: result.processed,
          records_created: result.created,
          records_updated: result.updated,
          records_skipped: result.skipped,
          records_failed: result.failed,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
        .eq('id', syncLog.id);
    }

    // Update agent stats
    await supabase
      .from('agent_instances')
      .update({
        status: 'connected',
        last_sync_at: new Date().toISOString(),
        last_sync_records: result.processed,
        total_records_synced: supabase.rpc('increment', {
          row_id: agent_instance_id,
          amount: result.processed
        }),
        consecutive_errors: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_instance_id);

    return NextResponse.json({
      success: true,
      sync_type: body.sync_type,
      batch_id: body.batch_id,
      result: {
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
      duration_ms: Date.now() - startTime,
    });

  } catch (error) {
    console.error('[Agent Sync] Error:', error);
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper functions for processing each sync type
async function processSalesSync(supabase: SupabaseClient, tenantId: string, integrationId: string, data: unknown) {
  // Delegate to existing SR webhook processing logic
  // ... implementation
  return { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}

async function processMenuSync(supabase: SupabaseClient, tenantId: string, data: unknown) {
  // Process menu items into restaurant_menu_items table
  // ... implementation
  return { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}

async function processInventorySync(supabase: SupabaseClient, tenantId: string, data: unknown) {
  // Process inventory into inventory_items table
  // ... implementation
  return { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}

async function processTablesSync(supabase: SupabaseClient, tenantId: string, data: unknown) {
  // Process tables into restaurant_tables table
  // ... implementation
  return { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}
```

### 2.3 Generador de Instalador

**Archivo nuevo:**
- `app/api/agent/installer/route.ts`

```typescript
// app/api/agent/installer/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';
import { randomBytes, createHash } from 'crypto';

interface GenerateInstallerRequest {
  integration_id: string;
  branch_id?: string;
  sync_menu: boolean;
  sync_inventory: boolean;
  sync_sales: boolean;
  sync_tables: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, userId, role } = authResult;

    // Only owner/admin can generate installers
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body: GenerateInstallerRequest = await request.json();

    // Validate integration exists and belongs to tenant
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: integration, error: intError } = await adminClient
      .from('integration_connections')
      .select('id, tenant_id, integration_type, status')
      .eq('id', body.integration_id)
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'softrestaurant')
      .single();

    if (intError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Generate unique agent ID and auth token
    const agentId = `tis-agent-${randomBytes(16).toString('hex')}`;
    const authToken = randomBytes(32).toString('hex');
    const authTokenHash = createHash('sha256').update(authToken).digest('hex');

    // Token expires in 30 days
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

    // Create pending agent instance
    const { data: agentInstance, error: createError } = await adminClient
      .from('agent_instances')
      .insert({
        tenant_id: tenantId,
        integration_id: body.integration_id,
        branch_id: body.branch_id || null,
        agent_id: agentId,
        agent_version: '0.0.0', // Will be updated on registration
        status: 'pending',
        sync_menu: body.sync_menu,
        sync_inventory: body.sync_inventory,
        sync_sales: body.sync_sales,
        sync_tables: body.sync_tables,
        auth_token_hash: authTokenHash,
        token_expires_at: tokenExpiresAt.toISOString(),
        metadata: {
          generated_by: userId,
          generated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (createError) {
      console.error('[Installer Generate] Error:', createError);
      return NextResponse.json(
        { error: 'Failed to create agent instance' },
        { status: 500 }
      );
    }

    // Update integration metadata
    await adminClient
      .from('integration_connections')
      .update({
        metadata: {
          ...integration.metadata,
          integration_method: 'local_agent',
          agent_instance_id: agentInstance.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.integration_id);

    // Generate webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';
    const webhookUrl = `${baseUrl}/api/agent/sync`;

    // Generate signed download URL for the installer
    // In production, this would trigger a build or use a pre-built template
    const downloadUrl = `${baseUrl}/downloads/agent/TIS-TIS-Agent-SR-${tenantId.substring(0, 8)}.msi`;

    return NextResponse.json({
      success: true,
      download_url: downloadUrl,
      filename: `TIS-TIS-Agent-SR-${tenantId.substring(0, 8)}.msi`,
      expires_at: tokenExpiresAt.toISOString(),
      webhook_url: webhookUrl,
      auth_token: authToken, // ⚠️ Only shown once!
      agent_id: agentId,
      installation_id: agentInstance.id,
      instructions: {
        step1: 'Descarga el instalador en el servidor donde está instalado Soft Restaurant',
        step2: 'Ejecuta el instalador como Administrador',
        step3: 'El agente detectará automáticamente la base de datos de Soft Restaurant',
        step4: 'Verifica la conexión en el Dashboard de TIS TIS',
      },
    });

  } catch (error) {
    console.error('[Installer Generate] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2.4 Service para Gestión de Agentes

**Archivo nuevo:**
- `src/features/integrations/services/agent-manager.service.ts`

```typescript
// src/features/integrations/services/agent-manager.service.ts

import { SupabaseClient } from '@supabase/supabase-js';
import type { AgentInstance, AgentStatus } from '../types/integration.types';

export class AgentManagerService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all agents for a tenant
   */
  async getAgents(tenantId: string): Promise<AgentInstance[]> {
    const { data, error } = await this.supabase
      .from('agent_instances')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AgentManager] Error fetching agents:', error);
      throw new Error('Failed to fetch agents');
    }

    return data || [];
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<AgentInstance | null> {
    const { data, error } = await this.supabase
      .from('agent_instances')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Get agent stats for dashboard
   */
  async getAgentStats(tenantId: string): Promise<{
    total: number;
    connected: number;
    syncing: number;
    error: number;
    offline: number;
    totalRecordsSynced: number;
    lastSyncAt: string | null;
  }> {
    const { data, error } = await this.supabase
      .rpc('get_agent_stats', { p_tenant_id: tenantId });

    if (error) {
      console.error('[AgentManager] Error fetching stats:', error);
      throw new Error('Failed to fetch agent stats');
    }

    return {
      total: data.total_agents || 0,
      connected: data.connected || 0,
      syncing: data.syncing || 0,
      error: data.error || 0,
      offline: data.offline || 0,
      totalRecordsSynced: data.total_records_synced || 0,
      lastSyncAt: data.last_sync_at || null,
    };
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('agent_instances')
      .delete()
      .eq('agent_id', agentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[AgentManager] Error deleting agent:', error);
      throw new Error('Failed to delete agent');
    }
  }

  /**
   * Update agent sync configuration
   */
  async updateSyncConfig(
    agentId: string,
    config: {
      sync_menu?: boolean;
      sync_inventory?: boolean;
      sync_sales?: boolean;
      sync_tables?: boolean;
      sync_interval_seconds?: number;
    }
  ): Promise<AgentInstance> {
    const { data, error } = await this.supabase
      .from('agent_instances')
      .update({
        ...config,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId)
      .select()
      .single();

    if (error) {
      console.error('[AgentManager] Error updating config:', error);
      throw new Error('Failed to update agent configuration');
    }

    return data;
  }

  /**
   * Regenerate auth token for an agent
   */
  async regenerateToken(agentId: string): Promise<{
    newToken: string;
    expiresAt: string;
  }> {
    const { randomBytes, createHash } = await import('crypto');

    const newToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(newToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await this.supabase
      .from('agent_instances')
      .update({
        auth_token_hash: tokenHash,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId);

    if (error) {
      throw new Error('Failed to regenerate token');
    }

    return {
      newToken,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Get recent sync logs for an agent
   */
  async getSyncLogs(
    agentInstanceId: string,
    limit: number = 20
  ): Promise<AgentSyncLog[]> {
    const { data, error } = await this.supabase
      .from('agent_sync_logs')
      .select('*')
      .eq('agent_id', agentInstanceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error('Failed to fetch sync logs');
    }

    return data || [];
  }
}

// Singleton instance
let serviceInstance: AgentManagerService | null = null;

export function getAgentManagerService(supabase: SupabaseClient): AgentManagerService {
  if (!serviceInstance) {
    serviceInstance = new AgentManagerService(supabase);
  }
  return serviceInstance;
}
```

### 2.5 Archivos a Crear (Resumen Fase 2)

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| Crear | `supabase/migrations/XXX_AGENT_INSTANCES.sql` | Schema de base de datos |
| Crear | `app/api/agent/register/route.ts` | Endpoint de registro |
| Crear | `app/api/agent/heartbeat/route.ts` | Endpoint de heartbeat |
| Crear | `app/api/agent/sync/route.ts` | Endpoint de sincronización |
| Crear | `app/api/agent/installer/route.ts` | Generador de instalador |
| Crear | `app/api/agent/status/[agentId]/route.ts` | Estado de agente |
| Crear | `src/features/integrations/services/agent-manager.service.ts` | Service de gestión |

### 2.6 Criterios de Aceptación Fase 2

- [ ] Migración SQL ejecuta sin errores
- [ ] RLS policies funcionan correctamente
- [ ] Endpoint /register valida y registra agentes
- [ ] Endpoint /heartbeat actualiza estado
- [ ] Endpoint /sync procesa datos correctamente
- [ ] Generador de instalador crea credenciales
- [ ] Rate limiting funciona en todos los endpoints
- [ ] Logs de sync se almacenan correctamente

---

## FASE 3: Agente Windows - Core

### Objetivo

Desarrollar el servicio Windows (.NET 8.0) que se ejecuta en el servidor del cliente, detecta Soft Restaurant y sincroniza datos.

### 3.1 Estructura del Proyecto C#

```
TisTis.Agent.SoftRestaurant/
├── src/
│   ├── TisTis.Agent.Core/                 # Biblioteca principal
│   │   ├── Configuration/
│   │   │   ├── AgentConfiguration.cs
│   │   │   └── SyncOptions.cs
│   │   ├── Detection/
│   │   │   ├── ISoftRestaurantDetector.cs
│   │   │   ├── SoftRestaurantDetector.cs
│   │   │   ├── RegistryDetector.cs
│   │   │   ├── ServiceDetector.cs
│   │   │   ├── SqlInstanceDetector.cs
│   │   │   └── DetectionResult.cs
│   │   ├── Database/
│   │   │   ├── ISoftRestaurantRepository.cs
│   │   │   ├── SoftRestaurantRepository.cs
│   │   │   ├── Models/
│   │   │   │   ├── SRVenta.cs
│   │   │   │   ├── SRProducto.cs
│   │   │   │   ├── SRInventario.cs
│   │   │   │   └── SRMesa.cs
│   │   │   └── Queries/
│   │   │       ├── VentasQueries.cs
│   │   │       ├── ProductosQueries.cs
│   │   │       └── InventarioQueries.cs
│   │   ├── Sync/
│   │   │   ├── ISyncEngine.cs
│   │   │   ├── SyncEngine.cs
│   │   │   ├── Transformers/
│   │   │   │   ├── IDataTransformer.cs
│   │   │   │   ├── VentasTransformer.cs
│   │   │   │   ├── ProductosTransformer.cs
│   │   │   │   └── InventarioTransformer.cs
│   │   │   └── Batching/
│   │   │       ├── BatchProcessor.cs
│   │   │       └── BatchResult.cs
│   │   ├── Api/
│   │   │   ├── ITisTisApiClient.cs
│   │   │   ├── TisTisApiClient.cs
│   │   │   ├── Requests/
│   │   │   │   ├── RegisterRequest.cs
│   │   │   │   ├── HeartbeatRequest.cs
│   │   │   │   └── SyncRequest.cs
│   │   │   └── Responses/
│   │   │       ├── ApiResponse.cs
│   │   │       └── SyncResponse.cs
│   │   ├── Security/
│   │   │   ├── CredentialStore.cs      # DPAPI encryption
│   │   │   ├── TokenManager.cs
│   │   │   └── CertificateValidator.cs
│   │   └── Logging/
│   │       ├── AgentLogger.cs
│   │       └── EventLogWriter.cs
│   │
│   ├── TisTis.Agent.Service/              # Windows Service
│   │   ├── Program.cs
│   │   ├── AgentWorker.cs                 # BackgroundService
│   │   ├── appsettings.json
│   │   └── TisTis.Agent.Service.csproj
│   │
│   └── TisTis.Agent.Installer/            # WiX Installer
│       ├── Product.wxs
│       ├── UI/
│       │   ├── WelcomeDialog.wxs
│       │   ├── DetectionDialog.wxs
│       │   ├── ConfigDialog.wxs
│       │   └── FinishDialog.wxs
│       └── Resources/
│           ├── Banner.bmp
│           ├── Dialog.bmp
│           └── License.rtf
│
├── tests/
│   ├── TisTis.Agent.Core.Tests/
│   └── TisTis.Agent.Integration.Tests/
│
├── TisTis.Agent.SoftRestaurant.sln
└── README.md
```

### 3.2 Detector de Soft Restaurant

```csharp
// src/TisTis.Agent.Core/Detection/SoftRestaurantDetector.cs

using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using System.Data.SqlClient;
using System.ServiceProcess;

namespace TisTis.Agent.Core.Detection;

public class SoftRestaurantDetector : ISoftRestaurantDetector
{
    private readonly ILogger<SoftRestaurantDetector> _logger;
    private readonly RegistryDetector _registryDetector;
    private readonly ServiceDetector _serviceDetector;
    private readonly SqlInstanceDetector _sqlDetector;

    // Known SQL Server instance names used by Soft Restaurant
    private static readonly string[] KnownSqlInstances = new[]
    {
        "DVSOFT",
        "SOFTRESTAURANT",
        "SQLEXPRESS",
        "MSSQLSERVER",
        "SR10",
        "SR11"
    };

    // Known database names used by Soft Restaurant
    private static readonly string[] KnownDatabaseNames = new[]
    {
        "DVSOFT",
        "SOFTRESTAURANT",
        "SR_",
        "RESTAURANT"
    };

    // Registry paths where SR might be registered
    private static readonly string[] RegistryPaths = new[]
    {
        @"SOFTWARE\National Soft\Soft Restaurant 10",
        @"SOFTWARE\National Soft\Soft Restaurant 11",
        @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 10",
        @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 11",
        @"SOFTWARE\DVSOFT",
        @"SOFTWARE\WOW6432Node\DVSOFT"
    };

    public SoftRestaurantDetector(
        ILogger<SoftRestaurantDetector> logger,
        RegistryDetector registryDetector,
        ServiceDetector serviceDetector,
        SqlInstanceDetector sqlDetector)
    {
        _logger = logger;
        _registryDetector = registryDetector;
        _serviceDetector = serviceDetector;
        _sqlDetector = sqlDetector;
    }

    /// <summary>
    /// Performs full detection of Soft Restaurant installation
    /// </summary>
    public async Task<DetectionResult> DetectAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting Soft Restaurant detection...");

        var result = new DetectionResult
        {
            DetectionStarted = DateTime.UtcNow,
            Methods = new List<DetectionMethod>()
        };

        // Method 1: Registry Detection
        _logger.LogDebug("Attempting registry detection...");
        var registryResult = await _registryDetector.DetectAsync(RegistryPaths, cancellationToken);
        result.Methods.Add(new DetectionMethod
        {
            Name = "Registry",
            Success = registryResult.Found,
            Details = registryResult
        });

        if (registryResult.Found)
        {
            result.InstallPath = registryResult.InstallPath;
            result.Version = registryResult.Version;
            _logger.LogInformation("Found SR via registry: {Version} at {Path}",
                registryResult.Version, registryResult.InstallPath);
        }

        // Method 2: Windows Services Detection
        _logger.LogDebug("Attempting service detection...");
        var serviceResult = await _serviceDetector.DetectAsync(cancellationToken);
        result.Methods.Add(new DetectionMethod
        {
            Name = "WindowsService",
            Success = serviceResult.Found,
            Details = serviceResult
        });

        if (serviceResult.Found)
        {
            result.ServiceName = serviceResult.ServiceName;
            result.ServiceStatus = serviceResult.Status;
            _logger.LogInformation("Found SR service: {ServiceName} ({Status})",
                serviceResult.ServiceName, serviceResult.Status);
        }

        // Method 3: SQL Server Instance Enumeration
        _logger.LogDebug("Enumerating SQL Server instances...");
        var sqlInstances = await _sqlDetector.EnumerateInstancesAsync(cancellationToken);

        foreach (var instance in sqlInstances)
        {
            _logger.LogDebug("Checking SQL instance: {Instance}", instance);

            // Try to find SR database in this instance
            var dbResult = await _sqlDetector.FindSRDatabaseAsync(instance, KnownDatabaseNames, cancellationToken);

            if (dbResult.Found)
            {
                result.Methods.Add(new DetectionMethod
                {
                    Name = $"SQL_{instance}",
                    Success = true,
                    Details = dbResult
                });

                result.SqlInstance = instance;
                result.DatabaseName = dbResult.DatabaseName;
                result.EmpresaId = dbResult.EmpresaId;
                result.ConnectionString = dbResult.ConnectionString;

                _logger.LogInformation("Found SR database: {Database} in instance {Instance}",
                    dbResult.DatabaseName, instance);

                break; // Found a valid database
            }
        }

        // Determine overall success
        result.Success = !string.IsNullOrEmpty(result.ConnectionString);
        result.DetectionCompleted = DateTime.UtcNow;
        result.DetectionDurationMs = (int)(result.DetectionCompleted - result.DetectionStarted).TotalMilliseconds;

        if (result.Success)
        {
            _logger.LogInformation(
                "Detection successful! SR {Version}, Database: {Database}, Instance: {Instance}",
                result.Version ?? "Unknown",
                result.DatabaseName,
                result.SqlInstance);
        }
        else
        {
            _logger.LogWarning("Detection failed - no Soft Restaurant database found");
        }

        return result;
    }

    /// <summary>
    /// Quick check if SR seems to be installed (for installer UI)
    /// </summary>
    public bool QuickCheck()
    {
        // Check registry first (fastest)
        foreach (var path in RegistryPaths)
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(path);
                if (key != null) return true;
            }
            catch { /* Continue */ }
        }

        // Check for SQL services
        try
        {
            var services = ServiceController.GetServices();
            return services.Any(s =>
                KnownSqlInstances.Any(inst =>
                    s.ServiceName.Contains(inst, StringComparison.OrdinalIgnoreCase)));
        }
        catch { return false; }
    }
}
```

### 3.3 Modelos de Datos SR

```csharp
// src/TisTis.Agent.Core/Database/Models/SRVenta.cs

namespace TisTis.Agent.Core.Database.Models;

/// <summary>
/// Represents a sale ticket from Soft Restaurant
/// Mapped from: dbo.Ventas + dbo.DetalleVentas + dbo.PagosVenta
/// </summary>
public class SRVenta
{
    // Header fields (from Ventas table)
    public string NumeroOrden { get; set; } = string.Empty;
    public string FolioVenta { get; set; } = string.Empty;
    public string Estacion { get; set; } = string.Empty;
    public string Almacen { get; set; } = string.Empty;
    public DateTime FechaApertura { get; set; }
    public DateTime? FechaCierre { get; set; }
    public string? NumeroMesa { get; set; }
    public string? CodigoCliente { get; set; }
    public string? NombreCliente { get; set; }
    public string? CodigoMesero { get; set; }
    public string? NombreMesero { get; set; }
    public string? Observaciones { get; set; }

    // Calculated totals
    public decimal SubtotalSinImpuestos { get; set; }
    public decimal TotalImpuestos { get; set; }
    public decimal TotalDescuentos { get; set; }
    public decimal TotalPropinas { get; set; }
    public decimal Total { get; set; }
    public string Moneda { get; set; } = "MXN";

    // Status
    public bool Cancelada { get; set; }
    public bool Pagada { get; set; }

    // Line items
    public List<SRVentaDetalle> Detalles { get; set; } = new();

    // Payments
    public List<SRPago> Pagos { get; set; } = new();
}

public class SRVentaDetalle
{
    public string Codigo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Importe { get; set; }
    public decimal Descuento { get; set; }
    public decimal Impuesto { get; set; }
    public string? Modificadores { get; set; }
    public string? Notas { get; set; }
}

public class SRPago
{
    public string FormaPago { get; set; } = string.Empty;
    public decimal Monto { get; set; }
    public string? Referencia { get; set; }
    public decimal Propina { get; set; }
}
```

### 3.4 Repositorio de Datos

```csharp
// src/TisTis.Agent.Core/Database/SoftRestaurantRepository.cs

using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace TisTis.Agent.Core.Database;

public class SoftRestaurantRepository : ISoftRestaurantRepository
{
    private readonly string _connectionString;
    private readonly ILogger<SoftRestaurantRepository> _logger;

    // Track last synced record to support incremental sync
    private DateTime _lastSyncTimestamp = DateTime.MinValue;
    private long _lastSyncedVentaId = 0;

    public SoftRestaurantRepository(
        string connectionString,
        ILogger<SoftRestaurantRepository> logger)
    {
        _connectionString = connectionString;
        _logger = logger;
    }

    /// <summary>
    /// Get new sales since last sync
    /// </summary>
    public async Task<List<SRVenta>> GetNewVentasAsync(
        int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var ventas = new List<SRVenta>();

        const string query = @"
            SELECT TOP (@Limit)
                v.IdVenta,
                v.NumeroOrden,
                v.Folio AS FolioVenta,
                v.Estacion,
                v.Almacen,
                v.FechaApertura,
                v.FechaCierre,
                v.NumeroMesa,
                v.CodigoCliente,
                c.Nombre AS NombreCliente,
                v.CodigoEmpleado AS CodigoMesero,
                e.Nombre AS NombreMesero,
                v.Observaciones,
                v.Subtotal AS SubtotalSinImpuestos,
                v.Impuestos AS TotalImpuestos,
                v.Descuento AS TotalDescuentos,
                v.Propina AS TotalPropinas,
                v.Total,
                v.Cancelada,
                v.Pagada
            FROM dbo.Ventas v
            LEFT JOIN dbo.Clientes c ON v.CodigoCliente = c.Codigo
            LEFT JOIN dbo.Empleados e ON v.CodigoEmpleado = e.Codigo
            WHERE v.IdVenta > @LastId
              AND v.FechaCierre IS NOT NULL
              AND v.Cancelada = 0
            ORDER BY v.IdVenta ASC";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(query, connection);
        command.Parameters.AddWithValue("@Limit", limit);
        command.Parameters.AddWithValue("@LastId", _lastSyncedVentaId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var venta = MapVentaFromReader(reader);
            ventas.Add(venta);

            // Update tracking
            var currentId = reader.GetInt64(reader.GetOrdinal("IdVenta"));
            if (currentId > _lastSyncedVentaId)
            {
                _lastSyncedVentaId = currentId;
            }
        }

        // Load details and payments for each venta
        foreach (var venta in ventas)
        {
            venta.Detalles = await GetVentaDetallesAsync(venta.NumeroOrden, connection, cancellationToken);
            venta.Pagos = await GetVentaPagosAsync(venta.NumeroOrden, connection, cancellationToken);
        }

        _logger.LogDebug("Retrieved {Count} new ventas since ID {LastId}", ventas.Count, _lastSyncedVentaId);

        return ventas;
    }

    /// <summary>
    /// Get all products/menu items
    /// </summary>
    public async Task<List<SRProducto>> GetProductosAsync(
        bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        var productos = new List<SRProducto>();

        const string query = @"
            SELECT
                p.Codigo,
                p.Descripcion,
                p.Precio,
                p.PrecioMayoreo,
                c.Descripcion AS Categoria,
                p.Activo,
                p.EsReceta,
                p.TiempoPreparacion,
                p.Calorias,
                p.Alergenos
            FROM dbo.Productos p
            LEFT JOIN dbo.Categorias c ON p.CodigoCategoria = c.Codigo
            WHERE (@IncludeInactive = 1 OR p.Activo = 1)
            ORDER BY c.Descripcion, p.Descripcion";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(query, connection);
        command.Parameters.AddWithValue("@IncludeInactive", includeInactive ? 1 : 0);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            productos.Add(MapProductoFromReader(reader));
        }

        _logger.LogDebug("Retrieved {Count} productos", productos.Count);

        return productos;
    }

    /// <summary>
    /// Get inventory items
    /// </summary>
    public async Task<List<SRInventario>> GetInventarioAsync(
        CancellationToken cancellationToken = default)
    {
        var items = new List<SRInventario>();

        const string query = @"
            SELECT
                i.Codigo,
                i.Descripcion,
                i.UnidadMedida,
                i.ExistenciaActual,
                i.ExistenciaMinima,
                i.CostoPromedio,
                i.UltimaCompra,
                c.Descripcion AS Categoria,
                i.Activo
            FROM dbo.Inventario i
            LEFT JOIN dbo.CategoriasInventario c ON i.CodigoCategoria = c.Codigo
            WHERE i.Activo = 1
            ORDER BY c.Descripcion, i.Descripcion";

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new SqlCommand(query, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapInventarioFromReader(reader));
        }

        _logger.LogDebug("Retrieved {Count} inventory items", items.Count);

        return items;
    }

    // ... Private mapping methods
    private SRVenta MapVentaFromReader(SqlDataReader reader) { /* ... */ }
    private SRProducto MapProductoFromReader(SqlDataReader reader) { /* ... */ }
    private SRInventario MapInventarioFromReader(SqlDataReader reader) { /* ... */ }
    // ...
}
```

### 3.5 Motor de Sincronización

```csharp
// src/TisTis.Agent.Core/Sync/SyncEngine.cs

using Microsoft.Extensions.Logging;

namespace TisTis.Agent.Core.Sync;

public class SyncEngine : ISyncEngine
{
    private readonly ISoftRestaurantRepository _repository;
    private readonly ITisTisApiClient _apiClient;
    private readonly ILogger<SyncEngine> _logger;
    private readonly SyncOptions _options;

    private readonly VentasTransformer _ventasTransformer;
    private readonly ProductosTransformer _productosTransformer;
    private readonly InventarioTransformer _inventarioTransformer;

    private bool _isRunning;
    private CancellationTokenSource? _cts;

    public SyncEngine(
        ISoftRestaurantRepository repository,
        ITisTisApiClient apiClient,
        SyncOptions options,
        ILogger<SyncEngine> logger)
    {
        _repository = repository;
        _apiClient = apiClient;
        _options = options;
        _logger = logger;

        _ventasTransformer = new VentasTransformer();
        _productosTransformer = new ProductosTransformer();
        _inventarioTransformer = new InventarioTransformer();
    }

    /// <summary>
    /// Start the sync loop
    /// </summary>
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (_isRunning)
        {
            _logger.LogWarning("Sync engine is already running");
            return;
        }

        _isRunning = true;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

        _logger.LogInformation(
            "Starting sync engine. Interval: {Interval}s, Sales: {Sales}, Menu: {Menu}, Inventory: {Inv}",
            _options.IntervalSeconds,
            _options.SyncSales,
            _options.SyncMenu,
            _options.SyncInventory);

        // Initial sync
        await PerformFullSyncAsync(_cts.Token);

        // Periodic sync loop
        while (!_cts.Token.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(_options.IntervalSeconds), _cts.Token);
                await PerformIncrementalSyncAsync(_cts.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in sync loop, will retry");
                await _apiClient.SendHeartbeatAsync("error", ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(5), _cts.Token); // Brief pause before retry
            }
        }

        _isRunning = false;
        _logger.LogInformation("Sync engine stopped");
    }

    /// <summary>
    /// Perform initial full sync
    /// </summary>
    private async Task PerformFullSyncAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting full sync...");

        // 1. Sync menu/products (if enabled)
        if (_options.SyncMenu)
        {
            await SyncProductosAsync(cancellationToken);
        }

        // 2. Sync inventory (if enabled)
        if (_options.SyncInventory)
        {
            await SyncInventarioAsync(cancellationToken);
        }

        // 3. Sync recent sales (if enabled)
        if (_options.SyncSales)
        {
            await SyncVentasAsync(limit: 1000, cancellationToken);
        }

        _logger.LogInformation("Full sync completed");
    }

    /// <summary>
    /// Perform incremental sync (only new sales)
    /// </summary>
    private async Task PerformIncrementalSyncAsync(CancellationToken cancellationToken)
    {
        if (_options.SyncSales)
        {
            await SyncVentasAsync(limit: 100, cancellationToken);
        }

        // Send heartbeat after successful sync
        await _apiClient.SendHeartbeatAsync("connected");
    }

    /// <summary>
    /// Sync sales to TIS TIS
    /// </summary>
    private async Task SyncVentasAsync(int limit, CancellationToken cancellationToken)
    {
        _logger.LogDebug("Syncing ventas...");

        var ventas = await _repository.GetNewVentasAsync(limit, cancellationToken);

        if (ventas.Count == 0)
        {
            _logger.LogDebug("No new ventas to sync");
            return;
        }

        // Transform to TIS TIS format
        var transformed = ventas.Select(v => _ventasTransformer.Transform(v)).ToList();

        // Send in batches
        var batchId = Guid.NewGuid().ToString();
        var batches = transformed.Chunk(_options.BatchSize).ToList();

        for (int i = 0; i < batches.Count; i++)
        {
            var batch = batches[i];

            var request = new SyncRequest
            {
                SyncType = "sales",
                BatchId = batchId,
                BatchIndex = i,
                BatchTotal = batches.Count,
                Data = batch
            };

            var response = await _apiClient.SendSyncDataAsync(request, cancellationToken);

            if (!response.Success)
            {
                _logger.LogError("Sync batch {Index}/{Total} failed: {Error}",
                    i + 1, batches.Count, response.Error);
                throw new SyncException($"Batch sync failed: {response.Error}");
            }

            _logger.LogDebug("Sync batch {Index}/{Total} completed: {Processed} records",
                i + 1, batches.Count, response.Result?.Processed ?? 0);
        }

        _logger.LogInformation("Synced {Count} ventas in {Batches} batches",
            ventas.Count, batches.Count);
    }

    /// <summary>
    /// Sync products/menu to TIS TIS
    /// </summary>
    private async Task SyncProductosAsync(CancellationToken cancellationToken)
    {
        _logger.LogDebug("Syncing productos...");

        var productos = await _repository.GetProductosAsync(
            includeInactive: false,
            cancellationToken);

        if (productos.Count == 0)
        {
            _logger.LogDebug("No productos to sync");
            return;
        }

        var transformed = productos.Select(p => _productosTransformer.Transform(p)).ToList();

        var request = new SyncRequest
        {
            SyncType = "menu",
            BatchId = Guid.NewGuid().ToString(),
            BatchIndex = 0,
            BatchTotal = 1,
            Data = transformed
        };

        var response = await _apiClient.SendSyncDataAsync(request, cancellationToken);

        if (!response.Success)
        {
            throw new SyncException($"Products sync failed: {response.Error}");
        }

        _logger.LogInformation("Synced {Count} productos", productos.Count);
    }

    /// <summary>
    /// Sync inventory to TIS TIS
    /// </summary>
    private async Task SyncInventarioAsync(CancellationToken cancellationToken)
    {
        _logger.LogDebug("Syncing inventario...");

        var items = await _repository.GetInventarioAsync(cancellationToken);

        if (items.Count == 0)
        {
            _logger.LogDebug("No inventory items to sync");
            return;
        }

        var transformed = items.Select(i => _inventarioTransformer.Transform(i)).ToList();

        var request = new SyncRequest
        {
            SyncType = "inventory",
            BatchId = Guid.NewGuid().ToString(),
            BatchIndex = 0,
            BatchTotal = 1,
            Data = transformed
        };

        var response = await _apiClient.SendSyncDataAsync(request, cancellationToken);

        if (!response.Success)
        {
            throw new SyncException($"Inventory sync failed: {response.Error}");
        }

        _logger.LogInformation("Synced {Count} inventory items", items.Count);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _cts?.Cancel();
        return Task.CompletedTask;
    }
}
```

### 3.6 Worker Service Principal

```csharp
// src/TisTis.Agent.Service/AgentWorker.cs

using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Detection;
using TisTis.Agent.Core.Sync;
using TisTis.Agent.Core.Api;

namespace TisTis.Agent.Service;

public class AgentWorker : BackgroundService
{
    private readonly ILogger<AgentWorker> _logger;
    private readonly AgentConfiguration _config;
    private readonly ISoftRestaurantDetector _detector;
    private readonly ITisTisApiClient _apiClient;
    private readonly IServiceProvider _serviceProvider;

    private ISyncEngine? _syncEngine;

    public AgentWorker(
        ILogger<AgentWorker> logger,
        IOptions<AgentConfiguration> config,
        ISoftRestaurantDetector detector,
        ITisTisApiClient apiClient,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _config = config.Value;
        _detector = detector;
        _apiClient = apiClient;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("TIS TIS Agent for Soft Restaurant starting...");
        _logger.LogInformation("Version: {Version}", _config.AgentVersion);
        _logger.LogInformation("Machine: {Machine}", Environment.MachineName);

        try
        {
            // Step 1: Detect Soft Restaurant
            _logger.LogInformation("Detecting Soft Restaurant installation...");
            var detection = await _detector.DetectAsync(stoppingToken);

            if (!detection.Success)
            {
                _logger.LogError(
                    "Failed to detect Soft Restaurant. " +
                    "Ensure SQL Server is running and database is accessible.");

                // Keep retrying every 5 minutes
                while (!stoppingToken.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                    detection = await _detector.DetectAsync(stoppingToken);

                    if (detection.Success) break;

                    _logger.LogWarning("Retrying detection...");
                }
            }

            if (stoppingToken.IsCancellationRequested) return;

            // Step 2: Register with TIS TIS
            _logger.LogInformation("Registering with TIS TIS...");
            var registrationResult = await _apiClient.RegisterAsync(
                new RegisterRequest
                {
                    TenantId = _config.TenantId,
                    IntegrationId = _config.IntegrationId,
                    AgentId = _config.AgentId,
                    AgentVersion = _config.AgentVersion,
                    MachineName = Environment.MachineName,
                    SRVersion = detection.Version ?? "Unknown",
                    SRDatabaseName = detection.DatabaseName!,
                    SRSqlInstance = detection.SqlInstance!,
                    SREmpresaId = detection.EmpresaId ?? "Default"
                },
                stoppingToken);

            if (!registrationResult.Success)
            {
                _logger.LogError("Failed to register with TIS TIS: {Error}", registrationResult.Error);
                return;
            }

            _logger.LogInformation("Registration successful!");

            // Step 3: Create and start sync engine
            var repository = new SoftRestaurantRepository(
                detection.ConnectionString!,
                _serviceProvider.GetRequiredService<ILogger<SoftRestaurantRepository>>());

            var syncOptions = new SyncOptions
            {
                IntervalSeconds = registrationResult.SyncConfig?.IntervalSeconds ?? 30,
                SyncSales = registrationResult.SyncConfig?.SyncSales ?? true,
                SyncMenu = registrationResult.SyncConfig?.SyncMenu ?? true,
                SyncInventory = registrationResult.SyncConfig?.SyncInventory ?? true,
                BatchSize = 50
            };

            _syncEngine = new SyncEngine(
                repository,
                _apiClient,
                syncOptions,
                _serviceProvider.GetRequiredService<ILogger<SyncEngine>>());

            // Step 4: Start sync loop
            await _syncEngine.StartAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Agent shutdown requested");
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Fatal error in agent worker");
            throw;
        }
        finally
        {
            _logger.LogInformation("TIS TIS Agent stopped");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping TIS TIS Agent...");

        if (_syncEngine != null)
        {
            await _syncEngine.StopAsync(cancellationToken);
        }

        // Send final heartbeat indicating shutdown
        try
        {
            await _apiClient.SendHeartbeatAsync("offline", "Agent shutdown");
        }
        catch { /* Best effort */ }

        await base.StopAsync(cancellationToken);
    }
}
```

### 3.7 Archivos a Crear (Resumen Fase 3)

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| Crear | `TisTis.Agent.SoftRestaurant.sln` | Solución .NET |
| Crear | `TisTis.Agent.Core/` | Biblioteca principal |
| Crear | `TisTis.Agent.Service/` | Windows Service |
| Crear | `Detection/*.cs` | Detectores de SR |
| Crear | `Database/*.cs` | Repositorio y modelos |
| Crear | `Sync/*.cs` | Motor de sincronización |
| Crear | `Api/*.cs` | Cliente API TIS TIS |
| Crear | `Security/*.cs` | Gestión de credenciales |

### 3.8 Criterios de Aceptación Fase 3

- [ ] Solución .NET compila sin errores
- [ ] Detector encuentra instalación de SR correctamente
- [ ] Repositorio puede leer datos de SR
- [ ] Motor de sync transforma y envía datos
- [ ] Servicio Windows se instala y ejecuta
- [ ] Heartbeats se envían regularmente
- [ ] Errores se manejan y reportan correctamente
- [ ] Logs se escriben a Event Viewer

---

## FASE 4 - FASE 9: (Continuación)

*Por brevedad, las fases 4-9 se documentan en formato resumido. Cada una se expandirá en detalle cuando se inicie su implementación.*

---

## FASE 4: Agente Windows - Instalador

### 4.1 Tecnología: WiX Toolset v4

### 4.2 Microfases

| Microfase | Descripción |
|-----------|-------------|
| 4.1 | Estructura de proyecto WiX |
| 4.2 | Diálogos de UI personalizados |
| 4.3 | Custom Actions para detección |
| 4.4 | Instalación de servicio Windows |
| 4.5 | Desinstalación limpia |

### 4.3 Flujo del Instalador

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Welcome    │────▶│  Detection   │────▶│  Configure   │────▶│   Install    │
│   Dialog     │     │   Dialog     │     │    Dialog    │     │   Progress   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      │                    │                    │                    │
      │              [Auto-detect SR]    [Show Connection]    [Install Service]
      │              [Show Results]      [Test Connection]    [Start Service]
      │                    │                    │                    │
      │                    ▼                    ▼                    ▼
      │              ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
      │              │ SR Database: │     │ Sync Options:│     │   Status:    │
      │              │ DVSOFT       │     │ ☑ Ventas     │     │ ✓ Installed  │
      │              │ Instance:    │     │ ☑ Menú       │     │ ✓ Running    │
      │              │ SQLEXPRESS   │     │ ☑ Inventario │     │ ✓ Connected  │
      └──────────────└──────────────┘     └──────────────┘     └──────────────┘
```

---

## FASE 5: Sincronización y Transformación

### 5.1 Microfases

| Microfase | Descripción |
|-----------|-------------|
| 5.1 | Queries optimizadas para SR |
| 5.2 | Transformadores de datos |
| 5.3 | Batching y compresión |
| 5.4 | Manejo de errores y retry |
| 5.5 | Sync incremental vs full |

### 5.2 Transformación de Datos

```
SR Database                    JSON Payload                 TIS TIS Tables
───────────────────────────────────────────────────────────────────────────
Ventas.Folio          ──────▶  FolioVenta           ──────▶ sr_sales.folio_venta
Ventas.FechaCierre    ──────▶  FechaCierre          ──────▶ sr_sales.closed_at
DetalleVentas.Codigo  ──────▶  Productos[].Codigo   ──────▶ sr_sale_items.product_code
DetalleVentas.Precio  ──────▶  Productos[].Precio   ──────▶ sr_sale_items.unit_price
PagosVenta.FormaPago  ──────▶  Pagos[].FormaPago    ──────▶ sr_payments.payment_method
```

---

## FASE 6: Seguridad y Autenticación

### 6.1 Microfases

| Microfase | Descripción |
|-----------|-------------|
| 6.1 | DPAPI para credenciales locales |
| 6.2 | Token rotation |
| 6.3 | TLS 1.3 enforcement |
| 6.4 | Audit logging |

### 6.2 Almacenamiento Seguro

```csharp
// Credenciales encriptadas con DPAPI (Windows Data Protection API)
public class CredentialStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("TIS-TIS-Agent-2026");

    public static void SaveCredential(string key, string value)
    {
        var encrypted = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(value),
            Entropy,
            DataProtectionScope.LocalMachine
        );

        // Save to Windows Credential Manager or Registry
    }

    public static string LoadCredential(string key)
    {
        // Load encrypted bytes
        var decrypted = ProtectedData.Unprotect(
            encrypted,
            Entropy,
            DataProtectionScope.LocalMachine
        );

        return Encoding.UTF8.GetString(decrypted);
    }
}
```

---

## FASE 7: Monitoreo y Observabilidad

### 7.1 Microfases

| Microfase | Descripción |
|-----------|-------------|
| 7.1 | Dashboard de estado en TIS TIS |
| 7.2 | Alertas de desconexión |
| 7.3 | Métricas de sync |
| 7.4 | Event Viewer integration |

### 7.2 Métricas Principales

| Métrica | Descripción | Alerta |
|---------|-------------|--------|
| `agent.heartbeat.last` | Último heartbeat | > 5 min = offline |
| `agent.sync.records_per_minute` | Throughput | < 0 = stalled |
| `agent.sync.errors_consecutive` | Errores seguidos | > 3 = warning |
| `agent.sync.latency_ms` | Latencia de sync | > 5000ms = slow |

---

## FASE 8: Testing y QA

### 8.1 Microfases

| Microfase | Descripción |
|-----------|-------------|
| 8.1 | Unit tests (C# y TypeScript) |
| 8.2 | Integration tests |
| 8.3 | E2E tests |
| 8.4 | Load testing |
| 8.5 | Security testing |

### 8.2 Matriz de Testing

| Componente | Unit | Integration | E2E |
|------------|------|-------------|-----|
| Detector SR | ✓ | ✓ | |
| Repositorio | ✓ | ✓ | |
| Sync Engine | ✓ | ✓ | ✓ |
| API Endpoints | ✓ | ✓ | ✓ |
| UI Components | ✓ | | ✓ |
| Instalador | | ✓ | ✓ |

---

## FASE 9: Documentación y Rollout

### 9.1 Microfases

| Microfase | Descripción |
|-----------|-------------|
| 9.1 | Documentación técnica |
| 9.2 | Guía de usuario |
| 9.3 | Release y distribución |

### 9.2 Entregables

- README.md del agente
- Guía de instalación (PDF)
- Troubleshooting guide
- API documentation
- Video tutorial

---

## Apéndices

### A. Esquema de Base de Datos SR (Referencia)

```sql
-- Tablas principales de Soft Restaurant
dbo.Ventas              -- Encabezado de ventas
dbo.DetalleVentas       -- Líneas de venta
dbo.PagosVenta          -- Pagos aplicados
dbo.Productos           -- Catálogo de productos
dbo.Categorias          -- Categorías de productos
dbo.Inventario          -- Inventario de insumos
dbo.Empleados           -- Meseros y staff
dbo.Clientes            -- Clientes registrados
dbo.Mesas               -- Mesas del restaurante
```

### B. Códigos de Error del Agente

| Código | Descripción | Acción |
|--------|-------------|--------|
| `E001` | No se encontró SQL Server | Verificar instalación |
| `E002` | No se encontró base de datos SR | Verificar nombre BD |
| `E003` | Error de autenticación SQL | Verificar credenciales |
| `E004` | Error de conexión a TIS TIS | Verificar red/firewall |
| `E005` | Token expirado | Regenerar token |
| `E006` | Rate limit excedido | Esperar y reintentar |

### C. Variables de Entorno

```env
# Agente Windows (appsettings.json)
TISTIS_AGENT_ID=tis-agent-xxx
TISTIS_WEBHOOK_URL=https://app.tistis.com/api/agent/sync
TISTIS_AUTH_TOKEN=<encrypted>
TISTIS_SYNC_INTERVAL=30
TISTIS_LOG_LEVEL=Information
```

### D. Compatibilidad

| Componente | Versión Mínima | Recomendada |
|------------|----------------|-------------|
| Windows | 10 / Server 2016 | 11 / Server 2022 |
| .NET Runtime | 8.0 | 8.0 LTS |
| SQL Server | 2014 | 2019+ |
| Soft Restaurant | 10.0 | 10.5+ / 11.x |

---

## Historial de Cambios

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0.0 | 2026-01-30 | Claude Code | Documento inicial |

---

## Aprobaciones

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Product Owner | | | |
| Tech Lead | | | |
| Security | | | |
| QA Lead | | | |

---

*Fin del Documento*
