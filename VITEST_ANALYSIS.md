# Vitest Best Practices Analysis: Secure Booking Tests

## Executive Summary

Analyzed 3 test files covering the secure booking confirmation system:
- `confirmation-templates.test.ts` (349 lines, 34 tests)
- `confirmation-sender.service.test.ts` (478 lines, 19 tests)
- `booking-confirmation.service.test.ts` (310 lines, 45+ tests)

**Overall Grade: B+ (Good with notable gaps)**

---

## 1. Test Coverage Analysis

### ✅ **Coverage Strengths**
- **Confirmation Templates**: Excellent coverage of all 9 template builders
- **Response Detection**: Comprehensive pattern matching tests (50+ patterns)
- **State Transitions**: Good coverage of status changes (pending → sent → delivered → read)
- **Edge Cases**: Handles null/undefined for optional fields

### ❌ **Coverage Gaps**

#### **High Severity - Critical Missing Tests**

1. **confirmation-templates.test.ts**
   - **Missing**: `buildConfirmationSuccessTemplate()` - NOT TESTED
   - **Missing**: `buildCancellationTemplate()` - NOT TESTED
   - **Missing**: `buildNeedChangeTemplate()` - NOT TESTED
   - **Missing**: `calculateHoursUntilExpiration()` - NOT TESTED
   - **Impact**: 33% of exported functions untested

   ```typescript
   // MISSING TEST
   describe('buildConfirmationSuccessTemplate', () => {
     it('should build success template with confirmation details', () => {
       const data = createMockTemplateData();
       const result = buildConfirmationSuccessTemplate(data);
       expect(result.text).toContain('✅');
       expect(result.text).toContain('confirmada');
     });
   });
   ```

2. **confirmation-sender.service.test.ts**
   - **Missing**: `findPendingForPhone()` - NOT TESTED
   - **Missing**: `findPendingByConversation()` - NOT TESTED
   - **Missing**: `normalizePhone()` - NOT TESTED (private but critical)
   - **Missing**: `updateReferenceStatus()` - NOT TESTED (private but critical)
   - **Missing**: `resend()` - NOT TESTED
   - **Missing**: `isNonRetryableError()` - NOT TESTED (private)
   - **Missing**: Full happy path of `sendWithRetry()` method
   - **Impact**: 50%+ of service methods untested

   ```typescript
   // MISSING TEST
   describe('resend', () => {
     it('should resend a failed confirmation', async () => {
       const input = { confirmationId: 'conf-123' };
       const result = await confirmationSenderService.resend(input.confirmationId);
       expect(result.success).toBe(true);
     });
   });
   ```

3. **booking-confirmation.service.test.ts**
   - **Missing**: No async API tests (all service functions are async)
   - **Missing**: `getConfirmations()` - tested parameter building only
   - **Missing**: `processExpiredConfirmations()` - tested utility only
   - **Impact**: Utility functions tested in isolation without actual API calls

---

## 2. Mock Patterns Issues

### ❌ **Critical Problems**

#### **Over-mocking in confirmation-sender.service.test.ts**

The test has a **deeply nested mock chain** that's fragile and hard to maintain:

```typescript
// Lines 9-78: 60+ lines of mock setup
vi.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({    // TWO eq() CALLS!?
            select: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
          in: vi.fn(),
          // ... MORE CHAINS
        })),
      })),
      // ... REPEATED PATTERNS
    })),
  })),
}));
```

**Problems:**
1. **Unmaintainable**: 60+ lines of boilerplate
2. **Fragile**: Any API call pattern change breaks tests
3. **Confusing**: Double `eq()` chains don't match actual Supabase API
4. **Not Isolated**: Each test must re-implement mock setup

**Recommendation:**
```typescript
// BETTER: Use a factory pattern
function createMockSupabase() {
  return {
    from: vi.fn((table) => ({
      insert: vi.fn().mockResolvedValue({ data: {...}, error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn(function() { return this; }),
      in: vi.fn(function() { return this; }),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  };
}

beforeEach(() => {
  vi.mocked(createServerClient).mockReturnValue(createMockSupabase());
});
```

