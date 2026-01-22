# 🚀 FASE 1: PARCHE INMEDIATO - Query Parameter Approach

**Documento:** TIS-API-FASE1-001
**Versión:** 1.0.0
**Parent:** [MULTI_BRANCH_API_FIX_MASTER_PLAN.md](./MULTI_BRANCH_API_FIX_MASTER_PLAN.md)
**Duración Estimada:** 1-2 días
**Riesgo:** 🟡 BAJO
**Prioridad:** 🔴 P0 - CRÍTICO

---

## 📋 OBJETIVOS DE LA FASE

### Objetivo Principal
Implementar soporte inmediato para filtrado por sucursal mediante query parameters, sin cambios de schema ni breaking changes.

### Objetivos Específicos
1. ✅ Agregar parámetro `?branch_id=xxx` a endpoints críticos
2. ✅ Actualizar documentación API con ejemplos
3. ✅ Implementar warnings para clientes multi-sucursal
4. ✅ Deploy a producción en <48 horas
5. ✅ Mantener 100% retrocompatibilidad

### Non-Goals (Fuera de Scope)
- ❌ NO cambiar schema de base de datos
- ❌ NO modificar tabla `api_keys`
- ❌ NO hacer breaking changes
- ❌ NO implementar enforcement (solo opt-in)

---

## 🏗️ ARQUITECTURA TÉCNICA

### Flujo Actual (ANTES)

```
┌──────────────────────────────────────────────────┐
│  GET /api/v1/leads                               │
│  Authorization: Bearer tis_live_xxxxx            │
└───────────────┬──────────────────────────────────┘
                │
                ↓
┌───────────────────────────────────────────────────┐
│  Query:                                           │
│  SELECT * FROM leads                              │
│  WHERE tenant_id = 'xxx'                          │  ❌ Sin filtro branch
│  ORDER BY created_at DESC                         │
└───────────────────────────────────────────────────┘
```

### Flujo Objetivo (DESPUÉS)

```
┌──────────────────────────────────────────────────┐
│  GET /api/v1/leads?branch_id=polanco-uuid        │  ✅ Nuevo parámetro
│  Authorization: Bearer tis_live_xxxxx            │
└───────────────┬──────────────────────────────────┘
                │
                ↓
┌───────────────────────────────────────────────────┐
│  Validación:                                      │
│  1. ✅ Validar UUID format                        │
│  2. ✅ Verificar que branch pertenece al tenant   │
│  3. ✅ Sanitizar input (SQL injection prevention) │
└───────────────┬───────────────────────────────────┘
                │
                ↓
┌───────────────────────────────────────────────────┐
│  Query:                                           │
│  SELECT * FROM leads                              │
│  WHERE tenant_id = 'xxx'                          │
│    AND branch_id = 'polanco-uuid'                 │  ✅ Filtrado seguro
│  ORDER BY created_at DESC                         │
└───────────────────────────────────────────────────┘
```

---

## 📝 MICRO-FASES DE IMPLEMENTACIÓN

### MICRO-FASE 1.1: Helper Functions (2-3 horas)

**Objetivo:** Crear utilidades reutilizables para validación y filtrado.

#### Archivo: `src/lib/api/branch-query-filter.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Branch Query Filter Helper
// FASE 1: Query Parameter Approach
// =====================================================

import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ======================
// TYPES
// ======================

export interface BranchFilterResult {
  isValid: boolean;
  branchId: string | null;
  error?: string;
  warning?: string;
}

export interface BranchFilterOptions {
  required?: boolean;  // Si true, branch_id es obligatorio
  validateOwnership?: boolean;  // Verificar que branch pertenece al tenant
}

// ======================
// VALIDACIÓN
// ======================

/**
 * Valida formato UUID v4
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Extrae y valida branch_id del query string
 */
export function extractBranchId(
  request: NextRequest,
  options: BranchFilterOptions = {}
): BranchFilterResult {
  const url = new URL(request.url);
  const branchId = url.searchParams.get('branch_id');

  // Si no se proporciona
  if (!branchId) {
    if (options.required) {
      return {
        isValid: false,
        branchId: null,
        error: 'branch_id is required for multi-branch tenants',
      };
    }
    return {
      isValid: true,
      branchId: null,
      warning: 'branch_id not provided - returning data from all branches',
    };
  }

  // Validar formato UUID
  if (!isValidUUID(branchId)) {
    return {
      isValid: false,
      branchId: null,
      error: 'Invalid branch_id format - must be a valid UUID',
    };
  }

  return {
    isValid: true,
    branchId,
  };
}

