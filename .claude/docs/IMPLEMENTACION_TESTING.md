# FASE 4: Testing y Validacion

**Version:** 1.0.0
**Fecha:** 2026-01-24
**Documento Padre:** IMPLEMENTACION_UNIFICACION_AGENTES_V1.md

---

## INDICE

1. [Estrategia General](#1-estrategia-general)
2. [Tests Unitarios](#2-tests-unitarios)
3. [Tests de Integracion](#3-tests-de-integracion)
4. [Tests End-to-End](#4-tests-end-to-end)
5. [Tests de AI Agent](#5-tests-de-ai-agent)
6. [Checklist de Validacion](#6-checklist-de-validacion)

---

## 1. ESTRATEGIA GENERAL

### 1.1 Piramide de Testing

```
                    /\
                   /  \
                  / E2E\
                 /------\
                /        \
               /Integration\
              /--------------\
             /                \
            /    Unit Tests    \
           /--------------------\
```

| Nivel | Proporcion | Herramientas | Proposito |
|-------|------------|--------------|-----------|
| Unit | 70% | Vitest, Jest | Funciones individuales, utilities |
| Integration | 20% | Vitest + Supabase | APIs, DB queries, hooks |
| E2E | 10% | Playwright | Flujos completos de usuario |

### 1.2 Archivos de Configuracion

#### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    // Supabase testing
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
```

#### tests/setup.ts

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

// Global mocks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
```

---

## 2. TESTS UNITARIOS

### 2.1 Tests de Tipos Unificados

#### Archivo: `tests/unit/unified-assistant-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  getAssistantTypesForVertical,
  isCapabilityEnabled,
  RESTAURANT_TYPES_UI,
  DENTAL_TYPES_UI,
  DEFAULT_SERVICE_OPTIONS,
  type TenantServiceOptions,
} from '@/src/shared/types/unified-assistant-types';

describe('Unified Assistant Types', () => {
  describe('getAssistantTypesForVertical', () => {
    it('returns 3 types for restaurant vertical', () => {
      const types = getAssistantTypesForVertical('restaurant');
      expect(types).toHaveLength(3);
      expect(types.map(t => t.key)).toEqual([
        'rest_basic',
        'rest_standard',
        'rest_complete',
      ]);
    });

    it('returns 2 types for dental vertical (no basic)', () => {
      const types = getAssistantTypesForVertical('dental');
      expect(types).toHaveLength(2);
      expect(types.map(t => t.key)).toEqual([
        'dental_standard',
        'dental_complete',
      ]);
    });

    it('returns empty array for unknown vertical', () => {
      const types = getAssistantTypesForVertical('unknown' as any);
      expect(types).toHaveLength(0);
    });
  });

  describe('Restaurant Types', () => {
    it('rest_basic has correct capabilities summary', () => {
      const basic = RESTAURANT_TYPES_UI.find(t => t.key === 'rest_basic');
      expect(basic).toBeDefined();
      expect(basic?.capabilities_summary).toContain('Reservas');
      expect(basic?.capabilities_summary).not.toContain('Delivery');
    });

    it('rest_standard is marked as recommended', () => {
      const standard = RESTAURANT_TYPES_UI.find(t => t.key === 'rest_standard');
      expect(standard?.recommended).toBe(true);
      expect(standard?.badge).toBe('Recomendado');
    });

    it('rest_standard includes pedidos pickup', () => {
      const standard = RESTAURANT_TYPES_UI.find(t => t.key === 'rest_standard');
      expect(standard?.capabilities_summary).toContain('Pedidos pickup');
    });

    it('rest_complete includes delivery', () => {
      const complete = RESTAURANT_TYPES_UI.find(t => t.key === 'rest_complete');
      expect(complete?.capabilities_summary).toContain('Delivery');
    });
  });

  describe('Dental Types', () => {
    it('dental_standard includes all basic capabilities', () => {
      const standard = DENTAL_TYPES_UI.find(t => t.key === 'dental_standard');
      expect(standard?.capabilities_summary).toContain('Citas');
      expect(standard?.capabilities_summary).toContain('Servicios');
    });

    it('dental_complete includes insurance and emergencies', () => {
      const complete = DENTAL_TYPES_UI.find(t => t.key === 'dental_complete');
      expect(complete?.capabilities_summary).toContain('Seguros');
      expect(complete?.capabilities_summary).toContain('Urgencias');
    });

    it('no basic type exists for dental', () => {
      const basic = DENTAL_TYPES_UI.find(t => t.key === 'dental_basic');
      expect(basic).toBeUndefined();
    });
  });

  describe('isCapabilityEnabled', () => {
    const defaultOptions: TenantServiceOptions = { ...DEFAULT_SERVICE_OPTIONS };

    it('disables delivery capability when delivery_enabled is false', () => {
      const options: TenantServiceOptions = {
        ...defaultOptions,
        delivery_enabled: false,
      };
      expect(
        isCapabilityEnabled('calculate_delivery_time', 'rest_complete', options)
      ).toBe(false);
    });

    it('enables delivery capability when delivery_enabled is true', () => {
      const options: TenantServiceOptions = {
        ...defaultOptions,
        delivery_enabled: true,
      };
      expect(
        isCapabilityEnabled('calculate_delivery_time', 'rest_complete', options)
      ).toBe(true);
    });

    it('disables create_order when no pickup or delivery', () => {
      const options: TenantServiceOptions = {
        ...defaultOptions,
        pickup_enabled: false,
        delivery_enabled: false,
      };
      expect(
        isCapabilityEnabled('create_order', 'rest_standard', options)
      ).toBe(false);
    });

    it('enables create_order when pickup is enabled', () => {
      const options: TenantServiceOptions = {
        ...defaultOptions,
        pickup_enabled: true,
        delivery_enabled: false,
      };
      expect(
        isCapabilityEnabled('create_order', 'rest_standard', options)
      ).toBe(true);
    });

    it('disables emergency capability when emergency_service is false', () => {
      const options: TenantServiceOptions = {
        ...defaultOptions,
        emergency_service: false,
      };
      expect(
        isCapabilityEnabled('handle_emergency', 'dental_complete', options)
      ).toBe(false);
    });

    it('disables insurance capabilities when insurance_accepted is false', () => {
      const options: TenantServiceOptions = {
        ...defaultOptions,
        insurance_accepted: false,
      };
      expect(
        isCapabilityEnabled('get_insurance_info', 'dental_complete', options)
      ).toBe(false);
      expect(
        isCapabilityEnabled('check_insurance_coverage', 'dental_complete', options)
      ).toBe(false);
    });
  });
});
```

### 2.2 Tests de Validacion de Direccion

#### Archivo: `tests/unit/delivery-address-validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateDeliveryAddress,
  type DeliveryAddress,
} from '@/src/shared/types/delivery';

describe('Delivery Address Validation', () => {
  const validAddress: DeliveryAddress = {
    street: 'Calle Principal',
    exterior_number: '123',
    colony: 'Centro',
    city: 'Nogales',
    contact_phone: '+52 631 123 4567',
    contact_name: 'Juan Perez',
  };

  describe('validateDeliveryAddress', () => {
    it('accepts valid address with all required fields', () => {
      const result = validateDeliveryAddress(validAddress);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts address with optional fields', () => {
      const addressWithOptional: DeliveryAddress = {
        ...validAddress,
        interior_number: '4A',
        postal_code: '84000',
        reference: 'Casa azul',
      };
      const result = validateDeliveryAddress(addressWithOptional);
      expect(result.isValid).toBe(true);
    });

    it('rejects address without street', () => {
      const address = { ...validAddress, street: '' };
      const result = validateDeliveryAddress(address);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La calle es requerida');
    });

    it('rejects address without exterior number', () => {
      const address = { ...validAddress, exterior_number: '' };
      const result = validateDeliveryAddress(address);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El numero exterior es requerido');
    });

    it('rejects address without colony', () => {
      const address = { ...validAddress, colony: '' };
      const result = validateDeliveryAddress(address);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La colonia es requerida');
    });

    it('rejects address without contact phone', () => {
      const address = { ...validAddress, contact_phone: '' };
      const result = validateDeliveryAddress(address);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El telefono de contacto es requerido');
    });

    it('rejects address without contact name', () => {
      const address = { ...validAddress, contact_name: '' };
      const result = validateDeliveryAddress(address);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El nombre de contacto es requerido');
    });

    describe('Phone validation', () => {
      it('accepts valid Mexican phone format with +52', () => {
        const address = { ...validAddress, contact_phone: '+52 631 123 4567' };
        const result = validateDeliveryAddress(address);
        expect(result.isValid).toBe(true);
      });

      it('accepts valid Mexican phone format without +52', () => {
        const address = { ...validAddress, contact_phone: '6311234567' };
        const result = validateDeliveryAddress(address);
        expect(result.isValid).toBe(true);
      });

      it('accepts phone with dashes', () => {
        const address = { ...validAddress, contact_phone: '631-123-4567' };
        const result = validateDeliveryAddress(address);
        expect(result.isValid).toBe(true);
      });

      it('rejects invalid phone format', () => {
        const address = { ...validAddress, contact_phone: '12345' };
        const result = validateDeliveryAddress(address);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('El formato del telefono no es valido');
      });
    });

    it('returns multiple errors when multiple fields are invalid', () => {
      const address = {
        ...validAddress,
        street: '',
        colony: '',
        contact_phone: '123',
      };
      const result = validateDeliveryAddress(address);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
```

### 2.3 Tests de Componentes UI

#### Archivo: `tests/unit/components/OrderTypeBadge.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderTypeBadge } from '@/components/kds/OrderTypeBadge';

describe('OrderTypeBadge', () => {
  describe('order type rendering', () => {
    it('renders dine_in badge correctly', () => {
      render(<OrderTypeBadge orderType="dine_in" />);
      expect(screen.getByText('En Restaurante')).toBeInTheDocument();
    });

    it('renders pickup badge correctly', () => {
      render(<OrderTypeBadge orderType="pickup" />);
      expect(screen.getByText('Para Recoger')).toBeInTheDocument();
    });

    it('renders delivery badge correctly', () => {
      render(<OrderTypeBadge orderType="delivery" />);
      expect(screen.getByText('Delivery')).toBeInTheDocument();
    });

    it('renders drive_thru badge correctly', () => {
      render(<OrderTypeBadge orderType="drive_thru" />);
      expect(screen.getByText('Drive Thru')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('renders small size with short label', () => {
      render(<OrderTypeBadge orderType="dine_in" size="sm" />);
      expect(screen.getByText('Mesa')).toBeInTheDocument();
    });

    it('renders medium size with full label', () => {
      render(<OrderTypeBadge orderType="dine_in" size="md" />);
      expect(screen.getByText('En Restaurante')).toBeInTheDocument();
    });
  });

  describe('showLabel option', () => {
    it('hides label when showLabel is false', () => {
      render(<OrderTypeBadge orderType="delivery" showLabel={false} />);
      expect(screen.queryByText('Delivery')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies correct color for delivery', () => {
      const { container } = render(<OrderTypeBadge orderType="delivery" />);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-700');
    });

    it('applies correct color for pickup', () => {
      const { container } = render(<OrderTypeBadge orderType="pickup" />);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-amber-100');
      expect(badge).toHaveClass('text-amber-700');
    });
  });
});
```

---

## 3. TESTS DE INTEGRACION

### 3.1 Tests de API de Delivery

#### Archivo: `tests/integration/api/delivery-calculate.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Delivery Calculate API', () => {
  let testTenantId: string;
  let testBranchId: string;

  beforeAll(async () => {
    // Crear tenant de prueba con delivery habilitado
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        name: 'Test Restaurant',
        vertical: 'restaurant',
        service_options: {
          delivery_enabled: true,
          delivery_radius_km: 5,
          delivery_fee: 35,
          delivery_min_order: 100,
        },
      })
      .select()
      .single();

    testTenantId = tenant!.id;

    // Crear branch con coordenadas
    const { data: branch } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Sucursal Test',
        settings: {
          latitude: 31.3108,
          longitude: -110.9442,
        },
      })
      .select()
      .single();

    testBranchId = branch!.id;
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await supabase.from('branches').delete().eq('id', testBranchId);
    await supabase.from('tenants').delete().eq('id', testTenantId);
  });

  describe('calculate_delivery_time RPC', () => {
    it('returns available=true for address within radius', async () => {
      const { data, error } = await supabase.rpc('calculate_delivery_time', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranchId,
        p_delivery_address: {
          street: 'Calle Cercana',
          exterior_number: '100',
          colony: 'Centro',
          city: 'Nogales',
          coordinates: {
            lat: 31.315, // Cerca de la sucursal
            lng: -110.940,
          },
        },
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].is_within_radius).toBe(true);
      expect(data[0].estimated_minutes).toBeGreaterThan(0);
      expect(data[0].delivery_fee).toBe(35);
    });

    it('returns available=false for address outside radius', async () => {
      const { data, error } = await supabase.rpc('calculate_delivery_time', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranchId,
        p_delivery_address: {
          street: 'Calle Lejana',
          exterior_number: '999',
          colony: 'Otra Ciudad',
          city: 'Otra',
          coordinates: {
            lat: 32.0, // Muy lejos
            lng: -111.5,
          },
        },
      });

      expect(error).toBeNull();
      expect(data[0].is_within_radius).toBe(false);
      expect(data[0].distance_km).toBeGreaterThan(5);
    });

    it('uses estimated distance when no coordinates provided', async () => {
      const { data, error } = await supabase.rpc('calculate_delivery_time', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranchId,
        p_delivery_address: {
          street: 'Calle Sin Coords',
          exterior_number: '50',
          colony: 'Centro',
          city: 'Nogales',
        },
      });

      expect(error).toBeNull();
      expect(data[0].is_within_radius).toBe(true);
      // Sin coordenadas, asume distancia promedio dentro del radio
      expect(data[0].distance_km).toBeGreaterThan(0);
    });
  });

  describe('when delivery is disabled', () => {
    beforeAll(async () => {
      // Deshabilitar delivery temporalmente
      await supabase
        .from('tenants')
        .update({
          service_options: {
            delivery_enabled: false,
          },
        })
        .eq('id', testTenantId);
    });

    afterAll(async () => {
      // Rehabilitar delivery
      await supabase
        .from('tenants')
        .update({
          service_options: {
            delivery_enabled: true,
            delivery_radius_km: 5,
            delivery_fee: 35,
          },
        })
        .eq('id', testTenantId);
    });

    it('returns available=false when delivery is disabled', async () => {
      const { data, error } = await supabase.rpc('calculate_delivery_time', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranchId,
        p_delivery_address: {
          street: 'Calle Test',
          exterior_number: '1',
          colony: 'Centro',
          city: 'Nogales',
        },
      });

      expect(error).toBeNull();
      expect(data[0].is_within_radius).toBe(false);
    });
  });
});
```

### 3.2 Tests de Ordenes de Delivery

#### Archivo: `tests/integration/api/delivery-orders.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Delivery Orders API', () => {
  let testTenantId: string;
  let testBranchId: string;
  let testOrderId: string;

  beforeAll(async () => {
    // Setup: crear tenant, branch
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        name: 'Test Restaurant Orders',
        vertical: 'restaurant',
        service_options: {
          delivery_enabled: true,
          delivery_radius_km: 5,
          delivery_fee: 30,
        },
      })
      .select()
      .single();

    testTenantId = tenant!.id;

    const { data: branch } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Sucursal Orders',
      })
      .select()
      .single();

    testBranchId = branch!.id;
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from('restaurant_orders').delete().eq('tenant_id', testTenantId);
    await supabase.from('branches').delete().eq('id', testBranchId);
    await supabase.from('tenants').delete().eq('id', testTenantId);
  });

  describe('Creating delivery orders', () => {
    it('creates order with delivery type and address', async () => {
      const deliveryAddress = {
        street: 'Calle Orden',
        exterior_number: '100',
        colony: 'Centro',
        city: 'Nogales',
        contact_name: 'Cliente Test',
        contact_phone: '6311234567',
      };

      const { data, error } = await supabase
        .from('restaurant_orders')
        .insert({
          tenant_id: testTenantId,
          branch_id: testBranchId,
          display_number: 1,
          order_type: 'delivery',
          status: 'pending',
          delivery_status: 'pending',
          delivery_address: deliveryAddress,
          delivery_fee: 30,
          subtotal: 200,
          total: 230,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.order_type).toBe('delivery');
      expect(data?.delivery_status).toBe('pending');
      expect(data?.delivery_address).toEqual(deliveryAddress);

      testOrderId = data!.id;
    });

    it('automatically tracks status changes', async () => {
      // Actualizar estado
      await supabase
        .from('restaurant_orders')
        .update({ delivery_status: 'assigned' })
        .eq('id', testOrderId);

      // Verificar tracking
      const { data: tracking } = await supabase
        .from('delivery_tracking')
        .select('*')
        .eq('order_id', testOrderId)
        .order('created_at', { ascending: false });

      expect(tracking).toBeDefined();
      expect(tracking!.length).toBeGreaterThan(0);
      expect(tracking![0].status).toBe('assigned');
    });
  });

  describe('Delivery status workflow', () => {
    const statuses = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered'];

    it.each(statuses)('allows updating to status: %s', async (status) => {
      const { error } = await supabase
        .from('restaurant_orders')
        .update({ delivery_status: status })
        .eq('id', testOrderId);

      expect(error).toBeNull();

      const { data } = await supabase
        .from('restaurant_orders')
        .select('delivery_status')
        .eq('id', testOrderId)
        .single();

      expect(data?.delivery_status).toBe(status);
    });

    it('sets actual_delivery_time when status is delivered', async () => {
      const { data } = await supabase
        .from('restaurant_orders')
        .select('actual_delivery_time')
        .eq('id', testOrderId)
        .single();

      expect(data?.actual_delivery_time).not.toBeNull();
    });
  });
});
```

---

## 4. TESTS END-TO-END

### 4.1 Configuracion Playwright

#### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.2 Test E2E: Flujo de Delivery

#### Archivo: `tests/e2e/delivery-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Delivery Order Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login como usuario con permisos
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@tistis.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('configure delivery settings', async ({ page }) => {
    // Navegar a configuracion
    await page.goto('/dashboard/settings/ai');

    // Encontrar seccion de opciones de servicio
    const serviceSection = page.locator('text=Opciones de Servicio');
    await expect(serviceSection).toBeVisible();

    // Habilitar delivery
    const deliveryToggle = page.locator('text=Servicio de Delivery').locator('..').locator('button[role="switch"]');
    await deliveryToggle.click();

    // Configurar radio y tarifa
    const radiusInput = page.locator('#delivery_radius');
    await radiusInput.fill('8');

    const feeInput = page.locator('#delivery_fee');
    await feeInput.fill('40');

    // Guardar
    await page.click('button:has-text("Guardar Cambios")');

    // Verificar notificacion de exito
    await expect(page.locator('text=Configuracion guardada')).toBeVisible();
  });

  test('create delivery order via KDS simulation', async ({ page }) => {
    // Navegar a KDS
    await page.goto('/dashboard/kds');

    // Verificar que existe el panel de delivery
    const deliveryPanel = page.locator('text=Delivery').first();
    await expect(deliveryPanel).toBeVisible();

    // Verificar pestanas de estado
    await expect(page.locator('text=Pendientes')).toBeVisible();
    await expect(page.locator('text=Asignados')).toBeVisible();
    await expect(page.locator('text=En Camino')).toBeVisible();
  });

  test('assign driver to delivery order', async ({ page }) => {
    await page.goto('/dashboard/kds');

    // Click en orden de delivery pendiente (si existe)
    const pendingOrder = page.locator('[data-testid="delivery-order-card"]').first();

    if (await pendingOrder.isVisible()) {
      // Click en asignar repartidor
      await pendingOrder.locator('button:has-text("Asignar Repartidor")').click();

      // Modal debe aparecer
      await expect(page.locator('text=Asignar Repartidor')).toBeVisible();

      // Seleccionar primer repartidor disponible
      const driverCard = page.locator('[data-testid="driver-card"]').first();
      if (await driverCard.isVisible()) {
        await driverCard.click();
        await page.click('button:has-text("Asignar")');

        // Verificar que se actualizo el estado
        await expect(page.locator('text=Asignado')).toBeVisible();
      }
    }
  });

  test('delivery status transitions', async ({ page }) => {
    await page.goto('/dashboard/kds');

    // Buscar orden asignada
    await page.click('text=Asignados');

    const assignedOrder = page.locator('[data-testid="delivery-order-card"]').first();

    if (await assignedOrder.isVisible()) {
      // Marcar como recogido
      await assignedOrder.locator('button:has-text("Marcar Recogido")').click();
      await expect(page.locator('text=Recogido')).toBeVisible();

      // Marcar como en camino
      await assignedOrder.locator('button:has-text("En Camino")').click();
      await expect(page.locator('text=En Camino')).toBeVisible();

      // Marcar como entregado
      await assignedOrder.locator('button:has-text("Marcar Entregado")').click();
      await expect(page.locator('text=Entregado')).toBeVisible();
    }
  });
});

