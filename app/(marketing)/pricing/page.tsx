'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Check,
  Minus,
  Plus,
  ArrowRight,
  Building2,
  Sparkles,
  MessageSquare,
  Clock,
  Users,
  Zap,
  Shield,
  Phone,
} from 'lucide-react';
import { PLAN_CONFIG, getPlanConfig, calculateBranchCostPesos, getNextBranchPrice, canAddBranch } from '@/src/shared/config/plans';

// ============================================================
// TIPOS Y CONSTANTES
// ============================================================

interface PlanDisplay {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  features: string[];
  highlighted?: boolean;
  branchLimit: number;
  conversationsLabel: string;
  supportLevel: string;
  icon: React.ReactNode;
}

// Planes simplificados para display (sin add-ons, créditos, referidos)
const PLANS_DISPLAY: PlanDisplay[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Para negocios que inician su automatizacion',
    monthlyPrice: 3490,
    branchLimit: 1,
    conversationsLabel: '500 conversaciones/mes',
    supportLevel: 'Email',
    icon: <Zap className="w-6 h-6" />,
    features: [
      'Asistente IA 24/7 en WhatsApp',
      'Hasta 500 conversaciones/mes',
      'Dashboard basico',
      'Soporte por email',
      '1 sucursal incluida',
    ],
  },
  {
    id: 'essentials',
    name: 'Essentials',
    description: 'La opcion mas popular para crecer',
    monthlyPrice: 7490,
    branchLimit: 5,
    conversationsLabel: '2,000 conversaciones/mes',
    supportLevel: 'Prioritario',
    highlighted: true,
    icon: <Sparkles className="w-6 h-6" />,
    features: [
      'Todo lo de Starter',
      'Hasta 2,000 conversaciones/mes',
      'Integracion con sistemas existentes',
      'Soporte prioritario',
      'Call de configuracion 30 min',
      'Hasta 5 sucursales',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Para operaciones en expansion',
    monthlyPrice: 12490,
    branchLimit: 8,
    conversationsLabel: 'Conversaciones ilimitadas',
    supportLevel: '24/7',
    icon: <Building2 className="w-6 h-6" />,
    features: [
      'Todo lo de Essentials',
      'Conversaciones ilimitadas',
      'Multi-canal (WhatsApp, Web, Email)',
      'Soporte 24/7',
      'IA multi-sucursal',
      'Hasta 8 sucursales',
    ],
  },
];

// Header y Footer vienen del layout de (marketing)

// ============================================================
// COMPONENTE: Plan Card
// ============================================================

