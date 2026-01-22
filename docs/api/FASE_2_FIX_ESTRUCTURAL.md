# 🏗️ FASE 2: FIX ESTRUCTURAL - API Keys con Branch Context

**Documento:** TIS-API-FASE2-001
**Versión:** 1.0.0
**Parent:** [MULTI_BRANCH_API_FIX_MASTER_PLAN.md](./MULTI_BRANCH_API_FIX_MASTER_PLAN.md)
**Prerequisito:** ✅ FASE 1 completada y en producción
**Duración Estimada:** 2-3 semanas
**Riesgo:** 🟡 MEDIO
**Prioridad:** 🔴 P0 - CRÍTICO

---

## 📋 OBJETIVOS DE LA FASE

### Objetivo Principal
Implementar soporte nativo de branch-level API Keys mediante migración de schema y actualización de sistema de autenticación.

### Objetivos Específicos
1. ✅ Migrar schema: agregar `branch_id` a tabla `api_keys`
2. ✅ Actualizar UI de creación/gestión de API Keys
3. ✅ Implementar middleware de filtrado automático
4. ✅ Migrar API Keys existentes (legacy support)
5. ✅ Actualizar sistema de scopes (opcional)
6. ✅ 100% retrocompatibilidad con FASE 1

### Non-Goals (Fuera de Scope)
- ❌ NO deprecar query parameter approach (conviven)
- ❌ NO hacer breaking changes en API responses
- ❌ NO migrar forzosamente a clientes
- ❌ NO implementar scopes granulares v2 (esto es FASE 3)

---

## 🎯 ARQUITECTURA OBJETIVO

### Schema Evolution

#### ANTES (Schema Actual)
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    -- ❌ NO hay branch_id
    name VARCHAR(100) NOT NULL,
    scopes JSONB NOT NULL,
    ...
);
```

#### DESPUÉS (Schema Objetivo)
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    branch_id UUID REFERENCES branches(id),  -- ✅ NUEVO (nullable)
    name VARCHAR(100) NOT NULL,
    scopes JSONB NOT NULL,
    scope_type VARCHAR(20) DEFAULT 'tenant',  -- ✅ NUEVO: 'tenant' | 'branch'
    ...
);

-- ✅ NUEVO: Index para performance
CREATE INDEX idx_api_keys_branch ON api_keys(branch_id)
    WHERE branch_id IS NOT NULL;

-- ✅ NUEVO: Constraint para validar que branch pertenece al tenant
ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_branch_tenant_check
    CHECK (
        branch_id IS NULL OR
        EXISTS (
            SELECT 1 FROM branches
            WHERE branches.id = api_keys.branch_id
            AND branches.tenant_id = api_keys.tenant_id
        )
    );
```

### Flujo de Autenticación Mejorado

```
┌─────────────────────────────────────────────────────────┐
│  Request:                                               │
│  GET /api/v1/leads                                      │
│  Authorization: Bearer tis_live_branch_polanco_xxx      │  ✅ Key con branch
└──────────────┬──────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────┐
│  authenticateAPIKey()                                    │
│  1. Validar token y extraer key_hash                     │
│  2. Query a api_keys con hash                            │
│  3. ✅ NUEVO: Extraer branch_id de la key                │
│  4. Retornar auth context con branch info                │
└──────────────┬───────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────┐
│  applyAutomaticBranchFilter()                            │  ✅ NUEVO
│  - Si key.branch_id existe → filtrar automáticamente     │
│  - Si key.branch_id es NULL → acceso completo (legacy)   │
│  - Query parameter override (backward compat FASE 1)     │
└──────────────┬───────────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────────┐
│  Database Query:                                         │
│  SELECT * FROM leads                                     │
│  WHERE tenant_id = 'xxx'                                 │
│    AND (                                                 │
│      branch_id = 'polanco-uuid'  -- Desde API Key        │
│      OR query_branch_id          -- Override FASE 1      │
│    )                                                     │
└──────────────────────────────────────────────────────────┘
```

---

## 📝 MICRO-FASES DE IMPLEMENTACIÓN

### MICRO-FASE 2.1: Database Migration (1 día)

**Objetivo:** Migrar schema de forma segura con zero downtime.

#### Archivo: `supabase/migrations/XXX_ADD_BRANCH_CONTEXT_TO_API_KEYS.sql`

