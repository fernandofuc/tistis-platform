// =====================================================
// TIS TIS PLATFORM - Cancel Subscription Page
// Handles subscription cancellation with 90-day data retention
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button, Badge } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';

interface SubscriptionData {
  plan: string;
  status: string;
  period_end: string;
}

const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'El precio es muy alto para mi negocio' },
  { id: 'not_using', label: 'No estoy usando la plataforma' },
  { id: 'missing_features', label: 'Faltan funcionalidades que necesito' },
  { id: 'technical_issues', label: 'Problemas técnicos frecuentes' },
  { id: 'switching', label: 'Me cambio a otra solución' },
  { id: 'closing_business', label: 'Estoy cerrando mi negocio' },
  { id: 'other', label: 'Otra razón' },
];

export default function CancelSubscriptionPage() {
  const router = useRouter();
  const { staff, signOut } = useAuthContext();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'reason' | 'confirm' | 'done'>('reason');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [confirmText, setConfirmText] = useState('');

  // Check if user is owner
  const isOwner = staff?.role === 'owner';

  // Fetch current subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/stripe/update-subscription');
        if (response.ok) {
          const data = await response.json();
          setSubscription(data.data);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  // Handle cancellation
  const handleCancel = async () => {
    if (confirmText !== 'CANCELAR') {
      setError('Por favor escribe CANCELAR para confirmar');
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          reasonDetails: selectedReason === 'other' ? otherReason : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cancelar la suscripción');
      }

      setStep('done');

      // Sign out after 5 seconds
      setTimeout(async () => {
        await signOut();
        router.push('/');
      }, 5000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (!isOwner) {
    return (
      <PageWrapper title="Cancelar Suscripción" subtitle="Solo el propietario puede cancelar">
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso Restringido</h3>
            <p className="text-gray-600 mb-6">Solo el propietario de la cuenta puede cancelar la suscripción.</p>
            <Button variant="outline" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  if (loading) {
    return (
      <PageWrapper title="Cancelar Suscripción" subtitle="Cargando...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      </PageWrapper>
    );
  }

  // Done step - Subscription cancelled
  if (step === 'done') {
    return (
      <PageWrapper title="Suscripción Cancelada" subtitle="">
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">👋</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Lamentamos verte partir
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Tu suscripción ha sido cancelada. Tendrás acceso hasta el final de tu período de facturación actual.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-left">
                  <p className="text-blue-800 font-medium">Tus datos están seguros</p>
                  <p className="text-blue-700 text-sm">
                    Guardaremos tu información por 90 días. Si decides volver, todo estará como lo dejaste.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Serás redirigido en 5 segundos...
            </p>
            <Button variant="outline" onClick={() => router.push('/')}>
              Ir al Inicio
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Cancelar Suscripción" subtitle="Antes de irte, cuéntanos por qué">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Warning Banner */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-semibold text-red-800">Atención</h3>
            <p className="text-red-700 text-sm">
              Al cancelar, tú y todos los miembros de tu equipo perderán acceso al dashboard.
              Tus datos se conservarán por 90 días.
            </p>
          </div>
        </div>

        {/* Current Plan Info */}
        {subscription && (
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Plan actual</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize">{subscription.plan}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Acceso hasta</p>
                  <p className="font-medium text-gray-900">
                    {subscription.period_end
                      ? new Date(subscription.period_end).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Select Reason */}
        {step === 'reason' && (
          <Card variant="bordered">
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ¿Por qué quieres cancelar?
              </h3>
              <p className="text-gray-600 mb-6">
                Tu feedback nos ayuda a mejorar. Selecciona la razón principal:
              </p>

              <div className="space-y-3 mb-6">
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedReason === reason.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={() => setSelectedReason(reason.id)}
                      className="sr-only"
                    />
                    <span className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 ${
                      selectedReason === reason.id
                        ? 'border-red-500 bg-red-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedReason === reason.id && (
                        <span className="block w-full h-full rounded-full bg-white scale-50"></span>
                      )}
                    </span>
                    <span className="text-gray-900">{reason.label}</span>
                  </label>
                ))}
              </div>

              {/* Other reason text input */}
              {selectedReason === 'other' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cuéntanos más
                  </label>
                  <textarea
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="¿Qué podríamos mejorar?"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.back()} className="flex-1">
                  Volver
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setStep('confirm')}
                  disabled={!selectedReason}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Confirmation */}
        {step === 'confirm' && (
          <Card variant="bordered">
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Confirmar Cancelación
              </h3>

              {/* What you'll lose */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="font-medium text-gray-900 mb-3">Lo que perderás:</p>
                <ul className="space-y-2">
                  {[
                    'Respuestas automáticas 24/7 en WhatsApp',
                    'Captura y seguimiento de leads',
                    'Calendario inteligente y recordatorios',
                    'Reportes y métricas de tu negocio',
                    'Acceso al dashboard para todo tu equipo',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Data retention notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💾</span>
                  <div>
                    <p className="font-medium text-blue-800">Tus datos estarán seguros</p>
                    <p className="text-blue-700 text-sm">
                      Conservaremos toda tu información por 90 días. Si decides volver,
                      podrás reactivar tu cuenta con todos tus datos intactos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Confirmation input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escribe <span className="font-mono bg-gray-100 px-1">CANCELAR</span> para confirmar
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="CANCELAR"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none font-mono"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('reason')} className="flex-1">
                  Volver
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancel}
                  disabled={confirmText !== 'CANCELAR' || cancelling}
                  isLoading={cancelling}
                >
                  Cancelar Suscripción
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alternative: Talk to support */}
        <div className="text-center text-sm text-gray-600">
          ¿Tienes problemas que podemos resolver?{' '}
          <a href="mailto:soporte@tistis.com" className="text-[#7C5CFC] hover:underline">
            Habla con soporte
          </a>
        </div>
      </div>
    </PageWrapper>
  );
}
