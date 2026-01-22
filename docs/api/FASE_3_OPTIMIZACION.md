# ⚡ FASE 3: OPTIMIZACIÓN Y DEPRECACIÓN

**Documento:** TIS-API-FASE3-001
**Versión:** 1.0.0
**Parent:** [MULTI_BRANCH_API_FIX_MASTER_PLAN.md](./MULTI_BRANCH_API_FIX_MASTER_PLAN.md)
**Prerequisito:** ✅ FASE 2 en producción por mínimo 1 mes
**Duración Estimada:** 3-6 meses
**Riesgo:** 🟢 BAJO
**Prioridad:** 🟡 P1 - IMPORTANTE

---

## 📋 OBJETIVOS

### Objetivo Principal
Optimizar performance del sistema branch-filtering y deprecar gradualmente el approach de query parameters (FASE 1).

### Objetivos Específicos
1. ✅ Optimizar índices de base de datos
2. ✅ Implementar caching inteligente
3. ✅ Deprecar query parameter approach
4. ✅ Migración forzosa de clientes legacy
5. ✅ Analytics avanzado por sucursal
6. ✅ (Opcional) Scopes granulares v2

---

## 📝 MICRO-FASES

### MICRO-FASE 3.1: Optimización de Performance (2 semanas)

#### Database Optimization

```sql
-- Índices parciales para queries comunes
CREATE INDEX CONCURRENTLY idx_leads_branch_active
    ON leads(branch_id, created_at DESC)
    WHERE status IN ('new', 'contacted', 'qualified');

CREATE INDEX CONCURRENTLY idx_appointments_branch_upcoming
    ON appointments(branch_id, scheduled_at)
    WHERE scheduled_at > NOW() AND status = 'confirmed';

-- Estadísticas actualizadas
ANALYZE leads;
ANALYZE appointments;
ANALYZE menu_items;
```

#### Query Caching Layer

```typescript
// src/lib/api/branch-filter-cache.ts
import { unstable_cache } from 'next/cache';

export const getCachedBranchData = unstable_cache(
  async (branchId: string, endpoint: string) => {
    // Fetch data with branch filter
    const data = await fetchDataForBranch(branchId, endpoint);
    return data;
  },
  ['branch-data'],
  {
    revalidate: 60, // 1 minute cache
    tags: ['api-data'],
  }
);
```

**Target:** P95 latency < 80ms (mejora de 20% vs FASE 2)

---

### MICRO-FASE 3.2: Deprecation Strategy (3 meses)

#### Month 1-2: Warning Period

```typescript
// Agregar deprecation warnings a responses
if (queryBranchIdUsed && !apiKeyBranchId) {
  headers.set('X-API-Deprecated', 'query-parameter-filtering');
  headers.set('X-API-Deprecation-Date', '2026-07-01');
  headers.set('X-API-Migration-Guide', 'https://docs.tistis.com/api/branch-migration');
}
```

#### Month 3-4: Soft Enforcement

```typescript
// Require explicit opt-in for query param usage
const allowLegacyFiltering = request.headers.get('X-Allow-Legacy-Filtering') === 'true';

if (queryBranchId && !allowLegacyFiltering) {
  return NextResponse.json({
    error: 'Query parameter filtering is deprecated. Please use branch-specific API Keys.',
    migration_guide: 'https://docs.tistis.com/api/branch-migration',
    temporary_override: 'Add header X-Allow-Legacy-Filtering: true',
  }, { status: 400 });
}
```

#### Month 5-6: Hard Deprecation

```typescript
// Remove query parameter support completely
// (Solo después de 100% migración verificada)
```

**Target:** 100% clientes migrados a branch-specific keys

---

### MICRO-FASE 3.3: Analytics Dashboard (2 semanas)

#### Branch Analytics API

```typescript
// app/api/analytics/branch-usage/route.ts
export async function GET(request: NextRequest) {
  // Return usage stats per branch
  return NextResponse.json({
    branches: [
      {
        id: 'branch-1',
        name: 'Polanco',
        api_requests_30d: 15420,
        most_used_endpoints: ['/api/v1/leads', '/api/v1/appointments'],
        error_rate: 0.2,
      }
    ]
  });
}
```

**Entregable:** Dashboard en UI mostrando uso por sucursal

---

### MICRO-FASE 3.4: Scopes Granulares v2 (Opcional - 3 semanas)

#### Enhanced Scope System

```typescript
// Scopes con wildcards y branch context
const SCOPE_PATTERNS = [
  'branch:{branch_id}:leads:read',    // Específico a branch
  'branch:*:leads:read',              // Wildcard para admin
  'tenant:*:leads:read',              // Tenant-wide (legacy)
];

function matchScope(requiredScope: string, grantedScopes: string[]): boolean {
  // Pattern matching logic
}
```

**Ejemplo de uso:**
```json
{
  "scopes": [
    "branch:polanco-uuid:leads:read",
    "branch:polanco-uuid:appointments:write"
  ]
}
```

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Target |
|---------|--------|
| **Performance:** Query latency improvement | +20% |
| **Migration:** Legacy keys migrated | 100% |
| **Adoption:** New keys using branch-specific | 95%+ |
| **Cache Hit Rate:** | >70% |

---

## ✅ CHECKLIST

### Performance
- [ ] Database índices optimizados
- [ ] Caching layer implementado
- [ ] Benchmarks ejecutados (antes/después)
- [ ] Load testing passed

### Deprecation
- [ ] Deprecation warnings deployados
- [ ] Email communication sent (3 waves)
- [ ] Migration tool available
- [ ] 100% clientes migrados

### Analytics
- [ ] Dashboard de uso por branch
- [ ] Alertas de anomalías
- [ ] Reports mensuales automatizados

---

**Status:** ⏳ PENDING (Post-FASE 2)
**Timeline:** Mes 2-6 del proyecto
