# TIS TIS PLATFORM - Pestaña de Configuración API

**Fecha:** 2026-01-20
**Version:** 1.0
**Estado:** IMPLEMENTADO
**Ubicacion:** `/src/features/api-settings/`

---

## RESUMEN

La pestaña de configuración API permite a los usuarios gestionar sus claves de acceso a la API de TIS TIS, ver documentación interactiva y probar endpoints en un sandbox integrado.

---

## 1. ESTRUCTURA DE COMPONENTES

```
src/features/api-settings/
├── components/
│   ├── APIKeysSection.tsx      # Componente principal (tabs + lista + modales)
│   ├── APIKeyCard.tsx          # Card para mostrar cada API Key
│   ├── CreateAPIKeyModal.tsx   # Modal para crear nueva key
│   ├── APIKeyDetailModal.tsx   # Modal con detalles completos
│   ├── APIKeySecretDisplay.tsx # Componente para mostrar el secret (solo 1 vez)
│   ├── ScopeSelector.tsx       # Selector de permisos/scopes
│   ├── APIDocumentation.tsx    # Documentación interactiva inline
│   ├── APISandbox.tsx          # Sandbox para probar endpoints
│   └── AuditHistory.tsx        # Historial de uso de la key
├── hooks/
│   └── useAPIKeys.ts           # Hook para CRUD de API Keys
├── types/
│   ├── apiKey.types.ts         # Tipos principales
│   └── index.ts                # Re-exports
├── utils/
│   └── scopeValidator.ts       # Validación de scopes
└── constants/
    └── index.ts                # Constantes (rate limits por plan)
```

---

## 2. FUNCIONALIDADES

### 2.1 Gestión de API Keys

| Funcionalidad | Descripción |
|---------------|-------------|
| **Crear API Key** | Genera nueva key con nombre, scopes, rate limits |
| **Ver detalles** | Muestra configuración completa, uso, historial |
| **Revocar** | Desactiva permanentemente una key |
| **Rotar** | Genera nueva key manteniendo configuración |
| **Filtrar** | Por estado (activa/revocada/expirada) y entorno (live/test) |

### 2.2 Información de Integración

El componente `IntegrationInfo` muestra:

```typescript
// Webhook URL para el tenant
`${origin}/api/v1/webhook/${tenantId}`

// Tenant ID
tenantId: string  // UUID del tenant
```

### 2.3 Documentación Inline

La pestaña "Documentación" muestra:

- **Autenticación**: Cómo usar el header `X-API-Key`
- **Endpoints disponibles**: GET/POST/PUT/DELETE con ejemplos
- **Scopes**: Permisos requeridos por endpoint
- **Errores**: Códigos de error y respuestas
- **Rate Limits**: Límites por minuto y diario

### 2.4 Sandbox

La pestaña "Sandbox" permite:

- Seleccionar endpoint y método
- Ingresar parámetros
- Ver respuesta en tiempo real
- Copiar código de ejemplo (curl, JavaScript, Python)

---

## 3. TIPOS PRINCIPALES

### 3.1 APIKey

```typescript
interface APIKey {
  id: string;
  tenant_id: string;
  created_by: string;

  // Identificación
  name: string;
  description?: string;
  key_hint: string;      // "...a4f7"
  key_prefix: APIKeyPrefix;  // "tis_live_" | "tis_test_"

  // Entorno
  environment: 'live' | 'test';

  // Permisos
  scopes: string[];      // ["leads:read", "leads:write", ...]

  // Rate limiting
  rate_limit_rpm: number;   // Requests per minute
  rate_limit_daily: number; // Requests per day

  // Seguridad
  ip_whitelist?: string[];
  expires_at?: string;

  // Estado
  is_active: boolean;

  // Tracking de uso
  last_used_at?: string;
  last_used_ip?: string;
  last_used_endpoint?: string;
  usage_count: number;
  usage_count_today?: number;

  // Auditoría
  created_at: string;
  updated_at: string;
  revoked_at?: string;
  revoked_by?: string;
  revoke_reason?: string;
}
```

### 3.2 Scopes Disponibles

```typescript
type APIScope =
  // Leads
  | 'leads:read'
  | 'leads:write'
  | 'leads:delete'
  // Conversations
  | 'conversations:read'
  | 'conversations:write'
  // Reservations
  | 'reservations:read'
  | 'reservations:write'
  | 'reservations:delete'
  // Appointments
  | 'appointments:read'
  | 'appointments:write'
  | 'appointments:delete'
  // Business
  | 'business:read'
  | 'business:write'
  // Analytics
  | 'analytics:read'
  // Voice
  | 'voice:read'
  | 'voice:manage'
  // Webhooks
  | 'webhooks:manage';
```

### 3.3 Rate Limits por Plan

