# FASE 15: Feature Flags

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 15 |
| **Nombre** | Feature Flags |
| **Sprint** | 4 - Produccion |
| **Duracion Estimada** | 0.5 dias |
| **Dependencias** | Fase 14 (Migracion) |
| **Documento Referencia** | `13-MIGRACION-ROLLOUT.md` |

---

## Objetivo

Implementar sistema de feature flags para controlar el rollout gradual de Voice Agent v2 y permitir rollback instantaneo.

---

## Microfases

### MICROFASE 15.1: Crear Tabla de Feature Flags
```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  enabled BOOLEAN DEFAULT false,
  percentage INT DEFAULT 0,
  enabled_tenants TEXT[],
  disabled_tenants TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### MICROFASE 15.2: Implementar Feature Flag Service
```typescript
// lib/feature-flags/voice-agent-v2.ts
- getVoiceAgentV2Flags()
- shouldUseVoiceAgentV2(tenantId)
- updateRolloutPercentage(percentage)
- enableTenantForV2(tenantId)
- disableTenantForV2(tenantId)
```

### MICROFASE 15.3: Integrar en Webhook Router
- Verificar flag antes de procesar
- Rutear a v1 o v2 segun flag
- Loguear version usada

### MICROFASE 15.4: Crear Admin UI para Flags
- Toggle global
- Control de porcentaje
- Lista de tenants override
- Visualizacion de estado

### MICROFASE 15.5: Tests de Feature Flags
- Porcentaje funciona
- Override por tenant funciona
- Rollback instantaneo funciona

---

## Criterios de Exito
- [ ] Flag creado en DB
- [ ] Service funcional
- [ ] Integrado en webhook
- [ ] Admin UI funcional
- [ ] Rollback < 1 minuto
