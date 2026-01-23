# 🚀 Instrucciones de Migración - Soft Restaurant Integration

**Migración:** `152_SOFT_RESTAURANT_INTEGRATION.sql`
**Fecha:** 2026-01-22
**Estado:** ✅ Lista para ejecutar

---

## 📋 Resumen de la Migración

Esta migración crea la infraestructura completa para la integración con Soft Restaurant:

### Tablas Creadas (8):
1. **sr_sales** - Ventas recibidas de Soft Restaurant
2. **sr_sale_items** - Productos/conceptos de cada venta
3. **sr_payments** - Formas de pago de cada venta
4. **sr_sync_logs** - Logs de sincronización y errores
5. **recipes** - Recetas de productos (gestión interna TIS TIS)
6. **recipe_ingredients** - Ingredientes de cada receta
7. **inventory_movements** - Movimientos de inventario (Kardex)
8. **low_stock_alerts** - Alertas de stock bajo

### Componentes Adicionales:
- ✅ **35+ Índices** para rendimiento óptimo
- ✅ **Row Level Security (RLS)** en todas las tablas
- ✅ **3 Triggers** para auto-actualización de timestamps
- ✅ **2 Funciones Helper** para gestión de inventario
- ✅ **Políticas de seguridad** por tenant

---

## 🎯 OPCIÓN 1: Supabase SQL Editor (RECOMENDADO)

### Paso 1: Acceder al SQL Editor

1. Abre tu navegador y ve a: [Supabase Dashboard](https://supabase.com/dashboard)

2. Selecciona el proyecto: **TIS TIS Platform**
   - URL del proyecto: `https://ndgoqjnmzirgkergggfi.supabase.co`

3. En el menú lateral, haz clic en **SQL Editor**

### Paso 2: Crear Nueva Query

1. Haz clic en el botón **"New Query"**

2. Dale un nombre a la query (opcional): `"SR Integration Migration"`

### Paso 3: Ejecutar Migración

El contenido de la migración ya está en tu portapapeles. Si no:

```bash
# Ejecuta este comando para copiar al portapapeles
cat supabase/migrations/152_SOFT_RESTAURANT_INTEGRATION.sql | pbcopy
```

1. **Pega** el contenido completo en el editor (Cmd+V o Ctrl+V)

2. Verifica que el SQL comience con:
   ```sql
   -- =====================================================
   -- TIS TIS PLATFORM - SOFT RESTAURANT INTEGRATION
   ```

3. Haz clic en el botón **"Run"** (o presiona Cmd/Ctrl + Enter)

4. **Espera** mientras se ejecuta (puede tomar 10-30 segundos)

### Paso 4: Verificar Éxito

Deberías ver un mensaje de éxito que indica:

```
Migration 152_SOFT_RESTAURANT_INTEGRATION.sql completed successfully
Created 8 tables: sr_sales, sr_sale_items, sr_payments, ...
```

---

## 🔍 OPCIÓN 2: PostgreSQL psql (Avanzado)

Si tienes `psql` instalado:

### Paso 1: Obtener Connection String

1. Ve a Supabase Dashboard → **Settings** → **Database**
2. Copia el **Connection String (Direct)**
3. Reemplaza `[YOUR-PASSWORD]` con tu contraseña real

### Paso 2: Ejecutar Migración

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.ndgoqjnmzirgkergggfi.supabase.co:5432/postgres" \
  -f supabase/migrations/152_SOFT_RESTAURANT_INTEGRATION.sql
```

---

## ✅ VERIFICACIÓN POST-MIGRACIÓN

### Verificación Visual (Supabase Dashboard)

1. Ve a **Table Editor** en Supabase Dashboard

2. Verifica que veas las siguientes tablas nuevas:
   - ✓ sr_sales
   - ✓ sr_sale_items
   - ✓ sr_payments
   - ✓ sr_sync_logs
   - ✓ recipes
   - ✓ recipe_ingredients
   - ✓ inventory_movements
   - ✓ low_stock_alerts

3. Cada tabla debe mostrar un ícono 🔒 (RLS habilitado)

### Verificación con SQL Query

Ejecuta esta query en el SQL Editor:

```sql
SELECT
    table_name,
    (SELECT COUNT(*)
     FROM information_schema.columns
     WHERE table_name = t.table_name
     AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND (
    table_name LIKE 'sr_%'
    OR table_name IN ('recipes', 'recipe_ingredients', 'inventory_movements', 'low_stock_alerts')
  )
ORDER BY table_name;
```

**Resultado esperado:** 8 filas

### Verificación de Índices

```sql
SELECT
    tablename,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'sr_%'
    OR tablename IN ('recipes', 'recipe_ingredients', 'inventory_movements', 'low_stock_alerts')
  )
GROUP BY tablename
ORDER BY tablename;
```

**Resultado esperado:** Cada tabla debe tener 3-7 índices

### Verificación de RLS Policies

```sql
SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'sr_%'
    OR tablename IN ('recipes', 'recipe_ingredients', 'inventory_movements', 'low_stock_alerts')
  )