```sql
-- =====================================================
-- TIS TIS PLATFORM - API Keys Branch Context Migration
-- Migration: FASE 2 - Add branch_id support
-- =====================================================
--
-- PROPÓSITO:
-- Agregar soporte para API Keys específicas por sucursal
-- manteniendo retrocompatibilidad con keys existentes.
--
-- ESTRATEGIA:
-- 1. Agregar columna branch_id (nullable)
-- 2. Agregar scope_type para identificar tipo de key
-- 3. Índices optimizados para queries con branch
-- 4. Constraints para validar integridad
-- 5. Función helper para verificar permisos
--
-- ROLLBACK:
-- Este migration es reversible - ver final del archivo
-- =====================================================

-- =====================================================
-- PASO 1: Agregar Columnas Nuevas
-- =====================================================

-- Agregar branch_id (nullable para retrocompatibilidad)
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

-- Agregar scope_type para distinguir keys tenant-wide vs branch-specific
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) DEFAULT 'tenant'
    CHECK (scope_type IN ('tenant', 'branch'));

-- Agregar metadata adicional
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS branch_context JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN api_keys.branch_id IS 'Branch UUID for branch-specific API Keys. NULL = tenant-wide access (legacy)';
COMMENT ON COLUMN api_keys.scope_type IS 'Scope type: tenant (all branches) or branch (single branch)';
COMMENT ON COLUMN api_keys.branch_context IS 'Additional branch context metadata (branch name, etc.)';

-- =====================================================
-- PASO 2: Actualizar Keys Existentes
-- =====================================================

-- Marcar todas las keys existentes como 'tenant' scope (legacy behavior)
UPDATE api_keys
SET scope_type = 'tenant',
    branch_context = jsonb_build_object(
        'legacy', true,
        'migrated_at', NOW()::text,
        'note', 'Pre-FASE2 API Key with tenant-wide access'
    )
WHERE scope_type IS NULL OR scope_type = 'tenant';

-- =====================================================
-- PASO 3: Índices para Performance
-- =====================================================

-- Índice para queries por branch (solo keys con branch)
CREATE INDEX IF NOT EXISTS idx_api_keys_branch
    ON api_keys(branch_id)
    WHERE branch_id IS NOT NULL;

-- Índice compuesto para tenant + branch lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_branch
    ON api_keys(tenant_id, branch_id)
    WHERE branch_id IS NOT NULL;

-- Índice para scope_type filtering
CREATE INDEX IF NOT EXISTS idx_api_keys_scope_type
    ON api_keys(scope_type);

-- =====================================================
-- PASO 4: Constraints de Integridad
-- =====================================================

-- Constraint: Si scope_type es 'branch', branch_id DEBE existir
ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_branch_scope_consistency
    CHECK (
        (scope_type = 'tenant' AND branch_id IS NULL) OR
        (scope_type = 'branch' AND branch_id IS NOT NULL)
    );

-- Constraint: branch_id debe pertenecer al mismo tenant
-- NOTA: Este constraint se valida a nivel de aplicación por performance
-- pero dejamos un trigger para auditoría

CREATE OR REPLACE FUNCTION validate_api_key_branch_ownership()
RETURNS TRIGGER AS $$
DECLARE
    branch_tenant_id UUID;
BEGIN
    -- Si no hay branch_id, no hay nada que validar
    IF NEW.branch_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Obtener tenant_id del branch
    SELECT tenant_id INTO branch_tenant_id
    FROM branches
    WHERE id = NEW.branch_id;

    -- Validar que coincide con el tenant de la API key
    IF branch_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Branch % does not exist', NEW.branch_id;
    END IF;

    IF branch_tenant_id != NEW.tenant_id THEN
        RAISE EXCEPTION 'Branch % does not belong to tenant %', NEW.branch_id, NEW.tenant_id;
    END IF;

    -- Auto-set scope_type si no está definido
    IF NEW.scope_type IS NULL THEN
        NEW.scope_type := 'branch';
    END IF;

    -- Auto-populate branch_context
    NEW.branch_context := jsonb_build_object(
        'branch_id', NEW.branch_id::text,
        'branch_name', (SELECT name FROM branches WHERE id = NEW.branch_id),
        'created_at', NOW()::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validación automática
DROP TRIGGER IF EXISTS trigger_validate_api_key_branch ON api_keys;
CREATE TRIGGER trigger_validate_api_key_branch
    BEFORE INSERT OR UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION validate_api_key_branch_ownership();

-- =====================================================
-- PASO 5: Función Helper para Verificar Permisos
-- =====================================================

CREATE OR REPLACE FUNCTION api_key_has_branch_access(
    p_api_key_id UUID,
    p_required_branch_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_record RECORD;
BEGIN
    -- Obtener info de la API key
    SELECT
        scope_type,
        branch_id,
        is_active
    INTO key_record
    FROM api_keys
    WHERE id = p_api_key_id;

    -- Key no encontrada o inactiva
    IF NOT FOUND OR NOT key_record.is_active THEN
        RETURN FALSE;
    END IF;

    -- Caso 1: Key tenant-wide (legacy) → acceso a todas las branches
    IF key_record.scope_type = 'tenant' THEN
        RETURN TRUE;
    END IF;

    -- Caso 2: Key branch-specific → solo acceso a su branch
    IF key_record.scope_type = 'branch' THEN
        RETURN key_record.branch_id = p_required_branch_id;
    END IF;

    -- Default: no access
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION api_key_has_branch_access IS 'Verifica si una API Key tiene acceso a un branch específico';

-- =====================================================
-- PASO 6: Actualizar Función validate_api_key
-- =====================================================

-- Extender función existente para retornar branch context
CREATE OR REPLACE FUNCTION validate_api_key(
    p_key_hash VARCHAR(64)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_record RECORD;
BEGIN
    -- Buscar la key por hash
    SELECT
        id,
        tenant_id,
        branch_id,        -- ✅ NUEVO
        scope_type,       -- ✅ NUEVO
        name,
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        ip_whitelist,
        expires_at,
        is_active,
        usage_count_today,
        usage_reset_date
    INTO key_record
    FROM api_keys
    WHERE key_hash = p_key_hash;

    -- Key no encontrada
    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'invalid_key',
            'message', 'API key not found'
        );
    END IF;

    -- Key revocada/inactiva
    IF NOT key_record.is_active THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'key_revoked',
            'message', 'API key has been revoked'
        );
    END IF;

    -- Key expirada
    IF key_record.expires_at IS NOT NULL AND key_record.expires_at < NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'key_expired',
            'message', 'API key has expired'
        );
    END IF;

    -- Resetear contador si cambió el día
    IF key_record.usage_reset_date IS DISTINCT FROM CURRENT_DATE THEN
        UPDATE api_keys
        SET usage_count_today = 0, usage_reset_date = CURRENT_DATE
        WHERE id = key_record.id;
        key_record.usage_count_today := 0;
    END IF;

    -- Key válida - retornar info INCLUYENDO branch context
    RETURN json_build_object(
        'valid', true,
        'key_id', key_record.id,
        'tenant_id', key_record.tenant_id,
        'branch_id', key_record.branch_id,          -- ✅ NUEVO
        'scope_type', key_record.scope_type,        -- ✅ NUEVO
        'name', key_record.name,
        'scopes', key_record.scopes,
        'rate_limit_rpm', key_record.rate_limit_rpm,
        'rate_limit_daily', key_record.rate_limit_daily,
        'ip_whitelist', key_record.ip_whitelist,
        'usage_today', key_record.usage_count_today
    );
END;
$$;

-- =====================================================
-- PASO 7: Analytics View (Opcional)
-- =====================================================

CREATE OR REPLACE VIEW api_keys_with_branch_info AS
SELECT
    k.id,
    k.tenant_id,
    k.branch_id,
    k.scope_type,
    k.name,
    k.environment,
    k.is_active,
    k.created_at,
    k.last_used_at,
    k.usage_count,
    t.business_name as tenant_name,
    b.name as branch_name,
    b.address as branch_address
FROM api_keys k
LEFT JOIN tenants t ON t.id = k.tenant_id
LEFT JOIN branches b ON b.id = k.branch_id;

COMMENT ON VIEW api_keys_with_branch_info IS 'View con información denormalizada de API Keys y sus branches';

-- =====================================================
-- PASO 8: Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION api_key_has_branch_access TO service_role;
GRANT SELECT ON api_keys_with_branch_info TO service_role;

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================

/*
-- Para revertir esta migración en caso de problemas:

-- 1. Drop trigger y función
DROP TRIGGER IF EXISTS trigger_validate_api_key_branch ON api_keys;
DROP FUNCTION IF EXISTS validate_api_key_branch_ownership();
DROP FUNCTION IF EXISTS api_key_has_branch_access(UUID, UUID);

-- 2. Drop view
DROP VIEW IF EXISTS api_keys_with_branch_info;

-- 3. Drop constraints
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_branch_scope_consistency;

-- 4. Drop índices
DROP INDEX IF EXISTS idx_api_keys_branch;
DROP INDEX IF EXISTS idx_api_keys_tenant_branch;
DROP INDEX IF EXISTS idx_api_keys_scope_type;

-- 5. Drop columnas (CUIDADO: esto borra datos!)
-- Recomendación: NO ejecutar DROP COLUMN en producción
-- En su lugar, dejar las columnas y revertir a nivel de aplicación
-- ALTER TABLE api_keys DROP COLUMN IF EXISTS branch_id;
-- ALTER TABLE api_keys DROP COLUMN IF EXISTS scope_type;
-- ALTER TABLE api_keys DROP COLUMN IF EXISTS branch_context;

-- 6. Revertir función validate_api_key a versión anterior
-- (Copiar código de migración 134_API_KEYS_SYSTEM.sql)
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
```

