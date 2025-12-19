// =====================================================
// TIS TIS PLATFORM - Subscription Management Page
// Change plan, view billing, manage subscription
// USES CENTRALIZED PLAN CONFIG - Single source of truth
// =====================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Button, Badge } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';
import { ArrowRight, Shield, Users, Phone, Check } from 'lucide-react';

// Import centralized plan config - SINGLE SOURCE OF TRUTH
import { PLAN_CONFIG, getPlanConfig, type PlanConfig } from '@/src/shared/config/plans';

// ==============================================
// PLAN DISPLAY CONFIG - Features for dashboard
// Synchronized with pricing page
// ==============================================

interface DashboardPlanDisplay {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  features: string[];
  maxBranches: number;
  popular?: boolean;
}

// Plans for dashboard display (excludes Scale - replaced by Enterprise card)
const DASHBOARD_PLANS: DashboardPlanDisplay[] = [
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'Automatiza lo esencial',
    price: PLAN_CONFIG.starter.monthlyPricePesos,
    features: [
      'Asistente IA 24/7 en WhatsApp',
      'Agenda automatizada de citas',
      'Recordatorios automaticos',
      'Dashboard de metricas',
      'Soporte por email',
    ],
    maxBranches: PLAN_CONFIG.starter.branchLimit,
  },
  {
    id: 'essentials',
    name: 'Essentials',
    subtitle: 'El favorito de los negocios en crecimiento',
    price: PLAN_CONFIG.essentials.monthlyPricePesos,
    features: [
      'Todo lo de Starter',
      'Facturacion automatica',
      'Integracion con tu sistema actual',
      'Historial completo de clientes',
      'Soporte prioritario + Call 30 min',
      'Hasta 5 sucursales',
    ],
    maxBranches: PLAN_CONFIG.essentials.branchLimit,
    popular: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    subtitle: 'Para los que quieren dominar',
    price: PLAN_CONFIG.growth.monthlyPricePesos,
    features: [
      'Todo lo de Essentials',
      'Agente IA con voz (llamadas)',
      'Multi-canal: WhatsApp, Web, Email',
      'Analiticas avanzadas y reportes',
      'Soporte 24/7 dedicado',
      'Hasta 8 sucursales',
    ],
    maxBranches: PLAN_CONFIG.growth.branchLimit,
  },
];

// ==============================================
// COMPONENT
// ==============================================

export default function SubscriptionPage() {
  const router = useRouter();

  // Use ONLY useAuthContext - it has everything we need (staff, tenant, branches)
  const { staff, tenant, branches, loading, initialized } = useAuthContext();

  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Check if user is owner
  const isOwner = staff?.role === 'owner';

  // Get current plan directly from tenant (lowercase for comparison)
  const currentPlan = tenant?.plan?.toLowerCase() || null;

  // Get tenant status
  const tenantStatus = tenant?.status || 'inactive';

  // Calculate branch counts
  const activeBranches = branches?.filter((b: { is_active?: boolean }) => b.is_active).length || 0;
  const totalBranches = branches?.length || 0;

  // Handle plan selection
  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) return;
    setSelectedPlan(planId);
    setShowConfirmModal(true);
  };

  // Handle plan change confirmation
  const handleConfirmChange = async () => {
    if (!selectedPlan) return;

    setChangingPlan(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers,
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

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
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
    };
    return tiers[planId.toLowerCase()] || 0;
  };

  // Check if plan is upgrade or downgrade
  const isUpgrade = (planId: string): boolean => {
    if (!currentPlan) return true;
    return getPlanTier(planId) > getPlanTier(currentPlan);
  };

  // Wait for auth to initialize
  if (!initialized || loading) {
    return (
      <PageWrapper title="Gestion de Suscripcion" subtitle="Cargando...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C5CFC]"></div>
        </div>
      </PageWrapper>
    );
  }

  if (!isOwner) {
    return (
      <PageWrapper title="Gestion de Suscripcion" subtitle="Solo el propietario puede gestionar la suscripcion">
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso Restringido</h3>
            <p className="text-gray-600 mb-6">Solo el propietario de la cuenta puede gestionar la suscripcion.</p>
            <Button variant="outline" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Gestion de Suscripcion" subtitle="Cambia tu plan o gestiona tu facturacion">
      <div className="space-y-8">
        {/* Current Plan Summary */}
        {currentPlan && (
          <Card variant="bordered" className="bg-gradient-to-r from-[#7C5CFC]/5 to-[#C23350]/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tu plan actual</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900 capitalize">
                      {currentPlan}
                    </h2>
                    <Badge variant={tenantStatus === 'active' ? 'success' : 'warning'}>
                      {tenantStatus === 'active' ? 'Activo' : tenantStatus}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {activeBranches} de {totalBranches || 1} sucursales en uso
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">Proximo cobro</p>
                  <p className="text-lg font-semibold text-gray-900">
                    N/A
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

        {/* Plans Grid - 3 plans + Enterprise card */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Planes Disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {DASHBOARD_PLANS.map((plan) => {
              const isCurrentPlan = currentPlan === plan.id;
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
                          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
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

            {/* Software Personalizado Card - Enterprise */}
            <Card
              variant="bordered"
              className="relative bg-gradient-to-br from-slate-800 to-slate-900 text-white"
            >
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h4 className="text-xl font-bold">Software Personalizado</h4>
                  <p className="text-sm text-slate-300">Enterprise - A tu medida</p>
                </div>

                <div className="text-center mb-6">
                  <span className="text-2xl font-bold text-white">
                    Cotizacion
                  </span>
                </div>

                <ul className="space-y-2 mb-6">
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Todo lo de Growth
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Integraciones personalizadas
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Equipo dedicado
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    SLA 2 horas
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Sucursales ilimitadas
                  </li>
                </ul>

                <Link href="/enterprise" className="block">
                  <Button
                    variant="outline"
                    className="w-full bg-white text-slate-800 hover:bg-slate-100 border-0"
                  >
                    Solicitar Cotizacion
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Back Button */}
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => router.back()}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a Configuracion
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
                  ? `Estas por mejorar a ${DASHBOARD_PLANS.find(p => p.id === selectedPlan)?.name}. Se te cobrara la diferencia prorrateada.`
                  : `Estas por cambiar a ${DASHBOARD_PLANS.find(p => p.id === selectedPlan)?.name}. El cambio se aplicara en tu proximo ciclo de facturacion.`}
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
