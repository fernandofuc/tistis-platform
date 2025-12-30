// =====================================================
// TIS TIS PLATFORM - Email Confirmation Route
// Handles email verification via magic link
// =====================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ======================
// VALID OTP TYPES
// ======================
const VALID_OTP_TYPES = ['signup', 'email', 'invite', 'recovery', 'email_change'] as const;
type OTPType = typeof VALID_OTP_TYPES[number];

// ======================
// HELPER: Validate OTP type
// ======================
function isValidOTPType(type: string | null): type is OTPType {
  if (!type) return false;
  return VALID_OTP_TYPES.includes(type as OTPType);
}

// ======================
// MAIN HANDLER
// ======================
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');

  console.log('🔵 [Confirm] Email confirmation request:', {
    hasToken: !!token_hash,
    type,
    timestamp: new Date().toISOString(),
  });

  // Validate parameters
  if (!token_hash) {
    console.error('🔴 [Confirm] Missing token_hash parameter');
    return NextResponse.redirect(new URL('/auth/error?reason=missing_token', request.url));
  }

  if (!isValidOTPType(type)) {
    console.error('🔴 [Confirm] Invalid OTP type:', type);
    return NextResponse.redirect(new URL('/auth/error?reason=invalid_type', request.url));
  }

  // Basic token validation
  if (token_hash.length < 10 || token_hash.length > 500) {
    console.warn('⚠️ [Confirm] Suspicious token length:', token_hash.length);
    return NextResponse.redirect(new URL('/auth/error?reason=invalid_token', request.url));
  }

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    console.log('🔄 [Confirm] Verifying OTP...');

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      console.error('🔴 [Confirm] OTP verification failed:', {
        message: error.message,
        status: error.status,
        name: error.name,
      });

      // Provide specific error messages
      if (error.message.includes('expired')) {
        return NextResponse.redirect(new URL('/auth/error?reason=expired', request.url));
      }

      return NextResponse.redirect(new URL('/auth/error?reason=invalid_token', request.url));
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [Confirm] Email verification successful in ${duration}ms`);

    // Redirect based on OTP type
    const redirectUrl = type === 'recovery'
      ? new URL('/auth/reset-password', request.url)
      : new URL('/dashboard', request.url);

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('🔴 [Confirm] Exception during verification:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    });

    return NextResponse.redirect(new URL('/auth/error?reason=server_error', request.url));
  }
}