/**
 * Verifica que el branch pertenece al tenant
 */
export async function validateBranchOwnership(
  supabase: SupabaseClient,
  branchId: string,
  tenantId: string
): Promise<{ isValid: boolean; error?: string }> {
  const { data: branch, error } = await supabase
    .from('branches')
    .select('id, tenant_id')
    .eq('id', branchId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !branch) {
    return {
      isValid: false,
      error: 'Branch not found or does not belong to your organization',
    };
  }

  return { isValid: true };
}

// ======================
// APLICAR FILTRO A QUERY
// ======================

/**
 * Aplica filtro de branch a una query de Supabase
 * USO: query = applyBranchFilter(query, branchId, 'leads')
 */
export function applyBranchFilter<T>(
  query: any,  // SupabaseQueryBuilder
  branchId: string | null,
  tableName: string
): any {
  // Lista de tablas que soportan branch filtering
  const BRANCH_FILTERABLE_TABLES = [
    'leads',
    'appointments',
    'menu_items',
    'menu_categories',
    'inventory_items',
    'staff',
  ];

  // Si no hay branchId o tabla no soporta filtrado, retornar query sin cambios
  if (!branchId || !BRANCH_FILTERABLE_TABLES.includes(tableName)) {
    return query;
  }

  // Aplicar filtro
  return query.eq('branch_id', branchId);
}

// ======================
// HELPER: RESPONSE HEADERS
// ======================

/**
 * Agrega headers informativos sobre el filtrado
 */
export function addBranchFilterHeaders(
  headers: Headers,
  branchId: string | null,
  tenantHasMultipleBranches: boolean
): void {
  if (branchId) {
    headers.set('X-Filtered-Branch-ID', branchId);
  }

  if (!branchId && tenantHasMultipleBranches) {
    headers.set(
      'X-Branch-Filter-Warning',
      'This tenant has multiple branches but no branch_id was provided. ' +
      'Data from all branches is included. Consider adding ?branch_id=xxx to filter.'
    );
  }
}

// ======================
// HELPER: CHECK MULTI-BRANCH
// ======================

/**
 * Verifica si un tenant tiene múltiples sucursales
 */
export async function tenantHasMultipleBranches(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (error) return false;

  return (count || 0) > 1;
}
```

**Testing:**
```typescript
// tests/lib/api/branch-query-filter.test.ts
import { extractBranchId, applyBranchFilter } from '@/src/lib/api/branch-query-filter';

describe('Branch Query Filter', () => {
  describe('extractBranchId', () => {
    it('should extract valid UUID', () => {
      const request = new Request('http://localhost?branch_id=550e8400-e29b-41d4-a716-446655440000');
      const result = extractBranchId(request);

      expect(result.isValid).toBe(true);
      expect(result.branchId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject invalid UUID', () => {
      const request = new Request('http://localhost?branch_id=not-a-uuid');
      const result = extractBranchId(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid branch_id format');
    });

    it('should allow missing branch_id by default', () => {
      const request = new Request('http://localhost');
      const result = extractBranchId(request);

      expect(result.isValid).toBe(true);
      expect(result.branchId).toBeNull();
      expect(result.warning).toBeDefined();
    });

    it('should require branch_id when option is set', () => {
      const request = new Request('http://localhost');
      const result = extractBranchId(request, { required: true });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('applyBranchFilter', () => {
    it('should add branch filter to query', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
      };

      const filtered = applyBranchFilter(mockQuery, 'branch-123', 'leads');

      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-123');
    });

    it('should not filter when branchId is null', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
      };

      const filtered = applyBranchFilter(mockQuery, null, 'leads');

      expect(mockQuery.eq).not.toHaveBeenCalled();
    });

    it('should not filter unsupported tables', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
      };

      const filtered = applyBranchFilter(mockQuery, 'branch-123', 'unsupported_table');

      expect(mockQuery.eq).not.toHaveBeenCalled();
    });
  });
});
```

---

### MICRO-FASE 1.2: Actualizar Endpoint /api/v1/leads (2-3 horas)

**Objetivo:** Implementar branch filtering en endpoint de leads.

#### Archivo Modificado: `app/api/v1/leads/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Public API: Leads
// FASE 1: Added branch_id query parameter support
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAPIKey,
  createAPIKeyErrorResponse,
  createAPIKeyAuthenticatedClient,
} from '@/src/shared/lib/api-key-auth';
import {
  applyRateLimit,
  addRateLimitHeaders,
  createRateLimitExceededResponse,
} from '@/src/shared/lib/api-key-rate-limit';
import { logRequest } from '@/src/shared/lib/api-key-logger';
// ✅ NUEVO: Import branch filter helpers
import {
  extractBranchId,
  validateBranchOwnership,
  applyBranchFilter,
  addBranchFilterHeaders,
  tenantHasMultipleBranches,
} from '@/src/lib/api/branch-query-filter';
import type { APIScope } from '@/src/features/api-settings/types';

