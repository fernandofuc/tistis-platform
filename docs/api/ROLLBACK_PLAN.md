# 🔄 ROLLBACK PLAN - Multi-Branch API System

**Documento:** TIS-API-ROLLBACK-001
**Versión:** 1.0.0
**Aplicable a:** Todas las fases

---

## 🎯 PRINCIPIOS DE ROLLBACK

1. **Zero Data Loss:** Nunca borrar datos en rollback
2. **Backward Compatible:** Rollback debe ser seguro
3. **Fast Recovery:** <10 minutos para rollback crítico
4. **Communication:** Notificar a stakeholders inmediatamente

---

## 🚨 TRIGGER CONDITIONS

### Cuando Hacer Rollback

**CRITICAL (Rollback Inmediato):**
- Error rate > 5% en endpoints afectados
- Data corruption detectada
- Security breach identificado
- Complete service outage

**HIGH (Rollback en <1 hora):**
- Error rate > 2%
- Performance degradation > 50%
- Customer complaints > 10

**MEDIUM (Investigar antes de rollback):**
- Error rate > 1%
- Performance degradation > 20%
- Edge cases failing

---

## 📝 PROCEDIMIENTOS POR FASE

### FASE 1: Query Parameters

#### Rollback Steps

```bash
# 1. Revertir código (Vercel)
git revert <commit-hash-fase-1>
git push origin main
vercel --prod

# Tiempo estimado: 5-10 minutos
# Downtime: 0 minutos
# Data loss: NINGUNO
```

#### Validation

```bash
# Verificar que endpoints vuelven a funcionar
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H "Authorization: Bearer $API_KEY"

# Expected: 200 OK (sin branch filtering)
```

#### Impact Assessment
- **APIs afectadas:** Ninguna (backward compatible)
- **Clientes afectados:** 0 (feature era opt-in)
- **Data loss:** NINGUNO

---

### FASE 2: Branch-Specific Keys

#### Rollback Steps

```bash
# 1. Revertir aplicación
git revert <commit-hash-fase-2>
vercel --prod

# 2. Marcar todas las keys como tenant-wide (SQL)
psql $DATABASE_URL <<EOF
UPDATE api_keys
SET scope_type = 'tenant',
    branch_id = NULL
WHERE scope_type = 'branch';
EOF

# 3. Comunicar a clientes
# Ver template de comunicación abajo
```

#### Validation

```bash
# Test 1: Tenant-wide key functionality
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H "Authorization: Bearer $TENANT_WIDE_KEY"
# Expected: 200 OK, all branches data

# Test 2: Former branch-specific key (now tenant-wide)
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H "Authorization: Bearer $BRANCH_KEY"
# Expected: 200 OK, all branches data (no longer filtered)
```

#### Impact Assessment
- **APIs afectadas:** Todas usando branch filtering
- **Clientes afectados:** ~15-20% (multi-branch tenants)
- **Behavior change:** Branch keys vuelven a ser tenant-wide
- **Data loss:** NINGUNO
- **Tiempo de rollback:** 30-60 minutos

#### Communication Template

```
Subject: [URGENT] API Keys Behavior Change - Temporary Rollback

Estimados clientes,

Hemos revertido temporalmente la funcionalidad de API Keys por sucursal
debido a [RAZÓN TÉCNICA].

CAMBIO INMEDIATO:
- Las API Keys creadas para sucursales específicas ahora tienen acceso
  a TODAS las sucursales de su organización.
- Recomendamos usar el parámetro ?branch_id=xxx si necesitan filtrar.

PRÓXIMOS PASOS:
- Investigaremos y resolveremos el issue en las próximas 48 horas.
- Les notificaremos cuando restauremos la funcionalidad.

Si tienen preguntas: soporte@tistis.com

Gracias por su comprensión,
Equipo TIS TIS
```

---

### FASE 3: Optimization

#### Rollback Steps

```bash
# Rollback de optimizaciones es bajo riesgo
# Simplemente revertir código

git revert <commit-hash-fase-3>
vercel --prod
```

#### Impact Assessment
- **Riesgo:** BAJO (solo optimizaciones, no funcionalidad core)
- **Downtime:** 0 minutos
- **Performance:** Vuelve a niveles pre-FASE 3

---

## 🛡️ PREVENTION MEASURES

### Pre-Deploy Checks

```bash
# Checklist antes de cada deploy
- [ ] Todos los tests pasando (unit + integration + e2e)
- [ ] Code review aprobado (2+ reviewers)
- [ ] Staging validado (smoke tests manuales)
- [ ] Backup de producción realizado (<1 hora antigüedad)
- [ ] Rollback plan revisado y entendido
- [ ] Monitoring dashboards configurados
- [ ] On-call engineer designado
```

### Canary Deployment

```yaml
# Vercel canary config
{
  "routes": [
    {
      "src": "/api/v1/(.*)",
      "headers": {
        "X-Canary-Deployment": "true"
      },
      "dest": "/api-v2/$1",
      "canary": {
        "percentage": 10  // 10% of traffic
      }
    }
  ]
}
```

---

## 📊 POST-ROLLBACK ACTIONS

### Immediate (0-1 hora)

1. **Verify Service Health**
   ```bash
   # Run health checks
   npm run health-check:production

   # Verify error rates normalized
   datadog query "status:error service:api-v1"
   ```

2. **Communicate to Stakeholders**
   - Engineering team (Slack)
   - Customer Success (Email)
   - Affected clients (In-app notification)

### Short-term (1-24 horas)

3. **Root Cause Analysis**
   - Review logs and error traces
   - Identify what triggered rollback
   - Document findings

4. **Create Hotfix Plan**
   - Fix identificado
   - Test suite expandido (evitar regresión)
   - Re-deploy timeline

### Long-term (1-7 días)

5. **Postmortem Document**
   - Timeline of events
   - Root cause
   - Action items
   - Process improvements

6. **Prevent Recurrence**
   - Add tests for failure scenario
   - Update deployment checklist
   - Improve monitoring/alerting

---

## 📞 ESCALATION PATH

### Severity 1 (Critical)
1. On-call engineer → Rollback immediately
2. Notify CTO + Engineering Lead
3. Post in #incidents Slack channel
4. Update status page

### Severity 2 (High)
1. On-call engineer → Investigate (30 min max)
2. Decision: Fix forward or rollback
3. Notify Engineering Lead
4. Post in #engineering Slack channel

### Severity 3 (Medium)
1. Standard debugging process
2. No immediate rollback needed
3. Monitor closely

---

## ✅ ROLLBACK VALIDATION CHECKLIST

Post-rollback validation steps:

- [ ] API endpoints responding (200 OK)
- [ ] Authentication working
- [ ] Database queries successful
- [ ] Error rate < 0.5%
- [ ] P95 latency < 200ms
- [ ] No data corruption detected
- [ ] Customer-facing features functional
- [ ] Monitoring dashboards green
- [ ] Communication sent to stakeholders

---

**Emergency Contact:** oncall@tistis.com
**Status Page:** status.tistis.com
**Incident Channel:** #incidents (Slack)
