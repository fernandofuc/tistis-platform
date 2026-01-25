# Sprint 4: Refactor Services + Audit Trail + Logger + Badges

## Skills a Invocar
```
/typescript-advanced-types
/frontend-design
/supabase-auth-memory
```

## Comandos
```
/primer
/explorador
/generar-prp
/ejecutar-prp
```

---

## Objetivo
1. Dividir servicios gigantes (prompt-generator, message-learning)
2. Implementar audit trail completo
3. Migrar console.logs a logger estructurado
4. Unificar badge components

---

## Tarea 1: Dividir Servicios Gigantes

### Archivos a refactorizar
```bash
wc -l src/features/ai/services/*.ts | sort -rn | head -10
```

### prompt-generator
- Separar en: `prompt-builder.ts`, `context-injector.ts`, `template-manager.ts`
- Mantener barrel export en `index.ts`

### message-learning
- Separar en: `pattern-detector.ts`, `learning-store.ts`, `feedback-processor.ts`
- Single responsibility por archivo

---

## Tarea 2: Audit Trail Completo

### Migración SQL
- Tabla `audit_logs` con: action, entity, entity_id, user_id, tenant_id, changes, timestamp
- RLS policies
- Index por tenant_id y timestamp

### Implementar
- Service `src/shared/lib/audit.ts`
- Middleware para capturar cambios
- Integrar en operaciones CRUD críticas

---

## Tarea 3: Logger Estructurado

### Buscar console.logs
```bash
grep -r "console.log\|console.error\|console.warn" src/ app/ lib/ --include="*.ts" --include="*.tsx" -l
```

### Implementar
- Logger service en `src/shared/lib/logger.ts`
- Niveles: debug, info, warn, error
- Contexto: tenant_id, user_id, request_id
- Reemplazar todos los console.* existentes

---

## Tarea 4: Unificar Badge Components

### Buscar badges existentes
```bash
grep -r "Badge\|badge" components/ src/ --include="*.tsx" -l
```

### Implementar
- Componente unificado `src/shared/components/Badge.tsx`
- Variantes: status, priority, category, custom
- Props tipadas con Zod
- Reemplazar implementaciones duplicadas

---

## Validación
```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

---

## Bucle Agéntico
Referencia: `.claude/prompts/bucle-agentico.md`

Repetir hasta 0 errores en todas las validaciones.

---

## Criterios de Salida
- [ ] Servicios divididos y funcionales
- [ ] Audit trail registrando operaciones
- [ ] Logger reemplazando console.*
- [ ] Badge component unificado
- [ ] Tests pasando
- [ ] Build exitoso
