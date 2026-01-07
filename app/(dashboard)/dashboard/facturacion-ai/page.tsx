// =====================================================
// TIS TIS PLATFORM - Facturacion AI Configuration Page
// Premium design for WhatsApp-based invoice generation
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardContent, Button, Input } from '@/src/shared/components/ui';
import {
  PageWrapper,
  StatsGrid,
  StatCard,
} from '@/src/features/dashboard';
import { useAuth } from '@/src/features/auth';

// ======================
// ICONS (Premium SVG)
// ======================
const icons = {
  receipt: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  receiptLarge: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  checkCircle: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  hash: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  mail: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  power: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  camera: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  dollar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  play: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// CONSTANTS
// ======================
const REGIMEN_FISCAL_OPTIONS = [
  { value: '601', label: '601 - General de Ley Personas Morales' },
  { value: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { value: '612', label: '612 - Personas Fisicas con Actividades Empresariales' },
  { value: '620', label: '620 - Sociedades Cooperativas de Produccion' },
  { value: '621', label: '621 - Incorporacion Fiscal' },
  { value: '622', label: '622 - Actividades Agricolas, Ganaderas, Silvicolas' },
  { value: '626', label: '626 - Regimen Simplificado de Confianza (RESICO)' },
];

const IVA_OPTIONS = [
  { value: 0.16, label: '16% (Estandar)' },
  { value: 0.08, label: '8% (Frontera)' },
  { value: 0, label: '0% (Exento)' },
];

// ======================
// TYPES
// ======================
interface InvoiceConfig {
  id?: string;
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  codigo_postal: string;
  serie: string;
  folio_actual: number;
  tasa_iva: number;
  logo_url?: string;
  auto_send_email: boolean;
  email_from_name?: string;
  email_reply_to?: string;
  is_active: boolean;
}

interface InvoiceStatistics {
  total_invoices: number;
  total_amount: number;
  invoices_timbradas: number;
  invoices_canceladas: number;
  invoices_pendientes: number;
  avg_invoice_amount: number;
  top_customers?: Array<{
    rfc: string;
    nombre: string;
    count: number;
    amount: number;
  }>;
}

// ======================
// LOADING STATE
// ======================
function LoadingState() {
  return (
    <PageWrapper
      title="Facturacion AI"
      subtitle="Cargando..."
    >
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-tis-coral border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando insights...</p>
        </div>
      </div>
    </PageWrapper>
  );
}

// ======================
// ERROR STATE
// ======================
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <PageWrapper
      title="Facturacion AI"
      subtitle="Error al cargar"
    >
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500">{icons.alert}</span>
          </div>
          <p className="text-slate-900 font-semibold mb-2">Error al cargar configuracion</p>
          <p className="text-slate-600 text-sm mb-4">{error}</p>
          <Button onClick={onRetry} variant="outline" leftIcon={icons.refresh}>
            Reintentar
          </Button>
        </div>
      </div>
    </PageWrapper>
  );
}

