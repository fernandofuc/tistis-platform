# 🏗️ PLAN MAESTRO: Multi-Branch API Architecture Fix

**Documento:** TIS-API-MULTIBRANCH-001
**Versión:** 1.0.0
**Fecha:** 2026-01-22
**Autor:** TIS TIS Engineering Team
**Estado:** APROBADO PARA EJECUCIÓN

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Contexto y Problemática](#contexto-y-problemática)
3. [Arquitectura Objetivo](#arquitectura-objetivo)
4. [Plan de Implementación](#plan-de-implementación)
   - [FASE 1: Parche Inmediato](#fase-1-parche-inmediato)
   - [FASE 2: Fix Estructural](#fase-2-fix-estructural)
   - [FASE 3: Optimización y Deprecación](#fase-3-optimización-y-deprecación)
5. [Plan de Testing](#plan-de-testing)
6. [Plan de Rollback](#plan-de-rollback)
7. [Métricas de Éxito](#métricas-de-éxito)
8. [Anexos](#anexos)

---

## 📊 RESUMEN EJECUTIVO

### Problema Identificado
Las API Keys de TIS TIS operan a nivel **tenant** sin filtrado por **sucursal (branch)**, causando que integraciones externas reciban datos mezclados de todas las sucursales de un mismo tenant.

### Impacto
- **Severidad:** 🔴 ALTA
- **Alcance:** Tenants multi-sucursal (estimado 15-20% de la base)
- **Riesgo:** Violación de privacidad, datos incorrectos en sistemas externos
- **Prioridad:** P1 - CRÍTICO

### Solución Propuesta
Implementación en 3 fases de un sistema de filtrado por sucursal:
1. **Parche inmediato** con query parameters (1-2 días)
2. **Fix estructural** con API Keys por sucursal (2-3 semanas)
3. **Optimización** y deprecación de API antigua (3-6 meses)

### Recursos Necesarios
- **Ingeniería:** 2 desarrolladores full-time
- **QA:** 1 QA engineer
- **DevOps:** Soporte para deploys
- **Tiempo Total:** 6-8 meses (desde parche hasta deprecación completa)

---

## 🔍 CONTEXTO Y PROBLEMÁTICA

### Arquitectura Actual

```
┌─────────────┐
│  API Client │ (Integración externa: CRM, POS, etc.)
└──────┬──────┘
       │ Authorization: Bearer tis_live_xxxxx
       ↓
┌─────────────────────────────────────────┐
│  GET /api/v1/leads                      │
│  - Autentica con API Key                │
│  - Valida scopes: "leads:read"          │
│  - Extrae tenant_id de la key           │
└──────┬──────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Database Query:                        │
│  SELECT * FROM leads                    │
│  WHERE tenant_id = 'xxx'                │  ❌ NO filtra por branch_id
│  ORDER BY created_at DESC               │
└──────┬──────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Response:                              │
│  {                                      │
│    "data": [                            │
│      { "id": 1, "branch_id": "A", ... },│  🔴 Sucursal A
│      { "id": 2, "branch_id": "B", ... },│  🔴 Sucursal B
│      { "id": 3, "branch_id": "C", ... } │  🔴 Sucursal C
│    ]                                    │
│  }                                      │
└─────────────────────────────────────────┘
```

### Problemas Específicos

#### Problema 1: API Keys sin Granularidad
```sql
-- Schema actual
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,     -- ✅ Tiene tenant
    -- ❌ NO tiene branch_id
    scopes JSONB NOT NULL
);
```

**Consecuencia:** Una API Key da acceso a TODAS las sucursales del tenant.

#### Problema 2: Endpoints sin Filtrado
```typescript
// Endpoint actual: /api/v1/leads/route.ts
let query = supabase
  .from('leads')
  .select('*')
  .eq('tenant_id', auth.tenantId!)  // ✅ Filtra tenant
  // ❌ NO filtra branch_id
```

**Consecuencia:** Retorna datos de todas las sucursales mezclados.

#### Problema 3: Scopes sin Contexto de Sucursal
```json
// Scopes actuales
{
  "scopes": ["leads:read", "appointments:write"]
}
```

**Consecuencia:** No existe concepto de "leads de la Sucursal A" vs "leads de la Sucursal B".

### Casos de Uso Afectados

#### Caso 1: Integración CRM Multi-Sucursal
**Cliente:** Cadena dental con 5 sucursales
**Integración:** Salesforce CRM
**Problema:**
- Sucursal "Polanco" recibe leads de "Satélite" en su CRM
- Vendedores confundidos con leads incorrectos
- Métricas de conversión distorsionadas

#### Caso 2: Sistema de Reservaciones
**Cliente:** Restaurante con 3 sucursales
**Integración:** OpenTable + app móvil propia
**Problema:**
- App móvil muestra reservaciones de las 3 sucursales
- Cliente reserva en Polanco pero aparece en Condesa
- Riesgo de doble booking

#### Caso 3: Analytics y BI
**Cliente:** Gimnasio con 8 sucursales
**Integración:** Power BI
**Problema:**
- Dashboard no puede separar métricas por sucursal
- Reportes agregados sin sentido
- Imposible hacer análisis comparativo entre sucursales

---

## 🏛️ ARQUITECTURA OBJETIVO

### Visión Final (Post-Fase 3)

```
┌─────────────┐
│  API Client │ (Integración para Sucursal "Polanco")
└──────┬──────┘
       │ Authorization: Bearer tis_live_branch_polanco_xxxxx
       ↓
┌─────────────────────────────────────────┐
│  GET /api/v1/leads                      │
│  - Autentica con API Key                │
│  - Valida scopes: "leads:read"          │
│  - Extrae tenant_id Y branch_id         │  ✅ Nuevo
└──────┬──────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Database Query:                        │
│  SELECT * FROM leads                    │
│  WHERE tenant_id = 'xxx'                │
│    AND branch_id = 'polanco-id'         │  ✅ Filtrado automático
│  ORDER BY created_at DESC               │
└──────┬──────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│  Response:                              │
│  {                                      │
│    "data": [                            │
│      { "id": 1, "branch_id": "A", ... },│  ✅ Solo Sucursal A
│      { "id": 2, "branch_id": "A", ... } │  ✅ Solo Sucursal A
│    ]                                    │
│  }                                      │
└─────────────────────────────────────────┘
```

### Componentes del Sistema

#### 1. API Keys con Branch Context
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    branch_id UUID REFERENCES branches(id),  -- ✅ Nuevo (opcional)
    scopes JSONB NOT NULL,

    -- Si branch_id IS NULL → acceso a todas las sucursales (legacy/admin)
    -- Si branch_id IS NOT NULL → acceso solo a esa sucursal
);
```

#### 2. Middleware de Filtrado Automático
```typescript
// Nuevo helper: src/lib/api/branch-filter.ts
export function applyBranchFilter(
  query: SupabaseQueryBuilder,
  auth: APIAuthResult,
  tableName: string
): SupabaseQueryBuilder {
  // Siempre filtrar por tenant
  query = query.eq('tenant_id', auth.tenantId);

  // Si API Key tiene branch_id, filtrar también por branch
  if (auth.branchId) {
    // Verificar que la tabla tenga columna branch_id
    if (tableHasBranchColumn(tableName)) {
      query = query.eq('branch_id', auth.branchId);
    }
  }

  return query;
}
```

#### 3. Scopes Granulares (Futuro - Opcional)
```json
{
  "scopes": [
    "leads:read",           // Básico: leer leads
    "branch:*:leads:read"   // Avanzado: leer leads de cualquier branch (admin)
  ],
  "branch_id": "polanco-uuid"  // Contexto de sucursal
}
```

### Principios de Diseño

1. **Retrocompatibilidad:** API Keys sin `branch_id` siguen funcionando (acceso completo)
2. **Opt-in Granular:** Clientes eligen crear keys por sucursal según necesidad
3. **Fail-safe:** Si tabla no tiene `branch_id`, no fallar (skip filtro)
4. **Auditabilidad:** Todos los accesos logueados con contexto de branch
5. **Performance:** Índices optimizados para queries con branch_id

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Timeline Global

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIMELINE: 6-8 MESES                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FASE 1: Parche Inmediato (Semana 1-2)                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                                   │
│  │                                                                  │
│  FASE 2: Fix Estructural (Semana 3-6)                             │
│         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      │
│  │                                                                  │
│  FASE 3: Optimización (Mes 2-6)                                   │
│                     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: PARCHE INMEDIATO

**Objetivo:** Proveer solución temporal vía query parameters
**Duración:** 1-2 días
**Riesgo:** 🟡 BAJO
**Impacto:** 🟢 INMEDIATO

### Documentación Completa en:
📄 [`FASE_1_PARCHE_INMEDIATO.md`](./FASE_1_PARCHE_INMEDIATO.md)

### Resumen de Cambios

1. **Modificar endpoints existentes** para aceptar `?branch_id=xxx`
2. **Actualizar documentación API** con ejemplos
3. **Agregar warnings** en responses cuando se omite branch_id
4. **Deploy inmediato** sin cambios de schema

### Entregables
- ✅ Endpoints actualizados (leads, appointments, menu items)
- ✅ Documentación API actualizada
- ✅ Tests de integración
- ✅ Comunicado a clientes multi-sucursal

---

## FASE 2: FIX ESTRUCTURAL

**Objetivo:** Implementar API Keys con contexto de sucursal
**Duración:** 2-3 semanas
**Riesgo:** 🟡 MEDIO
**Impacto:** 🔵 TRANSFORMACIONAL

### Documentación Completa en:
📄 [`FASE_2_FIX_ESTRUCTURAL.md`](./FASE_2_FIX_ESTRUCTURAL.md)

### Resumen de Cambios

1. **Migración de schema:** Agregar `branch_id` a `api_keys`
2. **Actualizar UI:** Permitir seleccionar branch al crear API Key
3. **Middleware de filtrado:** Aplicar automáticamente en todos los endpoints
4. **Migración de keys existentes:** Marcar como "todas las sucursales"

### Entregables
- ✅ Schema migrado
- ✅ UI de creación de API Keys actualizada
- ✅ Middleware de branch filtering
- ✅ Tests end-to-end
- ✅ Guía de migración para clientes

---

## FASE 3: OPTIMIZACIÓN Y DEPRECACIÓN

**Objetivo:** Optimizar sistema y deprecar APIs antiguas
**Duración:** 3-6 meses
**Riesgo:** 🟢 BAJO
**Impacto:** 🔵 CONSOLIDACIÓN

### Documentación Completa en:
📄 [`FASE_3_OPTIMIZACION.md`](./FASE_3_OPTIMIZACION.md)

### Resumen de Cambios

1. **Índices optimizados** para queries con branch_id
2. **Scopes granulares** (opcional, según demanda)
3. **Deprecación** de query parameter approach
4. **Analytics** de uso por sucursal
5. **Cleanup** de código legacy

### Entregables
- ✅ Performance optimizado (+30% en queries)
- ✅ Sistema de scopes granulares (v2)
- ✅ Herramientas de migración automática
- ✅ Dashboard de analytics por branch
- ✅ Documentación final consolidada

---

## 🧪 PLAN DE TESTING

### Documentación Completa en:
📄 [`TESTING_PLAN.md`](./TESTING_PLAN.md)

### Estrategia de Testing

```
┌────────────────────────────────────────────────────────────┐
│  NIVELES DE TESTING                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Unit Tests          ▓▓▓▓▓▓▓▓▓▓ 100% coverage          │
│  2. Integration Tests   ▓▓▓▓▓▓▓▓▓  90% coverage           │
│  3. E2E Tests           ▓▓▓▓▓▓     60% coverage           │
│  4. Load Tests          ▓▓▓▓       40% coverage           │
│  5. Security Tests      ▓▓▓▓▓▓▓▓   80% coverage           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Test Cases Críticos

#### TC-001: Single Branch Filtering
```typescript
// Verificar que API Key con branch_id solo retorna datos de esa branch
test('API Key with branch_id filters correctly', async () => {
  const key = await createAPIKey({ branch_id: 'polanco-id' });
  const response = await fetch('/api/v1/leads', {
    headers: { Authorization: `Bearer ${key}` }
  });
  const data = await response.json();

  // Todos los leads deben ser de 'polanco-id'
  expect(data.data.every(lead => lead.branch_id === 'polanco-id')).toBe(true);
});
```

#### TC-002: Legacy Key Compatibility
```typescript
// Verificar que API Keys sin branch_id siguen funcionando (acceso completo)
test('API Key without branch_id returns all branches', async () => {
  const key = await createAPIKey({ branch_id: null });
  const response = await fetch('/api/v1/leads', {
    headers: { Authorization: `Bearer ${key}` }
  });
  const data = await response.json();

  // Debe incluir leads de múltiples branches
  const branches = new Set(data.data.map(lead => lead.branch_id));
  expect(branches.size).toBeGreaterThan(1);
});
```

#### TC-003: Invalid Branch Access
```typescript
// Verificar que no se puede acceder a branch de otro tenant
test('API Key cannot access branches from other tenants', async () => {
  const key = await createAPIKey({
    tenant_id: 'tenant-A',
    branch_id: 'branch-from-tenant-B'  // Branch de otro tenant
  });

  // Debe fallar en creación o retornar 403
  expect(key).toBeNull();
});
```

---

## 🔄 PLAN DE ROLLBACK

### Documentación Completa en:
📄 [`ROLLBACK_PLAN.md`](./ROLLBACK_PLAN.md)

### Estrategia de Rollback por Fase

#### FASE 1: Rollback (LOW RISK)
```bash
# Revertir cambios en endpoints
git revert <commit-hash-fase-1>

# Re-deploy sin query parameter support
vercel deploy --prod
```

**Tiempo estimado:** 10 minutos
**Impacto:** NINGUNO (query parameters son opcionales)

#### FASE 2: Rollback (MEDIUM RISK)
```sql
-- 1. Marcar todas las API Keys como "all branches"
UPDATE api_keys SET branch_id = NULL;

-- 2. Revertir middleware (code rollback)
git revert <commit-hash-fase-2>

-- 3. (Opcional) Eliminar columna branch_id después de 30 días
-- ALTER TABLE api_keys DROP COLUMN branch_id;
```

**Tiempo estimado:** 2-4 horas
**Impacto:** BAJO (keys siguen funcionando con acceso completo)

#### FASE 3: Rollback (LOW RISK)
Rollback de optimizaciones no afecta funcionalidad core.

---

## 📈 MÉTRICAS DE ÉXITO

### KPIs por Fase

#### FASE 1: Adopción Temprana
- **Métrica 1:** % de clientes multi-sucursal usando `?branch_id`
  - **Target:** 50% en 2 semanas
  - **Método:** Analytics en endpoints

- **Métrica 2:** Reducción de reportes de "datos mezclados"
  - **Target:** -80% en tickets de soporte
  - **Método:** Zendesk analytics

#### FASE 2: Migración Estructural
- **Métrica 1:** % de API Keys migradas a branch-specific
  - **Target:** 70% en 1 mes
  - **Método:** Query a tabla `api_keys`

- **Métrica 2:** Performance de queries con branch filter
  - **Target:** <100ms p95
  - **Método:** New Relic / Datadog

#### FASE 3: Consolidación
- **Métrica 1:** Deprecación de legacy approach
  - **Target:** 100% migración en 6 meses
  - **Método:** Forced migration script

- **Métrica 2:** Satisfacción de clientes
  - **Target:** NPS > 40
  - **Método:** Encuesta post-migración

---

## 📚 ANEXOS

### A. Tablas Afectadas por Branch Filtering

| Tabla | Tiene `branch_id` | Prioridad | Endpoints Afectados |
|-------|-------------------|-----------|---------------------|
| `leads` | ✅ Sí | 🔴 P0 | `/api/v1/leads` |
| `appointments` | ✅ Sí | 🔴 P0 | `/api/v1/appointments` |
| `menu_items` | ✅ Sí | 🟡 P1 | `/api/v1/menu/items` |
| `menu_categories` | ✅ Sí | 🟡 P1 | `/api/v1/menu/categories` |
| `inventory_items` | ❓ TBD | 🟡 P1 | `/api/v1/inventory` |
| `staff` | ✅ Sí | 🟢 P2 | `/api/v1/staff` |
| `services` | ❌ No | 🟢 P2 | `/api/v1/services` |

### B. Recursos de Referencia

- **Stripe API Multi-Account:** [docs.stripe.com/connect](https://docs.stripe.com/connect)
- **Shopify Multi-Location:** [shopify.dev/docs/api/admin-rest/locations](https://shopify.dev/docs/api/admin-rest/2023-10/resources/location)
- **AWS Organizations:** [docs.aws.amazon.com/organizations](https://docs.aws.amazon.com/organizations/latest/userguide/)

### C. Glosario de Términos

| Término | Definición |
|---------|------------|
| **Tenant** | Organización/cliente principal en el sistema (ej: "Dental Polanco Corp") |
| **Branch** | Sucursal física de un tenant (ej: "Sucursal Polanco", "Sucursal Satélite") |
| **Scope** | Permiso granular de una API Key (ej: `leads:read`, `appointments:write`) |
| **API Key** | Token de autenticación para acceso programático a la API |
| **RLS** | Row Level Security - Políticas de seguridad a nivel de fila en Supabase |

---

## ✅ CHECKLIST DE APROBACIÓN

### Antes de Iniciar FASE 1
- [ ] Product Manager aprueba prioridad
- [ ] CTO aprueba arquitectura técnica
- [ ] DevOps confirma capacidad de deploy
- [ ] QA confirma disponibilidad para testing
- [ ] Customer Success notificado para comunicación a clientes

### Antes de Iniciar FASE 2
- [ ] FASE 1 completada y validada
- [ ] Schema migration aprobada por DBA
- [ ] Backup de producción realizado
- [ ] Plan de rollback testeado en staging
- [ ] Comunicación a clientes enviada (2 semanas de anticipación)

### Antes de Iniciar FASE 3
- [ ] FASE 2 en producción por mínimo 1 mes
- [ ] Métricas de adopción > 60%
- [ ] No hay tickets críticos relacionados
- [ ] Legal aprueba deprecación de API antigua

---

## 📞 CONTACTOS Y RESPONSABLES

| Rol | Nombre | Contacto | Responsabilidad |
|-----|--------|----------|-----------------|
| Tech Lead | TBD | tech-lead@tistis.com | Arquitectura y decisiones técnicas |
| Backend Lead | TBD | backend@tistis.com | Implementación de endpoints |
| Frontend Lead | TBD | frontend@tistis.com | UI de API Keys |
| QA Lead | TBD | qa@tistis.com | Testing y validación |
| DevOps | TBD | devops@tistis.com | Deploys y monitoring |
| Product Manager | TBD | pm@tistis.com | Priorización y roadmap |

---

**Documento vivo - Última actualización:** 2026-01-22
**Próxima revisión:** Pre-FASE 1 Kickoff

**Aprobaciones requeridas:**
- [ ] CTO
- [ ] Head of Engineering
- [ ] Product Manager
- [ ] Head of Customer Success