**Testing del Migration:**

```typescript
// tests/migrations/fase2-schema.test.ts
describe('FASE 2 Schema Migration', () => {
  test('should add branch_id column as nullable', async () => {
    const { data } = await supabase
      .from('api_keys')
      .select('branch_id')
      .limit(1);

    expect(data).toBeDefined();
  });

  test('should allow creating branch-specific key', async () => {
    const branch = await createTestBranch();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenant.id,
        branch_id: branch.id,
        scope_type: 'branch',
        name: 'Branch-specific key',
        key_hash: 'test-hash',
        scopes: ['leads:read'],
      })
      .single();

    expect(error).toBeNull();
    expect(data.branch_id).toBe(branch.id);
    expect(data.scope_type).toBe('branch');
  });

  test('should reject branch from different tenant', async () => {
    const otherTenant = await createTestTenant();
    const otherBranch = await createTestBranch(otherTenant.id);

    const { error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenant.id,
        branch_id: otherBranch.id,  // Branch de otro tenant
        scope_type: 'branch',
        name: 'Invalid key',
        key_hash: 'test-hash',
        scopes: ['leads:read'],
      });

    expect(error).toBeDefined();
    expect(error.message).toContain('does not belong to tenant');
  });

  test('should auto-populate branch_context', async () => {
    const branch = await createTestBranch({ name: 'Polanco' });

    const { data } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenant.id,
        branch_id: branch.id,
        scope_type: 'branch',
        name: 'Test key',
        key_hash: 'test-hash',
        scopes: ['leads:read'],
      })
      .select('branch_context')
      .single();

    expect(data.branch_context).toHaveProperty('branch_name', 'Polanco');
  });
});
```

