# FASE 17: Rollout a Produccion

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 17 |
| **Nombre** | Rollout Produccion |
| **Sprint** | 4 - Produccion |
| **Duracion Estimada** | 3-5 dias |
| **Dependencias** | Fases 14-16 |
| **Documento Referencia** | `13-MIGRACION-ROLLOUT.md` |

---

## Objetivo

Ejecutar el rollout gradual de Voice Agent v2 a produccion con monitoreo continuo y capacidad de rollback instantaneo.

---

## Microfases

### MICROFASE 17.1: Pre-Rollout Checklist
- [ ] Migracion completada
- [ ] Feature flags configurados
- [ ] Monitoreo activo
- [ ] Alertas configuradas
- [ ] Rollback probado
- [ ] Equipo notificado

### MICROFASE 17.2: Canary (5%) - Dia 1
**Duracion:** 4-8 horas
- Habilitar para 2-3 tenants de confianza
- Monitoreo cada 30 minutos
- Verificar:
  - Error rate < 1%
  - Latencia p95 < 800ms
  - Llamadas funcionan end-to-end

### MICROFASE 17.3: Early Adopters (10%) - Dia 1-2
**Duracion:** 24 horas
- Incrementar a 10% de tenants
- Seleccionar por bajo volumen
- Monitoreo cada hora
- Criterio de avance: error rate < 1%

### MICROFASE 17.4: Expansion (25%) - Dia 2-3
**Duracion:** 24 horas
- Incrementar a 25%
- Incluir mix de volumenes
- Monitoreo cada 2 horas
- Criterio: error rate < 2%, latencia OK

### MICROFASE 17.5: Mayoria (50%) - Dia 3-4
**Duracion:** 24-48 horas
- Incrementar a 50%
- Incluir tenants de alto volumen
- Monitoreo cada 4 horas
- Criterio: metricas estables

### MICROFASE 17.6: Completo (100%) - Dia 5+
- Incrementar a 100%
- Monitoreo normal
- Mantener flag activo por 1 semana
- Preparar para remover flags

### MICROFASE 17.7: Post-Rollout
- Verificar metricas finales
- Documentar lecciones aprendidas
- Remover feature flags
- Deprecar codigo V1
- Comunicar exito a stakeholders

---

## Criterios Go/No-Go por Fase

| Metrica | Go | No-Go (Rollback) |
|---------|-----|------------------|
| Error Rate | < 2% | > 5% |
| Latencia p95 | < 800ms | > 1200ms |
| Llamadas Fallidas | < 3% | > 10% |
| Circuit Breaker Opens | 0 | > 2 |

---

## Procedimiento de Rollback

**Nivel 1 - Tenant Individual:**
```bash
npm run rollback:tenant -- --tenant-id=XXX
```

**Nivel 2 - Reducir Porcentaje:**
```bash
npm run rollout:set -- --percentage=25
```

**Nivel 3 - Rollback Total:**
```bash
npm run rollout:set -- --percentage=0
```

---

## Criterios de Exito Final
- [ ] 100% tenants en V2
- [ ] Error rate < 2%
- [ ] Latencia p95 < 800ms
- [ ] 0 bugs criticos post-rollout
- [ ] Feature flags removidos
- [ ] Documentacion completa
