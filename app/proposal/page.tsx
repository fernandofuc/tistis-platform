'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, DollarSign, PhoneMissed } from 'lucide-react';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import PainPointCard from '@/components/proposal/PainPointCard';
import ROICalculator from '@/components/proposal/ROICalculator';
import Timeline from '@/components/proposal/Timeline';
import PlanCard from '@/components/proposal/PlanCard';
import { AIAnalysis, QuestionnaireAnswers } from '@/types';

// Datos de planes (hardcoded por ahora, vendrían de pricing)
const PLANS = {
  starter: {
    name: 'Starter',
    price: 5990,
    features: [
      'Asistente IA 24/7 en WhatsApp',
      'Hasta 500 conversaciones/mes',
      'Respuestas automáticas',
      'Dashboard básico',
      'Soporte por email'
    ]
  },
  essentials: {
    name: 'Essentials',
    price: 8990,
    features: [
      'Todo lo de Starter',
      'Hasta 2,000 conversaciones/mes',
      'Integración con sistemas existentes',
      'Automatización de procesos básicos',
      'Soporte prioritario',
      'Reportes semanales'
    ]
  },
  growth: {
    name: 'Growth',
    price: 14990,
    features: [
      'Todo lo de Essentials',
      'Conversaciones ilimitadas',
      'Automatizaciones complejas personalizadas',
      'Multi-canal (WhatsApp, Web, Email)',
      'Analytics avanzado',
      'Soporte 24/7',
      'Call mensual de optimización'
    ]
  },
  scale: {
    name: 'Scale',
    price: 24990,
    features: [
      'Todo lo de Growth',
      'Soporte multi-sucursal',
      'IA entrenada con tus datos',
      'Integraciones custom ilimitadas',
      'Equipo dedicado',
      'SLA garantizado',
      'Consultoría estratégica mensual'
    ]
  }
};

export default function ProposalPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [answers, setAnswers] = useState<QuestionnaireAnswers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar datos de sessionStorage
    const savedAnalysis = sessionStorage.getItem('ai_analysis');
    const savedAnswers = sessionStorage.getItem('questionnaire_answers');

    if (savedAnalysis && savedAnswers) {
      setAnalysis(JSON.parse(savedAnalysis));
      setAnswers(JSON.parse(savedAnswers));
      setLoading(false);
    } else {
      // Si no hay datos, redirigir a discovery
      router.push('/discovery');
    }
  }, [router]);

  if (loading || !analysis || !answers) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tis-coral mx-auto mb-4"></div>
          <p className="text-tis-text-muted">Generando tu propuesta personalizada...</p>
        </div>
      </div>
    );
  }

  const plan = PLANS[analysis.recommended_plan as keyof typeof PLANS] || PLANS.essentials;

  // Calcular ROI (ejemplos basados en análisis)
  const monthlySavings = analysis.financial_impact || 15000;
  const hoursRecovered = analysis.time_impact || 20;
  const paybackMonths = Math.ceil(plan.price / (monthlySavings * 0.3));

  const handleCheckout = () => {
    // Guardar plan seleccionado
    sessionStorage.setItem('selected_plan', analysis.recommended_plan);
    sessionStorage.setItem('total_price', plan.price.toString());
    router.push('/checkout');
  };

  return (
    <div className="min-h-screen bg-tis-bg-primary py-12">
      <Container className="max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <span className="text-sm font-medium text-tis-coral">
              Propuesta Personalizada
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Tu Cerebro Digital Personalizado
          </h1>
          <p className="text-xl text-tis-text-secondary">
            Para: {answers.contact_info?.name}
          </p>
        </div>

        {/* Análisis de Situación Actual */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Tu Situación Actual</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PainPointCard
              icon={Clock}
              title="Tiempo Perdido"
              value={`${hoursRecovered} hrs/sem`}
              description="Horas que podrías dedicar a crecer tu negocio"
            />
            <PainPointCard
              icon={DollarSign}
              title="Costo Estimado"
              value={`$${monthlySavings.toLocaleString('es-MX')}`}
              description="Pérdidas mensuales por ineficiencias"
            />
            <PainPointCard
              icon={PhoneMissed}
              title="Oportunidades Perdidas"
              value={answers.missed_calls || '15+'}
              description="Llamadas/mensajes perdidos por día"
            />
          </div>
        </section>

        {/* Plan Recomendado */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-3">Tu Plan Perfecto</h2>
            <p className="text-lg text-tis-text-secondary">
              Basado en tu negocio de tipo <strong>{analysis.business_type}</strong> con{' '}
              <strong>{answers.locations} ubicación(es)</strong> y{' '}
              <strong>{answers.employees_count} empleados</strong>
            </p>
          </div>

          <PlanCard
            planName={plan.name}
            price={plan.price}
            features={plan.features}
            highlighted
          />

          {/* Razón de Recomendación */}
          <Card className="mt-6 p-6 bg-gradient-to-br from-purple-50 to-white">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              ¿Por qué este plan?
            </h3>
            <p className="text-tis-text-secondary leading-relaxed">
              {analysis.reasoning || `El plan ${plan.name} es perfecto para tu negocio porque te permite escalar las automatizaciones conforme creces, con todas las integraciones necesarias para optimizar tus operaciones actuales.`}
            </p>
          </Card>
        </section>

        {/* ROI Projection */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Tu Retorno de Inversión</h2>
          <ROICalculator
            monthlySavings={monthlySavings}
            hoursRecovered={hoursRecovered}
            paybackMonths={paybackMonths}
          />
        </section>

        {/* Próximos Pasos */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Próximos Pasos</h2>
          <Timeline />
        </section>

        {/* CTA Principal */}
        <section className="mb-12">
          <Card className="p-8 bg-gradient-coral text-white text-center">
            <h3 className="text-3xl font-bold mb-4">
              Implementa tu Cerebro Digital Hoy
            </h3>
            <div className="text-5xl font-extrabold mb-6">
              ${plan.price.toLocaleString('es-MX')} MXN
              <span className="text-lg font-normal opacity-90 ml-2">/mes</span>
            </div>
            <p className="text-lg opacity-90 mb-8">
              + ${(plan.price * 0.5).toLocaleString('es-MX')} MXN de configuración inicial (solo una vez)
            </p>
            <Button
              size="xl"
              variant="white"
              onClick={handleCheckout}
              className="text-tis-coral hover:bg-gray-50"
            >
              Continuar al Pago
              <ArrowRight className="ml-2 w-6 h-6" />
            </Button>
            <p className="text-sm mt-6 opacity-90">
              💳 Pago seguro con Stripe · 🔒 Datos encriptados · 🚀 Acceso inmediato
            </p>
          </Card>
        </section>

        {/* FAQs */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            <Card className="p-6">
              <h4 className="font-semibold mb-2">¿Cuándo recibiré acceso?</h4>
              <p className="text-tis-text-secondary">
                Inmediatamente después del pago tendrás acceso a tu dashboard. El equipo te contactará en 30 minutos para la configuración personalizada.
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="font-semibold mb-2">¿Puedo cambiar de plan después?</h4>
              <p className="text-tis-text-secondary">
                Sí, puedes cambiar de plan en cualquier momento desde tu dashboard. Los cambios se aplican en el siguiente ciclo de facturación.
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="font-semibold mb-2">¿Hay contrato de permanencia?</h4>
              <p className="text-tis-text-secondary">
                No. Puedes cancelar cuando quieras. Solo te cobramos mes a mes.
              </p>
            </Card>
          </div>
        </section>
      </Container>
    </div>
  );
}