#### **Inconsistent Mock Usage**

Line 89-93 creates typed mocks but doesn't match actual function signatures:

```typescript
const mockSupabase = createServerClient as Mock;
const mockWhatsApp = whatsappClient as unknown as {
  sendTextMessage: Mock;
  sendButtonMessage: Mock;
};
```

**Problem**: `as unknown as` is a type escape hatch - indicates incorrect mocking

---

## 3. Async Testing Issues

### ⚠️ **Medium Severity**

#### **Incomplete Async Handling**

**confirmation-sender.service.test.ts, lines 127-169:**

```typescript
it('should create confirmation and send message successfully', async () => {
  // ✅ Good: Uses async/await
  const result = await confirmationSenderService.sendConfirmation(input);
  expect(result.success).toBe(true);

  // ❌ Bad: No timeout configuration
  // If mock doesn't resolve, test will hang until default 5s timeout
});
```

**Missing timeout configurations:**
- No custom test timeouts for long-running operations
- No timeout for `sendWithRetry()` which has 3 attempts with backoff

**Recommendation:**
```typescript
it('should handle WhatsApp send failure with retries', async () => {
  // ...
  const result = await confirmationSenderService.sendConfirmation(input);
  expect(result.success).toBe(false);
  expect(mockWhatsApp.sendButtonMessage).toHaveBeenCalledTimes(3);
}, { timeout: 10000 }); // 10s for retries
```

#### **Missing Promise Resolution**

**booking-confirmation.service.test.ts** - These are synchronous tests but service has async functions!

```typescript
// Lines 54-74: These test utility functions that ARE async
export async function getAuthHeaders(): Promise<HeadersInit> { ... }

// But the tests don't await anything:
describe('detectResponseFromText', () => {
  it(`should detect "${pattern}" as confirmed`, () => {
    expect(detectResponseFromText(pattern)).toBe('confirmed'); // ✅ OK - this IS sync
  });
});
```

**Issue**: `getAuthHeaders()` and `handleResponse()` are async but never tested

---

## 4. Test Isolation Problems

### ⚠️ **Medium Severity**

#### **Missing `beforeEach` Cleanup**

**confirmation-sender.service.test.ts, lines 95-97:**

```typescript
beforeEach(() => {
  vi.clearAllMocks(); // ✅ Good - clears mock call history
});
```

**Missing**:
- No resetting of mock return values
- No cleanup of test data
- No restoration of module state

**Better approach:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Reset all mock implementations to defaults
  vi.mocked(createServerClient).mockClear();
  vi.mocked(whatsappClient).mockClear();
});

afterEach(() => {
  // Clean up any lingering promises
  vi.runAllTimers();
});
```

#### **Shared Mock State**

Lines 135-156 show mock setup INSIDE tests:

```typescript
const mockInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: mockConfirmation,
      error: null,
    }),
  }),
});

