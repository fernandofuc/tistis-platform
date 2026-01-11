// =====================================================
// TIS TIS PLATFORM - Página de Contacto
// Formulario de contacto y canales de comunicación
// =====================================================

'use client';

import { useState } from 'react';
import {
  Mail,
  MessageCircle,
  Clock,
  MapPin,
  Send,
  CheckCircle,
  Loader2,
  HelpCircle,
  Headphones,
  Building2,
  Zap
} from 'lucide-react';

// Canales de contacto
const contactChannels = [
  {
    icon: Headphones,
    title: 'Soporte Técnico',
    description: 'Ayuda con la plataforma, integraciones y problemas técnicos',
    email: 'soporte@tistis.com',
    responseTime: 'Respuesta en menos de 24 horas',
    color: 'tis-coral',
  },
  {
    icon: Building2,
    title: 'Ventas',
    description: 'Información sobre planes, precios y demos personalizadas',
    email: 'ventas@tistis.com',
    responseTime: 'Respuesta en menos de 4 horas',
    color: 'tis-green',
  },
  {
    icon: HelpCircle,
    title: 'Consultas Generales',
    description: 'Preguntas sobre TIS TIS, partnerships y colaboraciones',
    email: 'hola@tistis.com',
    responseTime: 'Respuesta en 1-2 días hábiles',
    color: 'tis-purple',
  },
];

// FAQs rápidas
const quickFaqs = [
  {
    question: '¿Cómo empiezo a usar TIS TIS?',
    answer: 'Crea tu cuenta gratis, conecta tu WhatsApp Business y empieza a recibir leads automáticamente.',
  },
  {
    question: '¿Puedo probar antes de pagar?',
    answer: 'Sí, ofrecemos 14 días de prueba gratuita sin necesidad de tarjeta de crédito.',
  },
  {
    question: '¿Qué pasa con mis datos si cancelo?',
    answer: 'Tus datos se mantienen por 90 días. Puedes exportarlos o solicitar eliminación inmediata.',
  },
  {
    question: '¿Funciona con mi tipo de negocio?',
    answer: 'TIS TIS funciona con clínicas, restaurantes, tiendas, servicios profesionales y más.',
  },
];

// Tipos del formulario
type FormStatus = 'idle' | 'sending' | 'success' | 'error';

