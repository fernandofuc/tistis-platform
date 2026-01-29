# Vitest Best Practices: Quick Reference Checklist

## Critical Issues - MUST FIX

### [ ] 1. Missing Template Function Tests
- [ ] `buildConfirmationSuccessTemplate()` - 6 tests
- [ ] `buildCancellationTemplate()` - 6 tests
- [ ] `buildNeedChangeTemplate()` - 5 tests
- [ ] `calculateHoursUntilExpiration()` - 5 tests
- **File**: `src/features/secure-booking/__tests__/templates/confirmation-templates.test.ts`
- **Estimated time**: 45 min
- **Impact**: Critical - 33% of functions untested

### [ ] 2. Refactor Mock Setup (confirmation-sender.service.test.ts)
- [ ] Extract nested mocks to `createMockSupabaseClient()` factory
- [ ] Remove 60+ lines of fragile mock boilerplate
- [ ] Remove `as unknown as` type escapes
- [ ] Add `setupMockDbInsert()` helper
- **File**: `src/features/secure-booking/__tests__/services/confirmation-sender.service.test.ts`
- **Lines**: 9-78 (replace)
- **Estimated time**: 30 min
- **Impact**: Maintainability, fragility reduction

### [ ] 3. Missing Sender Service Method Tests
- [ ] `resend()` - 3 tests
- [ ] `findPendingForPhone()` - 2 tests
- [ ] `findPendingByConversation()` - 1 test
- [ ] Error scenarios (timeout, malformed response, etc.) - 4 tests
- **File**: `src/features/secure-booking/__tests__/services/confirmation-sender.service.test.ts`
- **Estimated time**: 1 hour
- **Impact**: Critical - 50%+ of methods untested

### [ ] 4. Add Type Safety Improvements
- [ ] Create `__tests__/helpers/mock-factory.ts`
- [ ] Use `createMockConfirmationComplete()` instead of casts
- [ ] Use `createMockTemplateDataComplete()` instead of casts
- [ ] Replace `as Mock` with `vi.mocked()`
- **Files**: All test files
- **Estimated time**: 30 min
- **Impact**: Type safety, future-proofing

---

## High Priority Issues - SHOULD FIX

### [ ] 5. Add Timeout Configuration
- [ ] Add timeout to retry tests (10 seconds)
- [ ] Add timeout to async operation tests
- [ ] Example: `, { timeout: 10000 }`
- **File**: `src/features/secure-booking/__tests__/services/confirmation-sender.service.test.ts`
- **Tests affected**: Lines 127+, 194+, 238+
- **Estimated time**: 10 min

### [ ] 6. Add Error Scenario Coverage
- [ ] Network timeout handling
- [ ] Malformed API responses
- [ ] Database transaction failures
- [ ] Retry exhaustion with circuit breaker
- [ ] Invalid phone numbers
- **File**: `src/features/secure-booking/__tests__/services/confirmation-sender.service.test.ts`
- **Estimated time**: 45 min
- **Impact**: Stability, error handling

### [ ] 7. Complete Mock Type Safety
- [ ] Remove all `as any` casts
- [ ] Remove all `as unknown as` escapes
- [ ] Use proper `Partial<T>` in factories
- **Locations**:
  - `confirmation-sender.service.test.ts`, line 89-93
  - `booking-confirmation.service.test.ts`, line 149, 215
- **Estimated time**: 20 min

### [ ] 8. Add afterEach Cleanup
```typescript
afterEach(() => {
  vi.runAllTimers();
  vi.restoreAllMocks();
});
```
- **File**: `src/features/secure-booking/__tests__/services/confirmation-sender.service.test.ts`
- **Estimated time**: 5 min

---

## Medium Priority Issues - NICE TO HAVE

