# 🎨 TIS TIS Platform - Guía Visual

## 📍 Cómo Navegar el Proyecto

### Estructura de Carpetas

```
tistis-platform/
│
├── 📄 ENTREGA_CLIENTE.md          ← EMPIEZA AQUÍ (documentación completa)
├── 📄 GUIA_VISUAL.md              ← Este archivo
├── 📄 README.md                    ← Setup técnico
│
├── 📂 app/                         ← Next.js App Router
│   ├── (dashboard)/               ← Rutas del dashboard
│   │   └── dashboard/
│   │       ├── page.tsx           ← 🏠 Dashboard Overview
│   │       ├── leads/             ← 👥 Gestión de Leads
│   │       ├── calendario/        ← 📅 Calendario de Citas
│   │       ├── inbox/             ← 💬 Conversaciones
│   │       ├── analytics/         ← 📊 Analytics
│   │       └── settings/          ← ⚙️ Configuración
│   │
│   └── api/                       ← API Routes (Backend)
│       ├── leads/                 ← CRUD Leads
│       ├── appointments/          ← CRUD Citas
│       ├── conversations/         ← CRUD Conversaciones
│       ├── webhook/               ← 🔌 WhatsApp + n8n
│       └── dashboard/             ← Stats Dashboard
│
├── 📂 src/                        ← Código fuente
│   ├── features/                 ← Módulos por funcionalidad
│   │   ├── auth/                 ← 🔐 Autenticación
│   │   └── dashboard/            ← 📊 Dashboard Layout
│   │
│   └── shared/                   ← Código reutilizable
│       ├── components/ui/        ← Button, Card, Badge, Input, etc.
│       ├── hooks/                ← Hooks personalizados
│       │   ├── useRealtimeDashboard.ts    ← Realtime
│       │   └── useIntegrations.ts         ← WhatsApp + n8n
│       ├── lib/                  ← Clientes externos
│       │   ├── supabase.ts      ← Cliente Supabase
│       │   ├── whatsapp.ts      ← 📱 Cliente WhatsApp
│       │   └── n8n.ts           ← ⚡ Cliente n8n
│       ├── stores/               ← Estado global (Zustand)
│       └── types/                ← TypeScript types
│
├── 📂 supabase/migrations/       ← Database
│   ├── 003_esva_schema_v2.sql   ← Schema completo
│   └── 004_esva_seed_data.sql   ← Datos ESVA
│
├── 📂 docs/                      ← Documentación
│   └── INTEGRATION_GUIDE.md     ← 🔌 Guía de integración WhatsApp/n8n
│
└── 📄 .env.local                 ← Variables de entorno
```

---

## 🗺️ Mapa de Funcionalidades

### 1. 🏠 Dashboard Overview
**Archivo:** `app/(dashboard)/dashboard/page.tsx`

**Lo que verás:**
```
┌─────────────────────────────────────────────────┐
│  📊 Stats Cards                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │Leads │ │Citas │ │Inbox │ │Hot   │          │
│  │ 142  │ │  18  │ │  24  │ │ 🔥12 │          │
│  └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                 │
│  📋 Recent Leads          📅 Today's Appts     │
│  ┌─────────────────┐     ┌──────────────┐     │
│  │ 🔥 María García │     │ 10:00 - Juan │     │
│  │    Implantes    │     │ 14:30 - Ana  │     │
│  └─────────────────┘     └──────────────┘     │
└─────────────────────────────────────────────────┘
```

**API:** `/api/dashboard/stats`

---

### 2. 👥 Gestión de Leads
**Archivo:** `app/(dashboard)/dashboard/leads/page.tsx`

