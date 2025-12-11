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
import { supabase } from '@/lib/auth';

// Datos de planes - PRECIOS ACTUALIZADOS 2025
// NOTA: Estos precios DEBEN coincidir con checkout/page.tsx y Stripe
const PLANS = {
  starter: {
    name: 'Starter',
    price: 3490,
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
    price: 7490,
    features: [
      'Todo lo de Starter',
      'Hasta 2,000 conversaciones/mes',
      'Integración con sistemas existentes',
      'Automatización de procesos básicos',
      'Soporte prioritario',
      'Call de configuración en 30 min'
    ]
  },
  growth: {
    name: 'Growth',
    price: 12490,
    features: [
      'Todo lo de Essentials',
      'Conversaciones ilimitadas',
      'Automatizaciones complejas personalizadas',
      'Multi-canal (WhatsApp, Web, Email)',
      'Analytics avanzado',
      'Soporte 24/7',
      'Call de configuración en 30 min'
    ]
  },
  scale: {
    name: 'Scale',
    price: 19990,
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
    const loadData = async () => {
      // First try to get from sessionStorage
      const savedAnswers = sessionStorage.getItem('questionnaire_answers');
      const sessionToken = sessionStorage.getItem('discovery_session_token');

      if (!savedAnswers) {
        router.push('/discovery');
        return;
      }

      setAnswers(JSON.parse(savedAnswers));

      // Try to get analysis from database if we have a session token
      if (sessionToken) {
        try {
          const { data: session, error } = await supabase
            .from('discovery_sessions')
            .select('ai_analysis')
            .eq('session_token', sessionToken)
            .single();

          if (!error && session?.ai_analysis) {
            setAnalysis(session.ai_analysis as AIAnalysis);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error fetching session:', e);
        }
      }

      // Fallback to sessionStorage
      const savedAnalysis = sessionStorage.getItem('ai_analysis');
      if (savedAnalysis) {
        setAnalysis(JSON.parse(savedAnalysis));
        setLoading(false);
      } else {
        // Generate default analysis based on answers
        const parsedAnswers = JSON.parse(savedAnswers);
        const defaultAnalysis: AIAnalysis = {
          business_type: parsedAnswers.business_type || 'restaurante',
          primary_pain: 'Ineficiencias operativas generales',
          financial_impact: 15000,
          time_impact: 20,
          urgency_score: 7,
          recommended_plan: 'essentials',
          recommended_addons: [],
          recommended_especialidad: parsedAnswers.business_type || null,
          reasoning: 'Plan recomendado basado en el tamaño y necesidades de tu negocio.'
        };
        setAnalysis(defaultAnalysis);
        setLoading(false);
      }
    };

    loadData();
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

  const handleCheckout = async () => {
    // Guardar plan seleccionado en sessionStorage
    sessionStorage.setItem('selected_plan', analysis.recommended_plan);
    sessionStorage.setItem('total_price', plan.price.toString());

    // Save proposal to database
    const sessionToken = sessionStorage.getItem('discovery_session_token');

    try {
      // Get or create session ID
      let sessionId = null;
      if (sessionToken) {
        const { data: session } = await supabase
          .from('discovery_sessions')
          .select('id')
          .eq('session_token', sessionToken)
          .single();
        sessionId = session?.id;
      }

      // Create proposal in database
      const { data: proposal, error } = await supabase
        .from('proposals')
        .insert({
          session_id: sessionId,
          recommended_plan: analysis.recommended_plan,
          recommended_addons: analysis.recommended_addons,
          financial_analysis: {
            monthly_savings: monthlySavings,
            hours_recovered: hoursRecovered,
            payback_months: paybackMonths,
            financial_impact: analysis.financial_impact,
            time_impact: analysis.time_impact,
          },
          pricing_snapshot: {
            plan_name: plan.name,
            monthly_price: plan.price,
            setup_fee: 0, // Ya no cobramos fee de activación
            features: plan.features,
          },
          reasoning: analysis.reasoning,
          status: 'generated',
        })
        .select('id')
        .single();

      if (!error && proposal) {
        sessionStorage.setItem('proposal_id', proposal.id);
        console.log('💾 Proposal saved:', proposal.id);
      }
    } catch (e) {
      console.error('Error saving proposal:', e);
    }

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
              Sin costo de activación · Cancela cuando quieras
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
