# TIS TIS Platform - Documentation Index

**Current Version:** 4.7.0
**Last Updated:** January 25, 2026

---

## Project Documentation

Esta es la guia completa de documentacion disponible para TIS TIS Platform.

### Core Documentation

#### [CLAUDE.md](../CLAUDE.md)
**Tipo:** Project guidelines y arquitectura general
**Contenido:**
- Descripcion del proyecto y version
- Arquitectura completa (directorios, features)
- Sistema IA Multi-Agente (LangGraph)
- Sistema de Terminologia Dinamica Multi-Vertical
- Integration Hub overview
- Base de datos (Supabase)
- Patrones de codigo
- Reglas criticas y security
- Comandos de desarrollo

**Cuando usar:**
- Como referencia rapida de arquitectura
- Para entender principios de desarrollo
- Para ver reglas de seguridad
- Para patrones de codigo establecidos

---

## Feature Documentation

### Admin Channel System (v4.7.0 - FASE 1)

Nuevo sistema que permite a clientes B2B interactuar con TIS TIS via WhatsApp/Telegram.

#### [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md)
**Tipo:** Documentacion completa de feature
**Contenido:**
- Descripcion y proposito del Admin Channel
- Arquitectura de componentes
- Base de datos completa (tablas, RLS, triggers)
- Tipos de datos (DB, application, converters)
- Servicios disponibles (metodos core)
- Flujos de trabajo detallados (5 escenarios principales)
- Intents y acciones
- Seguridad y RLS policies
- Rate limiting implementado
- Auditoria completa
- Guia de testing
- Proximas fases (FASE 2-7)

**Cuando usar:**
- Entender completamente el sistema Admin Channel
- Consultar arquitectura de datos
- Ver flujos de trabajo y casos de uso
- Entender proximas fases de implementacion

**Lectura recomendada:** 30-45 minutos para comprension completa

---

#### [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md)
**Tipo:** Quick start y guia practica
**Contenido:**
- Quick start (3 pasos principales)
- Estructura de tipos (row, application, converters)
- Patrones de codigo comunes (4 patrones)
- Tipos principales resumidos
- Flujos comunes (3 ejemplos)
- Testing rapido (setup + ejemplos)
- Troubleshooting (errores comunes)
- Proximos pasos (FASE 2 preview)

**Cuando usar:**
- Empezar rapidamente a usar el sistema
- Entender patrones de codigo
- Ver ejemplos de casos de uso
- Debugging de problemas comunes

**Lectura recomendada:** 15-20 minutos para quick start

---

#### [ADMIN_CHANNEL_API_REFERENCE.md](./ADMIN_CHANNEL_API_REFERENCE.md)
**Tipo:** API reference detallada
**Contenido:**
- 6 RPCs documentados (generate_link_code, verify_link_code, etc)
- Service methods wrapper (user, conversation, message, rate limit, notification)
- Parametros y retornos exactos en JSON
- Ejemplos TypeScript de cada metodo
- Logica interna de cada RPC
- Error handling patterns
- Performance notes y indices
- Rate limits de API (FASE 2)
- Changelog

**Cuando usar:**
- Consultar parametros exactos de un RPC
- Ver retornos esperados
- Ejemplos TypeScript para implementar
- Entender logica interna
- Debugging de respuestas

**Lectura recomendada:** Reference - consultar segun necesidad

---

## System Documentation

### [API.md](./API.md)
**Tipo:** API general del proyecto
**Contenido:**
- Overview de endpoints REST
- Authentication y rate limiting
- Documentacion de leads, patients, appointments, etc
- Ejemplos de requests/responses

**Version:** General project API (no Admin Channel)

---

### [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
**Tipo:** Guia de integraciones externas
**Contenido:**
- Integration Hub system
- Conectores soportados (HubSpot, etc)
- Configuracion y setup
- Sincronizacion de datos

---

## Voice Agent Documentation

### [README_VOICE_AGENT.md](./README_VOICE_AGENT.md)
**Tipo:** Voice agent system overview

### [VOICE_AGENT_FIXES.md](./VOICE_AGENT_FIXES.md)
**Tipo:** Bug fixes y improvements

### [VOICE_AGENT_VALIDATION_CHECKLIST.md](./VOICE_AGENT_VALIDATION_CHECKLIST.md)
**Tipo:** Testing checklist

### [CHANGELOG_VOICE_AGENT.md](./CHANGELOG_VOICE_AGENT.md)
**Tipo:** Version history

---

## Trial & Subscription Documentation

### [FREE_TRIAL_SYSTEM.md](./FREE_TRIAL_SYSTEM.md)
**Tipo:** Free trial feature documentation

### [TRIAL_SYSTEM_*_REVIEW.md](./TRIAL_SYSTEM_NINTH_REVIEW.md)
**Tipo:** Trial system reviews and updates

---

## Additional Resources

### [PLAN_MAESTRO_PROYECTO.md](../PLAN_MAESTRO_PROYECTO.md)
**Tipo:** Project master plan
**Contenido:**
- Analisis de arquitectura
- Decisiones criticas
- Roadmap del proyecto
- Estado actual vs planned

---

## Database Migrations

### Migration Reference: `177_ADMIN_CHANNEL_SYSTEM.sql`

**Ubicacion:** `/supabase/migrations/177_ADMIN_CHANNEL_SYSTEM.sql`

