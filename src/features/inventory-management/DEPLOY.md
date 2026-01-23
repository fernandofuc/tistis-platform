# Deployment Guide - Inventory Management

## TIS TIS Platform - Guía de Despliegue

> Guía para desplegar el módulo de Inventory Management en producción.

---

## Pre-requisitos

### 1. Variables de Entorno Requeridas

El módulo de Inventory Management requiere las siguientes variables de entorno:

```env
# Supabase (Requerido)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
```

### 2. Base de Datos (Supabase)

El módulo espera las siguientes tablas en la base de datos:

#### Tabla: `inventory_items`

```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID REFERENCES branches(id),
  category_id UUID REFERENCES inventory_categories(id),

  -- Identificación
  sku VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Tipo
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('ingredient', 'supply', 'equipment', 'packaging')),

  -- Unidades y Costos
  unit VARCHAR(20) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'MXN',

  -- Stock
  current_stock DECIMAL(12,4) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(12,4) NOT NULL DEFAULT 0,
  maximum_stock DECIMAL(12,4),
  reorder_quantity DECIMAL(12,4),

  -- Almacenamiento
  storage_location VARCHAR(100),
  storage_type VARCHAR(20) DEFAULT 'dry' CHECK (storage_type IN ('dry', 'refrigerated', 'frozen', 'ambient')),

  -- Caducidad
  is_perishable BOOLEAN DEFAULT true,
  default_shelf_life_days INTEGER,
  track_expiration BOOLEAN DEFAULT true,

  -- Proveedor
  preferred_supplier_id UUID REFERENCES suppliers(id),
  supplier_sku VARCHAR(50),

  -- Imagen
  image_url TEXT,

  -- Alergenos
  allergens TEXT[] DEFAULT '{}',

  -- Estado
  is_active BOOLEAN DEFAULT true,
  is_trackable BOOLEAN DEFAULT true,

  -- Metadatos
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indices
CREATE INDEX idx_inventory_items_tenant ON inventory_items(tenant_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_name ON inventory_items(name);
CREATE INDEX idx_inventory_items_type ON inventory_items(item_type);
CREATE INDEX idx_inventory_items_active ON inventory_items(is_active) WHERE deleted_at IS NULL;
```

#### Row Level Security (RLS)

```sql
-- Habilitar RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver solo items de su tenant
CREATE POLICY "Users can view own tenant items" ON inventory_items
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- Policy: Usuarios pueden crear items en su tenant
CREATE POLICY "Users can create items in own tenant" ON inventory_items
  FOR INSERT
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

-- Policy: Usuarios pueden actualizar items de su tenant
CREATE POLICY "Users can update own tenant items" ON inventory_items
  FOR UPDATE
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- Policy: Usuarios pueden eliminar items de su tenant
CREATE POLICY "Users can delete own tenant items" ON inventory_items
  FOR DELETE
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

#### Realtime

```sql
-- Habilitar realtime para la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
```

---

## Configuración de Vercel

El proyecto ya tiene configuración de Vercel en `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/process",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/generate-insights",
      "schedule": "0 3 */3 * *"
    }
  ]
}
```

### Variables de Entorno en Vercel

1. Ir a Settings > Environment Variables
2. Agregar las siguientes variables:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase | `eyJhbGc...` |

---

## Verificación Pre-Deploy

### 1. Ejecutar Tests

```bash
# Ejecutar todos los tests del módulo
pnpm test:vitest __tests__/features/inventory-management/
```

### 2. Verificar TypeScript

```bash
# Verificar tipos
pnpm typecheck
```

### 3. Verificar ESLint

```bash
# Verificar linting
pnpm lint
```

### 4. Build de Producción

```bash
# Ejecutar build
pnpm build
```

---

## Checklist de Deploy

- [ ] Variables de entorno configuradas en Vercel
- [ ] Tablas de base de datos creadas
- [ ] RLS policies configuradas
- [ ] Realtime habilitado para inventory_items
- [ ] Tests pasando (282 tests)
- [ ] TypeScript sin errores
- [ ] ESLint sin errores
- [ ] Build exitoso

---

## Monitoreo Post-Deploy

### 1. Verificar Logs

En Vercel Dashboard > Logs, verificar que no hay errores relacionados con:
- Conexión a Supabase
- Autenticación de usuarios
- Queries de inventario

### 2. Verificar Realtime

Probar que las actualizaciones en tiempo real funcionan:
1. Abrir la aplicación en dos pestañas
2. Crear/actualizar un item en una pestaña
3. Verificar que la otra pestaña recibe la actualización

### 3. Verificar Performance

Monitorear tiempos de respuesta de:
- `getInventoryItems` - debe ser < 500ms
- `createInventoryItem` - debe ser < 300ms
- `updateInventoryItem` - debe ser < 300ms

---

## Rollback

Si hay problemas en producción:

1. **Rollback de código**
   - En Vercel Dashboard > Deployments
   - Seleccionar deployment anterior
   - Click "Promote to Production"

2. **Rollback de base de datos**
   - Si se hicieron cambios a tablas
   - Ejecutar scripts de rollback SQL

---

## Troubleshooting

### Error: "User not authenticated"

**Causa:** El usuario no tiene sesión activa.

**Solución:**
1. Verificar que el middleware de Supabase está configurado
2. Verificar que el usuario tiene `tenant_id` en metadata

### Error: "Tenant not found"

**Causa:** El usuario no tiene `tenant_id` asignado.

**Solución:**
1. Verificar user_metadata en Supabase Auth
2. Ejecutar query de actualización si es necesario:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"tenant_id": "uuid-here"}'
WHERE id = 'user-uuid';
```

### Error: "Realtime not receiving updates"

**Causa:** Realtime no está habilitado para la tabla.

**Solución:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
```

### Error: "Row Level Security violation"

**Causa:** Las policies de RLS no están configuradas correctamente.

**Solución:**
1. Verificar que las policies existen
2. Verificar que el JWT incluye tenant_id
3. Probar con la función de test de RLS en Supabase

---

## Contacto de Soporte

Para problemas de deploy, contactar al equipo de desarrollo.

---

*Guía de deploy actualizada: Enero 2026*
