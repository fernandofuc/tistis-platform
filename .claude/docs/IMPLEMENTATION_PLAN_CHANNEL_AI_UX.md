# 🎯 PLAN DE IMPLEMENTACIÓN: Mejora UX Configuración AI por Canal

## FASE 0: DELIMITACIÓN DEL PROBLEMA

### Problema Principal
**Pestaña "AI por Canal" confunde al usuario y fragmenta el flujo de configuración**

### Subproblemas Identificados
1. Usuario no sabe que puede personalizar AI por canal individual
2. Flujo de configuración requiere cambiar de pestaña (no intuitivo)
3. No hay visualización del estado de configuración AI en cada canal
4. Duplicación aparente de funcionalidad

### Criterios de Éxito (100% completo)
- ✅ Pestaña "AI por Canal" eliminada de AIConfiguration
- ✅ Cada canal muestra badge con estado AI actual
- ✅ Botón "Configurar AI" prominente y accesible en cada tarjeta
- ✅ Modal ChannelAISettings funciona correctamente (ya lo hace)
- ✅ Usuario puede ver y configurar AI sin cambiar de sección
- ✅ Zero errores de TypeScript
- ✅ Zero errores de ESLint
- ✅ Responsive design mantenido
- ✅ Accesibilidad mantenida

### Scope y Limitaciones
**EN SCOPE:**
- ✅ Modificar componente ChannelConnections.tsx
- ✅ Modificar componente AIConfiguration.tsx
- ✅ Crear componente AIConfigBadge (nuevo)
- ✅ Actualizar tipos si es necesario

**OUT OF SCOPE:**
- ❌ NO modificar backend/API (ya funciona perfecto)
- ❌ NO modificar base de datos (ya es correcta)
- ❌ NO modificar ChannelAISettings modal (ya es perfecto)
- ❌ NO añadir nuevas features (solo mejorar UX)

---

## FASE 1: INGENIERÍA INVERSA

### ¿Qué componentes tiene el problema?

#### 1. AIConfiguration.tsx
**Estado actual:**
- Tiene pestaña "AI por Canal" que lista canales
- Importa ChannelAISettings
- Usa tabs de Shadcn/ui

**Cambios necesarios:**
- Eliminar pestaña "AI por Canal" del TabsList
- Eliminar TabsContent correspondiente
- Mantener otras pestañas intactas

#### 2. ChannelConnections.tsx
**Estado actual:**
- Lista canales conectados
- Muestra estado de conexión
- ¿Tiene botón para abrir ChannelAISettings? → VERIFICAR

**Cambios necesarios:**
- Añadir badge visual con estado AI
- Añadir botón "Configurar AI" prominente
- Integrar modal ChannelAISettings
- Mostrar personalidad y delays activos

#### 3. ChannelAISettings.tsx
**Estado actual:**
- ✅ Ya perfecto, NO tocar
- Modal completo con todas las opciones
- Guardado funciona correctamente

**Cambios necesarios:**
- ❌ NINGUNO (mantener como está)

### ¿Qué dependencias existen?

```
1. Leer AIConfiguration.tsx completo
   ↓
2. Leer ChannelConnections.tsx completo
   ↓
3. Identificar estructura de tabs actual
   ↓
4. Diseñar componente AIConfigBadge
   ↓
5. Modificar ChannelConnections (añadir badges + botón)
   ↓
6. Modificar AIConfiguration (eliminar pestaña)
   ↓
7. Validar TypeScript
   ↓
8. Validar visualmente
   ↓
9. Testing manual de flujo completo
   ↓
10. Revisión crítica y mejoras iterativas
```

### ¿Qué patrones del codebase son aplicables?

**Patrón de diseño TIS TIS:**
- Tarjetas con bordes redondeados (`rounded-2xl`)
- Color coral para acciones primarias (`bg-tis-coral`)
- Badges con variantes (`variant="coral"`, `variant="outline"`)
- Iconos inline con lucide-react
- Espaciado consistente (`gap-3`, `gap-4`)
- Sombras sutiles (`shadow-md`, `shadow-lg`)

