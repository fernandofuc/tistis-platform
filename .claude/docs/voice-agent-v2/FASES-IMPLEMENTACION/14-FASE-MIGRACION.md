# FASE 14: Migracion de Datos

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 14 |
| **Nombre** | Migracion de Datos |
| **Sprint** | 4 - Produccion |
| **Duracion Estimada** | 1-2 dias |
| **Dependencias** | Todas las fases anteriores |
| **Documento Referencia** | `13-MIGRACION-ROLLOUT.md` |

---

## Objetivo

Migrar los datos existentes de voice_agent_config a la nueva estructura voice_assistant_configs sin perdida de datos ni downtime.

---

## Microfases

### MICROFASE 14.1: Crear Script de Migracion
```
scripts/
├── migrate-voice-agent-v2.ts
├── validate-migration.ts
└── rollback-migration.ts
```

### MICROFASE 14.2: Implementar Backup
- Backup de voice_agent_config
- Backup de voice_calls
- Timestamp en nombre
- Verificar backup completo

### MICROFASE 14.3: Implementar Transformacion de Datos
- Mapear campos antiguos a nuevos
- Inferir assistant_type de prompt actual
- Extraer special_instructions
- Inferir capabilities

### MICROFASE 14.4: Ejecutar en Staging
- Correr migracion en staging
- Verificar datos migrados
- Probar funcionalidad
- Fix issues encontrados

### MICROFASE 14.5: Validar Migracion
- Contar registros (debe coincidir)
- Verificar foreign keys
- Verificar no hay nulls en required fields
- Verificar funcionalidad

### MICROFASE 14.6: Ejecutar en Produccion
- Crear backup de produccion
- Ejecutar en horario de bajo trafico
- Monitorear errores
- Verificar inmediatamente

### MICROFASE 14.7: Documentar Proceso
- Comandos ejecutados
- Issues encontrados
- Tiempo de ejecucion
- Rollback procedure

---

## Criterios de Exito
- [ ] 100% datos migrados
- [ ] 0 perdida de datos
- [ ] Backup verificado
- [ ] Rollback probado
- [ ] Documentado
