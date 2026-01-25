/**
 * TIS TIS Platform - Instrumentation
 * FASE 9 - Deployment Optimized
 *
 * Este archivo se ejecuta al iniciar la aplicación Next.js.
 * Lo usamos para validar configuración y preparar servicios.
 *
 * Environment Variables:
 * - SKIP_ENV_VALIDATION: Skip validation during CI/CD builds
 * - DEBUG_ENV: Show detailed environment variable summary
 * - NEXT_RUNTIME: Set by Next.js (nodejs, edge)
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Track startup time for metrics
const startupTimestamp = Date.now();

export async function register() {
  // Solo ejecutar en Node.js (no en Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await onServerStart();
  }
}

async function onServerStart() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const skipValidation = process.env.SKIP_ENV_VALIDATION === 'true';

  console.log('');
  console.log('================================================');
  console.log('  TIS TIS Platform - Server Starting');
  console.log('================================================');
  console.log(`  Environment: ${nodeEnv}`);
  console.log(`  Runtime:     ${process.env.NEXT_RUNTIME || 'nodejs'}`);
  console.log(`  Timestamp:   ${new Date().toISOString()}`);
  console.log('================================================');
  console.log('');

  // Skip validation if explicitly requested (useful for CI/CD builds)
  if (skipValidation) {
    console.log('⏭️  [TIS TIS] Skipping environment validation (SKIP_ENV_VALIDATION=true)');
    return;
  }

  // Validar variables de entorno
  await validateEnvironmentVariables();

  // Log startup metrics
  const startupDuration = Date.now() - startupTimestamp;
  console.log('');
  console.log('================================================');
  console.log('  TIS TIS Platform - Server Ready');
  console.log('================================================');
  console.log(`  Startup time:  ${startupDuration}ms`);
  console.log(`  Memory usage:  ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log(`  Health check:  /api/health`);
  console.log('================================================');
  console.log('');
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
