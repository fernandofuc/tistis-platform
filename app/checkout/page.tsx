'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Lock, CreditCard, CheckCircle, AlertCircle, Building2, Check, Gift, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  PLAN_CONFIG,
  getPlanConfig,
  calculateBranchCostPesos,
} from '@/src/shared/config/plans';

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
  const [vertical, setVertical] = useState('dental'); // Default vertical

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

    // Get vertical from sessionStorage (set by pricing page)
    const savedVertical = sessionStorage.getItem('selected_vertical');
    if (savedVertical) {
      setVertical(savedVertical);
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

  const plan = getPlanConfig(planId) || PLAN_CONFIG.essentials;
  const extraBranches = Math.max(0, branches - 1);
  const branchCost = calculateBranchCostPesos(planId, branches);
  const monthlyTotal = plan.monthlyPricePesos + branchCost;

  // Determinar si es elegible para free trial
  const isStarterPlan = planId === 'starter';
  // Por ahora, mostrar trial solo para starter (la API verificará si ya existe)
  // Si el usuario ya tiene cuenta, la API retornará error y lo manejaremos
  const isFreeTrial = isStarterPlan;

  const handleCheckout = async () => {
    if (!customerEmail) {
      setError('Por favor ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isFreeTrial) {
        // FLUJO 1: Activar trial gratuito
        const response = await fetch('/api/subscriptions/activate-trial', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plan: planId,
            customerEmail,
            customerName,
            customerPhone,
            vertical,
            metadata: {
              proposalId: sessionStorage.getItem('proposal_id') || '',
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Manejar caso especial: email ya existe
          if (data.code === 'EMAIL_ALREADY_EXISTS') {
            setError('Este email ya está registrado. Por favor inicia sesión o usa otro email.');
          } else {
            throw new Error(data.error || 'Error al activar la prueba gratuita');
          }
          setLoading(false);
          return;
        }

        // Redirigir a página de éxito de trial
        router.push('/trial-success?daysRemaining=' + (data.daysRemaining || 10));
      } else {
        // FLUJO 2: Proceso de pago normal con Stripe
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
            vertical,
            metadata: {
              proposalId: sessionStorage.getItem('proposal_id') || '',
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al crear sesión de pago');
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No se recibió URL de checkout');
        }
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Error al procesar el pago');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-tis-pink/5 py-12">
      <Container className="max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-tis-coral bg-clip-text text-transparent">
            Finalizar Pago
          </h1>
          <p className="text-xl text-slate-600">
            {isFreeTrial
              ? '¡Estás a un paso de comenzar tu prueba gratuita! 🎉'
              : 'Estás a un paso de automatizar tu negocio'
            }
          </p>
        </motion.div>

        {/* Alerts */}
        {cancelled && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-xl flex items-center gap-3 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-yellow-800 font-medium">
              El pago fue cancelado. Puedes intentar de nuevo cuando quieras.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-xl flex items-center gap-3 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 font-medium">{error}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="relative p-8 shadow-xl rounded-2xl border-slate-200">
              {/* Badge para trial gratuito */}
              {isFreeTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-4 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold rounded-full shadow-lg flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Prueba Gratis 10 Días
                  </span>
                </div>
              )}

              <h2 className="text-2xl font-bold mb-6 text-slate-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-tis-coral" />
                Resumen del Pedido
              </h2>

              <div className="space-y-4 mb-6">
                {/* Plan base */}
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                  <div>
                    <span className="font-semibold text-slate-900">Plan {plan.name}</span>
                    <p className="text-xs text-slate-500 mt-1">
                      {isFreeTrial ? 'Luego $3,490 MXN/mes' : 'Facturación mensual'}
                    </p>
                  </div>
                  <div className="text-right">
                    {isFreeTrial ? (
                      <>
                        <span className="text-2xl font-bold text-green-600">$0</span>
                        <p className="text-xs text-slate-500 line-through">
                          ${plan.monthlyPricePesos.toLocaleString('es-MX')}
                        </p>
                      </>
                    ) : (
                      <span className="text-xl font-bold text-slate-900">
                        ${plan.monthlyPricePesos.toLocaleString('es-MX')} MXN
                      </span>
                    )}
                  </div>
                </div>

                {/* Extra branches */}
                {extraBranches > 0 && !isFreeTrial && (
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="text-slate-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-tis-coral" />
                      {extraBranches} sucursal(es) extra
                    </span>
                    <span className="font-semibold text-slate-900">
                      ${branchCost.toLocaleString('es-MX')} MXN/mes
                    </span>
                  </div>
                )}

                {/* Total mensual */}
                <div className="border-t-2 border-slate-200 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-slate-900">
                      {isFreeTrial ? 'Hoy pagas' : 'Total Mensual'}
                    </span>
                    <div className="text-right">
                      <span className={`text-3xl font-bold ${isFreeTrial ? 'text-green-600' : 'text-tis-coral'}`}>
                        {isFreeTrial ? '$0' : `$${monthlyTotal.toLocaleString('es-MX')}`}
                      </span>
                      {!isFreeTrial && (
                        <p className="text-sm text-slate-500">MXN/mes</p>
                      )}
                    </div>
                  </div>

                  {isFreeTrial && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 font-medium">
                        ✓ Sin tarjeta de crédito requerida
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Después de 10 días: $3,490/mes (puedes cancelar en cualquier momento)
                      </p>
                    </div>
                  )}

                  {!isFreeTrial && (
                    <p className="text-sm text-slate-500 mt-2">
                      Suscripción mensual - puedes cancelar cuando quieras
                    </p>
                  )}
                </div>
              </div>

              {/* Features List */}
              <div className="bg-gradient-to-br from-slate-50 to-white border-2 border-slate-100 rounded-xl p-6 shadow-inner">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Lo que obtienes:
                </h3>
                <ul className="space-y-3">
                  {plan.features.slice(0, 6).map((feature, index) => (
                    <motion.li
                      key={index}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 * index }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                      <span className="text-sm text-slate-700 font-medium">{feature}</span>
                    </motion.li>
                  ))}
                  {branches > 1 && (
                    <motion.li
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-5 h-5 rounded-full bg-tis-coral/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-tis-coral" />
                      </div>
                      <span className="text-sm text-slate-700 font-medium">
                        Soporte para {branches} sucursales
                      </span>
                    </motion.li>
                  )}
                </ul>
              </div>
            </Card>
          </motion.div>

          {/* Payment Info */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="p-8 shadow-xl rounded-2xl border-slate-200">
              <h2 className="text-2xl font-bold mb-6 text-slate-900 flex items-center gap-2">
                {isFreeTrial ? (
                  <>
                    <Gift className="w-6 h-6 text-green-600" />
                    Información de Registro
                  </>
                ) : (
                  <>
                    <CreditCard className="w-6 h-6 text-tis-coral" />
                    Información de Pago
                  </>
                )}
              </h2>

              {!isFreeTrial && (
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-900">Pago 100% Seguro</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Procesado por Stripe - Encriptación SSL de grado bancario
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isFreeTrial && (
                <div className="bg-green-50 border-l-4 border-green-500 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <Gift className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-900">Sin Riesgo - Sin Tarjeta</p>
                      <p className="text-sm text-green-700 mt-1">
                        Comienza gratis hoy. Decide después si quieres continuar.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-tis-coral transition-all duration-200 text-slate-900 placeholder:text-slate-400"
                  required
                />
              </div>

              {/* Name Field */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-tis-coral transition-all duration-200 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Phone Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+52 123 456 7890"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-tis-coral transition-all duration-200 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* CTA Section */}
              <div className="text-center">
                {!isFreeTrial && (
                  <>
                    <CreditCard className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-6 text-sm">
                      Serás redirigido a Stripe para completar el pago de forma segura
                    </p>
                  </>
                )}

                <Button
                  size="xl"
                  variant="primary"
                  className={`w-full shadow-lg hover:shadow-xl transition-all duration-300 ${
                    isFreeTrial
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                      : ''
                  }`}
                  onClick={handleCheckout}
                  loading={loading}
                  disabled={loading || !customerEmail}
                >
                  {loading ? (
                    isFreeTrial ? 'Activando prueba gratuita...' : 'Redirigiendo a Stripe...'
                  ) : (
                    <>
                      {isFreeTrial ? 'Comenzar Prueba Gratuita' : 'Proceder al Pago Seguro'}
                      {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
                    </>
                  )}
                </Button>

                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  Al continuar, aceptas nuestros{' '}
                  <a href="/terms" className="underline hover:text-slate-700 transition-colors">
                    términos de servicio
                  </a>
                  {' '}y{' '}
                  <a href="/privacy" className="underline hover:text-slate-700 transition-colors">
                    política de privacidad
                  </a>
                </p>
              </div>

              {/* Payment Methods */}
              {!isFreeTrial && (
                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t-2 border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Aceptamos:</span>
                  <div className="flex items-center gap-2">
                    <div className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                      <span className="text-xs font-bold text-blue-600">VISA</span>
                    </div>
                    <div className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                      <span className="text-xs font-bold text-red-500">Mastercard</span>
                    </div>
                    <div className="bg-white border-2 border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                      <span className="text-xs font-bold text-blue-400">Amex</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Back to pricing link */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-slate-600">
            ¿Quieres cambiar de plan?{' '}
            <button
              onClick={() => router.push('/pricing')}
              className="text-tis-coral hover:text-tis-coral/80 font-semibold underline transition-colors"
            >
              Volver a precios
            </button>
          </p>
        </motion.div>
      </Container>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-tis-pink/5 py-12 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-tis-coral border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Cargando checkout...</p>
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
