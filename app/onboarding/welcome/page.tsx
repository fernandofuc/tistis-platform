'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Package,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface SetupStatus {
  ready: boolean;
  stage: 'initializing' | 'configuring' | 'deploying' | 'ready' | 'error';
  message: string;
  progress: number;
  planDetails?: {
    plan: string;
    planName: string;
    branches: number;
    vertical: string;
  };
}

const STAGE_MESSAGES: Record<string, { title: string; description: string }> = {
  initializing: {
    title: 'Inicializando tu sistema...',
    description: 'Estamos preparando tu espacio de trabajo personalizado'
  },
  configuring: {
    title: 'Configurando componentes...',
    description: 'Activando los módulos incluidos en tu plan'
  },
  deploying: {
    title: 'Desplegando tu dashboard...',
    description: 'Últimos ajustes para tu experiencia perfecta'
  },
  ready: {
    title: '¡Tu sistema está listo!',
    description: 'Todo configurado y funcionando perfectamente'
  },
  error: {
    title: 'Algo salió mal',
    description: 'No te preocupes, nuestro equipo ya está trabajando en ello'
  }
};

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Asistente IA 24/7 en WhatsApp',
    'Hasta 500 conversaciones/mes',
    'Dashboard básico',
    'Soporte por email'
  ],
  essentials: [
    'Asistente IA 24/7 en WhatsApp',
    'Hasta 2,000 conversaciones/mes',
    'Dashboard completo',
    'Integración con sistemas existentes',
    'Soporte prioritario'
  ],
  growth: [
    'Conversaciones ilimitadas',
    'Multi-canal (WhatsApp, Web, Email)',
    'Dashboard avanzado con analytics',
    'Automatizaciones personalizadas',
    'Soporte 24/7',
    'Hasta 20 sucursales'
  ]
};

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<SetupStatus>({
    ready: false,
    stage: 'initializing',
    message: 'Preparando tu sistema...',
    progress: 10
  });
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      // No session ID, redirect to home
      router.push('/');
      return;
    }

    // Start polling for setup status
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/onboarding/status?session_id=${sessionId}`);
        const data = await response.json();

        if (data.success) {
          setStatus(data.status);

          if (data.status.ready) {
            setShowConfetti(true);
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 2 seconds until ready
    const interval = setInterval(() => {
      if (!status.ready) {
        checkStatus();
      }
    }, 2000);

    // Simulate progress for better UX (backend might be fast)
    const progressInterval = setInterval(() => {
      setStatus(prev => {
        if (prev.ready || prev.progress >= 95) return prev;

        const newProgress = Math.min(prev.progress + Math.random() * 15, 95);
        let newStage = prev.stage;

        if (newProgress > 30 && newProgress <= 60) {
          newStage = 'configuring';
        } else if (newProgress > 60 && newProgress < 95) {
          newStage = 'deploying';
        }

        return {
          ...prev,
          progress: newProgress,
          stage: newStage
        };
      });
    }, 1500);

    // Timeout - after 30 seconds, assume ready (webhook might have completed)
    const timeout = setTimeout(() => {
      setStatus(prev => ({
        ...prev,
        ready: true,
        stage: 'ready',
        progress: 100
      }));
      setShowConfetti(true);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
      clearTimeout(timeout);
    };
  }, [sessionId, router, status.ready]);

  const stageInfo = STAGE_MESSAGES[status.stage];
  const features = status.planDetails?.plan
    ? PLAN_FEATURES[status.planDetails.plan] || PLAN_FEATURES.essentials
    : PLAN_FEATURES.essentials;

  return (
    <div className="min-h-screen bg-gradient-to-br from-tis-bg-primary via-white to-tis-coral/5 py-12">
      {/* Confetti effect when ready */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute top-0 left-1/4 animate-confetti-1">🎉</div>
          <div className="absolute top-0 left-1/2 animate-confetti-2">✨</div>
          <div className="absolute top-0 left-3/4 animate-confetti-3">🎊</div>
        </div>
      )}

      <Container className="max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-tis-coral to-tis-coral/80 rounded-full mb-6 shadow-lg">
            {status.ready ? (
              <CheckCircle className="w-10 h-10 text-white" />
            ) : (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {status.ready ? (
              <>¡Bienvenido a <span className="text-tis-coral">TIS TIS</span>!</>
            ) : (
              <>Preparando tu <span className="text-tis-coral">Cerebro Digital</span></>
            )}
          </h1>

          <p className="text-xl text-tis-text-secondary max-w-2xl mx-auto">
            {status.ready
              ? 'Tu sistema de IA está configurado y listo para automatizar tu negocio'
              : 'Estamos configurando todo para que puedas empezar de inmediato'
            }
          </p>
        </div>

        {/* Progress Card */}
        <Card className="p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-full ${status.ready ? 'bg-green-100' : 'bg-tis-coral/10'}`}>
              {status.ready ? (
                <Sparkles className="w-6 h-6 text-green-600" />
              ) : (
                <Zap className="w-6 h-6 text-tis-coral animate-pulse" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{stageInfo.title}</h2>
              <p className="text-tis-text-secondary">{stageInfo.description}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                status.ready ? 'bg-green-500' : 'bg-gradient-to-r from-tis-coral to-tis-coral/70'
              }`}
              style={{ width: `${status.ready ? 100 : status.progress}%` }}
            />
          </div>

          {/* Status steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2 text-center text-sm">
            {['Inicializando', 'Configurando', 'Desplegando', 'Listo'].map((step, index) => {
              const stepProgress = (index + 1) * 25;
              const isComplete = status.progress >= stepProgress || status.ready;
              const isCurrent = !status.ready && status.progress >= stepProgress - 25 && status.progress < stepProgress;

              return (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-tis-coral text-white animate-pulse'
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isComplete ? <CheckCircle className="w-5 h-5" /> : index + 1}
                  </div>
                  <span className={isComplete || isCurrent ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Plan Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* What's included */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-6 h-6 text-tis-coral" />
              <h3 className="text-lg font-bold">Lo que incluye tu plan</h3>
            </div>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-tis-text-secondary">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* What's next */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-tis-coral" />
              <h3 className="text-lg font-bold">Próximos pasos</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-tis-coral/10 text-tis-coral flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
                <span className="text-tis-text-secondary">Explora tu dashboard y familiarízate con las funciones</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-tis-coral/10 text-tis-coral flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
                <span className="text-tis-text-secondary">Conecta tu WhatsApp Business para activar el asistente</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-tis-coral/10 text-tis-coral flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
                <span className="text-tis-text-secondary">Personaliza las respuestas del asistente para tu negocio</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-3 mb-8 text-sm text-tis-text-muted">
          <Shield className="w-4 h-4" />
          <span>Tus datos están protegidos con encriptación de grado bancario</span>
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <Button
            size="xl"
            variant="primary"
            onClick={() => window.location.href = '/auth/login?onboarding=complete'}
            disabled={!status.ready}
            className={`min-w-[280px] transition-all ${
              status.ready
                ? 'animate-bounce-subtle shadow-lg shadow-tis-coral/30'
                : 'opacity-70 cursor-not-allowed'
            }`}
          >
            {status.ready ? (
              <>
                Acceder a mi Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            ) : (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Preparando...
              </>
            )}
          </Button>

          {status.ready && (
            <p className="mt-4 text-sm text-tis-text-muted">
              Usa tu cuenta de TIS TIS para acceder a tu nuevo dashboard
            </p>
          )}
        </div>
      </Container>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes confetti-1 {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confetti-2 {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(-720deg); opacity: 0; }
        }
        @keyframes confetti-3 {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        .animate-confetti-1 { animation: confetti-1 3s ease-out forwards; font-size: 2rem; }
        .animate-confetti-2 { animation: confetti-2 3.5s ease-out forwards; font-size: 2rem; animation-delay: 0.2s; }
        .animate-confetti-3 { animation: confetti-3 4s ease-out forwards; font-size: 2rem; animation-delay: 0.4s; }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite;
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-tis-bg-primary flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-tis-coral animate-spin mx-auto mb-4" />
        <p className="text-tis-text-secondary">Cargando...</p>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WelcomeContent />
    </Suspense>
  );
}
