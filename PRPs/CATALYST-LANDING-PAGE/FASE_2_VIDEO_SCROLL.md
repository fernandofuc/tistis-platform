# FASE 2: Video Scroll Sync
## TIS TIS Catalyst Landing Page

---

## Objetivo

Implementar el sistema de video que avanza segun el scroll del usuario, creando un efecto cinematografico estilo Apple.

**Duracion estimada:** 15-20 minutos
**Dependencias:** FASE 1 completada

---

## Concepto Tecnico

```
                    VIEWPORT
┌────────────────────────────────────────┐
│                                        │
│    Scroll Progress = 0.0               │
│    Video currentTime = 0.0s            │
│                                        │
│         ┌──────────────┐               │
│         │              │               │
│         │    VIDEO     │               │
│         │              │               │
│         └──────────────┘               │
│                                        │
│    Scroll Progress = 0.5               │
│    Video currentTime = 2.5s            │
│                                        │
│                                        │
│    Scroll Progress = 1.0               │
│    Video currentTime = 5.0s            │
│                                        │
└────────────────────────────────────────┘

Formula:
video.currentTime = scrollProgress * video.duration
```

---

## Microfase 2.1: Hook useVideoScrollSync

### Archivo a Crear

`/Users/macfer/Documents/TIS TIS /tistis-platform/src/hooks/useVideoScrollSync.ts`

### Codigo Completo

```typescript
// =====================================================
// useVideoScrollSync - Hook para sincronizar video con scroll
// Inspirado en efectos de paginas de Apple
// =====================================================

import { useEffect, useRef, useState, RefObject } from 'react';

interface UseVideoScrollSyncOptions {
  // Offset desde el top del viewport para empezar (0-1)
  startOffset?: number;
  // Offset para terminar (0-1)
  endOffset?: number;
  // Si el video debe hacer loop al llegar al final
  loop?: boolean;
  // Callback cuando cambia el progreso
  onProgressChange?: (progress: number) => void;
}

interface UseVideoScrollSyncReturn {
  videoRef: RefObject<HTMLVideoElement>;
  containerRef: RefObject<HTMLDivElement>;
  progress: number;
  isInView: boolean;
  isVideoLoaded: boolean;
}

export function useVideoScrollSync(
  options: UseVideoScrollSyncOptions = {}
): UseVideoScrollSyncReturn {
  const {
    startOffset = 0,
    endOffset = 1,
    loop = false,
    onProgressChange,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Pausar video por defecto
    video.pause();

    // Handler para cuando el video esta listo
    const handleLoadedData = () => {
      setIsVideoLoaded(true);
    };

    if (video.readyState >= 2) {
      setIsVideoLoaded(true);
    } else {
      video.addEventListener('loadeddata', handleLoadedData);
    }

    // IntersectionObserver para detectar si el contenedor esta visible
    const observer = new IntersectionObserver(
      (entries) => {
        setIsInView(entries[0]?.isIntersecting ?? false);
      },
      { threshold: 0, rootMargin: '50px' }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !isVideoLoaded || !isInView) return;

    const updateVideoTime = () => {
      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calcular el rango de scroll efectivo
      const scrollStart = windowHeight * (1 - startOffset);
      const scrollEnd = -rect.height * endOffset;
      const scrollRange = scrollStart - scrollEnd;

      // Calcular progreso (0 a 1)
      const rawProgress = (scrollStart - rect.top) / scrollRange;
      const clampedProgress = Math.max(0, Math.min(1, rawProgress));

      // Actualizar estado
      setProgress(clampedProgress);
      onProgressChange?.(clampedProgress);

      // Actualizar tiempo del video
      if (video.duration && isFinite(video.duration)) {
        const targetTime = clampedProgress * video.duration;

        // Evitar pequeños saltos
        if (Math.abs(video.currentTime - targetTime) > 0.05) {
          video.currentTime = targetTime;
        }

        // Loop handling
        if (loop && clampedProgress >= 0.99) {
          video.currentTime = 0;
        }
      }
    };

    const handleScroll = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updateVideoTime);
    };

    // Initial update
    updateVideoTime();

    // Listen for scroll
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isVideoLoaded, isInView, startOffset, endOffset, loop, onProgressChange]);

  return {
    videoRef,
    containerRef,
    progress,
    isInView,
    isVideoLoaded,
  };
}

export default useVideoScrollSync;
```

---

## Microfase 2.2: Componente VideoScrollPlayer

### Archivo a Crear

`/Users/macfer/Documents/TIS TIS /tistis-platform/app/(marketing)/catalyst/components/VideoScrollPlayer.tsx`

### Codigo Completo

