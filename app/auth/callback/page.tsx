'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/shared/lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * OAuth Callback Page (Client-Side)
 *
 * This page handles OAuth callbacks for implicit flow where tokens
 * are passed in the URL fragment (#access_token=...) instead of
 * query parameters (?code=...).
 *
 * Flow:
 * 1. User clicks "Login with Google"
 * 2. Redirected to Google -> Supabase -> This page
 * 3. Supabase client detects tokens in URL fragment
 * 4. Session is established automatically
 * 5. We check if user has tenant and redirect accordingly
 *
 * CHECKOUT FLOW (New):
 * If sessionStorage has 'checkout_pending' = 'true':
 * 1. Get checkout context from sessionStorage
 * 2. If plan is 'starter' (trial) - call activate-trial API
 * 3. If plan is 'essentials'/'growth' - redirect to Stripe checkout
 * 4. Clean up sessionStorage
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Verificando tu cuenta...');

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      try {
        console.log('🔵 [Callback Page] Processing OAuth callback...');

        // Check URL for error params (these come as query params)
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (error) {
          console.error('🔴 [Callback Page] OAuth error:', error, errorDescription);
          throw new Error(errorDescription || error);
        }

        // For implicit flow, Supabase automatically detects tokens in URL fragment
        // We just need to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('🔴 [Callback Page] Session error:', sessionError);
          throw sessionError;
        }

        // If no session yet, wait a moment and try again
        // (Supabase might still be processing the URL fragment)
        if (!session) {
          console.log('🟡 [Callback Page] No session yet, waiting for Supabase to process tokens...');

          // Give Supabase a moment to process the URL fragment
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Try getting session again
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();

          if (retryError || !retrySession) {
            console.error('🔴 [Callback Page] Still no session after retry');
            throw new Error('No se pudo establecer la sesión. Por favor intenta de nuevo.');
          }

          // Use the retry session
          await processSession(retrySession);
        } else {
          await processSession(session);
        }

      } catch (err) {
        console.error('🔴 [Callback Page] Error:', err);
        if (mounted) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'Error de autenticación');
        }
      }
    };

    const processSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!session || !session.user) {
        throw new Error('Sesión inválida');
      }

      console.log('✅ [Callback Page] Session established:', {
        userId: session.user.id,
        email: session.user.email,
        provider: session.user.app_metadata?.provider,
      });

      // ============================================================
      // CHECK FOR PENDING CHECKOUT (from checkout page OAuth flow)
      // ============================================================
      const checkoutPending = sessionStorage.getItem('checkout_pending');

      if (checkoutPending === 'true') {
        console.log('🛒 [Callback Page] Pending checkout detected, processing...');
        await handlePendingCheckout(session);
        return;
      }

      // ============================================================
      // NORMAL OAUTH FLOW (from login page)
      // ============================================================

      // Check if user has a tenant
      const hasTenant = await checkUserHasTenant(session.user.id);

      if (mounted) {
        setStatus('success');

        // Small delay before redirect for UX
        setTimeout(() => {
          if (hasTenant) {
            console.log('✅ [Callback Page] Existing user - redirecting to dashboard');
            router.replace('/dashboard');
          } else {
            console.log('🆕 [Callback Page] New user - redirecting to pricing');
            router.replace(`/pricing?new_user=true&email=${encodeURIComponent(session.user.email || '')}`);
          }
        }, 500);
      }
    };

    /**
     * Handle pending checkout from OAuth flow
     * Reads context from sessionStorage and continues checkout process
     */
    const handlePendingCheckout = async (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>) => {
      try {
        // Get checkout context from sessionStorage
        const plan = sessionStorage.getItem('checkout_plan') || 'starter';
        const vertical = sessionStorage.getItem('checkout_vertical') || 'dental';
        const branches = parseInt(sessionStorage.getItem('checkout_branches') || '1', 10);
        const customerName = sessionStorage.getItem('checkout_name') || '';
        const customerPhone = sessionStorage.getItem('checkout_phone') || '';

        // Clean up sessionStorage immediately to prevent loops
        sessionStorage.removeItem('checkout_pending');
        sessionStorage.removeItem('checkout_plan');
        sessionStorage.removeItem('checkout_vertical');
        sessionStorage.removeItem('checkout_branches');
        sessionStorage.removeItem('checkout_name');
        sessionStorage.removeItem('checkout_phone');

        console.log('🛒 [Callback Page] Checkout context:', {
          plan,
          vertical,
          branches,
          email: session.user.email,
          customerName,
        });

        if (plan === 'starter') {
          // ============================================================
          // TRIAL FLOW - Activate free trial via API
          // ============================================================
          if (mounted) {
            setStatusMessage('Activando tu prueba gratuita...');
          }

          const response = await fetch('/api/subscriptions/activate-trial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: 'starter',
              customerEmail: session.user.email,
              customerName: customerName || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
              customerPhone,
              vertical,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            // Check if email already exists (user might already have account)
            if (data.code === 'EMAIL_ALREADY_EXISTS') {
              console.log('🔄 [Callback Page] User already exists, checking tenant...');
              const hasTenant = await checkUserHasTenant(session.user.id);
              if (hasTenant) {
                if (mounted) {
                  setStatus('success');
                  setStatusMessage('Cuenta existente detectada');
                  router.replace('/dashboard');
                }
                return;
              }
            }
            throw new Error(data.error || 'Error al activar la prueba gratuita');
          }

          console.log('✅ [Callback Page] Trial activated successfully:', data);

          if (mounted) {
            setStatus('success');
            setStatusMessage('¡Prueba gratuita activada!');

            // Redirect to trial success page
            const successParams = new URLSearchParams({
              daysRemaining: String(data.daysRemaining || 10),
              plan: 'starter',
              vertical,
            });
            setTimeout(() => {
              router.replace('/trial-success?' + successParams.toString());
            }, 500);
          }

        } else {
          // ============================================================
          // PAID FLOW - Create Stripe checkout session
          // ============================================================
          if (mounted) {
            setStatusMessage('Preparando el pago...');
          }

          const response = await fetch('/api/stripe/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan,
              customerEmail: session.user.email,
              customerName: customerName || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
              customerPhone,
              branches,
              addons: [],
              vertical,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Error al crear sesión de pago');
          }

          if (data.url) {
            console.log('✅ [Callback Page] Stripe session created, redirecting...');
            if (mounted) {
              setStatus('success');
              setStatusMessage('Redirigiendo al pago...');
            }
            // Redirect to Stripe
            window.location.href = data.url;
          } else {
            throw new Error('No se recibió URL de checkout');
          }
        }

      } catch (err) {
        console.error('🔴 [Callback Page] Checkout error:', err);
        if (mounted) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'Error al procesar el checkout');
        }
      }
    };

    const checkUserHasTenant = async (userId: string): Promise<boolean> => {
      try {
        // ============================================
        // CRITICAL FIX: Query must require tenant_id IS NOT NULL
        // This prevents matching corrupted records with NULL tenant_id
        // ============================================
        const { data: userRole, error } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .not('tenant_id', 'is', null)
          .maybeSingle();

        if (error) {
          // On error, assume NO tenant to redirect to pricing
          // This prevents new users from hitting dashboard errors
          // If user actually has tenant, dashboard will work anyway
          console.warn('⚠️ [Callback Page] Error checking tenant, assuming new user:', error);
          return false; // Assume NO tenant - safer to redirect to pricing
        }

        return !!userRole?.tenant_id;
      } catch (err) {
        console.error('🔴 [Callback Page] Exception checking tenant:', err);
        return false; // Assume NO tenant - safer to redirect to pricing
      }
    };

    handleCallback();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Redirect to login on error after a delay
  useEffect(() => {
    if (status === 'error') {
      const timer = setTimeout(() => {
        router.replace(`/auth/login?error=${encodeURIComponent(errorMessage || 'Error de autenticación')}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, errorMessage, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tis-bg-primary via-white to-tis-coral/5">
      <div className="text-center p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-tis-coral animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {statusMessage}
            </h1>
            <p className="text-gray-500">
              Por favor espera un momento
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {statusMessage}
            </h1>
            <p className="text-gray-500">
              Redirigiendo...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Error de autenticación
            </h1>
            <p className="text-red-600 mb-4">
              {errorMessage}
            </p>
            <p className="text-gray-500 text-sm">
              Redirigiendo al login...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
