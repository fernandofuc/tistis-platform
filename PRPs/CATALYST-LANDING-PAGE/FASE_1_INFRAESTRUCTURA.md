# FASE 1: Infraestructura Base
## TIS TIS Catalyst Landing Page

---

## Objetivo

Preparar toda la infraestructura necesaria antes de escribir componentes: rutas, navegacion, y assets.

**Duracion estimada:** 5-10 minutos
**Dependencias:** Ninguna

---

## Microfase 1.1: Copiar Video al Proyecto

### Accion

Copiar el video de la moneda al directorio public del proyecto.

### Comando

```bash
cp "/Users/macfer/Documents/TIS TIS /Genesis + Catalyst/TIS TIS Catalyst/cinematic_product_shot_a_single_luxury_cryptocurrency.mp4" \
   "/Users/macfer/Documents/TIS TIS /tistis-platform/public/videos/catalyst-token.mp4"
```

### Verificacion

```bash
ls -la "/Users/macfer/Documents/TIS TIS /tistis-platform/public/videos/"
# Debe mostrar catalyst-token.mp4 (~851KB)
```

### Nota sobre el Directorio

Si `public/videos/` no existe, crearlo primero:

```bash
mkdir -p "/Users/macfer/Documents/TIS TIS /tistis-platform/public/videos/"
```

---

## Microfase 1.2: Actualizar Header con Link Catalyst

### Archivo a Modificar

`/Users/macfer/Documents/TIS TIS /tistis-platform/components/layout/Header.tsx`

### Cambio Requerido

Agregar el link "Catalyst" despues de "Como funciona" en la navegacion central.

### Codigo Actual (lineas 64-77)

```tsx
{/* Links Centro */}
<div className="hidden md:flex items-center gap-8">
  <Link
    href="/pricing"
    className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
  >
    Planes
  </Link>
  <Link
    href="/como-funciona"
    className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
  >
    Como funciona
  </Link>
</div>
```

### Codigo Nuevo

```tsx
{/* Links Centro */}
<div className="hidden md:flex items-center gap-8">
  <Link
    href="/pricing"
    className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
  >
    Planes
  </Link>
  <Link
    href="/como-funciona"
    className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
  >
    Como funciona
  </Link>
  <Link
    href="/catalyst"
    className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium flex items-center gap-1.5"
  >
    Catalyst
    <span className="text-[10px] px-1.5 py-0.5 bg-tis-coral/10 text-tis-coral rounded-full font-semibold">
      PRONTO
    </span>
  </Link>
</div>
```

### Diferencia Visual

El link "Catalyst" tendra un badge "PRONTO" pequeño para indicar que es una funcion futura, haciendolo destacar sutilmente.

---

## Microfase 1.3: Crear Estructura de Carpetas

### Directorios a Crear

```bash
mkdir -p "/Users/macfer/Documents/TIS TIS /tistis-platform/app/(marketing)/catalyst/components"
```

### Estructura Final

```
app/(marketing)/catalyst/
├── page.tsx                    # Pagina principal (se crea en FASE 3)
└── components/                 # Componentes de la pagina
    ├── HeroSection.tsx         # FASE 3.1
    ├── VideoScrollPlayer.tsx   # FASE 2.2
    ├── WhatIsSection.tsx       # FASE 3.2
    ├── HowItWorksSection.tsx   # FASE 3.3
    ├── BenefitsSection.tsx     # FASE 3.4
    ├── UseCaseSection.tsx      # FASE 3.5
    └── ComingSoonCTA.tsx       # FASE 3.6
```

---

## Microfase 1.4: Crear Pagina Placeholder

### Archivo a Crear

`/Users/macfer/Documents/TIS TIS /tistis-platform/app/(marketing)/catalyst/page.tsx`

### Contenido Inicial (Placeholder)

```tsx
// =====================================================
// TIS TIS Catalyst - Landing Page
// Plataforma de tokenizacion para expansion de negocios
// PROXIMAMENTE
// =====================================================

'use client';

export default function CatalystPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Placeholder - Componentes se agregan en FASE 3 */}
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            TIS TIS Catalyst
          </h1>
          <p className="text-slate-600 mb-8">
            Pagina en construccion - FASE 1 completada
          </p>
          <span className="inline-flex items-center px-4 py-2 bg-tis-coral/10 text-tis-coral rounded-full font-semibold">
            Infraestructura lista
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

## Verificacion de FASE 1

### Checklist

- [x] Video copiado a `public/videos/catalyst-token.mp4`
- [x] Header actualizado con link "Catalyst" + badge "PRONTO"
- [x] Carpeta `app/(marketing)/catalyst/components/` creada
- [x] Archivo `page.tsx` placeholder creado
- [ ] Servidor de desarrollo sin errores

### Test Manual

1. Ejecutar `npm run dev`
2. Navegar a `http://localhost:3000`
3. Verificar que "Catalyst" aparece en el header
4. Click en "Catalyst" debe ir a `/catalyst`
5. Debe mostrar el placeholder

---

## Resumen de Cambios

| Archivo | Accion | Lineas |
|---------|--------|--------|
| `public/videos/catalyst-token.mp4` | Crear (copiar) | N/A |
| `components/layout/Header.tsx` | Modificar | ~10 lineas |
| `app/(marketing)/catalyst/page.tsx` | Crear | ~25 lineas |
| `app/(marketing)/catalyst/components/` | Crear directorio | N/A |

---

## Notas de Implementacion

### Video (Microfase 1.1)

- **Tamano final:** 851,557 bytes (~831 KB)
- **Ubicacion:** `/public/videos/catalyst-token.mp4`
- Video cinematografico de moneda cryptocurrency para uso con scroll-sync

### Header (Microfase 1.2)

- **Lineas modificadas:** 77-85
- Badge implementado con gradiente TIS TIS (`bg-gradient-to-r from-tis-coral to-tis-pink`)
- Texto del badge: "Pronto" (en lugar de "PRONTO" para mejor legibilidad)
- Estilos: `flex items-center gap-1.5` para alineacion del badge
- Hover state: `hover:text-tis-coral` consistente con otros links

### Pagina Placeholder (Microfase 1.4)

- **Tamano:** 4,780 bytes
- Implementacion mejorada respecto al placeholder original:
  - Animaciones Framer Motion para entrada suave
  - Decorative blur circles con colores TIS TIS (coral, pink, purple)
  - Badge "Proximamente 2027" con gradiente coral-pink
  - Titulo con gradient text "Catalyst"
  - Indicador visual de progreso de 5 fases (fase 1 marcada como activa)
  - Fondo con gradiente sutil `from-white via-gray-50 to-white`

### Estructura de Carpetas (Microfase 1.3)

- Directorio `components/` creado pero vacio (se poblara en fases posteriores)

---

## Estado de Implementacion

| Microfase | Estado | Fecha |
|-----------|--------|-------|
| 1.1 Video | Completado | 28 Enero 2026 |
| 1.2 Header | Completado | 28 Enero 2026 |
| 1.3 Carpetas | Completado | 28 Enero 2026 |
| 1.4 Placeholder | Completado | 28 Enero 2026 |

---

**FASE 1 COMPLETADA - Continuar con FASE 2: Video Scroll Sync**