```typescript
const PLAN_LIMITS: Record<string, PlanRateLimits> = {
  starter: {
    default_rpm: 60,
    default_daily: 1000,
    max_rpm: 100,
    max_daily: 5000,
    max_keys: 2,
  },
  professional: {
    default_rpm: 120,
    default_daily: 10000,
    max_rpm: 300,
    max_daily: 50000,
    max_keys: 5,
  },
  enterprise: {
    default_rpm: 300,
    default_daily: 100000,
    max_rpm: 1000,
    max_daily: 500000,
    max_keys: 20,
  },
};
```

---

## 4. ENDPOINTS DE LA API

### 4.1 Leads API

| Método | Endpoint | Scope | Descripción |
|--------|----------|-------|-------------|
| GET | `/api/v1/leads` | `leads:read` | Lista leads con paginación |
| GET | `/api/v1/leads/:id` | `leads:read` | Detalle de un lead |
| POST | `/api/v1/leads` | `leads:write` | Crear nuevo lead |
| PATCH | `/api/v1/leads/:id` | `leads:write` | Actualizar lead |
| DELETE | `/api/v1/leads/:id` | `leads:delete` | Eliminar lead |

### 4.2 Reservations API

| Método | Endpoint | Scope | Descripción |
|--------|----------|-------|-------------|
| GET | `/api/v1/reservations` | `reservations:read` | Lista reservaciones |
| GET | `/api/v1/reservations/:id` | `reservations:read` | Detalle |
| POST | `/api/v1/reservations` | `reservations:write` | Crear reservación |
| PATCH | `/api/v1/reservations/:id` | `reservations:write` | Modificar |
| DELETE | `/api/v1/reservations/:id` | `reservations:delete` | Cancelar |
| GET | `/api/v1/reservations/availability` | `reservations:read` | Disponibilidad |

### 4.3 Appointments API (Dental)

| Método | Endpoint | Scope | Descripción |
|--------|----------|-------|-------------|
| GET | `/api/v1/appointments` | `appointments:read` | Lista citas |
| GET | `/api/v1/appointments/:id` | `appointments:read` | Detalle |
| POST | `/api/v1/appointments` | `appointments:write` | Crear cita |
| PATCH | `/api/v1/appointments/:id` | `appointments:write` | Modificar |
| DELETE | `/api/v1/appointments/:id` | `appointments:delete` | Cancelar |

### 4.4 Voice API

| Método | Endpoint | Scope | Descripción |
|--------|----------|-------|-------------|
| GET | `/api/v1/voice/calls` | `voice:read` | Lista llamadas |
| GET | `/api/v1/voice/calls/:id` | `voice:read` | Detalle de llamada |
| GET | `/api/v1/voice/analytics` | `voice:read` | Analytics de voz |

### 4.5 Webhook Events

| Método | Endpoint | Scope | Descripción |
|--------|----------|-------|-------------|
| POST | `/api/v1/webhooks` | `webhooks:manage` | Registrar webhook |
| GET | `/api/v1/webhooks` | `webhooks:manage` | Lista webhooks |
| DELETE | `/api/v1/webhooks/:id` | `webhooks:manage` | Eliminar webhook |

---

## 5. AUTENTICACIÓN

### 5.1 Header de API Key

```http
GET /api/v1/leads HTTP/1.1
Host: app.tistis.com
X-API-Key: tis_live_abc123...
```

### 5.2 Formato de API Key

```
Prefijo:     tis_live_ | tis_test_
Longitud:    32 caracteres random
Ejemplo:     tis_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 5.3 Validación

La key se valida en cada request:

1. **Formato**: Debe empezar con `tis_live_` o `tis_test_`
2. **Existencia**: Hash de la key debe existir en la DB
3. **Estado**: Debe estar activa (`is_active = true`)
4. **Expiración**: No debe estar expirada
5. **IP**: Si hay whitelist, IP debe estar permitida
6. **Scope**: Debe tener el scope requerido por el endpoint
7. **Rate Limit**: No debe exceder límites

---

## 6. RESPUESTAS DE ERROR

### 6.1 Códigos de Error

| Código | Nombre | Descripción |
|--------|--------|-------------|
| 401 | `MISSING_KEY` | No se proporcionó API Key |
| 401 | `INVALID_FORMAT` | Formato de key inválido |
| 401 | `KEY_NOT_FOUND` | Key no existe |
| 401 | `KEY_REVOKED` | Key fue revocada |
| 401 | `KEY_EXPIRED` | Key expiró |
| 403 | `IP_NOT_ALLOWED` | IP no está en whitelist |
| 403 | `INSUFFICIENT_SCOPE` | Sin permiso para este scope |
| 429 | `RATE_LIMIT_EXCEEDED` | Límite de requests excedido |

### 6.2 Formato de Error

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 60,
    "current": 61,
    "retry_after_seconds": 45
  }
}
```

---

## 7. COMPONENTE PRINCIPAL

### 7.1 APIKeysSection Props

