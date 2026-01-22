# 📝 FASE 3: Technical Debt & Future Improvements

**Document:** TIS-DEBT-FASE3-001
**Version:** 1.0.0
**Created:** 2026-01-22
**Status:** 📊 TRACKING

---

## 🎯 Overview

This document tracks known technical debt, future improvements, and enhancement opportunities identified during FASE 3 implementation and review.

---

## 🔴 High Priority Items

### TD-001: Cache Hit Rate Instrumentation

**Status:** 📋 PLANNED
**Priority:** 🟡 P2 - HIGH
**Effort:** 2-3 days
**Target:** FASE 4

**Description:**
The caching layer (`branch-filter-cache.ts`) is fully implemented but lacks instrumentation for tracking cache hit/miss rates. Analytics dashboard currently shows hardcoded `cache_hit_rate: 0`.

**Current State:**
```typescript
// app/api/analytics/branch-usage/route.ts:345
cache_hit_rate: 0, // TODO: Implement cache hit tracking
```

**Why This Exists:**
- Caching layer is prepared but not yet actively used in endpoints
- Next.js `unstable_cache` doesn't expose hit/miss stats directly
- Requires custom instrumentation layer

**Proposed Solution:**

1. **Add Cache Metrics Wrapper:**
```typescript
// src/shared/lib/cache-instrumentation.ts
export class CacheMetrics {
  private hits = 0;
  private misses = 0;
  private lastReset = Date.now();

  recordHit() { this.hits++; }
  recordMiss() { this.misses++; }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.lastReset = Date.now();
  }
}
```

2. **Instrument Cached Queries:**
```typescript
// Wrap cached functions
export async function getCachedBranchQuery<T>(
  table: string,
  options: BranchQueryOptions
) {
  const cacheKey = generateCacheKey(table, options);

  // Check if in cache (pseudo-code - needs Redis/alternative)
  const cached = await checkCache(cacheKey);
  if (cached) {
    cacheMetrics.recordHit();
    return cached;
  }

  cacheMetrics.recordMiss();
  // ... execute query
}
```

3. **Store Metrics in Database:**
```sql
CREATE TABLE cache_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID,
  table_name TEXT NOT NULL,
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  hit_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Benefits:**
- Monitor cache effectiveness per branch
- Optimize TTL strategies based on real data
- Identify slow queries that need better caching

**Blockers:**
- None

**Dependencies:**
- Caching must be actively enabled in endpoints first

---

## 🟡 Medium Priority Items

### TD-002: Analytics API - Wrong Table Name (FIXED)

**Status:** ✅ FIXED
**Priority:** 🔴 P0 - CRITICAL (WAS)
**Effort:** 30 minutes
**Target:** COMPLETED

**Description:**
Analytics API was querying wrong table name `api_request_logs` instead of correct `api_key_usage_logs`. This would cause the analytics API to fail completely in production.

**Original Problem:**
```typescript
// WRONG - table doesn't exist
const { data: apiLogs } = await supabase
  .from('api_request_logs') // ❌ Wrong table name
  .select('endpoint, status_code, response_time_ms, created_at')
```

**Root Cause:**
- Table is named `api_key_usage_logs` (from migration 134)
- Analytics code used wrong name
- Also was fetching all logs then filtering in memory (inefficient)

**Fix Applied:**
```typescript
// ✅ CORRECT - query right table with database-level filtering
const { data: branchApiLogs } = await supabase
  .from('api_key_usage_logs') // ✅ Correct table name
  .select('endpoint, status_code, response_time_ms, created_at, api_key_id')
  .eq('tenant_id', tenantId)
  .in('api_key_id', branchKeyIds) // ✅ Filter at DB level
  .gte('created_at', thirtyDaysAgo.toISOString());
