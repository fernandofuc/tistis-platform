# 🚀 Cómo Ver el Dashboard - Guía Rápida

## Opción 1: Ver UI sin Base de Datos (MÁS RÁPIDO - 2 min)

### 1. Iniciar el servidor
```bash
cd "/Users/macfer/Documents/TIS TIS /tistis-platform"
npm run dev
```

Espera a ver este mensaje:
```
✓ Ready in 3.5s
○ Local:   http://localhost:3000
```

### 2. Abrir en navegador
```
http://localhost:3000
```

**Podrás ver:**
- ✅ La UI completa del dashboard
- ✅ El diseño y layout
- ✅ Todos los módulos (Leads, Calendario, Inbox, etc.)
- ⚠️ Sin datos reales (porque no hay DB configurada)

**Rutas disponibles:**
```
http://localhost:3000                          → Home
http://localhost:3000/dashboard                → Dashboard Overview
http://localhost:3000/dashboard/leads          → Gestión de Leads
http://localhost:3000/dashboard/calendario     → Calendario de Citas
http://localhost:3000/dashboard/inbox          → Conversaciones
http://localhost:3000/dashboard/analytics      → Analytics
http://localhost:3000/dashboard/settings       → Configuración
```

---

## Opción 2: Ver Dashboard CON Datos Reales (15 min)

### Paso 1: Configurar Supabase

1. **Crear proyecto en Supabase:**
   - Ve a https://supabase.com
   - Click "New Project"
   - Nombre: "TIS TIS Platform"
   - Password: [elige uno seguro]
   - Region: South America (o más cercana)

2. **Ejecutar migraciones:**
   - En Supabase Dashboard → SQL Editor
   - Click "New Query"
   - Pega el contenido de: `supabase/migrations/003_esva_schema_v2.sql`
   - Click "Run"
   - Repite con: `supabase/migrations/004_esva_seed_data.sql`

3. **Copiar credenciales:**
   - Settings → API
   - Copiar:
     - Project URL
     - anon public key
     - service_role key (secret)

### Paso 2: Configurar .env.local

Edita el archivo `.env.local` y actualiza:

```bash
# Reemplazar con tus credenciales de Supabase
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...TU-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...TU-SERVICE-ROLE-KEY
```

### Paso 3: Reiniciar servidor

```bash
# Detener el servidor (Ctrl+C)
# Iniciar nuevamente
npm run dev
```

### Paso 4: Ver dashboard con datos

Ahora verás:
- ✅ Datos reales de ESVA
- ✅ 4 Sucursales (Nogales, Tijuana, Hermosillo, Lab)
- ✅ 3 Staff members
- ✅ 15+ Servicios dentales
- ✅ FAQs y configuración

---

## Opción 3: Screenshots del Dashboard

Si solo quieres ver cómo se ve sin configurar nada, aquí te describo cada módulo:

### 🏠 Dashboard Overview (`/dashboard`)
```
┌─────────────────────────────────────────────────┐
│  📊 Stats Cards                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │Leads │ │Citas │ │Inbox │ │Hot   │          │
│  │ 142  │ │  18  │ │  24  │ │ 🔥12 │          │
│  └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                 │
│  Recent Leads          Today's Appointments    │
│  [Cards de leads]      [Lista de citas]        │
└─────────────────────────────────────────────────┘
```