**Lo que verás:**
```
┌─────────────────────────────────────────────────┐
│  [Todos] [🔥Hot] [Warm] [Cold]                 │
│                                    [🔍 Buscar]  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🔥 María García          Score: 85      │   │
│  │ 📱 +52 555 1234         Hot Lead        │   │
│  │ 💼 Implantes, Blanqueamiento           │   │
│  │ [Ver] [Crear Cita] [Contactar]         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Juan Pérez              Score: 45       │   │
│  │ 📱 +52 555 5678         Warm            │   │
│  │ 💼 Consulta General                     │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**APIs:**
- GET `/api/leads` - Listado con filtros
- POST `/api/leads` - Crear nuevo lead
- GET/PATCH/DELETE `/api/leads/[id]` - Operaciones individuales

**Scoring:**
- 🔥 Hot: 80-100 puntos
- 🟡 Warm: 40-79 puntos
- 🔵 Cold: 0-39 puntos

---

### 3. 📅 Calendario de Citas
**Archivo:** `app/(dashboard)/dashboard/calendario/page.tsx`

**Lo que verás:**
```
┌─────────────────────────────────────────────────┐
│  [◄]  Enero 2025  [►]                          │
│                                                 │
│  Dom  Lun  Mar  Mié  Jue  Vie  Sáb            │
│        1    2    3    4    5    6              │
│   7    8    9   10   11   12   13              │
│        ⚪   ⚪⚪  ⚪                               │
│  14   15   16   17   18   19   20              │
│        ⚪⚪                                       │
│                                                 │
│  📋 Citas del 15 de Enero:                     │
│  ┌─────────────────────────────────┐           │
│  │ 10:00 - María García            │           │
│  │ ✅ Confirmada - Implante         │           │
│  └─────────────────────────────────┘           │
│  ┌─────────────────────────────────┐           │
│  │ 14:30 - Juan Pérez              │           │
│  │ 🕐 Pendiente - Limpieza          │           │
│  └─────────────────────────────────┘           │
└─────────────────────────────────────────────────┘
```

**APIs:**
- GET `/api/appointments` - Listado con filtros por fecha
- POST `/api/appointments` - Crear cita
- PATCH `/api/appointments/[id]` - Actualizar status

---

### 4. 💬 Inbox / Conversaciones
**Archivo:** `app/(dashboard)/dashboard/inbox/page.tsx`

**Lo que verás:**
```
┌─────────────────────────────────────────────────┐
│  Conversaciones        │  Chat con María       │
│                        │                        │
│  ┌──────────────────┐  │  María García         │
│  │ 🤖 María García  │  │  ┌──────────────────┐ │
│  │ AI handling      │  │  │ Hola, quiero    │ │
│  │ Hace 5 min       │  │  │ una cita        │ │
│  └──────────────────┘  │  └──────────────────┘ │
│                        │                        │
│  ┌──────────────────┐  │  ┌──────────────────┐ │
│  │ ⚠️ Juan Pérez    │  │  │ Claro, tenemos  │ │
│  │ Escalated        │  │  │ disponible...   │ │
│  │ Hace 2 horas     │  │  └──────────────────┘ │
│  └──────────────────┘  │                        │
│                        │  [Escalar a humano]    │
└─────────────────────────────────────────────────┘
```

**APIs:**
- GET `/api/conversations` - Listado de conversaciones
- GET `/api/conversations/[id]` - Conversación con mensajes
- POST `/api/conversations/[id]/messages` - Enviar mensaje

**Estados:**
- 🤖 AI handling - IA responde automáticamente
- ⚠️ Escalated - Requiere atención humana
- ✅ Resolved - Conversación resuelta

---

### 5. 📊 Analytics
**Archivo:** `app/(dashboard)/dashboard/analytics/page.tsx`

**Lo que verás:**
```
┌─────────────────────────────────────────────────┐
│  Período: [7 días] [30 días] [90 días]         │
│                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Nuevos   │ │ Citas    │ │ Conversión│       │
│  │ Leads    │ │ Agendadas│ │ Rate      │       │
│  │   45     │ │    18    │ │   40%     │       │
│  │  +15%    │ │   +8%    │ │   +5%     │       │
│  └──────────┘ └──────────┘ └──────────┘       │
│                                                 │
│  📊 Distribución de Leads                      │
│  [Gráfica de pie - Hot/Warm/Cold]              │
│                                                 │
│  📈 Tendencias de Citas                        │
│  [Gráfica de línea - últimos 30 días]          │
└─────────────────────────────────────────────────┘
```

**API:** `/api/dashboard/stats?period=7d`

---

### 6. ⚙️ Settings
**Archivo:** `app/(dashboard)/dashboard/settings/page.tsx`

**Tabs:**
```
[Profile] [Clinic] [Notifications] [AI Agent] [Integrations] [Security]

Profile:
- Nombre, email, rol
- Foto de perfil

Clinic:
- Información ESVA
- Sucursales

Notifications:
- ✅ Nuevos leads
- ✅ Citas confirmadas
- ✅ Mensajes entrantes

AI Agent:
- Prompt del agente
- Límites de conversación
- Auto-escalation rules

Integrations:
- 📱 WhatsApp: ⚠️ Pendiente configurar
- ⚡ n8n: ⚠️ Pendiente configurar
- ✅ Supabase: Conectado
```

---

## 🔌 Integraciones

### 📱 WhatsApp Business API
**Archivo:** `src/shared/lib/whatsapp.ts`

**Ejemplo de uso:**
```typescript
import { whatsappClient, sendAppointmentConfirmation } from '@/src/shared/lib/whatsapp';

// Enviar confirmación de cita
await sendAppointmentConfirmation(
  '+521234567890',
  'María García',
  'Lunes 15 de Enero',
  '10:00 AM',
  'ESVA Nogales',
  'Av. Principal #123'
);