**Contenido:**
- 8 ENUMs para tipos de datos
- 5 Tablas principales
- RLS Policies con tenant isolation
- 6 RPCs implementados
- Triggers para updated_at
- Indices optimizados para performance

---

## Code Structure Reference

### Feature Folder: Admin Channel

```
src/features/admin-channel/
├── types/
│   ├── db-rows.types.ts          # SQL types (snake_case)
│   ├── application.types.ts      # App types (camelCase)
│   ├── converters.ts             # DB ↔ App bidirectional
│   ├── api.types.ts              # API request/response types
│   ├── constants.ts              # Enums, error messages
│   └── index.ts                  # Barrel exports
├── services/
│   ├── admin-channel.service.ts  # Core singleton service
│   └── index.ts                  # Barrel exports
├── components/                   # (FASE 2 - UI components)
├── hooks/                        # (FASE 2 - Custom hooks)
└── index.ts                      # Public API
```

---

## Quick Navigation Guide

### I need to...

**Entender como funciona el Admin Channel:**
1. Lee: [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md) - Seccion "Arquitectura"
2. Lee: [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md)

**Usar el servicio Admin Channel:**
1. Lee: [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md) - Seccion "Quick Start"
2. Consulta: [ADMIN_CHANNEL_API_REFERENCE.md](./ADMIN_CHANNEL_API_REFERENCE.md)
3. Referencia: [CLAUDE.md](../CLAUDE.md) - Seccion "Admin Channel System"

**Implementar un flujo especifico:**
1. Lee: [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md) - Seccion "Flujos de Trabajo"
2. Consulta ejemplos en: [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md)
3. Implementa usando: [ADMIN_CHANNEL_API_REFERENCE.md](./ADMIN_CHANNEL_API_REFERENCE.md)

**Debuggear un problema:**
1. Lee: [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md) - Seccion "Troubleshooting"
2. Consulta: [ADMIN_CHANNEL_API_REFERENCE.md](./ADMIN_CHANNEL_API_REFERENCE.md) - Seccion "Error Handling"
3. Revisa: Audit logs en BD para rastrear acciones

**Entender los tipos de datos:**
1. Lee: [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md) - Seccion "Tipos de Datos"
2. Consulta código: `/src/features/admin-channel/types/`

**Planificar FASE 2 (API Routes):**
1. Lee: [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md) - Seccion "Proximas Fases"
2. Referencia: [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md) - Seccion "Proximos Pasos"

---

## Development Workflow

### Before Starting Work

1. Consulta [CLAUDE.md](../CLAUDE.md) para principios y reglas criticas
2. Entiende el scope usando documentacion relevante
3. Revisa patrones de codigo establecidos

### During Development

1. Sigue patrones en [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md)
2. Consulta [ADMIN_CHANNEL_API_REFERENCE.md](./ADMIN_CHANNEL_API_REFERENCE.md) para APIs
3. Asegura testing usando [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md) - Testing

### Before Committing

1. Verifica tipos con `npm run typecheck`
2. Corre linter con `npm run lint`
3. Actualiza documentacion si cambio logica
4. Valida contra audit_log en BD si toca datos sensibles

---

## Documentacion vs Codigo

### Single Source of Truth

Este indice es el punto de entrada. Las documentaciones enlazadas son:

- **ADMIN_CHANNEL_SYSTEM.md** - Punto de referencia para arquitectura y diseño
- **ADMIN_CHANNEL_API_REFERENCE.md** - Punto de referencia para APIs y RPCs
- **CLAUDE.md** - Punto de referencia para patrones y reglas

Si encuentras inconsistencia entre codigo y documentacion, **la documentacion debe ser actualizada**.

---

## Contributing to Documentation

### Cuando actualizar documentacion

1. **Cambios de arquitectura** - Actualiza [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md)
2. **Cambios de API/RPCs** - Actualiza [ADMIN_CHANNEL_API_REFERENCE.md](./ADMIN_CHANNEL_API_REFERENCE.md)
3. **Nuevos patrones** - Actualiza [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md)
4. **Nuevas features** - Crea nuevo archivo y enlaza aqui

### Formato para nuevos documentos

- Usa Markdown
- Incluye tabla de contenidos
- Agrupa por secciones logicas
- Incluye ejemplos de codigo
- Agrega "Last Updated" timestamp
- Enlaza a archivos relacionados

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.7.0 | 2026-01-25 | FASE 1 - Admin Channel System Foundation |
| 4.6.0 | 2025-12-29 | Dynamic Terminology System |
| 4.4.0 | 2025-11-15 | Integration Hub System |
| 4.0.0 | Earlier | Initial release |

---

## Support & Questions

### Para preguntas sobre...

**Arquitectura general:** Consulta [CLAUDE.md](../CLAUDE.md)

**Admin Channel specifico:** Consulta [ADMIN_CHANNEL_SYSTEM.md](./ADMIN_CHANNEL_SYSTEM.md)

**Como implementar algo:** Consulta [ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](./ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md)

**Parametros de API:** Consulta [ADMIN_CHANNEL_API_REFERENCE.md](./ADMIN_CHANNEL_API_REFERENCE.md)

**Codigo real:** Consulta archivos en `/src/features/admin-channel/` y `/supabase/migrations/177_*.sql`

---

**Ultima revision:** Enero 25, 2026
**Proxima revision recomendada:** Cuando se complete FASE 2
