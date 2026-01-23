# 📧 Rollback Communication Templates

**Document:** TIS-ROLLBACK-COMM-001
**Version:** 1.0.0
**Purpose:** Pre-written templates for rollback communications

---

## 🎯 Communication Principles

1. **Be Transparent:** Explain what happened and why
2. **Be Timely:** Communicate within 30 minutes of rollback
3. **Be Clear:** Avoid technical jargon for customer-facing communications
4. **Be Helpful:** Provide workarounds and next steps
5. **Be Accountable:** Own the issue and timeline for resolution

---

## 📝 FASE 1: Query Parameters Rollback

### Customer Email Template

```
Subject: [TIS TIS] Minor API Update Notification

Estimados clientes,

Hemos revertido temporalmente una actualización opcional de nuestro API
relacionada con filtrado de consultas por sucursal.

IMPACTO:
- ✓ Todos los servicios están funcionando normalmente
- ✓ No se requiere ninguna acción de su parte
- ✓ Cero pérdida de datos

DETALLES TÉCNICOS (opcional):
- Feature afectada: Filtrado automático por branch_id en query parameters
- Estado actual: Funcionalidad opcional deshabilitada temporalmente
- Próximos pasos: Investigación y re-despliegue en 24-48 horas

Si tienen preguntas, no duden en contactarnos.

Saludos,
Equipo de Ingeniería - TIS TIS
soporte@tistis.com
```

### Internal Slack Post (#engineering)

```
🔄 ROLLBACK EXECUTED - FASE 1 (Query Parameters)

Status: ✅ COMPLETE
Timestamp: [AUTO-FILLED]
Duration: ~10 minutes
Downtime: 0 minutes

What happened:
- Reverted query parameter filtering feature
- Reason: [FILL IN REASON]

Impact:
- Clients affected: 0 (backward compatible)
- Data loss: NONE
- Current state: Pre-FASE 1 functionality

Next steps:
1. Root cause analysis (ETA: 4 hours)
2. Hotfix plan (ETA: 24 hours)
3. Re-deploy with fix (ETA: 48 hours)

Incident Commander: @[NAME]
On-call: @[NAME]

Logs: [LINK TO LOG FILE]
```

### Internal Slack Post (#incidents - If Critical)

```
🚨 INCIDENT RESOLVED - FASE 1 Rollback

Severity: P2 (High)
Status: RESOLVED
Resolution: Rollback to pre-FASE 1 state

Timeline:
- [TIME]: Issue detected
- [TIME]: Decision to rollback
- [TIME]: Rollback initiated
- [TIME]: Rollback complete
- [TIME]: Validation passed

Root Cause: [TO BE DETERMINED]

Postmortem: Will be published within 48 hours
POC: @[ENGINEERING LEAD]
```

---

## 📝 FASE 2: Branch-Specific Keys Rollback

### Customer Email Template

```
Subject: [URGENT] API Keys Behavior Change - Temporary Rollback

Estimados clientes,

Hemos revertido temporalmente la funcionalidad de API Keys por sucursal
debido a [RAZÓN TÉCNICA].

CAMBIO INMEDIATO:
- Las API Keys creadas para sucursales específicas ahora tienen acceso
  a TODAS las sucursales de su organización
- Sus keys siguen siendo válidas y funcionando
- Cero pérdida de datos

CLIENTES AFECTADOS:
- Organizaciones con múltiples sucursales
- API Keys con scope "branch" específico

WORKAROUND RECOMENDADO:
Si necesitan filtrar por sucursal específica, pueden usar el parámetro
de query en sus requests:

    GET /v1/leads?branch_id=YOUR_BRANCH_ID
    GET /v1/appointments?branch_id=YOUR_BRANCH_ID

PRÓXIMOS PASOS:
1. Investigaremos y resolveremos el issue en las próximas 48 horas
2. Les notificaremos cuando restauremos la funcionalidad
3. No se requiere ninguna acción de su parte en este momento

SOPORTE:
Si tienen preguntas o necesitan asistencia:
- Email: soporte@tistis.com
- Teléfono: [PHONE NUMBER]
- Chat en vivo: tistis.com/support

Pedimos disculpas por cualquier inconveniente y agradecemos su comprensión.

Atentamente,
Equipo TIS TIS
```

### Customer In-App Notification

```
⚠️ API Keys Behavior Change

Las API Keys por sucursal han sido convertidas temporalmente
a acceso completo (tenant-wide) por mantenimiento.

Use ?branch_id=xxx para filtrar por sucursal específica.

Duración estimada: 24-48 horas
Impacto: Bajo (workaround disponible)

[Ver Detalles] [Contactar Soporte]
```

### Internal Slack Post (#engineering)

