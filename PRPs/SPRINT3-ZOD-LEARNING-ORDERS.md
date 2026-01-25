# Sprint 3: Zod Validation + Learning Patterns + Order Confirmation

## Skills a Invocar
```
/agent-builder-pydantic-ai
/supabase-auth-memory
/typescript-advanced-types
```

## Comandos
```
/primer
/generar-prp
/ejecutar-prp
```

---

## Objetivo
1. Agregar Zod validation a API routes
2. Integrar learning patterns en supervisor
3. Implementar confirmación de órdenes

---

## Tarea 1: Zod Validation en API Routes

### Buscar rutas sin validación
```bash
grep -r "req.body\|request.json" app/api/ --include="*.ts" -l
```

### Implementar
- Schema Zod por cada endpoint
- Middleware de validación
- Error responses tipadas
- Integrar con tipos existentes en `src/features/`

---

## Tarea 2: Learning Patterns en Supervisor

### Archivos clave
- `src/features/ai/agents/supervisor/`
- `src/features/ai/learning/`
- `src/features/ai/services/langgraph-ai.service.ts`

### Implementar
- Conectar `ai_learning` table con supervisor
- Cargar patterns en BusinessContext
- Aplicar patterns en decisiones de routing
- Guardar nuevos patterns detectados

---

## Tarea 3: Confirmación de Órdenes

### Migración SQL necesaria
- Tabla `order_confirmations` si no existe
- Estados: pending, confirmed, cancelled
- Relación con `orders` y `clients`

### Implementar
- Service en `src/features/orders/`
- API endpoint para confirmar
- Integración con agente de booking
- Notificaciones al confirmar

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
- [ ] Zod schemas en todas las API routes
- [ ] Supervisor usando learning patterns
- [ ] Order confirmation funcional
- [ ] Tests pasando
- [ ] Build exitoso
