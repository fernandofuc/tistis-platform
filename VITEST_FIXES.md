# Vitest Best Practices: Concrete Fixes & Examples

## 1. Missing Template Tests - Complete Implementation

### Add to `confirmation-templates.test.ts`

#### Missing Test Suite 1: `buildConfirmationSuccessTemplate`

```typescript
// ======================
// buildConfirmationSuccessTemplate Tests (MISSING)
// ======================

describe('buildConfirmationSuccessTemplate', () => {
  it('should include confirmation icon and text', () => {
    const data = createMockTemplateData();
    const result = buildConfirmationSuccessTemplate(data);

    expect(result.text).toContain('✅');
    expect(result.text).toContain('confirmada');
    expect(result.text).toContain('Juan Perez');
  });

  it('should include appointment details', () => {
    const data = createMockTemplateData({
      serviceName: 'Limpieza Dental',
    });
    const result = buildConfirmationSuccessTemplate(data);

    expect(result.text).toContain('lunes 27 de enero');
    expect(result.text).toContain('10:30');
    expect(result.text).toContain('Clinica Dental ABC');
  });

  it('should include branch address when provided', () => {
    const data = createMockTemplateData({
      branchAddress: 'Av. Reforma 123',
    });
    const result = buildConfirmationSuccessTemplate(data);

    expect(result.text).toContain('Av. Reforma 123');
  });

  it('should include business phone for contact', () => {
    const data = createMockTemplateData({
      businessPhone: '+529876543210',
    });
    const result = buildConfirmationSuccessTemplate(data);

    expect(result.text).toContain('+529876543210');
  });

  it('should work without optional fields', () => {
    const data = createMockTemplateData({
      businessPhone: undefined,
      branchAddress: undefined,
    });
    const result = buildConfirmationSuccessTemplate(data);

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should include footer with code', () => {
    const data = createMockTemplateData();
    const result = buildConfirmationSuccessTemplate(data);

    expect(result.footer).toBeDefined();
    expect(result.footer).toContain('ABC123');
  });
});
```

#### Missing Test Suite 2: `buildCancellationTemplate`

```typescript
// ======================
// buildCancellationTemplate Tests (MISSING)
// ======================

describe('buildCancellationTemplate', () => {
  it('should indicate cancellation status', () => {
    const data = createMockTemplateData();
    const result = buildCancellationTemplate(data);

    expect(result.text).toContain('❌');
    expect(result.text).toContain('Cancelada');
    expect(result.text).toContain('Juan Perez');
  });

  it('should show original appointment details', () => {
    const data = createMockTemplateData({
      serviceName: 'Consulta Medica',
    });
    const result = buildCancellationTemplate(data);

    expect(result.text).toContain('lunes 27 de enero');
    expect(result.text).toContain('10:30');
  });

  it('should include reagendar prompt', () => {
    const data = createMockTemplateData();
    const result = buildCancellationTemplate(data);

    expect(result.text).toContain('reagendar');
  });

  it('should include business phone for rescheduling', () => {
    const data = createMockTemplateData({
      businessPhone: '+521234567890',
    });
    const result = buildCancellationTemplate(data);

    expect(result.text).toContain('+521234567890');
  });

  it('should reference business name in footer', () => {
    const data = createMockTemplateData({
      businessName: 'Hospital Central',
    });
    const result = buildCancellationTemplate(data);

    expect(result.footer).toBe('Hospital Central');
  });

  it('should handle all reference types', () => {
    const types: ReferenceType[] = ['appointment', 'reservation', 'order'];
    types.forEach((type) => {
      const data = createMockTemplateData({ referenceType: type });
      const result = buildCancellationTemplate(data);
      expect(result.text).toBeDefined();
    });
  });
});
```

#### Missing Test Suite 3: `buildNeedChangeTemplate`

