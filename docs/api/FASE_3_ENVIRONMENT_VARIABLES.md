# 🔐 FASE 3: Environment Variables

**Document:** TIS-ENV-FASE3-001
**Version:** 1.0.0
**Last Updated:** 2026-01-22

---

## 📋 Required Environment Variables

### Deprecation Configuration

These environment variables control the deprecation behavior for query parameter filtering:

```bash
# Deprecation phase: 'warning' | 'soft_enforcement' | 'hard_deprecation'
# Default: 'warning'
DEPRECATION_PHASE=warning

# Date when feature will be removed (ISO 8601 format)
# Default: '2026-07-01'
DEPRECATION_DATE=2026-07-01

# URL to migration guide documentation
# Default: 'https://docs.tistis.com/api/v1/migration/branch-filtering'
DEPRECATION_GUIDE_URL=https://docs.tistis.com/api/v1/migration/branch-filtering
```

---

## 📝 Environment Variable Details

### `DEPRECATION_PHASE`

**Type:** String enum
**Required:** No (has default)
**Default:** `'warning'`
**Allowed Values:**
- `warning` - Show deprecation headers, no blocking
- `soft_enforcement` - Require opt-in header to use deprecated feature
- `hard_deprecation` - Completely block deprecated feature

**Usage:**
```bash
# Development: Keep in warning phase
DEPRECATION_PHASE=warning

# Staging: Test soft enforcement
DEPRECATION_PHASE=soft_enforcement

# Production timeline:
# Month 1-2: warning
# Month 3-4: soft_enforcement
# Month 5-6: hard_deprecation
```

---

### `DEPRECATION_DATE`

**Type:** ISO 8601 Date String
**Required:** No (has default)
**Default:** `'2026-07-01'`
**Format:** `YYYY-MM-DD`

**Usage:**
```bash
# Set the sunset date for deprecated features
DEPRECATION_DATE=2026-07-01
```

**Notes:**
- This date is returned in API response headers (`Sunset` header)
- Users will see this date in deprecation warnings
- Should be at least 6 months after initial warning phase

---

### `DEPRECATION_GUIDE_URL`

**Type:** URL String
**Required:** No (has default)
**Default:** `'https://docs.tistis.com/api/v1/migration/branch-filtering'`

**Usage:**
```bash
# Point to your migration guide
DEPRECATION_GUIDE_URL=https://docs.tistis.com/api/v1/migration/branch-filtering
```

**Notes:**
- This URL is included in:
  - `X-API-Migration-Guide` response header
  - Error messages during soft/hard enforcement
  - Client emails and notifications
- Should be a public URL accessible to all API users

---

## 🚀 Deployment Guide

### Development Environment

```bash
# .env.local
DEPRECATION_PHASE=warning
DEPRECATION_DATE=2026-07-01
DEPRECATION_GUIDE_URL=http://localhost:3000/docs/api/migration
```

### Staging Environment

```bash
# .env.staging
DEPRECATION_PHASE=soft_enforcement
DEPRECATION_DATE=2026-07-01
DEPRECATION_GUIDE_URL=https://staging.tistis.com/docs/api/migration
```

### Production Environment

```bash
# .env.production

# Phase 1 (Months 1-2): Warning only
DEPRECATION_PHASE=warning
DEPRECATION_DATE=2026-07-01
DEPRECATION_GUIDE_URL=https://docs.tistis.com/api/v1/migration/branch-filtering

# Phase 2 (Months 3-4): Soft enforcement
# Update to:
# DEPRECATION_PHASE=soft_enforcement

# Phase 3 (Months 5-6): Hard deprecation
# Update to:
# DEPRECATION_PHASE=hard_deprecation
```

---

## ⚠️ Important Notes

1. **No Breaking Changes Without Warning**
   - NEVER set `DEPRECATION_PHASE=hard_deprecation` without at least 4 months notice
   - Always progress through phases sequentially

2. **Communication Timeline**
   - Week 1: Send email announcement to all API users
   - Month 1: Deploy warning phase
   - Month 2.5: Send reminder email (2 weeks before soft enforcement)
   - Month 3: Deploy soft enforcement
   - Month 4.5: Send final warning (2 weeks before hard deprecation)
   - Month 5: Deploy hard deprecation

3. **Monitoring**
   - Track deprecation usage via API logs
   - Set up alerts for high deprecation header rates
   - Monitor support tickets for migration issues

4. **Rollback Plan**
   - If migration problems occur, can temporarily revert to warning phase
   - Keep emergency hotfix ready to disable enforcement

---

## 🔍 Verification

**Check Current Configuration:**
```typescript
import { getDeprecationConfig } from '@/src/shared/lib/api-deprecation';

const config = getDeprecationConfig();
console.log('Current phase:', config.phase);
console.log('Deprecation date:', config.deprecationDate);
console.log('Migration guide:', config.migrationGuideUrl);
```

**Test API Response:**
```bash
# Make request with tenant-wide key + query param
curl -i -H "Authorization: Bearer tis_live_tenant_key" \
  "https://api.tistis.com/api/v1/leads?branch_id=branch-123"

# Check response headers:
# - Deprecation: true
# - X-API-Deprecation-Phase: warning (or current phase)
# - X-API-Deprecation-Date: 2026-07-01
```

---

## 📞 Support

**Questions about environment variables?**
- 📧 DevOps: devops@tistis.com
- 💬 Slack: #engineering-infrastructure
- 📚 Docs: https://docs.tistis.com/deployment/env-variables

---

**Last Updated:** 2026-01-22