---

### MICRO-FASE 2.2: Backend Auth Layer Update (2-3 días)

**Objetivo:** Actualizar sistema de autenticación para soportar branch context.

#### Archivo: `src/shared/lib/api-key-auth.ts` (Actualización)

```typescript
// =====================================================
// TIS TIS PLATFORM - API Key Authentication
// FASE 2: Enhanced with branch context support
// =====================================================

import { NextRequest } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ======================
// TYPES (Enhanced for FASE 2)
// ======================

export interface APIAuthResult {
  success: boolean;
  keyId?: string;
  tenantId?: string;
  branchId?: string | null;          // ✅ NUEVO
  scopeType?: 'tenant' | 'branch';   // ✅ NUEVO
  scopes?: string[];
  rateLimits?: {
    rpm: number;
    daily: number;
    usageToday: number;
  };
  error?: string;
  statusCode?: number;
}

export interface BranchFilterContext {
  branchId: string | null;
  scopeType: 'tenant' | 'branch';
  hasBranchAccess: (targetBranchId: string) => boolean;
}

// ======================
// AUTHENTICATION (Enhanced)
// ======================

export async function authenticateAPIKey(
  request: NextRequest,
  options: { requiredScope?: string } = {}
): Promise<APIAuthResult> {
  try {
    // 1. Extract token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid Authorization header',
        statusCode: 401,
      };
    }

    const rawKey = authHeader.substring(7);

    // 2. Validate key format
    if (!isValidAPIKeyFormat(rawKey)) {
      return {
        success: false,
        error: 'Invalid API key format',
        statusCode: 401,
      };
    }

    // 3. Hash the key
    const keyHash = hashAPIKey(rawKey);

    // 4. Validate against database (using enhanced function from migration)
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc('validate_api_key', {
      p_key_hash: keyHash,
    });

    if (error || !data || typeof data === 'string') {
      console.error('[API Auth] Validation error:', error || data);
      return {
        success: false,
        error: 'Invalid or expired API key',
        statusCode: 401,
      };
    }

    const validation = typeof data === 'object' ? data : JSON.parse(data);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'API key validation failed',
        statusCode: 401,
      };
    }

    // 5. Check required scope
    if (options.requiredScope) {
      const hasScope = validation.scopes.includes(options.requiredScope) ||
                       validation.scopes.includes('*');

      if (!hasScope) {
        return {
          success: false,
          error: `Missing required scope: ${options.requiredScope}`,
          statusCode: 403,
        };
      }
    }

    // ✅ 6. NUEVO: Return enhanced auth result with branch context
    return {
      success: true,
      keyId: validation.key_id,
      tenantId: validation.tenant_id,
      branchId: validation.branch_id || null,        // ✅ NUEVO
      scopeType: validation.scope_type || 'tenant',  // ✅ NUEVO
      scopes: validation.scopes,
      rateLimits: {
        rpm: validation.rate_limit_rpm,
        daily: validation.rate_limit_daily,
        usageToday: validation.usage_today,
      },
    };
  } catch (error: any) {
    console.error('[API Auth] Unexpected error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      statusCode: 500,
    };
  }
}

// ✅ NUEVO: Helper para crear branch filter context
export function createBranchFilterContext(auth: APIAuthResult): BranchFilterContext {
  return {
    branchId: auth.branchId || null,
    scopeType: auth.scopeType || 'tenant',

    // Helper function: verifica si key tiene acceso a un branch específico
    hasBranchAccess: (targetBranchId: string): boolean => {
      // Caso 1: Key tenant-wide (legacy) → acceso a todos
      if (auth.scopeType === 'tenant' || !auth.branchId) {
        return true;
      }

      // Caso 2: Key branch-specific → solo su branch
      return auth.branchId === targetBranchId;
    },
  };
}

// ✅ NUEVO: Middleware para aplicar filtrado automático
export function applyAutomaticBranchFilter<T>(
  query: any,  // SupabaseQueryBuilder
  auth: APIAuthResult,
  tableName: string,
  queryParamBranchId?: string | null  // Backward compat con FASE 1
): any {
  // Lista de tablas con soporte de branch filtering
  const BRANCH_FILTERABLE_TABLES = [
    'leads',
    'appointments',
    'menu_items',
    'menu_categories',
    'inventory_items',
    'staff',
  ];

  // Si tabla no soporta branch filtering, retornar sin cambios
  if (!BRANCH_FILTERABLE_TABLES.includes(tableName)) {
    return query;
  }

  // Determinar qué branch_id usar (prioridad)
  let effectiveBranchId: string | null = null;

  // Prioridad 1: Query parameter (FASE 1 backward compat)
  if (queryParamBranchId) {
    effectiveBranchId = queryParamBranchId;
  }
  // Prioridad 2: Branch ID de la API Key (FASE 2)
  else if (auth.branchId) {
    effectiveBranchId = auth.branchId;
  }

  // Si hay branch_id efectivo, aplicar filtro
  if (effectiveBranchId) {
    return query.eq('branch_id', effectiveBranchId);
  }

  // Sin filtro (tenant-wide access)
  return query;
}

// Existing helpers (unchanged)
function isValidAPIKeyFormat(key: string): boolean {
  return /^tis_(live|test)_[a-zA-Z0-9]{32,}$/.test(key);
}

function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function createServiceRoleClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey);
}
```

