'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import { supabase } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ======================
// GOOGLE ICON COMPONENT
// ======================
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ======================
// GITHUB ICON COMPONENT
// ======================
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// ======================
// AUTH VIEW TYPE
// ======================
type AuthView = 'social' | 'email';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [authView, setAuthView] = useState<AuthView>('social');

  // Check if coming from onboarding
  const fromOnboarding = searchParams.get('onboarding') === 'complete';

  // Check for OAuth errors in URL
  const oauthError = searchParams.get('error');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔍 Login page - session check:', !!session);
        if (session) {
          console.log('✅ Already logged in, redirecting to dashboard...');
          setTimeout(() => {
            window.location.replace('/dashboard');
          }, 50);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };
    checkSession();
  }, []);

  // Show OAuth errors if present
  useEffect(() => {
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
  }, [oauthError]);

  // ======================
  // OAUTH HANDLERS
  // ======================
  const handleGoogleAuth = async () => {
    setOauthLoading('google');
    setError(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('🔵 Initiating Google OAuth flow');
      console.log('Redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('🔴 Google OAuth Error:', error);
        throw error;
      }

      console.log('🟡 Google OAuth initiated - redirecting to provider');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al conectar con Google';
      console.error('🔴 Google Auth Exception:', errorMsg);
      setError(errorMsg);
      setOauthLoading(null);
    }
  };

  const handleGitHubAuth = async () => {
    setOauthLoading('github');
    setError(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('🔵 Initiating GitHub OAuth flow');
      console.log('Redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('🔴 GitHub OAuth Error:', error);
        throw error;
      }

      console.log('🟡 GitHub OAuth initiated - redirecting to provider');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al conectar con GitHub';
      console.error('🔴 GitHub Auth Exception:', errorMsg);
      setError(errorMsg);
      setOauthLoading(null);
    }
  };

  // ======================
  // EMAIL/PASSWORD HANDLER
  // ======================
  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos');
        } else {
          setError(authError.message);
        }
        setIsLoading(false);
        return;
      }

      if (authData.session) {
        console.log('✅ Login successful, redirecting to dashboard...');
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 50);
      }
    } catch (err) {
      setError('Error al iniciar sesión. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  const isAnyLoading = isLoading || oauthLoading !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-tis-bg-primary via-white to-tis-coral/5 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-tis-text-secondary hover:text-tis-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al inicio</span>
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <Image
                src="/logos/tis-brain-logo.png"
                alt="TIS TIS"
                width={64}
                height={64}
                className="mx-auto mb-4"
              />
            </Link>
            <h1 className="text-3xl font-bold text-tis-text-primary tracking-tight">
              Bienvenido de nuevo
            </h1>
            <p className="text-tis-text-secondary mt-2">
              Accede a tu cuenta de TIS TIS
            </p>
          </div>

          {/* Onboarding Success Message */}
          {fromOnboarding && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">
                  ¡Tu sistema está listo!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Inicia sesión para acceder a tu nuevo dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            {authView === 'social' ? (
              /* ==================== SOCIAL AUTH VIEW ==================== */
              <>
                {/* Google Button */}
                <button
                  onClick={handleGoogleAuth}
                  disabled={isAnyLoading}
                  className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all mb-3 relative disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span className="text-[15px] font-medium text-gray-900">
                    Continuar con Google
                  </span>
                </button>

                {/* GitHub Button */}
                <button
                  onClick={handleGitHubAuth}
                  disabled={isAnyLoading}
                  className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthLoading === 'github' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                  ) : (
                    <GitHubIcon className="text-gray-900" />
                  )}
                  <span className="text-[15px] font-medium text-gray-900">
                    Continuar con GitHub
                  </span>
                </button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-[13px] font-medium text-gray-400">
                      O
                    </span>
                  </div>
                </div>

                {/* Email Button */}
                <button
                  onClick={() => setAuthView('email')}
                  disabled={isAnyLoading}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-[15px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail className="w-5 h-5" />
                  Continuar con email
                </button>
              </>
            ) : (
              /* ==================== EMAIL AUTH VIEW ==================== */
              <>
                {/* Back to social options */}
                <button
                  onClick={() => setAuthView('social')}
                  disabled={isAnyLoading}
                  className="mb-6 text-sm text-tis-text-secondary hover:text-tis-text-primary transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Otras opciones de inicio
                </button>

                {/* Email Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-tis-text-primary mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      {...register('email')}
                      className={errors.email ? 'border-red-500' : ''}
                      disabled={isAnyLoading}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-tis-text-primary mb-2">
                      Contraseña
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...register('password')}
                      className={errors.password ? 'border-red-500' : ''}
                      disabled={isAnyLoading}
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-tis-coral focus:ring-tis-coral"
                      />
                      <span className="ml-2 text-sm text-tis-text-secondary">Recordarme</span>
                    </label>

                    <Link
                      href="/auth/forgot-password"
                      className="text-sm text-tis-coral hover:text-tis-coral/80 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isAnyLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      'Iniciar Sesión'
                    )}
                  </Button>
                </form>
              </>
            )}

            {/* Divider for signup */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-tis-text-muted">
                  ¿No tienes cuenta?
                </span>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center">
              <Link
                href="/discovery"
                className="inline-flex items-center justify-center w-full h-12 border-2 border-tis-coral text-tis-coral rounded-xl hover:bg-tis-coral hover:text-white transition-all font-medium"
              >
                Comienza tu prueba gratis
              </Link>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-tis-text-muted mt-6">
            Al continuar, aceptas nuestros{' '}
            <Link href="/terms" className="text-tis-coral hover:underline">
              Términos de Servicio
            </Link>{' '}
            y{' '}
            <Link href="/privacy" className="text-tis-coral hover:underline">
              Política de Privacidad
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-tis-bg-primary">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-tis-coral animate-spin mx-auto mb-4" />
        <p className="text-tis-text-secondary">Cargando...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}
