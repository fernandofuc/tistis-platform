'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Lock, CreditCard, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Plan configuration matching the API
const PLAN_CONFIG: Record<string, {
  name: string;
  price: number;
  branchExtra: number;
  branchExtraProgressive?: { qty: number; price: number }[];
  features: string[];
}> = {
  starter: {
    name: 'Starter',
    price: 3490,
    branchExtra: 1590,
    features: [
      'Asistente IA 24/7 en WhatsApp',
      'Hasta 500 conversaciones/mes',
      'Dashboard basico',
      'Soporte por email',
    ],
  },
  essentials: {
    name: 'Essentials',
    price: 7490,
    branchExtra: 1990,
    branchExtraProgressive: [
      { qty: 2, price: 1990 },
      { qty: 3, price: 1790 },
      { qty: 4, price: 1590 },
      { qty: 5, price: 1490 },
    ],
    features: [
      'Todo lo de Starter',
      'Hasta 2,000 conversaciones/mes',
      'Integracion con sistemas existentes',
      'Soporte prioritario',
      'Call de configuracion en 30 min',
    ],
  },
  growth: {
    name: 'Growth',
    price: 12490,
    branchExtra: 2890,
    branchExtraProgressive: [
      { qty: 2, price: 2890 },
      { qty: 3, price: 2490 },
      { qty: 4, price: 1990 },
      { qty: 5, price: 1590 },
    ],
    features: [
      'Todo lo de Essentials',
      'Conversaciones ilimitadas',
      'Multi-canal (WhatsApp, Web, Email)',
      'Soporte 24/7',
      'Call de configuracion en 30 min',
    ],
  },
  scale: {
    name: 'Scale',
    price: 19990,
    branchExtra: 3590,
    branchExtraProgressive: [
      { qty: 2, price: 3590 },
      { qty: 3, price: 2890 },
      { qty: 4, price: 2490 },
      { qty: 5, price: 1990 },
    ],
    features: [
      'Todo lo de Growth',
      'IA entrenada con tus datos',
      'Equipo dedicado',
      'SLA garantizado',
      'Call de configuracion en 30 min',
    ],
  },
};

