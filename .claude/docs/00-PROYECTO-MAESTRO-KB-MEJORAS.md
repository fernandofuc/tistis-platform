# PROYECTO MAESTRO: Mejoras de Base de Conocimiento y Agentes IA

## Información del Proyecto

| Campo | Valor |
|-------|-------|
| **Fecha de Inicio** | 2026-01-14 |
| **Versión del Doc** | 1.0 |
| **Estado** | En Progreso |
| **Responsable** | Claude Code (Opus 4.5) |

---

## Resumen Ejecutivo

Este proyecto tiene como objetivo elevar la Base de Conocimiento de TIS TIS Platform al estándar de calidad visual e interno de Apple/Lovable, manteniendo el estilo TIS TIS. El trabajo se divide en **5 fases de UI/UX** seguidas de **optimización de prompts** para los agentes de IA.

---

## Alcance del Proyecto

### Incluido
- Mejoras visuales de todos los componentes de Base de Conocimiento
- Reorganización de arquitectura de información
- Nuevas funcionalidades (filtro por sucursal, manejo de competidores, preview de prompts)
- Optimización de prompts para Agente de Mensajes
- Mejoras al Agente de Voz

### Excluido (No Modificar)
- **ServiceCatalogConfig.tsx** - UI aprobada por el usuario
- **Funcionalidad core de BranchManagement** - Solo mejoras cosméticas

---

## Fases del Proyecto

### FASE 1: Mejoras Visuales
- **Documento**: `01-FASE1-MEJORAS-VISUALES.md`
- **Objetivo**: Unificar cards, modales y tabs al estándar Apple/TIS TIS
- **Archivos afectados**: 3 componentes principales

### FASE 2: Arquitectura de Información
- **Documento**: `02-FASE2-ARQUITECTURA-INFO.md`
- **Objetivo**: Renombrar tabs, agregar Quick Stats, tab de Competidores
- **Archivos afectados**: 2 componentes principales

### FASE 3: Mejoras Funcionales
- **Documento**: `03-FASE3-MEJORAS-FUNCIONALES.md`
- **Objetivo**: Filtro por sucursal, variables dinámicas, UI competidores
- **Archivos afectados**: 2 componentes + 1 API route

### FASE 4: Performance y DX
- **Documento**: `04-FASE4-PERFORMANCE-DX.md`
- **Objetivo**: Optimistic updates, auto-save, skeleton loaders
- **Archivos afectados**: Múltiples componentes

### FASE 5: Validaciones y Feedback
- **Documento**: `05-FASE5-VALIDACIONES-FEEDBACK.md`
- **Objetivo**: Indicador de completitud, preview de prompts por perfil
- **Archivos nuevos**: 2-3 componentes

### FASE 6: Optimización de Prompts - Mensajes
- **Documento**: `06-FASE6-PROMPTS-MENSAJES.md`
- **Objetivo**: Mejorar prompts del Agente de Mensajes con Gemini 3.0 Flash
- **Archivos afectados**: prompt-generator.service.ts, instrucciones compiladas

### FASE 7: Optimización de Agente de Voz
- **Documento**: `07-FASE7-AGENTE-VOZ.md`
- **Objetivo**: Mejorar prompts y organización del Agente de Voz
- **Archivos afectados**: voice-agent services, componentes de voz

---

## Documentos de Referencia

### Análisis Completados
- `ANALISIS-ARQUITECTURA-ACTUAL.md` - Arquitectura completa del sistema actual
- `ANALISIS-FLUJO-DATOS.md` - Flujo de datos desde UI hasta agentes
- `ANALISIS-COMPONENTES.md` - Detalle de cada componente analizado

### Especificaciones de Diseño
- `DESIGN-SYSTEM-TIS-TIS.md` - Sistema de diseño unificado
- `PATRONES-UI-COMPONENTES.md` - Patrones de cards, modales, tabs

---

## Métricas de Éxito

1. **Visual**: Todos los componentes siguen el mismo patrón de diseño
2. **Funcional**: Filtro por sucursal operativo, competidores visibles
3. **DX**: Tiempo de guardado < 500ms (optimistic updates)
4. **Completitud**: Usuario puede ver % de KB completado
5. **Prompts**: Preview disponible para cada perfil de agente

---

## Archivos Principales del Proyecto

```
.claude/docs/
├── 00-PROYECTO-MAESTRO-KB-MEJORAS.md     (este archivo)
├── 01-FASE1-MEJORAS-VISUALES.md
├── 02-FASE2-ARQUITECTURA-INFO.md
├── 03-FASE3-MEJORAS-FUNCIONALES.md
├── 04-FASE4-PERFORMANCE-DX.md
├── 05-FASE5-VALIDACIONES-FEEDBACK.md
├── 06-FASE6-PROMPTS-MENSAJES.md
├── 07-FASE7-AGENTE-VOZ.md
├── ANALISIS-ARQUITECTURA-ACTUAL.md
├── ANALISIS-FLUJO-DATOS.md
├── ANALISIS-COMPONENTES.md
├── DESIGN-SYSTEM-TIS-TIS.md
└── PATRONES-UI-COMPONENTES.md
```

---

## Decisiones Clave Tomadas

| Decisión | Razón | Fecha |
|----------|-------|-------|
| Implementar por fases | Permite detalle y calidad en cada sección | 2026-01-14 |
| Agregar UI para ai_competitor_handling | Usuario confirmó utilidad | 2026-01-14 |
| Filtro por sucursal en KB | Usuario confirmó utilidad | 2026-01-14 |
| Preview de prompt por perfil | Negocio, Personal, Voz - cada uno visible | 2026-01-14 |
| Comenzar por FASE 1 (Visual) | Base sólida para siguientes mejoras | 2026-01-14 |
| NO modificar ServiceCatalogConfig | Usuario satisfecho con UI actual | 2026-01-14 |

---

## Historial de Cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-01-14 | Documento inicial creado |