interface FormData {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    subject: 'general',
    message: '',
  });
  const [status, setStatus] = useState<FormStatus>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    // Simular envío (en producción conectar a API)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Por ahora, abrir cliente de email como fallback
    const mailtoLink = `mailto:hola@tistis.com?subject=${encodeURIComponent(
      `[${formData.subject}] Contacto de ${formData.name}`
    )}&body=${encodeURIComponent(
      `Nombre: ${formData.name}\nEmpresa: ${formData.company}\nEmail: ${formData.email}\n\nMensaje:\n${formData.message}`
    )}`;

    window.location.href = mailtoLink;
    setStatus('success');
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-tis-bg-primary to-white">
        <div className="absolute top-20 left-10 w-72 h-72 bg-tis-coral/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-tis-green/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-card border border-slate-100 mb-6">
            <MessageCircle className="w-5 h-5 text-tis-coral" />
            <span className="text-sm font-medium text-slate-700">Estamos para ayudarte</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Contacta con{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">TIS TIS</span>
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            ¿Tienes preguntas? ¿Necesitas ayuda? Estamos aquí para asistirte.
            Elige el canal que mejor se adapte a tu necesidad.
          </p>
        </div>
      </section>

      {/* Contact Channels */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid md:grid-cols-3 gap-6">
          {contactChannels.map((channel) => {
            const Icon = channel.icon;
            const colorClass = channel.color === 'tis-coral'
              ? 'bg-tis-coral/10 text-tis-coral'
              : channel.color === 'tis-green'
                ? 'bg-tis-green/10 text-tis-green'
                : 'bg-tis-purple/10 text-tis-purple';

            return (
              <a
                key={channel.title}
                href={`mailto:${channel.email}`}
                className="group bg-white rounded-2xl p-6 shadow-card hover:shadow-card-elevated border border-slate-100 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {channel.title}
                </h3>

                <p className="text-slate-600 text-sm mb-4">
                  {channel.description}
                </p>

                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 group-hover:text-tis-coral transition-colors">
                  <Mail className="w-4 h-4" />
                  {channel.email}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                  <Clock className="w-3 h-3" />
                  {channel.responseTime}
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Main Content: Form + Info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Envíanos un mensaje
            </h2>
            <p className="text-slate-600 mb-8">
              Completa el formulario y te responderemos lo antes posible.
            </p>

            {status === 'success' ? (
              <div className="bg-tis-green/10 border border-tis-green/20 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-tis-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-tis-green" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  ¡Mensaje enviado!
                </h3>
                <p className="text-slate-600 mb-4">
                  Gracias por contactarnos. Te responderemos pronto.
                </p>
                <button
                  onClick={() => {
                    setStatus('idle');
                    setFormData({
                      name: '',
                      email: '',
                      company: '',
                      subject: 'general',
                      message: '',
                    });
                  }}
                  className="text-tis-coral font-medium hover:underline"
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-tis-coral focus:ring-2 focus:ring-tis-coral/20 outline-none transition-all"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-tis-coral focus:ring-2 focus:ring-tis-coral/20 outline-none transition-all"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
                      Empresa
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-tis-coral focus:ring-2 focus:ring-tis-coral/20 outline-none transition-all"
                      placeholder="Nombre de tu empresa"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
                      Asunto *
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl border border-slate-200 focus:border-tis-coral focus:ring-2 focus:ring-tis-coral/20 outline-none transition-all bg-white"
                    >
                      <option value="general">Consulta general</option>
                      <option value="ventas">Información de ventas</option>
                      <option value="soporte">Soporte técnico</option>
                      <option value="demo">Solicitar demo</option>
                      <option value="partnership">Partnership / Colaboración</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
                    Mensaje *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-tis-coral focus:ring-2 focus:ring-tis-coral/20 outline-none transition-all resize-none"
                    placeholder="¿En qué podemos ayudarte?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-coral text-white font-semibold rounded-xl shadow-coral hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Enviar mensaje
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right Side: FAQ + Info */}
          <div className="space-y-8">
            {/* Quick Info */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">Respuesta rápida</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-tis-coral mt-0.5" />
                  <div>
                    <p className="font-medium">Horario de atención</p>
                    <p className="text-sm text-slate-300">Lunes a Viernes: 9:00 - 18:00 (CDMX)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-tis-green mt-0.5" />
                  <div>
                    <p className="font-medium">WhatsApp Business</p>
                    <p className="text-sm text-slate-300">Soporte vía WhatsApp para clientes activos</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-tis-purple mt-0.5" />
                  <div>
                    <p className="font-medium">Ubicación</p>
                    <p className="text-sm text-slate-300">Ciudad de México, México</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick FAQs */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Preguntas frecuentes
              </h3>

              <div className="space-y-3">
                {quickFaqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-slate-50 rounded-xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
                      <span className="font-medium text-slate-900 text-sm">
                        {faq.question}
                      </span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </summary>
                    <div className="px-4 pb-3">
                      <p className="text-sm text-slate-600">
                        {faq.answer}
                      </p>
                    </div>
                  </details>
                ))}
              </div>

              <a
                href="/como-funciona"
                className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-tis-coral hover:underline"
              >
                Ver más información
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            ¿Prefieres ver TIS TIS en acción?
          </h2>
          <p className="text-slate-600 mb-6">
            Agenda una demo personalizada y te mostramos cómo automatizar tu negocio.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-coral text-white font-semibold rounded-xl shadow-coral hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            Solicitar Demo Gratis
          </a>
        </div>
      </section>
    </div>
  );
}
