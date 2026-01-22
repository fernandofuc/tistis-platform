# FASE 2: Integración Env Validator

## Información de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 2 - Env Validator |
| **Duración Estimada** | 1 hora |
| **Riesgo** | 🟢 BAJO |
| **Prerrequisitos** | Fase 1 completada |
| **Resultado** | Validación de env vars al iniciar (solo warnings) |

---

## Objetivo

Integrar el validador de variables de entorno (`env-validator.ts`) de manera que:
1. Al iniciar la app, se listen las variables faltantes o inválidas
2. En desarrollo: Solo muestre warnings, NO bloquee la app
3. En producción: Muestre warnings (podemos hacerlo más estricto después)
4. Proporcione visibilidad de configuración faltante

---

## ¿Por Qué es Bajo Riesgo?

| Razón | Explicación |
|-------|-------------|
| Solo warnings | No bloquea el inicio de la app |
| No afecta runtime | Solo se ejecuta al iniciar |
| Fácil desactivar | Comentar una línea en instrumentation.ts |
| No modifica endpoints | Solo agrega validación al startup |

---

## Microfases

### 2.1 Crear instrumentation.ts

**Objetivo**: Usar el archivo de instrumentación de Next.js para ejecutar código al inicio

#### Archivo: `instrumentation.ts` (NUEVO - en la raíz del proyecto)

```typescript
/**
 * TIS TIS Platform - Instrumentation
 *
 * Este archivo se ejecuta al iniciar la aplicación Next.js.
 * Lo usamos para validar configuración y preparar servicios.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Solo ejecutar en Node.js (no en Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await onServerStart();
  }
}

async function onServerStart() {
  console.log('🚀 [TIS TIS] Starting server...');
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);

  // Validar variables de entorno
  await validateEnvironmentVariables();

  console.log('✅ [TIS TIS] Server initialization complete');
}

async function validateEnvironmentVariables() {
  try {
    // Import dinámico para evitar problemas de bundling
    const { validateEnvironment, getEnvSummary } = await import(
      '@/src/shared/lib/env-validator'
    );

    console.log('\n📋 [EnvValidator] Checking environment variables...');

    const result = validateEnvironment();

    // Mostrar warnings (variables opcionales faltantes)
    if (result.warnings.length > 0) {
      console.warn('\n⚠️  [EnvValidator] Warnings:');
      result.warnings.forEach((w) => console.warn(`   - ${w}`));
    }

    // Mostrar errores (variables requeridas faltantes)
    if (result.errors.length > 0) {
      console.error('\n❌ [EnvValidator] Errors:');
      result.errors.forEach((e) => console.error(`   - ${e}`));

      // IMPORTANTE: En esta fase, NO bloqueamos la app
      // Solo mostramos los errores como información
      console.error('\n⚠️  [EnvValidator] App will continue despite errors (Phase 2 - Warnings Only)');

      // En el futuro, cuando estés listo para ser estricto:
      // if (process.env.NODE_ENV === 'production') {
      //   throw new Error('Environment validation failed');
      // }
    }

    // Mostrar resumen si está en modo debug
    if (process.env.DEBUG_ENV === 'true') {
      console.log('\n📊 [EnvValidator] Summary:');
      const summary = getEnvSummary();
      Object.entries(summary).forEach(([key, status]) => {
        console.log(`   ${status} ${key}`);
      });
    }

    // Mostrar resultado final
    if (result.valid) {
      console.log('\n✅ [EnvValidator] All required variables configured');
    } else {
      console.log(`\n⚠️  [EnvValidator] ${result.errors.length} issue(s) found`);
    }

  } catch (error) {
    // Si el validador mismo falla, loggear pero no bloquear
    console.error('[EnvValidator] Validator failed to run:', error);
  }
}
```

#### Checklist 2.1:
- [ ] Archivo `instrumentation.ts` creado en la raíz
- [ ] Función `register()` exportada
- [ ] Validación solo ejecuta en Node.js runtime

---

### 2.2 Habilitar Instrumentation en Next.js

**Objetivo**: Asegurar que Next.js ejecute el archivo de instrumentación

#### Archivo: `next.config.ts` (VERIFICAR/MODIFICAR)

Verificar que la opción de instrumentación esté habilitada:

```typescript
// next.config.ts
const nextConfig = {
  // ... otras configuraciones ...

  // Habilitar instrumentation hook
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

**NOTA**: En Next.js 15+, `instrumentationHook` puede estar habilitado por defecto. Verificar la documentación de tu versión.

#### Checklist 2.2:
- [ ] next.config.ts tiene instrumentationHook habilitado (si es necesario)

---

### 2.3 Verificar que Funciona

**Objetivo**: Confirmar que el validador se ejecuta al iniciar

#### Acciones:

```bash
# 1. Detener el servidor si está corriendo (Ctrl+C)

# 2. Iniciar el servidor de desarrollo
npm run dev

# 3. Observar la salida en la consola
# Deberías ver algo como:

# 🚀 [TIS TIS] Starting server...
# 📍 Environment: development
#
# 📋 [EnvValidator] Checking environment variables...
#
# ⚠️  [EnvValidator] Warnings:
#    - Missing REDIS_URL (required in production)
#    - Missing VAPI_API_KEY
#
# ✅ [EnvValidator] All required variables configured
# ✅ [TIS TIS] Server initialization complete
```

#### Checklist 2.3:
- [ ] Servidor inicia sin errores
- [ ] Mensajes de validación visibles en consola
- [ ] Warnings muestran variables faltantes
- [ ] App sigue funcionando normalmente

---

### 2.4 Probar con Variables Faltantes

**Objetivo**: Verificar que detecta variables faltantes correctamente

#### Test 1: Quitar una variable temporal

```bash
# 1. Hacer backup de .env.local
cp .env.local .env.local.backup