```
🔄 ROLLBACK EXECUTED - FASE 2 (Branch-Specific Keys)

Status: ✅ COMPLETE
Timestamp: [AUTO-FILLED]
Duration: ~45 minutes
Downtime: ~2 minutes (during deployment)

Database Changes:
- [X] keys converted from 'branch' to 'tenant' scope
- Backup created: [PATH TO BACKUP FILE]
- Zero data loss

Impact:
- APIs affected: ALL endpoints with branch filtering
- Clients affected: ~15-20% (multi-branch tenants)
- Behavior: Branch keys now work as tenant-wide keys

Customer Communication:
- ✅ Email sent to affected customers
- ✅ In-app notification published
- ✅ Support team briefed
- ✅ Status page updated

Next steps:
1. ⏳ Monitor customer feedback (24 hours)
2. ⏳ Root cause analysis (ETA: 8 hours)
3. ⏳ Hotfix development (ETA: 48 hours)
4. ⏳ QA validation (ETA: 72 hours)
5. ⏳ Re-deploy (ETA: Week 2)

Incident Commander: @[NAME]
Database Lead: @[NAME]
Customer Success: @[NAME]

Files:
- Rollback log: [LINK]
- Database backup: [LINK]
- Communication template: [LINK]
```

### Customer Success Team Briefing

```
📋 CUSTOMER SUCCESS BRIEF - FASE 2 Rollback

What Happened:
We rolled back the branch-specific API keys feature to resolve [ISSUE].

What Customers Will Experience:
- Branch-scoped API keys now grant access to ALL branches
- Functionality is preserved (no service interruption)
- Workaround available: use ?branch_id=xxx in query parameters

Talking Points:
1. "We've temporarily reverted a feature for stability reasons"
2. "All your keys are still valid and working"
3. "You can use ?branch_id=xxx to filter by branch"
4. "We expect to restore the feature within 48 hours"
5. "Zero data loss, zero service interruption"

Expected Questions:
Q: "Do I need to regenerate my API keys?"
A: "No, all existing keys continue to work normally."

Q: "How do I filter by branch now?"
A: "Add ?branch_id=YOUR_BRANCH_ID to your API requests."

Q: "When will this be fixed?"
A: "We're working on a fix and expect resolution within 48 hours."

Q: "Will this happen again?"
A: "We're implementing additional safeguards to prevent similar issues."

Escalation:
For technical questions beyond these talking points, escalate to:
- Engineering Lead: [NAME] ([EMAIL])
- On-call Engineer: [NAME] (via PagerDuty)

Support Ticket Template:
Category: API - Branch Keys Rollback
Priority: Medium
Response SLA: 4 hours
```

---

## 📝 FASE 3: Performance Optimization Rollback

### Customer Email Template

```
Subject: [TIS TIS] Performance Optimization Temporary Rollback

Estimados clientes,

Hemos revertido temporalmente nuestras optimizaciones de rendimiento
de API para garantizar estabilidad máxima.

IMPACTO:
- ✓ Todos los servicios funcionan normalmente
- ⚠️ Pueden notar respuestas ligeramente más lentas (temporal)
- ✓ Cero pérdida de datos
- ✓ No se requiere ninguna acción de su parte

QUÉ SIGNIFICA ESTO:
- Los requests de API pueden tardar 50-100ms más que antes
- Esto NO afecta la funcionalidad, solo la velocidad
- Esperamos volver a los tiempos optimizados en 24-48 horas

PRÓXIMOS PASOS:
1. Resolveremos el issue y re-desplegaremos mejoras
2. Los tiempos de respuesta volverán a niveles óptimos
3. Les notificaremos cuando las optimizaciones estén activas nuevamente

Si experimentan algún problema más allá de respuestas más lentas,
por favor contáctenos inmediatamente.

Gracias por su paciencia,
Equipo TIS TIS
soporte@tistis.com
```

### Internal Slack Post (#engineering)

```
🔄 ROLLBACK EXECUTED - FASE 3 (Performance Optimization)

Status: ✅ COMPLETE
Timestamp: [AUTO-FILLED]
Duration: ~15 minutes
Downtime: ~1 minute

What was reverted:
- Caching layer (Next.js unstable_cache)
- Database indexes (optional)
- RPC functions and materialized views (optional)

Impact:
- Performance: Queries may be 2-3x slower
- APIs affected: ALL (transparent to clients)
- Clients affected: 0% (no functionality change)
- Expected P95 latency: 150-200ms (was 50-80ms)

Metrics to monitor:
- P95 query latency (expect increase)
- Database CPU utilization (expect increase)
- Error rate (should remain stable)
- Customer complaints (should be minimal)

Next steps:
1. ⏳ Monitor performance metrics (24 hours)
2. ⏳ Root cause analysis (ETA: 12 hours)
3. ⏳ Fix optimizations (ETA: 48 hours)
4. ⏳ Re-deploy with validation (ETA: 72 hours)

Notes:
- Database state: [KEPT OPTIMIZATIONS / ROLLED BACK]
- Performance acceptable for current load
- No customer-facing functionality affected

Team:
- Incident Commander: @[NAME]
- Performance Lead: @[NAME]
- Database Admin: @[NAME]
```

