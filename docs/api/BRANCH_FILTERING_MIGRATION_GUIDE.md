# 🔄 Branch Filtering Migration Guide

**Document:** TIS-API-MIGRATION-001
**Version:** 1.0.0
**Status:** 🟡 ACTIVE DEPRECATION
**Deprecation Date:** 2026-07-01
**Timeline:** 6-month phased deprecation

---

## 📋 Overview

Query parameter-based branch filtering (`?branch_id=xxx`) is being deprecated in favor of **branch-specific API Keys**. This provides better security, performance, and cleaner API design.

### Why This Change?

**Old Approach (Deprecated):**
```bash
# Tenant-wide key with query parameter
curl -H "Authorization: Bearer tis_live_xxx" \
  "https://api.tistis.com/api/v1/leads?branch_id=branch-123"
```

**New Approach (Recommended):**
```bash
# Branch-specific key (no query parameter needed)
curl -H "Authorization: Bearer tis_live_yyy" \
  "https://api.tistis.com/api/v1/leads"
# Automatically returns only data for the branch assigned to the key
```

**Benefits:**
- ✅ **Better Security**: Branch isolation enforced at key level
- ✅ **Faster Performance**: Optimized database queries with indexes
- ✅ **Cleaner Code**: No need to manage query parameters
- ✅ **Prevents Errors**: Cannot accidentally query wrong branch

---

## 📅 Deprecation Timeline

### **Phase 1: Warning Period** (Months 1-2) ⚠️ CURRENT
**Status:** Active
**Dates:** 2026-01-01 to 2026-03-01

- Query parameter filtering still works
- Deprecation warnings added to API responses (headers)
- Migration guide available
- No breaking changes

**Response Headers You'll See:**
```http
Deprecation: true
Sunset: 2026-07-01
X-API-Deprecated-Feature: query-parameter-filtering
X-API-Deprecation-Phase: warning
X-API-Migration-Guide: https://docs.tistis.com/api/v1/migration/branch-filtering
Warning: 299 - "Query parameter filtering is deprecated and will be removed on 2026-07-01"
```

**Action Required:** Start planning migration, create branch-specific keys

---

### **Phase 2: Soft Enforcement** (Months 3-4)
**Status:** Upcoming
**Dates:** 2026-03-01 to 2026-05-01

- Query parameter filtering requires explicit opt-in header
- Without opt-in header: **400 Bad Request**
- Temporary override available for gradual migration

**Error Response:**
```json
{
  "error": "Query parameter branch filtering is deprecated",
  "code": "DEPRECATED_FEATURE",
  "deprecation_date": "2026-07-01",
  "migration_guide": "https://docs.tistis.com/api/v1/migration/branch-filtering",
  "temporary_override": "Add header \"X-Allow-Legacy-Filtering: true\""
}
```

**Temporary Override:**
```bash
curl -H "Authorization: Bearer tis_live_xxx" \
     -H "X-Allow-Legacy-Filtering: true" \
     "https://api.tistis.com/api/v1/leads?branch_id=branch-123"
```

**Action Required:** Complete migration to branch-specific keys

---

### **Phase 3: Hard Deprecation** (Months 5-6)
**Status:** Future
**Dates:** 2026-05-01 to 2026-07-01

- Query parameter filtering completely removed
- **410 Gone** response for any attempt to use it
- No override available

**Error Response:**
```json
{
  "error": "Query parameter branch filtering has been removed",
  "code": "FEATURE_REMOVED",
  "removal_date": "2026-07-01",
  "migration_guide": "https://docs.tistis.com/api/v1/migration/branch-filtering"
}
```

**Action Required:** All clients MUST be migrated

---

## 🚀 Migration Steps

### Step 1: Create Branch-Specific API Keys

**Via API Settings UI:**
1. Navigate to **Settings → API Keys**
2. Click **Create New API Key**
3. Set **Scope Type** to `Branch Specific`
4. Select the branch from dropdown
5. Configure permissions and rate limits
6. Save and copy the key (shown only once!)

**Via API (Programmatic):**
```bash
curl -X POST https://api.tistis.com/api/settings/api-keys \
  -H "Authorization: Bearer <your-session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Polanco Branch Key",
    "environment": "live",
    "scope_type": "branch",
    "branch_id": "branch-uuid-here",
    "scopes": ["leads:read", "leads:write", "appointments:read"],
    "rate_limit_rpm": 60,
    "rate_limit_daily": 10000
  }'
```

