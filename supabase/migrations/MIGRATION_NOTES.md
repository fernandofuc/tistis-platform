# Notas de Migraciones - TIS TIS Platform

**Última actualización:** 10 de Diciembre, 2024
**Versión:** 2.2.0

---

## Orden de Ejecución de Migraciones

Las migraciones deben ejecutarse en orden secuencial para garantizar la integridad de la base de datos:

```bash
001_initial_schema.sql              # Schema base + discovery sessions
002_add_session_token.sql           # Token de sesión para onboarding
003_esva_schema_v2.sql             # Schema multi-tenant completo
004_esva_seed_data.sql             # Datos de ESVA (tenant inicial)
005_patients_module.sql            # Módulo de pacientes
006_quotes_module.sql              # Módulo de cotizaciones
007_files_storage_setup.sql        # Storage buckets
008_notifications_module.sql      # Sistema de notificaciones
009_critical_fixes.sql             # Fixes de seguridad y performance
010_assembly_engine.sql            # Motor de ensamblaje de propuestas
011_master_correction.sql          # NUEVA - Corrección master crítica
```

---

## 011_master_correction.sql - Corrección Master (10 Dic 2024)

### Propósito

Corrige todos los problemas críticos identificados en la auditoría de migraciones 001-010, incluyendo:
- Tablas faltantes referenciadas por RLS policies
- Views con columnas incorrectas
- Precios desactualizados en planes y addons
- RLS policies con lógica incorrecta (JWT claims no existentes)
- Configuración de verticales por tipo de negocio

### Cambios Críticos Realizados

#### 1. Tabla `user_roles` (CRÍTICO - NO EXISTÍA)

**Problema:** Las RLS policies de múltiples tablas (leads, appointments, branches, staff, etc.) referenciaban `public.user_roles` para validar permisos multi-tenant, pero la tabla no existía.

**Solución:**
```sql
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_id UUID REFERENCES public.tenants(id),
    role VARCHAR(50) CHECK (role IN ('super_admin', 'admin', 'owner', ...)),
    staff_id UUID REFERENCES public.staff(id),
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, tenant_id)  -- Un usuario = un rol por tenant
);
```

**Índices creados:**
- `idx_user_roles_user_id`
- `idx_user_roles_tenant_id`
- `idx_user_roles_role`
- `idx_user_roles_staff_id`
- `idx_user_roles_active` (parcial index WHERE is_active = true)

**RLS Policies:**
- Super admin: acceso completo
- Admin: gestión de roles en su tenant
- Usuarios: ver su propio rol
- Service role: acceso completo

**Sincronización automática:**
- Trigger `trigger_sync_staff_user_role` sincroniza tabla `staff` → `user_roles`
- Al crear/actualizar staff con `user_id`, auto-crea/actualiza en `user_roles`

#### 2. VIEW `staff_members` (FALTABA)

**Problema:** Migraciones 005 y 006 referenciaban `staff_members` pero solo existía tabla `staff`.

**Solución:**
```sql
CREATE OR REPLACE VIEW public.staff_members AS
SELECT * FROM public.staff;
```

#### 3. Actualización de Precios de Planes (CRÍTICO PARA NEGOCIO)

**Cambios realizados:**

| Plan | Precio Anterior | Precio NUEVO | Activation Fee |
|------|----------------|--------------|----------------|
| Starter | $799/mes | **$3,490/mes** | $0 (antes $1,500) |
| Essentials | $1,499/mes | **$7,490/mes** | $0 (antes $2,500) |
| Growth | $2,999/mes | **$12,490/mes** | $0 (antes $3,500) |
| Scale | $5,999/mes | **$19,990/mes** | $0 (antes $5,000) |

**Cambios en tabla `plans`:**
```sql
ALTER TABLE public.plans
    ALTER COLUMN activation_fee DROP NOT NULL,
    ALTER COLUMN activation_fee DROP DEFAULT;

UPDATE public.plans SET
    monthly_price = [nuevo_precio],
    activation_fee = 0,  -- Eliminado costo de setup
    max_locations = [actualizado],
    max_users = [actualizado],
    features = [actualizados]
WHERE id = '[plan_id]';
```

**Tabla `proposals` actualizada:**
```sql
ALTER TABLE public.proposals
    ALTER COLUMN activation_fee SET DEFAULT 0;

UPDATE public.proposals SET activation_fee = 0 WHERE activation_fee > 0;
```

#### 4. Actualización de Addons

**Eliminación y recreación completa:**
```sql
DELETE FROM public.addons;

INSERT INTO public.addons VALUES
('facturacion', 'Sistema de Facturación Automática', ..., 1990),
('cotizaciones', 'Cotizaciones Automáticas', ..., 1990),
('analytics-pro', 'Reportes Diarios Automatizados', ..., 2990),
('campanas-wa', 'Marketing Personalizado', ..., 1490),
('voz-basico', 'Asistente de Voz IA 24/7', ..., 2290),
('digitalizador', 'Documentación Automática', ..., 4490);
```