---

## 📝 Status Page Updates

### Template: Incident Identified

```
🟡 Investigating - API Performance Issue

We are investigating reports of [ISSUE DESCRIPTION].

Time: [TIMESTAMP]
Status: Investigating
Impact: [Minor/Moderate/Major]
Affected Services: [LIST]

Updates will be posted every 15 minutes.
```

### Template: Rollback In Progress

```
🟠 Maintenance - Rollback In Progress

We are rolling back recent changes to restore service stability.

Time: [TIMESTAMP]
Status: Maintenance
Impact: Brief service interruption (~2 minutes)
Affected Services: [LIST]
Expected Resolution: 15 minutes

Thank you for your patience.
```

### Template: Resolved

```
🟢 Resolved - Service Restored

The issue has been resolved. All services are operating normally.

Time: [TIMESTAMP]
Status: Resolved
Resolution: Rolled back to previous stable version
Impact: Service fully restored

Root cause investigation is ongoing.
Thank you for your patience.
```

---

## 📝 Postmortem Template

```markdown
# Postmortem: [FASE X] Rollback

**Date:** [DATE]
**Authors:** [ENGINEERING LEADS]
**Status:** Published
**Severity:** [P1/P2/P3/P4]

---

## Summary

[ONE PARAGRAPH SUMMARY]

---

## Timeline (All times in UTC)

- **[TIME]**: Issue first detected
- **[TIME]**: Incident declared
- **[TIME]**: Decision to rollback
- **[TIME]**: Rollback initiated
- **[TIME]**: Rollback complete
- **[TIME]**: Validation passed
- **[TIME]**: Incident resolved
- **[TIME]**: Customer communication sent

Total duration: [X] minutes/hours

---

## Impact

- **Users Affected:** [NUMBER] ([PERCENTAGE]%)
- **Duration:** [TIME]
- **Downtime:** [TIME]
- **Data Loss:** NONE / [DESCRIPTION]
- **Revenue Impact:** [IF APPLICABLE]

---

## Root Cause

[DETAILED EXPLANATION OF WHAT WENT WRONG]

### Contributing Factors

1. [FACTOR 1]
2. [FACTOR 2]
3. [FACTOR 3]

---

## Resolution

### Immediate Actions

1. [ACTION 1]
2. [ACTION 2]
3. [ACTION 3]

### Rollback Process

[DESCRIPTION OF ROLLBACK STEPS TAKEN]

---

## What Went Well

- [POSITIVE 1]
- [POSITIVE 2]
- [POSITIVE 3]

---

## What Went Wrong

- [ISSUE 1]
- [ISSUE 2]
- [ISSUE 3]

---

## Action Items

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| [ACTION 1] | @[NAME] | P0 | [DATE] | ⏳ In Progress |
| [ACTION 2] | @[NAME] | P1 | [DATE] | 📋 Not Started |
| [ACTION 3] | @[NAME] | P2 | [DATE] | 📋 Not Started |

---

## Lessons Learned

1. **[LESSON 1]**
   - What: [DESCRIPTION]
   - Why: [EXPLANATION]
   - Action: [SPECIFIC CHANGE]

2. **[LESSON 2]**
   - What: [DESCRIPTION]
   - Why: [EXPLANATION]
   - Action: [SPECIFIC CHANGE]

---

## Prevention Measures

### Testing

- [ENHANCEMENT 1]
- [ENHANCEMENT 2]

### Monitoring

- [ENHANCEMENT 1]
- [ENHANCEMENT 2]

### Process

- [ENHANCEMENT 1]
- [ENHANCEMENT 2]

---

**Next Review:** [DATE]
**Sign-off:** [ENGINEERING LEAD], [CTO]
```

---

## 📋 Communication Checklist

Post-rollback communication checklist:

- [ ] Internal team notified (Slack #engineering)
- [ ] On-call engineer briefed
- [ ] Engineering lead informed
- [ ] CTO/Leadership notified (if P1/P2)
- [ ] Customer email drafted and approved
- [ ] Customer email sent to affected users
- [ ] In-app notification published
- [ ] Status page updated
- [ ] Customer Success team briefed
- [ ] Support tickets categorized
- [ ] Documentation updated
- [ ] Postmortem scheduled (within 72 hours)
- [ ] Follow-up communication planned

---

**Maintained by:** Engineering Team
**Last Updated:** 2026-01-22
**Review Frequency:** After each rollback