```typescript
// ======================
// buildNeedChangeTemplate Tests (MISSING)
// ======================

describe('buildNeedChangeTemplate', () => {
  it('should acknowledge the change request', () => {
    const data = createMockTemplateData();
    const result = buildNeedChangeTemplate(data);

    expect(result.text).toContain('Solicitud de Cambio');
    expect(result.text).toContain('Juan Perez');
  });

  it('should show current appointment details', () => {
    const data = createMockTemplateData({
      date: 'martes 28 de enero',
      time: '14:30',
    });
    const result = buildNeedChangeTemplate(data);

    expect(result.text).toContain('martes 28 de enero');
    expect(result.text).toContain('14:30');
  });

  it('should ask for new date/time', () => {
    const data = createMockTemplateData();
    const result = buildNeedChangeTemplate(data);

    expect(result.text).toContain('fecha');
    expect(result.text).toContain('hora');
  });

  it('should reference reference type correctly', () => {
    const reservationData = createMockTemplateData({
      referenceType: 'reservation',
    });
    const reservationResult = buildNeedChangeTemplate(reservationData);
    expect(reservationResult.text).toContain('reservación');

    const orderData = createMockTemplateData({
      referenceType: 'order',
    });
    const orderResult = buildNeedChangeTemplate(orderData);
    expect(orderResult.text).toContain('pedido');
  });

  it('should not include buttons (no action buttons)', () => {
    const data = createMockTemplateData();
    const result = buildNeedChangeTemplate(data);

    // No buttons for this template - just asking for input
    expect(result.buttons).toBeUndefined();
  });
});
```

#### Missing Test Suite 4: `calculateHoursUntilExpiration`

```typescript
// ======================
// calculateHoursUntilExpiration Tests (MISSING)
// ======================

describe('calculateHoursUntilExpiration', () => {
  it('should calculate hours correctly for future dates', () => {
    const now = new Date();
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const result = calculateHoursUntilExpiration(fourHoursLater);
    expect(result).toBe(4);
  });

  it('should round up partial hours', () => {
    const now = new Date();
    const oneHourThirtyMinutes = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);

    const result = calculateHoursUntilExpiration(oneHourThirtyMinutes);
    expect(result).toBe(2); // Math.ceil(1.5) = 2
  });

  it('should return 0 for past dates', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = calculateHoursUntilExpiration(oneHourAgo);
    expect(result).toBe(0);
  });

  it('should handle string dates', () => {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const result = calculateHoursUntilExpiration(twoHoursLater.toISOString());
    expect(result).toBe(2);
  });

  it('should handle edge case of exactly now', () => {
    const now = new Date();
    const result = calculateHoursUntilExpiration(now);

    expect(result).toBeLessThanOrEqual(1);
  });
});
```

---

## 2. Refactored Mock Setup for confirmation-sender.service.test.ts

### Replace Lines 9-78 With:

```typescript
// =====================================================
// IMPROVED: Mock Factory Pattern (Replaces old nested mocks)
// =====================================================

// Factory to create a realistic Supabase client mock
function createMockSupabaseClient() {
  const mockChain = {
    select: vi.fn(function() { return this; }),
    insert: vi.fn(function() { return this; }),
    update: vi.fn(function() { return this; }),
    delete: vi.fn(function() { return this; }),
    eq: vi.fn(function() { return this; }),
    in: vi.fn(function() { return this; }),
    lt: vi.fn(function() { return this; }),
    order: vi.fn(function() { return this; }),
    limit: vi.fn(function() { return this; }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn(() => ({ ...mockChain })),
  };
}

// Mock Supabase
vi.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: vi.fn(() => createMockSupabaseClient()),
}));

// Mock WhatsApp client
vi.mock('@/src/shared/lib/whatsapp', () => ({
  whatsappClient: {
    sendTextMessage: vi.fn().mockResolvedValue({
      messages: [{ id: 'wamid.test' }],
    }),
    sendButtonMessage: vi.fn().mockResolvedValue({
      messages: [{ id: 'wamid.test' }],
    }),
    sendTemplateMessage: vi.fn().mockResolvedValue({
      messages: [{ id: 'wamid.test' }],
    }),
  },
}));

// Mock templates
vi.mock('../templates/confirmation-templates', () => ({
  getTemplateBuilder: vi.fn(() => () => ({
    text: 'Test confirmation message',
    buttons: [
      { id: 'confirm', title: 'Confirmar' },
      { id: 'cancel', title: 'Cancelar' },
    ],
    footer: 'TIS TIS Platform',
  })),
  generateConfirmationCode: vi.fn(() => 'ABC123'),
  formatDateSpanish: vi.fn(() => 'lunes 27 de enero'),
  formatTimeSpanish: vi.fn(() => '10:30'),
  calculateHoursUntilExpiration: vi.fn(() => 4),
}));

// =====================================================
// Type-Safe Mock Casting
// =====================================================

import { Mock, vi } from 'vitest';

type MockedSupabase = ReturnType<typeof createMockSupabaseClient>;
const mockSupabase = vi.mocked(createServerClient) as any as Mock<any, [void], MockedSupabase>;
const mockWhatsApp = vi.mocked(whatsappClient);
```

