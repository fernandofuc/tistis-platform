// =====================================================
// TIS TIS PLATFORM - Business Insights CRON Endpoint
// Genera insights de negocio cada 3 días para todos los tenants
// =====================================================
// Este endpoint debe ser llamado por un CRON job externo
// (Vercel CRON, AWS EventBridge, etc.) cada 3 días.
//
// SEGURIDAD: Requiere CRON_SECRET para autenticación
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateBusinessInsights } from '@/src/features/ai/services/business-insights.service';
import { timingSafeEqual } from 'crypto';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// Vercel CRON configuration - run every 3 days at 3:00 AM
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for processing all tenants

/**
 * Timing-safe comparison para evitar timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verifica la autenticación del CRON job
 */
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON Insights] CRON_SECRET not configured');
    return false;
  }

  // Verificar header de autorización
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return secureCompare(token, cronSecret);
  }

  // También verificar x-cron-secret (para Vercel CRON)
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader) {
    return secureCompare(cronHeader, cronSecret);
  }

  return false;
}

/**
 * GET handler - Genera insights para todos los tenants elegibles
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // 1. Verificar autenticación
  if (!verifyCronAuth(request)) {
    console.error('[CRON Insights] Unauthorized request');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 2. Crear cliente con service role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[CRON Insights] Supabase credentials not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 3. Obtener tenants elegibles (Essentials+ con learning habilitado)
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, plan')
      .in('plan', ['essentials', 'growth'])
      .eq('status', 'active')
      .is('deleted_at', null);

    if (tenantsError) {
      console.error('[CRON Insights] Error fetching tenants:', tenantsError);
      return NextResponse.json(
        { error: 'Error fetching tenants' },
        { status: 500 }
      );
    }

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible tenants found',
        results: [],
        duration_ms: Date.now() - startTime,
      });
    }

    // 4. Verificar última generación para cada tenant (cada 3 días)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const results = [];
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const tenant of tenants) {
      try {
        // Verificar última generación
        const { data: config } = await supabase
          .from('ai_learning_config')
          .select('last_insight_generation')
          .eq('tenant_id', tenant.id)
          .single();

        const lastGeneration = config?.last_insight_generation
          ? new Date(config.last_insight_generation)
          : null;

        // Saltar si se generó en los últimos 3 días
        if (lastGeneration && lastGeneration > threeDaysAgo) {
          console.log(`[CRON Insights] Skipping ${tenant.name} - generated recently`);
          skippedCount++;
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            status: 'skipped',
            reason: 'Generated within last 3 days',
          });
          continue;
        }

        // Generar insights
        console.log(`[CRON Insights] Generating insights for ${tenant.name}...`);
        const result = await generateBusinessInsights(tenant.id);

        if (result.success) {
          successCount++;
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            status: 'success',
            insights_generated: result.insightsGenerated,
            insights_expired: result.insightsExpired,
          });

          // Enviar notificaciones a los usuarios del tenant
          if (result.insightsGenerated > 0) {
            try {
              // Obtener usuarios admin/owner del tenant
              const { data: users } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('tenant_id', tenant.id)
                .in('role', ['owner', 'admin', 'manager']);

              if (users && users.length > 0) {
                const notifications = users.map(user => ({
                  tenant_id: tenant.id,
                  user_id: user.user_id,
                  type: 'new_insights',
                  title: 'Nuevos insights de Business IA',
                  message: `Tienes ${result.insightsGenerated} nuevos insights para revisar. Descubre oportunidades para mejorar tu negocio.`,
                  priority: 'normal',
                  action_url: '/dashboard/business-ia',
                  action_label: 'Ver insights',
                  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                }));

                await supabase.from('notifications').insert(notifications);
                console.log(`[CRON Insights] Sent notifications to ${users.length} users for ${tenant.name}`);
              }
            } catch (notifError) {
              console.error(`[CRON Insights] Error sending notifications for ${tenant.name}:`, notifError);
              // No fallar el proceso por errores de notificación
            }
          }
        } else {
          // Si no hay suficientes datos, es un skip, no un error
          if (result.error?.includes('conversaciones más')) {
            skippedCount++;
            results.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              status: 'skipped',
              reason: result.error,
            });
          } else {
            errorCount++;
            results.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              status: 'error',
              error: result.error,
            });
          }
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[CRON Insights] Error processing tenant ${tenant.name}:`, errorMessage);
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON Insights] Completed in ${duration}ms - Success: ${successCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

    return NextResponse.json({
      success: true,
      summary: {
        total_tenants: tenants.length,
        successful: successCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      results,
      duration_ms: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRON Insights] Fatal error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// UUID validation regex for tenant_id
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST handler - Genera insights para un tenant específico (manual trigger)
 */
export async function POST(request: NextRequest) {
  // 1. Verificar autenticación
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // Validate tenant_id is a valid UUID (security: prevent injection)
    if (typeof tenant_id !== 'string' || !UUID_REGEX.test(tenant_id)) {
      return NextResponse.json(
        { error: 'tenant_id must be a valid UUID' },
        { status: 400 }
      );
    }

    console.log(`[CRON Insights] Manual trigger for tenant ${tenant_id}`);

    const result = await generateBusinessInsights(tenant_id);

    return NextResponse.json({
      success: result.success,
      tenant_id,
      insights_generated: result.insightsGenerated,
      insights_expired: result.insightsExpired,
      error: result.error,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRON Insights] POST error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
