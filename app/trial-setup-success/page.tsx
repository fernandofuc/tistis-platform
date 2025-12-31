'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  CreditCard,
  Calendar,
  Sparkles,
  ArrowRight,
  Mail,
  BookOpen,
  Zap,
  Shield,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PLAN_CONFIG, getPlanConfig } from '@/src/shared/config/plans';

// ============================================================
// CONSTANTES
// ============================================================

const VERTICALS_DISPLAY: Record<string, { name: string; icon: string }> = {
  dental: { name: 'Clinica Dental', icon: '🦷' },
  restaurant: { name: 'Restaurante', icon: '🍽️' },
};

const PLAN_ICON = <Zap className="w-5 h-5" />;

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

function TrialSetupSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(10);
  const [vertical, setVertical] = useState<string | null>(null);

  const plan = getPlanConfig('starter') || PLAN_CONFIG.starter;
  const verticalInfo = vertical ? VERTICALS_DISPLAY[vertical] : null;

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      setError('Sesion no encontrada. Por favor intenta de nuevo.');
      setLoading(false);
      return;
    }

    // Activate trial with the Stripe session
    activateTrial(sessionId);
  }, [searchParams]);

  const activateTrial = async (sessionId: string) => {
    try {
      console.log('[TrialSetupSuccess] Activating trial with session:', sessionId);

      // Call API to activate trial with card setup
      const response = await fetch('/api/subscriptions/activate-trial-with-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al activar la prueba');
      }

      console.log('[TrialSetupSuccess] Trial activated:', data);

      setDaysRemaining(data.daysRemaining || 10);
      setVertical(data.vertical || null);
      setLoading(false);

    } catch (err: any) {
      console.error('[TrialSetupSuccess] Error:', err);
      setError(err.message || 'Error al procesar tu solicitud');
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Configurando tu cuenta...
          </h2>
          <p className="text-slate-600">
            Estamos activando tu prueba gratuita. Esto tomara solo un momento.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <Container className="max-w-2xl">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Hubo un problema
            </h1>
            <p className="text-lg text-slate-600 mb-8">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="primary"
                onClick={() => router.push('/checkout?plan=starter')}
              >
                Intentar de nuevo
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push('/contact')}
              >
                Contactar soporte
              </Button>
            </div>
          </motion.div>
        </Container>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <Container className="max-w-4xl">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 20,
            delay: 0.1,
          }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 rounded-full"></div>
            <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-8 shadow-2xl">
              <CheckCircle className="w-24 h-24 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </motion.div>

        {/* Main Message */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
            ¡Todo listo!
          </h1>
          <p className="text-xl text-slate-700 max-w-2xl mx-auto leading-relaxed">
            Tu prueba gratuita de{' '}
            <span className="font-bold text-green-600">{daysRemaining} dias</span> ha
            comenzado y tu tarjeta esta guardada de forma segura.
          </p>
        </motion.div>

        {/* Plan y Vertical */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-8"
        >
          <Card className="border-2 border-green-100">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl">
                  <span className="text-green-600">{PLAN_ICON}</span>
                  <span className="font-semibold text-slate-900">
                    Plan {plan.displayName}
                  </span>
                </div>
                {verticalInfo && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl">
                    <span>{verticalInfo.icon}</span>
                    <span className="font-semibold text-slate-900">
                      {verticalInfo.name}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Trial Duration */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="p-6 text-center border-2 border-green-100 shadow-lg h-full">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{daysRemaining} Dias Gratis</h3>
              <p className="text-sm text-slate-600">
                Sin cargos durante tu periodo de prueba
              </p>
            </Card>
          </motion.div>

          {/* Card Saved */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="p-6 text-center border-2 border-emerald-100 shadow-lg h-full">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Tarjeta Guardada</h3>
              <p className="text-sm text-slate-600">
                Se cobrara automaticamente al terminar el trial
              </p>
            </Card>
          </motion.div>

          {/* Full Features */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="p-6 text-center border-2 border-teal-100 shadow-lg h-full">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Cancela Cuando Quieras</h3>
              <p className="text-sm text-slate-600">
                Si cancelas antes, no se te cobrara nada
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Next Steps */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card className="shadow-xl border-2 border-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="w-6 h-6 text-tis-coral" />
                Proximos Pasos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 mb-2">
                      Revisa tu correo electronico
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Te enviamos un email con las credenciales de acceso y una guia de
                      inicio rapido.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 mb-2">Configura tu cuenta</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Personaliza TIS TIS segun las necesidades de tu negocio.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 mb-2">
                      Comienza a automatizar
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Conecta tus herramientas y empieza a disfrutar de la automatizacion.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  variant="primary"
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
                  onClick={() => router.push('/dashboard')}
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Ir a Mi Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  className="flex-1 border-2 border-slate-300"
                  onClick={() => router.push('/como-funciona')}
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Ver Guia de Inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Help */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">¿Necesitas ayuda?</h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                Nuestro equipo de soporte esta listo para ayudarte en{' '}
                <a
                  href="mailto:soporte@tistis.com"
                  className="underline font-medium hover:text-blue-900"
                >
                  soporte@tistis.com
                </a>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Billing reminder */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-slate-500 leading-relaxed">
            Despues de {daysRemaining} dias, se cobrara automaticamente{' '}
            <span className="font-semibold text-slate-700">
              ${plan?.monthlyPricePesos.toLocaleString('es-MX') || '3,490'} MXN/mes
            </span>
            {' '}a tu tarjeta.
            <br />
            Puedes cancelar en cualquier momento desde tu{' '}
            <Link
              href="/dashboard/settings/subscription"
              className="text-tis-coral hover:underline font-medium"
            >
              panel de configuracion
            </Link>
            .
          </p>
        </motion.div>
      </Container>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Cargando...</p>
      </div>
    </div>
  );
}

export default function TrialSetupSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TrialSetupSuccessContent />
    </Suspense>
  );
}