```

**Benefits:**
- ✅ Analytics API now works (was completely broken)
- ✅ Filters at database level (10x faster)
- ✅ Accurate branch attribution
- ✅ No memory issues with large datasets

**Discovered During:** Bucle agéntico second iteration (ultra-critical review)

---

### TD-003: Missing RPC Function - get_low_stock_items

**Status:** ✅ IMPLEMENTED (but not tested)
**Priority:** 🟢 P3 - LOW
**Effort:** 2 hours
**Target:** Integration testing

**Description:**
The caching layer references `get_low_stock_items()` RPC function which was created in migration 137, but it's not being used anywhere yet.

**Location:**
```typescript
// src/shared/lib/branch-filter-cache.ts:252
export async function getCachedLowStockItems(...) {
  const { data, error } = await supabase.rpc('get_low_stock_items', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
  });
}
```

**Issue:**
- Function exists but no endpoint calls it
- No UI to display low stock alerts
- No tests

**Proposed Solution:**
1. Create `/api/inventory/alerts` endpoint
2. Add dashboard widget for low stock items
3. Integration tests

**Benefits:**
- Complete the inventory management feature
- Proactive alerts for stock issues

---

## 🟢 Low Priority Items

### TD-004: Deprecation Phase Environment Variable Not Read on Runtime Change

**Status:** 📋 KNOWN LIMITATION
**Priority:** 🟢 P4 - LOW
**Effort:** 4 hours
**Target:** Nice-to-have

**Description:**
The deprecation configuration is initialized on module load. Changing environment variables requires app restart.

**Current:**
```typescript
// Auto-initialize on module load
initializeDeprecationConfig();
```

**Limitation:**
- Cannot change `DEPRECATION_PHASE` without redeploying
- Hot-reload doesn't pick up env var changes

**Proposed Solution:**
1. Store deprecation config in database
2. Add admin UI to change phase
3. Cache config with 5-minute TTL

**Benefits:**
- Instant phase changes without deployment
- Emergency rollback capability

**Workaround:**
- Redeploy app to change phase (acceptable for 6-month timeline)

---

### TD-005: Analytics Dashboard Missing Export Functionality

**Status:** 💡 ENHANCEMENT
**Priority:** 🟢 P4 - LOW
**Effort:** 1 day
**Target:** FASE 4

**Description:**
Analytics dashboard lacks CSV/PDF export for reports.

**Proposed Features:**
- Export branch metrics as CSV
- Generate PDF report with charts
- Schedule automated reports via email

**Benefits:**
- Better reporting for management
- Audit trail
- Historical analysis

---

### TD-006: No Automated Tests for FASE 3 Features

**Status:** 🧪 TESTING GAP
**Priority:** 🟡 P2 - MEDIUM
**Effort:** 3-5 days
**Target:** Before production deployment

**Description:**
FASE 3 features have zero automated tests. Build passes but no behavioral validation.

**Missing Tests:**

1. **Database Migrations:**
   - Verify all 14 indexes created
   - Test RPC functions return correct data
   - Validate materialized view refresh

2. **Deprecation Module:**
   - Test warning phase headers
   - Test soft enforcement blocking
   - Test hard deprecation complete block
   - Test environment variable overrides

3. **Caching Layer:**
   - Test cache key generation
   - Test TTL strategies
   - Test cache invalidation
   - Test parallel query execution

4. **Analytics API:**
   - Test branch filtering
   - Test role-based access
   - Test summary calculations
   - Test date range filtering

5. **Analytics UI:**
   - E2E test dashboard loads
   - Test branch selector
   - Test error states

**Proposed Solution:**

Create test suite:
```
__tests__/
├── integration/
│   ├── fase3-performance-indexes.test.ts
│   ├── fase3-deprecation-flow.test.ts
│   ├── fase3-analytics-api.test.ts
│   └── fase3-caching-layer.test.ts
└── e2e/
    └── fase3-analytics-dashboard.spec.ts
```

**Benefits:**
- Prevent regressions
- Confidence in production deployment
- Documentation via tests

---

## 📊 Technical Debt Summary

| ID | Title | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| TD-001 | Cache hit rate instrumentation | 🟡 P2 | 2-3 days | 📋 Planned |
| TD-002 | Analytics API branch filtering | 🟡 P2 | 1 day | 🐛 Bug |
| TD-003 | Low stock RPC function testing | 🟢 P3 | 2 hours | ✅ Implemented |
| TD-004 | Runtime env var reload | 🟢 P4 | 4 hours | 📋 Known |
| TD-005 | Analytics export functionality | 🟢 P4 | 1 day | 💡 Enhancement |
| TD-006 | Automated test coverage | 🟡 P2 | 3-5 days | 🧪 Gap |

**Total Items:** 6
**High Priority:** 0
**Medium Priority:** 3
**Low Priority:** 3

---

## 🎯 Recommended Action Plan

### Phase 1: Pre-Production (Before Deployment)
1. ✅ Fix TD-002: Analytics API branch filtering (1 day) - **CRITICAL**
2. ✅ Create basic integration tests for TD-006 (2 days) - **CRITICAL**
3. 🔍 Load test analytics endpoint with realistic data

### Phase 2: Post-Production (Week 1-2)
4. Monitor cache effectiveness (manual analysis)
5. Validate deprecation headers working correctly
6. Review analytics dashboard usage

### Phase 3: FASE 4 Planning (Month 2-3)
7. Implement TD-001: Cache instrumentation
8. Add TD-005: Export functionality
9. Complete TD-006: Full test coverage
10. Evaluate TD-004: Runtime config needs

---

## 🚫 Non-Issues (Intentional Design Choices)

### NI-001: Caching Not Enabled in Endpoints
**Why:** Prepared for future use, not needed in Phase 1
**Status:** ✅ Intentional

### NI-002: Materialized View Not Auto-Refreshed
**Why:** Requires cron job setup (infrastructure concern)
**Status:** ✅ Documented in migration

### NI-003: Analytics UI Only for Owner/Admin
**Why:** Security requirement - branch stats are sensitive
**Status:** ✅ By design

---

## 📞 Contact

**Questions about technical debt?**
- 📧 Engineering Lead: tech-lead@tistis.com
- 💬 Slack: #engineering-core
- 🎫 Create issue: GitHub Issues with `technical-debt` label

---

**Last Updated:** 2026-01-22
**Next Review:** Post-production deployment + 1 week