// ======================
// HOW IT WORKS SECTION
// ======================
function HowItWorksCard() {
  const steps = [
    {
      icon: icons.camera,
      title: 'Foto del ticket',
      description: 'Tu cliente envia una foto del ticket por WhatsApp',
    },
    {
      icon: icons.sparkles,
      title: 'Extraccion con IA',
      description: 'Gemini extrae automaticamente los datos del ticket',
    },
    {
      icon: icons.chat,
      title: 'Datos fiscales',
      description: 'El cliente proporciona RFC, email y uso CFDI',
    },
    {
      icon: icons.document,
      title: 'Factura instantanea',
      description: 'Se genera y envia la factura PDF al instante',
    },
  ];

  return (
    <Card variant="bordered" className="border-tis-purple/20 bg-gradient-to-br from-tis-purple/5 to-indigo-50/50">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="text-tis-purple">{icons.whatsapp}</span>
            Como funciona la facturacion por WhatsApp
          </span>
        }
      />
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-tis-purple/10 flex items-center justify-center text-tis-purple mb-3">
                  {step.icon}
                </div>
                <div className="absolute -top-1 -left-1 w-6 h-6 bg-tis-purple text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
                <h4 className="font-medium text-slate-900 text-sm mb-1">{step.title}</h4>
                <p className="text-xs text-slate-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[calc(50%+24px)] w-[calc(100%-48px)] h-0.5 bg-gradient-to-r from-tis-purple/20 to-tis-purple/10" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-tis-purple/10">
          <p className="text-xs text-tis-purple flex items-center gap-1.5">
            <span>{icons.info}</span>
            Sin almacenamiento permanente - las facturas solo existen en el chat de WhatsApp
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ======================
// STATUS TOGGLE CARD
// ======================
function StatusToggleCard({
  isActive,
  onToggle,
  isLoading,
}: {
  isActive: boolean;
  onToggle: () => void;
  isLoading: boolean;
}) {
  return (
    <Card variant="bordered" className={isActive ? 'border-tis-green/30 bg-tis-green-100/30' : 'border-slate-200'}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isActive ? 'bg-tis-green-100 text-tis-green' : 'bg-slate-100 text-slate-400'}`}>
              {icons.power}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {isActive ? 'Facturacion Activa' : 'Facturacion Inactiva'}
              </h3>
              <p className="text-sm text-slate-500">
                {isActive
                  ? 'El agente de WhatsApp puede generar facturas'
                  : 'Activa para permitir facturacion automatica'}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            disabled={isLoading}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              isActive ? 'bg-tis-green' : 'bg-slate-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ======================
// FORM SECTION CARD
// ======================
function FormSectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="bordered">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="text-tis-coral">{icon}</span>
            {title}
          </span>
        }
        subtitle={subtitle}
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ======================
// TESTING INSTRUCTIONS
// ======================
function TestingInstructionsCard() {
  const steps = [
    {
      title: 'Abre WhatsApp y envia un mensaje',
      description: 'Escribe "quiero factura" o envia una foto de un ticket',
    },
    {
      title: 'El agente te guiara',
      description: 'Te pedira la foto del ticket si no la enviaste, luego tus datos fiscales',
    },
    {
      title: 'Recibe tu factura',
      description: 'El PDF se generara y enviara directamente en el chat de WhatsApp',
    },
  ];

  return (
    <Card variant="bordered" className="border-amber-200 bg-amber-50/30">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="text-amber-500">{icons.play}</span>
            Probar la Facturacion
          </span>
        }
        subtitle="Sigue estos pasos para probar el flujo completo"
      />
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-semibold text-sm flex-shrink-0">
                {index + 1}
              </div>
              <div>
                <p className="font-medium text-slate-900">{step.title}</p>
                <p className="text-sm text-slate-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export default function FacturacionAIConfigPage() {
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<InvoiceStatistics | null>(null);
  const [config, setConfig] = useState<InvoiceConfig>({
    rfc: '',
    razon_social: '',
    regimen_fiscal: '601',
    codigo_postal: '',
    serie: 'FAC',
    folio_actual: 0,
    tasa_iva: 0.16,
    auto_send_email: true,
    is_active: true,
  });

  const accessToken = session?.access_token;

  // Fetch config and statistics
  const fetchData = useCallback(async () => {
    if (!accessToken) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch config and stats in parallel
      const [configRes, statsRes] = await Promise.all([
        fetch('/api/invoicing/config', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('/api/invoicing/statistics', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData && !configData.error) {
          setConfig((prev) => ({ ...prev, ...configData }));
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar la configuracion');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (!config.rfc || config.rfc.length < 12) {
        throw new Error('RFC invalido. Debe tener 12 o 13 caracteres.');
      }
      if (!config.razon_social) {
        throw new Error('La razon social es requerida.');
      }
      if (!config.codigo_postal || config.codigo_postal.length !== 5) {
        throw new Error('El codigo postal debe tener 5 digitos.');
      }

      const response = await fetch('/api/invoicing/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar la configuracion');
      }

      setSuccess('Configuracion guardada exitosamente');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle toggle active - saves immediately to avoid user confusion
  const handleToggleActive = async () => {
    if (!accessToken) return;

    const newActiveState = !config.is_active;
    setConfig((prev) => ({ ...prev, is_active: newActiveState }));

    try {
      // Only save if we have existing config
      if (config.id && config.rfc) {
        setIsSaving(true);
        await fetch('/api/invoicing/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ ...config, is_active: newActiveState }),
        });
        setSuccess(newActiveState ? 'Facturacion activada' : 'Facturacion desactivada');
        setTimeout(() => setSuccess(null), 2000);
      }
    } catch (err) {
      // Revert on error
      setConfig((prev) => ({ ...prev, is_active: !newActiveState }));
      setError('Error al cambiar estado');
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state (only for critical errors)
  if (error && !config.id) {
    return <ErrorState error={error} onRetry={fetchData} />;
  }

  return (
    <PageWrapper
      title="Facturacion AI"
      subtitle="Configura la facturacion automatica por WhatsApp para tu restaurante"
      actions={
        <Button
          variant="ghost"
          leftIcon={icons.refresh}
          onClick={fetchData}
        >
          Actualizar
        </Button>
      }
    >
      {/* Statistics */}
      <StatsGrid columns={4}>
        <StatCard
          title="Facturas Generadas"
          value={statistics?.total_invoices || 0}
          icon={icons.receipt}
        />
        <StatCard
          title="Monto Total"
          value={`$${(statistics?.total_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
          icon={icons.dollar}
        />
        <StatCard
          title="Timbradas"
          value={statistics?.invoices_timbradas || 0}
          icon={icons.checkCircle}
        />
        <StatCard
          title="Clientes Unicos"
          value={statistics?.top_customers?.length || 0}
          icon={icons.users}
        />
      </StatsGrid>

      <div className="mt-6 space-y-6">
        {/* Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-2"
            >
              {icons.alert}
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2"
            >
              {icons.checkCircle}
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Toggle */}
        <StatusToggleCard
          isActive={config.is_active}
          onToggle={handleToggleActive}
          isLoading={isSaving}
        />

        {/* How it works */}
        <HowItWorksCard />

        {/* Emisor Data */}
        <FormSectionCard
          icon={icons.building}
          title="Datos del Emisor"
          subtitle="Informacion fiscal de tu negocio que aparecera en las facturas"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  RFC del Emisor *
                </label>
                <Input
                  placeholder="ABC123456XY9"
                  value={config.rfc}
                  onChange={(e) => setConfig({ ...config, rfc: e.target.value.toUpperCase() })}
                  maxLength={13}
                />
                <p className="text-xs text-slate-500 mt-1">12 caracteres (moral) o 13 (fisica)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Razon Social *
                </label>
                <Input
                  placeholder="Restaurante Ejemplo S.A. de C.V."
                  value={config.razon_social}
                  onChange={(e) => setConfig({ ...config, razon_social: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Regimen Fiscal *
                </label>
                <select
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors"
                  value={config.regimen_fiscal}
                  onChange={(e) => setConfig({ ...config, regimen_fiscal: e.target.value })}
                >
                  {REGIMEN_FISCAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Codigo Postal Fiscal *
                </label>
                <Input
                  placeholder="06600"
                  value={config.codigo_postal}
                  onChange={(e) => setConfig({ ...config, codigo_postal: e.target.value.replace(/\D/g, '') })}
                  maxLength={5}
                />
              </div>
            </div>

          </div>
        </FormSectionCard>

        {/* Facturacion Settings */}
        <FormSectionCard
          icon={icons.hash}
          title="Configuracion de Facturacion"
          subtitle="Serie, folio y tasa de impuestos"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Serie
              </label>
              <Input
                placeholder="FAC"
                value={config.serie}
                onChange={(e) => setConfig({ ...config, serie: e.target.value.toUpperCase() })}
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Folio Actual
              </label>
              <Input
                type="number"
                placeholder="0"
                value={config.folio_actual}
                onChange={(e) => setConfig({ ...config, folio_actual: parseInt(e.target.value) || 0 })}
                min={0}
              />
              <p className="text-xs text-slate-500 mt-1">Proximo folio: {config.folio_actual + 1}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tasa IVA
              </label>
              <select
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors"
                value={config.tasa_iva}
                onChange={(e) => setConfig({ ...config, tasa_iva: parseFloat(e.target.value) })}
              >
                {IVA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FormSectionCard>

        {/* Email Settings */}
        <FormSectionCard
          icon={icons.mail}
          title="Notificaciones por Email"
          subtitle="Configura como se envian las facturas por correo"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nombre del Remitente
                </label>
                <Input
                  placeholder="Restaurante Ejemplo"
                  value={config.email_from_name || ''}
                  onChange={(e) => setConfig({ ...config, email_from_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email de Respuesta
                </label>
                <Input
                  type="email"
                  placeholder="facturas@mirestaurante.com"
                  value={config.email_reply_to || ''}
                  onChange={(e) => setConfig({ ...config, email_reply_to: e.target.value })}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={config.auto_send_email}
                onChange={(e) => setConfig({ ...config, auto_send_email: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-tis-coral focus:ring-tis-coral"
              />
              <div>
                <span className="text-sm font-medium text-slate-900">
                  Envio automatico por email
                </span>
                <p className="text-xs text-slate-500">
                  Enviar automaticamente la factura por email al cliente
                </p>
              </div>
            </label>
          </div>
        </FormSectionCard>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-tis-coral to-pink-500 hover:opacity-90 text-white shadow-lg"
          >
            {isSaving ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
                <span className="ml-2">Guardando...</span>
              </>
            ) : (
              <>
                {icons.check}
                <span className="ml-2">Guardar Configuracion</span>
              </>
            )}
          </Button>
        </div>

        {/* Testing Instructions */}
        <TestingInstructionsCard />
      </div>
    </PageWrapper>
  );
}
