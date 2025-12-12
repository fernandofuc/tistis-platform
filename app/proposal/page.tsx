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

type PlanType = 'starter' | 'essentials' | 'growth' | 'scale';

// Helper: Determine recommended plan based on answers
function getRecommendedPlan(answers: QuestionnaireAnswers): PlanType {
  const employees = parseInt(answers.employees_count || '1');
  const locations = parseInt(answers.locations || '1');

  if (locations > 3 || employees > 50) return 'scale';
  if (locations > 1 || employees > 15) return 'growth';
  if (employees > 5) return 'essentials';
  return 'starter';
}

// Helper: Generate reasoning text
function generateReasoning(answers: QuestionnaireAnswers): string {
  const plan = getRecommendedPlan(answers);
  const planNames: Record<PlanType, string> = {
    starter: 'Starter',
    essentials: 'Essentials',
    growth: 'Growth',
    scale: 'Scale'
  };
  return `El plan ${planNames[plan]} es ideal para tu negocio de ${answers.business_type || 'servicios'} con ${answers.employees_count || '1-5'} empleados. Te permitirá automatizar la atención al cliente y optimizar tus operaciones desde el primer día.`;
}

// Datos de planes - PRECIOS ACTUALIZADOS 2025
// NOTA: Estos precios DEBEN coincidir con checkout/page.tsx y Stripe
const PLANS = {
  starter: {
    name: 'Starter',
    price: 3490,
    branchExtra: 1500,
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
    branchExtra: 1500,
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
    branchExtra: 1500,
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
    branchExtra: 1500,
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
      try {
        // First try to get from sessionStorage
        const savedAnswers = sessionStorage.getItem('questionnaire_answers');

        if (!savedAnswers) {
          router.push('/discovery');
          return;
        }

        const parsedAnswers = JSON.parse(savedAnswers);
        setAnswers(parsedAnswers);

        // Try to get analysis from sessionStorage first (fastest)
        const savedAnalysis = sessionStorage.getItem('ai_analysis');
        if (savedAnalysis) {
          setAnalysis(JSON.parse(savedAnalysis));
          setLoading(false);
          return;
        }

        // Try database only if we have session token
        const sessionToken = sessionStorage.getItem('discovery_session_token');
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
            console.error('Error fetching session from DB:', e);
            // Continue to fallback
          }
        }

        // Fallback: Generate default analysis based on questionnaire answers
        console.log('📊 Generating default analysis from questionnaire...');
        const defaultAnalysis: AIAnalysis = {
          business_type: parsedAnswers.business_type || 'servicios',
          primary_pain: 'Ineficiencias operativas generales',
          financial_impact: 15000,
          time_impact: 20,
          urgency_score: 7,
          recommended_plan: getRecommendedPlan(parsedAnswers),
          recommended_addons: [],
          recommended_especialidad: parsedAnswers.business_type || null,
          reasoning: generateReasoning(parsedAnswers)
        };
        setAnalysis(defaultAnalysis);
        setLoading(false);

      } catch (error) {
        console.error('Error loading proposal data:', error);
        // Even on error, set a default analysis so page doesn't hang
        setAnalysis({
          business_type: 'servicios',
          primary_pain: 'Ineficiencias operativas',
          financial_impact: 15000,
          time_impact: 20,
          urgency_score: 7,
          recommended_plan: 'essentials',
          recommended_addons: [],
          recommended_especialidad: null,
          reasoning: 'Plan recomendado basado en tus necesidades.'
        });
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

  // Calcular número de sucursales (ahora viene como número exacto)
  const branches = parseInt(answers.locations || '1');
  const extraBranches = Math.max(0, branches - 1);
  const branchCost = extraBranches * plan.branchExtra;
  const totalMonthly = plan.price + branchCost;

  // Calcular ROI (ejemplos basados en análisis)
  const monthlySavings = analysis.financial_impact || 15000;
  const hoursRecovered = analysis.time_impact || 20;
  const paybackMonths = Math.ceil(totalMonthly / (monthlySavings * 0.3));

  const handleCheckout = async () => {
    // Guardar plan y sucursales en sessionStorage para el checkout
    sessionStorage.setItem('selected_plan', analysis.recommended_plan);
    sessionStorage.setItem('pricing_branches', branches.toString());
    sessionStorage.setItem('total_price', totalMonthly.toString());

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

        {/* CTA Principal - MOVIDO ARRIBA DEL TIMELINE */}
        <section className="mb-12">
          <Card className="p-8 bg-gradient-coral text-white text-center">
            <h3 className="text-3xl font-bold mb-4">
              Implementa tu Cerebro Digital Hoy
            </h3>

            {/* Desglose de precio con sucursales */}
            <div className="mb-6">
              <div className="text-lg opacity-90 mb-2">
                Plan {plan.name}: ${plan.price.toLocaleString('es-MX')} MXN/mes
              </div>
              {extraBranches > 0 && (
                <div className="text-lg opacity-90 mb-2">
                  + {extraBranches} sucursal(es) extra: ${branchCost.toLocaleString('es-MX')} MXN/mes
                </div>
              )}
              <div className="text-5xl font-extrabold mt-4">
                ${totalMonthly.toLocaleString('es-MX')} MXN
                <span className="text-lg font-normal opacity-90 ml-2">/mes</span>
              </div>
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

        {/* Próximos Pasos - MOVIDO DESPUÉS DEL CTA */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Próximos Pasos</h2>
          <Timeline />
        </section>
      </Container>
    </div>
  );
}