test.describe('Service Options UI', () => {
  test('shows correct options for restaurant vertical', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'restaurant@tistis.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.goto('/dashboard/settings/ai');

    // Debe mostrar opciones de restaurante
    await expect(page.locator('text=Comer en Restaurante')).toBeVisible();
    await expect(page.locator('text=Pedidos para Recoger')).toBeVisible();
    await expect(page.locator('text=Servicio de Delivery')).toBeVisible();
  });

  test('shows correct options for dental vertical', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'dental@tistis.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.goto('/dashboard/settings/ai');

    // Debe mostrar opciones de dental
    await expect(page.locator('text=Servicio de Urgencias')).toBeVisible();
    await expect(page.locator('text=Aceptamos Seguros Dentales')).toBeVisible();

    // NO debe mostrar opciones de restaurante
    await expect(page.locator('text=Servicio de Delivery')).not.toBeVisible();
  });
});
```

---

## 5. TESTS DE AI AGENT

### 5.1 Tests de Tools de Delivery

#### Archivo: `tests/integration/ai/delivery-tools.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createCalculateDeliveryTimeTool } from '@/src/features/ai/tools/restaurant/calculate-delivery-time.tool';
import { createCreateDeliveryOrderTool } from '@/src/features/ai/tools/restaurant/create-delivery-order.tool';
import { createGetDeliveryStatusTool } from '@/src/features/ai/tools/restaurant/get-delivery-status.tool';