**Response:**
```json
{
  "key": {
    "id": "key-uuid",
    "name": "Polanco Branch Key",
    "scope_type": "branch",
    "branch_id": "branch-uuid",
    "branch_name": "Polanco",
    "scopes": ["leads:read", "leads:write"]
  },
  "api_key_secret": "tis_live_abc123...",
  "message": "Save this key securely. You won't see it again."
}
```

---

### Step 2: Update Your Application Code

**Before (Deprecated):**
```typescript
// ❌ Old approach with query parameter
const fetchLeads = async (branchId: string) => {
  const response = await fetch(
    `https://api.tistis.com/api/v1/leads?branch_id=${branchId}`,
    {
      headers: {
        'Authorization': `Bearer ${TENANT_WIDE_API_KEY}`,
      },
    }
  );
  return response.json();
};
```

**After (Recommended):**
```typescript
// ✅ New approach with branch-specific key
const fetchLeads = async () => {
  const response = await fetch(
    'https://api.tistis.com/api/v1/leads',
    {
      headers: {
        'Authorization': `Bearer ${BRANCH_SPECIFIC_API_KEY}`,
        // No query parameter needed!
      },
    }
  );
  return response.json();
};
```

---

### Step 3: Key Management Strategy

**Single Branch App:**
```typescript
// Store one branch-specific key
const API_KEY = process.env.BRANCH_API_KEY;
```

**Multi-Branch App:**
```typescript
// Map branch IDs to their specific keys
const BRANCH_API_KEYS: Record<string, string> = {
  'branch-polanco': process.env.POLANCO_API_KEY!,
  'branch-condesa': process.env.CONDESA_API_KEY!,
  'branch-roma': process.env.ROMA_API_KEY!,
};

