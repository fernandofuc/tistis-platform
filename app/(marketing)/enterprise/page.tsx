'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Send,
  Loader2,
  Zap,
  Shield,
  Target,
  TrendingUp,
  Headphones,
  Code2,
  BarChart3,
  Lock,
  Globe,
  Sparkles,
  Phone,
  MessageSquare,
  ChevronRight
} from 'lucide-react';

const industries = [
  'Salud y Clinicas',
  'Restaurantes y Hospitalidad',
  'Retail y Comercio',
  'Servicios Profesionales',
  'Educacion',
  'Manufactura',
  'Logistica y Transporte',
  'Bienes Raices',
  'Finanzas y Seguros',
  'Otro'
];

const branchRanges = [
  '1-4 sucursales',
  '5-10 sucursales',
  '11-25 sucursales',
  '26-50 sucursales',
  'Mas de 50 sucursales'
];

const enterpriseBenefits = [
  {
    icon: Zap,
    title: 'Conversaciones Ilimitadas',
    description: 'Sin restricciones. Tu AI atiende a todos tus clientes 24/7, sin importar el volumen.',
    highlight: 'Sin limites'
  },
  {
    icon: Users,
    title: 'Equipo Dedicado',
    description: 'Account manager personal + equipo de implementacion para asegurar tu exito.',
    highlight: 'Soporte VIP'
  },
  {
    icon: Shield,
    title: 'SLA Garantizado',
    description: 'Respuesta en menos de 2 horas. Uptime garantizado del 99.9%.',
    highlight: 'Garantia escrita'
  },
  {
    icon: Code2,
    title: 'Integraciones Custom',
    description: 'Conectamos TIS TIS con tu ERP, CRM, POS o cualquier sistema que uses.',
    highlight: 'API completo'
  },
  {
    icon: BarChart3,
    title: 'Analytics Avanzados',
    description: 'Dashboards personalizados, reportes automaticos y predicciones con AI.',
    highlight: 'Business intelligence'
  },
  {
    icon: Lock,
    title: 'Compliance & Seguridad',
    description: 'Cumplimiento normativo, hosting dedicado, encriptacion enterprise.',
    highlight: 'HIPAA ready'
  }
];

const successStories = [
  {
    company: 'Cadena de Clinicas Premium',
    metric: '+340%',
    description: 'incremento en citas agendadas via WhatsApp',
    industry: 'Salud'
  },
  {
    company: 'Grupo Restaurantero',
    metric: '85%',
    description: 'de reservaciones automatizadas sin intervencion humana',
    industry: 'Hospitalidad'
  },
  {
    company: 'Red de Gimnasios',
    metric: '$2.4M',
    description: 'en ventas de membresias cerradas por AI en 6 meses',
    industry: 'Fitness'
  }
];

const implementationSteps = [
  {
    step: 1,
    title: 'Analisis de Requerimientos',
    description: 'Entendemos tu operacion, flujos y necesidades especificas.',
    duration: 'Semana 1'
  },
  {
    step: 2,
    title: 'Configuracion & Entrenamiento AI',
    description: 'Entrenamos tu AI con tu catalogo, precios, FAQs y politicas.',
    duration: 'Semana 2-3'
  },
  {
    step: 3,
    title: 'Integraciones',
    description: 'Conectamos con tus sistemas existentes (CRM, ERP, etc).',
    duration: 'Semana 3-4'
  },
  {
    step: 4,
    title: 'Go-Live & Optimizacion',
    description: 'Lanzamiento controlado con acompanamiento continuo.',
    duration: 'Semana 5+'
  }
];

