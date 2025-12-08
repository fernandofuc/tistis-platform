// =====================================================
// TIS TIS PLATFORM - Login Form Component
// =====================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardHeader, CardContent } from '@/shared/components/ui';
import { useAuth } from '../hooks/useAuth';
import type { SignInFormData } from '../types';

// ======================
// VALIDATION SCHEMA
// ======================
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

// ======================
// COMPONENT
// ======================
export function LoginForm() {
  const router = useRouter();
  const { signIn, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setError(null);

    const result = await signIn(data.email, data.password);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }
  };

  return (
    <Card variant="elevated" className="w-full max-w-md mx-auto">
      <CardHeader
        title="Iniciar Sesión"
        subtitle="Accede a tu cuenta de ESVA"
      />
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="tu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-600">Recordarme</span>
            </label>

            <a
              href="/auth/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting || loading}
          >
            Iniciar Sesión
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
