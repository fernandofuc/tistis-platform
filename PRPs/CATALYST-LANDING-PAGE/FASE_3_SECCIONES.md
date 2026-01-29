# FASE 3: Secciones de la Pagina
## TIS TIS Catalyst Landing Page

---

## Objetivo

Crear todos los componentes visuales de la pagina con contenido real basado en el documento de Catalyst.

**Duracion estimada:** 30-45 minutos
**Dependencias:** FASE 1 y FASE 2 completadas

---

## Vista General de Secciones

```
┌─────────────────────────────────────┐
│ 3.1 HERO SECTION                    │  <- Badge "Proximamente" + Titulo impactante
├─────────────────────────────────────┤
│ 3.2 VIDEO SCROLL (FASE 2)           │  <- Video cinematografico
├─────────────────────────────────────┤
│ 3.3 QUE ES CATALYST                 │  <- Explicacion clara
├─────────────────────────────────────┤
│ 3.4 COMO FUNCIONA (5 pasos)         │  <- Timeline visual
├─────────────────────────────────────┤
│ 3.5 BENEFICIOS                      │  <- 3 columnas por actor
├─────────────────────────────────────┤
│ 3.6 CASO DE USO                     │  <- Ejemplo restaurante
├─────────────────────────────────────┤
│ 3.7 CTA PROXIMAMENTE                │  <- Registro de interes
└─────────────────────────────────────┘
```

---

## Microfase 3.1: Hero Section

### Archivo a Crear

`/app/(marketing)/catalyst/components/HeroSection.tsx`

### Contenido y Copy

```
BADGE: "Proximamente 2027"
TITULO: "Capital sin bancos."
SUBTITULO: "Expande tu negocio. Sin hipotecas. Sin ceder propiedad."
DESCRIPCION: Tokeniza tus proyectos de expansion y accede a inversionistas que confian en tus datos reales verificados por TIS TIS.
```

### Codigo Completo

```tsx
// =====================================================
// Hero Section - Catalyst Landing Page
// Estilo Apple con gradientes y animaciones
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowDown } from 'lucide-react';

export default function HeroSection() {
  const scrollToVideo = () => {
    document.getElementById('video-section')?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />

      {/* Decorative circles */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-tis-coral/10 rounded-full blur-3xl" />
      <div className="absolute top-40 right-10 w-96 h-96 bg-tis-purple/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-tis-green/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tis-coral/10 to-tis-purple/10 rounded-full border border-tis-coral/20">
            <Sparkles className="w-4 h-4 text-tis-coral" />
            <span className="text-sm font-semibold text-tis-coral">
              Proximamente 2027
            </span>
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6"
        >
          Capital{' '}
          <span className="bg-gradient-coral bg-clip-text text-transparent">
            sin bancos.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl sm:text-2xl lg:text-3xl font-medium text-slate-700 mb-6"
        >
          Expande tu negocio. Sin hipotecas. Sin ceder propiedad.
        </motion.p>

        {/* Description */}
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Tokeniza tus proyectos de expansion y accede a inversionistas
          que confian en tus{' '}
          <span className="text-tis-coral font-semibold">datos reales</span>{' '}
          verificados por TIS TIS.
        </motion.p>

        {/* Value Props */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-6 mb-16"
        >
          {[
            'Sin garantias personales',
            'Mantiene 100% propiedad',
            'Datos verificados por IA',
          ].map((prop, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 bg-tis-green rounded-full" />
              <span className="text-sm font-medium text-slate-600">{prop}</span>
            </div>
          ))}
        </motion.div>

        {/* Scroll Indicator */}
        <motion.button
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          onClick={scrollToVideo}
          className="group flex flex-col items-center gap-2 mx-auto"
        >
          <span className="text-sm text-slate-500 group-hover:text-tis-coral transition-colors">
            Descubre como funciona
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <ArrowDown className="w-6 h-6 text-slate-400 group-hover:text-tis-coral transition-colors" />
          </motion.div>
        </motion.button>
      </div>
    </section>
  );
}
```

---

