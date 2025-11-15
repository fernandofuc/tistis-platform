'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Paperclip, Mic } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [placeholderText, setPlaceholderText] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const placeholders = [
    'Tengo un restaurante con 3 sucursales y necesito automatizar reservaciones...',
    'Quiero un sistema que maneje inventario y facturación automática...',
    'Necesito un asistente virtual que responda WhatsApp 24/7...',
    'Busco automatizar mi clínica dental, citas y recordatorios...',
    'Tengo una tienda de ropa y quiero controlar ventas en tiempo real...'
  ];

  // Animación del placeholder
  useEffect(() => {
    const currentPlaceholder = placeholders[placeholderIndex];

    const timer = setTimeout(() => {
      if (!isDeleting) {
        // Escribiendo
        if (charIndex < currentPlaceholder.length) {
          setPlaceholderText(currentPlaceholder.substring(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        } else {
          // Pausa antes de borrar
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Borrando
        if (charIndex > 0) {
          setPlaceholderText(currentPlaceholder.substring(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        } else {
          // Cambiar al siguiente placeholder
          setIsDeleting(false);
          setPlaceholderIndex((placeholderIndex + 1) % placeholders.length);
        }
      }
    }, isDeleting ? 30 : 50);

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, placeholderIndex, placeholders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sessionStorage.setItem('initial_message', message);
    router.push('/discovery');
  };

  return (
    <div className="min-h-screen bg-gradient-lovable flex items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center">
        {/* Tagline con emoji */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-8">
          <span className="text-2xl">🧠</span>
          <span className="text-sm font-medium text-gray-700">El cerebro digital que tu negocio necesita</span>
        </div>

        <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
          Implementa el mejor <span className="text-[#7C5CFC]">cerebro</span> para tu negocio y vuélvelo autónomo
        </h1>

        <p className="text-xl text-gray-600 leading-relaxed mb-12">
          Tu negocio en piloto automático mientras haces lo importante: expandir, innovar, vivir.
        </p>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-2 flex items-center gap-2">
            {/* Botón de Archivo */}
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 ml-2"
              title="Adjuntar archivo"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Botón de Voz */}
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700 transition-colors p-2"
              title="Grabar voz"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Input con placeholder animado */}
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholderText}
              className="flex-1 px-2 py-3 text-base focus:outline-none"
              maxLength={500}
            />

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={!message.trim()}
              className="p-3 bg-tis-coral text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </form>

        <p className="text-sm text-tis-text-muted">
          Powered by Claude AI
        </p>
      </div>
    </div>
  );
}
