// =====================================================
// API Route: POST /api/subscriptions/activate-trial
// Activa una prueba gratuita de 10 días para el plan Starter
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { activateFreeTrial } from '@/src/features/subscriptions/services/trial.service';
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
    const { client_id, plan = 'starter' } = body;

    // 3. Validar parámetros
    if (!client_id) {
      return NextResponse.json(
        { error: 'client_id es requerido' },
        { status: 400 }
      );
    }

    if (plan !== 'starter') {
      return NextResponse.json(
        { error: 'Solo el plan Starter puede tener prueba gratuita' },
        { status: 400 }
      );
    }

    // 4. Verificar que el usuario tiene acceso al cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    if (client.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder a este cliente' },
        { status: 403 }
      );
    }

    // 5. Activar trial
    const result = await activateFreeTrial(client_id, plan);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al activar la prueba gratuita' },
        { status: 400 }
      );
    }

    // 6. Retornar éxito
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