```tsx
// =====================================================
// VideoScrollPlayer - Video que avanza con scroll
// Efecto cinematografico estilo Apple
// =====================================================

'use client';

import { useVideoScrollSync } from '@/src/hooks/useVideoScrollSync';
import { motion } from 'framer-motion';

interface VideoScrollPlayerProps {
  className?: string;
  showProgress?: boolean;
}

export default function VideoScrollPlayer({
  className = '',
  showProgress = false,
}: VideoScrollPlayerProps) {
  const { videoRef, containerRef, progress, isInView, isVideoLoaded } =
    useVideoScrollSync({
      startOffset: 0.2,  // Empieza cuando el 20% del viewport pasa
      endOffset: 0.8,    // Termina cuando el 80% del contenedor pasa
    });

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ minHeight: '150vh' }} // Altura para scroll suficiente
    >
      {/* Video Container - Sticky para efecto parallax */}
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900" />

        {/* Video Element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: isVideoLoaded ? 1 : 0,
            scale: isVideoLoaded ? 1 : 0.9,
          }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-3xl mx-auto px-4"
        >
          <video
            ref={videoRef}
            src="/videos/catalyst-token.mp4"
            muted
            playsInline
            preload="auto"
            className="w-full h-auto rounded-2xl shadow-2xl"
            style={{
              filter: 'drop-shadow(0 25px 50px rgba(223, 115, 115, 0.3))',
            }}
          />
        </motion.div>

        {/* Decorative Elements */}
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-tis-coral/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-tis-purple/20 rounded-full blur-3xl" />

        {/* Progress Indicator (optional) */}
        {showProgress && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-tis-coral rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-white/60 text-sm font-mono">
              {Math.round(progress * 100)}%
            </span>
          </div>
        )}

        {/* Scroll Indicator (shows when at start) */}
        {progress < 0.1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-white/60 text-sm">Scroll para explorar</span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-2"
              >
                <motion.div className="w-1.5 h-2 bg-white/60 rounded-full" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Content Overlays - Aparecen segun progreso */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Text at 20% progress */}
        <motion.div
          className="absolute top-[20vh] left-8 max-w-md pointer-events-auto"
          style={{
            opacity: Math.max(0, Math.min(1, (progress - 0.15) * 5)),
            transform: `translateY(${Math.max(0, (0.2 - progress) * 100)}px)`,
          }}
        >
          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            Tokeniza tu proyecto
          </h3>
          <p className="text-white/70">
            Convierte tu expansion en oportunidad de inversion
          </p>
        </motion.div>

        {/* Text at 50% progress */}
        <motion.div
          className="absolute top-[50vh] right-8 max-w-md text-right pointer-events-auto"
          style={{
            opacity: Math.max(0, Math.min(1, (progress - 0.4) * 5)),
            transform: `translateY(${Math.max(0, (0.5 - progress) * 100)}px)`,
          }}
        >
          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            Inversionistas verificados
          </h3>
          <p className="text-white/70">
            Acceso a capital de personas que confian en datos reales
          </p>
        </motion.div>

        {/* Text at 80% progress */}
        <motion.div
          className="absolute top-[80vh] left-8 max-w-md pointer-events-auto"
          style={{
            opacity: Math.max(0, Math.min(1, (progress - 0.7) * 5)),
            transform: `translateY(${Math.max(0, (0.8 - progress) * 100)}px)`,
          }}
        >
          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            Distribucion automatica
          </h3>
          <p className="text-white/70">
            Los retornos se calculan y pagan sin intermediarios
          </p>
        </motion.div>
      </div>
    </div>
  );
}
```

---

## Microfase 2.3: Optimizacion y Performance

### Mejoras de Performance Implementadas

1. **RequestAnimationFrame**: Actualizaciones limitadas a 60fps
2. **IntersectionObserver**: Solo procesa scroll cuando video visible
3. **Passive Event Listeners**: `{ passive: true }` para mejor performance
4. **Threshold Buffer**: Evita micro-actualizaciones con `Math.abs(...) > 0.05`
5. **Video Preload**: `preload="auto"` para carga inmediata

### Formato de Video Recomendado

El video actual es MP4 H.264. Si hay problemas de compatibilidad:

```html
<video>
  <source src="/videos/catalyst-token.webm" type="video/webm" />
  <source src="/videos/catalyst-token.mp4" type="video/mp4" />
</video>
```

### Mobile Considerations

En iOS, los videos con `playsinline` y `muted` pueden reproducirse sin interaccion del usuario. El atributo `playsInline` ya esta incluido.

---

## Verificacion de FASE 2

### Checklist

- [ ] Hook `useVideoScrollSync.ts` creado
- [ ] Componente `VideoScrollPlayer.tsx` creado
- [ ] Video se carga sin errores
- [ ] Al hacer scroll, el video avanza suavemente
- [ ] Textos aparecen segun el progreso del scroll
- [ ] No hay jitter o saltos en el video
- [ ] Performance estable (60fps)

### Test Manual

1. Navegar a `/catalyst` (usar placeholder temporal)
2. Importar `VideoScrollPlayer` en el placeholder
3. Hacer scroll lentamente
4. Verificar que el video avanza proporcionalmente
5. Verificar que los textos aparecen en los momentos correctos

### Codigo de Test (Temporal para page.tsx)

```tsx
'use client';

import VideoScrollPlayer from './components/VideoScrollPlayer';

export default function CatalystPage() {
  return (
    <div className="min-h-screen">
      {/* Hero placeholder */}
      <div className="h-screen bg-gradient-to-b from-white to-slate-100 flex items-center justify-center">
        <h1 className="text-4xl font-bold">Scroll Down</h1>
      </div>

      {/* Video Section */}
      <VideoScrollPlayer showProgress />

      {/* Content after video */}
      <div className="h-screen bg-white flex items-center justify-center">
        <h1 className="text-4xl font-bold">Content Continues</h1>
      </div>
    </div>
  );
}
```

---

## Resumen de Cambios

| Archivo | Accion | Lineas |
|---------|--------|--------|
| `src/hooks/useVideoScrollSync.ts` | Crear | ~130 lineas |
| `app/(marketing)/catalyst/components/VideoScrollPlayer.tsx` | Crear | ~150 lineas |

---

**FASE 2 COMPLETADA - Continuar con FASE 3: Secciones de la Pagina**
