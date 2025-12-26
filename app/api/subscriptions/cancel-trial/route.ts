// =====================================================
// API Route: POST /api/subscriptions/cancel-trial
// Cancela una prueba gratuita (mantiene acceso pero no cobra al finalizar)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cancelTrial } from '@/src/features/subscriptions/services/trial.service';
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

    // 2. Obtener body
    const body = await request.json();
    const { subscription_id } = body;

    // 3. Validar parámetros
    if (!subscription_id) {
      return NextResponse.json(
        { error: 'subscription_id es requerido' },
        { status: 400 }
      );
    }

    // 4. Verificar que el usuario tiene acceso a la suscripción
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

    // @ts-ignore - Supabase types might not recognize nested select
    const clientUserId = subscription.clients?.user_id;
    if (clientUserId !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder a esta suscripción' },
        { status: 403 }
      );
    }

    // 5. Cancelar trial
    const result = await cancelTrial(subscription_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al cancelar la prueba gratuita' },
        { status: 400 }
      );
    }

    // 6. Retornar éxito
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
