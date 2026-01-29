# FASE 0: Analisis y Planificacion
## TIS TIS Catalyst Landing Page

---

## Estado: COMPLETADA (Documento de Referencia)

Este documento contiene el analisis exhaustivo de requisitos, arquitectura y diseno. Sirve como referencia durante toda la implementacion.

---

## Microfase 0.1: Analisis de Requisitos del Negocio

### Que es TIS TIS Catalyst

Una plataforma futura que permite a negocios establecidos levantar capital para proyectos de expansion sin:
- Recurrir a bancos (que piden garantias imposibles)
- Ceder equity de su empresa

### Mecanismo Principal: Tokenizacion

Los negocios emiten "tokens" que representan **derechos temporales** sobre los ingresos de un proyecto especifico (no de todo el negocio).

### Flujo de Tokenizacion (5 Pasos)

```
1. NEGOCIO CALIFICA
   ├── Minimo 24 meses usando TIS TIS
   ├── Ingresos >= $500,000 MXN/mes
   ├── Margen operativo positivo 12 meses
   └── Proyecto especifico definido (ej: segunda sucursal)

2. TIS TIS CERTIFICA
   ├── Auditoria de datos historicos del negocio
   ├── Verificacion de metricas reales (no declaradas)
   ├── Score de confiabilidad basado en 2+ anos de datos
   └── Reporte publico para inversionistas

3. NEGOCIO EMITE TOKENS
   ├── Ejemplo: 100 tokens de $10,000 MXN c/u = $1,000,000 MXN
   ├── Cada token = derecho al X% de ingresos del proyecto
   ├── Plazo definido (ej: 24-36 meses)
   └── NO es equity, NO es deuda con interes

4. INVERSIONISTAS COMPRAN
   ├── Ven datos verificados por TIS TIS
   ├── Compran tokens segun su apetito de riesgo
   └── Reciben pagos mensuales proporcionales

5. DISTRIBUCION AUTOMATICA
   ├── TIS TIS registra ingresos del proyecto en tiempo real
   ├── Calcula distribucion automatica a holders
   └── Reportes transparentes para ambas partes
```

### Beneficios por Actor

| Actor | Beneficio |
|-------|-----------|
| **Negocio** | Acceso a capital sin bancos y sin ceder propiedad |
| **Inversionistas** | Invertir en negocios locales con datos verificados |
| **TIS TIS** | Revenue por certificacion, infraestructura y fees |

### Disclaimer Critico

TIS TIS **NO maneja dinero**, **NO custodia fondos**, **NO garantiza rendimientos**. Solo:
- Certifica que el negocio es real y sus numeros son verificables
- Provee infraestructura tecnologica para tokenizacion
- Genera reportes transparentes
- Facilita el proceso legal (Revenue Participation Agreements)

### Caso de Uso Ejemplo

**Restaurante "La Parrilla del Norte"**

```
SITUACION:
- 3 anos usando TIS TIS
- Ingresos: $800,000 MXN/mes
- Quiere abrir segunda sucursal
- Necesita: $1,200,000 MXN
- Bancos piden hipoteca de su casa

TOKENIZACION:
- TIS TIS certifica: Score 87/100
- Emite: 120 tokens de $10,000 MXN
- Oferta: 8% de ingresos de sucursal 2 por 30 meses

RESULTADO:
- Inversionistas locales compran 120 tokens
- Restaurante abre sin deuda bancaria
- Sucursal genera $600,000/mes
- 8% = $48,000/mes distribuidos
- Cada token recibe $400/mes = $12,000 en 30 meses
- ROI para inversionistas: ~20% en 2.5 anos
- Dueno mantiene 100% de propiedad
```

---

## Microfase 0.2: Arquitectura Tecnica

### Estructura de Archivos (Final)

```
tistis-platform/
├── app/(marketing)/
│   ├── catalyst/
│   │   ├── page.tsx                    # Pagina principal
│   │   └── components/
│   │       ├── HeroSection.tsx         # Hero con video de fondo
│   │       ├── VideoScrollPlayer.tsx   # Componente de video scroll-sync
│   │       ├── WhatIsSection.tsx       # Que es Catalyst
│   │       ├── HowItWorksSection.tsx   # Los 5 pasos
│   │       ├── BenefitsSection.tsx     # Beneficios por actor
│   │       ├── UseCaseSection.tsx      # Ejemplo restaurante
│   │       └── ComingSoonCTA.tsx       # CTA con "Proximamente"
│
├── components/layout/
│   └── Header.tsx                      # Agregar link "Catalyst"
│
├── src/hooks/
│   └── useVideoScrollSync.ts           # Hook para control de video
│
└── public/videos/
    └── catalyst-token.mp4              # Video de la moneda
```

### Dependencias (todas ya instaladas)

```json
{
  "framer-motion": "^10.x",    // Animaciones
  "lucide-react": "^0.x",      // Iconos
  "tailwindcss": "^3.x",       // Estilos
  "next": "^14.x"              // Framework
}
```

### Video Scroll-Sync: Arquitectura