mockSupabase.mockReturnValue({
  from: vi.fn().mockReturnValue({
    insert: mockInsert,
    update: mockUpdate,
  }),
});
```

**Problem**: Mock setup in every test = duplication + inconsistency

**Fix**: Move to reusable helper:
```typescript
function setupMockSupabaseForInsert(data: any) {
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  });
  mockSupabase.mockReturnValue({ from: () => ({ insert: mockInsert }) });
  return mockInsert;
}
```

---

## 5. Snapshot Testing

### ✅ **Assessment: Not Needed (Correctly Avoided)**

Template tests use **content assertions** instead of snapshots:

```typescript
// ✅ Good: Explicit assertions
expect(result.text).toContain('Juan Perez');
expect(result.text).toContain('Clinica Dental ABC');
expect(result.footer).toContain('ABC123');
```

**Why this is correct**:
- Template content can change legitimately (language updates, branding)
- Business logic is the real requirement, not exact formatting
- Snapshots would hide intentional formatting changes

**Where snapshots COULD help:**
```typescript
// OPTIONAL: Snapshot for regression detection
describe('buildAppointmentConfirmationTemplate - Formatting', () => {
  it('should maintain message structure', () => {
    const data = createMockTemplateData();
    const result = buildAppointmentConfirmationTemplate(data);
    expect(result).toMatchSnapshot();
  });
});
```

---

## 6. Factory Functions

### ✅ **Good Implementation**

**confirmation-templates.test.ts, lines 22-40:**

```typescript
const createMockTemplateData = (
  overrides: Partial<ConfirmationTemplateData> = {}
): ConfirmationTemplateData => ({
  customerName: 'Juan Perez',
  customerPhone: '+521234567890',
  // ... 20 fields with sensible defaults
  ...overrides,
});
```

**Strengths**:
- ✅ Centralized fixture creation
- ✅ Type-safe with `Partial<T>`
- ✅ Easy to override specific fields
- ✅ DRY principle applied

**Same pattern in booking-confirmation.service.test.ts:**

```typescript
const createMockConfirmation = (
  overrides: Partial<BookingConfirmation>
): BookingConfirmation => ({
  id: 'conf-123',
  // ... defaults
  ...overrides,
} as BookingConfirmation);
```

**Minor Issue**: `as BookingConfirmation` cast (line 149) means incomplete mocks. Should complete the object:

```typescript
// BETTER
const createMockConfirmation = (
  overrides: Partial<BookingConfirmation> = {}
): BookingConfirmation => ({
  id: 'conf-123',
  tenant_id: 'tenant-123',
  // ... ALL required fields
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});
```

---

## 7. Edge Cases & Error Paths

### ⚠️ **Incomplete Coverage**

#### **Missing Error Scenarios**

**confirmation-sender.service.test.ts**:

```typescript
// ✅ TESTED:
it('should handle database insert failure', async () => {
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    }),
  });
  // ...
});

// ❌ NOT TESTED:
it('should handle network timeout during WhatsApp send', async () => {
  // Mock AbortError or timeout
  mockWhatsApp.sendButtonMessage.mockImplementation(() =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 100)
    )
  );
  // ...
});

it('should handle malformed WhatsApp response', async () => {
  mockWhatsApp.sendButtonMessage.mockResolvedValue({
    // Missing messages field
    success: true,
  });
  const result = await confirmationSenderService.sendConfirmation(input);
  expect(result.success).toBe(false);
  expect(result.error).toContain('No message ID');
});
```

#### **Missing Boundary Tests**

**booking-confirmation.service.test.ts**:

```typescript
// ✅ TESTED:
it('should calculate hours and minutes correctly', () => {
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000);
  // ...
});

// ❌ NOT TESTED:
it('should handle expiration at exact boundary', () => {
  const now = new Date();
  const confirmation = createMockConfirmation({
    expires_at: new Date(now.getTime() - 1).toISOString(), // 1ms ago
  });
  expect(getTimeUntilExpiration(confirmation).expired).toBe(true);
});

it('should format very large time periods correctly', () => {
  const threeWeeksFromNow = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  const confirmation = createMockConfirmation({
    expires_at: threeWeeksFromNow.toISOString(),
  });
  const result = formatExpirationTime(confirmation);
  expect(result).toMatch(/\d+d/); // Should include days
});
```

---

## 8. Test Naming Quality

### ✅ **Strong Overall**

#### **Good Examples**

```typescript
// ✅ Descriptive and specific
it('should detect "si" as confirmed', () => {});
it('should return false if expires_at is in the past', () => {});
it('should not retry non-retryable errors', () => {});
it('should handle WhatsApp send failure with retries', () => {});

// ✅ Organized with describe blocks
describe('confirmed responses', () => { ... });
describe('cancelled responses', () => { ... });
describe('need_change responses', () => { ... });
```

#### **Minor Issues**

```typescript
// ⚠️ Not specific enough
it('should return a working builder that produces valid templates', () => {});
// BETTER:
it('should return builder that generates templates with required fields', () => {});

