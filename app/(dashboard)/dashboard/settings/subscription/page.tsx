// =====================================================
// TIS TIS PLATFORM - Subscription Management Page
// Change plan, view billing, manage subscription (Claude-style)
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button, Badge } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { cn } from '@/src/shared/utils';

// Plan definitions matching the pricing page
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'Para Empezar (1 Sucursal)',
    price: 3490,
    features: [
      'Panel de control básico',
      'Asistente automatizado 24/7',
      '2,500 mensajes/mes',
      'Alertas de inventario básicas',
      'Reportes diarios automáticos',
      '5 créditos/mes',
    ],
    maxBranches: 1,
  },
  {
    id: 'essentials',
    name: 'Essentials',
    subtitle: 'Multi-Sucursal con Automatización',
    price: 7490,
    features: [
      'Todo lo de Starter',
      'Facturación CFDI 4.0 incluida',
      'Multi-sucursal',
      'Auto-reorden 3 productos',
      'Cierre diario con IA',
      'Tokens lealtad básico',
      '8 créditos/mes',
    ],
    maxBranches: 9,
  },
  {
    id: 'growth',
    name: 'Growth',
    subtitle: 'Operación Inteligente',
    price: 12490,
    popular: true,
    features: [
      'Todo lo de Essentials',
      'Auto-reorden ilimitado',
      'Predicción demanda ML',
      'Anomalías tiempo real',
      'Campañas WhatsApp segmentadas',
      'Voz-IA avanzado',
      '13 créditos/mes',
    ],
    maxBranches: 9,
  },
  {
    id: 'scale',
    name: 'Scale',
    subtitle: 'Enterprise - Máxima Capacidad',
    price: 19990,
    features: [
      'Todo lo de Growth',
      'ML predicción avanzada',
      'BI con insights automáticos',
      'Automatización end-to-end',
      'Account Manager dedicado',
      'Disaster recovery incluido',
      '25 créditos/mes',
    ],
    maxBranches: 9,
  },
];

interface SubscriptionData {
  plan: string;
  status: string;
  max_branches: number;
  current_branches: number;
  period_end: string;
  stripe_subscription_id?: string;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { staff } = useAuthContext();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Check if user is owner
  const isOwner = staff?.role === 'owner';

  // Fetch current subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/stripe/update-subscription');
        if (response.ok) {
          const data = await response.json();
          setSubscription(data.data);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  // Handle plan selection
  const handleSelectPlan = (planId: string) => {
    if (planId === subscription?.plan) return; // Already on this plan
    setSelectedPlan(planId);
    setShowConfirmModal(true);
  };

  // Handle plan change confirmation
  const handleConfirmChange = async () => {
    if (!selectedPlan) return;

    setChangingPlan(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlan: selectedPlan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar el plan');
      }

      // If Stripe returns a checkout URL, redirect to it
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // Otherwise, refresh and show success
      window.location.reload();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setChangingPlan(false);
      setShowConfirmModal(false);
    }
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Get plan tier for comparison
  const getPlanTier = (planId: string): number => {
    const tiers: Record<string, number> = {
      starter: 1,
      essentials: 2,
      growth: 3,
      scale: 4,
    };
    return tiers[planId] || 0;
  };

  // Check if plan is upgrade or downgrade
  const isUpgrade = (planId: string): boolean => {
    if (!subscription) return false;
    return getPlanTier(planId.toLowerCase()) > getPlanTier(subscription.plan?.toLowerCase() || '');
  };

  if (!isOwner) {
    return (
      <PageWrapper title="Gestión de Suscripción" subtitle="Solo el propietario puede gestionar la suscripción">
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso Restringido</h3>
            <p className="text-gray-600 mb-6">Solo el propietario de la cuenta puede gestionar la suscripción.</p>
            <Button variant="outline" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  if (loading) {
    return (
      <PageWrapper title="Gestión de Suscripción" subtitle="Cargando...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C5CFC]"></div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Gestión de Suscripción" subtitle="Cambia tu plan o gestiona tu facturación">
      <div className="space-y-8">
        {/* Current Plan Summary */}
        {subscription && (
          <Card variant="bordered" className="bg-gradient-to-r from-[#7C5CFC]/5 to-[#C23350]/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tu plan actual</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900 capitalize">
                      {subscription.plan}
                    </h2>
                    <Badge variant={subscription.status === 'active' ? 'success' : 'warning'}>
                      {subscription.status === 'active' ? 'Activo' : subscription.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {subscription.current_branches} de {subscription.max_branches} sucursales en uso
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">Próximo cobro</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {subscription.period_end
                      ? new Date(subscription.period_end).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Plans Grid */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Planes Disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map((plan) => {
              const isCurrentPlan = subscription?.plan?.toLowerCase() === plan.id.toLowerCase();
              const isPlanUpgrade = isUpgrade(plan.id);

              return (
                <Card
                  key={plan.id}
                  variant="bordered"
                  className={cn(
                    'relative transition-all',
                    isCurrentPlan && 'ring-2 ring-[#7C5CFC] bg-[#7C5CFC]/5',
                    plan.popular && !isCurrentPlan && 'ring-2 ring-[#C23350]'
                  )}
                >
                  {plan.popular && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[#C23350] text-white">Recomendado</Badge>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[#7C5CFC] text-white">Plan Actual</Badge>
                    </div>
                  )}

                  <CardContent className="pt-6">
                    <div className="text-center mb-4">
                      <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                      <p className="text-sm text-gray-500">{plan.subtitle}</p>
                    </div>

                    <div className="text-center mb-6">
                      <span className="text-3xl font-bold text-[#7C5CFC]">
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-gray-500">/mes</span>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                      <Button variant="outline" disabled className="w-full">
                        Plan Actual
                      </Button>
                    ) : (
                      <Button
                        variant={isPlanUpgrade ? 'primary' : 'outline'}
                        className="w-full"
                        onClick={() => handleSelectPlan(plan.id)}
                      >
                        {isPlanUpgrade ? 'Mejorar Plan' : 'Cambiar a Este Plan'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Back Button */}
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => router.back()}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a Configuración
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#7C5CFC]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#7C5CFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {isUpgrade(selectedPlan) ? 'Mejorar Plan' : 'Cambiar Plan'}
              </h3>
              <p className="text-gray-600">
                {isUpgrade(selectedPlan)
                  ? `Estás por mejorar a ${PLANS.find(p => p.id === selectedPlan)?.name}. Se te cobrará la diferencia prorrateada.`
                  : `Estás por cambiar a ${PLANS.find(p => p.id === selectedPlan)?.name}. El cambio se aplicará en tu próximo ciclo de facturación.`}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirmModal(false)}
                disabled={changingPlan}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmChange}
                isLoading={changingPlan}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