```typescript
interface APIKeysSectionProps {
  vertical?: 'dental' | 'restaurant';  // Afecta scopes disponibles
  plan?: string;                        // Afecta rate limits máximos
  className?: string;
}
```

### 7.2 Tabs Disponibles

| Tab | Componente | Descripción |
|-----|------------|-------------|
| API Keys | `KeysList` | Lista y gestión de keys |
| Documentación | `APIDocumentation` | Docs interactivos |
| Sandbox | `APISandbox` | Prueba de endpoints |

### 7.3 Estados de la UI

```typescript
// Estados de filtro
type FilterStatus = 'all' | 'active' | 'revoked' | 'expired';
type FilterEnvironment = 'all' | 'live' | 'test';

// Estado de la lista
const { keys, loading, error, refresh, createKey, updateKey, revokeKey, rotateKey } = useAPIKeys();
```

---

## 8. HOOKS

### 8.1 useAPIKeys

```typescript
const {
  // Data
  keys: APIKeyListItem[],

  // State
  loading: boolean,
  error: string | null,

  // Actions
  refresh: () => Promise<void>,
  createKey: (data: CreateAPIKeyRequest) => Promise<CreateAPIKeyResponse>,
  updateKey: (id: string, data: UpdateAPIKeyRequest) => Promise<void>,
  revokeKey: (id: string, reason?: string) => Promise<void>,
  rotateKey: (id: string, gracePeriodHours?: number) => Promise<CreateAPIKeyResponse>,
} = useAPIKeys();
```

### 8.2 useAPIKeyDetail

```typescript
const {
  key: APIKeyWithCreator | null,
  loading: boolean,
  refresh: () => Promise<void>,
} = useAPIKeyDetail(keyId: string | null);
```

---

## 9. FLUJO DE CREACIÓN DE API KEY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FLUJO DE CREACIÓN DE API KEY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. Usuario hace clic en "Nueva API Key"                                   │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    CreateAPIKeyModal                                 │   │
│   │                                                                      │   │
│   │   - Nombre (requerido)                                              │   │
│   │   - Descripción (opcional)                                          │   │
│   │   - Entorno: Live | Test                                            │   │
│   │   - Scopes: [ScopeSelector]                                         │   │
│   │   - Rate Limits (rpm, daily)                                        │   │
│   │   - IP Whitelist (opcional)                                         │   │
│   │   - Fecha de expiración (opcional)                                  │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│          │                                                                   │
│          │ Submit                                                            │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Backend (API Route)                               │   │
│   │                                                                      │   │
│   │   1. Validar datos                                                  │   │
│   │   2. Verificar límite de keys del plan                              │   │
│   │   3. Generar key random (32 chars)                                  │   │
│   │   4. Crear hash SHA-256                                             │   │
│   │   5. Guardar hash en DB (NUNCA el key original)                    │   │
│   │   6. Retornar key completo (SOLO ESTA VEZ)                         │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                  APIKeySecretDisplay                                 │   │
│   │                                                                      │   │
│   │   ⚠️ IMPORTANTE: Este es el único momento que verás tu API Key     │   │
│   │                                                                      │   │
│   │   ┌──────────────────────────────────────────────────────────────┐  │   │
│   │   │  tis_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6                  │  │   │
│   │   └──────────────────────────────────────────────────────────────┘  │   │
│   │                                                     [Copiar]        │   │
│   │                                                                      │   │
│   │   □ Confirmo que he copiado mi API Key                             │   │
│   │                                                         [Cerrar]    │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. SEGURIDAD

### 10.1 Almacenamiento

- **Nunca** se guarda el API Key en texto plano
- Solo se guarda el hash SHA-256
- El key solo se muestra una vez al crear

### 10.2 Validación

- Validación de firma HMAC en webhooks
- IP whitelist opcional por key
- Expiración configurable
- Scopes granulares por endpoint

### 10.3 Rate Limiting

- Límite por minuto (RPM)
- Límite diario
- Headers de respuesta con límites restantes:
  ```http
  X-RateLimit-Limit-Minute: 60
  X-RateLimit-Remaining-Minute: 45
  X-RateLimit-Limit-Daily: 1000
  X-RateLimit-Remaining-Daily: 892
  ```

---

## 11. INTEGRACIÓN CON SETTINGS

La pestaña API se integra en la sección de Configuración:

```typescript
// src/app/(dashboard)/settings/page.tsx
<Tabs>
  <Tab id="general">General</Tab>
  <Tab id="channels">Canales</Tab>
  <Tab id="ai">AI</Tab>
  <Tab id="api">API</Tab>  {/* ← Pestaña API */}
  <Tab id="team">Equipo</Tab>
</Tabs>

{activeTab === 'api' && (
  <APIKeysSection
    vertical={tenant.vertical}
    plan={tenant.plan}
  />
)}
```

---

*Este documento describe la implementación de la pestaña de configuración API de TIS TIS Platform.*
*Última actualización: 2026-01-20*
