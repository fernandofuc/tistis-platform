// =====================================================
// TIS TIS PLATFORM - Forgot Password Page
// Allows users to request a password reset email
// =====================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Email validation
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Por favor ingresa tu correo electrónico');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Por favor ingresa un correo electrónico válido');
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        // Don't reveal if email exists or not for security
        console.error('[ForgotPassword] Error:', resetError.message);
      }

      // Always show success to prevent email enumeration attacks
      setSuccess(true);

    } catch (err) {
      console.error('[ForgotPassword] Exception:', err);
      // Still show success to prevent email enumeration
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-tis-bg-primary via-white to-tis-coral/5 flex flex-col">
        {/* Header */}
        <header className="p-6">
          <Link href="/auth/login" className="inline-flex items-center gap-2 text-tis-text-secondary hover:text-tis-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al inicio de sesión</span>
          </Link>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-tis-text-primary mb-2">
                Revisa tu correo
              </h1>
              <p className="text-tis-text-secondary mb-6">
                Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña.
              </p>
              <p className="text-sm text-tis-text-muted mb-6">
                El enlace expirará en 1 hora. Revisa también tu carpeta de spam.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center px-6 py-3 bg-tis-coral text-white font-medium rounded-lg hover:bg-tis-coral/90 transition-colors"
              >
                Volver al Inicio de Sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Request form
  return (
    <div className="min-h-screen bg-gradient-to-br from-tis-bg-primary via-white to-tis-coral/5 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-tis-text-secondary hover:text-tis-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al inicio de sesión</span>
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
              Recuperar Contraseña
            </h1>
            <p className="text-tis-text-secondary mt-2">
              Te enviaremos un enlace para restablecer tu contraseña
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-tis-text-primary mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-coral focus:border-transparent outline-none transition-all"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 px-4 bg-tis-coral text-white font-semibold rounded-lg hover:bg-tis-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Enlace de Recuperación'
                )}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Link
                href="/auth/login"
                className="text-sm text-tis-text-secondary hover:text-tis-coral transition-colors"
              >
                ¿Recordaste tu contraseña? <span className="font-medium">Inicia sesión</span>
              </Link>
            </div>
          </div>

          {/* Security Note */}
          <p className="text-center text-xs text-tis-text-muted mt-6">
            Por seguridad, el enlace de recuperación expira en 1 hora.
          </p>
        </div>
      </div>
    </div>
  );
}