## Microfase 3.2: What Is Section

### Archivo a Crear

`/app/(marketing)/catalyst/components/WhatIsSection.tsx`

### Contenido y Copy

```
TITULO: "Que es TIS TIS Catalyst?"
DESCRIPCION: Una plataforma que permite a negocios establecidos levantar capital
             para proyectos de expansion sin recurrir a bancos ni ceder equity.

CARDS (3):
1. NO es un prestamo bancario
   - Sin garantias personales
   - Sin hipotecar tu casa
   - Sin avales familiares

2. NO es vender tu empresa
   - Mantienes 100% de propiedad
   - Solo compartes ingresos del PROYECTO
   - Tu empresa sigue siendo tuya

3. SI es participacion en ingresos
   - Los inversionistas reciben parte de los ingresos del proyecto
   - Por tiempo limitado (24-36 meses)
   - Revenue Participation Agreement legal
```

### Codigo Completo

```tsx
// =====================================================
// What Is Section - Explicacion clara de Catalyst
// Cards con NO/SI para diferenciacion
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { XCircle, CheckCircle, Building2, Users, TrendingUp } from 'lucide-react';

const cards = [
  {
    type: 'no',
    icon: Building2,
    title: 'NO es un prestamo bancario',
    items: [
      'Sin garantias personales',
      'Sin hipotecar tu casa',
      'Sin avales familiares',
    ],
  },
  {
    type: 'no',
    icon: Users,
    title: 'NO es vender tu empresa',
    items: [
      'Mantienes 100% de propiedad',
      'Solo compartes ingresos del PROYECTO',
      'Tu empresa sigue siendo tuya',
    ],
  },
  {
    type: 'si',
    icon: TrendingUp,
    title: 'SI es participacion en ingresos',
    items: [
      'Inversionistas reciben parte de ingresos',
      'Por tiempo limitado (24-36 meses)',
      'Revenue Participation Agreement legal',
    ],
  },
];

export default function WhatIsSection() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Que es{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">
              TIS TIS Catalyst
            </span>
            ?
          </h2>
          <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Una plataforma que permite a negocios establecidos levantar capital
            para proyectos de expansion sin recurrir a bancos ni ceder equity
            de su empresa.
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative p-6 lg:p-8 rounded-2xl border-2 ${
                card.type === 'si'
                  ? 'bg-gradient-to-br from-tis-coral/5 to-tis-pink/5 border-tis-coral/30'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              {/* Badge */}
              <div
                className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold ${
                  card.type === 'si'
                    ? 'bg-tis-coral text-white'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {card.type === 'si' ? 'SI' : 'NO'}
              </div>

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  card.type === 'si'
                    ? 'bg-tis-coral/10 text-tis-coral'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <card.icon className="w-6 h-6" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                {card.title}
              </h3>

              {/* Items */}
              <ul className="space-y-3">
                {card.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2">
                    {card.type === 'si' ? (
                      <CheckCircle className="w-5 h-5 text-tis-coral mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="text-sm text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Microfase 3.3: How It Works Section (5 Pasos)

### Archivo a Crear

`/app/(marketing)/catalyst/components/HowItWorksSection.tsx`

### Contenido (5 Pasos)

```
PASO 1: NEGOCIO CALIFICA
- Minimo 24 meses usando TIS TIS
- Ingresos >= $500,000 MXN/mes
- Margen operativo positivo
- Proyecto especifico definido

PASO 2: TIS TIS CERTIFICA
- Auditoria de datos historicos
- Verificacion de metricas reales
- Score de confiabilidad
- Reporte publico para inversionistas

PASO 3: EMISION DE TOKENS
- Ejemplo: 100 tokens x $10,000 = $1M
- Cada token = % de ingresos del proyecto
- Plazo definido (24-36 meses)
- NO es equity, NO es deuda

PASO 4: INVERSIONISTAS COMPRAN
- Ven datos verificados
- Compran segun apetito de riesgo
- Pagos mensuales proporcionales

