// =====================================================
// TIS TIS PLATFORM - Facturación AI Configuration Page
// Configuration page for WhatsApp-based invoice generation
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Input } from '@/src/shared/components/ui';
import { cn } from '@/src/shared/utils';
import { useTenant } from '@/src/hooks';
import { useAuth } from '@/src/features/auth';

// ======================
// ICONS
// ======================
const icons = {
  settings: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  loading: (
    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  receipt: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

// ======================
// CONSTANTS
// ======================
const REGIMEN_FISCAL_OPTIONS = [
  { value: '601', label: '601 - General de Ley Personas Morales' },
  { value: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { value: '612', label: '612 - Personas Físicas con Actividades Empresariales y Profesionales' },
  { value: '620', label: '620 - Sociedades Cooperativas de Producción' },
  { value: '621', label: '621 - Incorporación Fiscal' },
  { value: '622', label: '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { value: '626', label: '626 - Régimen Simplificado de Confianza (RESICO)' },
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
  domicilio_fiscal: string;
  serie: string;
  folio_actual: number;
  tasa_iva: number;
  logo_url?: string;
  auto_send_email: boolean;
  email_from_name?: string;
  email_reply_to?: string;
  is_active: boolean;
}

// ======================
// COMPONENT
// ======================
export default function FacturacionAIConfigPage() {
  const { tenant } = useTenant();
  const { session } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState<InvoiceConfig>({
    rfc: '',
    razon_social: '',
    regimen_fiscal: '601',
    codigo_postal: '',
    domicilio_fiscal: '',
    serie: 'FAC',
    folio_actual: 0,
    tasa_iva: 0.16,
    auto_send_email: true,
    is_active: true,
  });

  // Fetch current config
  useEffect(() => {
    async function fetchConfig() {
      if (!session?.access_token) return;

      try {
        const response = await fetch('/api/invoicing/config', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.config) {
            setConfig({
              ...config,
              ...data.config,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (!config.rfc || config.rfc.length < 12) {
        throw new Error('RFC inválido. Debe tener 12 o 13 caracteres.');
      }
      if (!config.razon_social) {
        throw new Error('La razón social es requerida.');
      }
      if (!config.codigo_postal || config.codigo_postal.length !== 5) {
        throw new Error('El código postal debe tener 5 dígitos.');
      }

      const response = await fetch('/api/invoicing/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar la configuración');
      }

      setSuccess('Configuración guardada exitosamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          {icons.loading}
          <p className="mt-2 text-slate-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-tis-coral to-pink-500 rounded-xl text-white">
            {icons.receipt}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Facturación AI</h1>
        </div>
        <p className="text-slate-600">
          Configura la facturación automática por WhatsApp para tu restaurante
        </p>
      </div>

      {/* How it works */}
      <Card variant="bordered" className="mb-6 border-blue-200 bg-blue-50/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              {icons.whatsapp}
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">¿Cómo funciona?</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Tu cliente envía una foto del ticket por WhatsApp</li>
                <li>Nuestro agente AI extrae los datos automáticamente con Gemini</li>
                <li>El cliente proporciona sus datos fiscales (RFC, email, uso CFDI)</li>
                <li>El agente genera la factura y la envía al instante por WhatsApp</li>
              </ol>
              <p className="text-xs text-blue-600 mt-2">
                Sin almacenamiento permanente - las facturas solo existen en el chat de WhatsApp
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
          {icons.check}
          {success}
        </div>
      )}

      {/* Configuration Form */}
      <Card variant="bordered">
        <CardHeader
          title="Datos del Emisor (Tu Restaurante)"
          subtitle="Estos datos aparecerán en todas las facturas generadas"
        />
        <CardContent>
          <div className="space-y-6">
            {/* RFC and Razón Social */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RFC del Emisor *
                </label>
                <Input
                  placeholder="ABC123456XY9"
                  value={config.rfc}
                  onChange={(e) => setConfig({ ...config, rfc: e.target.value.toUpperCase() })}
                  maxLength={13}
                />
                <p className="text-xs text-slate-500 mt-1">12 caracteres (moral) o 13 (física)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón Social *
                </label>
                <Input
                  placeholder="Restaurante Ejemplo S.A. de C.V."
                  value={config.razon_social}
                  onChange={(e) => setConfig({ ...config, razon_social: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            {/* Régimen and CP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Régimen Fiscal *
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Código Postal Fiscal *
                </label>
                <Input
                  placeholder="06600"
                  value={config.codigo_postal}
                  onChange={(e) => setConfig({ ...config, codigo_postal: e.target.value.replace(/\D/g, '') })}
                  maxLength={5}
                />
              </div>
            </div>

            {/* Domicilio */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Domicilio Fiscal
              </label>
              <Input
                placeholder="Av. Reforma 123, Col. Juárez, CDMX"
                value={config.domicilio_fiscal}
                onChange={(e) => setConfig({ ...config, domicilio_fiscal: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Aparecerá en el PDF de la factura</p>
            </div>

            {/* Serie and Folio */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Serie de Facturación
                </label>
                <Input
                  placeholder="FAC"
                  value={config.serie}
                  onChange={(e) => setConfig({ ...config, serie: e.target.value.toUpperCase() })}
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Folio Actual
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={config.folio_actual}
                  onChange={(e) => setConfig({ ...config, folio_actual: parseInt(e.target.value) || 0 })}
                  min={0}
                />
                <p className="text-xs text-slate-500 mt-1">Próximo folio: {config.folio_actual + 1}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tasa IVA
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                  value={config.tasa_iva}
                  onChange={(e) => setConfig({ ...config, tasa_iva: parseFloat(e.target.value) })}
                >
                  <option value="0.16">16% (Estándar)</option>
                  <option value="0.08">8% (Frontera)</option>
                  <option value="0">0% (Exento)</option>
                </select>
              </div>
            </div>

            {/* Email Settings */}
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-medium text-slate-900 mb-4">Configuración de Email</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre del Remitente
                  </label>
                  <Input
                    placeholder="Restaurante Ejemplo"
                    value={config.email_from_name || ''}
                    onChange={(e) => setConfig({ ...config, email_from_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
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

              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_send_email}
                    onChange={(e) => setConfig({ ...config, auto_send_email: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-tis-coral focus:ring-tis-coral"
                  />
                  <span className="text-sm text-slate-700">
                    Enviar automáticamente la factura por email al cliente
                  </span>
                </label>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="border-t border-slate-200 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is_active}
                  onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-tis-coral focus:ring-tis-coral"
                />
                <span className="text-sm text-slate-700">
                  <strong>Activar facturación por WhatsApp</strong>
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Cuando esté activo, el agente de WhatsApp podrá generar facturas automáticamente
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-slate-200">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    {icons.loading}
                    <span className="ml-2">Guardando...</span>
                  </>
                ) : (
                  <>
                    {icons.check}
                    <span className="ml-2">Guardar Configuración</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Testing Instructions */}
      <Card variant="bordered" className="mt-6">
        <CardHeader
          title="Probar la Facturación"
          subtitle="Instrucciones para probar el flujo de facturación"
        />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-tis-coral/10 rounded-full flex items-center justify-center text-tis-coral font-medium text-sm">
                1
              </div>
              <div>
                <p className="font-medium text-slate-900">Abre WhatsApp y envía un mensaje</p>
                <p className="text-sm text-slate-600">
                  Escribe &quot;quiero factura&quot; o envía una foto de un ticket
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-tis-coral/10 rounded-full flex items-center justify-center text-tis-coral font-medium text-sm">
                2
              </div>
              <div>
                <p className="font-medium text-slate-900">El agente te guiará</p>
                <p className="text-sm text-slate-600">
                  Te pedirá la foto del ticket si no la enviaste, luego tus datos fiscales
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-tis-coral/10 rounded-full flex items-center justify-center text-tis-coral font-medium text-sm">
                3
              </div>
              <div>
                <p className="font-medium text-slate-900">Recibe tu factura</p>
                <p className="text-sm text-slate-600">
                  El PDF se generará y enviará directamente en el chat de WhatsApp
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