Todos los addons ahora incluyen:
- `compatible_plans` (array de plan IDs)
- `compatible_verticals` (array de verticales)
- `is_active` boolean

#### 5. Corrección de RLS Policies (SEGURIDAD CRÍTICA)

**Problema:** Policies originales usaban:
```sql
auth.jwt() -> 'tenant_id'  -- ❌ tenant_id NO existe en JWT
```

**Solución:** Todas las policies actualizadas para usar `user_roles`:
```sql
-- ✅ Correcto: Buscar tenant del usuario
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
```

**Tablas corregidas:**
- ✅ `leads`
- ✅ `appointments`
- ✅ `branches`
- ✅ `staff`
- ✅ `services`
- ✅ `conversations`
- ✅ `faqs`

#### 6. Corrección de VIEW `quotes_full`

**Problema:**
```sql
l.name  -- ❌ Columna no existe en tabla leads
```

**Solución:**
```sql
l.full_name  -- ✅ Columna correcta
```

**VIEW actualizada:**
```sql
CREATE OR REPLACE VIEW public.quotes_full AS
SELECT
    q.*,
    CASE
        WHEN q.patient_id IS NOT NULL THEN p.first_name || ' ' || p.last_name
        WHEN q.lead_id IS NOT NULL THEN l.full_name  -- Corregido
        ELSE 'Sin asignar'
    END as client_name,
    -- ... resto de la view
FROM public.quotes q
LEFT JOIN public.patients p ON q.patient_id = p.id
LEFT JOIN public.leads l ON q.lead_id = l.id
-- ...
```

#### 7. Tabla `vertical_configs` (NUEVA)

**Propósito:** Configuración de módulos y sidebar por tipo de negocio.

**Estructura:**
```sql
CREATE TABLE public.vertical_configs (
    id UUID PRIMARY KEY,
    vertical VARCHAR(50) UNIQUE CHECK (vertical IN (
        'dental', 'restaurant', 'pharmacy', 'retail',
        'medical', 'services', 'industrial', 'other'
    )),
    display_name VARCHAR(100),
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Building',
    enabled_modules JSONB DEFAULT '[]',
    sidebar_config JSONB DEFAULT '[]',
    features JSONB DEFAULT '{}',
    extension_tables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true
);
```

**Seed data incluye:**
- **Dental:** Dashboard, Leads, Pacientes, Calendario, Cotizaciones, Inbox, Analytics
- **Restaurant:** Dashboard, Leads, Pedidos, Menú, Reservas, Inventario, Inbox
- **Medical:** Dashboard, Leads, Pacientes, Calendario, Inbox, Analytics
- **Retail:** Dashboard, Leads, Inventario, Pedidos, Inbox, Analytics
- **Services:** Dashboard, Leads, Calendario, Cotizaciones, Inbox, Analytics

**RLS Policies:**
- Todos pueden leer configs activos
- Solo service_role puede modificar

#### 8. Funciones Helper

**Función `get_user_tenant_id()`:**
```sql
CREATE OR REPLACE FUNCTION get_user_tenant_id(p_user_id UUID DEFAULT NULL)
RETURNS UUID AS $$
BEGIN
    SELECT tenant_id FROM public.user_roles
    WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

**Uso:** Obtener tenant_id del usuario actual o especificado.

#### 9. Vinculación de Staff Existente (ESVA)

**Migración automática:**
```sql
INSERT INTO public.user_roles (user_id, tenant_id, role, staff_id, is_active)
SELECT
    au.id,
    s.tenant_id,
    s.role,
    s.id,
    s.is_active
FROM public.staff s
JOIN auth.users au ON LOWER(au.email) = LOWER(s.email)
WHERE s.deleted_at IS NULL
ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    staff_id = EXCLUDED.staff_id,
    is_active = EXCLUDED.is_active;
```

**Nota:** Solo vincula staff que ya tienen usuario en `auth.users`.

#### 10. Triggers para `updated_at`

```sql
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vertical_configs_updated_at
    BEFORE UPDATE ON public.vertical_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## Impacto en Frontend

### Archivos Actualizados

#### 1. `/app/proposal/page.tsx`
**Cambios:**
```typescript
// ANTES:
const PLANS = {
  starter: { price: 799, ... },
  essentials: { price: 1499, ... },
  // ...
};

// DESPUÉS:
const PLANS = {
  starter: { price: 3490, ... },
  essentials: { price: 7490, ... },
  growth: { price: 12490, ... },
  scale: { price: 19990, ... },
};

// ELIMINADO:
setup_fee: 1500  // Ya no existe

// AÑADIDO:
setup_fee: 0
```

**Líneas afectadas:** 16-68, 190

#### 2. `/app/checkout/page.tsx`
**Estado:** Ya tenía precios correctos (no requirió cambios).

#### 3. `/public/pricing-tistis.html`
**Estado:** Ya tenía precios correctos (no requirió cambios).

---

## Cómo Ejecutar esta Migración