GROUP BY tablename
ORDER BY tablename;
```

**Resultado esperado:** Cada tabla debe tener al menos 1 política

### Verificación de Funciones

```sql
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_ingredient_current_stock', 'update_inventory_stock');
```

**Resultado esperado:** 2 funciones

---

## 🔧 Script de Verificación Automatizado

Después de aplicar la migración, ejecuta:

```bash
npx tsx scripts/migration/verify-sr-migration.ts
```

Este script verificará automáticamente:
- ✅ Todas las tablas fueron creadas
- ✅ Índices están en su lugar
- ✅ RLS está habilitado
- ✅ Funciones existen y son ejecutables
- ✅ Triggers están configurados

---

## ⚠️ TROUBLESHOOTING

### Error: "relation already exists"

**Causa:** Las tablas ya existen de una ejecución previa.

**Solución:**
- Si quieres recrear: Ejecuta primero el rollback (ver abajo)
- Si solo quieres continuar: Ignora el error, la migración es idempotente

### Error: "permission denied"

**Causa:** Estás usando una API key incorrecta.

**Solución:**
- Verifica que estás usando el **Service Role Key** en el SQL Editor
- O ejecuta desde el dashboard con tu cuenta de administrador

### Error: "foreign key violation"

**Causa:** Faltan tablas de referencia (tenants, branches, etc.)

**Solución:**
- Verifica que las migraciones anteriores se ejecutaron correctamente
- Ejecuta: `SELECT * FROM tenants LIMIT 1;` para verificar

---

## 🚨 ROLLBACK (Si necesitas revertir)

Si algo sale mal y necesitas revertir la migración:

### Paso 1: Ejecutar en SQL Editor

```sql
-- ADVERTENCIA: Esto ELIMINARÁ todas las tablas y datos de SR
-- Solo ejecutar si estás seguro

DROP TABLE IF EXISTS public.low_stock_alerts CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.recipe_ingredients CASCADE;
DROP TABLE IF EXISTS public.recipes CASCADE;
DROP TABLE IF EXISTS public.sr_sync_logs CASCADE;
DROP TABLE IF EXISTS public.sr_payments CASCADE;
DROP TABLE IF EXISTS public.sr_sale_items CASCADE;
DROP TABLE IF EXISTS public.sr_sales CASCADE;

DROP FUNCTION IF EXISTS public.get_ingredient_current_stock(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.update_inventory_stock(UUID, UUID, UUID, DECIMAL, VARCHAR, VARCHAR, UUID, TEXT);
```

### Paso 2: Volver a ejecutar la migración

Sigue los pasos de OPCIÓN 1 nuevamente.

---

## 📊 Datos de Prueba (Opcional)

Después de aplicar la migración, puedes insertar datos de prueba:

```bash
npx tsx scripts/migration/seed-sr-test-data.ts
```

Esto creará:
- 2 recetas de ejemplo
- 5 ingredientes de prueba
- 10 movimientos de inventario simulados
- 3 alertas de stock bajo de ejemplo

---

## ✅ CHECKLIST DE COMPLETITUD

Marca cada item después de completarlo:

- [ ] Migración ejecutada sin errores
- [ ] 8 tablas verificadas en Table Editor
- [ ] RLS habilitado en todas las tablas
- [ ] Índices verificados (35+)
- [ ] Funciones helper creadas (2)
- [ ] Script de verificación ejecutado con éxito
- [ ] (Opcional) Datos de prueba insertados

---

## 📞 Soporte

Si encuentras algún problema:

1. **Revisa los logs** en Supabase Dashboard → Logs
2. **Ejecuta el script de verificación** para diagnóstico
3. **Consulta el documento** `SOFT_RESTAURANT_CRITICAL_ANALYSIS.md`
4. **Contacta al equipo** de desarrollo

---

**Última actualización:** 2026-01-22
**Versión de migración:** 1.0.0
**Estado:** ✅ Lista para producción
