# FASE 1: Integración Structured Logger

## Información de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 1 - Structured Logger |
| **Duración Estimada** | 1-2 horas |
| **Riesgo** | 🟢 BAJO |
| **Prerrequisitos** | Fase 0 completada |
| **Resultado** | Logs JSON estructurados en endpoints críticos |

---

## Objetivo

Integrar el sistema de logging estructurado (`structured-logger.ts`) de manera que:
1. Los logs salgan en formato JSON (útil para producción)
2. Los campos sensibles se redacten automáticamente
3. NO se rompa ninguna funcionalidad existente
4. Se mantengan los `console.log` existentes durante la transición

---

## ¿Por Qué es Bajo Riesgo?

| Razón | Explicación |
|-------|-------------|
| Solo agrega | No modifica lógica de negocio, solo agrega logs |
| No bloquea | Si el logger falla, la función sigue ejecutándose |
| Fácil revertir | Solo eliminar los imports y llamadas al logger |
| Sin dependencias externas | No requiere Redis ni otros servicios |

---

## Microfases

### 1.1 Crear Instancia Global del Logger

**Objetivo**: Tener un logger singleton disponible en toda la app

#### Archivo: `src/shared/lib/logger-instance.ts` (NUEVO)

```typescript
/**
 * TIS TIS Platform - Logger Instance
 * Instancia singleton del logger estructurado
 */

import { getLogger, createLogger, type LoggerConfig } from './structured-logger';

// Configuración basada en ambiente
const config: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  prettyPrint: process.env.NODE_ENV !== 'production',
  includeStackTraces: process.env.NODE_ENV !== 'production',
};

// Contexto por defecto para todos los logs
const defaultContext = {
  app: 'tistis-platform',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
};

// Crear y exportar el logger
export const logger = createLogger(config, defaultContext);

// También exportar getLogger para compatibilidad
export { getLogger };

// Helper para crear child loggers por componente
export function createComponentLogger(component: string) {
  return logger.child({ component });
}
```

#### Checklist 1.1:
- [ ] Archivo `logger-instance.ts` creado
- [ ] Logger configurable por ambiente
- [ ] Contexto por defecto incluido

---

### 1.2 Agregar Export al Index

**Objetivo**: Hacer el logger accesible desde `@/src/shared/lib`

#### Archivo: `src/shared/lib/index.ts` (MODIFICAR)

Agregar al final del archivo:

```typescript
// Logger Instance (singleton)
export { logger, createComponentLogger } from './logger-instance';
```

#### Checklist 1.2:
- [ ] Export agregado a index.ts
- [ ] Import funciona: `import { logger } from '@/src/shared/lib'`

---

### 1.3 Pilot: Endpoint No Crítico

**Objetivo**: Probar el logger en un endpoint que no afecte pagos ni mensajes

#### Archivo: `app/api/onboarding/status/route.ts` (MODIFICAR)

**Estrategia**: Agregar logger JUNTO a los console.log existentes, no reemplazar.

```typescript
// Al inicio del archivo, agregar import:
import { createComponentLogger } from '@/src/shared/lib';

// Después de los imports existentes:
const logger = createComponentLogger('onboarding-status');

// En la función GET, AGREGAR (no reemplazar) logs:
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Log estructurado al inicio
  logger.info('Onboarding status request received', {
    method: 'GET',
    path: '/api/onboarding/status',
  });

  try {
    // ... código existente sin cambios ...

    // Al final, antes de retornar éxito:
    logger.info('Onboarding status retrieved', {
      durationMs: Date.now() - startTime,
      // NO incluir datos sensibles como email
    });

    return NextResponse.json(/* respuesta existente */);
  } catch (error) {
    // Log estructurado de error
    logger.error('Onboarding status failed', {
      durationMs: Date.now() - startTime,
    }, error instanceof Error ? error : new Error(String(error)));

    // ... manejo de error existente sin cambios ...
  }
}
```

#### Verificación:

```bash
# 1. Iniciar el servidor de desarrollo
npm run dev

# 2. En otra terminal, hacer request al endpoint
curl http://localhost:3000/api/onboarding/status

# 3. Verificar en la consola del servidor que aparecen logs JSON como:
# {"level":"info","message":"Onboarding status request received",...}
```

#### Checklist 1.3:
- [ ] Logger importado en onboarding/status
- [ ] Logs de inicio y fin agregados
- [ ] Logs visibles en consola al hacer request
- [ ] Endpoint sigue funcionando normalmente

---

### 1.4 Pilot: Endpoint Crítico (Stripe Webhook)

**Objetivo**: Agregar logging a un endpoint crítico para validar en escenario real

#### Archivo: `app/api/stripe/webhook/route.ts` (MODIFICAR)

**IMPORTANTE**: Este es un endpoint crítico. Solo AGREGAR logs, NO modificar lógica.

```typescript
// Al inicio del archivo, agregar import:
import { createComponentLogger } from '@/src/shared/lib';

// Después de los imports existentes:
const logger = createComponentLogger('stripe-webhook');

// En la función POST, AGREGAR logs en puntos clave:
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Log de inicio (sin datos sensibles)
  logger.info('Stripe webhook received');

  // ... código de verificación de firma existente ...

  // Después de verificar la firma exitosamente:
  logger.info('Stripe webhook verified', {
    eventType: event.type,
    eventId: event.id,
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        logger.info('Processing checkout.session.completed', {
          sessionId: session.id,
          // NO loggear customerEmail ni otros datos PII
        });
        await handleCheckoutCompleted(session);
        break;
      }
      // ... otros casos ...
    }

    // Log de éxito
    logger.info('Stripe webhook processed successfully', {
      eventType: event.type,
      eventId: event.id,
      durationMs: Date.now() - startTime,
    });

    // ... código existente de markEventProcessed ...
    return NextResponse.json({ received: true });
  } catch (error) {
    // Log de error
    logger.error('Stripe webhook processing failed', {
      eventType: event.type,
      eventId: event.id,
      durationMs: Date.now() - startTime,
    }, error instanceof Error ? error : new Error(String(error)));

    // ... código existente de manejo de error ...
  }
}
```