```typescript
// Concepto del hook useVideoScrollSync

function useVideoScrollSync(videoRef: RefObject<HTMLVideoElement>) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Pausar video por defecto
    video.pause();

    const handleScroll = () => {
      // Calcular posicion del video en el viewport
      const rect = video.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Progreso del scroll (0 a 1)
      const scrollProgress = Math.max(0, Math.min(1,
        (windowHeight - rect.top) / (windowHeight + rect.height)
      ));

      // Mapear a tiempo del video
      video.currentTime = scrollProgress * video.duration;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [videoRef]);
}
```

### Performance Considerations

1. **Video Preload**: `preload="auto"` para carga inmediata
2. **RequestAnimationFrame**: Limitar actualizaciones a 60fps
3. **IntersectionObserver**: Solo procesar scroll cuando video visible
4. **Video Format**: MP4 H.264 para maxima compatibilidad

---

## Microfase 0.3: Diseno Visual y UX

### Paleta de Colores

```css
/* Colores principales TIS TIS */
--tis-coral: rgb(223, 115, 115);     /* #DF7373 - Acento principal */
--tis-pink: rgb(194, 51, 80);        /* #C23350 - Acento secundario */
--tis-green: #9DB8A1;                /* Verde - Positivo */
--tis-purple: #667eea;               /* Purpura - Tecnologia */

/* Gradientes */
--gradient-coral: linear-gradient(135deg, #DF7373 0%, #C23350 100%);
--gradient-dark: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);

/* Textos */
--text-primary: #1e293b;             /* slate-800 */
--text-secondary: #64748b;           /* slate-500 */
--text-muted: #94a3b8;               /* slate-400 */
```

### Tipografia

```css
/* Font principal */
font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;

/* Tamaños - Desktop */
h1: 4rem (64px) - "Menos trabajo. Mas vida" style
h2: 2.5rem (40px) - Section titles
h3: 1.5rem (24px) - Subsection titles
body: 1.125rem (18px) - Content
small: 0.875rem (14px) - Captions

/* Tamaños - Mobile */
h1: 2.5rem (40px)
h2: 1.75rem (28px)
h3: 1.25rem (20px)
body: 1rem (16px)
```

### Estructura Visual de la Pagina

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (sticky)                                             │
│ Logo | Planes | Como funciona | CATALYST | Dashboard        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ HERO SECTION                                            │ │
│ │ - Video moneda girando (fondo, bajo opacidad)           │ │
│ │ - Badge: "Proximamente en 2027"                         │ │
│ │ - Titulo: "Capital sin bancos."                         │ │
│ │ - Subtitulo: "Expande sin ceder tu empresa."            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ VIDEO SCROLL SECTION                                    │ │
│ │ - Video grande central                                  │ │
│ │ - Avanza segun scroll                                   │ │
│ │ - Textos aparecen a los lados                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ QUE ES CATALYST                                         │ │
│ │ - Explicacion clara                                     │ │
│ │ - Iconos representativos                                │ │
│ │ - NO es banco, NO es equity                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ COMO FUNCIONA (5 pasos)                                 │ │
│ │ - Cards con numeros 01-05                               │ │
│ │ - Iconos y colores diferentes                           │ │
│ │ - Animacion scroll reveal                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ BENEFICIOS                                              │ │
│ │ - 3 columnas: Negocio | Inversionistas | TIS TIS        │ │
│ │ - Gradientes de fondo diferentes                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ CASO DE USO                                             │ │
│ │ - Historia visual del restaurante                       │ │
│ │ - Numeros clave destacados                              │ │
│ │ - Timeline visual                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ CTA PROXIMAMENTE                                        │ │
│ │ - Gradiente oscuro premium                              │ │
│ │ - "Se el primero en saber"                              │ │
│ │ - Form de email (disabled/coming soon)                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ FOOTER                                                      │
└─────────────────────────────────────────────────────────────┘
```

### Animaciones Planeadas

| Elemento | Tipo de Animacion | Trigger |
|----------|------------------|---------|
| Hero title | Fade in + slide up | Page load |
| Video scroll | Play on scroll | Scroll position |
| Section titles | Fade in + slide up | Scroll into view |
| Step cards | Staggered fade in | Scroll into view |
| Benefit cards | Scale + fade | Scroll into view |
| Numbers (ROI, etc) | Count up animation | Scroll into view |
| CTA section | Parallax background | Scroll |

### Referencias de Diseno (Apple Style)

- **AirPods Pro**: Producto centrado, scroll reveal
- **iPhone 15**: Secciones full-width, tipografia grande
- **Apple Watch**: Timeline visual, numeros destacados

---

## Checklist Pre-Implementacion

- [x] Documento Catalyst leido y analizado
- [x] Video identificado y localizado (851KB MP4)
- [x] Header actual analizado (Planes, Como funciona)
- [x] Landing page actual analizada (Framer Motion)
- [x] Colores y tipografia documentados
- [x] Estructura de archivos definida
- [x] Hook de video scroll diseñado
- [x] Todas las secciones planificadas

---

**FASE 0 COMPLETADA - Continuar con FASE 1: Infraestructura Base**
