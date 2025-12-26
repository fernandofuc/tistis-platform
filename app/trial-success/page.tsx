'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Gift, Calendar, Sparkles, ArrowRight, Mail, Download } from 'lucide-react';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

function TrialSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [daysRemaining, setDaysRemaining] = useState(10);

  useEffect(() => {
    const days = searchParams.get('daysRemaining');
    if (days) {
      setDaysRemaining(parseInt(days, 10) || 10);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 py-12">
      <Container className="max-w-4xl">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.1
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
            ¡Prueba Gratuita Activada!
          </h1>
          <p className="text-xl text-slate-700 max-w-2xl mx-auto leading-relaxed">
            Tu período de prueba de <span className="font-bold text-green-600">{daysRemaining} días</span> ha comenzado.
            Explora todas las funcionalidades de TIS TIS sin compromiso.
          </p>
        </motion.div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Trial Duration */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="p-6 text-center border-2 border-green-100 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{daysRemaining} Días Gratis</h3>
              <p className="text-sm text-slate-600">
                Acceso completo sin tarjeta de crédito
              </p>
            </Card>
          </motion.div>

          {/* No Payment */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="p-6 text-center border-2 border-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Sin Cargos</h3>
              <p className="text-sm text-slate-600">
                No se te cobrará nada durante el trial
              </p>
            </Card>
          </motion.div>

          {/* Full Features */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="p-6 text-center border-2 border-teal-100 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Todo Incluido</h3>
              <p className="text-sm text-slate-600">
                Acceso a todas las funcionalidades premium
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
          <Card className="p-8 shadow-xl border-2 border-slate-100">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 flex items-center gap-2">
              <ArrowRight className="w-6 h-6 text-tis-coral" />
              Próximos Pasos
            </h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-2">Revisa tu correo electrónico</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Te enviamos un email con las credenciales de acceso y una guía de inicio rápido.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-2">Configura tu cuenta</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Personaliza TIS TIS según las necesidades de tu negocio. Configura tu vertical, sucursales y preferencias.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-2">Comienza a automatizar</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Conecta tus herramientas actuales, importa tus datos y empieza a disfrutar de la automatización.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                variant="primary"
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => router.push('/dashboard')}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Ir a Mi Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="flex-1 border-2 border-slate-300 hover:bg-slate-50"
                onClick={() => window.open('https://docs.tistis.com', '_blank')}
              >
                <Download className="w-5 h-5 mr-2" />
                Ver Guía de Inicio
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Additional Info */}
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
                Nuestro equipo de soporte está listo para ayudarte. Contáctanos en{' '}
                <a href="mailto:soporte@tistis.com" className="underline font-medium">
                  soporte@tistis.com
                </a>
                {' '}o por WhatsApp al{' '}
                <a href="https://wa.me/5215512345678" className="underline font-medium">
                  +52 55 1234 5678
                </a>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Reminder about trial end */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-slate-500 leading-relaxed">
            Después de {daysRemaining} días, tu plan será automáticamente convertido a{' '}
            <span className="font-semibold text-slate-700">$3,490 MXN/mes</span>.
            <br />
            Puedes cancelar en cualquier momento sin cargos desde tu panel de configuración.
          </p>
        </motion.div>
      </Container>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 py-12 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Cargando...</p>
      </div>
    </div>
  );
}

export default function TrialSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TrialSuccessContent />
    </Suspense>
  );
}
