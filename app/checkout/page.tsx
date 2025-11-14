'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, CreditCard } from 'lucide-react';
import Container from '@/components/layout/Container';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [planName, setPlanName] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    const plan = sessionStorage.getItem('selected_plan') || 'essentials';
    const price = parseInt(sessionStorage.getItem('total_price') || '8990');

    setPlanName(plan.charAt(0).toUpperCase() + plan.slice(1));
    setTotalPrice(price);
  }, []);

  const handleCheckout = () => {
    setLoading(true);

    // Simular checkout (en producción iría a Stripe)
    setTimeout(() => {
      // Limpiar sessionStorage
      sessionStorage.clear();

      // Redirigir a dashboard
      router.push('/dashboard?welcome=true');
    }, 2000);
  };

  const activationFee = Math.ceil(totalPrice * 0.5);

  return (
    <div className="min-h-screen bg-tis-bg-primary py-12">
      <Container className="max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Finalizar Pago</h1>
          <p className="text-tis-text-secondary">
            Estás a un paso de automatizar tu negocio
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Resumen del Pedido */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6">Resumen del Pedido</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-tis-text-secondary">Plan {planName}</span>
                <span className="font-semibold">${totalPrice.toLocaleString('es-MX')} MXN/mes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tis-text-secondary">Configuración inicial</span>
                <span className="font-semibold">${activationFee.toLocaleString('es-MX')} MXN</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total hoy</span>
                  <span className="font-bold text-tis-coral">
                    ${(totalPrice + activationFee).toLocaleString('es-MX')} MXN
                  </span>
                </div>
                <p className="text-sm text-tis-text-muted mt-2">
                  Luego ${totalPrice.toLocaleString('es-MX')} MXN/mes
                </p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-800 mb-2">Lo que obtienes:</h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Acceso inmediato a tu dashboard
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Call de configuración en 30 min
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Automatizaciones listas en 2-3 días
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Soporte prioritario
                </li>
              </ul>
            </div>
          </Card>

          {/* Información de Pago */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6">Información de Pago</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">Pago 100% Seguro</p>
                  <p className="text-sm text-blue-700">
                    Procesado por Stripe - Encriptación SSL de grado bancario
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-tis-text-muted mx-auto mb-4" />
              <p className="text-tis-text-secondary mb-6">
                El checkout de Stripe se abrirá en una ventana segura
              </p>

              <Button
                size="xl"
                variant="primary"
                className="w-full"
                onClick={handleCheckout}
                loading={loading}
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Proceder al Pago Seguro'}
                {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
              </Button>

              <p className="text-xs text-tis-text-muted mt-4">
                Al continuar, aceptas nuestros términos de servicio y política de privacidad
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 mt-6 text-xs text-tis-text-muted">
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-6 opacity-50" />
              <span>·</span>
              <span>Visa</span>
              <span>·</span>
              <span>Mastercard</span>
              <span>·</span>
              <span>Amex</span>
            </div>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-tis-text-muted">
            ¿Tienes preguntas? <a href="mailto:soporte@tistis.com" className="text-tis-coral hover:underline">Contáctanos</a>
          </p>
        </div>
      </Container>
    </div>
  );
}
