// =====================================================
// TIS TIS PLATFORM - Payments Section Component
// Stripe Connect integration and payment management
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Badge } from '@/shared/components/ui';
import { cn } from '@/shared/utils';
import {
  getStripeConnectStatus,
  createOnboardingLink,
  disconnectStripeAccount,
  getPayoutHistory,
  formatAmount,
  getStatusColor,
  getStatusLabel,
  parsePaymentError,
  type StripeConnectStatus,
  type PayoutRecord,
  type StripePaymentError,
} from '../services/paymentsService';

// ======================
// ICONS
// ======================
const icons = {
  stripe: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  bank: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l9-4 9 4M3 6v14h18V6M3 6l9 4 9-4m-9 4v10" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  externalLink: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// STATUS CARD COMPONENT
// ======================
interface StatusCardProps {
  title: string;
  value: boolean;
  description: string;
}

function StatusCard({ title, value, description }: StatusCardProps) {
  return (
    <div className={cn(
      'p-4 rounded-xl border',
      value ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center',
          value ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
        )}>
          {value ? icons.check : <span className="text-xs">-</span>}
        </div>
        <span className="font-medium text-gray-900">{title}</span>
      </div>
      <p className="text-sm text-gray-500 ml-7">{description}</p>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function PaymentsSection() {
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<StripePaymentError | null>(null);

  // Load status on mount
  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusData = await getStripeConnectStatus();
      setStatus(statusData);

      // If connected, load payout history
      if (statusData.status === 'connected') {
        const payoutData = await getPayoutHistory(5, 0);
        setPayouts(payoutData.data);
      }
    } catch (err) {
      console.error('Error loading payments status:', err);
      const parsedError = parsePaymentError(err);
      setError(parsedError || { message: 'Error al cargar estado de pagos' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Handle connect to Stripe
  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const link = await createOnboardingLink();
      // Redirect to Stripe onboarding
      window.location.href = link.onboarding_url;
    } catch (err) {
      console.error('Error creating onboarding link:', err);
      const parsedError = parsePaymentError(err);
      setError(parsedError || { message: 'Error al conectar con Stripe' });
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!confirm('¿Estas seguro de desconectar tu cuenta de Stripe? Esto deshabilitara los cobros de membresias.')) {
      return;
    }

    try {
      await disconnectStripeAccount();
      await loadStatus();
    } catch (err) {
      console.error('Error disconnecting:', err);
      const parsedError = parsePaymentError(err);
      setError(parsedError || { message: 'Error al desconectar' });
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card variant="bordered">
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-gray-500">Cargando configuración de pagos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not connected state
  if (!status || status.status === 'not_connected' || status.status === 'disabled') {
    return (
      <Card variant="bordered">
        <CardHeader
          title="Pagos"
          subtitle="Conecta Stripe para recibir pagos de membresías"
        />
        <CardContent>
          {/* Error Banner - Configuration errors in amber, others in red */}
          {error && (
            <div className={cn(
              'mb-6 p-4 rounded-lg',
              error.isConfigurationError
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-red-50 border border-red-200'
            )}>
              <div className="flex items-start gap-3">
                <div className={error.isConfigurationError ? 'text-amber-600' : 'text-red-600'}>
                  {icons.warning}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    'text-sm font-medium',
                    error.isConfigurationError ? 'text-amber-800' : 'text-red-700'
                  )}>
                    {error.message}
                  </p>
                  {error.actionUrl && (
                    <a
                      href={error.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-2 mt-2 text-sm font-medium',
                        error.isConfigurationError
                          ? 'text-amber-700 hover:text-amber-800'
                          : 'text-red-600 hover:text-red-700'
                      )}
                    >
                      {error.action || 'Ver mas'}
                      {icons.externalLink}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setError(null)}
                  className={cn(
                    'text-sm',
                    error.isConfigurationError ? 'text-amber-500 hover:text-amber-700' : 'text-red-400 hover:text-red-600'
                  )}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="text-center py-8">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-600">
              {icons.stripe}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Conecta tu cuenta de Stripe
            </h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Para recibir pagos de tus planes de membresía, necesitas conectar una cuenta de Stripe.
              El proceso es rápido y seguro.
            </p>

            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl mb-2">💳</div>
                <p className="font-medium text-gray-900">Acepta tarjetas</p>
                <p className="text-sm text-gray-500">Visa, Mastercard, Amex</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl mb-2">🏦</div>
                <p className="font-medium text-gray-900">Depósitos directos</p>
                <p className="text-sm text-gray-500">A tu cuenta bancaria</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl mb-2">🔒</div>
                <p className="font-medium text-gray-900">100% Seguro</p>
                <p className="text-sm text-gray-500">Certificación PCI DSS</p>
              </div>
            </div>

            <Button
              onClick={handleConnect}
              isLoading={connecting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <span className="flex items-center gap-2">
                {icons.stripe}
                Conectar con Stripe
              </span>
            </Button>

            <p className="text-xs text-gray-400 mt-4">
              Al conectar, aceptas los términos de servicio de Stripe
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending/Restricted state
  if (status.status === 'pending' || status.status === 'restricted') {
    return (
      <Card variant="bordered">
        <CardHeader
          title="Pagos"
          subtitle="Completa la configuración de Stripe"
        />
        <CardContent>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <div className="text-amber-600">{icons.warning}</div>
              <div>
                <h4 className="font-medium text-amber-800">Configuración incompleta</h4>
                <p className="text-sm text-amber-700 mt-1">
                  {status.status === 'pending'
                    ? 'Tu cuenta de Stripe está pendiente de verificación. Completa los datos requeridos.'
                    : 'Tu cuenta tiene restricciones. Revisa los requisitos pendientes en Stripe.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatusCard
              title="Verificación"
              value={status.is_details_submitted}
              description="Datos enviados a Stripe"
            />
            <StatusCard
              title="Cobros"
              value={status.is_charges_enabled}
              description="Puedes aceptar pagos"
            />
            <StatusCard
              title="Retiros"
              value={status.is_payouts_enabled}
              description="Puedes recibir depósitos"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleConnect} isLoading={connecting}>
              Completar configuración
            </Button>
            <Button variant="outline" onClick={loadStatus}>
              <span className="flex items-center gap-2">
                {icons.refresh}
                Actualizar estado
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected state
  return (
    <Card variant="bordered">
      <CardHeader
        title="Pagos"
        subtitle="Gestiona tu cuenta de Stripe y revisa tus ingresos"
      />
      <CardContent>
        {/* Error Banner - Configuration errors in amber, others in red */}
        {error && (
          <div className={cn(
            'mb-6 p-4 rounded-lg',
            error.isConfigurationError
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-red-50 border border-red-200'
          )}>
            <div className="flex items-start gap-3">
              <div className={error.isConfigurationError ? 'text-amber-600' : 'text-red-600'}>
                {icons.warning}
              </div>
              <div className="flex-1">
                <p className={cn(
                  'text-sm font-medium',
                  error.isConfigurationError ? 'text-amber-800' : 'text-red-700'
                )}>
                  {error.message}
                </p>
                {error.actionUrl && (
                  <a
                    href={error.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-2 mt-2 text-sm font-medium',
                      error.isConfigurationError
                        ? 'text-amber-700 hover:text-amber-800'
                        : 'text-red-600 hover:text-red-700'
                    )}
                  >
                    {error.action || 'Ver mas'}
                    {icons.externalLink}
                  </a>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className={cn(
                  'text-sm',
                  error.isConfigurationError ? 'text-amber-500 hover:text-amber-700' : 'text-red-400 hover:text-red-600'
                )}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Connected Account Info */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-purple-600 shadow-sm">
                {icons.stripe}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {status.business_name || 'Cuenta de Stripe'}
                  </h3>
                  <Badge variant="success" size="sm">Conectada</Badge>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {status.country?.toUpperCase()} • {status.default_currency?.toUpperCase()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
            >
              <span className="flex items-center gap-2">
                Dashboard de Stripe
                {icons.externalLink}
              </span>
            </Button>
          </div>

          {/* Bank Account Info */}
          {status.bank_last_four && (
            <div className="mt-4 pt-4 border-t border-purple-200/50">
              <div className="flex items-center gap-2 text-gray-700">
                {icons.bank}
                <span className="font-medium">{status.bank_name || 'Cuenta Bancaria'}</span>
                <span className="text-gray-400">****{status.bank_last_four}</span>
              </div>
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatusCard
            title="Aceptas pagos"
            value={status.is_charges_enabled}
            description="Puedes cobrar a tus clientes"
          />
          <StatusCard
            title="Recibes depósitos"
            value={status.is_payouts_enabled}
            description="Stripe deposita a tu banco"
          />
          <StatusCard
            title="Cuenta verificada"
            value={status.is_details_submitted}
            description="Información completa"
          />
        </div>

        {/* Recent Payouts */}
        {payouts.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {icons.clock}
              Últimos depósitos
            </h4>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Monto</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Estado</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Destino</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatAmount(payout.amount, payout.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={getStatusColor(payout.status) === 'green' ? 'success' :
                                   getStatusColor(payout.status) === 'yellow' ? 'warning' :
                                   getStatusColor(payout.status) === 'red' ? 'danger' : 'default'}
                          size="sm"
                        >
                          {getStatusLabel(payout.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {payout.bank_name || 'Banco'} {payout.destination_last_four ? `****${payout.destination_last_four}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {payout.arrival_date
                          ? new Date(payout.arrival_date).toLocaleDateString('es-MX')
                          : new Date(payout.created_at).toLocaleDateString('es-MX')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStatus}
            className="text-gray-600"
          >
            <span className="flex items-center gap-2">
              {icons.refresh}
              Actualizar
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-red-600 hover:bg-red-50"
          >
            Desconectar cuenta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
