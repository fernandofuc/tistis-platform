# ⚡ FASE 1 - Referencia Rápida

Comandos y pasos esenciales para aplicar y verificar FASE 1.

---

## 🚀 APLICAR MIGRACIÓN (3 pasos)

### Opción A: Supabase Dashboard (Recomendado)

```bash
# 1. Copiar SQL al portapapeles
cat supabase/migrations/152_SOFT_RESTAURANT_INTEGRATION.sql | pbcopy

# 2. Abrir Supabase Dashboard
# https://supabase.com/dashboard → Tu Proyecto → SQL Editor

# 3. Pegar y ejecutar (Cmd+V, luego Run)
```

### Opción B: Con Script Helper

```bash
# Ver instrucciones completas
npx tsx scripts/migration/apply-sr-migration.ts

# Opción: Copiar al portapapeles automáticamente
# (El script preguntará si quieres copiar)
```

---

## ✅ VERIFICAR MIGRACIÓN

```bash
# Verificación automática (recomendado)
npx tsx scripts/migration/verify-sr-migration.ts

# Verificación detallada (modo verbose)
npx tsx scripts/migration/verify-sr-migration.ts --verbose
```

**Resultado esperado:**
```
✅ MIGRATION VERIFICATION PASSED
Total Checks:    25
✅ Passed:        25
❌ Failed:        0
⚠️  Warnings:      0
```

---

## 🌱 DATOS DE PRUEBA (Opcional)

```bash
# Insertar datos de prueba
npx tsx scripts/migration/seed-sr-test-data.ts

# Limpiar y volver a insertar
npx tsx scripts/migration/seed-sr-test-data.ts --clean
```

**Crea:**
- 3 recetas con ingredientes
- 15 movimientos de inventario
- 5 ventas de Soft Restaurant
- 3 alertas de stock bajo

---

## 🔍 VERIFICACIÓN MANUAL (SQL)

### Verificar tablas creadas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'sr_%'
    OR table_name IN ('recipes', 'recipe_ingredients', 'inventory_movements', 'low_stock_alerts'))
ORDER BY table_name;
```

**Esperado:** 8 filas

### Verificar RLS habilitado

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'sr_%'
    OR tablename IN ('recipes', 'recipe_ingredients', 'inventory_movements', 'low_stock_alerts'))
ORDER BY tablename;
```

**Esperado:** rowsecurity = true en todas

### Verificar índices

```sql
SELECT tablename, COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'sr_%'
    OR tablename IN ('recipes', 'recipe_ingredients', 'inventory_movements', 'low_stock_alerts'))
GROUP BY tablename
ORDER BY tablename;
```

**Esperado:** 3-7 índices por tabla

### Verificar funciones

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_ingredient_current_stock', 'update_inventory_stock');
```

**Esperado:** 2 funciones

---

## 🚨 ROLLBACK (Si es necesario)

```sql
-- ⚠️ ADVERTENCIA: Esto eliminará TODAS las tablas y datos

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

---

## 📁 ARCHIVOS CLAVE

| Tipo | Archivo | Propósito |
|------|---------|-----------|
| 🗄️ SQL | `supabase/migrations/152_SOFT_RESTAURANT_INTEGRATION.sql` | Migración principal |
| 🚀 Script | `scripts/migration/apply-sr-migration.ts` | Instrucciones de aplicación |
| ✅ Script | `scripts/migration/verify-sr-migration.ts` | Verificación automática |
| 🌱 Script | `scripts/migration/seed-sr-test-data.ts` | Datos de prueba |
| 📖 Doc | `docs/integrations/SR_MIGRATION_INSTRUCTIONS.md` | Guía completa |
| 📊 Doc | `docs/integrations/FASE1_VALIDATION_REPORT.md` | Reporte de validación |
| 📋 Doc | `docs/integrations/FASE1_EXECUTIVE_SUMMARY.md` | Resumen ejecutivo |

---

## ⚡ COMANDOS ÚTILES

### Contar registros en todas las tablas

```sql
SELECT
  'sr_sales' as table_name, COUNT(*) as count FROM sr_sales
UNION ALL
SELECT 'sr_sale_items', COUNT(*) FROM sr_sale_items
UNION ALL
SELECT 'sr_payments', COUNT(*) FROM sr_payments
UNION ALL
SELECT 'sr_sync_logs', COUNT(*) FROM sr_sync_logs
UNION ALL
SELECT 'recipes', COUNT(*) FROM recipes
UNION ALL
SELECT 'recipe_ingredients', COUNT(*) FROM recipe_ingredients
UNION ALL
SELECT 'inventory_movements', COUNT(*) FROM inventory_movements
UNION ALL
SELECT 'low_stock_alerts', COUNT(*) FROM low_stock_alerts;
```

### Ver últimas ventas

```sql
SELECT
  external_id,
  sale_date,
  total,
  status
FROM sr_sales
ORDER BY sale_date DESC
LIMIT 10;
```

### Ver alertas activas

```sql
SELECT
  alert_type,
  severity,
  current_stock,
  reorder_point,
  status
FROM low_stock_alerts
WHERE status = 'active'
ORDER BY severity DESC, created_at DESC;
```

### Ver movimientos de inventario recientes

```sql
SELECT
  movement_type,
  quantity,
  unit,
  reference_type,
  created_at
FROM inventory_movements
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🎯 CHECKLIST RÁPIDO

- [ ] Migración aplicada
- [ ] 8 tablas verificadas
- [ ] RLS habilitado
- [ ] Script de verificación: 25/25 checks ✅
- [ ] Datos de prueba insertados (opcional)
- [ ] Listo para FASE 2

---

## 🆘 TROUBLESHOOTING

### Error: "relation already exists"

**Solución:** Las tablas ya existen. Ejecuta rollback si quieres recrear.

### Error: "permission denied"

**Solución:** Usa Service Role Key en Supabase SQL Editor.

### Error: "foreign key violation"

**Solución:** Verifica que existen: `tenants`, `branches`, `integration_connections`.

---

## 📞 AYUDA

- 📖 Guía completa: `docs/integrations/SR_MIGRATION_INSTRUCTIONS.md`
- 📊 Validación: `docs/integrations/FASE1_VALIDATION_REPORT.md`
- 📋 Resumen: `docs/integrations/FASE1_EXECUTIVE_SUMMARY.md`
- 📝 Master Plan: `docs/integrations/SOFT_RESTAURANT_IMPLEMENTATION_MASTER_PLAN.md`

---

**Versión:** 1.0.0
**Fecha:** 2026-01-22
**Estado:** ✅ LISTO PARA USAR
