# FIX: Tests + UPSERT Constraint

## Skill
```
/vitest
```

## Objetivo
1. Corregir errores en `delivery.test.ts` y `supabase-mock.ts`
2. Agregar unique constraint a `clients.contact_email` para UPSERT

---

## FASE 1: Diagnóstico

### Ejecutar
```bash
npm run test -- --reporter=verbose 2>&1 | head -100
```

### Leer archivos con errores
- `__tests__/delivery.test.ts`
- Archivo de mocks de Supabase en `__tests__/`

### Buscar schema actual
```bash
grep -r "contact_email" supabase/migrations/ --include="*.sql" | tail -20
grep -r "UNIQUE.*contact_email" supabase/migrations/ --include="*.sql"
```

---

## FASE 2: Corregir Tests

### Arreglar mocks
- Mock completo de Supabase client
- Métodos: `.from()`, `.select()`, `.insert()`, `.upsert()`, `.eq()`, `.single()`
- Mock de `auth.getUser()`
- Sin `any` en TypeScript

### Arreglar delivery.test.ts
- Imports correctos
- Assertions válidas
- No dependencias de BD real

### Validar
```bash
npm run test -- delivery.test.ts
```

---

## FASE 3: Migración SQL

### Crear archivo
`supabase/migrations/157_ADD_CLIENT_EMAIL_UNIQUE_CONSTRAINT.sql`

### Contenido requerido
1. Check si constraint ya existe
2. Manejar duplicados existentes (mantener más reciente)
3. Crear constraint: `UNIQUE (tenant_id, contact_email)`
4. Index de performance
5. Verificación final

---

## FASE 4: Actualizar código UPSERT

### Buscar
```bash
grep -r "upsert" src/ --include="*.ts" -l
```

### Patrón correcto
```typescript
.upsert(data, { onConflict: 'tenant_id,contact_email' })
```

---

## FASE 5: Validación

### Ejecutar en orden
```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

---

## FASE 6: Bucle Agéntico

```
MIENTRAS haya_errores:
  1. Ejecutar validaciones
  2. Analizar error
  3. Corregir
  4. Repetir
FIN cuando: 0 errores en typecheck, lint, test, build
```

---

## Criterios de Salida
- [ ] Tests pasan 100%
- [ ] TypeScript 0 errores
- [ ] Lint 0 warnings
- [ ] Build exitoso
- [ ] Constraint SQL creado
- [ ] UPSERT funcional