export const dynamic = 'force-dynamic';

// ======================
// GET /api/v1/leads
// CHANGELOG:
// - [FASE 1] Added optional ?branch_id=xxx parameter
// - [FASE 1] Added warning headers for multi-branch tenants
// ======================
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  // 1. Authenticate API Key
  const auth = await authenticateAPIKey(request, {
    requiredScope: 'leads:read' as APIScope,
  });

  if (!auth.success) {
    logRequest({
      keyId: auth.keyId || 'unknown',
      tenantId: auth.tenantId || 'unknown',
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: auth.statusCode || 401,
      responseTimeMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      errorMessage: auth.error,
    });
    return createAPIKeyErrorResponse(auth);
  }

  // 2. Check rate limit
  const rateLimit = await applyRateLimit(auth.keyId!, auth.rateLimits!);

  if (!rateLimit.allowed) {
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: 429,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:read',
      ipAddress,
      userAgent,
      errorMessage: 'Rate limit exceeded',
    });
    return createRateLimitExceededResponse(rateLimit);
  }

  // ✅ 3. NUEVO: Extract and validate branch_id
  const branchFilter = extractBranchId(request);

  if (!branchFilter.isValid) {
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: 400,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:read',
      ipAddress,
      userAgent,
      errorMessage: branchFilter.error,
    });
    return NextResponse.json(
      {
        success: false,
        error: branchFilter.error,
        code: 'invalid_branch_id',
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createAPIKeyAuthenticatedClient();

    // ✅ 4. NUEVO: Validate branch ownership if branch_id provided
    if (branchFilter.branchId) {
      const ownership = await validateBranchOwnership(
        supabase,
        branchFilter.branchId,
        auth.tenantId!
      );

      if (!ownership.isValid) {
        logRequest({
          keyId: auth.keyId!,
          tenantId: auth.tenantId!,
          endpoint: '/api/v1/leads',
          method: 'GET',
          statusCode: 403,
          responseTimeMs: Date.now() - startTime,
          scopeUsed: 'leads:read',
          ipAddress,
          userAgent,
          errorMessage: ownership.error,
        });
        return NextResponse.json(
          {
            success: false,
            error: ownership.error,
            code: 'branch_access_denied',
          },
          { status: 403 }
        );
      }
    }

    // 5. Parse pagination and filters
    const url = new URL(request.url);
    const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSizeParam = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const pageSize = isNaN(pageSizeParam) || pageSizeParam < 1
      ? 20
      : Math.min(pageSizeParam, 100);

    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    // 6. Build query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', auth.tenantId!);

    // ✅ NUEVO: Apply branch filter if provided
    query = applyBranchFilter(query, branchFilter.branchId, 'leads');

    // Existing filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      const sanitizedSearch = search
        .replace(/[%_\\]/g, '\\$&')
        .replace(/'/g, "''");

      query = query.or(
        `phone.ilike.%${sanitizedSearch}%,` +
        `full_name.ilike.%${sanitizedSearch}%,` +
        `email.ilike.%${sanitizedSearch}%`
      );
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    // 7. Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('[API /v1/leads] Database error:', error);
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: '/api/v1/leads',
        method: 'GET',
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'leads:read',
        ipAddress,
        userAgent,
        errorMessage: error.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Database query failed',
          code: 'db_error',
        },
        { status: 500 }
      );
    }

    // ✅ 8. NUEVO: Add informational headers
    const headers = new Headers();
    addRateLimitHeaders(headers, rateLimit);

    const isMultiBranch = await tenantHasMultipleBranches(supabase, auth.tenantId!);
    addBranchFilterHeaders(headers, branchFilter.branchId, isMultiBranch);

    // 9. Log success and return
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:read',
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        // ✅ NUEVO: Include filter info in response
        filters: {
          branch_id: branchFilter.branchId,
          status,
          search,
        },
      },
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error('[API /v1/leads] Unexpected error:', error);
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:read',
      ipAddress,
      userAgent,
      errorMessage: error.message,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'internal_error',
      },
      { status: 500 }
    );
  }
}

