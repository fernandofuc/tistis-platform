# TIS TIS Platform - Deployment Runbook

## Overview

This document provides step-by-step instructions for deploying TIS TIS Platform to production.

**Platform**: Next.js 14 on Vercel
**Database**: Supabase (PostgreSQL)
**Version**: 4.6.0

---

## Pre-Deployment Checklist

### 1. Environment Variables

Verify all required environment variables are set in Vercel:

```bash
# Required - Core
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase public key
SUPABASE_SERVICE_ROLE_KEY       # Supabase service role (server-side only)

# Required - Payments
STRIPE_SECRET_KEY               # Stripe API key
STRIPE_WEBHOOK_SECRET           # Stripe webhook signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # Stripe public key

# Required - AI
OPENAI_API_KEY                  # OpenAI API key
ANTHROPIC_API_KEY               # Anthropic API key (optional)

# Required - Voice Agent
VAPI_API_KEY                    # VAPI API key
VAPI_WEBHOOK_SECRET             # VAPI webhook secret

# Required - Messaging
META_VERIFY_TOKEN               # Meta verification token
META_APP_SECRET                 # Meta app secret

# Required - Email
RESEND_API_KEY                  # Resend API key

# Optional
NEXT_PUBLIC_APP_URL             # App URL (for links)
NODE_ENV                        # production
HEALTH_CHECK_TOKEN              # Token for detailed health check access
CRON_SECRET                     # Secret for cron job authentication
```

### 2. Database Migrations

Ensure all migrations are applied:

```bash
# Check migration status
npx supabase migration list

# Apply pending migrations
npx supabase db push
```

### 3. Code Quality

Run all quality checks:

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run test:vitest  # Unit tests
npm run build        # Build verification
```

---

## Deployment Steps

### Standard Deployment (via Vercel)

1. **Push to main branch**
   ```bash
   git push origin main
   ```

2. **Vercel auto-deploys** from main branch

3. **Monitor deployment**
   - Check Vercel dashboard for build status
   - Review build logs for errors

4. **Verify deployment**
   ```bash
   curl https://tistis.app/api/health
   ```

### Manual Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to production**
   ```bash
   vercel --prod
   ```

---

## Health Checks

### Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/health` | Full health check | `{ status: "healthy" }` |
| `/api/health?type=liveness` | Kubernetes liveness | `{ status: "ok" }` |
| `/api/health?type=readiness` | Kubernetes readiness | `{ status: "ok" }` |
| `/api/health?type=detailed` | Detailed diagnostics | Full status object |

### Monitoring Commands

```bash
# Quick health check
curl -s https://tistis.app/api/health | jq .status

# Detailed check
curl -s "https://tistis.app/api/health?type=detailed" | jq .

# Watch health
watch -n 10 'curl -s https://tistis.app/api/health | jq .status'
```

---

## Rollback Procedure

### Via Vercel Dashboard

1. Go to Vercel Dashboard > Deployments
2. Find the previous working deployment
3. Click "..." menu > "Promote to Production"

### Via CLI

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

---

## Database Operations

### Backup Before Deployment

```bash
# Export data
pg_dump -h [host] -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

### Migration Rollback

```sql
-- View migration history
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;

-- Manual rollback (use with caution)
-- Run the DOWN migration for specific migration
```

---

## Cron Jobs

Configured in `vercel.json`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/subscription-check` | Daily 3 AM | Check subscription status |
| `/api/cron/cleanup-expired` | Daily 4 AM | Clean expired data |

Verify cron execution in Vercel Functions logs.

---

## Monitoring

### Key Metrics to Watch

1. **Response Times**
   - API endpoints < 500ms
   - Page loads < 3s

2. **Error Rates**
   - 5xx errors < 0.1%
   - 4xx errors (expected) < 5%

3. **Database**
   - Connection pool utilization
   - Query performance

### Alerts

Configure in Vercel/monitoring service:
- Deployment failures
- Health check failures (3+ consecutive)
- High error rate (> 1%)
- Response time degradation

---

## Troubleshooting

### Common Issues

#### Build Fails

```bash
# Check for type errors
npm run typecheck

# Check for lint errors
npm run lint

# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### API Errors

```bash
# Check logs
vercel logs

# Check specific function
vercel logs --filter=/api/[endpoint]
```

#### Database Connection Issues

1. Verify Supabase project is running
2. Check environment variables
3. Verify IP allowlist if applicable

### Emergency Contacts

- **DevOps**: devops@tistis.com
- **On-call**: oncall@tistis.com

---

## Post-Deployment Verification

### Smoke Tests

1. **Authentication**
   - [ ] Login with email/password
   - [ ] Login with Google OAuth
   - [ ] Logout

2. **Dashboard**
   - [ ] Dashboard loads
   - [ ] Navigation works
   - [ ] Data displays correctly

3. **API**
   - [ ] Health endpoint returns healthy
   - [ ] API calls succeed
   - [ ] Webhooks receive events

4. **Integrations**
   - [ ] Stripe checkout works
   - [ ] WhatsApp messages send
   - [ ] AI responds correctly

### Performance Check

```bash
# Lighthouse audit
npx lighthouse https://tistis.app --view

# Load test (optional)
npx loadtest -n 100 -c 10 https://tistis.app/api/health
```

---

## Security Checklist

- [ ] All secrets rotated since last known exposure
- [ ] No debug endpoints exposed
- [ ] Rate limiting active
- [ ] Security headers verified
- [ ] CSP policy reviewed

```bash
# Verify security headers
curl -I https://tistis.app | grep -E "(X-Frame|X-Content|Strict-Transport|Content-Security)"
```

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 4.6.0 | 2025-01 | Deployment infrastructure upgrade |
| 4.5.0 | 2025-01 | AI Learning 2.0 |
| 4.4.0 | 2024-12 | Integration Hub |

---

*Last updated: January 2026*
