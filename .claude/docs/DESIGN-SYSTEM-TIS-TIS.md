# Sistema de Diseño TIS TIS

## 1. Colores

### Colores Principales (Brand)
```css
--tis-coral: #FF6B6B;
--tis-pink: #FF8E8E;
--tis-green: #4ECDC4;
--tis-purple: #7C3AED;
--tis-indigo: #6366F1;
```

### Colores Neutros
```css
--slate-50: #F8FAFC;
--slate-100: #F1F5F9;
--slate-200: #E2E8F0;
--slate-300: #CBD5E1;
--slate-400: #94A3B8;
--slate-500: #64748B;
--slate-600: #475569;
--slate-700: #334155;
--slate-800: #1E293B;
--slate-900: #0F172A;
```

### Colores Semánticos
```css
/* Success */
--green-50: #F0FDF4;
--green-500: #22C55E;
--green-700: #15803D;

/* Warning */
--amber-50: #FFFBEB;
--amber-500: #F59E0B;
--amber-700: #B45309;

/* Error */
--red-50: #FEF2F2;
--red-500: #EF4444;
--red-700: #B91C1C;

/* Info */
--blue-50: #EFF6FF;
--blue-500: #3B82F6;
--blue-700: #1D4ED8;
```

---

## 2. Tipografía

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Escala de Tamaños
| Nombre | Tamaño | Line Height | Uso |
|--------|--------|-------------|-----|
| xs | 12px | 16px | Badges, hints |
| sm | 14px | 20px | Labels, descriptions |
| base | 16px | 24px | Body text |
| lg | 18px | 28px | Lead text |
| xl | 20px | 28px | Section titles |
| 2xl | 24px | 32px | Page titles |
| 3xl | 30px | 36px | Hero titles |

### Pesos
| Nombre | Peso | Uso |
|--------|------|-----|
| normal | 400 | Body text |
| medium | 500 | Labels, buttons |
| semibold | 600 | Subtitles, important |
| bold | 700 | Titles, emphasis |

---

## 3. Espaciado

### Escala Base (4px)
```
1: 4px
2: 8px
3: 12px
4: 16px
5: 20px
6: 24px
8: 32px
10: 40px
12: 48px
16: 64px
```

### Uso Recomendado
| Contexto | Espaciado |
|----------|-----------|
| Entre elementos inline | 2 (8px) |
| Entre elementos de formulario | 4 (16px) |
| Entre secciones | 6 (24px) |
| Entre cards | 3-4 (12-16px) |
| Padding de cards | 5-6 (20-24px) |
| Padding de modales | 6 (24px) |

---

## 4. Border Radius

| Nombre | Valor | Uso |
|--------|-------|-----|
| sm | 4px | Badges pequeños |
| DEFAULT | 6px | Inputs, buttons pequeños |
| md | 8px | Buttons, tags |
| lg | 12px | Cards pequeñas |
| xl | 16px | Cards medianas |
| 2xl | 20px | Cards grandes |
| 3xl | 24px | Modales, panels |
| full | 9999px | Pills, avatares |

---

## 5. Sombras

```css
/* Pequeña - hover states */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

/* Default - cards elevadas */
--shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);

/* Media - dropdowns, popovers */
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);

/* Grande - modales */
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

/* Extra grande - slide-overs */
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

/* 2XL - elementos destacados */
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
```

---

## 6. Transiciones

### Durations
| Nombre | Valor | Uso |
|--------|-------|-----|
| fast | 150ms | Hovers, focus |
| DEFAULT | 200ms | Cambios de estado |
| slow | 300ms | Modales, expands |
| slower | 500ms | Page transitions |

### Easings
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);

/* Spring (Framer Motion) */
{ type: 'spring', bounce: 0.2, duration: 0.4 }
```

---

## 7. Componentes Clave

### Buttons

```typescript
// Primary
className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md"

// Secondary
className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"

// Ghost
className="px-4 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"

// Danger
className="px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
```

### Cards

```typescript
// Standard Card
className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm"

// Elevated Card
className="p-5 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow"

// Interactive Card
className="p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer"

// Gradient Card (headers)
className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-xl"
```

### Inputs

```typescript
// Text Input
className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"

// Textarea
className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"

// Select
className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
```

### Badges

```typescript
// Default
className="px-2.5 py-0.5 text-xs font-medium rounded-full"

// Variants
"bg-purple-100 text-purple-700"  // Primary
"bg-green-100 text-green-700"    // Success
"bg-amber-100 text-amber-700"    // Warning
"bg-red-100 text-red-700"        // Error
"bg-blue-100 text-blue-700"      // Info
"bg-gray-100 text-gray-700"      // Neutral
```

---

## 8. Patrones de Layout

### Page Layout
```typescript
<PageWrapper title="Título" subtitle="Descripción">
  <div className="max-w-6xl mx-auto space-y-6">
    {/* Content */}
  </div>
</PageWrapper>
```

### Card Grid
```typescript
// 2 columnas
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// 3 columnas
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// 4 columnas (stats)
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
```

### Form Layout
```typescript
<div className="space-y-6">
  {/* Form group */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Label
    </label>
    <input ... />
    <p className="text-xs text-gray-500 mt-1">Hint text</p>
  </div>
</div>
```

---

## 9. Animaciones (Framer Motion)

### Fade In
```typescript
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
```

### Slide Up
```typescript
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
```

### Slide From Right (Modales)
```typescript
initial={{ x: '100%' }}
animate={{ x: 0 }}
exit={{ x: '100%' }}
transition={{ type: 'spring', damping: 25, stiffness: 200 }}
```

### Scale
```typescript
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.95 }}
```

### Layout Animation (Tabs)
```typescript
<motion.div
  layoutId="activeTab"
  className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg"
  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
/>
```

---

## 10. Iconografía

### Tamaños
| Contexto | Tamaño |
|----------|--------|
| Inline con texto | w-4 h-4 |
| Botones | w-5 h-5 |
| Cards | w-5 h-5 |
| Hero/Feature | w-6 h-6 |
| Empty states | w-8 h-8 |
| Large illustrations | w-12 h-12 |

### Estilo
- Heroicons (outline para UI, solid para acciones)
- stroke-width: 2 por defecto
- Color: inherit del parent

---

## 11. Responsive Breakpoints

```css
sm: 640px   /* Teléfonos grandes */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Pantallas grandes */
```

### Mobile-First Approach
```typescript
// Ejemplo
className="px-4 md:px-6 lg:px-8"
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
className="text-sm md:text-base"
```

---

## 12. Accesibilidad

### Focus States
```typescript
className="focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
```

### Touch Targets
- Mínimo 44x44px para elementos interactivos en móvil
- Espaciado adecuado entre elementos clickeables

### Contraste
- Texto sobre fondo claro: mínimo 4.5:1
- Texto grande (18px+): mínimo 3:1
