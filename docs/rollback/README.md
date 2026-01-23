# 🔄 Rollback System - Operational Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-22
**Maintainer:** Engineering Team

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Rollback Scripts](#rollback-scripts)
4. [Validation & Monitoring](#validation--monitoring)
5. [Communication](#communication)
6. [Emergency Procedures](#emergency-procedures)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Emergency Rollback (Critical Situation)

```bash
# 1. Navigate to project root
cd /path/to/tistis-platform

# 2. Choose appropriate phase
./scripts/rollback/fase1-rollback.sh  # Query Parameters
./scripts/rollback/fase2-rollback.sh  # Branch-Specific Keys
./scripts/rollback/fase3-rollback.sh  # Performance Optimization

# 3. Follow prompts and confirm with required text
# 4. Monitor validation output
# 5. Check logs in: logs/rollback-faseX-TIMESTAMP.log
```

### Post-Rollback Validation

```bash
# Run validation suite
./scripts/validation/validate-rollback.sh fase1  # or fase2, fase3

# Check system health
./scripts/monitoring/health-check.sh

# Continuous monitoring (recommended for 1 hour post-rollback)
./scripts/monitoring/health-check.sh --continuous --interval=30
```

---

## 🎯 Overview

This rollback system provides:

- **Automated rollback scripts** for each deployment phase
- **Validation tools** to ensure rollback success
- **Health monitoring** for continuous system observation
- **Communication templates** for stakeholder notifications
- **Comprehensive logging** for audit and debugging

### System Architecture

```
scripts/
├── rollback/
│   ├── fase1-rollback.sh       # Query parameters rollback
│   ├── fase2-rollback.sh       # Branch keys rollback (+ database)
│   └── fase3-rollback.sh       # Performance optimization rollback
├── validation/
│   └── validate-rollback.sh    # Post-rollback validation suite
└── monitoring/
    └── health-check.sh          # Continuous health monitoring

docs/
├── api/
│   └── ROLLBACK_PLAN.md         # Master rollback plan
└── rollback/
    ├── README.md                # This file
    └── communication-templates.md  # Communication templates

logs/
└── rollback-*.log               # Rollback execution logs
```

---

## 🛠️ Rollback Scripts

### FASE 1: Query Parameters

**File:** `scripts/rollback/fase1-rollback.sh`

**Risk Level:** 🟢 LOW
**Data Loss:** NONE
**Downtime:** ~1-2 minutes
**Duration:** 5-10 minutes

**When to Use:**
- Query parameter filtering causing issues
- Backward compatibility problems
- Performance degradation

**Usage:**
```bash
./scripts/rollback/fase1-rollback.sh
```

**What It Does:**
1. ✅ Creates backup of current state
2. ✅ Identifies and reverts FASE 1 commits
3. ✅ Runs build validation
4. ✅ Deploys to production via Vercel
5. ✅ Runs validation tests

**Prerequisites:**
- Git access
- Vercel CLI (optional but recommended)
- Production access

---

### FASE 2: Branch-Specific Keys

**File:** `scripts/rollback/fase2-rollback.sh`

**Risk Level:** 🟡 MEDIUM
**Data Loss:** NONE (keys converted to tenant-wide)
**Downtime:** ~2-5 minutes
**Duration:** 30-60 minutes

**When to Use:**
- Branch-specific keys causing authorization issues
- Data filtering not working correctly
- Customer complaints about access restrictions

**Usage:**
```bash
export DATABASE_URL='postgresql://...'
./scripts/rollback/fase2-rollback.sh
```

**What It Does:**
1. ✅ Tests database connection
2. ✅ Creates backup of affected API keys
3. ✅ Converts branch-scoped keys to tenant-scoped
4. ✅ Reverts application code
5. ✅ Deploys to production
6. ✅ Generates customer communication
7. ✅ Runs comprehensive validation (18+ automated checks)

**Prerequisites:**
- `DATABASE_URL` environment variable
- `psql` installed
- Database admin access
- Vercel access

**Important Notes:**
- ⚠️ Database changes are irreversible without backup
- ✅ Backup is automatically created before changes
- 📧 Customer communication is required (affects ~15-20% of clients)

---

### FASE 3: Performance Optimization

**File:** `scripts/rollback/fase3-rollback.sh`

**Risk Level:** 🟢 LOW
**Data Loss:** NONE
**Downtime:** ~1-2 minutes
**Duration:** 10-15 minutes

**When to Use:**
- Performance optimizations causing bugs
- Caching layer issues
- Database index problems
- RPC function errors

**Usage:**
```bash
./scripts/rollback/fase3-rollback.sh
```

**What It Does:**
1. ✅ Creates state backup
2. ✅ Optionally reverts database migrations (indexes, RPC, views)
3. ✅ Reverts caching layer code
4. ✅ Deploys to production
5. ✅ Runs comprehensive validation (18+ automated checks)

**Database Rollback Options:**
- **Option 1 (Recommended):** Keep database optimizations, only revert code
- **Option 2 (Advanced):** Full rollback including database changes

**Important Notes:**
- ⚠️ Performance will degrade after rollback (expected)
- ✅ Functionality remains intact
- 📊 Monitor query latency (expect 2-3x increase)

---

## ✅ Validation & Monitoring

### Post-Rollback Validation

**File:** `scripts/validation/validate-rollback.sh`

**Usage:**
```bash
# Validate specific phase
./scripts/validation/validate-rollback.sh fase1
./scripts/validation/validate-rollback.sh fase2
./scripts/validation/validate-rollback.sh fase3

# Validate all aspects
./scripts/validation/validate-rollback.sh all
```

**What It Checks:**
1. ✅ API availability and reachability
2. ✅ Response time performance
3. ✅ Authentication functionality
4. ✅ Endpoint health (leads, appointments, branches)
5. ✅ Database connectivity and integrity
6. ✅ Phase-specific validations
7. ✅ Error rates and logs

**Exit Codes:**
- `0`: All checks passed
- `1`: One or more checks failed (investigate required)

**Environment Variables:**
```bash
export API_BASE_URL='https://api.tistis.com'  # Production API
export TEST_API_KEY='tis_live_...'            # Valid API key for testing
export DATABASE_URL='postgresql://...'        # Database connection
```

---

### Health Monitoring

**File:** `scripts/monitoring/health-check.sh`

**Usage:**
```bash
# Single health check
./scripts/monitoring/health-check.sh

# Continuous monitoring (recommended after rollback)
./scripts/monitoring/health-check.sh --continuous --interval=30

# Monitor for 1 hour then stop
timeout 3600 ./scripts/monitoring/health-check.sh --continuous --interval=60
```

**Metrics Monitored:**
- 🟢 API availability
- ⏱️ Response time (threshold: 500ms)
- 🔑 Authentication
- 📊 Endpoint health
- 💾 Database connectivity
- ❌ Error rates (threshold: 5%)

**Alert Triggers:**
- Response time > 1000ms
- Error rate > 5%
- API unavailable
- Database connection failure

**Recommended Monitoring Schedule:**
- **Post-Rollback:** Continuous for 1 hour
- **Normal Operations:** Every 5 minutes
- **High-Traffic Periods:** Every 30 seconds

---

## 📧 Communication

### Communication Templates

**File:** `docs/rollback/communication-templates.md`

**Available Templates:**
1. **Customer Emails** (FASE 1, 2, 3)
2. **Internal Slack Posts** (#engineering, #incidents)
3. **In-App Notifications**
4. **Status Page Updates**
5. **Customer Success Briefings**
6. **Postmortem Template**

**Usage:**
```bash
# After rollback, use appropriate template
cat docs/rollback/communication-templates.md

# Copy relevant section
# Fill in [PLACEHOLDERS]
# Send to appropriate channels
```

**Communication Checklist:**
- [ ] Internal team notified (within 5 minutes)
- [ ] Engineering lead informed
- [ ] Customer email sent (within 30 minutes for FASE 2)
- [ ] Status page updated
- [ ] Customer Success briefed
- [ ] Postmortem scheduled (within 72 hours)

---

## 🚨 Emergency Procedures

### Severity Levels

#### **P0 - Critical**
- Complete service outage
- Data loss detected
- Security breach

**Action:** Rollback immediately (< 10 minutes)

```bash
# 1. Execute rollback
./scripts/rollback/faseX-rollback.sh

# 2. Notify immediately
# - Post to #incidents
# - Page on-call engineer
# - Update status page

# 3. Validate
./scripts/validation/validate-rollback.sh all
```

#### **P1 - High**
- Error rate > 5%
- Performance degradation > 50%
- Multiple customer complaints

**Action:** Rollback within 1 hour

```bash
# 1. Investigate (15 minutes)
./scripts/monitoring/health-check.sh

# 2. Decision: Fix forward or rollback?

# 3. If rollback, execute
./scripts/rollback/faseX-rollback.sh

# 4. Communicate
# See communication-templates.md
```

#### **P2 - Medium**
- Error rate > 2%
- Performance degradation > 20%
- Some features affected

**Action:** Investigate, rollback if needed

```bash
# 1. Monitor closely (30 minutes)
./scripts/monitoring/health-check.sh --continuous --interval=60

# 2. Analyze logs
tail -f logs/*.log

# 3. Decision point
# - Fix forward if possible
# - Rollback if issue persists
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue: Script permission denied

```bash
# Solution: Make scripts executable
chmod +x scripts/rollback/*.sh
chmod +x scripts/validation/*.sh
chmod +x scripts/monitoring/*.sh
```

#### Issue: Database connection failed

```bash
# Solution: Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# If fails, verify credentials
```

#### Issue: Vercel deployment failed

```bash
# Solution 1: Check Vercel CLI
vercel --version

# Solution 2: Deploy manually
# Go to https://vercel.com/dashboard
# Trigger deployment from UI
```

#### Issue: Build failed after revert

```bash
# Solution: Check for conflicts
git status

# Resolve conflicts manually
git diff

# Abort and retry
git revert --abort
./scripts/rollback/faseX-rollback.sh
```

#### Issue: API still returning errors after rollback

```bash
# Solution: Validate deployment
./scripts/validation/validate-rollback.sh all

# Check logs
tail -50 logs/rollback-*.log

# Verify Vercel deployment status
vercel ls --prod

# If needed, trigger manual deployment
vercel --prod --force
```

---

## 📚 Additional Resources

### Documentation
- [ROLLBACK_PLAN.md](../api/ROLLBACK_PLAN.md) - Master rollback plan
- [communication-templates.md](communication-templates.md) - Communication templates
- [FASE_3_TESTING_RESULTS.md](../api/FASE_3_TESTING_RESULTS.md) - Testing documentation

### Monitoring Dashboards
- **Vercel:** https://vercel.com/dashboard
- **Database:** [Supabase Dashboard]
- **Error Tracking:** [Sentry/DataDog]
- **Status Page:** status.tistis.com

### Contacts
- **On-Call Engineer:** oncall@tistis.com (PagerDuty)
- **Engineering Lead:** [EMAIL]
- **Database Admin:** [EMAIL]
- **Customer Success:** [EMAIL]

### Incident Response
- **Slack Channel:** #incidents
- **Incident Commander:** Rotating (see on-call schedule)
- **Escalation Path:** Engineer → Lead → CTO

---

## 🔄 Maintenance

### Script Updates

When updating scripts:
1. Test in staging environment first
2. Update version numbers
3. Update this README
4. Notify team in #engineering
5. Add to changelog

### Regular Reviews

Schedule:
- **Monthly:** Review rollback logs
- **Quarterly:** Update communication templates
- **After each rollback:** Update procedures based on lessons learned

### Backup Strategy

Logs are retained for:
- Rollback execution: 90 days
- Validation results: 30 days
- Health checks: 7 days

Location: `logs/` directory

---

## 📝 Changelog

### Version 1.0.0 (2026-01-22)
- Initial rollback system implementation
- Created automated scripts for FASE 1, 2, 3
- Added validation and monitoring tools
- Created communication templates
- Documented operational procedures

---

**Questions?** Contact the engineering team at engineering@tistis.com

**Report Issues:** Open a ticket with label `rollback-system`

**Emergency?** Page on-call engineer via PagerDuty

---

✅ **System Status:** Production Ready
🔒 **Last Tested:** 2026-01-22
📖 **Documentation Complete:** Yes