// ======================
// POST /api/v1/leads
// CHANGELOG:
// - [FASE 1] Added optional branch_id in request body
// ======================
export async function POST(request: NextRequest) {
  // ... (similar implementation with branch_id support in body)
}

// Helper function (unchanged)
function getClientIP(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}
```

**Testing:**
```typescript
// tests/api/v1/leads.test.ts
describe('GET /api/v1/leads with branch filtering', () => {
  it('should filter by branch_id when provided', async () => {
    const response = await fetch('/api/v1/leads?branch_id=polanco-uuid', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.filters.branch_id).toBe('polanco-uuid');
    expect(data.data.every(lead => lead.branch_id === 'polanco-uuid')).toBe(true);
  });

  it('should add warning header for multi-branch tenant without filter', async () => {
    const response = await fetch('/api/v1/leads', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.headers.get('X-Branch-Filter-Warning')).toBeTruthy();
  });

  it('should reject invalid branch_id', async () => {
    const response = await fetch('/api/v1/leads?branch_id=invalid-uuid', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('invalid_branch_id');
  });

  it('should reject branch_id from another tenant', async () => {
    const response = await fetch('/api/v1/leads?branch_id=other-tenant-branch', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.code).toBe('branch_access_denied');
  });
});
```

---

### MICRO-FASE 1.3: Actualizar Otros Endpoints Críticos (4-6 horas)

**Objetivo:** Replicar patrón de branch filtering en todos los endpoints críticos.

#### Endpoints a Actualizar

| Endpoint | Archivo | Tabla | Prioridad |
|----------|---------|-------|-----------|
| `/api/v1/appointments` | `app/api/v1/appointments/route.ts` | `appointments` | 🔴 P0 |
| `/api/v1/menu/items` | `app/api/restaurant/menu/items/route.ts` | `menu_items` | 🟡 P1 |
| `/api/v1/menu/categories` | `app/api/restaurant/menu/categories/route.ts` | `menu_categories` | 🟡 P1 |

**Patrón a Seguir:**
1. Import helpers de `branch-query-filter.ts`
2. Extraer `branch_id` después de autenticación
3. Validar ownership si está presente
4. Aplicar filtro a query
5. Agregar headers informativos
6. Incluir `branch_id` en response

**Ejemplo para `/api/v1/appointments`:**
```typescript
// Similar implementation to /api/v1/leads
// Replace 'leads' with 'appointments' in:
// - Table name
// - Endpoint path
// - Log messages
```

---

### MICRO-FASE 1.4: Actualizar Documentación API (2 horas)

**Objetivo:** Documentar nuevo parámetro en API docs públicos.

#### Archivo: `docs/api/PUBLIC_API_REFERENCE.md`

```markdown
## GET /api/v1/leads

Retrieve a list of leads for your organization.

### Authentication
Requires API Key with `leads:read` scope.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch_id` | UUID | No | Filter leads by specific branch. **Recommended for multi-branch organizations.** |
| `page` | integer | No | Page number (default: 1) |
| `pageSize` | integer | No | Results per page (default: 20, max: 100) |
| `status` | string | No | Filter by lead status |
| `search` | string | No | Search in phone, name, or email |

### Request Example

```bash
# Get all leads (all branches)
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H 'Authorization: Bearer tis_live_xxxxx'

# Get leads from specific branch (RECOMMENDED)
curl -X GET 'https://api.tistis.com/v1/leads?branch_id=550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer tis_live_xxxxx'
```

### Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": "lead-uuid",
      "tenant_id": "tenant-uuid",
      "branch_id": "branch-uuid",
      "phone": "+5215512345678",
      "full_name": "Juan Pérez",
      "status": "new",
      "created_at": "2026-01-22T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "filters": {
    "branch_id": "branch-uuid",
    "status": null,
    "search": null
  }
}
```

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Filtered-Branch-ID` | UUID of the branch used for filtering (if provided) |
| `X-Branch-Filter-Warning` | Warning message if tenant has multiple branches but no `branch_id` was provided |

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_branch_id` | 400 | The `branch_id` parameter is not a valid UUID |
| `branch_access_denied` | 403 | The specified branch does not belong to your organization |
| `unauthorized` | 401 | Invalid or missing API key |
| `rate_limit_exceeded` | 429 | Too many requests |

### Notes

⚠️ **Important for Multi-Branch Organizations:**
- If your organization has multiple branches and you don't provide `branch_id`, the response will include leads from **all branches**.
- To avoid data mixing, always specify the `branch_id` parameter.
- You can get your branch IDs from `GET /api/v1/branches`.

### Best Practices

```javascript
// ✅ Good: Filter by branch for multi-branch orgs
const leads = await fetch('/api/v1/leads?branch_id=branch-uuid', {
  headers: { Authorization: `Bearer ${apiKey}` }
});

// ⚠️ Avoid: Mixing data from all branches
const leads = await fetch('/api/v1/leads', {
  headers: { Authorization: `Bearer ${apiKey}` }
});
// This returns leads from ALL branches!
```
```

---

### MICRO-FASE 1.5: Testing End-to-End (4-6 horas)

**Objetivo:** Validar funcionamiento en todos los escenarios.

#### Test Matrix

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Single-branch tenant, no param | Return all (1 branch) | TC-F1-001 |
| Single-branch tenant, with param | Return filtered | TC-F1-002 |
| Multi-branch tenant, no param | Return all + warning header | TC-F1-003 |
| Multi-branch tenant, valid param | Return filtered | TC-F1-004 |
| Multi-branch tenant, invalid UUID | 400 error | TC-F1-005 |
| Multi-branch tenant, other tenant's branch | 403 error | TC-F1-006 |

#### Automated Tests

```typescript
// tests/integration/fase1-branch-filtering.test.ts
import { createTestAPIKey, createTestBranch } from './test-helpers';

describe('FASE 1: Branch Query Filtering', () => {
  let tenant: any;
  let branch1: any;
  let branch2: any;
  let apiKey: string;

  beforeAll(async () => {
    // Setup: Create tenant with 2 branches
    tenant = await createTestTenant();
    branch1 = await createTestBranch(tenant.id, 'Branch 1');
    branch2 = await createTestBranch(tenant.id, 'Branch 2');
    apiKey = await createTestAPIKey(tenant.id, ['leads:read']);

    // Create test data
    await createTestLead(tenant.id, branch1.id, { name: 'Lead B1-1' });
    await createTestLead(tenant.id, branch1.id, { name: 'Lead B1-2' });
    await createTestLead(tenant.id, branch2.id, { name: 'Lead B2-1' });
  });

  test('TC-F1-003: Multi-branch tenant without param returns all + warning', async () => {
    const response = await fetch('/api/v1/leads', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Branch-Filter-Warning')).toBeTruthy();

    const data = await response.json();
    expect(data.data.length).toBe(3);  // All leads from both branches
  });

  test('TC-F1-004: Multi-branch tenant with valid param returns filtered', async () => {
    const response = await fetch(`/api/v1/leads?branch_id=${branch1.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Filtered-Branch-ID')).toBe(branch1.id);

    const data = await response.json();
    expect(data.data.length).toBe(2);  // Only branch1 leads
    expect(data.data.every(lead => lead.branch_id === branch1.id)).toBe(true);
  });

  test('TC-F1-005: Invalid UUID returns 400', async () => {
    const response = await fetch('/api/v1/leads?branch_id=not-a-uuid', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('invalid_branch_id');
  });

  test('TC-F1-006: Other tenant branch returns 403', async () => {
    const otherTenant = await createTestTenant();
    const otherBranch = await createTestBranch(otherTenant.id, 'Other Branch');

    const response = await fetch(`/api/v1/leads?branch_id=${otherBranch.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.code).toBe('branch_access_denied');
  });
});
```

---

### MICRO-FASE 1.6: Deploy y Monitoreo (2-3 horas)

**Objetivo:** Desplegar a producción con monitoreo activo.

#### Pre-Deploy Checklist

- [ ] Todos los tests pasando (unit + integration + e2e)
- [ ] Code review aprobado por 2+ ingenieros
- [ ] Documentación actualizada
- [ ] Changelog actualizado
- [ ] Backup de producción realizado
- [ ] Rollback plan verificado

#### Deploy Steps

```bash
# 1. Merge a main
git checkout main
git merge feature/fase1-branch-filtering
git push origin main

# 2. Trigger production deploy (Vercel)
vercel --prod

# 3. Verificar deploy exitoso
curl https://tistis-platform.vercel.app/api/v1/leads \
  -H "Authorization: Bearer $API_KEY"

# 4. Monitor logs en tiempo real
vercel logs --follow
```

#### Post-Deploy Monitoring

**Datadog Queries:**
```
# Errores relacionados a branch_id
status:error @endpoint:/api/v1/* @error:*branch*

# Uso del parámetro branch_id
@endpoint:/api/v1/leads @query.branch_id:*

# Tenants multi-branch sin filtro (warning header enviado)
@response.headers.X-Branch-Filter-Warning:*
```

**Alertas a Configurar:**
1. Error rate > 1% en endpoints con branch filtering
2. Warning header enviado > 50% de requests (indica mala adopción)
3. 403 errors (branch_access_denied) > 10/hora

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs Fase 1

| Métrica | Target | Medición |
|---------|--------|----------|
| **Adopción:** % requests con `branch_id` | >30% en 1 semana | Datadog analytics |
| **Errores:** Error rate en endpoints | <0.5% | Error tracking |
| **Performance:** P95 latency | <150ms | APM |
| **Soporte:** Tickets "datos mezclados" | -50% | Zendesk |

### Dashboard de Monitoreo

```
┌──────────────────────────────────────────────────┐
│  FASE 1: Branch Filtering Adoption               │
├──────────────────────────────────────────────────┤
│                                                  │
│  Requests with branch_id:     32% ▓▓▓▓░░░░░░    │
│  Multi-branch tenants:        18 total           │
│  Using branch_id:             12 (67%)           │
│  Not using (warnings):        6 (33%)            │
│                                                  │
│  Error Rate:                  0.3% ✅            │
│  Avg Latency:                 87ms ✅            │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🔄 ROLLBACK PLAN

### Rollback Procedure

```bash
# Si se detectan problemas críticos en producción

# 1. Revertir deploy
vercel rollback

# 2. Verificar que vuelve a funcionar
curl https://tistis-platform.vercel.app/api/v1/leads \
  -H "Authorization: Bearer $API_KEY"

# 3. Investigar y fix en staging
git checkout -b hotfix/fase1-rollback
# Apply fixes
git push origin hotfix/fase1-rollback

# 4. Re-deploy cuando esté listo
```

### Rollback Impact

- **Downtime:** 0 minutos (rollback instantáneo en Vercel)
- **Data loss:** NINGUNO (no hay cambios de schema)
- **Breaking changes:** NINGUNO (query param es opcional)

---

## ✅ CHECKLIST DE COMPLETITUD

### Código
- [ ] Helper `branch-query-filter.ts` implementado y testeado
- [ ] Endpoint `/api/v1/leads` actualizado
- [ ] Endpoint `/api/v1/appointments` actualizado
- [ ] Endpoint `/api/v1/menu/items` actualizado
- [ ] Tests unitarios (100% coverage en helpers)
- [ ] Tests de integración (todos los escenarios)

### Documentación
- [ ] API Reference actualizado
- [ ] Ejemplos de código agregados
- [ ] Migration guide para clientes (si aplica)
- [ ] Changelog actualizado
- [ ] Internal wiki actualizado

### Deploy
- [ ] Code review aprobado
- [ ] Tests pasando en CI/CD
- [ ] Staging validado
- [ ] Producción deployado
- [ ] Monitoring configurado
- [ ] Alertas activas

### Comunicación
- [ ] Email a clientes multi-sucursal
- [ ] Announcement en dashboard
- [ ] Slack notification al equipo
- [ ] Customer Success team notificado

---

## 📞 RESPONSABLES

| Rol | Responsable | Tareas |
|-----|-------------|--------|
| **Tech Lead** | TBD | Arquitectura, code review |
| **Backend Dev 1** | TBD | Helper functions, tests |
| **Backend Dev 2** | TBD | Endpoints updates |
| **QA Engineer** | TBD | Test plan execution |
| **DevOps** | TBD | Deploy, monitoring |
| **Product Manager** | TBD | Communication, adoption tracking |

---

**Status:** ⏳ READY FOR EXECUTION
**Próximo Review:** Pre-deploy meeting
**Dependencias:** Ninguna (standalone phase)