export default function EnterprisePage() {
  const [formData, setFormData] = useState({
    contactName: '',
    email: '',
    phone: '',
    companyName: '',
    industry: '',
    branchCount: '',
    businessDescription: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedAnalysis = sessionStorage.getItem('discovery_analysis');
    if (storedAnalysis) {
      try {
        const analysis = JSON.parse(storedAnalysis);
        if (analysis.contact_info) {
          setFormData(prev => ({
            ...prev,
            contactName: analysis.contact_info.name || '',
            email: analysis.contact_info.email || '',
            phone: analysis.contact_info.phone || '',
            companyName: analysis.contact_info.company || '',
            businessDescription: analysis.primary_pain || ''
          }));
        }
      } catch (e) {
        console.error('Error parsing discovery analysis:', e);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/enterprise-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Error al enviar el formulario');
      }

      setIsSubmitted(true);
    } catch (err) {
      setError('Hubo un error al enviar tu solicitud. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-coral-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              ¡Excelente Decision!
            </h2>
            <p className="text-gray-600 mb-6">
              Nuestro equipo enterprise te contactara en menos de <strong className="text-tis-coral">2 horas habiles</strong>.
            </p>
            <div className="bg-purple-50 rounded-xl p-4 mb-6 text-left space-y-2">
              <p className="text-sm text-purple-800">
                <strong>Proximos pasos:</strong>
              </p>
              <ul className="text-sm text-purple-700 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Confirmacion enviada a {formData.email}
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  Llamada de discovery (30 min)
                </li>
                <li className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  Propuesta personalizada
                </li>
              </ul>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-tis-coral hover:text-tis-purple transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Planes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-tis-coral rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-tis-purple rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-8 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Planes
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium">Para empresas con vision</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Tu negocio merece un
                <span className="block bg-gradient-to-r from-tis-coral to-pink-400 bg-clip-text text-transparent">
                  AI a la altura
                </span>
              </h1>

              <p className="text-xl text-gray-300 mb-8 max-w-xl">
                Soluciones personalizadas para empresas que no aceptan limites.
                Desde integraciones complejas hasta compliance enterprise.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#contact-form"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-tis-coral to-pink-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-all shadow-lg shadow-tis-coral/25"
                >
                  <Phone className="w-5 h-5" />
                  Agendar Llamada
                </a>
                <a
                  href="https://wa.me/525512345678?text=Hola,%20me%20interesa%20el%20plan%20Enterprise"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/20 transition-all"
                >
                  <MessageSquare className="w-5 h-5" />
                  Escribenos
                </a>
              </div>

              <div className="mt-10 flex items-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Respuesta en 2h
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  SLA garantizado
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Equipo dedicado
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {successStories.map((story, idx) => (
                <div
                  key={idx}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                >
                  <div className="text-3xl md:text-4xl font-bold text-tis-coral mb-2">
                    {story.metric}
                  </div>
                  <p className="text-gray-300 text-sm mb-3">{story.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Building2 className="w-3 h-3" />
                    {story.industry}
                  </div>
                </div>
              ))}
              <div className="bg-gradient-to-br from-tis-coral/20 to-pink-500/20 backdrop-blur-sm border border-tis-coral/30 rounded-2xl p-6 flex flex-col justify-center">
                <div className="text-lg font-semibold text-white mb-2">
                  ¿Tu historia aqui?
                </div>
                <p className="text-gray-400 text-sm">
                  Unete a empresas lideres que ya transformaron su atencion al cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesita tu empresa
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Sin limites, sin sorpresas, con el respaldo que mereces
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {enterpriseBenefits.map((benefit, idx) => {
              const IconComponent = benefit.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all border border-gray-100 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-tis-purple/10 to-tis-coral/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <IconComponent className="w-7 h-7 text-tis-purple" />
                    </div>
                    <span className="text-xs font-semibold text-tis-coral bg-tis-coral/10 px-3 py-1 rounded-full">
                      {benefit.highlight}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Implementation Timeline */}
      <div className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              De 0 a operando en 5 semanas
            </h2>
            <p className="text-xl text-gray-600">
              Implementacion guiada por expertos
            </p>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-tis-purple via-tis-coral to-pink-500 hidden md:block"></div>

            <div className="space-y-8">
              {implementationSteps.map((step, idx) => (
                <div key={idx} className="relative flex gap-8">
                  {/* Step Number */}
                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-tis-purple to-tis-coral rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg relative z-10">
                    {step.step}
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-gray-50 rounded-2xl p-6 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                      <span className="text-sm text-tis-coral font-medium">{step.duration}</span>
                    </div>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Form Section */}
      <div id="contact-form" className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Hablemos de tu proyecto
              </h2>
              <p className="text-gray-400 text-lg">
                Cuentanos sobre tu empresa y te preparamos una propuesta personalizada
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    name="contactName"
                    required
                    value={formData.contactName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all text-white placeholder-gray-500"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email corporativo *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all text-white placeholder-gray-500"
                    placeholder="tu@empresa.com"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                    Telefono *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all text-white placeholder-gray-500"
                    placeholder="+52 55 1234 5678"
                  />
                </div>
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre de la empresa *
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    required
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all text-white placeholder-gray-500"
                    placeholder="Nombre de tu empresa"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-300 mb-2">
                    Industria *
                  </label>
                  <select
                    id="industry"
                    name="industry"
                    required
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all text-white"
                  >
                    <option value="" className="bg-gray-800">Selecciona una industria</option>
                    {industries.map((ind) => (
                      <option key={ind} value={ind} className="bg-gray-800">{ind}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="branchCount" className="block text-sm font-medium text-gray-300 mb-2">
                    Numero de sucursales *
                  </label>
                  <select
                    id="branchCount"
                    name="branchCount"
                    required
                    value={formData.branchCount}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all text-white"
                  >
                    <option value="" className="bg-gray-800">Selecciona un rango</option>
                    {branchRanges.map((range) => (
                      <option key={range} value={range} className="bg-gray-800">{range}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="businessDescription" className="block text-sm font-medium text-gray-300 mb-2">
                  Cuentanos sobre tu negocio *
                </label>
                <textarea
                  id="businessDescription"
                  name="businessDescription"
                  required
                  rows={4}
                  value={formData.businessDescription}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all text-white placeholder-gray-500 resize-none"
                  placeholder="Describe brevemente tu negocio, tus principales retos y que esperas lograr..."
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-tis-coral to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-tis-coral/25"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Solicitar Propuesta Personalizada
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-6 pt-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-tis-coral" />
                  <span>Respuesta en 2h habiles</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-tis-coral" />
                  <span>Sin compromiso</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Preguntas frecuentes Enterprise
          </h2>

          <div className="space-y-6">
            {[
              {
                q: '¿Cual es el precio del plan Enterprise?',
                a: 'El precio depende de tus requerimientos especificos: numero de sucursales, volumen de conversaciones, integraciones necesarias y nivel de soporte. Agenda una llamada y te daremos una cotizacion exacta.'
              },
              {
                q: '¿Que tipo de integraciones soportan?',
                a: 'Podemos integrar con practicamente cualquier sistema: ERPs (SAP, Oracle, NetSuite), CRMs (Salesforce, HubSpot), POS, sistemas de citas, facturacion, y mas. Nuestro API es flexible y nuestro equipo tiene experiencia con +50 integraciones.'
              },
              {
                q: '¿Cuanto tiempo toma la implementacion?',
                a: 'Una implementacion tipica toma entre 4-6 semanas. Esto incluye analisis, configuracion, integraciones, pruebas y go-live. Proyectos mas complejos pueden tomar mas tiempo.'
              },
              {
                q: '¿Ofrecen hosting dedicado?',
                a: 'Si. Para clientes enterprise ofrecemos la opcion de hosting dedicado en tu nube preferida (AWS, GCP, Azure) o incluso on-premise para cumplir con requerimientos de compliance.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="bg-gray-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-16 bg-gradient-to-r from-tis-purple to-tis-coral text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para escalar tu atencion al cliente?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Unete a empresas lideres que ya confiaron en TIS TIS Enterprise
          </p>
          <a
            href="#contact-form"
            className="inline-flex items-center gap-2 bg-white text-tis-purple px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors"
          >
            Empezar Ahora
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
}
