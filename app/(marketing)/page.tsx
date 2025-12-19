'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, Zap, Clock, Shield, CheckCircle, ChevronRight } from 'lucide-react';

// ============================================================
// TIPOS Y CONSTANTES
// ============================================================

const FEATURES = [
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: 'Atencion 24/7',
    description: 'Tu asistente atiende clientes mientras duermes',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Implementacion rapida',
    description: 'Configuracion completa en menos de 48 horas',
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: 'Ahorra tiempo',
    description: 'Automatiza tareas repetitivas y enfocate en crecer',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Sin compromiso',
    description: 'Cancela cuando quieras, sin penalizaciones',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Redujimos 70% del tiempo en gestion de citas',
    author: 'Dr. Martinez',
    business: 'Clinica Dental Premier',
  },
  {
    quote: 'Las reservaciones se atienden solas, incluso a las 3am',
    author: 'Sofia Ramirez',
    business: 'Restaurante La Hacienda',
  },
];

// ============================================================
// COMPONENTES
// ============================================================

function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logos/tis-brain-logo.png"
            alt="TIS TIS"
            width={36}
            height={36}
            className="w-9 h-9 object-contain"
          />
          <span className="text-lg font-semibold text-slate-800">TIS TIS</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/pricing"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Planes
          </Link>
          <Link
            href="/como-funciona"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Como funciona
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Iniciar sesion
          </Link>
          <Link
            href="/discovery"
            className="px-4 py-2 bg-tis-coral text-white text-sm font-medium rounded-lg hover:bg-tis-pink transition-colors"
          >
            Comenzar
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection({ message, setMessage, placeholderText, onSubmit }: {
  message: string;
  setMessage: (m: string) => void;
  placeholderText: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
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
            El cerebro digital que tu negocio necesita
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-800 leading-tight mb-6"
        >
          Automatiza tu negocio{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-tis-coral to-tis-pink">
            con inteligencia artificial
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl text-slate-500 max-w-2xl mx-auto mb-12"
        >
          Tu negocio en piloto automatico mientras te enfocas en lo importante: expandir, innovar, vivir.
        </motion.p>

        {/* Input Form */}
        <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onSubmit={onSubmit}
          className="max-w-2xl mx-auto mb-8"
        >
          <div className="bg-white rounded-2xl shadow-xl p-2 flex items-center border border-slate-200 focus-within:border-tis-coral focus-within:shadow-2xl transition-all duration-300">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholderText}
              className="flex-1 px-4 py-4 text-base text-slate-700 placeholder:text-slate-400 focus:outline-none bg-transparent"
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
          className="flex items-center justify-center gap-6 text-sm text-slate-400"
        >
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Sin tarjeta requerida
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Implementacion en 48h
          </span>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            Todo lo que necesitas para automatizar
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Una plataforma completa para que tu negocio funcione en piloto automatico
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="w-14 h-14 bg-tis-coral/10 text-tis-coral rounded-2xl flex items-center justify-center mx-auto mb-4">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 px-6 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            Negocios que ya confian en TIS TIS
          </h2>
          <p className="text-slate-500">
            Resultados reales de empresas como la tuya
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-sm"
            >
              <p className="text-xl text-slate-700 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>
              <div>
                <p className="font-semibold text-slate-800">{testimonial.author}</p>
                <p className="text-sm text-slate-500">{testimonial.business}</p>
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
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-tis-coral to-tis-pink rounded-3xl p-12 text-center text-white"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Empieza a automatizar hoy
          </h2>
          <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
            Descubre como TIS TIS puede transformar la operacion de tu negocio en minutos
          </p>
          <Link
            href="/discovery"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-tis-coral font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-lg"
          >
            Comenzar ahora
            <ChevronRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-6 bg-white border-t border-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/tis-brain-logo.png"
              alt="TIS TIS"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
            <span className="text-sm text-slate-500">
              2024 TIS TIS. Todos los derechos reservados.
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <Link href="/terms" className="text-slate-500 hover:text-slate-800 transition-colors">
              Terminos
            </Link>
            <Link href="/privacy" className="text-slate-500 hover:text-slate-800 transition-colors">
              Privacidad
            </Link>
            <Link href="/contact" className="text-slate-500 hover:text-slate-800 transition-colors">
              Contacto
            </Link>
          </nav>
        </div>
      </div>
    </footer>
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
    'Tengo una clinica dental y quiero automatizar citas...',
    'Mi restaurante necesita manejar reservaciones 24/7...',
    'Quiero un asistente que responda WhatsApp automaticamente...',
    'Necesito controlar inventario y facturacion en tiempo real...',
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
      <Header />
      <HeroSection
        message={message}
        setMessage={setMessage}
        placeholderText={placeholderText}
        onSubmit={handleSubmit}
      />
      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
