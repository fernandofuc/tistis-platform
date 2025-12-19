'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Clock, CheckCircle, ChevronRight, TrendingUp, Brain } from 'lucide-react';

// ============================================================
// TIPOS Y CONSTANTES
// ============================================================

const FEATURES = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'IA que Aprende',
    description: 'Se adapta a tu negocio y mejora con cada interaccion',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Activo en 48 Horas',
    description: 'De cero a automatizado en tiempo record',
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: 'Disponible 24/7',
    description: 'Atiende clientes mientras tu descansas',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Resultados Reales',
    description: 'Reduce costos operativos hasta un 70%',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Redujimos 70% del tiempo en gestion de citas. Ahora puedo enfocarme en mis pacientes.',
    author: 'Dr. Martinez',
    business: 'Clinica Dental Premier',
  },
  {
    quote: 'Las reservaciones se atienden solas, incluso a las 3am. Increible.',
    author: 'Sofia Ramirez',
    business: 'Restaurante La Hacienda',
  },
];

// Posiciones fijas para cerebros flotantes
const BRAIN_POSITIONS = [5, 15, 28, 42, 55, 68, 82, 92];

// ============================================================
// COMPONENTES
// ============================================================

function FloatingBrain({ delay, size = 32, index = 0 }: { delay: number; size?: number; index?: number }) {
  const leftPosition = BRAIN_POSITIONS[index % BRAIN_POSITIONS.length];

  return (
    <motion.div
      initial={{ y: -100, opacity: 0, rotate: -10 }}
      animate={{
        y: [0, 250, 500],
        opacity: [0, 0.6, 0.6, 0],
        rotate: [-10, 10, -10],
        x: [0, 20, -20, 0],
      }}
      transition={{
        duration: 15,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="absolute pointer-events-none"
      style={{
        left: `${leftPosition}%`,
        top: -100,
      }}
    >
      <Image
        src="/logos/tis-brain-logo.png"
        alt=""
        width={size}
        height={size}
        className="opacity-50"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
      />
    </motion.div>
  );
}

function HeroSection({ message, setMessage, placeholderText, onSubmit }: {
  message: string;
  setMessage: (m: string) => void;
  placeholderText: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <section className="relative pt-12 pb-20 px-6 overflow-hidden min-h-[70vh] flex items-center">
      {/* Cerebros flotantes de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <FloatingBrain key={i} index={i} delay={i * 2.5} size={28 + (i % 3) * 12} />
        ))}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center w-full">
        {/* Badge */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-tis-coral/10 text-tis-coral text-sm font-medium rounded-full mb-8">
            <Image
              src="/logos/tis-brain-logo.png"
              alt=""
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
            La revolucion de la IA ya esta aqui
          </span>
        </motion.div>

        {/* Headline Principal - Estilo Apple */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6"
        >
          Menos trabajo.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-tis-coral to-tis-pink">
            Mas vida.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl text-slate-600 max-w-2xl mx-auto mb-12"
        >
          Tu negocio en piloto automatico mientras te enfocas en lo importante: expandir, innovar, vivir.
        </motion.p>

        {/* Input Form con borde coral */}
        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onSubmit={onSubmit}
          className="max-w-2xl mx-auto mb-8"
        >
          <div className="bg-white rounded-2xl shadow-xl p-2 flex items-center border-2 border-tis-coral/40 focus-within:border-tis-coral focus-within:shadow-2xl focus-within:shadow-tis-coral/10 transition-all duration-300">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholderText}
              className="flex-1 px-4 py-4 text-base text-slate-700 placeholder:text-slate-500 focus:outline-none bg-transparent"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className={`
                p-4 rounded-xl transition-all duration-200 flex items-center gap-2
                ${message.trim()
                  ? 'bg-tis-coral text-white hover:bg-tis-pink shadow-lg hover:shadow-xl'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              <span className="hidden sm:inline font-medium">Comenzar</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.form>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center justify-center gap-6 text-sm text-slate-500"
        >
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Sin tarjeta requerida
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Activo en 48 horas
          </span>
        </motion.div>
      </div>
    </section>
  );
}

function ValueProposition() {
  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            La nueva era de los negocios
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Mientras otros siguen atados a tareas repetitivas, tu negocio funcionara solo.{' '}
            <span className="text-tis-coral font-semibold">Ahorra tiempo. Reduce costos. Elimina errores.</span>{' '}
            La inteligencia artificial no es el futuro, es el ahora. Y los que no se adapten, se quedaran atras.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-20 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-slate-900 mb-4"
          >
            Un cerebro digital para tu negocio
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-600 max-w-xl mx-auto"
          >
            Todo lo que necesitas para operar en automatico
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 bg-tis-coral/10 text-tis-coral rounded-2xl flex items-center justify-center mx-auto mb-4">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-slate-900 mb-4"
          >
            Resultados que hablan
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-600"
          >
            Negocios reales, transformaciones reales
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-slate-50 rounded-2xl p-8"
            >
              <p className="text-xl text-slate-700 mb-6 leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div>
                <p className="font-semibold text-slate-900">{testimonial.author}</p>
                <p className="text-sm text-slate-600">{testimonial.business}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 px-6 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-tis-coral to-tis-pink rounded-3xl p-12 text-center text-white"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            El momento es ahora
          </h2>
          <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
            Cada dia que pasa sin automatizar es tiempo y dinero que no recuperas. Da el primer paso.
          </p>
          <Link
            href="/discovery"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-tis-coral font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-lg"
          >
            Comenzar gratis
            <ChevronRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function LandingPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [placeholderText, setPlaceholderText] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const placeholders = useMemo(() => [
    'Tengo una clinica y quiero automatizar las citas...',
    'Mi restaurante necesita manejar reservaciones 24/7...',
    'Quiero que WhatsApp se responda solo...',
    'Necesito organizar mi inventario automaticamente...',
  ], []);

  // Animacion del placeholder
  useEffect(() => {
    const currentPlaceholder = placeholders[placeholderIndex];

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < currentPlaceholder.length) {
          setPlaceholderText(currentPlaceholder.substring(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (charIndex > 0) {
          setPlaceholderText(currentPlaceholder.substring(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        } else {
          setIsDeleting(false);
          setPlaceholderIndex((placeholderIndex + 1) % placeholders.length);
        }
      }
    }, isDeleting ? 30 : 50);

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, placeholderIndex, placeholders]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sessionStorage.setItem('initial_message', message);
    router.push('/discovery');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <HeroSection
        message={message}
        setMessage={setMessage}
        placeholderText={placeholderText}
        onSubmit={handleSubmit}
      />
      <ValueProposition />
      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />
    </div>
  );
}
