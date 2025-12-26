// =====================================================
// API Route: POST /api/subscriptions/cancel-trial
// Cancela una prueba gratuita (mantiene acceso pero no cobra al finalizar)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cancelTrial } from '@/src/features/subscriptions/services/trial.service';
import { validateCancelTrialRequest } from '@/src/features/subscriptions/schemas/trial.schemas';
import { createServerClient } from '@/src/shared/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticación
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Obtener y validar body con Zod
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = validateCancelTrialRequest(body);
    } catch (validationError: any) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationError.errors || validationError.message
        },
        { status: 400 }
      );
    }

    const { subscription_id } = validatedData;

    // 3. Verificar que el usuario tiene acceso a la suscripción
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, client_id, clients(user_id)')
      .eq('id', subscription_id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Suscripción no encontrada' },
        { status: 404 }
      );
    }

    // Supabase retorna joins como arrays, acceder al primer elemento
    const clientUserId = (subscription.clients as Array<{user_id: string}>)?.[0]?.user_id;
    if (clientUserId !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder a esta suscripción' },
        { status: 403 }
      );
    }

    // 4. Cancelar trial
    const result = await cancelTrial(subscription_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al cancelar la prueba gratuita' },
        { status: 400 }
      );
    }

    // 5. Retornar éxito
    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      message:
        result.message ||
        'Prueba gratuita cancelada. Puedes seguir usando TIS TIS hasta el final de tu período de prueba, pero no se te cobrará después.',
    });
  } catch (error: any) {
    console.error('[API] Error cancelling trial:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