function PlanCard({
  plan,
  isSelected,
  onSelect,
  branches,
  onBranchChange,
}: {
  plan: PlanDisplay;
  isSelected: boolean;
  onSelect: () => void;
  branches: number;
  onBranchChange: (delta: number) => void;
}) {
  const canAdd = canAddBranch(plan.id, branches);
  const canRemove = branches > 1;
  const branchCost = calculateBranchCostPesos(plan.id, branches);
  const nextBranchPrice = getNextBranchPrice(plan.id, branches);
  const totalPrice = plan.monthlyPrice + branchCost;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      onClick={onSelect}
      className={`
        relative rounded-2xl p-6 cursor-pointer transition-all duration-300
        ${isSelected
          ? 'bg-white ring-2 ring-tis-coral shadow-xl scale-[1.02]'
          : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-lg'
        }
        ${plan.highlighted && !isSelected ? 'border-tis-coral/30' : ''}
      `}
    >
      {/* Badge "Popular" */}
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 bg-gradient-to-r from-tis-coral to-tis-pink text-white text-xs font-semibold rounded-full">
            Mas Popular
          </span>
        </div>
      )}

      {/* Header del plan */}
      <div className="mb-6">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center mb-4
          ${isSelected ? 'bg-tis-coral text-white' : 'bg-slate-100 text-slate-600'}
        `}>
          {plan.icon}
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-1">{plan.name}</h3>
        <p className="text-sm text-slate-500">{plan.description}</p>
      </div>

      {/* Precio */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-slate-800">
            ${totalPrice.toLocaleString()}
          </span>
          <span className="text-slate-400">/mes</span>
        </div>
        {branchCost > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            Incluye {branches} sucursales (+${branchCost.toLocaleString()}/mes)
          </p>
        )}
      </div>

      {/* Selector de sucursales */}
      {plan.branchLimit > 1 && isSelected && (
        <div className="mb-6 p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Sucursales</span>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onBranchChange(-1); }}
                disabled={!canRemove}
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${canRemove
                    ? 'bg-white border border-slate-200 text-slate-600 hover:border-tis-coral hover:text-tis-coral'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }
                `}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-lg font-bold text-slate-800 w-8 text-center">{branches}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onBranchChange(1); }}
                disabled={!canAdd}
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${canAdd
                    ? 'bg-white border border-slate-200 text-slate-600 hover:border-tis-coral hover:text-tis-coral'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }
                `}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {canAdd && nextBranchPrice > 0 && (
            <p className="text-xs text-slate-400">
              Siguiente sucursal: +${nextBranchPrice.toLocaleString()}/mes
            </p>
          )}
        </div>
      )}

      {/* Features */}
      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className={`
              w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
              ${isSelected ? 'bg-tis-coral/10 text-tis-coral' : 'bg-slate-100 text-slate-400'}
            `}>
              <Check className="w-3 h-3" />
            </div>
            <span className="text-sm text-slate-600">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Indicador de selección */}
      <div className={`
        w-full py-3 rounded-xl text-center font-medium transition-all
        ${isSelected
          ? 'bg-tis-coral text-white'
          : 'bg-slate-100 text-slate-600'
        }
      `}>
        {isSelected ? 'Seleccionado' : 'Seleccionar plan'}
      </div>
    </motion.div>
  );
}

// ============================================================
// COMPONENTE: Software Personalizado Card
// ============================================================

function CustomSoftwareCard() {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <span className="px-3 py-1 bg-white/10 text-xs font-medium rounded-full">
                Enterprise
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-2">Software Personalizado</h3>
            <p className="text-slate-300 max-w-lg">
              Para negocios con necesidades especificas que requieren una solucion a la medida.
              Incluye integraciones personalizadas, equipo dedicado y soporte premium.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-4">
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Equipo dedicado
              </span>
              <span className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                SLA 2 horas
              </span>
            </div>
            <Link
              href="/enterprise"
              className="px-6 py-3 bg-white text-slate-800 font-semibold rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-2"
            >
              Solicitar cotizacion
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// COMPONENTE: Resumen de Inversión
// ============================================================

function InvestmentSummary({
  selectedPlan,
  branches,
  onCheckout,
}: {
  selectedPlan: PlanDisplay | null;
  branches: number;
  onCheckout: () => void;
}) {
  if (!selectedPlan) return null;

  const branchCost = calculateBranchCostPesos(selectedPlan.id, branches);
  const totalPrice = selectedPlan.monthlyPrice + branchCost;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-40"
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Info del plan */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-slate-500">Plan seleccionado</p>
              <p className="text-lg font-semibold text-slate-800">
                {selectedPlan.name}
                {branches > 1 && ` (${branches} sucursales)`}
              </p>
            </div>
            <div className="hidden md:block h-10 w-px bg-slate-200" />
            <div className="hidden md:block">
              <p className="text-sm text-slate-500">Total mensual</p>
              <p className="text-2xl font-bold text-tis-coral">
                ${totalPrice.toLocaleString()}
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onCheckout}
            className="px-8 py-3 bg-tis-coral text-white font-semibold rounded-xl hover:bg-tis-pink transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <span>Continuar</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// COMPONENTE: Pricing Content (con useSearchParams)
// ============================================================

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [branches, setBranches] = useState(1);

  // Cargar plan recomendado desde URL o sessionStorage
  useEffect(() => {
    const urlPlan = searchParams.get('plan');
    const storedAnalysis = sessionStorage.getItem('discovery_analysis');

    if (urlPlan && PLANS_DISPLAY.find(p => p.id === urlPlan)) {
      setSelectedPlanId(urlPlan);
    } else if (storedAnalysis) {
      try {
        const analysis = JSON.parse(storedAnalysis);
        if (analysis.recommended_plan && PLANS_DISPLAY.find(p => p.id === analysis.recommended_plan)) {
          setSelectedPlanId(analysis.recommended_plan);
        }
      } catch {
        // Default to essentials
        setSelectedPlanId('essentials');
      }
    }
  }, [searchParams]);

  const selectedPlan = PLANS_DISPLAY.find(p => p.id === selectedPlanId) || null;

  // Cambiar sucursales
  const handleBranchChange = (delta: number) => {
    if (!selectedPlanId) return;
    const planConfig = getPlanConfig(selectedPlanId);
    if (!planConfig) return;

    const newBranches = branches + delta;
    if (newBranches >= 1 && newBranches <= planConfig.branchLimit) {
      setBranches(newBranches);
    }
  };

  // Seleccionar plan
  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    // Reset branches cuando cambia el plan
    setBranches(1);
  };

  // Ir a checkout
  const handleCheckout = () => {
    if (!selectedPlanId) return;

    // Guardar en sessionStorage
    sessionStorage.setItem('selected_plan', selectedPlanId);
    sessionStorage.setItem('pricing_branches', branches.toString());
    sessionStorage.setItem('pricing_addons', JSON.stringify([])); // Sin add-ons

    router.push(`/checkout?plan=${selectedPlanId}`);
  };

  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 bg-tis-coral/10 text-tis-coral text-sm font-medium rounded-full mb-6">
              Precios simples y transparentes
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
              Elige el plan perfecto para tu negocio
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
              Automatiza tu operacion y recupera horas cada semana.
              Sin contratos a largo plazo, cancela cuando quieras.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="px-6 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS_DISPLAY.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedPlanId === plan.id}
                onSelect={() => handleSelectPlan(plan.id)}
                branches={selectedPlanId === plan.id ? branches : 1}
                onBranchChange={handleBranchChange}
              />
            ))}
          </div>

          {/* Software Personalizado */}
          <CustomSoftwareCard />
        </div>
      </section>

      {/* Trust Section */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Atencion 24/7</h3>
              <p className="text-sm text-slate-500">
                Tu asistente nunca duerme. Atiende clientes a cualquier hora.
              </p>
            </div>
            <div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Implementacion rapida</h3>
              <p className="text-sm text-slate-500">
                Configuracion completa en menos de 48 horas.
              </p>
            </div>
            <div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Sin compromiso</h3>
              <p className="text-sm text-slate-500">
                Cancela cuando quieras. Sin penalizaciones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Preguntas frecuentes
          </h2>
          <p className="text-slate-500 mb-8">
            Tienes dudas? Estamos aqui para ayudarte.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-tis-coral font-medium hover:underline"
          >
            Contactar al equipo
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Spacer para el summary fijo */}
      {selectedPlan && <div className="h-24" />}

      {/* Investment Summary */}
      <InvestmentSummary
        selectedPlan={selectedPlan}
        branches={branches}
        onCheckout={handleCheckout}
      />
    </>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL: Pricing Page
// ============================================================

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={
        <div className="pt-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral" />
        </div>
      }>
        <PricingContent />
      </Suspense>
    </div>
  );
}