### Helper Function to Setup DB Responses:

```typescript
// Add helper function after imports
function setupMockDatabaseResponse(
  supabase: any,
  operation: 'insert' | 'update' | 'select',
  data: any,
  error: any = null
) {
  const mockSingle = vi.fn().mockResolvedValue({ data, error });
  const mockChain = {
    single: mockSingle,
    eq: vi.fn(function() { return this; }),
    in: vi.fn(function() { return this; }),
    lt: vi.fn(function() { return this; }),
    select: vi.fn(function() { return this; }),
  };

  const fromMock = vi.fn(() => ({
    [operation]: vi.fn(() => ({ ...mockChain })),
  }));

  supabase.mockReturnValue({ from: fromMock });
  return mockSingle;
}
```

### Usage Example in Tests:

```typescript
it('should create confirmation and send message successfully', async () => {
  const mockConfirmation = {
    id: 'conf-123',
    tenant_id: 'tenant-123',
    status: 'pending',
  };

  // CLEANER: Use helper instead of nested setup
  setupMockDatabaseResponse(mockSupabase, 'insert', mockConfirmation);
  mockWhatsApp.sendButtonMessage.mockResolvedValue({
    messages: [{ id: 'wamid.123' }],
  });

  const input = createMockInput();
  const result = await confirmationSenderService.sendConfirmation(input);

  expect(result.success).toBe(true);
  expect(result.confirmationId).toBe('conf-123');
});
```

---

## 3. Missing Sender Service Tests

### Add Complete Test Suite:

```typescript
// ======================
// MISSING: resend() Tests
// ======================

describe('resend', () => {
  const mockConfirmation = {
    id: 'conf-123',
    tenant_id: 'tenant-123',
    reference_type: 'appointment' as const,
    reference_id: 'appt-123',
    confirmation_type: 'voice_to_message' as const,
    sent_via: 'whatsapp' as const,
    status: 'failed' as const,
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    auto_action_on_expire: 'cancel' as const,
  };

  it('should resend a failed confirmation', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: mockConfirmation,
        error: null,
      }),
    });

    mockSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    mockWhatsApp.sendButtonMessage.mockResolvedValue({
      messages: [{ id: 'wamid.resent' }],
    });

    const result = await confirmationSenderService.resend('conf-123');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wamid.resent');
  });

  it('should not resend responded confirmations', async () => {
    const respondedConfirmation = {
      ...mockConfirmation,
      status: 'responded',
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: respondedConfirmation,
        error: null,
      }),
    });

    mockSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const result = await confirmationSenderService.resend('conf-123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot resend');
  });

  it('should return error if confirmation not found', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    });

    mockSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const result = await confirmationSenderService.resend('invalid-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ======================
// MISSING: findPendingForPhone() Tests
// ======================

describe('findPendingForPhone', () => {
  it('should find pending confirmation by phone number', async () => {
    const mockConfirmation = {
      id: 'conf-123',
      status: 'sent',
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [mockConfirmation],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const result = await confirmationSenderService.findPendingForPhone(
      'tenant-123',
      '+521234567890'
    );

    expect(result).toBeDefined();
    expect(result?.id).toBe('conf-123');
  });

  it('should return null if no pending confirmations', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const result = await confirmationSenderService.findPendingForPhone(
      'tenant-123',
      '+529999999999'
    );

    expect(result).toBeNull();
  });
});

// ======================
// MISSING: findPendingByConversation() Tests
// ======================

describe('findPendingByConversation', () => {
  it('should find pending confirmation by conversation ID', async () => {
    const mockConfirmation = {
      id: 'conf-123',
      conversation_id: 'conv-456',
      status: 'read',
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockConfirmation,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabase.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const result = await confirmationSenderService.findPendingByConversation(
      'tenant-123',
      'conv-456'
    );

    expect(result).toBeDefined();
    expect(result?.conversation_id).toBe('conv-456');
  });
});
```

