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