**Testing:**

```typescript
// tests/lib/api-key-auth-fase2.test.ts
describe('API Key Auth - FASE 2 Enhancements', () => {
  test('should return branch_id for branch-specific key', async () => {
    const branch = await createTestBranch();
    const key = await createAPIKey({
      tenant_id: testTenant.id,
      branch_id: branch.id,
      scope_type: 'branch',
    });

    const request = new Request('http://localhost/api/v1/leads', {
      headers: { Authorization: `Bearer ${key.raw_key}` },
    });

    const auth = await authenticateAPIKey(request);

    expect(auth.success).toBe(true);
    expect(auth.branchId).toBe(branch.id);
    expect(auth.scopeType).toBe('branch');
  });

  test('should return null branch_id for tenant-wide key', async () => {
    const key = await createAPIKey({
      tenant_id: testTenant.id,
      branch_id: null,
      scope_type: 'tenant',
    });

    const request = new Request('http://localhost/api/v1/leads', {
      headers: { Authorization: `Bearer ${key.raw_key}` },
    });

    const auth = await authenticateAPIKey(request);

    expect(auth.success).toBe(true);
    expect(auth.branchId).toBeNull();
    expect(auth.scopeType).toBe('tenant');
  });

  test('hasBranchAccess should allow all branches for tenant-wide key', () => {
    const auth: APIAuthResult = {
      success: true,
      scopeType: 'tenant',
      branchId: null,
    };

    const context = createBranchFilterContext(auth);

    expect(context.hasBranchAccess('any-branch-id')).toBe(true);
  });

  test('hasBranchAccess should restrict to specific branch', () => {
    const auth: APIAuthResult = {
      success: true,
      scopeType: 'branch',
      branchId: 'polanco-uuid',
    };

    const context = createBranchFilterContext(auth);

    expect(context.hasBranchAccess('polanco-uuid')).toBe(true);
    expect(context.hasBranchAccess('satelite-uuid')).toBe(false);
  });
});
```

