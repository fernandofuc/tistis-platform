// =====================================================
// TIS TIS PLATFORM - Billing Section Component
// Handles invoice viewing via Stripe Customer Portal
// and subscription management (moved from Security)
// =====================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, Button, Badge } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { useTenant } from '@/src/hooks/useTenant';

export function BillingSection() {
  const router = useRouter();
  const { staff } = useAuthContext();
  const { tenant } = useTenant();

  // Portal state
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Check if user is owner (subscription management only for owners)
  const isOwner = staff?.role === 'owner';

  // Handle opening Stripe Customer Portal
  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    setPortalError(null);

    try {
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al abrir el portal de facturación');
      }

      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('[BillingSection] Portal error:', error);
      setPortalError(error.message);
      setOpeningPortal(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-tis-pink/10 rounded-lg">
            <svg className="w-5 h-5 text-tis-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Facturación</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestiona tus facturas, métodos de pago y suscripción
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {/* Stripe Customer Portal Section */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Portal de Facturación
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Accede a tu historial completo de facturas, descarga recibos y actualiza tus métodos de pago.
            </p>

            {portalError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{portalError}</p>
              </div>
            )}

            <Button
              onClick={handleOpenPortal}
              disabled={openingPortal}
              className="bg-tis-pink hover:bg-tis-pink/90 text-white"
            >
              {openingPortal ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Abriendo Portal...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Ver Facturas y Pagos
                </>
              )}
            </Button>

            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Serás redirigido al portal seguro de Stripe para gestionar tu facturación.
            </p>
          </div>

          {/* Current Plan Info */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Tu Plan Actual</h4>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {tenant?.plan ? (
                      tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
                    ) : (
                      'Plan Activo'
                    )}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Facturación mensual
                  </p>
                </div>
                <Badge variant="success">Activo</Badge>
              </div>
            </div>
          </div>

          {/* Subscription Management - Only for Owners */}
          {isOwner && (
            <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Gestión de Suscripción
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Cambia tu plan o cancela tu suscripción.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard/settings/subscription')}
                  className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Cambiar Plan
                </Button>

                <Button
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                  onClick={() => router.push('/dashboard/settings/cancel-subscription')}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar Suscripción
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