**Patrón de estado:**
- `useState` para modals
- `useEffect` para data fetching
- Supabase para queries

### ¿Qué casos edge deben considerarse?

1. **Canal sin configuración AI personalizada:**
   - Badge debe decir "Config global"
   - Tooltip explicando qué significa

2. **Canal con configuración AI personalizada:**
   - Badge debe mostrar personalidad + delay
   - Color destacado (coral)

3. **Canal desconectado:**
   - No permitir configurar AI
   - Botón deshabilitado con tooltip

4. **Multiple canales del mismo tipo:**
   - Cada uno debe mostrar su config individual
   - Nombres claros (WhatsApp #1 vs #2)

5. **Responsive:**
   - Badges deben funcionar en mobile
   - Botón debe ser accesible en pantallas pequeñas

---

## FASE 2: PLANIFICACIÓN JERÁRQUICA

### Estructura de Tareas

```
├─ TAREA 1: Análisis de código actual
│  ├─ 1.1: Leer AIConfiguration.tsx completo
│  ├─ 1.2: Leer ChannelConnections.tsx completo
│  ├─ 1.3: Identificar estructura de tabs
│  └─ 1.4: Identificar punto de integración de ChannelAISettings
│
├─ TAREA 2: Diseñar componente AIConfigBadge
│  ├─ 2.1: Definir props interface
│  ├─ 2.2: Implementar lógica de display
│  ├─ 2.3: Añadir variantes visuales
│  └─ 2.4: Añadir tooltips explicativos
│
├─ TAREA 3: Modificar ChannelConnections.tsx
│  ├─ 3.1: Importar AIConfigBadge
│  ├─ 3.2: Añadir estado para modal ChannelAISettings
│  ├─ 3.3: Integrar badge en cada tarjeta de canal
│  ├─ 3.4: Añadir botón "Configurar AI" prominente
│  ├─ 3.5: Conectar botón con modal
│  └─ 3.6: Manejar callback onSaved para actualizar UI
│
├─ TAREA 4: Modificar AIConfiguration.tsx
│  ├─ 4.1: Remover import de ChannelAISettings (si existe)
│  ├─ 4.2: Eliminar pestaña "AI por Canal" del TabsList
│  ├─ 4.3: Eliminar TabsContent correspondiente
│  └─ 4.4: Verificar que otras pestañas funcionen
│
├─ TAREA 5: Validación Técnica
│  ├─ 5.1: TypeScript compilation (npx tsc --noEmit)
│  ├─ 5.2: ESLint check
│  └─ 5.3: Verificar imports circulares
│
├─ TAREA 6: Testing Manual
│  ├─ 6.1: Navegar a Configuración → Canales
│  ├─ 6.2: Verificar badges visibles
│  ├─ 6.3: Click "Configurar AI" → verificar modal abre
│  ├─ 6.4: Cambiar configuración → guardar → verificar badge actualiza
│  ├─ 6.5: Verificar responsive (mobile/tablet)
│  └─ 6.6: Verificar accesibilidad (keyboard navigation)
│
└─ TAREA 7: Revisión Crítica (Bucle de Mejora)
   ├─ 7.1: Revisar spacing y alineación
   ├─ 7.2: Revisar colores y contraste
   ├─ 7.3: Revisar textos y copywriting
   ├─ 7.4: Revisar performance (re-renders)
   ├─ 7.5: Identificar mejoras adicionales
   └─ 7.6: Implementar mejoras si aplica
```

---

## FASE 3: EJECUCIÓN (se detallará durante implementación)

Estado: PENDING

---

## FASE 4: VALIDACIÓN (se detallará durante testing)

Estado: PENDING

---

## FASE 5: REVISIÓN CRÍTICA (bucle iterativo)

Estado: PENDING

---

## FASE 6: REPORTE FINAL

Estado: PENDING

---

**Fecha inicio:** 2025-12-25
**Responsable:** Claude Opus 4.5
**Metodología:** Bucle Agéntico
**Estado general:** 0% (PLANIFICACIÓN COMPLETA)