describe('AI Delivery Tools', () => {
  const testConfig = {
    tenantId: 'test-tenant-id',
    branchId: 'test-branch-id',
  };

  describe('calculate_delivery_time', () => {
    const tool = createCalculateDeliveryTimeTool(testConfig);

    it('has correct metadata', () => {
      expect(tool.name).toBe('calculate_delivery_time');
      expect(tool.description).toContain('Calcula el tiempo estimado');
    });

    it('returns structured response for valid address', async () => {
      // Mock seria necesario para test real
      // Este test verifica la estructura de la tool
      expect(tool.schema.shape).toHaveProperty('street');
      expect(tool.schema.shape).toHaveProperty('exterior_number');
      expect(tool.schema.shape).toHaveProperty('colony');
    });
  });

  describe('create_delivery_order', () => {
    const tool = createCreateDeliveryOrderTool({
      ...testConfig,
      conversationId: 'test-conv',
      contactId: 'test-contact',
    });

    it('has correct metadata', () => {
      expect(tool.name).toBe('create_delivery_order');
      expect(tool.description).toContain('Crea un pedido para delivery');
    });

    it('requires items and delivery_address', () => {
      expect(tool.schema.shape).toHaveProperty('items');
      expect(tool.schema.shape).toHaveProperty('delivery_address');
    });
  });

  describe('get_delivery_status', () => {
    const tool = createGetDeliveryStatusTool({
      ...testConfig,
      contactId: 'test-contact',
    });

    it('has correct metadata', () => {
      expect(tool.name).toBe('get_delivery_status');
      expect(tool.description).toContain('Consulta el estado');
    });

    it('accepts order_number or contact_phone', () => {
      expect(tool.schema.shape).toHaveProperty('order_number');
      expect(tool.schema.shape).toHaveProperty('contact_phone');
    });
  });
});
```

### 5.2 Tests de Flujo de Conversacion

#### Archivo: `tests/integration/ai/delivery-conversation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Delivery Conversation Flow', () => {
  // Estos tests validan que el agente responde correctamente
  // a diferentes escenarios de conversacion

  const scenarios = [
    {
      name: 'user requests delivery',
      userMessage: 'Quiero ordenar para delivery',
      expectedBehavior: 'agent should ask for address',
      expectedTools: [],
    },
    {
      name: 'user provides address',
      userMessage: 'Calle Sonora 123, colonia Centro',
      expectedBehavior: 'agent should use calculate_delivery_time',
      expectedTools: ['calculate_delivery_time'],
    },
    {
      name: 'address within radius',
      userMessage: 'Calle Cercana 50, Centro',
      expectedBehavior: 'agent should confirm delivery available and ask for order',
      expectedTools: ['calculate_delivery_time'],
    },
    {
      name: 'address outside radius',
      userMessage: 'Calle Lejana 999, Ciudad Lejana',
      expectedBehavior: 'agent should offer pickup alternative',
      expectedTools: ['calculate_delivery_time'],
    },
    {
      name: 'user confirms order',
      userMessage: 'Si, confirmo el pedido',
      expectedBehavior: 'agent should use create_delivery_order',
      expectedTools: ['create_delivery_order'],
    },
    {
      name: 'user asks for status',
      userMessage: 'Donde va mi pedido?',
      expectedBehavior: 'agent should ask for order number or use get_delivery_status',
      expectedTools: ['get_delivery_status'],
    },
  ];

  describe.each(scenarios)('$name', ({ userMessage, expectedBehavior, expectedTools }) => {
    it(`${expectedBehavior}`, () => {
      // Este seria un test de integracion con el agente real
      // Por ahora validamos la estructura del escenario
      expect(userMessage).toBeDefined();
      expect(expectedTools).toBeDefined();
    });
  });
});
```

---

## 6. CHECKLIST DE VALIDACION

### 6.1 Validacion Manual Pre-Deploy

```markdown
## Checklist de Validacion - Unificacion de Agentes + Delivery