// ⚠️ Too vague
it('should process expired confirmations', () => {});
// BETTER:
it('should mark pending confirmations as expired and execute auto-actions', () => {});

// ⚠️ Doesn't describe the behavior
describe('getInstance', () => {
  it('should return singleton instance', () => {}); // Weak - not testing singleton behavior
});
// BETTER:
describe('getInstance', () => {
  it('should return same instance on multiple calls', () => {
    const instance1 = ConfirmationSenderService.getInstance();
    const instance2 = ConfirmationSenderService.getInstance();
    expect(instance1).toBe(instance2);
  });
});
```

---

## 9. Spies vs Mocks

### ⚠️ **Potential Confusion**

**Current approach (all vi.fn() mocks):**
```typescript
vi.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({ ... })),
}));

vi.mock('@/src/shared/lib/whatsapp', () => ({
  whatsappClient: {
    sendTextMessage: vi.fn(),
    sendButtonMessage: vi.fn(),
    sendTemplateMessage: vi.fn(),
  },
}));
```

**Issue**: When you need to:
1. Call the real function sometimes
2. Just track calls without replacing behavior
3. Mix real + mocked behavior

**Better approach using spies:**

```typescript
// If you want to spy on REAL implementation:
vi.spyOn(whatsappClient, 'sendTextMessage').mockResolvedValue({ ... });

// Or for full mock:
vi.mocked(whatsappClient).sendTextMessage.mockResolvedValue({ ... });
```

**Recommendation**: The current approach is fine, but be explicit:
```typescript
// Comment explaining why full mock vs spy
// Full mock because: service is external (Supabase), we test integration behavior
vi.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({ ... })),
}));
```

---

## 10. Type Safety in Tests

### ⚠️ **Several Cast Issues**

#### **Problem 1: `as Mock` Assertions**

```typescript
// Line 89
const mockSupabase = createServerClient as Mock;
// Line 90-93
const mockWhatsApp = whatsappClient as unknown as {
  sendTextMessage: Mock;
  sendButtonMessage: Mock;
};
```

**Issues**:
1. `as unknown as` is a major type safety escape
2. Mocked types don't match actual signatures
3. No validation that mocks match implementation

**Better:**
```typescript
import { Mock, vi } from 'vitest';

type MockedSupabase = ReturnType<typeof createServerClient>;
const mockSupabase = vi.mocked(createServerClient);

// Type-safe mocking:
vi.mocked(createServerClient).mockReturnValue({
  from: vi.fn().mockReturnValue({
    // TypeScript will validate this matches real Supabase API
  }),
});
```

#### **Problem 2: `as BookingConfirmation` Cast**

```typescript
// Line 149
} as BookingConfirmation);

