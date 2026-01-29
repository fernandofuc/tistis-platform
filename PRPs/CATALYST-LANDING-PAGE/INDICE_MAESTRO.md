# TIS TIS Catalyst - Landing Page
## Indice Maestro de Implementacion

---

**Proyecto:** Nueva pagina de marketing "Catalyst" con video scroll-sync estilo Apple
**Fecha de Creacion:** 28 de Enero, 2026
**Estado:** Planificacion Completa

---

## Resumen Ejecutivo

Crear una nueva pagina de marketing premium para "TIS TIS Catalyst", una futura plataforma de tokenizacion que permitira a negocios establecidos levantar capital sin bancos ni ceder equity. La pagina sera visual y explicativa con un distintivo "Proximamente".

### Caracteristicas Principales

1. **Video Scroll-Sync**: Video de moneda cripto que avanza segun el scroll del usuario
2. **Animaciones Apple-Style**: Textos que aparecen progresivamente con animaciones fluidas
3. **Diseno Premium**: Colores TIS TIS (coral/pink) con tipografia "Menos trabajo. Mas vida"
4. **Seccion Proximamente**: Indicador claro de que es una funcion futura

---

## Estructura de Fases

| Fase | Nombre | Microfases | Prioridad |
|------|--------|------------|-----------|
| **FASE 0** | Analisis y Planificacion | 3 | Completada |
| **FASE 1** | Infraestructura Base | 4 | Alta |
| **FASE 2** | Video Scroll Sync | 3 | Alta |
| **FASE 3** | Secciones de la Pagina | 7 | Alta |
| **FASE 4** | Animaciones y Polish | 4 | Media |
| **FASE 5** | Testing y Refinamiento | 3 | Media |

---

## Documentos de Cada Fase

### [FASE_0_ANALISIS.md](./FASE_0_ANALISIS.md)
Analisis completo de requisitos, arquitectura tecnica, y diseno visual.

### [FASE_1_INFRAESTRUCTURA.md](./FASE_1_INFRAESTRUCTURA.md)
Setup inicial: crear ruta, actualizar header, copiar assets.

### [FASE_2_VIDEO_SCROLL.md](./FASE_2_VIDEO_SCROLL.md)
Implementacion del video que avanza con el scroll.

### [FASE_3_SECCIONES.md](./FASE_3_SECCIONES.md)
Todas las secciones de la pagina con contenido y estructura.

### [FASE_4_ANIMACIONES.md](./FASE_4_ANIMACIONES.md)
Animaciones de scroll, transiciones, responsive design.

### [FASE_5_TESTING.md](./FASE_5_TESTING.md)
Tests visuales, performance, ajustes finales.

---

## Flujo de Ejecucion

```
Usuario dice: "Procede con FASE 1"
         │
         ▼
┌─────────────────────────────────────┐
│  Claude lee FASE_1_INFRAESTRUCTURA  │
│  y ejecuta todas las microfases     │
└─────────────────────────────────────┘
         │
         ▼
Usuario dice: "Procede con FASE 2"
         │
         ▼
┌─────────────────────────────────────┐
│  Claude lee FASE_2_VIDEO_SCROLL     │
│  y ejecuta todas las microfases     │
└─────────────────────────────────────┘
         │
         ▼
   ... continua hasta FASE 5
```

---

## Resumen Tecnico Rapido

### Archivos a Crear/Modificar

| Archivo | Accion | Fase |
|---------|--------|------|
| `components/layout/Header.tsx` | Modificar | 1 |
| `app/(marketing)/catalyst/page.tsx` | Crear | 1 |
| `app/(marketing)/catalyst/components/` | Crear | 3 |
| `public/videos/catalyst-token.mp4` | Copiar | 1 |
| `src/hooks/useVideoScrollSync.ts` | Crear | 2 |

### Dependencias Existentes (ya instaladas)

- `framer-motion` - Para animaciones
- `lucide-react` - Para iconos
- `tailwindcss` - Para estilos

### Colores y Tipografia (ya definidos)

```css
--tis-coral: rgb(223, 115, 115);    /* Principal */
--tis-pink: rgb(194, 51, 80);       /* Acento */
--tis-purple: #667eea;              /* Secundario */
```

---

## Criterios de Aceptacion

- [ ] Link "Catalyst" visible en el header entre "Como funciona" y Dashboard
- [ ] Video reproduce suavemente segun scroll (sin jitters)
- [ ] Animaciones fluidas al hacer scroll (60fps)
- [ ] Responsive en mobile, tablet y desktop
- [ ] Badge "Proximamente" visible y destacado
- [ ] Contenido explica claramente que es Catalyst
- [ ] Estilo visual consistente con TIS TIS (coral, gradientes)

---

## Recursos de Referencia

### Documento Original de Catalyst
`/Users/macfer/Documents/TIS TIS /Genesis + Catalyst/TIS TIS Catalyst/TIS TIS Catalyst.md`

### Video de la Moneda
`/Users/macfer/Documents/TIS TIS /Genesis + Catalyst/TIS TIS Catalyst/cinematic_product_shot_a_single_luxury_cryptocurrency.mp4`

### Paginas de Referencia en el Proyecto
- Landing principal: `app/(marketing)/page.tsx`
- Como Funciona: `app/(marketing)/como-funciona/`
- Header: `components/layout/Header.tsx`

---

**Listo para comenzar. Di "Procede con FASE 1" cuando estes listo.**