---

### MICRO-FASE 2.3: UI de API Keys (3-4 días)

**Objetivo:** Actualizar interfaz para crear/gestionar API Keys con branch context.

#### Archivo Actualizado: `src/features/api-settings/components/APIKeyCreateModal.tsx`

```typescript
// =====================================================
// TIS TIS PLATFORM - API Key Create Modal
// FASE 2: Enhanced with branch selection
// =====================================================

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/shared/components/ui/dialog';
import { Button, Input, Select, Checkbox } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { useBranches } from '@/src/hooks/useBranches';

interface APIKeyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (key: { id: string; raw_key: string }) => void;
}

export function APIKeyCreateModal({ isOpen, onClose, onSuccess }: APIKeyCreateModalProps) {
  const { tenant } = useAuthContext();
  const { branches, isLoading: loadingBranches } = useBranches();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState<'live' | 'test'>('live');

  // ✅ NUEVO: Branch selection
  const [scopeType, setScopeType] = useState<'tenant' | 'branch'>('tenant');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Scopes selection
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      // Validaciones
      if (!name.trim()) {
        throw new Error('El nombre es requerido');
      }

      if (selectedScopes.length === 0) {
        throw new Error('Debes seleccionar al menos un permiso');
      }

      // ✅ NUEVO: Validar branch si es branch-specific
      if (scopeType === 'branch' && !selectedBranchId) {
        throw new Error('Debes seleccionar una sucursal');
      }

      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          environment,
          scope_type: scopeType,              // ✅ NUEVO
          branch_id: scopeType === 'branch' ? selectedBranchId : null,  // ✅ NUEVO
          scopes: selectedScopes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear API Key');
      }

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear Nueva API Key</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Nombre */}
          <Input
            label="Nombre *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Integración CRM"
            helperText="Un nombre descriptivo para identificar esta key"
          />

          {/* Descripción */}
          <Input
            label="Descripción (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: API Key para sincronizar leads con Salesforce"
            helperText="Información adicional sobre el uso de esta key"
          />

          {/* Entorno */}
          <Select
            label="Entorno *"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'live' | 'test')}
          >
            <option value="live">Live (Producción)</option>
            <option value="test">Test (Desarrollo)</option>
          </Select>

          {/* ✅ NUEVO: Scope Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Alcance de la API Key *
            </label>

            <div className="space-y-2">
              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="scopeType"
                  value="tenant"
                  checked={scopeType === 'tenant'}
                  onChange={() => {
                    setScopeType('tenant');
                    setSelectedBranchId(null);
                  }}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    🌍 Todas las Sucursales
                  </div>
                  <div className="text-sm text-gray-500">
                    Esta API Key tendrá acceso a datos de todas las sucursales de tu organización.
                    Recomendado para integraciones centralizadas.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="scopeType"
                  value="branch"
                  checked={scopeType === 'branch'}
                  onChange={() => setScopeType('branch')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    🏢 Sucursal Específica (Recomendado)
                  </div>
                  <div className="text-sm text-gray-500">
                    Esta API Key solo tendrá acceso a datos de una sucursal en particular.
                    Más seguro y recomendado para la mayoría de los casos.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* ✅ NUEVO: Branch Selection (solo si scopeType === 'branch') */}
          {scopeType === 'branch' && (
            <Select
              label="Sucursal *"
              value={selectedBranchId || ''}
              onChange={(e) => setSelectedBranchId(e.target.value || null)}
              disabled={loadingBranches}
            >
              <option value="">Selecciona una sucursal...</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.address ? ` - ${branch.address}` : ''}
                </option>
              ))}
            </Select>
          )}

          {/* Scopes (Permisos) */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Permisos *
            </label>

            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-start gap-2 p-3 border rounded cursor-pointer hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedScopes.includes(scope.value)}
                    onChange={(checked) => {
                      if (checked) {
                        setSelectedScopes([...selectedScopes, scope.value]);
                      } else {
                        setSelectedScopes(selectedScopes.filter(s => s !== scope.value));
                      }
                    }}
                  />
                  <div>
                    <div className="font-medium text-sm">{scope.label}</div>
                    <div className="text-xs text-gray-500">{scope.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} isLoading={creating}>
              Crear API Key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const AVAILABLE_SCOPES = [
  { value: 'leads:read', label: 'Leer Leads', description: 'Ver información de leads' },
  { value: 'leads:write', label: 'Crear Leads', description: 'Crear y editar leads' },
  { value: 'appointments:read', label: 'Leer Citas', description: 'Ver citas agendadas' },
  { value: 'appointments:write', label: 'Crear Citas', description: 'Crear y modificar citas' },
  { value: 'menu:read', label: 'Leer Menú', description: 'Ver platillos y categorías' },
  { value: 'menu:write', label: 'Modificar Menú', description: 'Editar menú del restaurante' },
];
```

