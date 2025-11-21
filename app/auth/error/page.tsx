'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function AuthErrorPage() {
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
            Error de Autenticación
          </h1>
          <p className="text-gray-600">
            Hubo un problema al verificar tu cuenta. El enlace puede haber expirado o ser inválido.
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
