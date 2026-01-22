# FASE 4: Integración Admin Auth Centralizado

## Información de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 4 - Admin Auth |
| **Duración Estimada** | 1-2 horas |
| **Riesgo** | 🟡 MEDIO |
| **Prerrequisitos** | Fases 0-3 completadas |
| **Resultado** | Autenticación admin centralizada con rate limiting |

---

## Objetivo

Reemplazar las funciones `verifyAdminKey` duplicadas en cada endpoint admin por el módulo centralizado `admin-auth.ts`:

1. Eliminar código duplicado (DRY)
2. Agregar rate limiting a endpoints admin
3. Mejorar logging de intentos de autenticación
4. Mantener compatibilidad con la API existente

---

## ¿Por Qué es Riesgo Medio?

| Factor | Riesgo | Mitigación |
|--------|--------|------------|
| Perder acceso admin | 🟡 | Probar con tu key antes de migrar |
| Rate limiting muy agresivo | 🟡 | Configurar límites razonables |
| Lógica diferente | 🟡 | Comparar código actual vs nuevo |

---

## Inventario de Endpoints Admin

### Endpoints a migrar:

| # | Endpoint | Archivo | Función Actual |
|---|----------|---------|----------------|
| 1 | Seed Data | `app/api/admin/seed-data/route.ts` | `verifyAdminKey()` inline |
| 2 | Fix RLS | `app/api/admin/fix-rls/route.ts` | `verifyAdminKey()` inline |
| 3 | Link Stripe | `app/api/admin/link-stripe/route.ts` | `verifyAdminKey()` inline |
| 4 | Setup User | `app/api/admin/setup-user/route.ts` | `verifyAdminKey()` inline |
| 5 | Sync Tenant | `app/api/admin/sync-tenant-metadata/route.ts` | `verifyAdminKey()` inline |
| 6 | Feature Flags | `app/api/admin/feature-flags/*/route.ts` | `verifyAdminKey()` inline |
| 7 | Rollout | `app/api/admin/rollout/route.ts` | `verifyAdminKey()` inline |
| 8 | Monitoring | `app/api/admin/monitoring/dashboard/route.ts` | `verifyAdminKey()` inline |
| 9 | Cleanup | `app/api/admin/cleanup-payment-methods/route.ts` | `verifyAdminKey()` inline |

---

## Microfases

### 4.1 Comparar Lógica Actual vs Nueva

**Objetivo**: Asegurar que admin-auth.ts cubre todos los casos

#### Código Actual (típico en cada endpoint):

```typescript
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin API] ADMIN_API_KEY not configured in production');
      return false;
    }
    return true; // Permitir en desarrollo sin key
  }

  if (!adminKey) {
    return false;
  }

  try {
    const keyBuffer = Buffer.from(adminKey);
    const expectedBuffer = Buffer.from(expectedKey);
    if (keyBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
```

#### Código Nuevo (admin-auth.ts):

```typescript
export function verifyAdminAuth(
  request: NextRequest,
  config: AdminAuthConfig = {}
): AdminAuthResult {
  // 1. Verificar que ADMIN_API_KEY está configurado
  // 2. En desarrollo, permitir sin key si requireInDev es false
  // 3. Aplicar rate limiting (opcional)
  // 4. Verificar key con timing-safe comparison
  // 5. Retornar resultado estructurado con response preformateada
}
```

#### Diferencias Clave:

| Aspecto | Código Actual | Código Nuevo |
|---------|---------------|--------------|
| Rate Limiting | ❌ No | ✅ Sí (configurable) |
| Logging | ❌ Básico | ✅ Estructurado |
| Response | Manual | Preformateada |
| Configuración | Hardcoded | Via config object |

#### Checklist 4.1:
- [ ] Lógica de timing-safe comparison es idéntica
- [ ] Comportamiento en desarrollo es compatible
- [ ] Rate limiting es opcional (default: activo)

---

### 4.2 Probar admin-auth.ts Manualmente

**Objetivo**: Verificar que funciona antes de migrar endpoints

#### Test con tu admin key:

```bash
# 1. Verificar que tienes ADMIN_API_KEY en .env.local
grep ADMIN_API_KEY .env.local

# 2. Crear un script de prueba temporal
cat > test-admin-auth.ts << 'EOF'
import { verifyAdminAuth } from './src/shared/lib/admin-auth';

// Mock request
const mockRequest = {
  headers: {
    get: (name: string) => {
      if (name === 'x-admin-key') return process.env.ADMIN_API_KEY;
      return null;
    },
  },
  nextUrl: { pathname: '/api/admin/test' },
} as any;

const result = verifyAdminAuth(mockRequest, { rateLimit: false });
console.log('Result:', result);
console.log('Authorized:', result.authorized);
EOF

# 3. Ejecutar (usando ts-node o similar)
npx ts-node test-admin-auth.ts

# 4. Limpiar
rm test-admin-auth.ts
```