PASO 5: DISTRIBUCION AUTOMATICA
- TIS TIS registra ingresos en tiempo real
- Calculo automatico de distribuciones
- Reportes transparentes
```

### Codigo Completo

```tsx
// =====================================================
// How It Works Section - 5 Pasos del proceso
// Timeline visual con animaciones
// =====================================================

'use client';

import { motion } from 'framer-motion';
import {
  BadgeCheck,
  ShieldCheck,
  Coins,
  Users,
  RefreshCw,
} from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: BadgeCheck,
    title: 'Negocio Califica',
    description: 'Tu negocio cumple con los requisitos minimos',
    items: [
      'Minimo 24 meses usando TIS TIS',
      'Ingresos >= $500,000 MXN/mes',
      'Margen operativo positivo 12 meses',
      'Proyecto especifico definido',
    ],
    color: 'tis-coral',
    gradient: 'from-tis-coral to-tis-pink',
  },
  {
    number: '02',
    icon: ShieldCheck,
    title: 'TIS TIS Certifica',
    description: 'Validamos tu historial con datos reales',
    items: [
      'Auditoria de datos historicos',
      'Verificacion de metricas reales',
      'Score de confiabilidad (0-100)',
      'Reporte publico para inversionistas',
    ],
    color: 'tis-purple',
    gradient: 'from-tis-purple to-indigo-600',
  },
  {
    number: '03',
    icon: Coins,
    title: 'Emision de Tokens',
    description: 'Creas tokens que representan tu proyecto',
    items: [
      'Ejemplo: 100 tokens x $10,000 = $1M',
      'Cada token = % de ingresos del proyecto',
      'Plazo definido (24-36 meses)',
      'NO es equity, NO es deuda',
    ],
    color: 'amber',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    number: '04',
    icon: Users,
    title: 'Inversionistas Compran',
    description: 'Inversionistas locales adquieren tokens',
    items: [
      'Ven datos verificados por TIS TIS',
      'Compran segun apetito de riesgo',
      'Reciben pagos mensuales',
    ],
    color: 'tis-green',
    gradient: 'from-emerald-500 to-tis-green',
  },
  {
    number: '05',
    icon: RefreshCw,
    title: 'Distribucion Automatica',
    description: 'Los retornos se distribuyen sin intermediarios',
    items: [
      'TIS TIS registra ingresos en tiempo real',
      'Calculo automatico de distribuciones',
      'Reportes transparentes para todos',
    ],
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Como{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">
              funciona
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Un proceso simple y transparente en 5 pasos
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              {/* Connection Line */}
              {index < steps.length - 1 && (
                <div className="absolute left-[39px] top-[80px] w-0.5 h-[calc(100%-40px)] bg-slate-200 hidden lg:block" />
              )}

              <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                {/* Number Badge */}
                <div className="flex-shrink-0">
                  <div
                    className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center text-white font-bold text-2xl shadow-lg`}
                  >
                    {step.number}
                  </div>
                </div>

                {/* Content Card */}
                <div className="flex-1 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-slate-100">
                      <step.icon className="w-6 h-6 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {step.title}
                      </h3>
                      <p className="text-slate-600">{step.description}</p>
                    </div>
                  </div>

                  <ul className="grid sm:grid-cols-2 gap-3 mt-4">
                    {step.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${step.gradient}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Microfase 3.4: Benefits Section

### Archivo a Crear

`/app/(marketing)/catalyst/components/BenefitsSection.tsx`

### Codigo Completo

```tsx
// =====================================================
// Benefits Section - Beneficios por actor
// 3 columnas: Negocio, Inversionistas, TIS TIS
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { Building2, Users, Brain } from 'lucide-react';

const benefits = [
  {
    icon: Building2,
    title: 'Para tu Negocio',
    gradient: 'from-tis-coral to-tis-pink',
    items: [
      'Acceso a capital sin bancos',
      'Sin garantias personales',
      'Sin ceder propiedad',
      'Crece a tu ritmo',
    ],
  },
  {
    icon: Users,
    title: 'Para Inversionistas',
    gradient: 'from-tis-purple to-indigo-600',
    items: [
      'Invertir en negocios locales',
      'Datos verificados por IA',
      'Retornos mensuales',
      'Diversificacion accesible',
    ],
  },
  {
    icon: Brain,
    title: 'Con TIS TIS',
    gradient: 'from-emerald-500 to-tis-green',
    items: [
      'Certificacion basada en datos',
      'Infraestructura tecnologica',
      'Reportes transparentes',
      'Proceso legal simplificado',
    ],
  },
];

export default function BenefitsSection() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Todos{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">
              ganan
            </span>
          </h2>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0, scale: 0.95 }}
              whileInView={{ y: 0, opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl"
                   style={{ background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))` }} />

              <div className="relative bg-slate-50 rounded-2xl p-8 border border-slate-100 group-hover:border-slate-200 transition-all">
                {/* Icon */}
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center text-white mb-6 shadow-lg`}
                >
                  <benefit.icon className="w-7 h-7" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  {benefit.title}
                </h3>

                {/* Items */}
                <ul className="space-y-3">
                  {benefit.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="flex items-center gap-3 text-slate-600"
                    >
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${benefit.gradient}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Microfase 3.5: Use Case Section

### Archivo a Crear

`/app/(marketing)/catalyst/components/UseCaseSection.tsx`

### Codigo Completo

```tsx
// =====================================================
// Use Case Section - Ejemplo del restaurante
// Historia visual con numeros destacados
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { Store, TrendingUp, Users, Banknote } from 'lucide-react';

const stats = [
  { label: 'Ingresos mensuales', value: '$800K', suffix: 'MXN' },
  { label: 'Capital levantado', value: '$1.2M', suffix: 'MXN' },
  { label: 'Score TIS TIS', value: '87', suffix: '/100' },
  { label: 'ROI inversionistas', value: '~20%', suffix: '2.5 años' },
];

const timeline = [
  {
    icon: Store,
    title: 'Situacion',
    description: 'Restaurante con 3 años en TIS TIS quiere abrir segunda sucursal. Bancos piden hipoteca de su casa.',
  },
  {
    icon: TrendingUp,
    title: 'Tokenizacion',
    description: 'Emite 120 tokens de $10,000 MXN. Ofrece 8% de ingresos de sucursal 2 por 30 meses.',
  },
  {
    icon: Users,
    title: 'Inversion',
    description: 'Inversionistas locales compran los 120 tokens. El restaurante abre sin deuda bancaria.',
  },
  {
    icon: Banknote,
    title: 'Resultado',
    description: 'Sucursal genera $600K/mes. Cada token recibe $400/mes = $12,000 en 30 meses. Dueño mantiene 100% propiedad.',
  },
];

export default function UseCaseSection() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm font-medium text-white/80 mb-6">
            <Store className="w-4 h-4" />
            Caso Real
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Restaurante{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">
              La Parrilla del Norte
            </span>
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Como un restaurante exitoso expandio sin bancos ni perder propiedad
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16"
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 text-center border border-white/10"
            >
              <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-tis-coral font-medium mb-1">
                {stat.suffix}
              </div>
              <div className="text-xs text-white/60">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Timeline */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {timeline.map((item, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              {/* Connection line (desktop) */}
              {index < timeline.length - 1 && (
                <div className="absolute top-10 left-[calc(100%+12px)] w-6 h-0.5 bg-gradient-coral hidden lg:block" />
              )}

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-coral flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center text-xs text-white/40 mt-12 max-w-2xl mx-auto"
        >
          * Ejemplo ilustrativo basado en casos de uso proyectados.
          Los resultados reales pueden variar. TIS TIS no garantiza rendimientos.
        </p>
      </div>
    </section>
  );
}
```

---

## Microfase 3.6: Coming Soon CTA

### Archivo a Crear

`/app/(marketing)/catalyst/components/ComingSoonCTA.tsx`

### Codigo Completo

```tsx
// =====================================================
// Coming Soon CTA - Registro de interes
// Estilo premium con gradiente
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { Bell, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function ComingSoonCTA() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.98 }}
          whileInView={{ y: 0, opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12 lg:p-16 text-center"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-tis-coral/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-tis-purple/20 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative z-10">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex justify-center mb-8"
            >
              <div className="relative">
                <Image
                  src="/logos/tis-brain-logo.png"
                  alt="TIS TIS"
                  width={80}
                  height={80}
                  className="opacity-90"
                />
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="w-6 h-6 text-tis-coral" />
                </div>
              </div>
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-tis-coral/20 rounded-full text-tis-coral font-semibold text-sm">
                <Bell className="w-4 h-4" />
                Proximamente 2027
              </span>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4"
            >
              Se el primero en saber
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-lg text-white/70 max-w-xl mx-auto mb-8"
            >
              Estamos preparando algo increible. Registrate para ser de los primeros
              en acceder a TIS TIS Catalyst cuando este disponible.
            </motion.p>

            {/* Email Form (Disabled/Visual) */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="max-w-md mx-auto"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="tu@email.com"
                  disabled
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-tis-coral/50 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  disabled
                  className="px-6 py-3 bg-gradient-coral text-white font-semibold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  Notificarme
                </button>
              </div>
              <p className="text-xs text-white/40 mt-3">
                El registro de interes estara disponible pronto
              </p>
            </motion.div>
          </div>

          {/* Bottom gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-tis-coral via-tis-purple to-tis-green" />
        </motion.div>
      </div>
    </section>
  );
}
```

---

## Microfase 3.7: Pagina Principal Completa

### Archivo a Modificar

`/app/(marketing)/catalyst/page.tsx`

### Codigo Completo Final

```tsx
// =====================================================
// TIS TIS Catalyst - Landing Page
// Plataforma de tokenizacion para expansion de negocios
// PROXIMAMENTE 2027
// =====================================================

'use client';

import HeroSection from './components/HeroSection';
import VideoScrollPlayer from './components/VideoScrollPlayer';
import WhatIsSection from './components/WhatIsSection';
import HowItWorksSection from './components/HowItWorksSection';
import BenefitsSection from './components/BenefitsSection';
import UseCaseSection from './components/UseCaseSection';
import ComingSoonCTA from './components/ComingSoonCTA';

export default function CatalystPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <HeroSection />

      {/* Video Scroll Section */}
      <div id="video-section">
        <VideoScrollPlayer showProgress />
      </div>

      {/* What is Catalyst */}
      <WhatIsSection />

      {/* How it Works - 5 Steps */}
      <HowItWorksSection />

      {/* Benefits */}
      <BenefitsSection />

      {/* Use Case - Restaurant Example */}
      <UseCaseSection />

      {/* Coming Soon CTA */}
      <ComingSoonCTA />
    </div>
  );
}
```

---

## Verificacion de FASE 3

### Checklist

- [ ] `HeroSection.tsx` creado con badge "Proximamente"
- [ ] `WhatIsSection.tsx` creado con 3 cards NO/SI
- [ ] `HowItWorksSection.tsx` creado con 5 pasos
- [ ] `BenefitsSection.tsx` creado con 3 columnas
- [ ] `UseCaseSection.tsx` creado con ejemplo restaurante
- [ ] `ComingSoonCTA.tsx` creado con form visual
- [ ] `page.tsx` integra todos los componentes
- [ ] Navegacion fluida entre secciones
- [ ] Scroll al video funciona desde Hero

### Archivos Creados

| Archivo | Lineas Aprox |
|---------|-------------|
| `HeroSection.tsx` | ~130 |
| `WhatIsSection.tsx` | ~120 |
| `HowItWorksSection.tsx` | ~180 |
| `BenefitsSection.tsx` | ~100 |
| `UseCaseSection.tsx` | ~150 |
| `ComingSoonCTA.tsx` | ~130 |
| `page.tsx` (final) | ~35 |

**Total:** ~845 lineas de codigo

---

**FASE 3 COMPLETADA - Continuar con FASE 4: Animaciones y Polish**