**Lista de API Keys con Branch Badge:**

```typescript
// src/features/api-settings/components/APIKeysList.tsx (snippet)

{keys.map((key) => (
  <div key={key.id} className="p-4 border rounded-lg">
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{key.name}</h3>

          {/* ✅ NUEVO: Branch Badge */}
          {key.scope_type === 'branch' && key.branch_name && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
              🏢 {key.branch_name}
            </span>
          )}

          {key.scope_type === 'tenant' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
              🌍 Todas las sucursales
            </span>
          )}

          <span className={cn(
            "px-2 py-1 text-xs rounded",
            key.environment === 'live'
              ? "bg-green-100 text-green-700"
              : "bg-orange-100 text-orange-700"
          )}>
            {key.environment === 'live' ? 'LIVE' : 'TEST'}
          </span>
        </div>

        <p className="text-sm text-gray-500 mt-1">{key.description}</p>

        <div className="mt-2 text-xs text-gray-400">
          Creada: {format(new Date(key.created_at), 'dd/MM/yyyy')}
          {key.last_used_at && ` • Último uso: ${formatDistanceToNow(new Date(key.last_used_at))}`}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => handleViewDetails(key)}>
          Ver Detalles
        </Button>
        <Button size="sm" variant="danger" onClick={() => handleRevoke(key)}>
          Revocar
        </Button>
      </div>
    </div>
  </div>
))}
```

---

### MICRO-FASE 2.4: Actualizar Endpoints (2 días)

**Objetivo:** Adaptar todos los endpoints para usar el nuevo middleware automático.

#### Pattern a Aplicar en Todos los Endpoints

```typescript
// Ejemplo: app/api/v1/leads/route.ts (actualización)

export async function GET(request: NextRequest) {
  // ... autenticación como antes ...
  const auth = await authenticateAPIKey(request, {
    requiredScope: 'leads:read',
  });

  if (!auth.success) {
    return createAPIKeyErrorResponse(auth);
  }

  // ✅ NUEVO: Extraer branch_id del query (FASE 1 backward compat)
  const url = new URL(request.url);
  const queryBranchId = url.searchParams.get('branch_id');

  try {
    const supabase = createAPIKeyAuthenticatedClient();

    // Build query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', auth.tenantId!);

    // ✅ NUEVO: Aplicar filtrado automático (prioriza query param, luego API Key branch_id)
    query = applyAutomaticBranchFilter(query, auth, 'leads', queryBranchId);

    // ... resto del código sin cambios ...

    // ✅ NUEVO: Incluir info de branch filtering en response
    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        total: count || 0,
        filtered_by: auth.branchId || queryBranchId || null,
        filter_source: queryBranchId ? 'query_param' : (auth.branchId ? 'api_key' : null),
      },
    });
  } catch (error) {
    // ... manejo de errores ...
  }
}
```

---

### MICRO-FASE 2.5: Testing End-to-End (3 días)

**Objetivo:** Validar funcionamiento completo del sistema.

#### Test Suite Completo