#### Verificar resultado esperado:
```
Result: { authorized: true, response: undefined }
Authorized: true
```

#### Checklist 4.2:
- [ ] Test con key válida retorna authorized: true
- [ ] Test con key inválida retorna authorized: false
- [ ] Test sin key retorna authorized: false (en prod)

---

### 4.3 Pilot: Endpoint Admin No Crítico

**Objetivo**: Migrar un endpoint admin de bajo impacto

#### Archivo: `app/api/admin/seed-data/route.ts`

**ANTES:**
```typescript
import { timingSafeEqual } from 'crypto';

function verifyAdminKey(request: NextRequest): boolean {
  // ... código duplicado de verificación ...
}

export async function POST(request: NextRequest) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... resto del código ...
}
```

**DESPUÉS:**
```typescript
import { verifyAdminAuth } from '@/src/shared/lib/admin-auth';

// Eliminar función verifyAdminKey local

export async function POST(request: NextRequest) {
  // Verificar autenticación admin
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.response; // Ya incluye el error formateado
  }

  // ... resto del código sin cambios ...
}
```

#### Verificación:

```bash
# 1. Probar con key válida
curl -X POST http://localhost:3000/api/admin/seed-data \
  -H "x-admin-key: TU_ADMIN_KEY_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "test"}'

# Esperado: Respuesta del endpoint (no 401)

# 2. Probar con key inválida
curl -X POST http://localhost:3000/api/admin/seed-data \
  -H "x-admin-key: wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "test"}'

# Esperado: {"error": "Invalid admin key", "code": "INVALID_KEY"}

# 3. Probar sin key
curl -X POST http://localhost:3000/api/admin/seed-data \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "test"}'

# Esperado: {"error": "Admin key required", "code": "NO_KEY_PROVIDED"}
```

#### Checklist 4.3:
- [ ] Endpoint migrado
- [ ] Funciona con key válida
- [ ] Rechaza key inválida
- [ ] Rechaza sin key

---

### 4.4 Migrar Endpoints Críticos

**Objetivo**: Migrar endpoints admin más importantes

#### Orden de migración:

| # | Endpoint | Criticidad | Notas |
|---|----------|------------|-------|
| 1 | fix-rls | Alta | Modifica permisos de DB |
| 2 | link-stripe | Alta | Conecta cuentas de pago |
| 3 | setup-user | Media | Crea usuarios admin |
| 4 | rollout | Media | Feature flags |

#### Patrón para cada migración:

```typescript
// 1. Agregar import
import { verifyAdminAuth } from '@/src/shared/lib/admin-auth';

// 2. Eliminar función verifyAdminKey local

// 3. Reemplazar verificación en cada función (GET, POST, etc.)
export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }
  // ... resto igual ...
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }
  // ... resto igual ...
}
```

#### Verificar después de cada migración:

```bash
# Test rápido con tu admin key
curl -X GET "http://localhost:3000/api/admin/[endpoint]" \
  -H "x-admin-key: $ADMIN_API_KEY"
```

#### Checklist 4.4:
- [ ] fix-rls migrado y verificado
- [ ] link-stripe migrado y verificado
- [ ] setup-user migrado y verificado
- [ ] rollout migrado y verificado

---

### 4.5 Migrar Resto de Endpoints Admin

**Objetivo**: Completar la migración

#### Endpoints restantes:

| Endpoint | Archivo |
|----------|---------|
| sync-tenant-metadata | `app/api/admin/sync-tenant-metadata/route.ts` |
| feature-flags/* | `app/api/admin/feature-flags/*/route.ts` |
| monitoring/dashboard | `app/api/admin/monitoring/dashboard/route.ts` |
| cleanup-payment-methods | `app/api/admin/cleanup-payment-methods/route.ts` |
| rollout/checklist | `app/api/admin/rollout/checklist/route.ts` |

#### Checklist 4.5:
- [ ] Todos los endpoints admin migrados
- [ ] Cada endpoint verificado con curl
- [ ] Tests pasan

---

### 4.6 Configurar Rate Limiting para Admin

**Objetivo**: Decidir si activar rate limiting en admin

#### Opciones:

**Opción A: Rate Limiting Activo (Default)**
```typescript
const auth = verifyAdminAuth(request);
// Rate limiting aplicado automáticamente
```

**Opción B: Sin Rate Limiting**
```typescript
const auth = verifyAdminAuth(request, { rateLimit: false });
// Sin rate limiting
```

#### Recomendación:

| Endpoint | Rate Limiting | Razón |
|----------|---------------|-------|
| seed-data | ❌ Desactivado | Solo desarrollo |
| fix-rls | ✅ Activo | Crítico, proteger |
| link-stripe | ✅ Activo | Crítico, proteger |
| monitoring | ❌ Desactivado | Consulta frecuente OK |

#### Implementar configuración personalizada:

```typescript
// Para endpoints que no necesitan rate limiting:
const auth = verifyAdminAuth(request, { rateLimit: false });

// Para endpoints críticos (default):
const auth = verifyAdminAuth(request);
```

#### Checklist 4.6:
- [ ] Rate limiting configurado según tabla
- [ ] Endpoints de desarrollo sin rate limiting
- [ ] Endpoints críticos con rate limiting

---

### 4.7 Eliminar Código Duplicado

**Objetivo**: Limpiar funciones verifyAdminKey inline

#### Buscar y eliminar:

```bash
# Buscar funciones duplicadas que ya no se usan
grep -r "function verifyAdminKey" app/api/admin/

# Para cada archivo encontrado:
# 1. Verificar que ya usa verifyAdminAuth
# 2. Eliminar la función verifyAdminKey
# 3. Eliminar import de timingSafeEqual si ya no se usa
```

#### Checklist 4.7:
- [ ] Todas las funciones verifyAdminKey inline eliminadas
- [ ] Imports de crypto/timingSafeEqual eliminados donde no se usan
- [ ] No hay código muerto

---

### 4.8 Verificación Final

**Objetivo**: Confirmar que todo funciona

#### Tests:

```bash
# 1. Ejecutar tests
npm test

# 2. Verificar build
npm run build

# 3. Probar todos los endpoints admin con tu key
ADMIN_KEY="tu-key-aqui"

curl -H "x-admin-key: $ADMIN_KEY" http://localhost:3000/api/admin/seed-data
curl -H "x-admin-key: $ADMIN_KEY" http://localhost:3000/api/admin/fix-rls
# ... etc
```

#### Checklist 4.8:
- [ ] Tests pasan
- [ ] Build exitoso
- [ ] Todos los endpoints admin accesibles con key válida
- [ ] Todos rechazan keys inválidas

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `app/api/admin/seed-data/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/fix-rls/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/link-stripe/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/setup-user/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/sync-tenant-metadata/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/feature-flags/*/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/rollout/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/rollout/checklist/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/monitoring/dashboard/route.ts` | Migrado a verifyAdminAuth |
| `app/api/admin/cleanup-payment-methods/route.ts` | Migrado a verifyAdminAuth |

---

## Rollback

### Si pierdes acceso admin:

```bash
# 1. Verificar que ADMIN_API_KEY está en .env.local
grep ADMIN_API_KEY .env.local

# 2. Verificar que es el mismo valor que usas en el header

# 3. Si necesitas rollback urgente:
git checkout backup/pre-migration-2026-01-21 -- app/api/admin/
npm run build
```

### Si rate limiting bloquea tu acceso:

```bash
# Opción 1: Esperar (default: 60 segundos)

# Opción 2: Desactivar rate limiting temporalmente
# En cada endpoint, cambiar a:
const auth = verifyAdminAuth(request, { rateLimit: false });
```

---

## Siguiente Paso

✅ **Fase 4 Completada**

Proceder a: [FASE_5_VALIDACION.md](./FASE_5_VALIDACION.md)

---

## Troubleshooting

### "Unauthorized" con key correcta

1. Verificar que la key no tiene espacios extra
2. Verificar que usas header `x-admin-key` (no `X-Admin-Key` ni otro)
3. Verificar logs para ver el motivo exacto del rechazo

### "Rate limit exceeded" muy rápido

1. El límite default es 3 requests por minuto para admin
2. Para endpoints que consultas frecuentemente, usa `{ rateLimit: false }`
3. O aumenta el límite en admin-auth.ts

### "Cannot find module admin-auth"

```bash
# Verificar que existe
ls src/shared/lib/admin-auth.ts

# Verificar export en index.ts
grep "admin-auth" src/shared/lib/index.ts
```