const fetchLeadsForBranch = async (branchId: string) => {
  const apiKey = BRANCH_API_KEYS[branchId];
  if (!apiKey) {
    throw new Error(`No API key configured for branch ${branchId}`);
  }

  const response = await fetch('https://api.tistis.com/api/v1/leads', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  return response.json();
};
```

**Dynamic Branch Selection (Admin/Dashboard):**
```typescript
// For admin dashboards that need to switch branches:
// Option A: Use tenant-wide key WITHOUT query param (sees all branches)
// Option B: Create separate keys for each branch

// Option A Example:
const fetchAllLeads = async () => {
  const response = await fetch('https://api.tistis.com/api/v1/leads', {
    headers: { 'Authorization': `Bearer ${TENANT_WIDE_KEY}` },
  });
  // Response includes leads from ALL branches
  return response.json();
};

// Then filter on frontend:
const filterByBranch = (leads: Lead[], branchId: string) => {
  return leads.filter(lead => lead.branch_id === branchId);
};
```

---

### Step 4: Test and Validate

**Validation Checklist:**
- [ ] All API calls use branch-specific keys
- [ ] No `?branch_id=` query parameters in requests
- [ ] Environment variables updated with new keys
- [ ] Error handling for missing/invalid keys
- [ ] Rate limits appropriate for new keys
- [ ] Monitoring alerts updated for new key IDs

**Test Endpoints:**
```bash
# Test 1: Verify branch-specific key works
curl -H "Authorization: Bearer tis_live_branch_key" \
  "https://api.tistis.com/api/v1/leads"
# Should return only leads for that branch

# Test 2: Verify no deprecation warnings
curl -i -H "Authorization: Bearer tis_live_branch_key" \
  "https://api.tistis.com/api/v1/leads"
# Check response headers - should NOT have Deprecation: true

# Test 3: Verify tenant-wide key still works (without query param)
curl -H "Authorization: Bearer tis_live_tenant_key" \
  "https://api.tistis.com/api/v1/leads"
# Should return leads from ALL branches
```

---

### Step 5: Retire Old Keys

**After Migration Complete:**
1. Navigate to **Settings → API Keys**
2. Find old tenant-wide keys with query param usage
3. Click **Deactivate** (don't delete immediately)
4. Monitor for 7 days to catch any missed integrations
5. Permanently delete after validation period

---

## 🔐 Security Improvements

### Branch Isolation Enforcement

**Old Behavior (Security Risk):**
```bash
# Branch-specific key could be bypassed with query param
curl -H "Authorization: Bearer branch_1_key" \
  "https://api.tistis.com/api/v1/leads?branch_id=branch_2"
# ❌ Would return branch_2 data (security vulnerability!)
```

**New Behavior (Secure):**
```bash
# Branch-specific key CANNOT be bypassed
curl -H "Authorization: Bearer branch_1_key" \
  "https://api.tistis.com/api/v1/leads?branch_id=branch_2"
# ✅ Query param IGNORED, returns only branch_1 data (secure!)
```

---

## ⚡ Performance Improvements

**Database Query Optimization:**
- Branch filtering now uses optimized partial indexes
- P95 latency reduced by ~20% (target: <80ms)
- Cache hit rate >70% for common queries

**Before (Slower):**
```sql
-- Query param approach uses less efficient index
SELECT * FROM leads
WHERE tenant_id = 'xxx' AND branch_id = 'yyy'
ORDER BY created_at DESC;
-- Uses: idx_leads_tenant_created (not optimal)
```

**After (Faster):**
```sql
-- Branch-specific key uses optimized index
SELECT * FROM leads
WHERE tenant_id = 'xxx' AND branch_id = 'yyy'
ORDER BY created_at DESC;
-- Uses: idx_leads_branch_covering (includes all columns, no table lookup!)
```

---

## 📊 Migration Progress Tracking

**Check Your Deprecation Status:**
```bash
curl -H "Authorization: Bearer <your-key>" \
  "https://api.tistis.com/api/v1/leads"

# Check response headers:
# - If no "Deprecation" header: ✅ You're good!
# - If "Deprecation: true": ⚠️ Migration needed
```

**Admin Dashboard:**
- View all active API keys
- See which keys use query parameters
- Track migration progress per key
- Set up alerts for deprecated usage

---

## 🆘 Troubleshooting

### Issue: Getting 400 Error in Soft Enforcement Phase

**Error:**
```json
{
  "error": "Query parameter branch filtering is deprecated",
  "code": "DEPRECATED_FEATURE"
}
```

**Solution:**
1. Create branch-specific API key
2. Update your code to use new key
3. Remove `?branch_id=` from requests

**Temporary Workaround:**
```bash
# Add opt-in header (only works in soft enforcement phase)
curl -H "Authorization: Bearer tis_live_xxx" \
     -H "X-Allow-Legacy-Filtering: true" \
     "https://api.tistis.com/api/v1/leads?branch_id=branch-123"
```

---

### Issue: Branch-Specific Key Not Working

**Symptoms:**
- Empty results or unexpected data
- 403 Forbidden errors

**Checklist:**
- [ ] Verify key is active (not expired)
- [ ] Check branch_id is correct in key settings
- [ ] Confirm branch exists and is active
- [ ] Verify scopes include required permissions
- [ ] Check rate limits not exceeded

---

### Issue: Need to Access Multiple Branches

**Solution Options:**

**Option 1: Use tenant-wide key** (no query param)
```typescript
// Returns data from ALL branches
const allLeads = await fetch('/api/v1/leads', {
  headers: { 'Authorization': `Bearer ${TENANT_KEY}` }
});

// Filter on frontend/backend as needed
const branch1Leads = allLeads.filter(l => l.branch_id === 'branch-1');
```

**Option 2: Create multiple branch-specific keys**
```typescript
const keys = {
  'branch-1': 'tis_live_key1',
  'branch-2': 'tis_live_key2',
};

// Make parallel requests
const [branch1Data, branch2Data] = await Promise.all([
  fetch('/api/v1/leads', { headers: { Authorization: `Bearer ${keys['branch-1']}` }}),
  fetch('/api/v1/leads', { headers: { Authorization: `Bearer ${keys['branch-2']}` }}),
]);
```

---

## 📞 Support

**Need Help?**
- 📧 Email: api-support@tistis.com
- 💬 Slack: #api-support
- 📚 Docs: https://docs.tistis.com/api/v1
- 🐛 Issues: https://github.com/tistis/platform/issues

**Migration Assistance:**
We offer free migration assistance for enterprise customers. Contact your account manager to schedule a migration planning session.

---

## ✅ Checklist: Am I Ready?

- [ ] I understand the deprecation timeline
- [ ] I've created branch-specific API keys for all branches
- [ ] I've updated my code to use new keys
- [ ] I've removed all `?branch_id=` query parameters
- [ ] I've tested the new implementation
- [ ] I've updated environment variables
- [ ] I've deactivated old tenant-wide keys
- [ ] I've verified no deprecation headers in responses

---

**Last Updated:** 2026-01-22
**Deprecation Effective:** 2026-07-01
**Questions?** Contact api-support@tistis.com