```typescript
// tests/integration/fase2-branch-api-keys.test.ts

describe('FASE 2: Branch-Specific API Keys', () => {
  let tenant: any;
  let branch1: any;
  let branch2: any;
  let tenantWideKey: string;
  let branch1Key: string;
  let branch2Key: string;

  beforeAll(async () => {
    tenant = await createTestTenant();
    branch1 = await createTestBranch(tenant.id, 'Branch 1');
    branch2 = await createTestBranch(tenant.id, 'Branch 2');

    // Create test data
    await createTestLead(tenant.id, branch1.id, { name: 'Lead B1-1' });
    await createTestLead(tenant.id, branch1.id, { name: 'Lead B1-2' });
    await createTestLead(tenant.id, branch2.id, { name: 'Lead B2-1' });
    await createTestLead(tenant.id, branch2.id, { name: 'Lead B2-2' });

    // Create API Keys
    tenantWideKey = await createAPIKey({
      tenant_id: tenant.id,
      scope_type: 'tenant',
      scopes: ['leads:read'],
    });

    branch1Key = await createAPIKey({
      tenant_id: tenant.id,
      branch_id: branch1.id,
      scope_type: 'branch',
      scopes: ['leads:read'],
    });

    branch2Key = await createAPIKey({
      tenant_id: tenant.id,
      branch_id: branch2.id,
      scope_type: 'branch',
      scopes: ['leads:read'],
    });
  });

  describe('Tenant-wide API Key', () => {
    test('TC-F2-001: Should return all leads from all branches', async () => {
      const response = await fetch('/api/v1/leads', {
        headers: { Authorization: `Bearer ${tenantWideKey}` },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(4);  // Todos los leads
    });
  });

  describe('Branch-specific API Key', () => {
    test('TC-F2-002: Should return only leads from assigned branch', async () => {
      const response = await fetch('/api/v1/leads', {
        headers: { Authorization: `Bearer ${branch1Key}` },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBe(2);  // Solo Branch 1
      expect(data.data.every(lead => lead.branch_id === branch1.id)).toBe(true);
    });

    test('TC-F2-003: Query param should NOT override API Key branch', async () => {
      // Intentar acceder a Branch 2 con API Key de Branch 1
      const response = await fetch(`/api/v1/leads?branch_id=${branch2.id}`, {
        headers: { Authorization: `Bearer ${branch1Key}` },
      });

      const data = await response.json();

      // Debe retornar solo Branch 1 (API Key tiene prioridad)
      expect(data.data.every(lead => lead.branch_id === branch1.id)).toBe(true);
    });
  });

  describe('Backward Compatibility (FASE 1)', () => {
    test('TC-F2-004: Query param should work with tenant-wide key', async () => {
      const response = await fetch(`/api/v1/leads?branch_id=${branch1.id}`, {
        headers: { Authorization: `Bearer ${tenantWideKey}` },
      });

      const data = await response.json();

      expect(data.data.length).toBe(2);  // Solo Branch 1
      expect(data.data.every(lead => lead.branch_id === branch1.id)).toBe(true);
    });
  });
});
```

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs Fase 2

| Métrica | Target | Medición |
|---------|--------|----------|
| **Migración:** % keys migradas a branch-specific | >70% en 1 mes | Database query |
| **Performance:** Query latency con branch filter | <100ms p95 | APM |
| **Adopción:** Nuevas keys creadas como branch-specific | >80% | Analytics |
| **Errores:** Error rate en autenticación | <0.1% | Error tracking |
| **Zero Downtime:** Uptime durante deploy | 100% | Monitoring |

---

## 🔄 PLAN DE ROLLBACK

### Rollback Steps

```bash
# 1. Revertir código de aplicación
git revert <commit-hash-fase-2>
vercel --prod

# 2. (Opcional) Revertir migration
# IMPORTANTE: NO borrar columnas, solo dejar de usarlas
# Las API Keys existentes seguirán funcionando

# 3. Comunicar a clientes
# "Hemos revertido temporalmente la funcionalidad de API Keys por sucursal.
#  Las keys existentes siguen funcionando normalmente."
```

**Impacto de Rollback:**
- ⏱️ Downtime: 0 minutos (rollback instantáneo)
- 💾 Data Loss: NINGUNO (columnas quedan en DB)
- 🔑 Keys afectadas: Branch-specific keys vuelven a comportarse como tenant-wide

---

## ✅ CHECKLIST DE COMPLETITUD

### Database
- [ ] Migration ejecutada en staging
- [ ] Migration ejecutada en producción
- [ ] Backup pre-migration realizado
- [ ] Índices creados y optimizados
- [ ] Constraints validados

### Backend
- [ ] `api-key-auth.ts` actualizado
- [ ] `applyAutomaticBranchFilter` implementado
- [ ] Todos los endpoints actualizados
- [ ] Tests unitarios (100% coverage)
- [ ] Tests de integración pasando

### Frontend
- [ ] UI de creación de keys actualizada
- [ ] Lista de keys muestra branch context
- [ ] Documentación in-app actualizada
- [ ] Flujo de onboarding actualizado

### Documentation
- [ ] API Reference actualizado
- [ ] Migration guide para clientes
- [ ] Internal wiki actualizado
- [ ] Changelog publicado

### Deploy & Monitoring
- [ ] Staging validated
- [ ] Production deployed
- [ ] Monitoring dashboards actualizados
- [ ] Alertas configuradas
- [ ] Rollback plan tested

---

**Status:** ⏳ READY FOR EXECUTION (Post-FASE 1)
**Dependencias:** FASE 1 completada y validada
**Próximo Step:** Kickoff meeting FASE 2