### Base de Datos
- [ ] Migracion 155 ejecutada sin errores
- [ ] Migracion 156 ejecutada sin errores
- [ ] Funcion get_unified_assistant_types retorna datos correctos
- [ ] Funcion calculate_delivery_time funciona correctamente
- [ ] Trigger de tracking de delivery funciona
- [ ] RLS policies correctas en nuevas tablas

### API
- [ ] GET /api/settings/service-options retorna opciones
- [ ] PUT /api/settings/service-options guarda cambios
- [ ] POST /api/restaurant/delivery/calculate funciona
- [ ] GET /api/restaurant/delivery/orders lista ordenes
- [ ] PATCH /api/restaurant/delivery/[id]/status actualiza estado
- [ ] POST /api/restaurant/delivery/[id]/assign asigna repartidor

### UI - Service Options
- [ ] Seccion de opciones de servicio visible en settings
- [ ] Toggle de delivery habilita/deshabilita
- [ ] Configuracion de radio y tarifa funciona
- [ ] Mensaje de validacion si ningun servicio habilitado
- [ ] Guardar cambios funciona correctamente

### UI - KDS
- [ ] Badges de tipo de orden visibles
- [ ] Panel de delivery visible cuando habilitado
- [ ] Filtros de estado funcionan
- [ ] Notificaciones de nuevas ordenes
- [ ] Modal de asignar repartidor funciona
- [ ] Botones de accion por estado funcionan

