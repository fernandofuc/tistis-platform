'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Lock,
  CheckCircle,
  AlertCircle,
  Building2,
  Check,
  Zap,
  Sparkles,
  Shield,
  Loader2,
  Mail,
} from 'lucide-react';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  PLAN_CONFIG,
  getPlanConfig,
  calculateBranchCostPesos,
} from '@/src/shared/config/plans';
import { supabase } from '@/src/shared/lib/supabase';

// ============================================================
// CONSTANTES
// ============================================================

// Currently active verticals (must match VALID_VERTICALS in APIs)
// More verticals will be added: clinic, gym, beauty, veterinary
const VERTICALS_DISPLAY: Record<string, { name: string; icon: string }> = {
  dental: { name: 'Clínica Dental', icon: '🦷' },
  restaurant: { name: 'Restaurante', icon: '🍽️' },
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="w-5 h-5" />,
  essentials: <Sparkles className="w-5 h-5" />,
  growth: <Building2 className="w-5 h-5" />,
};

// Validación de email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ============================================================
// OAUTH ICONS
// ============================================================

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// Auth mode type
type AuthMode = 'oauth' | 'email';

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estados
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState('essentials');
  const [branches, setBranches] = useState(1);
  const [vertical, setVertical] = useState<string | null>(null); // Start as null to detect missing vertical
  const [verticalMissing, setVerticalMissing] = useState(false);

  // Form fields
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isOAuthUser, setIsOAuthUser] = useState(false);

  // OAuth states
  const [authMode, setAuthMode] = useState<AuthMode>('oauth');
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);

  // Field errors
  const [emailError, setEmailError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();

  const cancelled = searchParams.get('cancelled');

  // Cargar datos de sessionStorage y detectar usuario OAuth
  useEffect(() => {
    const urlPlan = searchParams.get('plan');
    const savedPlan = urlPlan || sessionStorage.getItem('selected_plan') || 'essentials';
    setPlanId(savedPlan);

    const savedBranches = sessionStorage.getItem('pricing_branches');
    if (savedBranches) {
      setBranches(parseInt(savedBranches, 10) || 1);
    }

    // CRITICAL: Check for vertical in sessionStorage
    // Also check URL params as backup (for page refresh scenarios)
    const urlVertical = searchParams.get('vertical');
    const savedVertical = sessionStorage.getItem('selected_vertical');
    const finalVertical = urlVertical || savedVertical;

    if (finalVertical) {
      setVertical(finalVertical);
      setVerticalMissing(false);
    } else {
      // No vertical found - this is a critical error
      // User must go back to pricing to select their business type
      setVerticalMissing(true);
      console.error('🚨 [Checkout] No vertical found in sessionStorage or URL');
    }

    // Check for OAuth user email (set by pricing page after OAuth redirect)
    const oauthEmail = sessionStorage.getItem('oauth_user_email');
    if (oauthEmail) {
      setCustomerEmail(oauthEmail);
      setIsOAuthUser(true);
      // Extract name from email as a starting point (only if name is empty)
      const namePart = oauthEmail.split('@')[0].replace(/[._]/g, ' ');
      const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      setCustomerName(prev => prev || capitalizedName);
    }

    // Cargar datos del cuestionario si existen
    const savedAnswers = sessionStorage.getItem('questionnaire_answers');
    if (savedAnswers) {
      try {
        const answers = JSON.parse(savedAnswers);
        if (answers.contact_info) {
          if (!oauthEmail) {
            setCustomerEmail(answers.contact_info.email || '');
          }
          if (answers.contact_info.name) {
            setCustomerName(answers.contact_info.name);
          }
          if (answers.contact_info.phone) {
            setCustomerPhone(answers.contact_info.phone);
          }
        }
      } catch (e) {
        console.error('Error parsing questionnaire answers:', e);
      }
    }
  }, [searchParams]); // Removed customerName to prevent infinite loop

  // Datos del plan
  const plan = getPlanConfig(planId) || PLAN_CONFIG.essentials;
  const extraBranches = Math.max(0, branches - 1);
  const branchCost = calculateBranchCostPesos(planId, branches);
  const monthlyTotal = plan.monthlyPricePesos + branchCost;

  // Determinar si es trial gratuito
  const isFreeTrial = planId === 'starter';
  const verticalInfo = vertical ? VERTICALS_DISPLAY[vertical] : VERTICALS_DISPLAY.dental;

  // ============================================================
  // OAUTH HANDLERS
  // ============================================================

  /**
   * Guarda el contexto del checkout en sessionStorage antes de OAuth
   * Para que el callback pueda continuar el proceso
   */
  const saveCheckoutContext = () => {
    sessionStorage.setItem('checkout_pending', 'true');
    sessionStorage.setItem('checkout_plan', planId);
    sessionStorage.setItem('checkout_vertical', vertical || '');
    sessionStorage.setItem('checkout_branches', String(branches));
    sessionStorage.setItem('checkout_name', customerName);
    sessionStorage.setItem('checkout_phone', customerPhone);
    console.log('[Checkout] Saved checkout context for OAuth redirect');
  };

  /**
   * Handler genérico para OAuth (Google/GitHub)
   */
  const handleOAuthProvider = async (provider: 'google' | 'github') => {
    // Validar que tengamos vertical antes de OAuth
    if (!vertical || verticalMissing) {
      setError('Por favor selecciona tu tipo de negocio antes de continuar.');
      return;
    }

    setOauthLoading(provider);
    setError(null);

    try {
      console.log(`[Checkout] Initiating ${provider} OAuth for checkout...`);

      // Guardar contexto del checkout
      saveCheckoutContext();

      // Configurar OAuth
      const providerOptions = provider === 'google'
        ? {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
            skipBrowserRedirect: false,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          }
        : {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
            skipBrowserRedirect: false,
          };

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: providerOptions,
      });

      if (oauthError) {
        console.error(`[Checkout] ${provider} OAuth error:`, oauthError);
        setError(oauthError.message || `Error al conectar con ${provider === 'google' ? 'Google' : 'GitHub'}`);
        setOauthLoading(null);
        // Limpiar contexto de checkout en caso de error
        sessionStorage.removeItem('checkout_pending');
        return;
      }

      console.log(`[Checkout] Redirecting to ${provider}...`, { url: data?.url });
      // El redirect sucede automáticamente

    } catch (err: unknown) {
      console.error(`[Checkout] ${provider} OAuth exception:`, err);
      setError(err instanceof Error ? err.message : 'Error de conexión');
      setOauthLoading(null);
      // Limpiar contexto de checkout en caso de error
      sessionStorage.removeItem('checkout_pending');
    }
  };

  const handleGoogleAuth = () => handleOAuthProvider('google');
  const handleGitHubAuth = () => handleOAuthProvider('github');

  const isAnyLoading = loading || oauthLoading !== null;

  // Validar email en blur
  const handleEmailBlur = () => {
    if (customerEmail && !isValidEmail(customerEmail)) {
      setEmailError('Por favor ingresa un email válido');
    } else {
      setEmailError(undefined);
    }
  };

  // Manejar checkout
  const handleCheckout = async () => {
    // CRITICAL: Check vertical before proceeding
    if (!vertical || verticalMissing) {
      setError('No se detectó el tipo de negocio. Por favor vuelve a la página de precios y selecciona tu vertical.');
      return;
    }

    // Validación
    let hasErrors = false;

    if (!customerEmail) {
      setEmailError('El email es requerido');
      hasErrors = true;
    } else if (!isValidEmail(customerEmail)) {
      setEmailError('Por favor ingresa un email válido');
      hasErrors = true;
    } else {
      setEmailError(undefined);
    }

    if (!customerName || customerName.trim().length < 2) {
      setNameError('El nombre es requerido');
      hasErrors = true;
    } else {
      setNameError(undefined);
    }

    if (hasErrors) return;

    setLoading(true);
    setError(null);

    try {
      if (isFreeTrial) {
        // FLUJO TRIAL: Redirigir a Stripe Setup para guardar tarjeta (sin cobrar)
        const response = await fetch('/api/stripe/setup-trial-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerEmail,
            customerName,
            customerPhone,
            vertical,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.code === 'EMAIL_ALREADY_EXISTS') {
            setEmailError('Este email ya esta registrado. Inicia sesion o usa otro email.');
            setLoading(false);
            return;
          }
          throw new Error(data.error || 'Error al configurar la prueba gratuita');
        }

        // Check if customer already has a valid payment method
        // In this case, we redirect directly to activate the trial
        if (data.hasExistingCard) {
          console.log('[Checkout] Customer already has card, redirecting to login...');
          // Redirect to login since they already have an account
          window.location.href = '/login?message=Ya tienes una cuenta. Por favor inicia sesion.';
          return;
        }

        // Redirigir a Stripe Checkout (modo setup)
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No se recibio URL de configuracion');
        }
      } else {
        // FLUJO PAGO: Stripe checkout
        const response = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: planId,
            customerEmail,
            customerName,
            customerPhone,
            branches,
            addons: [],
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
      setError(err.message || 'Error al procesar');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <Container className="max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            {isFreeTrial ? (
              <>
                Comienza tu{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">
                  prueba gratuita
                </span>
              </>
            ) : (
              <>
                Estás a un paso de{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-tis-coral to-tis-pink">
                  automatizar
                </span>
              </>
            )}
          </h1>
          <p className="text-lg text-slate-600">
            {isFreeTrial
              ? '10 dias gratis. Se cobra automaticamente al finalizar si no cancelas.'
              : 'Completa tus datos para continuar con el pago seguro.'
            }
          </p>
        </motion.div>

        {/* CRITICAL: Block checkout if vertical is missing */}
        {verticalMissing && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6 p-6 bg-red-50 border border-red-200 rounded-xl"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 mb-2">
                  Falta información importante
                </h3>
                <p className="text-red-700 mb-4">
                  No detectamos el tipo de negocio seleccionado. Esto puede ocurrir si:
                </p>
                <ul className="text-red-700 text-sm mb-4 list-disc list-inside space-y-1">
                  <li>Refrescaste la página</li>
                  <li>Usas navegación privada</li>
                  <li>Llegaste directamente a esta página sin pasar por precios</li>
                </ul>
                <Button
                  variant="primary"
                  onClick={() => router.push('/pricing')}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Ir a Seleccionar Plan
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Alertas */}
        {cancelled && !verticalMissing && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-yellow-800">
              El pago fue cancelado. Puedes intentar de nuevo cuando quieras.
            </p>
          </motion.div>
        )}

        {error && !verticalMissing && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </motion.div>
        )}

        {/* Grid principal - only show if vertical is present */}
        {!verticalMissing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* COLUMNA IZQUIERDA: Resumen del pedido */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="relative overflow-visible">
              {/* Badge */}
              {isFreeTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-4 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-full shadow-lg whitespace-nowrap">
                    🎉 Prueba Gratis 10 Días
                  </span>
                </div>
              )}

              <CardHeader className="pt-6">
                <CardTitle className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFreeTrial ? 'bg-green-100 text-green-600' : 'bg-tis-coral/10 text-tis-coral'}`}>
                    {PLAN_ICONS[planId] || <Zap className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="text-xl">Plan {plan.name}</span>
                    <p className="text-sm font-normal text-slate-500 mt-0.5">
                      {verticalInfo.icon} {verticalInfo.name}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent>
                {/* Precio */}
                <div className="p-4 bg-slate-50 rounded-xl mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-slate-500">
                        {isFreeTrial ? 'Hoy pagas' : 'Total mensual'}
                      </p>
                      {isFreeTrial && (
                        <p className="text-xs text-slate-400 mt-1">
                          Después: ${plan.monthlyPricePesos.toLocaleString('es-MX')}/mes
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {isFreeTrial ? (
                        <>
                          <span className="text-3xl font-bold text-green-600">$0</span>
                          <p className="text-sm text-slate-400 line-through">
                            ${plan.monthlyPricePesos.toLocaleString('es-MX')}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-slate-900">
                            ${monthlyTotal.toLocaleString('es-MX')}
                          </span>
                          <p className="text-sm text-slate-500">MXN/mes</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sucursales extra */}
                  {extraBranches > 0 && !isFreeTrial && (
                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {extraBranches} sucursal(es) extra
                      </span>
                      <span className="text-slate-700 font-medium">
                        +${branchCost.toLocaleString('es-MX')}/mes
                      </span>
                    </div>
                  )}
                </div>

                {/* Nota de trial */}
                {isFreeTrial && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-6">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-green-800 font-medium">10 dias gratis, luego se cobra automaticamente</p>
                        <p className="text-green-700 text-xs mt-0.5">
                          Puedes cancelar en cualquier momento sin cargos
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Features */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Lo que incluye:
                  </h4>
                  <ul className="space-y-2.5">
                    {plan.features.slice(0, 5).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isFreeTrial ? 'bg-green-100' : 'bg-tis-coral/10'}`}>
                          <Check className={`w-3 h-3 ${isFreeTrial ? 'text-green-600' : 'text-tis-coral'}`} />
                        </div>
                        <span className="text-sm text-slate-600">{feature}</span>
                      </li>
                    ))}
                    {branches > 1 && (
                      <li className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-tis-coral/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-tis-coral" />
                        </div>
                        <span className="text-sm text-slate-600">
                          Soporte para {branches} sucursales
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* COLUMNA DERECHA: Formulario */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isFreeTrial ? (
                    <>
                      <Zap className="w-5 h-5 text-green-600" />
                      Crea tu cuenta gratis
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 text-tis-coral" />
                      Información de pago
                    </>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Info de seguridad para pago */}
                {!isFreeTrial && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600" />
                      <div className="text-sm">
                        <span className="text-blue-800 font-medium">Pago 100% seguro</span>
                        <span className="text-blue-700"> · Procesado por Stripe</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================ */}
                {/* OAUTH BUTTONS - Mostrar solo si no es usuario OAuth existente */}
                {/* ============================================================ */}
                {!isOAuthUser && authMode === 'oauth' && (
                  <>
                    {/* Google Button */}
                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={isAnyLoading}
                      aria-label="Continuar con Google"
                      aria-busy={oauthLoading === 'google'}
                      className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {oauthLoading === 'google' ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" aria-hidden="true" />
                      ) : (
                        <GoogleIcon />
                      )}
                      <span className="text-[15px] font-medium text-gray-900">
                        Continuar con Google
                      </span>
                    </button>

                    {/* GitHub Button */}
                    <button
                      type="button"
                      onClick={handleGitHubAuth}
                      disabled={isAnyLoading}
                      aria-label="Continuar con GitHub"
                      aria-busy={oauthLoading === 'github'}
                      className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {oauthLoading === 'github' ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" aria-hidden="true" />
                      ) : (
                        <GitHubIcon className="text-gray-900" />
                      )}
                      <span className="text-[15px] font-medium text-gray-900">
                        Continuar con GitHub
                      </span>
                    </button>

                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-4 text-[13px] font-medium text-gray-400">
                          O
                        </span>
                      </div>
                    </div>

                    {/* Switch to Email Button */}
                    <button
                      type="button"
                      onClick={() => setAuthMode('email')}
                      disabled={isAnyLoading}
                      className="w-full h-12 flex items-center justify-center gap-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-[15px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mail className="w-5 h-5" aria-hidden="true" />
                      Continuar con email
                    </button>
                  </>
                )}

                {/* ============================================================ */}
                {/* EMAIL FORM - Mostrar si es modo email o usuario OAuth existente */}
                {/* ============================================================ */}
                {(authMode === 'email' || isOAuthUser) && (
                  <>
                    {/* Back to OAuth options (solo si no es usuario OAuth) */}
                    {!isOAuthUser && (
                      <button
                        type="button"
                        onClick={() => setAuthMode('oauth')}
                        disabled={isAnyLoading}
                        className="mb-2 text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
                      >
                        <ArrowRight className="w-4 h-4 rotate-180" aria-hidden="true" />
                        Otras opciones de registro
                      </button>
                    )}

                    {/* Email */}
                    <div className="relative">
                      <Input
                        label="Correo electrónico"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => {
                          if (!isOAuthUser) {
                            setCustomerEmail(e.target.value);
                            if (emailError) setEmailError(undefined);
                          }
                        }}
                        onBlur={handleEmailBlur}
                        placeholder="tu@email.com"
                        error={emailError}
                        required
                        disabled={isOAuthUser || isAnyLoading}
                        className={isOAuthUser ? 'bg-green-50 border-green-200' : ''}
                      />
                      {isOAuthUser && (
                        <div className="absolute right-3 top-9 flex items-center gap-1.5 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Verificado</span>
                        </div>
                      )}
                    </div>

                    {/* Nombre */}
                    <Input
                      label="Nombre completo"
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (nameError) setNameError(undefined);
                      }}
                      placeholder="Tu nombre"
                      error={nameError}
                      required
                      disabled={isAnyLoading}
                    />

                    {/* Teléfono */}
                    <Input
                      label="Teléfono (opcional)"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+52 123 456 7890"
                      helperText="Te contactaremos para ayudarte en tu setup"
                      disabled={isAnyLoading}
                    />

                    {/* CTA Button */}
                    <div className="pt-2">
                      <Button
                        size="xl"
                        variant="primary"
                        className={`w-full ${isFreeTrial ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' : ''}`}
                        onClick={handleCheckout}
                        loading={loading}
                        disabled={isAnyLoading || !customerEmail || !customerName}
                      >
                        {loading ? (
                          isFreeTrial ? 'Activando...' : 'Redirigiendo...'
                        ) : (
                          <>
                            {isFreeTrial ? 'Comenzar Prueba Gratuita' : 'Continuar al Pago'}
                            <ArrowRight className="ml-2 w-5 h-5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}

                {/* Términos */}
                <p className="text-xs text-slate-500 text-center leading-relaxed">
                  Al continuar, aceptas nuestros{' '}
                  <a href="/terms" className="underline hover:text-slate-700">
                    términos de servicio
                  </a>
                  {' '}y{' '}
                  <a href="/privacy" className="underline hover:text-slate-700">
                    política de privacidad
                  </a>
                </p>

                {/* Métodos de pago (solo para pago y modo email) */}
                {!isFreeTrial && (authMode === 'email' || isOAuthUser) && (
                  <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
                    <span className="text-xs text-slate-400">Aceptamos:</span>
                    <div className="flex gap-2">
                      {['VISA', 'Mastercard', 'Amex'].map((card) => (
                        <div key={card} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-600">
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
        )}

        {/* Footer link */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-slate-500">
            ¿Quieres cambiar de plan?{' '}
            <button
              onClick={() => router.push('/pricing')}
              className="text-tis-coral hover:underline font-medium"
            >
              Volver a precios
            </button>
          </p>
        </motion.div>
      </Container>
    </div>
  );
}

// ============================================================
// LOADING FALLBACK
// ============================================================

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-tis-coral border-t-transparent mx-auto mb-4" />
        <p className="text-slate-600">Cargando...</p>
      </div>
    </div>
  );
}

// ============================================================
// EXPORT
// ============================================================

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckoutContent />
    </Suspense>
  );
}
