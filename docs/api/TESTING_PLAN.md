# 🧪 PLAN DE TESTING - Multi-Branch API System

**Documento:** TIS-API-TESTING-001
**Versión:** 1.0.0
**Scope:** Todas las fases (1, 2, 3)

---

## 📊 ESTRATEGIA DE TESTING

### Pyramid de Testing

```
                    ▲
                   ╱ ╲
                  ╱   ╲
                 ╱ E2E ╲         10%  - End-to-End Tests
                ╱───────╲
               ╱         ╲
              ╱Integration╲      30%  - Integration Tests
             ╱─────────────╲
            ╱               ╲
           ╱  Unit Tests     ╲    60%  - Unit Tests
          ╱___________________╲
```

---

## 🎯 COBERTURA POR FASE

### FASE 1: Query Parameters

**Unit Tests (60 tests):**
- `extractBranchId()` - 15 tests
- `validateBranchOwnership()` - 10 tests
- `applyBranchFilter()` - 15 tests
- Helper functions - 20 tests

**Integration Tests (30 tests):**
- Endpoint `/api/v1/leads` - 10 tests
- Endpoint `/api/v1/appointments` - 10 tests
- Edge cases - 10 tests

**E2E Tests (10 tests):**
- Multi-tenant scenarios
- Performance bajo carga
- Security boundary tests

**Coverage Target:** >90%

---

### FASE 2: Branch-Specific Keys

**Unit Tests (80 tests):**
- Database migration - 20 tests
- Auth layer updates - 25 tests
- Middleware filtering - 20 tests
- UI components - 15 tests

**Integration Tests (40 tests):**
- Key creation flow - 15 tests
- Authentication with branch context - 15 tests
- Backward compatibility - 10 tests

**E2E Tests (15 tests):**
- Complete user journeys
- Migration scenarios
- Rollback testing

**Coverage Target:** >95%

---

### FASE 3: Optimization

**Performance Tests (20 tests):**
- Query latency benchmarks
- Cache hit rate testing
- Load testing (1000 req/s)

**Regression Tests (30 tests):**
- Ensure FASE 1 & 2 still work
- Deprecation warnings
- Migration tool validation

**Coverage Target:** >85%

---

## 📝 TEST MATRIX COMPLETA

### Security Tests

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| SEC-001 | Access branch from different tenant | 403 Forbidden |
| SEC-002 | SQL injection in branch_id param | Sanitized, no error |
| SEC-003 | XSS in API Key name | Escaped properly |
| SEC-004 | Rate limit bypass attempt | 429 after limit |

### Functional Tests

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| FUN-001 | Create tenant-wide key | Success, branch_id=null |
| FUN-002 | Create branch-specific key | Success, branch_id set |
| FUN-003 | Query with branch filter | Filtered results |
| FUN-004 | Query without branch filter (multi-branch) | All branches + warning |
| FUN-005 | Invalid UUID in branch_id | 400 Bad Request |

### Performance Tests

| ID | Scenario | Target |
|----|----------|--------|
| PERF-001 | Query latency (filtered) | <100ms p95 |
| PERF-002 | Query latency (unfiltered) | <150ms p95 |
| PERF-003 | Auth overhead | <10ms |
| PERF-004 | Cache hit rate | >70% |

---

## 🛠️ TOOLS & FRAMEWORKS

### Unit Testing
- **Framework:** Vitest
- **Coverage:** v8
- **Mocking:** vi.mock()

### Integration Testing
- **Framework:** Playwright
- **Database:** Supabase local (Docker)
- **Fixtures:** Factory pattern

### E2E Testing
- **Framework:** Cypress
- **Environment:** Staging mirror
- **Data:** Anonymized production snapshots

### Performance Testing
- **Tool:** k6
- **Scenarios:** Gradual ramp-up
- **Thresholds:**
  - P95 < 100ms
  - Error rate < 0.5%

---

## 📋 AUTOMATION

### CI/CD Pipeline

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test -- --coverage
      - run: npm run test:coverage-report

  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres
    steps:
      - run: npm run test:integration

  e2e-tests:
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:e2e

  performance-tests:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: k6 run tests/load/api-load-test.js
```

---

## ✅ ACCEPTANCE CRITERIA

### FASE 1
- [ ] >90% unit test coverage
- [ ] All integration tests passing
- [ ] E2E scenarios validated
- [ ] Performance benchmarks met
- [ ] Security audit passed

### FASE 2
- [ ] >95% unit test coverage
- [ ] Migration tested on staging
- [ ] Backward compatibility confirmed
- [ ] Zero downtime deployment validated
- [ ] Rollback tested successfully

### FASE 3
- [ ] Performance improvement verified (+20%)
- [ ] Deprecation path tested
- [ ] 100% migration validation
- [ ] Analytics dashboard validated

---

**Responsable QA:** TBD
**Review Schedule:** Bi-weekly
**Regression Suite:** Daily (automated)