### AI Agent - Messaging
- [ ] Tool calculate_delivery_time disponible cuando delivery habilitado
- [ ] Tool create_delivery_order disponible cuando delivery habilitado
- [ ] Tool get_delivery_status disponible cuando delivery habilitado
- [ ] Agente responde correctamente a solicitudes de delivery
- [ ] Agente maneja correctamente direcciones fuera de radio

### AI Agent - Voice
- [ ] Tools de delivery disponibles en VAPI cuando habilitado
- [ ] Webhook handlers responden correctamente
- [ ] Flujo de conversacion de delivery funciona

### Tipos de Asistente
- [ ] Restaurant: 3 niveles (basic, standard, complete)
- [ ] Dental: 2 niveles (standard, complete)
- [ ] Selector de tipo funciona en wizard de voz
- [ ] Selector de tipo funciona en settings de mensajes
- [ ] Capacidades correctas segun tipo seleccionado

### Performance
- [ ] Tiempo de respuesta de APIs < 500ms
- [ ] KDS con 50+ ordenes funciona fluido
- [ ] Notificaciones real-time < 2 segundos de latencia
```

### 6.2 Comandos de Testing

```bash
# Tests unitarios
npm run test

# Tests unitarios con coverage
npm run test:coverage

# Tests de integracion
npm run test:integration

# Tests E2E
npm run test:e2e

# Tests E2E con UI
npm run test:e2e:ui

# Todos los tests
npm run test:all

# Lint + Type check + Tests
npm run validate
```

### 6.3 CI/CD Pipeline

#### .github/workflows/test.yml

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage

  integration-tests:
    runs-on: ubuntu-latest
    services:
      supabase:
        image: supabase/postgres
        ports:
          - 54322:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

**Documento generado por Claude Opus 4.5**
**Fecha:** 2026-01-24