### Opción 1: Supabase Dashboard (Recomendado)

1. Ir a **SQL Editor** en Supabase Dashboard
2. Crear nueva query
3. Copiar contenido de `/supabase/migrations/011_master_correction.sql`
4. Ejecutar (presionar Run o Cmd/Ctrl + Enter)
5. Verificar mensaje: "Migration 011_master_correction.sql ejecutada exitosamente!"

### Opción 2: Supabase CLI

```bash
# Desde la raíz del proyecto
supabase db push

# O ejecutar migración específica
supabase db execute --file supabase/migrations/011_master_correction.sql
```

### Opción 3: psql directo

```bash
psql -h db.PROJECT_REF.supabase.co \
     -p 5432 \
     -d postgres \
     -U postgres \
     -f supabase/migrations/011_master_correction.sql
```

---

## Validación Post-Migración

### Verificar Tablas Creadas
```sql
-- Verificar user_roles existe
SELECT COUNT(*) FROM public.user_roles;

-- Verificar vertical_configs con seed data
SELECT vertical, display_name FROM public.vertical_configs;

-- Verificar staff_members view
SELECT COUNT(*) FROM public.staff_members;
```

### Verificar Precios Actualizados
```sql
SELECT id, name, monthly_price, activation_fee
FROM public.plans
ORDER BY monthly_price;
```

**Resultado esperado:**
```
starter      | Starter      | 3490  | 0
essentials   | Essentials   | 7490  | 0
growth       | Growth       | 12490 | 0
scale        | Scale        | 19990 | 0
```

### Verificar Addons
```sql
SELECT id, name, monthly_price
FROM public.addons
WHERE is_active = true
ORDER BY monthly_price;
```

### Verificar RLS Policies
```sql
-- Verificar policies de leads
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'leads'
AND schemaname = 'public';
```

### Verificar Vinculación Staff → User Roles
```sql
SELECT
    ur.user_id,
    ur.tenant_id,
    ur.role,
    s.email,
    s.first_name
FROM public.user_roles ur
JOIN public.staff s ON ur.staff_id = s.id;
```

---

## Problemas Conocidos y Soluciones

### Problema 1: Constraint violation en user_roles

**Error:**
```
duplicate key value violates unique constraint "user_roles_user_id_tenant_id_key"
```

**Causa:** Intentar insertar usuario que ya existe en el tenant.

**Solución:**
```sql
-- Usar ON CONFLICT
INSERT INTO public.user_roles (...)
ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = NOW();
```

### Problema 2: VIEW quotes_full devuelve NULL en client_name

**Causa:** Lead no tiene `full_name` (campo requerido).

**Solución:**
```sql
-- Actualizar leads sin full_name
UPDATE public.leads
SET full_name = 'Sin nombre'
WHERE full_name IS NULL;
```

### Problema 3: Frontend muestra precios antiguos

**Causa:** Caché del navegador o sessionStorage.

**Solución:**
```javascript
// En consola del navegador:
sessionStorage.clear();
location.reload();
```

---

## Rollback (En caso de emergencia)

**ADVERTENCIA:** Solo ejecutar si es absolutamente necesario.

```sql
-- 1. Eliminar tabla user_roles
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 2. Eliminar tabla vertical_configs
DROP TABLE IF EXISTS public.vertical_configs CASCADE;

-- 3. Eliminar view staff_members
DROP VIEW IF EXISTS public.staff_members;

-- 4. Restaurar precios anteriores (si es necesario)
UPDATE public.plans SET
    monthly_price = 799,
    activation_fee = 1500
WHERE id = 'starter';
-- ... repetir para otros planes

-- 5. Restaurar policies originales
-- Ver migraciones 002, 003 para syntax original
```

**NOTA:** Rollback no recomendado ya que las policies antiguas eran incorrectas.

---

## Próximas Migraciones Planeadas

### 012_payments_module.sql (Pendiente)
- Tabla `payments` para tracking de pagos
- Integración con Stripe webhooks
- Estados de pago y suscripciones

### 013_analytics_module.sql (Pendiente)
- Tablas de métricas agregadas
- Views materializadas para reportes
- Funciones de análisis de negocio

### 014_campaign_module.sql (Pendiente)
- Tabla `campaigns` para marketing
- Tracking de conversiones
- A/B testing capabilities

---

## Documentos Relacionados

- **README.md** - Guía general del proyecto
- **STATUS_PROYECTO.md** - Estado completo del desarrollo
- **INTEGRATION_GUIDE.md** - Guías de integración
- **supabase/migrations/009_critical_fixes.sql** - Migración anterior crítica

---

## Contacto y Soporte

Para preguntas sobre esta migración:
- Revisar código fuente en `/supabase/migrations/011_master_correction.sql`
- Verificar logs de Supabase Dashboard
- Consultar documentación de Postgres RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

**Versión del documento:** 1.0
**Autor:** Claude Code
**Fecha de creación:** 10 de Diciembre, 2024
