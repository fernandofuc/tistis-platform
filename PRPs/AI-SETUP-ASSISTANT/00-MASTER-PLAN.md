# AI Setup Assistant - Master Plan

## Vision General

Implementar un **Asistente de Configuracion IA** al estilo Claude Cowork que permita a los clientes configurar completamente su cuenta TIS TIS mediante conversacion natural con IA.

**Modelo:** Gemini 3.0 Flash
**Ubicacion:** Dashboard > AI Setup (debajo del dashboard principal)
**Verticales:** Restaurant, Dental (extensible)

---

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AI SETUP ASSISTANT                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Chat UI   │───▶│  Setup Assistant │───▶│   TIS TIS APIs   │  │
│  │  (React)    │    │  LangGraph Agent │    │  (Configuration) │  │
│  └─────────────┘    └──────────────────┘    └──────────────────┘  │
│         │                    │                       │             │
│         ▼                    ▼                       ▼             │
│  ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │ File Upload │───▶│  Gemini Vision   │    │   Supabase DB    │  │
│  │ (Images)    │    │  (Analysis)      │    │   (Persistence)  │  │
│  └─────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fases de Implementacion

| Fase | Nombre | Microfases | Dependencias |
|------|--------|------------|--------------|
| **1** | Database Schema | 5 | Ninguna |
| **2** | API Routes | 6 | Fase 1 |
| **3** | LangGraph Agent | 7 | Fase 2 |
| **4** | Gemini Vision | 4 | Fase 2 |
| **5** | UI Components | 8 | Fases 2, 3, 4 |
| **6** | Usage Limits | 4 | Fases 1, 2, 5 |
| **7** | Integrations | 6 | Todas las anteriores |
| **8** | Testing & QA | 5 | Todas las anteriores |

**Total:** 8 Fases, 45 Microfases

---

## Capacidades del Asistente

### Configuracion General
- [ ] Identidad del negocio (nombre, tono, instrucciones)
- [ ] Horarios de operacion
- [ ] Informacion de contacto
- [ ] Politicas de cancelacion y pagos

### Sistema de Lealtad
- [ ] Crear programa de lealtad
- [ ] Definir niveles/tiers
- [ ] Configurar recompensas
- [ ] Establecer reglas de puntos

### Agentes IA
- [ ] Configurar personalidad del bot
- [ ] Definir scripts de respuesta
- [ ] Configurar escalacion
- [ ] Ajustar comportamiento por canal

### Base de Conocimiento
- [ ] Subir documentos (PDF, DOCX)
- [ ] Subir imagenes (menu POS, folletos)
- [ ] Crear FAQs
- [ ] Definir respuestas predeterminadas

### Servicios y Productos
- [ ] Agregar servicios con precios
- [ ] Subir menu de restaurante via foto
- [ ] Configurar duraciones
- [ ] Establecer disponibilidad

### Promociones
- [ ] Crear promociones
- [ ] Definir condiciones
- [ ] Establecer vigencia
- [ ] Asignar a canales

---

## Limites de Uso por Plan

| Plan | Mensajes/Dia | Archivos/Dia | Vision/Dia |
|------|--------------|--------------|------------|
| **Starter** | 20 | 3 | 2 |
| **Essentials** | 50 | 10 | 5 |
| **Growth** | 200 | 50 | 25 |
| **Enterprise** | Ilimitado | Ilimitado | Ilimitado |

---

## Stack Tecnologico

- **Frontend:** Next.js 14, React 18, Framer Motion
- **AI Model:** Gemini 3.0 Flash (gemini-3-flash-preview)
- **Vision:** Gemini Pro Vision
- **State:** Zustand + React Query
- **Backend:** Supabase (Postgres + RLS)
- **Agent Framework:** LangGraph (existente)
- **File Storage:** Supabase Storage (temp-uploads, knowledge-base)

---

## Documentos de Fase

1. [FASE-1-DATABASE.md](./FASE-1-DATABASE.md) - Schema y migraciones
2. [FASE-2-API.md](./FASE-2-API.md) - API Routes
3. [FASE-3-LANGGRAPH.md](./FASE-3-LANGGRAPH.md) - Setup Assistant Agent
4. [FASE-4-VISION.md](./FASE-4-VISION.md) - Gemini Vision
5. [FASE-5-UI.md](./FASE-5-UI.md) - Componentes React
6. [FASE-6-LIMITS.md](./FASE-6-LIMITS.md) - Control de uso
7. [FASE-7-INTEGRATIONS.md](./FASE-7-INTEGRATIONS.md) - Integracion modulos
8. [FASE-8-TESTING.md](./FASE-8-TESTING.md) - Tests y QA

---

## Criterios de Exito

- [ ] Usuario puede configurar negocio completo via chat
- [ ] Subida de imagenes funciona con analisis Vision
- [ ] Limites de plan se respetan
- [ ] Todas las configuraciones persisten correctamente
- [ ] UI responsiva y fluida (60fps)
- [ ] Integracion con AI Learning funcional
- [ ] Tests pasan al 100%
- [ ] Build exitoso sin errores

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Gemini rate limits | Media | Alto | Implementar cola y retry |
| Vision mal interpreta imagen | Alta | Medio | UI de confirmacion |
| Usuario abusa del sistema | Media | Alto | Rate limiting estricto |
| Complejidad de LangGraph | Media | Alto | Reutilizar patrones existentes |

---

## Timeline Estimado

| Fase | Duracion Estimada |
|------|-------------------|
| Fase 1 | 1 sesion |
| Fase 2 | 1-2 sesiones |
| Fase 3 | 2-3 sesiones |
| Fase 4 | 1 sesion |
| Fase 5 | 2-3 sesiones |
| Fase 6 | 1 sesion |
| Fase 7 | 2 sesiones |
| Fase 8 | 1-2 sesiones |
| **Total** | **11-15 sesiones** |

---

*Documento creado siguiendo metodologia de bucle agentico*
*TIS TIS Platform v4.7.0*