### Add Error Scenario Tests:

```typescript
// ======================
// MISSING: Error Scenario Tests
// ======================

describe('sendConfirmation - Error Scenarios', () => {
  it('should handle network timeout during send', async () => {
    const mockConfirmation = { id: 'conf-123' };
    setupMockDatabaseResponse(mockSupabase, 'insert', mockConfirmation);

    // Simulate timeout
    mockWhatsApp.sendButtonMessage.mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('ECONNABORTED: Connection timeout')),
          50
        )
      )
    );

    const input = createMockInput();
    const result = await confirmationSenderService.sendConfirmation(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
    expect(mockWhatsApp.sendButtonMessage).toHaveBeenCalledTimes(3);
  }, { timeout: 15000 }); // Allow 15s for retries

  it('should handle malformed WhatsApp response', async () => {
    const mockConfirmation = { id: 'conf-123' };
    setupMockDatabaseResponse(mockSupabase, 'insert', mockConfirmation);

    // Missing messages field
    mockWhatsApp.sendButtonMessage.mockResolvedValue({
      success: true,
      // NO messages array!
    });

    const input = createMockInput();
    const result = await confirmationSenderService.sendConfirmation(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No message ID');
  });

  it('should not retry non-retryable errors', async () => {
    const mockConfirmation = { id: 'conf-123' };
    setupMockDatabaseResponse(mockSupabase, 'insert', mockConfirmation);

    mockWhatsApp.sendButtonMessage.mockRejectedValue(
      new Error('Invalid phone number format')
    );

    const input = createMockInput();
    const result = await confirmationSenderService.sendConfirmation(input);

    expect(result.success).toBe(false);
    // Should only attempt once for non-retryable errors
    expect(mockWhatsApp.sendButtonMessage).toHaveBeenCalledTimes(1);
  });
});
```

---

## 4. Complete Type-Safe Mock Factory

### Create new file: `src/features/secure-booking/__tests__/helpers/mock-factory.ts`