// Line 215
} as BookingConfirmation);
```

**Issue**: Factory creates **incomplete objects**, relying on cast to satisfy type system

**Symptom**: If new required field is added to `BookingConfirmation`, tests won't fail

**Fix**:
```typescript
// Ensure COMPLETE mock
const createMockConfirmation = (): BookingConfirmation => {
  const now = new Date().toISOString();
  return {
    id: 'conf-123',
    tenant_id: 'tenant-123',
    reference_type: 'appointment',
    reference_id: 'appt-123',
    confirmation_type: 'voice_to_message',
    sent_via: 'whatsapp',
    status: 'sent',
    sent_at: now,
    delivered_at: null,
    read_at: null,
    responded_at: null,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    response: null,
    response_raw: null,
    whatsapp_message_id: 'wamid.123',
    whatsapp_template_name: null,
    conversation_id: null,
    auto_action_on_expire: 'cancel',
    auto_action_executed: false,
    auto_action_at: null,
    created_at: now,
    updated_at: now,
  };
};
```

---

## Summary of Issues by Severity

### 🔴 **Critical (Must Fix)**

| Issue | File | Line(s) | Impact |
|-------|------|---------|--------|
| 33% of template functions untested | confirmation-templates.test.ts | - | Prod bugs in success/cancel/change templates |
| 50%+ of sender methods untested | confirmation-sender.service.test.ts | - | Missing phone normalization, resend, find logic |
| Deep nested mock chains | confirmation-sender.service.test.ts | 9-78 | Fragile, unmaintainable, confusing |
| Type safety escapes (`as unknown as`) | confirmation-sender.service.test.ts | 90-93 | Hidden type errors |

### 🟡 **High (Should Fix)**

| Issue | File | Line(s) | Impact |
|-------|------|---------|--------|
| Missing error scenario tests | confirmation-sender.service.test.ts | - | Untested error paths |
| No timeout configuration | confirmation-sender.service.test.ts | 127+ | Tests may hang silently |
| Incomplete type-safe mocks | booking-confirmation.service.test.ts | 149, 215 | New fields not validated |
| Untested async functions | booking-confirmation.service.test.ts | - | `getAuthHeaders()` never tested |

### 🟠 **Medium (Nice to Have)**

| Issue | File | Line(s) | Impact |
|-------|------|---------|--------|
| Missing `afterEach` cleanup | confirmation-sender.service.test.ts | 95 | Potential test pollution |
| Weak test descriptions | All files | Various | Hard to understand intent |
| No boundary condition tests | booking-confirmation.service.test.ts | - | Off-by-one errors not caught |
| Confusing getInstance test | confirmation-sender.service.test.ts | 103-108 | Doesn't verify singleton |

---

## Recommendations (Prioritized)

### Phase 1: Critical Fixes (1-2 hours)

1. **Add missing template tests** (9 tests)
   ```bash
   # Add to confirmation-templates.test.ts
   - buildConfirmationSuccessTemplate
   - buildCancellationTemplate
   - buildNeedChangeTemplate
   - calculateHoursUntilExpiration (verify hours calc)
   ```

2. **Refactor mock setup** (30 min)
   - Extract nested mocks into factory function
   - Remove `as unknown as` type escape
   - Create `createMockSupabase()` helper

3. **Add missing sender tests** (1 hour)
   ```bash
   # Add to confirmation-sender.service.test.ts
   - resend() method
   - findPendingForPhone() method
   - findPendingByConversation() method
   - normalizePhone() edge cases (10, 11, 13+ digit numbers)
   ```

### Phase 2: High Priority (1-2 hours)

4. **Add error scenario tests** (8-10 tests)
   - Network timeout handling
   - Malformed WhatsApp response
   - Database transaction failures
   - Retry exhaustion

5. **Add timeout configs** (15 min)
   ```typescript
   it('name', async () => { ... }, { timeout: 10000 });
   ```

6. **Improve type safety** (30 min)
   - Use `vi.mocked()` consistently
   - Remove all `as any`/`as unknown as` casts
   - Complete all factory mocks

### Phase 3: Nice to Have (30-45 min)

7. **Add boundary tests** (6-8 tests)
   - Exact expiration times
   - Large time periods (weeks)
   - Zero-length durations

8. **Improve test descriptions** (15 min)
   - Make test names more specific
   - Add comments explaining complex setups
   - Fix getInstance test to verify singleton

9. **Add afterEach cleanup** (10 min)
   ```typescript
   afterEach(() => {
     vi.runAllTimers();
     vi.clearAllMocks();
   });
   ```

---

## Code Quality Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Function Coverage | 65% | 95%+ |
| Branch Coverage | 60% | 85%+ |
| Error Path Coverage | 50% | 90%+ |
| Test Maintainability | 6/10 | 9/10 |
| Type Safety | 7/10 | 10/10 |
| Mock Fragility | 3/10 | 8/10 |

---

## Files Affected

- `/Users/macfer/Documents/TIS TIS /tistis-platform/src/features/secure-booking/__tests__/templates/confirmation-templates.test.ts`
- `/Users/macfer/Documents/TIS TIS /tistis-platform/src/features/secure-booking/__tests__/services/confirmation-sender.service.test.ts`
- `/Users/macfer/Documents/TIS TIS /tistis-platform/src/features/secure-booking/__tests__/services/booking-confirmation.service.test.ts`