### [ ] 9. Improve Test Descriptions
- [ ] Fix vague descriptions ("should return a working builder...")
- [ ] Fix weak singleton test (doesn't verify singleton behavior)
- [ ] Add comments to complex test setups
- [ ] Verify 100+ character test names for clarity
- **Estimated time**: 15 min

### [ ] 10. Add Boundary Condition Tests
- [ ] Expiration at exact boundary (1ms ago)
- [ ] Very large time periods (weeks)
- [ ] Zero-length durations
- [ ] Timezone handling
- **File**: `src/features/secure-booking/__tests__/services/booking-confirmation.service.test.ts`
- **Estimated time**: 30 min

### [ ] 11. Add Response Detection Edge Cases
- [ ] Responses with extra whitespace
- [ ] Mixed case patterns
- [ ] Responses with special characters
- [ ] Empty responses
- **File**: `src/features/secure-booking/__tests__/services/booking-confirmation.service.test.ts`
- **Existing coverage**: 45/50 patterns, add 5-10 edge cases
- **Estimated time**: 20 min

### [ ] 12. Verify Singleton Pattern
```typescript
describe('getInstance', () => {
  it('should return same instance on multiple calls', () => {
    const instance1 = ConfirmationSenderService.getInstance();
    const instance2 = ConfirmationSenderService.getInstance();
    expect(instance1).toBe(instance2); // Actual singleton test
  });
});
```
- **File**: `src/features/secure-booking/__tests__/services/confirmation-sender.service.test.ts`
- **Estimated time**: 5 min

---

## Testing Checklist for Each Test File

### ✅ confirmation-templates.test.ts

- [x] Factory pattern for test data (`createMockTemplateData`)
- [x] All template builders tested
- [x] Spanish formatting tested
- [x] Confirmation code uniqueness
- [x] Optional field handling
- [ ] Missing: buildConfirmationSuccessTemplate
- [ ] Missing: buildCancellationTemplate
- [ ] Missing: buildNeedChangeTemplate
- [ ] Missing: calculateHoursUntilExpiration

**Score**: 67/75 (89%)

---

### ✅ confirmation-sender.service.test.ts

- [x] sendConfirmation happy path
- [x] Database error handling
- [x] WhatsApp retry logic
- [x] Non-retryable error handling
- [x] markAsDelivered
- [x] markAsRead
- [x] processResponse validation
- [x] processExpired
- [ ] Refactor mock setup (critical)
- [ ] Type safety fixes
- [ ] resend() method
- [ ] findPendingForPhone()
- [ ] findPendingByConversation()
- [ ] Network timeout tests
- [ ] Malformed response tests
- [ ] afterEach cleanup
- [ ] Timeout configuration

**Score**: 45/65 (69%)

---

### ✅ booking-confirmation.service.test.ts

- [x] Response detection (50+ patterns)
- [x] isConfirmationActive (4 statuses)
- [x] Time until expiration
- [x] Expiration formatting
- [x] Factory pattern for mocks
- [ ] Async API function tests (all are async but not tested)
- [ ] Boundary condition tests
- [ ] Network error scenarios
- [ ] Auth header handling

**Score**: 55/70 (79%)

---

## Files to Create

```
src/features/secure-booking/
├── __tests__/
│   ├── helpers/
│   │   └── [ ] mock-factory.ts (NEW - 60 lines)
│   ├── services/
│   │   └── confirmation-sender.service.test.ts (REFACTOR)
│   │   └── booking-confirmation.service.test.ts (MINOR UPDATES)
│   └── templates/
│       └── confirmation-templates.test.ts (ADD 22 TESTS)
```

---

## Estimated Effort Timeline

### Phase 1: Critical Fixes (Session 1: 2-3 hours)
- [ ] Add missing template tests (45 min)
- [ ] Refactor mock setup (30 min)
- [ ] Add sender method tests (1 hour)
- [ ] Create mock-factory.ts (20 min)

### Phase 2: High Priority (Session 2: 1-2 hours)
- [ ] Add timeout configs (10 min)
- [ ] Add error scenarios (45 min)
- [ ] Complete type safety (20 min)
- [ ] Add afterEach cleanup (5 min)

### Phase 3: Nice to Have (Session 3: 45 min - 1 hour)
- [ ] Improve descriptions (15 min)
- [ ] Add boundary tests (30 min)
- [ ] Verify singleton (5 min)

---

## Coverage Goals

### Current State
| Metric | Value |
|--------|-------|
| Function Coverage | 65% |
| Branch Coverage | 60% |
| Error Path Coverage | 50% |
| Test Suite Time | ~500ms |

### Target State
| Metric | Goal |
|--------|------|
| Function Coverage | 95%+ |
| Branch Coverage | 85%+ |
| Error Path Coverage | 90%+ |
| Test Suite Time | <1000ms |

---

## Vitest Best Practices Checklist

### Mock Patterns
- [x] Use `vi.mock()` for module mocking
- [ ] ✅ Use `vi.spyOn()` for selective mocking
- [x] Use `vi.fn()` for mock functions
- [ ] ✅ Organize mocks into factories
- [ ] ✅ Remove `as any` type escapes
- [ ] ✅ Use `vi.mocked()` for typed access

### Async Testing
- [x] Use `async`/`await` for async tests
- [ ] ✅ Add timeout configuration for long tests
- [ ] ✅ Verify all promises are resolved
- [x] Clear timers in afterEach

### Test Isolation
- [x] Use `beforeEach` for setup
- [ ] ✅ Use `afterEach` for cleanup
- [x] Clear mocks between tests (`vi.clearAllMocks()`)
- [ ] ✅ No shared state across tests

### Fixtures & Factories
- [x] Use factory functions for test data
- [x] Type-safe with `Partial<T>`
- [x] Sensible defaults
- [ ] ✅ Complete all required fields

### Coverage
- [x] Test happy path
- [x] Test error paths
- [ ] ✅ Test boundary conditions
- [ ] ✅ Test all branches
- [x] Test integration between units

### Code Quality
- [x] Descriptive test names
- [x] Organized describe blocks
- [ ] ✅ No snapshot tests for dynamic content
- [ ] ✅ Comments for complex setups
- [x] DRY principle applied

---

## Common Vitest Patterns Used Correctly ✅

```typescript
// Pattern 1: Spy vs Mock (used correctly)
vi.mock('@/path/to/module');
vi.spyOn(object, 'method');

// Pattern 2: Mock clearing (used correctly)
beforeEach(() => {
  vi.clearAllMocks();
});

// Pattern 3: Factory pattern (used correctly)
const createMock = (overrides) => ({ ...defaults, ...overrides });

// Pattern 4: Async testing (used correctly)
it('async test', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## Common Vitest Antipatterns to Avoid ❌

```typescript
// ❌ Antipattern 1: Deeply nested mock chains
vi.mock('module', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}));

