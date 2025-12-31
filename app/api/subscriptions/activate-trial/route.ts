// =====================================================
// API Route: POST /api/subscriptions/activate-trial
// Activa una prueba gratuita de 10 días para el plan Starter
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { activateFreeTrial } from '@/src/features/subscriptions/services/trial.service';
import { validateActivateTrialCheckoutRequest } from '@/src/features/subscriptions/schemas/trial.schemas';
import { createServerClient } from '@/src/shared/lib/supabase';
import { rateLimit, RATE_LIMIT_PRESETS, createRateLimitResponse, getClientIdentifier } from '@/src/shared/lib/rate-limiter';
import { provisionTenant } from '@/lib/provisioning';
import { emailService } from '@/src/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent abuse (trial activation is sensitive)
    const rateLimitKey = getClientIdentifier(request);
    const rateLimitResult = rateLimit(`activate-trial:${rateLimitKey}`, RATE_LIMIT_PRESETS.auth);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // 1. Obtener body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    // 2. Validar con Zod schema
    let validatedData;
    try {
      validatedData = validateActivateTrialCheckoutRequest(body);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const firstError = validationError.errors[0];
        return NextResponse.json(
          {
            error: firstError.message,
            field: firstError.path.join('.'),
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { plan, customerEmail: rawEmail, customerName, customerPhone, vertical } = validatedData;

    // Normalize email to lowercase for consistent comparison
    const customerEmail = rawEmail.toLowerCase();

    // 3. Autenticación (opcional para trial - permite signup sin login)
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let clientId: string;

    if (user) {
      // Usuario autenticado - buscar o crear cliente
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // Crear nuevo cliente para usuario autenticado
        const { data: newClient, error: createError } = await supabase
          .from('clients')
          .insert({
            user_id: user.id,
            contact_email: customerEmail,
            contact_name: customerName,
            contact_phone: customerPhone || null,
            business_name: customerName || 'Mi Negocio',
            vertical: vertical || 'dental',
            status: 'active',
          })
          .select('id')
          .single();

        if (createError || !newClient) {
          console.error('[API] Error creating client:', createError);
          return NextResponse.json(
            { error: 'Error al crear cliente' },
            { status: 500 }
          );
        }

        clientId = newClient.id;
      }
    } else {
      // Usuario NO autenticado - permitir trial sin login
      // Verificar si ya existe un cliente con ese email (case-insensitive)
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, user_id')
        .ilike('contact_email', customerEmail)
        .maybeSingle();

      if (existingClient) {
        // Cliente ya existe - no permitir otro trial
        return NextResponse.json(
          {
            error: 'Este email ya tiene una cuenta. Por favor inicia sesion.',
            code: 'EMAIL_ALREADY_EXISTS',
          },
          { status: 400 }
        );
      }

      // Crear nuevo cliente sin user_id (signup flow)
      const { data: newClient, error: createError } = await supabase
        .from('clients')
        .insert({
          contact_email: customerEmail,
          contact_name: customerName,
          contact_phone: customerPhone || null,
          business_name: customerName || 'Mi Negocio',
          vertical: vertical || 'dental',
          status: 'active',
        })
        .select('id')
        .single();

      if (createError || !newClient) {
        console.error('[API] Error creating client:', createError);
        return NextResponse.json(
          { error: 'Error al crear cliente' },
          { status: 500 }
        );
      }

      clientId = newClient.id;
    }

    // 4. Activar trial
    const result = await activateFreeTrial(clientId, plan);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al activar la prueba gratuita' },
        { status: 400 }
      );
    }

    // 5. CRITICAL: Provision tenant for trial user
    // This creates: tenant, branch, user_role, staff, services, FAQs
    // Without this, user would have trial subscription but no access to dashboard
    console.log('[API] Starting tenant provisioning for trial...');

    const provisionResult = await provisionTenant({
      client_id: clientId,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone: customerPhone || undefined,
      vertical: (vertical as 'dental' | 'restaurant') || 'dental',
      plan: 'starter',
      branches_count: 1,
      subscription_id: result.subscription?.id,
    });

    if (!provisionResult.success) {
      console.error('[API] Tenant provisioning failed:', provisionResult.error);

      // ROLLBACK: Delete subscription so user can retry cleanly
      // Without this, the unique constraint prevents retry
      if (result.subscription?.id) {
        console.log('[API] Rolling back subscription:', result.subscription.id);
        await supabase
          .from('subscriptions')
          .delete()
          .eq('id', result.subscription.id);
      }

      console.log('[API] Rollback complete - user can retry');

      return NextResponse.json(
        {
          error: 'Error al configurar tu cuenta. Por favor intenta de nuevo.',
          details: provisionResult.error,
          can_retry: true,
        },
        { status: 500 }
      );
    }

    console.log('[API] Tenant provisioned successfully:', {
      tenant_id: provisionResult.tenant_id,
      tenant_slug: provisionResult.tenant_slug,
    });

    // 6. Update client with tenant_id
    if (provisionResult.tenant_id) {
      await supabase
        .from('clients')
        .update({ tenant_id: provisionResult.tenant_id })
        .eq('id', clientId);
    }

    // 7. Send credentials email if new user was created
    if (provisionResult.temp_password) {
      try {
        const dashboardUrl = `${process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com'}/dashboard`;

        await emailService.sendCredentials(customerEmail, {
          customerName: customerName || 'Cliente',
          dashboardUrl,
          email: customerEmail,
          tempPassword: provisionResult.temp_password,
          tenantSlug: provisionResult.tenant_slug || '',
        });

        console.log('[API] Credentials email sent successfully');
      } catch (emailError) {
        // Non-critical - log but don't fail the request
        console.error('[API] Error sending credentials email:', emailError);
      }
    } else {
      console.log('[API] User has existing account - no credentials email needed');
    }

    // 8. Retornar éxito
    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      daysRemaining: result.daysRemaining,
      tenant_id: provisionResult.tenant_id,
      tenant_slug: provisionResult.tenant_slug,
      message: `¡Prueba gratuita activada! Tienes ${result.daysRemaining} días para probar TIS TIS sin cargo.`,
    });
  } catch (error: unknown) {
    console.error('[API] Error activating trial:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
