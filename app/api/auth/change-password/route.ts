// =====================================================
// TIS TIS PLATFORM - Change Password API
// Verifies current password before allowing change
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, RATE_LIMIT_PRESETS, createRateLimitResponse, getClientIdentifier } from '@/src/shared/lib/rate-limiter';

// Admin client for password verification workaround
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  // Rate limiting - auth preset (10 requests per minute)
  const clientId = getClientIdentifier(request);
  const rateLimitResult = rateLimit(`change-password:${clientId}`, RATE_LIMIT_PRESETS.auth);

  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Las contraseñas nuevas no coinciden' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Validate password strength
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return NextResponse.json(
        { error: 'La contraseña debe contener mayúsculas, minúsculas y números' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verify current password by attempting to sign in
    // This is the standard way to verify password with Supabase
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      console.log('[ChangePassword] Current password verification failed:', signInError.message);
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      );
    }

    // Current password verified, now update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('[ChangePassword] Update error:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar la contraseña. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    console.log('[ChangePassword] Password updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
    });

  } catch (error: any) {
    console.error('[ChangePassword] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