#### Checklist 1.4:
- [ ] Logger importado en stripe/webhook
- [ ] Logs agregados sin modificar lógica
- [ ] NO se loggean datos sensibles (email, tokens, etc.)
- [ ] Webhook sigue funcionando (probar con Stripe CLI)

---

### 1.5 Expandir a Más Endpoints

**Objetivo**: Agregar logging a todos los endpoints importantes

#### Lista de Endpoints a Migrar (en orden de prioridad):

| Prioridad | Endpoint | Archivo |
|-----------|----------|---------|
| 1 | Stripe Checkout | `app/api/stripe/create-checkout/route.ts` |
| 2 | Stripe Cancel | `app/api/stripe/cancel-subscription/route.ts` |
| 3 | WhatsApp Webhook | `app/api/webhook/whatsapp/[tenantSlug]/route.ts` |
| 4 | AI Config | `app/api/ai-config/generate-prompt/route.ts` |
| 5 | Voice Agent | `app/api/voice-agent/webhook/route.ts` |
| 6 | Leads API | `app/api/v1/leads/route.ts` |

#### Patrón a Seguir en Cada Endpoint:

```typescript
// 1. Importar al inicio
import { createComponentLogger } from '@/src/shared/lib';

// 2. Crear logger con nombre del componente
const logger = createComponentLogger('nombre-del-endpoint');

// 3. Log al inicio de cada función
logger.info('Request received', { method, path });

// 4. Log en puntos importantes (sin datos sensibles)
logger.info('Action completed', { actionName, durationMs });

// 5. Log en errores
logger.error('Action failed', { context }, error);
```

#### Checklist 1.5:
- [ ] Stripe create-checkout migrado
- [ ] Stripe cancel migrado
- [ ] WhatsApp webhook migrado
- [ ] AI config migrado
- [ ] Voice agent migrado
- [ ] Leads API migrado

---

### 1.6 Verificación Final

**Objetivo**: Confirmar que todo funciona correctamente

#### Tests Automatizados:

```bash
# Ejecutar tests existentes
npm test

# Todos deben pasar - el logger no debe romper tests
```

#### Tests Manuales:

```bash
# 1. Probar Stripe (si tienes Stripe CLI)
stripe trigger checkout.session.completed

# 2. Probar endpoint de onboarding
curl http://localhost:3000/api/onboarding/status

# 3. Verificar formato de logs en consola
# Deben aparecer como JSON en producción
# Deben aparecer formateados en desarrollo
```

#### Verificar Redacción de Campos Sensibles:

```typescript
// Probar que campos sensibles se redactan
logger.info('Test sensitive', {
  password: 'secret123',      // Debe aparecer como [REDACTED]
  apiKey: 'sk-123456',        // Debe aparecer como [REDACTED]
  normalField: 'visible',     // Debe aparecer normal
});
```

#### Checklist 1.6:
- [ ] Todos los tests pasan
- [ ] Logs visibles en formato correcto
- [ ] Campos sensibles redactados
- [ ] Endpoints funcionan normalmente

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/shared/lib/logger-instance.ts` | NUEVO - Singleton del logger |
| `src/shared/lib/index.ts` | MODIFICADO - Agregar export |
| `app/api/onboarding/status/route.ts` | MODIFICADO - Agregar logs |
| `app/api/stripe/webhook/route.ts` | MODIFICADO - Agregar logs |
| + 5-6 endpoints más | MODIFICADO - Agregar logs |

---

## Rollback

Si algo sale mal:

```bash
# Opción 1: Revertir archivo por archivo
git checkout HEAD -- app/api/stripe/webhook/route.ts

# Opción 2: Revertir todos los cambios de esta fase
git checkout backup/pre-migration-2026-01-21 -- app/api/
git checkout backup/pre-migration-2026-01-21 -- src/shared/lib/

# Opción 3: Rollback completo
git checkout backup/pre-migration-2026-01-21
```

---

## Siguiente Paso

✅ **Fase 1 Completada**

Proceder a: [FASE_2_ENV_VALIDATOR.md](./FASE_2_ENV_VALIDATOR.md)

---

## Troubleshooting

### "Error: Cannot find module 'structured-logger'"

```bash
# Verificar que el archivo existe
ls src/shared/lib/structured-logger.ts

# Verificar exports en index.ts
grep "structured-logger" src/shared/lib/index.ts
```

### "Los logs no aparecen en formato JSON"

Verificar la configuración de ambiente:
```typescript
// En logger-instance.ts, verificar:
prettyPrint: process.env.NODE_ENV !== 'production',
// En desarrollo, los logs son "pretty" (no JSON puro)
// En producción, son JSON puro
```

### "Los campos sensibles no se redactan"

Verificar que el nombre del campo está en la lista:
```typescript
// En structured-logger.ts, verificar DEFAULT_REDACT_PATTERNS:
const DEFAULT_REDACT_PATTERNS = [
  'password',
  'secret',
  'token',
  // ... agregar si falta alguno
];
```
