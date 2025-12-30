// =====================================================
// TIS TIS PLATFORM - Auth Error Page
// Shows specific error messages based on error reason
// =====================================================

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';

// ======================
// ERROR MESSAGES
// ======================
const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  missing_token: {
    title: 'Enlace Inválido',
    message: 'El enlace de verificación no contiene un token válido. Por favor solicita un nuevo enlace.',
  },
  invalid_type: {
    title: 'Tipo de Verificación Inválido',
    message: 'El tipo de verificación no es válido. Por favor solicita un nuevo enlace.',
  },
  invalid_token: {
    title: 'Token Inválido',
    message: 'El token de verificación es inválido. Por favor solicita un nuevo enlace.',
  },
  expired: {
    title: 'Enlace Expirado',
    message: 'El enlace de verificación ha expirado. Por favor solicita un nuevo enlace.',
  },
  server_error: {
    title: 'Error del Servidor',
    message: 'Ocurrió un error inesperado. Por favor intenta de nuevo más tarde.',
  },
  default: {
    title: 'Error de Autenticación',
    message: 'Hubo un problema al verificar tu cuenta. El enlace puede haber expirado o ser inválido.',
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'default';
  const errorInfo = ERROR_MESSAGES[reason] || ERROR_MESSAGES.default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-tis-bg-primary p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {errorInfo.title}
          </h1>
          <p className="text-gray-600">
            {errorInfo.message}
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/" className="block">
            <Button variant="primary" className="w-full">
              Volver al Inicio
            </Button>
          </Link>
          <Link href="/auth/login" className="block">
            <Button variant="ghost" className="w-full">
              Intentar de Nuevo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-tis-bg-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
