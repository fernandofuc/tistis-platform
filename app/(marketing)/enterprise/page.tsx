'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Building2, Users, Clock, CheckCircle2, ArrowLeft, Send, Loader2, Zap, Shield, Target } from 'lucide-react';

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

const enterpriseFeatures = [
  { icon: Target, title: 'Sin Limites', description: 'Conversaciones ilimitadas, integraciones completas' },
  { icon: Users, title: 'Equipo Dedicado', description: 'Soporte prioritario con SLA de 2 horas' },
  { icon: Shield, title: 'Enterprise Features', description: 'Integraciones personalizadas y compliance' },
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

  // Pre-llenar con datos del Discovery si vienen de "otro" tipo de negocio
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
              ¡Solicitud Recibida!
            </h2>
            <p className="text-gray-600 mb-6">
              Nuestro equipo enterprise te contactará en menos de <strong className="text-tis-coral">2 horas</strong> durante horario laboral.
            </p>
            <div className="bg-purple-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-purple-800">
                <strong>📧 Revisa tu correo:</strong> Te enviaremos confirmación a {formData.email}
              </p>
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-coral-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#7C5CFC] to-[#C23350] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Planes
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Solución Enterprise
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Para empresas con operaciones complejas que necesitan una solución a la medida
          </p>
        </div>
      </div>

      {/* Features Summary */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 grid md:grid-cols-3 gap-6">
          {enterpriseFeatures.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-tis-coral/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <IconComponent className="w-6 h-6 text-tis-coral" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Cuéntanos sobre tu empresa
            </h2>
            <p className="text-gray-600">
              Nuestro equipo preparará una propuesta personalizada para ti
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  id="contactName"
                  name="contactName"
                  required
                  value={formData.contactName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all"
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email corporativo *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all"
                  placeholder="tu@empresa.com"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all"
                  placeholder="+52 55 1234 5678"
                />
              </div>
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la empresa *
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  required
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all"
                  placeholder="Nombre de tu empresa"
                />
              </div>
            </div>

            {/* Business Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                  Industria *
                </label>
                <select
                  id="industry"
                  name="industry"
                  required
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all bg-white"
                >
                  <option value="">Selecciona una industria</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="branchCount" className="block text-sm font-medium text-gray-700 mb-2">
                  Número de sucursales *
                </label>
                <select
                  id="branchCount"
                  name="branchCount"
                  required
                  value={formData.branchCount}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all bg-white"
                >
                  <option value="">Selecciona un rango</option>
                  {branchRanges.map((range) => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Business Description */}
            <div>
              <label htmlFor="businessDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Cuéntanos sobre tu negocio *
              </label>
              <textarea
                id="businessDescription"
                name="businessDescription"
                required
                rows={4}
                value={formData.businessDescription}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all resize-none"
                placeholder="Describe brevemente tu negocio, tus principales retos operativos y qué esperas lograr con TIS TIS..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#7C5CFC] to-[#C23350] text-white py-4 px-6 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar Solicitud
                </>
              )}
            </button>

            {/* Response Time Promise */}
            <div className="bg-gradient-to-r from-purple-50 to-coral-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-800">
                <Clock className="w-5 h-5 text-tis-coral" />
                <span className="font-semibold">Respuesta garantizada en menos de 2 horas</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Durante horario laboral (Lun-Vie 9:00-18:00 CST)
              </p>
            </div>
          </form>
        </div>

        {/* Trust Indicators */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-4">Empresas que confían en nosotros</p>
          <div className="flex justify-center items-center gap-8 opacity-50">
            <Building2 className="w-8 h-8 text-gray-400" />
            <Users className="w-8 h-8 text-gray-400" />
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