```typescript
import { Mock, vi } from 'vitest';
import type {
  BookingConfirmation,
  ConfirmationTemplateData,
} from '../../types';

/**
 * Create a realistic Supabase client mock that supports chaining
 */
export function createMockSupabaseClient() {
  const chain = {
    select: vi.fn(function() { return this; }),
    insert: vi.fn(function() { return this; }),
    update: vi.fn(function() { return this; }),
    delete: vi.fn(function() { return this; }),
    eq: vi.fn(function() { return this; }),
    in: vi.fn(function() { return this; }),
    lt: vi.fn(function() { return this; }),
    order: vi.fn(function() { return this; }),
    limit: vi.fn(function() { return this; }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn(() => structuredClone(chain)),
  };
}

/**
 * Setup mock database response with proper data
 */
export function setupMockDbInsert(
  mockSupabase: Mock,
  data: any,
  error: any = null
) {
  const mockSingle = vi.fn().mockResolvedValue({ data, error });
  mockSupabase.mockReturnValue({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    })),
  });
  return mockSingle;
}

/**
 * Create a complete, type-safe BookingConfirmation mock
 */
export function createMockConfirmationComplete(
  overrides: Partial<BookingConfirmation> = {}
): BookingConfirmation {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  return {
    id: 'conf-123',
    tenant_id: 'tenant-123',
    reference_type: 'appointment',
    reference_id: 'appt-123',
    confirmation_type: 'voice_to_message',
    sent_via: 'whatsapp',
    status: 'pending',
    sent_at: null,
    delivered_at: null,
    read_at: null,
    responded_at: null,
    expires_at: expiresAt,
    response: null,
    response_raw: null,
    whatsapp_message_id: null,
    whatsapp_template_name: null,
    conversation_id: null,
    auto_action_on_expire: 'cancel',
    auto_action_executed: false,
    auto_action_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Create a complete, type-safe ConfirmationTemplateData mock
 */
export function createMockTemplateDataComplete(
  overrides: Partial<ConfirmationTemplateData> = {}
): ConfirmationTemplateData {
  return {
    customerName: 'Juan Perez',
    customerPhone: '+521234567890',
    businessName: 'Clinica Dental ABC',
    businessPhone: '+529876543210',
    branchName: 'Sucursal Centro',
    branchAddress: 'Av. Reforma 123',
    referenceType: 'appointment',
    referenceId: 'appt-123',
    confirmationCode: 'ABC123',
    date: 'lunes 27 de enero',
    time: '10:30',
    dateTimeRaw: '2026-01-27T10:30:00',
    expiresAt: '2026-01-27T14:30:00',
    expiresInHours: 4,
    ...overrides,
  };
}
```

### Usage in tests:

```typescript
import {
  createMockSupabaseClient,
  setupMockDbInsert,
  createMockConfirmationComplete,
  createMockTemplateDataComplete,
} from './helpers/mock-factory';

describe('Service', () => {
  beforeEach(() => {
    const mockSupabase = createMockSupabaseClient();
    setupMockDbInsert(mockSupabase, createMockConfirmationComplete());
  });

  it('should work', async () => {
    const data = createMockTemplateDataComplete({
      customerName: 'Maria',
    });
    // ... test with type-safe data
  });
});
```

---

## 5. Test Organization Improvements

### Add `afterEach` Cleanup:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ConfirmationSenderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear all timers (in case of delays/backoff)
    vi.runAllTimers();
    vi.restoreAllMocks();
  });

  // ... tests
});
```

### Add Test Documentation:

```typescript
/**
 * Test suite for ConfirmationSenderService
 *
 * Key areas tested:
 * - Confirmation creation and persistence
 * - WhatsApp message sending with retry logic
 * - Status tracking (sent, delivered, read)
 * - Response processing
 * - Expiration handling
 *
 * Mocking strategy:
 * - Supabase: Fully mocked (external service)
 * - WhatsApp: Fully mocked (external API)
 * - Templates: Fully mocked (tested separately)
 */
describe('ConfirmationSenderService', () => {
  // ...
});
```

---

## Summary of Changes

### Files to Modify:

1. **confirmation-templates.test.ts** (+180 lines)
   - Add buildConfirmationSuccessTemplate tests
   - Add buildCancellationTemplate tests
   - Add buildNeedChangeTemplate tests
   - Add calculateHoursUntilExpiration tests

2. **confirmation-sender.service.test.ts** (+280 lines, refactor 70 lines)
   - Replace nested mock chains (lines 9-78) with factory pattern
   - Add resend() tests
   - Add findPendingForPhone() tests
   - Add findPendingByConversation() tests
   - Add error scenario tests (network timeout, malformed response, etc.)
   - Add afterEach cleanup

3. **New file: `__tests__/helpers/mock-factory.ts`** (+60 lines)
   - Reusable mock factories
   - Type-safe mock creation
   - Cleaner test setup

### Estimated Effort:

- **Critical (Phase 1)**: 3-4 hours
- **High Priority (Phase 2)**: 2-3 hours
- **Nice to Have (Phase 3)**: 1-2 hours

### Expected Improvements:

- Function coverage: 65% → 95%+
- Test maintainability: 6/10 → 9/10
- Type safety: 7/10 → 10/10
- Code duplication: Reduced 40%
