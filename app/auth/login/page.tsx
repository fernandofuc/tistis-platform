'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if coming from onboarding
  const fromOnboarding = searchParams.get('onboarding') === 'complete';

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
          // Use replace with small delay to avoid RSC prefetch race condition
          // This prevents "Failed to fetch RSC payload" errors in Safari
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
        // Use replace with small delay to avoid RSC prefetch race condition
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 50);
      }
    } catch (err) {
      setError('Error al iniciar sesión. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

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
                width={80}
                height={80}
                className="mx-auto mb-4"
              />
            </Link>
            <h1 className="text-3xl font-bold text-tis-text-primary">
              Iniciar Sesión
            </h1>
            <p className="text-tis-text-secondary mt-2">
              Accede a tu dashboard de TIS TIS
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
                  Inicia sesión con tu cuenta de TIS TIS para acceder a tu nuevo dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-tis-text-primary mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  {...register('email')}
                  className={errors.email ? 'border-red-500' : ''}
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
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-tis-coral focus:ring-tis-coral"
                  />
                  <span className="ml-2 text-sm text-tis-text-secondary">Recordarme</span>
                </label>

                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-tis-coral hover:text-tis-coral/80"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading}
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

            {/* Divider */}
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
                className="text-tis-coral hover:text-tis-coral/80 font-medium"
              >
                Comienza tu prueba gratis
              </Link>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-tis-text-muted mt-6">
            Al iniciar sesión, aceptas nuestros{' '}
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