// Menú interactivo
await whatsappClient.sendButtonMessage(
  '+521234567890',
  '¿Confirmas tu cita?',
  [
    { id: 'confirm', title: '✅ Confirmo' },
    { id: 'reschedule', title: '📅 Reagendar' },
    { id: 'cancel', title: '❌ Cancelar' }
  ]
);
```

**Estado:** ⚠️ Requiere configuración en `.env.local`

---

### ⚡ n8n Workflows
**Archivo:** `src/shared/lib/n8n.ts`

**Workflow: AI Conversation**
```
Mensaje WhatsApp → n8n → Claude API → Respuesta → WhatsApp
```

**Ejemplo:**
```typescript
import { n8nClient } from '@/src/shared/lib/n8n';

// Trigger AI response
await n8nClient.requestAIResponse(
  conversation,
  messages,
  lead
);
```

**Estado:** ⚠️ Requiere crear workflows en n8n

---

### 🔄 Realtime Updates
**Archivo:** `src/shared/hooks/useRealtimeDashboard.ts`

**Ejemplo de uso:**
```typescript
import { useRealtimeDashboard } from '@/src/shared/hooks';

function Dashboard() {
  const { newLeadsCount, newMessagesCount } = useRealtimeDashboard({
    onNewLead: (lead) => {
      toast.success(`Nuevo lead: ${lead.name}`);
    },
    onNewMessage: (msg) => {
      toast.info('Nuevo mensaje de WhatsApp');
    }
  });

  return (
    <div>
      <Badge>{newLeadsCount} nuevos leads</Badge>
      <Badge>{newMessagesCount} mensajes</Badge>
    </div>
  );
}
```

**Estado:** ✅ Funcional

---

## 📂 Archivos Clave

### Para el Cliente
| Archivo | Descripción |
|---------|-------------|
| `ENTREGA_CLIENTE.md` | 📄 Documentación completa de entrega |
| `GUIA_VISUAL.md` | 🎨 Esta guía visual |
| `docs/INTEGRATION_GUIDE.md` | 🔌 Setup WhatsApp + n8n |

### Para Desarrolladores
| Archivo | Descripción |
|---------|-------------|
| `CLAUDE.md` | 🤖 Principios y convenciones de código |
| `README.md` | 📘 Setup técnico del proyecto |
| `package.json` | 📦 Dependencias y scripts |

### Database
| Archivo | Descripción |
|---------|-------------|
| `003_esva_schema_v2.sql` | 🗄️ Schema completo |
| `004_esva_seed_data.sql` | 🌱 Datos iniciales ESVA |

---

## 🎯 Checklist Rápido

### Para ver la plataforma funcionando:

1. **Setup básico** (5 min)
   ```bash
   npm install
   ```

2. **Configurar Supabase** (10 min)
   - Ejecutar migraciones en SQL Editor
   - Copiar service_role key a `.env.local`

3. **Iniciar desarrollo** (1 min)
   ```bash
   npm run dev
   ```

4. **Abrir en navegador**
   ```
   http://localhost:3000
   ```

5. **Login** (usa credentials de staff en seed data)
   ```
   Email: alberto.estrella@esva.mx
   Password: [configurar en Supabase Auth]
   ```

### Para producción:

1. **Deploy a Vercel** (5 min)
   - Conectar repo
   - Configurar env vars
   - Deploy

2. **Configurar WhatsApp** (30 min)
   - Seguir `docs/INTEGRATION_GUIDE.md`
   - Obtener credenciales Meta
   - Configurar webhook

3. **Configurar n8n** (1 hora)
   - Deploy n8n instance
   - Crear workflows
   - Conectar con platform

---

## 🆘 ¿Dónde Buscar Ayuda?

### Problema: No sé cómo funciona X
→ Leer `ENTREGA_CLIENTE.md` sección del módulo X

### Problema: Quiero configurar WhatsApp
→ Leer `docs/INTEGRATION_GUIDE.md` → WhatsApp Business API

### Problema: Quiero configurar n8n
→ Leer `docs/INTEGRATION_GUIDE.md` → n8n Workflows

### Problema: Error en el código
→ Leer `CLAUDE.md` → Convenciones de código
→ Revisar console de desarrollo

### Problema: Error en database
→ Verificar migraciones ejecutadas
→ Revisar `supabase/migrations/003_esva_schema_v2.sql`

---

## 📞 Contacto

**Soporte técnico:** [Tu contacto]
**Repositorio:** [GitHub URL]
**Documentación:** Ver carpeta `/docs/`

---

*Última actualización: 2025-01-07*