# 2. Comentar una variable (agregar # al inicio)
# Por ejemplo, en .env.local:
# STRIPE_SECRET_KEY=sk_test_xxx
# cambia a:
# # STRIPE_SECRET_KEY=sk_test_xxx

# 3. Reiniciar el servidor
npm run dev

# 4. Verificar que muestra el error:
# ❌ [EnvValidator] Errors:
#    - Missing required env var: STRIPE_SECRET_KEY - Stripe secret key

# 5. Verificar que la app SIGUE INICIANDO (no bloqueamos)

# 6. Restaurar la variable
cp .env.local.backup .env.local
```

#### Checklist 2.4:
- [ ] Detecta variable faltante
- [ ] Muestra mensaje de error claro
- [ ] App sigue iniciando (no bloqueada)
- [ ] Variable restaurada

---

### 2.5 Probar Formato Inválido

**Objetivo**: Verificar que detecta formatos incorrectos

#### Test: Usar key con formato incorrecto

```bash
# 1. En .env.local, cambiar temporalmente:
STRIPE_SECRET_KEY=invalid_key_without_sk_prefix

# 2. Reiniciar el servidor
npm run dev

# 3. Verificar que muestra:
# ⚠️  [EnvValidator] Warnings:
#    - Invalid format for STRIPE_SECRET_KEY: inva...efix

# 4. Restaurar el valor correcto
```

#### Checklist 2.5:
- [ ] Detecta formato inválido
- [ ] Muestra valor enmascarado (no expone el valor completo)
- [ ] Validador específico de Stripe funciona (sk_ prefix)

---

### 2.6 Modo Debug (Opcional)

**Objetivo**: Habilitar vista detallada de todas las variables

#### Agregar a .env.local:

```bash
# Para ver resumen completo de todas las variables:
DEBUG_ENV=true
```

#### Reiniciar y verificar:

```bash
npm run dev

# Debería mostrar algo como:
# 📊 [EnvValidator] Summary:
#    ✓ Valid NEXT_PUBLIC_SUPABASE_URL
#    ✓ Set (68 chars) NEXT_PUBLIC_SUPABASE_ANON_KEY
#    ✓ Set (68 chars) SUPABASE_SERVICE_ROLE_KEY
#    ✓ Valid STRIPE_SECRET_KEY
#    ❌ Not set REDIS_URL
#    ...
```

#### Checklist 2.6:
- [ ] DEBUG_ENV=true muestra resumen completo
- [ ] Variables sensibles muestran longitud, no valor
- [ ] Fácil identificar qué está configurado y qué no

---

### 2.7 Verificación Final

**Objetivo**: Confirmar que todo funciona sin afectar la app

#### Tests:

```bash
# 1. Ejecutar tests
npm test

# 2. Verificar build
npm run build

# 3. Probar endpoints críticos
curl http://localhost:3000/api/onboarding/status
```

#### Checklist 2.7:
- [ ] Tests pasan
- [ ] Build exitoso
- [ ] Endpoints funcionan
- [ ] No hay errores inesperados en consola

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `instrumentation.ts` | NUEVO - Hook de inicio de Next.js |
| `next.config.ts` | VERIFICAR - instrumentationHook habilitado |
| `.env.local` | OPCIONAL - DEBUG_ENV=true |

---

## Comportamiento por Ambiente

| Ambiente | Comportamiento Actual | Comportamiento Futuro (Opcional) |
|----------|----------------------|----------------------------------|
| Development | Warnings + Errores, no bloquea | Sin cambio |
| Production | Warnings + Errores, no bloquea | Bloquear si faltan vars críticas |

---

## Cómo Hacer Más Estricto (Futuro)

Cuando estés listo para bloquear la app si faltan variables críticas en producción:

```typescript
// En instrumentation.ts, descomentar:
if (process.env.NODE_ENV === 'production' && !result.valid) {
  throw new Error(`Environment validation failed: ${result.errors.join(', ')}`);
}
```

**ADVERTENCIA**: Solo hacer esto cuando estés 100% seguro de que todas las variables están configuradas en producción.

---

## Rollback

Si algo sale mal:

```bash
# Opción 1: Eliminar instrumentation.ts
rm instrumentation.ts

# Opción 2: Comentar la validación
# En instrumentation.ts, comentar la línea:
# await validateEnvironmentVariables();

# Opción 3: Rollback completo
git checkout backup/pre-migration-2026-01-21 -- instrumentation.ts
```

---

## Siguiente Paso

✅ **Fase 2 Completada**

Proceder a: [FASE_3_RATE_LIMIT_UNIFIED.md](./FASE_3_RATE_LIMIT_UNIFIED.md)

---

## Troubleshooting

### "instrumentation.ts no se ejecuta"

1. Verificar que el archivo está en la raíz del proyecto (junto a package.json)
2. Verificar que exporta `register()`:
   ```typescript
   export async function register() { ... }
   ```
3. Verificar next.config.ts tiene `instrumentationHook: true` (si Next.js < 15)

### "Error: Cannot find module '@/src/shared/lib/env-validator'"

Verificar que el import dinámico está correcto:
```typescript
// Usar import dinámico dentro de la función
const { validateEnvironment } = await import('@/src/shared/lib/env-validator');
```

### "La app no inicia después de agregar instrumentation.ts"

1. Verificar que no hay errores de sintaxis en el archivo
2. Verificar que `register()` es async y no lanza excepciones no manejadas
3. Revisar logs completos para ver el error específico

### "Validador muestra errores pero las variables sí están en .env.local"

1. Verificar que reiniciaste el servidor después de cambiar .env.local
2. Verificar que no hay espacios extra en los valores
3. Verificar que el nombre de la variable coincide exactamente (case-sensitive)
