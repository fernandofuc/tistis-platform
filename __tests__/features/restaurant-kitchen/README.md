# Restaurant Kitchen (KDS) - Test Suite

## Descripción

Suite de tests para el módulo de Kitchen Display System (KDS) con integración de Delivery.

## Estructura de Tests

```
__tests__/features/restaurant-kitchen/
├── hooks/
│   └── useDeliveryOrders.test.ts    # Tests del hook principal de delivery
├── components/
│   └── DeliveryPanel.test.tsx       # Tests del panel de delivery
├── api/
│   └── delivery.test.ts             # Tests de API endpoints
├── integration/
│   └── kds-delivery.test.tsx        # Tests de integración KDS-Delivery
└── README.md                        # Esta documentación
```

## Ejecutar Tests

```bash
# Ejecutar todos los tests del módulo
npm run test:vitest -- --run "__tests__/features/restaurant-kitchen"

# Ejecutar tests específicos
npm run test:vitest -- --run "__tests__/features/restaurant-kitchen/hooks"
npm run test:vitest -- --run "__tests__/features/restaurant-kitchen/components"
npm run test:vitest -- --run "__tests__/features/restaurant-kitchen/api"
```

## Cobertura de Tests

### Hook: useDeliveryOrders

| Funcionalidad | Estado |
|--------------|--------|
| Estado inicial | ✅ |
| Fetch de órdenes | ✅ |
| Manejo de errores | ✅ |
| Filtrado por status | ✅ |
| Asignación de drivers | ✅ |
| Actualización de status | ✅ |
| Callbacks de eventos | ✅ |
| Auto-refresh | ✅ |
| Edge cases | ✅ |

### Componente: DeliveryPanel

| Funcionalidad | Estado |
|--------------|--------|
| Renderizado básico | ✅ |
| Display de órdenes | ✅ |
| Filtros por status | ✅ |
| Acciones (asignar, marcar listo) | ✅ |
| Modal de asignación | ✅ |
| Manejo de null address | ✅ |
| Selección de orden | ✅ |
| Accesibilidad | ✅ |

### API: Delivery Endpoints

| Endpoint | Tests |
|----------|-------|
| GET /api/restaurant/kitchen/delivery | Autenticación, validación, respuesta |
| GET /api/restaurant/kitchen/delivery/stats | Estadísticas, métricas del día |

### Integración: KDS-Delivery

| Flujo | Estado |
|-------|--------|
| API → Hook → Component | ✅ |
| Cambio de vista a Delivery | ✅ |
| Estadísticas en StatsBar | ✅ |
| Flujo de asignación de driver | ✅ |
| Flujo de actualización de status | ✅ |
| Notificaciones de nuevas órdenes | ✅ |
| Banner de pendientes | ✅ |

## Mocks Utilizados

### fetch
```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;
```

### Supabase Client
```typescript
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: vi.fn() },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  }),
}));
```

## Datos de Prueba

Los datos de prueba siguen la estructura de tipos definida en:
- `src/features/restaurant-kitchen/types/index.ts`
- `src/shared/types/delivery-types.ts`

### Ejemplo de Orden de Delivery

```typescript
const mockDeliveryOrder: KDSDeliveryOrderView = {
  order_id: 'order-001',
  display_number: '101',
  order_status: 'preparing',
  delivery_status: 'pending_assignment',
  delivery_address: {
    street: 'Calle Principal',
    exterior_number: '123',
    colony: 'Centro',
    city: 'Ciudad Test',
    // ...
  },
  // ...
};
```

## Edge Cases Cubiertos

1. **delivery_address null** - Órdenes sin dirección configurada
2. **customers como array** - Relación devuelve array vs objeto
3. **Items vacíos** - Orden sin items
4. **Driver no encontrado** - ID de driver inexistente
5. **Timeout de red** - Simular errores de conexión
6. **Lista vacía** - Sin órdenes activas
7. **Todos los delivery statuses** - Cada estado es manejado

## Sincronización

Estos tests están sincronizados con:
- SQL: `supabase/migrations/156_DELIVERY_SYSTEM.sql`
- Types: `src/features/restaurant-kitchen/types/index.ts`
- Types: `src/shared/types/delivery-types.ts`

## Notas

- Los tests de API requieren mocks complejos de Supabase chainable queries
- Los tests de componentes usan `@testing-library/react`
- Los tests de integración verifican el flujo completo de datos
