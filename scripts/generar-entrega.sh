#!/bin/bash

# =====================================================
# TIS TIS Platform - Script de Generación de Entrega
# =====================================================

echo "🎁 Generando paquete de entrega para cliente..."
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Crear carpeta de entrega
DELIVERY_DIR="tistis-platform-entrega-$(date +%Y%m%d)"
mkdir -p "$DELIVERY_DIR"

echo -e "${BLUE}📦 Creando estructura de entrega...${NC}"

# Copiar documentación principal
echo "  ✅ Copiando documentación..."
cp ENTREGA_CLIENTE.md "$DELIVERY_DIR/"
cp GUIA_VISUAL.md "$DELIVERY_DIR/"
cp README.md "$DELIVERY_DIR/"
cp -r docs "$DELIVERY_DIR/"

# Copiar migraciones de database
echo "  ✅ Copiando migraciones de base de datos..."
mkdir -p "$DELIVERY_DIR/database"
cp supabase/migrations/003_esva_schema_v2.sql "$DELIVERY_DIR/database/"
cp supabase/migrations/004_esva_seed_data.sql "$DELIVERY_DIR/database/"

# Copiar archivo de environment variables (ejemplo)
echo "  ✅ Copiando configuración de ejemplo..."
cat > "$DELIVERY_DIR/.env.example" << 'EOF'
# =====================================================
# TIS TIS PLATFORM - Variables de Entorno
# =====================================================

# ======================
# SUPABASE
# ======================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ======================
# WHATSAPP BUSINESS API
# ======================
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=tistis_verify_token

# ======================
# N8N WEBHOOKS
# ======================
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
N8N_API_KEY=your_n8n_api_key

# ======================
# STRIPE (Opcional)
# ======================
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx

# ======================
# ANTHROPIC CLAUDE API (Para AI Agent)
# ======================
ANTHROPIC_API_KEY=sk-ant-xxx

# ======================
# APP CONFIGURATION
# ======================
NEXT_PUBLIC_URL=https://tistis-platform.vercel.app
NEXT_PUBLIC_APP_NAME=TIS TIS Platform
NEXT_PUBLIC_DEFAULT_TENANT_ID=a0000000-0000-0000-0000-000000000001
NODE_ENV=production
EOF

# Crear checklist de deployment
echo "  ✅ Creando checklist de deployment..."
cat > "$DELIVERY_DIR/DEPLOYMENT_CHECKLIST.md" << 'EOF'
# 📋 Deployment Checklist - TIS TIS Platform

## Pre-Deployment

- [ ] Leer `ENTREGA_CLIENTE.md` completo
- [ ] Leer `GUIA_VISUAL.md` para entender estructura
- [ ] Revisar `docs/INTEGRATION_GUIDE.md`

## Supabase Setup