### 👥 Leads (`/dashboard/leads`)
```
┌─────────────────────────────────────────────────┐
│  [Todos] [🔥Hot] [Warm] [Cold]    [Buscar...]  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🔥 María García          Score: 85      │   │
│  │ 📱 +52 555 1234         Hot Lead        │   │
│  │ 💼 Implantes, Blanqueamiento           │   │
│  │ [Ver Detalle] [Crear Cita] [Contactar] │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 📅 Calendario (`/dashboard/calendario`)
```
┌─────────────────────────────────────────────────┐
│  [◄]  Enero 2025  [►]                          │
│                                                 │
│  Calendario mensual con citas                  │
│  [Grid de días con indicadores de citas]       │
│                                                 │
│  Lista de citas del día seleccionado           │
└─────────────────────────────────────────────────┘
```

### 💬 Inbox (`/dashboard/inbox`)
```
┌─────────────────────────────────────────────────┐
│  Conversaciones        │  Chat Interface       │
│  [Lista lateral]       │  [Mensajes]           │
│                        │  [Input para enviar]  │
└─────────────────────────────────────────────────┘
```

---

## 🎨 Personalización Visual

El dashboard usa **Tailwind CSS** con una paleta de colores moderna:

**Colores principales:**
- Primary: Azul (#3B82F6)
- Success: Verde (#10B981)
- Warning: Amarillo (#F59E0B)
- Danger: Rojo (#EF4444)
- Hot Lead: Rojo intenso (#DC2626)

**Tipografía:**
- Font: Inter (Google Fonts)
- Headings: font-bold
- Body: font-normal

---

## 🔍 Explorar el Código

### Archivos principales del Dashboard:

**Layout principal:**
```
src/features/dashboard/components/
├── DashboardLayout.tsx    ← Layout wrapper
├── Sidebar.tsx            ← Navegación lateral
├── Header.tsx             ← Header con search y perfil
└── MobileNav.tsx          ← Navegación móvil
```

**Páginas:**
```
app/(dashboard)/dashboard/
├── page.tsx               ← Overview
├── leads/page.tsx         ← Leads
├── calendario/page.tsx    ← Calendario
├── inbox/page.tsx         ← Inbox
├── analytics/page.tsx     ← Analytics
└── settings/page.tsx      ← Settings
```

**Componentes UI:**
```
src/shared/components/ui/
├── Button.tsx             ← Botones
├── Card.tsx               ← Cards
├── Badge.tsx              ← Badges (Hot, Warm, Cold)
├── Input.tsx              ← Inputs y búsqueda
└── Avatar.tsx             ← Avatares
```

---

## 🎯 Atajos de Teclado

Cuando navegues el dashboard:

- `Cmd/Ctrl + K` → Abrir búsqueda global (si está implementado)
- `Escape` → Cerrar modales
- Click en logo → Volver a dashboard

---

## 📱 Responsive Design

El dashboard es **completamente responsive**:

- **Desktop** (1024px+): Sidebar visible, layout completo
- **Tablet** (768px-1023px): Sidebar colapsable
- **Mobile** (<768px): Bottom navigation bar

**Para probar responsive:**
1. Abre Chrome DevTools (F12)
2. Click en el ícono de dispositivo móvil
3. Prueba diferentes resoluciones

---

## 🐛 Troubleshooting

### "Cannot connect to Supabase"
→ Normal si no has configurado Supabase. La UI se mostrará igual.

### "Port 3000 already in use"
```bash
# Matar proceso en puerto 3000
lsof -i :3000
kill -9 <PID>

# O usar otro puerto
PORT=3001 npm run dev
```

### Página en blanco
```bash
# Limpiar cache de Next.js
rm -rf .next
npm run dev
```

### Errores de TypeScript
```bash
# Ignorar temporalmente para ver UI
npm run dev -- --no-type-check
```

---

## 🎬 Video Walkthrough (Opcional)

Si quieres grabar un video para el cliente:

1. **Grabar pantalla:**
   - Mac: Cmd + Shift + 5
   - Windows: Win + G

2. **Script sugerido:**
   ```
   1. Mostrar login/home
   2. Tour por dashboard overview
   3. Mostrar módulo de leads
   4. Mostrar calendario
   5. Mostrar inbox
   6. Mostrar settings
   ```

3. **Duración:** 3-5 minutos

---

## ✅ Checklist Visual

Para verificar que todo se ve bien:

- [ ] Dashboard overview carga sin errores
- [ ] Sidebar navigation funciona
- [ ] Stats cards se muestran
- [ ] Tabs en leads funcionan
- [ ] Calendario se renderiza
- [ ] Inbox muestra layout correcto
- [ ] Settings muestra todas las tabs
- [ ] Responsive funciona en mobile

---

## 🆘 Ayuda Rápida

**¿El servidor no inicia?**
→ `npm install` y luego `npm run dev`

**¿Quiero ver con datos de prueba?**
→ Seguir "Opción 2" arriba

**¿Solo quiero ver el diseño?**
→ Ya estás en "Opción 1", solo abre el navegador

---

**¡Disfruta explorando el dashboard!** 🎉