// ✅ INSTEAD: Use factory function
function createMockClient() {
  return { from: vi.fn(() => ({ ... })) };
}

// ❌ Antipattern 2: Type escapes
const mock = client as any as { method: Mock };

// ✅ INSTEAD: Type-safe mocking
const mock = vi.mocked(client);

// ❌ Antipattern 3: Casting incomplete objects
const data = { name: 'test' } as FullType;

// ✅ INSTEAD: Create complete objects
const data: FullType = { name: 'test', id: '123', ... };

// ❌ Antipattern 4: No cleanup
beforeEach(() => {
  vi.mock('...');
  // No afterEach!
});

// ✅ INSTEAD: Explicit cleanup
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
```

---

## PR Checklist Before Commit

- [ ] All critical issues fixed (Phase 1)
- [ ] Test coverage >90%
- [ ] No type errors (`tsc --noEmit`)
- [ ] No linting errors (`eslint src/features/secure-booking/__tests__`)
- [ ] All tests pass (`vitest run`)
- [ ] No `any` or `unknown as` casts
- [ ] Complete factories (no object spreads without defaults)
- [ ] Timeout configs on async tests
- [ ] afterEach cleanup in place
- [ ] Documentation comments added

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Testing Best Practices](https://www.typescriptlang.org/docs/handbook/testing.html)

---

## Contact & Questions

For questions about specific fixes, refer to:
- `VITEST_ANALYSIS.md` - Detailed analysis of all issues
- `VITEST_FIXES.md` - Concrete code examples and implementations