- [ ] Crear proyecto en [Supabase](https://supabase.com)
- [ ] Ejecutar `database/003_esva_schema_v2.sql` en SQL Editor
- [ ] Ejecutar `database/004_esva_seed_data.sql` en SQL Editor
- [ ] Habilitar Realtime para tablas: leads, appointments, conversations, messages
- [ ] Copiar Project URL → `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Copiar Anon Key → `.env.local` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Copiar Service Role Key → `.env.local` → `SUPABASE_SERVICE_ROLE_KEY`

## WhatsApp Business API Setup

- [ ] Crear app en [Meta Developer Portal](https://developers.facebook.com/)
- [ ] Activar WhatsApp Business API
- [ ] Obtener Phone Number ID → `.env.local`
- [ ] Obtener Access Token → `.env.local`
- [ ] Configurar Webhook URL (después de deploy)
- [ ] Crear Message Templates:
  - [ ] cita_confirmada
  - [ ] recordatorio_cita
  - [ ] bienvenida_esva
  - [ ] cotizacion_enviada
  - [ ] seguimiento

## n8n Setup

- [ ] Deploy n8n instance ([n8n.cloud](https://n8n.cloud) o self-hosted)
- [ ] Configurar `N8N_WEBHOOK_URL` en `.env.local`
- [ ] Crear workflows según `docs/INTEGRATION_GUIDE.md`:
  - [ ] AI Conversation Handler
  - [ ] Lead Scorer
  - [ ] Appointment Scheduler
  - [ ] Appointment Reminders
  - [ ] Follow-up Automation

## Vercel Deployment

- [ ] Crear cuenta en [Vercel](https://vercel.com)
- [ ] Conectar repositorio GitHub
- [ ] Configurar todas las variables de entorno
- [ ] Deploy
- [ ] Verificar URL pública funcionando
- [ ] Configurar Webhook de WhatsApp con URL de Vercel

## Post-Deployment Testing

- [ ] Login funcional
- [ ] Dashboard muestra datos
- [ ] Crear nuevo lead
- [ ] Crear nueva cita
- [ ] Realtime notifications funcionando
- [ ] Enviar mensaje WhatsApp de prueba
- [ ] Verificar workflow n8n se ejecuta

## Production Checklist

- [ ] SSL/HTTPS activo
- [ ] Dominio custom configurado (opcional)
- [ ] Backups de database habilitados
- [ ] Monitoring configurado
- [ ] Rate limiting en API routes
- [ ] Error tracking (Sentry, etc.)

---

✅ **Proyecto listo para producción cuando todos los checkboxes estén marcados**
EOF

# Crear README de la carpeta de entrega
echo "  ✅ Creando README de entrega..."
cat > "$DELIVERY_DIR/README.md" << 'EOF'
# 📦 TIS TIS Platform - Paquete de Entrega

Este paquete contiene toda la documentación necesaria para deployar y configurar la plataforma TIS TIS para ESVA Dental Clinic.

## 📂 Contenido

```
tistis-platform-entrega/
├── ENTREGA_CLIENTE.md          ← ⭐ EMPEZAR AQUÍ (documentación completa)
├── GUIA_VISUAL.md              ← Guía visual de navegación
├── DEPLOYMENT_CHECKLIST.md     ← Checklist paso a paso
├── .env.example                ← Template de variables de entorno
├── database/                   ← Migraciones de base de datos
│   ├── 003_esva_schema_v2.sql
│   └── 004_esva_seed_data.sql
└── docs/                       ← Documentación técnica
    └── INTEGRATION_GUIDE.md
```

## 🚀 Quick Start

1. **Leer documentación** (30 min)
   - `ENTREGA_CLIENTE.md` - Documentación completa
   - `GUIA_VISUAL.md` - Entender estructura del proyecto

2. **Setup Supabase** (15 min)
   - Crear proyecto
   - Ejecutar migraciones en `database/`
   - Copiar credenciales

3. **Deploy a Vercel** (10 min)
   - Conectar repositorio
   - Configurar variables de entorno
   - Deploy

4. **Configurar integraciones** (1-2 horas)
   - WhatsApp Business API (ver `docs/INTEGRATION_GUIDE.md`)
   - n8n Workflows (ver `docs/INTEGRATION_GUIDE.md`)

5. **Testing** (30 min)
   - Seguir `DEPLOYMENT_CHECKLIST.md`

## 📞 Soporte

**Repositorio del código:** [Tu GitHub URL]
**Documentación técnica:** Ver carpeta `docs/`
**Issues:** [GitHub Issues URL]

---

**Fecha de entrega:** $(date +"%Y-%m-%d")
**Versión:** 1.0.0
EOF

# Generar árbol de estructura
echo "  ✅ Generando árbol de estructura..."
cat > "$DELIVERY_DIR/ESTRUCTURA.txt" << 'EOF'
Estructura del Proyecto TIS TIS Platform
=========================================

tistis-platform/
│
├── 📄 Documentación Principal
│   ├── ENTREGA_CLIENTE.md          ← Documentación completa
│   ├── GUIA_VISUAL.md              ← Guía visual
│   ├── README.md                    ← Setup técnico
│   └── CLAUDE.md                    ← Principios de desarrollo
│
├── 📂 app/                          ← Next.js App Router
│   ├── (dashboard)/                ← Dashboard routes
│   │   └── dashboard/
│   │       ├── page.tsx            ← Overview
│   │       ├── leads/              ← Gestión de Leads
│   │       ├── calendario/         ← Calendario
│   │       ├── inbox/              ← Conversaciones
│   │       ├── analytics/          ← Analytics
│   │       └── settings/           ← Settings
│   │
│   └── api/                        ← API Routes
│       ├── leads/                  ← CRUD Leads
│       ├── appointments/           ← CRUD Citas
│       ├── conversations/          ← CRUD Conversaciones
│       ├── webhook/                ← WhatsApp + n8n
│       ├── dashboard/stats/        ← Stats
│       ├── branches/               ← Sucursales
│       ├── staff/                  ← Personal
│       └── services/               ← Servicios
│
├── 📂 src/                         ← Código fuente
│   ├── features/                   ← Módulos
│   │   ├── auth/                   ← Autenticación
│   │   └── dashboard/              ← Dashboard
│   │
│   └── shared/                     ← Compartido
│       ├── components/ui/          ← UI Components
│       ├── hooks/                  ← Custom Hooks
│       │   ├── useRealtimeDashboard.ts
│       │   ├── useRealtimeSubscription.ts
│       │   └── useIntegrations.ts
│       ├── lib/                    ← Clientes
│       │   ├── supabase.ts
│       │   ├── whatsapp.ts
│       │   └── n8n.ts
│       ├── stores/                 ← Estado (Zustand)
│       ├── types/                  ← Types
│       └── utils/                  ← Utilidades
│
├── 📂 supabase/migrations/         ← Database
│   ├── 003_esva_schema_v2.sql     ← Schema
│   └── 004_esva_seed_data.sql     ← Seed Data
│
├── 📂 docs/                        ← Docs técnicas
│   └── INTEGRATION_GUIDE.md       ← Integración WhatsApp/n8n
│
└── 📄 .env.local                   ← Variables de entorno

Archivos Clave:
===============

Para Cliente:
  📄 ENTREGA_CLIENTE.md           - Documentación completa
  📄 GUIA_VISUAL.md               - Guía de navegación
  📄 DEPLOYMENT_CHECKLIST.md      - Checklist deployment

Para Desarrolladores:
  📄 CLAUDE.md                     - Convenciones de código
  📄 README.md                     - Setup técnico
  📂 docs/INTEGRATION_GUIDE.md    - Guía integraciones

Database:
  📄 003_esva_schema_v2.sql       - Schema completo
  📄 004_esva_seed_data.sql       - Datos ESVA

Integraciones:
  📄 src/shared/lib/whatsapp.ts   - Cliente WhatsApp
  📄 src/shared/lib/n8n.ts        - Cliente n8n
  📄 app/api/webhook/route.ts     - Webhook endpoint
EOF

echo ""
echo -e "${GREEN}✅ Paquete de entrega generado exitosamente!${NC}"
echo ""
echo -e "${YELLOW}📦 Ubicación:${NC} ./$DELIVERY_DIR/"
echo ""
echo -e "${BLUE}Contenido del paquete:${NC}"
echo "  ✅ Documentación completa (ENTREGA_CLIENTE.md)"
echo "  ✅ Guía visual (GUIA_VISUAL.md)"
echo "  ✅ Deployment checklist"
echo "  ✅ Migraciones de base de datos"
echo "  ✅ Template de environment variables"
echo "  ✅ Documentación técnica"
echo ""
echo -e "${YELLOW}📋 Próximos pasos:${NC}"
echo "  1. Revisar el contenido del paquete"
echo "  2. Comprimir la carpeta: zip -r $DELIVERY_DIR.zip $DELIVERY_DIR/"
echo "  3. Enviar al cliente"
echo ""
echo -e "${GREEN}🎁 Listo para entregar!${NC}"
