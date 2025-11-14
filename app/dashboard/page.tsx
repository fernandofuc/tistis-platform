'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Settings, BarChart3, MessageSquare, Rocket } from 'lucide-react';
import Container from '@/components/layout/Container';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    address: '',
    hours: '',
    whatsapp: ''
  });

  useEffect(() => {
    const welcome = searchParams.get('welcome');
    if (welcome === 'true') {
      setShowWelcomeModal(true);
    }
  }, [searchParams]);

  const handleSubmitOnboarding = () => {
    // Aquí iría la lógica para guardar en Supabase y notificar al equipo
    console.log('Onboarding data:', formData);
    setShowWelcomeModal(false);

    // Mostrar mensaje de confirmación
    alert('¡Perfecto! Nos pondremos en contacto contigo en los próximos 30 minutos para completar la configuración.');
  };

  return (
    <div className="min-h-screen bg-tis-bg-primary">
      {/* Welcome Modal */}
      <Modal
        show={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        title="¡Bienvenido a TIS TIS!"
        size="lg"
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-coral rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <p className="text-lg text-tis-text-secondary">
              Tu cerebro digital está listo. Necesitamos algunos datos finales
              para terminar de configurar tus automatizaciones personalizadas.
            </p>
          </div>

          <div className="space-y-4">
            <Input
              label="Nombre de tu negocio"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              placeholder="Ej: Restaurante La Cocina"
            />
            <Input
              label="Dirección principal"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Calle, Número, Colonia, Ciudad"
            />
            <Input
              label="Horarios de operación"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              placeholder="Lun-Vie 9am-6pm, Sáb 10am-2pm"
            />
            <Input
              label="WhatsApp de negocio"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="+52 55 1234 5678"
              type="tel"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              ⏰ Nos pondremos en contacto en los próximos <strong>30 minutos</strong> para
              terminar de configurar tu sistema completo.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmitOnboarding}
            disabled={!formData.businessName || !formData.whatsapp}
          >
            Completar Configuración
            <Rocket className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </Modal>

      {/* Dashboard Content */}
      <div className="pt-8 pb-16">
        <Container>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Tu Cerebro Digital</h1>
            <p className="text-xl text-tis-text-secondary">
              Panel de Control - TIS TIS Platform
            </p>
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-tis-text-muted">Conversaciones</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-tis-text-muted">Automatizaciones</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-tis-text-muted">IA Activa</p>
                  <p className="text-2xl font-bold text-green-600">●</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Settings className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-tis-text-muted">Estado</p>
                  <p className="text-sm font-semibold text-orange-600">Configurando</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Mensaje principal */}
          <Card className="p-8 text-center bg-gradient-to-br from-purple-50 to-white">
            <div className="max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4">
                ¡Tu Cerebro Digital está Listo!
              </h2>
              <p className="text-lg text-tis-text-secondary mb-6">
                Tu dashboard personalizado está siendo configurado por nuestro equipo.
                En las próximas <strong>2-3 horas</strong> tendrás acceso completo a todas
                las automatizaciones personalizadas para tu negocio.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  📞 <strong>Próximo paso:</strong> Recibirás un call de nuestro equipo
                  en los próximos 30 minutos para afinar los detalles finales.
                </p>
              </div>
            </div>
          </Card>

          {/* Secciones placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <Card className="p-6">
              <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-tis-text-muted text-center py-8">
                  Sin actividad aún. Tus automatizaciones comenzarán pronto.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader>
                <CardTitle>Configuración</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-tis-text-muted text-center py-8">
                  El equipo está configurando tus automatizaciones personalizadas.
                </p>
              </CardContent>
            </Card>
          </div>
        </Container>
      </div>
    </div>
  );
}
