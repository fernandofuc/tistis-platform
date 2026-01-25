# FASE 2.4: UI de Configuracion de Opciones de Servicio

**Version:** 1.0.0
**Fecha:** 2026-01-24
**Documento Padre:** IMPLEMENTACION_UNIFICACION_AGENTES_V1.md

---

## INDICE

1. [Componentes Nuevos](#1-componentes-nuevos)
2. [Integracion en Settings](#2-integracion-en-settings)
3. [API de Configuracion](#3-api-de-configuracion)
4. [Validaciones](#4-validaciones)

---

## 1. COMPONENTES NUEVOS

### 1.1 ServiceOptionsSection

Componente principal para configurar las opciones de servicio del tenant.

#### Archivo: `src/features/settings/components/ServiceOptionsSection.tsx`

```tsx
/**
 * TIS TIS Platform - Service Options Configuration
 * Configura opciones de servicio: dine-in, pickup, delivery
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  ShoppingBag,
  Truck,
  AlertCircle,
  CheckCircle,
  Settings,
  DollarSign,
  MapPin,
  Clock,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type TenantServiceOptions,
  DEFAULT_SERVICE_OPTIONS,
} from '@/src/shared/types/unified-assistant-types';

interface ServiceOptionsSectionProps {
  tenantId: string;
  vertical: 'restaurant' | 'dental';
  initialOptions?: Partial<TenantServiceOptions>;
  onSave?: (options: TenantServiceOptions) => void;
}

export function ServiceOptionsSection({
  tenantId,
  vertical,
  initialOptions,
  onSave,
}: ServiceOptionsSectionProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [options, setOptions] = useState<TenantServiceOptions>({
    ...DEFAULT_SERVICE_OPTIONS,
    ...initialOptions,
  });

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(options) !== JSON.stringify({
      ...DEFAULT_SERVICE_OPTIONS,
      ...initialOptions,
    });
    setHasChanges(changed);
  }, [options, initialOptions]);

  const updateOption = <K extends keyof TenantServiceOptions>(
    key: K,
    value: TenantServiceOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/service-options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, options }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar');
      }

      toast({
        title: 'Configuracion guardada',
        description: 'Las opciones de servicio se han actualizado.',
      });

      onSave?.(options);
      setHasChanges(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuracion.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Render different options based on vertical
  if (vertical === 'dental') {
    return (
      <DentalServiceOptions
        options={options}
        updateOption={updateOption}
        hasChanges={hasChanges}
        isSaving={isSaving}
        onSave={handleSave}
      />
    );
  }

  return (
    <RestaurantServiceOptions
      options={options}
      updateOption={updateOption}
      hasChanges={hasChanges}
      isSaving={isSaving}
      onSave={handleSave}
    />
  );
}

// =====================================================
// RESTAURANT SERVICE OPTIONS
// =====================================================

interface ServiceOptionsFormProps {
  options: TenantServiceOptions;
  updateOption: <K extends keyof TenantServiceOptions>(
    key: K,
    value: TenantServiceOptions[K]
  ) => void;
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
}

function RestaurantServiceOptions({
  options,
  updateOption,
  hasChanges,
  isSaving,
  onSave,
}: ServiceOptionsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Opciones de Servicio
        </CardTitle>
        <CardDescription>
          Configura los tipos de servicio que ofrece tu restaurante.
          Esto afecta las capacidades disponibles para el agente de IA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dine In */}
        <ServiceOptionToggle
          icon={<Store className="h-5 w-5" />}
          title="Comer en Restaurante"
          description="Permite a los clientes hacer reservaciones para comer en tu establecimiento."
          enabled={options.dine_in_enabled}
          onChange={(v) => updateOption('dine_in_enabled', v)}
        />

        {/* Pickup */}
        <ServiceOptionToggle
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Pedidos para Recoger"
          description="Permite a los clientes ordenar para recoger en sucursal."
          enabled={options.pickup_enabled}
          onChange={(v) => updateOption('pickup_enabled', v)}
        />

        {/* Delivery */}
        <div className="space-y-4">
          <ServiceOptionToggle
            icon={<Truck className="h-5 w-5" />}
            title="Servicio de Delivery"
            description="Permite a los clientes ordenar para entrega a domicilio."
            enabled={options.delivery_enabled}
            onChange={(v) => updateOption('delivery_enabled', v)}
          />

          {/* Delivery Settings - Expandible */}
          <AnimatePresence>
            {options.delivery_enabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="ml-8 p-4 bg-slate-50 rounded-lg space-y-4 border border-slate-200">
                  <h4 className="font-medium text-sm text-slate-700 mb-3">
                    Configuracion de Delivery
                  </h4>

                  {/* Radio de entrega */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delivery_radius" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        Radio de Entrega
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="delivery_radius"
                          type="number"
                          min={1}
                          max={50}
                          value={options.delivery_radius_km}
                          onChange={(e) =>
                            updateOption('delivery_radius_km', Number(e.target.value))
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-slate-500">km</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Distancia maxima desde la sucursal
                      </p>
                    </div>

                    {/* Costo de envio */}
                    <div className="space-y-2">
                      <Label htmlFor="delivery_fee" className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-slate-500" />
                        Costo de Envio
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">$</span>
                        <Input
                          id="delivery_fee"
                          type="number"
                          min={0}
                          step={5}
                          value={options.delivery_fee}
                          onChange={(e) =>
                            updateOption('delivery_fee', Number(e.target.value))
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-slate-500">MXN</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        0 = envio gratis
                      </p>
                    </div>
                  </div>

                  {/* Minimo de compra */}
                  <div className="space-y-2">
                    <Label htmlFor="delivery_min" className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-slate-500" />
                      Minimo de Compra para Delivery
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">$</span>
                      <Input
                        id="delivery_min"
                        type="number"
                        min={0}
                        step={50}
                        value={options.delivery_min_order}
                        onChange={(e) =>
                          updateOption('delivery_min_order', Number(e.target.value))
                        }
                        className="w-32"
                      />
                      <span className="text-sm text-slate-500">MXN</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      0 = sin minimo requerido
                    </p>
                  </div>

                  {/* Info box */}
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      El agente de IA verificara automaticamente si la direccion
                      del cliente esta dentro del radio de entrega antes de
                      permitir pedidos de delivery.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Validation Messages */}
        {!options.dine_in_enabled && !options.pickup_enabled && !options.delivery_enabled && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">
              Debes habilitar al menos un tipo de servicio.
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={onSave}
            disabled={!hasChanges || isSaving}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Guardar Cambios
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// DENTAL SERVICE OPTIONS
// =====================================================

function DentalServiceOptions({
  options,
  updateOption,
  hasChanges,
  isSaving,
  onSave,
}: ServiceOptionsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Opciones de Servicio
        </CardTitle>
        <CardDescription>
          Configura los servicios especiales que ofrece tu clinica.
          Esto afecta las capacidades disponibles para el agente de IA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Servicio de Urgencias */}
        <ServiceOptionToggle
          icon={<Clock className="h-5 w-5" />}
          title="Servicio de Urgencias"
          description="Permite al agente manejar solicitudes de emergencias dentales y agendar citas urgentes."
          enabled={options.emergency_service}
          onChange={(v) => updateOption('emergency_service', v)}
        />

        {/* Seguros Aceptados */}
        <ServiceOptionToggle
          icon={<DollarSign className="h-5 w-5" />}
          title="Aceptamos Seguros Dentales"
          description="Habilita al agente para informar sobre seguros aceptados y verificar cobertura."
          enabled={options.insurance_accepted}
          onChange={(v) => updateOption('insurance_accepted', v)}
        />

        {/* Info adicional para dental */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-700">
            <p className="font-medium">Nota sobre Tipo de Asistente:</p>
            <p className="mt-1">
              El tipo de asistente "Servicio Completo" incluye automaticamente
              las capacidades de urgencias y seguros cuando estan habilitadas aqui.
              El tipo "Citas + Servicios" no incluye estas funcionalidades.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={onSave}
            disabled={!hasChanges || isSaving}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Guardar Cambios
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// SHARED COMPONENTS
// =====================================================

interface ServiceOptionToggleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ServiceOptionToggle({
  icon,
  title,
  description,
  enabled,
  onChange,
}: ServiceOptionToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`
          p-2 rounded-lg
          ${enabled ? 'bg-tis-coral/10 text-tis-coral' : 'bg-slate-100 text-slate-500'}
        `}>
          {icon}
        </div>
        <div>
          <h3 className="font-medium text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-tis-coral"
      />
    </div>
  );
}

export default ServiceOptionsSection;
```

### 1.2 DeliveryConfigCard (Resumen en Dashboard)

Componente para mostrar un resumen de la configuracion de delivery en el dashboard.

#### Archivo: `src/features/settings/components/DeliveryConfigCard.tsx`

```tsx
/**
 * TIS TIS Platform - Delivery Config Summary Card
 * Muestra resumen de configuracion de delivery en dashboard
 */

'use client';

import { Truck, MapPin, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { TenantServiceOptions } from '@/src/shared/types/unified-assistant-types';

interface DeliveryConfigCardProps {
  options: Partial<TenantServiceOptions>;
  settingsUrl?: string;
}

export function DeliveryConfigCard({
  options,
  settingsUrl = '/dashboard/settings/ai',
}: DeliveryConfigCardProps) {
  const isDeliveryEnabled = options.delivery_enabled ?? false;

  return (
    <Card className={isDeliveryEnabled ? 'border-green-200' : 'border-slate-200'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Delivery
          </CardTitle>
          <Badge variant={isDeliveryEnabled ? 'default' : 'secondary'}>
            {isDeliveryEnabled ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Activo
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Inactivo
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {isDeliveryEnabled ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>Radio: {options.delivery_radius_km || 5} km</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <DollarSign className="h-4 w-4 text-slate-400" />
              <span>
                Envio: {options.delivery_fee === 0
                  ? 'Gratis'
                  : `$${options.delivery_fee} MXN`}
              </span>
            </div>
            {(options.delivery_min_order || 0) > 0 && (
              <div className="text-xs text-slate-500">
                Minimo: ${options.delivery_min_order} MXN
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Habilita delivery para permitir pedidos a domicilio.
          </p>
        )}

        <div className="mt-4 pt-3 border-t">
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href={settingsUrl}>
              Configurar
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default DeliveryConfigCard;
```

---

## 2. INTEGRACION EN SETTINGS

### 2.1 Agregar a la Pagina de AI Settings

#### Modificar: `app/dashboard/settings/ai/page.tsx`

```tsx
// Agregar import
import { ServiceOptionsSection } from '@/src/features/settings/components/ServiceOptionsSection';

// En el componente, agregar la seccion:
export default async function AISettingsPage() {
  const { tenant, vertical, serviceOptions } = await getTenantData();

  return (
    <div className="space-y-8">
      {/* Existing sections */}
      <AIPersonalitySection ... />
      <ResponseDelaysSection ... />

      {/* NEW: Service Options Section */}
      <ServiceOptionsSection
        tenantId={tenant.id}
        vertical={vertical}
        initialOptions={serviceOptions}
      />

      {/* For restaurant vertical only */}
      {vertical === 'restaurant' && (
        <AssistantTypeSection
          tenantId={tenant.id}
          vertical={vertical}
          serviceOptions={serviceOptions}
        />
      )}
    </div>
  );
}
```

### 2.2 Agregar Link en Navigation

#### Modificar: `components/dashboard/nav-links.tsx`

```tsx
// En los links del menu de settings, agregar:
{
  title: 'Opciones de Servicio',
  href: '/dashboard/settings/ai#service-options',
  icon: Store,
  description: 'Configura delivery, pickup y dine-in',
}
```

---

## 3. API DE CONFIGURACION

### 3.1 Endpoint PUT /api/settings/service-options

#### Archivo: `app/api/settings/service-options/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Service Options API
// Update tenant service options
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { isValidUUID } from '@/src/lib/api/auth-helper';
import {
  type TenantServiceOptions,
  DEFAULT_SERVICE_OPTIONS,
} from '@/src/shared/types/unified-assistant-types';

export const dynamic = 'force-dynamic';

// Schema de validacion
function validateServiceOptions(
  options: Partial<TenantServiceOptions>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validar tipos
  if (options.delivery_radius_km !== undefined) {
    if (typeof options.delivery_radius_km !== 'number' ||
        options.delivery_radius_km < 1 ||
        options.delivery_radius_km > 50) {
      errors.push('Radio de entrega debe ser entre 1 y 50 km');
    }
  }

  if (options.delivery_fee !== undefined) {
    if (typeof options.delivery_fee !== 'number' || options.delivery_fee < 0) {
      errors.push('Costo de envio debe ser un numero positivo');
    }
  }

  if (options.delivery_min_order !== undefined) {
    if (typeof options.delivery_min_order !== 'number' ||
        options.delivery_min_order < 0) {
      errors.push('Minimo de compra debe ser un numero positivo');
    }
  }

  // Al menos un tipo de servicio debe estar habilitado
  const hasAnyService =
    options.dine_in_enabled ||
    options.pickup_enabled ||
    options.delivery_enabled;

  if (hasAnyService === false) {
    errors.push('Debe habilitar al menos un tipo de servicio');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function PUT(request: NextRequest) {
  try {
    // Autenticacion
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const { client: supabase, tenantId, role } = authResult;

    // Solo admin y owner pueden modificar
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar opciones de servicio' },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { options } = body;

    if (!options || typeof options !== 'object') {
      return NextResponse.json(
        { error: 'Opciones de servicio requeridas' },
        { status: 400 }
      );
    }

    // Validar opciones
    const validation = validateServiceOptions(options);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Opciones invalidas', details: validation.errors },
        { status: 400 }
      );
    }

    // Merge con defaults
    const mergedOptions: TenantServiceOptions = {
      ...DEFAULT_SERVICE_OPTIONS,
      ...options,
    };

    // Actualizar tenant
    const { data, error } = await supabase
      .from('tenants')
      .update({
        service_options: mergedOptions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select('id, service_options')
      .single();

    if (error) {
      console.error('[Service Options] Update error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar opciones' },
        { status: 500 }
      );
    }

    // Log de auditoria
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'service_options_updated',
      resource_type: 'tenant',
      resource_id: tenantId,
      changes: {
        before: body.previousOptions || null,
        after: mergedOptions,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        tenantId: data.id,
        serviceOptions: data.service_options,
      },
    });
  } catch (error) {
    console.error('[Service Options] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Autenticacion
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const { client: supabase, tenantId } = authResult;

    // Obtener opciones actuales
    const { data, error } = await supabase
      .from('tenants')
      .select('service_options')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error('[Service Options] Get error:', error);
      return NextResponse.json(
        { error: 'Error al obtener opciones' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        serviceOptions: data?.service_options || DEFAULT_SERVICE_OPTIONS,
      },
    });
  } catch (error) {
    console.error('[Service Options] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

---

## 4. VALIDACIONES

### 4.1 Hook useServiceOptions

#### Archivo: `src/features/settings/hooks/useServiceOptions.ts`

```typescript
/**
 * TIS TIS Platform - Service Options Hook
 * Hook para manejar opciones de servicio
 */

import { useState, useEffect } from 'react';
import {
  type TenantServiceOptions,
  DEFAULT_SERVICE_OPTIONS,
} from '@/src/shared/types/unified-assistant-types';

interface UseServiceOptionsReturn {
  options: TenantServiceOptions;
  isLoading: boolean;
  error: string | null;
  updateOptions: (updates: Partial<TenantServiceOptions>) => void;
  saveOptions: () => Promise<boolean>;
  hasChanges: boolean;
  resetChanges: () => void;
}

export function useServiceOptions(
  initialOptions?: Partial<TenantServiceOptions>
): UseServiceOptionsReturn {
  const [options, setOptions] = useState<TenantServiceOptions>({
    ...DEFAULT_SERVICE_OPTIONS,
    ...initialOptions,
  });
  const [originalOptions, setOriginalOptions] = useState<TenantServiceOptions>({
    ...DEFAULT_SERVICE_OPTIONS,
    ...initialOptions,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = JSON.stringify(options) !== JSON.stringify(originalOptions);

  const updateOptions = (updates: Partial<TenantServiceOptions>) => {
    setOptions((prev) => ({ ...prev, ...updates }));
  };

  const saveOptions = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/service-options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar');
      }

      setOriginalOptions(options);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetChanges = () => {
    setOptions(originalOptions);
  };

  return {
    options,
    isLoading,
    error,
    updateOptions,
    saveOptions,
    hasChanges,
    resetChanges,
  };
}
```

### 4.2 Validacion en Agente

Antes de usar tools de delivery, el agente debe verificar que esta habilitado:

```typescript
// En el agente, antes de exponer tools de delivery:
export async function getAvailableTools(
  tenantId: string,
  branchId: string
): Promise<Tool[]> {
  const supabase = createServiceRoleClient();

  // Obtener opciones de servicio
  const { data: tenant } = await supabase
    .from('tenants')
    .select('service_options')
    .eq('id', tenantId)
    .single();

  const serviceOptions = tenant?.service_options || DEFAULT_SERVICE_OPTIONS;

  const tools: Tool[] = [
    // Tools basicas siempre disponibles
    ...getBasicTools(tenantId, branchId),
  ];

  // Tools de pedidos solo si pickup o delivery habilitado
  if (serviceOptions.pickup_enabled || serviceOptions.delivery_enabled) {
    tools.push(
      createCreateOrderTool({ tenantId, branchId }),
      createGetOrderStatusTool({ tenantId, branchId })
    );
  }

  // Tools de delivery solo si habilitado
  if (serviceOptions.delivery_enabled) {
    tools.push(
      createCalculateDeliveryTimeTool({ tenantId, branchId }),
      createCreateDeliveryOrderTool({ tenantId, branchId }),
      createGetDeliveryStatusTool({ tenantId, branchId })
    );
  }

  return tools;
}
```

---

## Checklist de Implementacion

- [ ] Componente ServiceOptionsSection creado
- [ ] Componente DeliveryConfigCard creado
- [ ] Integracion en pagina de AI Settings
- [ ] API PUT /api/settings/service-options
- [ ] API GET /api/settings/service-options
- [ ] Hook useServiceOptions
- [ ] Validacion en agente (tools condicionales)
- [ ] Tests de componentes
- [ ] Tests de API

---

**Documento generado por Claude Opus 4.5**
**Fecha:** 2026-01-24
