// =====================================================
// API Route: POST /api/subscriptions/activate-trial
// Activa una prueba gratuita de 10 días para el plan Starter
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { activateFreeTrial } from '@/src/features/subscriptions/services/trial.service';
import { validateActivateTrialRequest } from '@/src/features/subscriptions/schemas/trial.schemas';
import { createServerClient } from '@/src/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // 1. Obtener y validar body con Zod
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const { plan, customerEmail, customerName, customerPhone, vertical, metadata } = body;

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'customerEmail es requerido' },
        { status: 400 }
      );
    }

    if (plan !== 'starter') {
      return NextResponse.json(
        { error: 'Solo el plan Starter puede tener prueba gratuita' },
        { status: 400 }
      );
    }

    // 2. Autenticación (opcional para trial - permite signup sin login)
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
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
            email: customerEmail,
            name: customerName || '',
            phone: customerPhone || '',
            vertical: vertical || 'dental',
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
      // Verificar si ya existe un cliente con ese email
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, user_id')
        .eq('email', customerEmail)
        .maybeSingle();

      if (existingClient) {
        // Cliente ya existe - no permitir otro trial
        return NextResponse.json(
          {
            error: 'Este email ya tiene una cuenta. Por favor inicia sesión.',
            code: 'EMAIL_ALREADY_EXISTS'
          },
          { status: 400 }
        );
      }

      // Crear nuevo cliente sin user_id (signup flow)
      const { data: newClient, error: createError } = await supabase
        .from('clients')
        .insert({
          email: customerEmail,
          name: customerName || '',
          phone: customerPhone || '',
          vertical: vertical || 'dental',
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

    // 3. Activar trial
    const result = await activateFreeTrial(clientId, plan);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al activar la prueba gratuita' },
        { status: 400 }
      );
    }

    // 4. Retornar éxito
    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      daysRemaining: result.daysRemaining,
      message: `¡Prueba gratuita activada! Tienes ${result.daysRemaining} días para probar TIS TIS sin cargo.`,
    });
  } catch (error: any) {
    console.error('[API] Error activating trial:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