// Calculate branch cost with progressive pricing
function calculateBranchCost(plan: typeof PLAN_CONFIG[string], branches: number): number {
  if (branches <= 1) return 0;

  let totalCost = 0;
  if (plan.branchExtraProgressive) {
    for (let i = 2; i <= branches; i++) {
      const tierInfo = plan.branchExtraProgressive.find(t => t.qty === i);
      if (tierInfo) {
        totalCost += tierInfo.price;
      } else {
        const tier5 = plan.branchExtraProgressive.find(t => t.qty === 5);
        totalCost += tier5 ? tier5.price : plan.branchExtra;
      }
    }
  } else {
    totalCost = (branches - 1) * plan.branchExtra;
  }
  return totalCost;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState('essentials');
  const [branches, setBranches] = useState(1);
  const [addons, setAddons] = useState<string[]>([]);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    // Get plan from URL first, then sessionStorage
    const urlPlan = searchParams.get('plan');
    const savedPlan = urlPlan || sessionStorage.getItem('selected_plan') || 'essentials';
    setPlanId(savedPlan);

    // Get branches from sessionStorage (set by pricing page)
    const savedBranches = sessionStorage.getItem('pricing_branches');
    if (savedBranches) {
      setBranches(parseInt(savedBranches, 10) || 1);
    }

    // Get addons from sessionStorage
    const savedAddons = sessionStorage.getItem('pricing_addons');
    if (savedAddons) {
      try {
        setAddons(JSON.parse(savedAddons) || []);
      } catch (e) {
        console.error('Error parsing addons:', e);
      }
    }

    // Get contact info from questionnaire if available
    const savedAnswers = sessionStorage.getItem('questionnaire_answers');
    if (savedAnswers) {
      try {
        const answers = JSON.parse(savedAnswers);
        if (answers.contact_info) {
          setCustomerEmail(answers.contact_info.email || '');
          setCustomerName(answers.contact_info.name || '');
          setCustomerPhone(answers.contact_info.phone || '');
        }
      } catch (e) {
        console.error('Error parsing questionnaire answers:', e);
      }
    }
  }, [searchParams]);

  const plan = PLAN_CONFIG[planId] || PLAN_CONFIG.essentials;
  const extraBranches = Math.max(0, branches - 1);
  const branchCost = calculateBranchCost(plan, branches);
  const monthlyTotal = plan.price + branchCost;

  const handleCheckout = async () => {
    if (!customerEmail) {
      setError('Por favor ingresa tu correo electronico');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: planId,
          customerEmail,
          customerName,
          customerPhone,
          branches,
          addons,
          metadata: {
            proposalId: sessionStorage.getItem('proposal_id') || '',
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear sesion de pago');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se recibio URL de checkout');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Error al procesar el pago');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-tis-bg-primary py-12">
      <Container className="max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Finalizar Pago</h1>
          <p className="text-tis-text-secondary">
            Estas a un paso de automatizar tu negocio
          </p>
        </div>

        {cancelled && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-yellow-800">
              El pago fue cancelado. Puedes intentar de nuevo cuando quieras.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6">Resumen del Pedido</h2>

            <div className="space-y-4 mb-6">
              {/* Plan base */}
              <div className="flex justify-between">
                <span className="text-tis-text-secondary">Plan {plan.name}</span>
                <span className="font-semibold">${plan.price.toLocaleString('es-MX')} MXN/mes</span>
              </div>

              {/* Extra branches */}
              {extraBranches > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-tis-text-secondary flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {extraBranches} sucursal(es) extra
                  </span>
                  <span className="font-semibold">${branchCost.toLocaleString('es-MX')} MXN/mes</span>
                </div>
              )}

              {/* Total mensual */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total Mensual</span>
                  <span className="font-bold text-tis-coral">
                    ${monthlyTotal.toLocaleString('es-MX')} MXN/mes
                  </span>
                </div>
                <p className="text-sm text-tis-text-muted mt-2">
                  Suscripcion mensual - puedes cancelar cuando quieras
                </p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-800 mb-2">Lo que obtienes:</h3>
              <ul className="space-y-2 text-sm text-green-700">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
                {branches > 1 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Soporte para {branches} sucursales
                  </li>
                )}
              </ul>
            </div>
          </Card>

          {/* Payment Info */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6">Informacion de Pago</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">Pago 100% Seguro</p>
                  <p className="text-sm text-blue-700">
                    Procesado por Stripe - Encriptacion SSL de grado bancario
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo electronico
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-coral focus:border-transparent"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre completo
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-coral focus:border-transparent"
              />
            </div>

            <div className="text-center">
              <CreditCard className="w-12 h-12 text-tis-text-muted mx-auto mb-4" />
              <p className="text-tis-text-secondary mb-6 text-sm">
                Seras redirigido a Stripe para completar el pago de forma segura
              </p>

              <Button
                size="xl"
                variant="primary"
                className="w-full"
                onClick={handleCheckout}
                loading={loading}
                disabled={loading || !customerEmail}
              >
                {loading ? 'Redirigiendo a Stripe...' : 'Proceder al Pago Seguro'}
                {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
              </Button>

              <p className="text-xs text-tis-text-muted mt-4">
                Al continuar, aceptas nuestros{' '}
                <a href="/terms" className="underline hover:text-gray-700">terminos de servicio</a>
                {' '}y{' '}
                <a href="/privacy" className="underline hover:text-gray-700">politica de privacidad</a>
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t">
              <span className="text-xs text-tis-text-muted">Aceptamos:</span>
              <div className="flex items-center gap-2">
                <div className="bg-white border rounded px-2 py-1">
                  <span className="text-xs font-bold text-blue-600">VISA</span>
                </div>
                <div className="bg-white border rounded px-2 py-1">
                  <span className="text-xs font-bold text-red-500">Mastercard</span>
                </div>
                <div className="bg-white border rounded px-2 py-1">
                  <span className="text-xs font-bold text-blue-400">Amex</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-tis-text-muted">
            Quieres cambiar de plan?{' '}
            <button
              onClick={() => router.push('/pricing')}
              className="text-tis-coral hover:underline"
            >
              Volver a precios
            </button>
          </p>
        </div>
      </Container>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-tis-bg-primary py-12 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tis-coral mx-auto mb-4"></div>
        <p className="text-tis-text-secondary">Cargando checkout...</p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckoutContent />
    </Suspense>
  );
}
