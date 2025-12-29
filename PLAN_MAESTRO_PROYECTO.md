# PLAN MAESTRO - TIS TIS Platform para ESVA Dental
## Documento de Analisis Completo y Hoja de Ruta

**Fecha:** 2025-12-29 (Actualizado)
**Cliente:** ESVA Dental Clinic (Piloto)
**Objetivo:** Sistema completo estilo Barti.com mejorado, listo para produccion
**Estado:** En produccion con arquitectura LangGraph multi-agente + Sistema de Terminología Multi-Vertical

---

## 📊 ANÁLISIS DE INFORMACIÓN RECOPILADA

### 1. DECISIONES ARQUITECTÓNICAS CRÍTICAS

#### 1.1 Sistema TODO-EN-UNO vs Integraciones

**DECISIÓN TOMADA:** Sistema todo-en-uno tipo Barti.com

**Justificación:**
- ✅ **PRO**: Control total del stack, mejor UX, sin dependencias externas
- ✅ **PRO**: Escalable como producto (micro-apps para diferentes verticales)
- ✅ **PRO**: No depender de OpenDental ni Google Calendar
- ❌ **CONTRA**: Mayor desarrollo inicial
- ✅ **GANADOR**: Vale la pena para el modelo de negocio TIS TIS

**Implicaciones:**
```
❌ NO USAR:
- OpenDental (tienen pero lo reemplazamos)
- Google Calendar (construimos el nuestro)
- Sistemas POS de terceros

✅ CONSTRUIR PROPIO:
- Sistema de citas completo
- CRM integrado
- Gestión de pacientes
- Historial clínico
- Cotizaciones automatizadas
- Facturación (futuro)
```

#### 1.2 Base de Datos: Supabase vs Airtable

**RECOMENDACIÓN: SUPABASE (100%)**

**Análisis:**

**Supabase:**
- ✅ PostgreSQL (base de datos real, robusta)
- ✅ Row Level Security (RLS) nativo
- ✅ Realtime out-of-the-box
- ✅ Auth incluido
- ✅ Storage para archivos (radiografías)
- ✅ Edge Functions para lógica compleja
- ✅ Backups automáticos
- ✅ Escalable a millones de registros
- ✅ Open source (no vendor lock-in)
- ✅ **GRATIS hasta 500MB DB + 2GB storage**
- ✅ Ya tienes experiencia

**Airtable:**
- ❌ Limitado a 50,000 registros por base (plan gratis)
- ❌ Caro al escalar ($20/user/month)
- ❌ No es base de datos real (spreadsheet glorificado)
- ❌ No tiene RLS nativo
- ❌ APIs limitadas
- ❌ No adecuado para producción enterprise
- ✅ UI bonita (pero no la necesitas)

**VEREDICTO: Supabase sin duda**

**Arquitectura de Datos:**
```
TIS TIS (Supabase Master)
├── templates/              # Plantillas de micro-apps
├── tenants/                # Clientes (ESVA, otros)
└── shared_resources/       # Assets compartidos

Cliente ESVA (Supabase Proyecto)
├── branches/               # Sucursales
├── staff/                  # Personal
├── patients/               # Pacientes (leads → patients)
├── appointments/           # Citas
├── conversations/          # Conversaciones
├── messages/               # Mensajes
├── clinical_history/       # Historial clínico
├── quotes/                 # Cotizaciones
├── files/                  # Storage (radiografías, docs)
└── invoices/               # Facturas (futuro)
```

#### 1.3 WhatsApp: Un Número vs Múltiples

**DECISIÓN TOMADA:** UN solo número para todas las sucursales

**Justificación:**
- ✅ Más fácil de gestionar
- ✅ Un solo webhook
- ✅ IA puede preguntar sucursal preferida
- ✅ Menos costo de Meta Business
- ✅ Menos configuración

**Implementación:**
```typescript
// En el flujo de conversación:
1. Cliente: "Hola, quiero agendar cita"
2. IA: "¡Hola! ¿En cuál sucursal te gustaría agendar?
   - Nogales (HQ)
   - Tijuana
   - Hermosillo"
3. Cliente: "Tijuana"
4. IA: [continúa flujo con branch_id de Tijuana]
```

#### 1.4 Asistente de Voz: Número Dedicado Virtual

**DECISIÓN TOMADA:** Número virtual con VAPI

**Justificación:**
- ✅ Ya tienes VAPI configurado
- ✅ Evita conflictos con número real
- ✅ Más control
- ✅ Fácil de testear

**Arquitectura:**
```
Número Virtual (VAPI)
    ↓
VAPI procesamiento de voz
    ↓
Webhook → TIS TIS Platform
    ↓
Actions:
- Agendar cita
- Consultar disponibilidad
- Reagendar
- Cancelar
    ↓
Respuesta → VAPI → Cliente
```

---

### 2. BRANDING TIS TIS

#### 2.1 Colores Corporativos

**Extraídos de la página web:**

```css
/* Paleta Principal */
--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--accent-blue: #667eea;
--accent-purple: #764ba2;

/* Gradiente Secundario */
--secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);

/* Colores de Texto */
--text-primary: #1a202c;
--text-secondary: #4a5568;

/* Backgrounds */
--bg-light: #f7fafc;
--border-color: #e2e8f0;

/* Estados */
--success-green: #48bb78;
```

**Aplicación al Dashboard:**
- Logo: Gradiente azul-púrpura (#667eea → #764ba2)
- Botones primarios: Gradiente principal
- Accent colors: Azul #667eea
- Cards/borders: #e2e8f0
- Success states: Verde #48bb78

#### 2.2 Logo TIS TIS

**Ubicación esperada:** `/public/logo-tistis.svg` o similar

**TODO:** Necesito que me proporciones:
- [ ] Logo TIS TIS en SVG (preferible) o PNG
- [ ] Logo en versión dark (si existe)
- [ ] Favicon

**Por ahora:** Usaré text-based logo con gradiente

---

### 3. INFORMACIÓN DEL NEGOCIO ESVA

#### 3.1 Horarios de Atención

**Todas las sucursales:**
```javascript
const BUSINESS_HOURS = {
  monday: { open: '09:30', close: '18:00' },
  tuesday: { open: '09:30', close: '18:00' },
  wednesday: { open: '09:30', close: '18:00' },
  thursday: { open: '09:30', close: '18:00' },
  friday: { open: '09:30', close: '18:00' },
  saturday: { open: '10:00', close: '14:00' },
  sunday: { closed: true }
};

const APPOINTMENT_DURATION_DEFAULT = 60; // minutos
```

#### 3.2 Proceso de Captación de Leads

**Información requerida ANTES de agendar:**
1. ✅ Nombre completo
2. ✅ Teléfono
3. ✅ Motivo de consulta
4. ✅ Problemas dentales que tiene
5. ✅ ¿Ha tenido atención dental antes? (Sí/No)
6. ✅ Tratamiento buscado
7. ✅ Sucursal preferida (Nogales, Tijuana, Hermosillo)

**Flow de conversación IA:**
```
1. Saludo: "¡Hola! Soy el asistente virtual de ESVA Dental 🦷"
2. Captura nombre: "¿Cuál es tu nombre?"
3. Confirma teléfono: "Gracias [nombre], confirmo tu número: [phone]?"
4. Pregunta motivo: "¿Qué te trae por aquí hoy?"
5. Profundiza: "¿Podrías contarme más sobre el problema?"
6. Historial: "¿Has visitado al dentista recientemente?"
7. Tratamiento: "¿Qué tratamiento estás buscando?"
8. Sucursal: "Tenemos 3 sucursales: Nogales, Tijuana y Hermosillo. ¿Cuál prefieres?"
9. Agenda: "Perfecto! Déjame ver disponibilidad..."
10. Confirma: "Tu cita está agendada para [fecha] a las [hora]"
```

#### 3.3 Preguntas Frecuentes

**TODO:** Necesito la imagen que mencionaste con las FAQs

**Por ahora, FAQs típicas de clínica dental:**
1. ¿Cuánto cuesta una limpieza?
2. ¿Aceptan seguro dental?
3. ¿Tienen planes de pago?
4. ¿Cuánto dura una consulta?
5. ¿Necesito cita o aceptan walk-ins?
6. ¿Hacen urgencias dentales?
7. ¿Tienen especialistas?
8. ¿Qué servicios ofrecen?

#### 3.4 Servicios y Precios

**TODO:** Imagen con precios

**Servicios base (ya en DB):**
- Consulta General
- Limpieza Dental (Profilaxis)
- Blanqueamiento
- Ortodoncia
- Implantes
- Endodoncia (Tratamiento de conducto)
- Extracciones
- Coronas y Puentes
- Carillas
- Resinas
- Periodoncia
- Cirugía Oral

**Enfoque:** Lujo/Premium (sin descuentos, promociones ocasionales)

#### 3.5 Volumen de Mensajes

**Estimado:** 10-30 mensajes diarios por sucursal
**Total:** ~30-90 mensajes/día en 3 sucursales

**Implicación:**
- IA puede manejar 90% de estos mensajes
- Escalación a humano solo en casos complejos
- Ahorro: ~2-3 horas diarias de trabajo manual

---

### 4. SISTEMA DE LEAD SCORING

#### 4.1 Algoritmo Propuesto

**Basado en análisis de información:**

```javascript
function calculateLeadScore(lead) {
  let score = 50; // Base score

  // Factor 1: Tratamiento solicitado (30 puntos max)
  const treatments = {
    'implantes': 30,
    'ortodoncia': 25,
    'blanqueamiento': 20,
    'carillas': 25,
    'coronas': 20,
    'limpieza': 10,
    'consulta': 5
  };
  score += getTreatmentScore(lead.interested_services, treatments);

  // Factor 2: Velocidad de respuesta (20 puntos max)
  const responseTime = lead.first_response_minutes;
  if (responseTime < 5) score += 20;
  else if (responseTime < 15) score += 15;
  else if (responseTime < 60) score += 10;
  else score += 5;

  // Factor 3: Engagement en conversación (20 puntos max)
  const messageCount = lead.total_messages;
  if (messageCount >= 5) score += 20;
  else if (messageCount >= 3) score += 15;
  else if (messageCount >= 2) score += 10;
  else score += 5;

  // Factor 4: Completó información (15 puntos max)
  let completeness = 0;
  if (lead.name) completeness += 3;
  if (lead.phone) completeness += 3;
  if (lead.interested_services?.length) completeness += 3;
  if (lead.notes) completeness += 3;
  if (lead.preferred_branch) completeness += 3;
  score += completeness;

  // Factor 5: Historial dental previo (10 puntos)
  if (lead.has_previous_treatment) score += 10;

  // Factor 6: Horario de contacto (5 puntos)
  if (isBusinessHours(lead.first_contact_at)) score += 5;

  return Math.min(score, 100); // Cap at 100
}

// Clasificación
if (score >= 80) return 'hot';    // 🔥 Hot
if (score >= 40) return 'warm';   // 🟡 Warm
return 'cold';                     // 🔵 Cold
```

#### 4.2 Auto-Escalation Rules

**Escalar a humano inmediatamente si:**
1. Cliente usa palabras: "urgencia", "dolor", "emergencia"
2. Cliente pide hablar con humano explícitamente
3. IA no entiende después de 2 intentos
4. Cliente molesto (palabras negativas)
5. Consulta fuera de scope (legal, médica compleja)

---

### 5. ROLES Y PERMISOS (RLS)

#### 5.1 Estructura de Roles

```typescript
enum UserRole {
  SUPER_ADMIN = 'super_admin',    // TIS TIS staff
  ADMIN = 'admin',                 // Administración ESVA
  RECEPTIONIST = 'receptionist',   // Recepcionista
  DENTIST = 'dentist',             // Dentista
  SPECIALIST = 'specialist'        // Especialista
}
```

#### 5.2 Matriz de Permisos

| Feature | Super Admin | Admin | Receptionist | Dentist | Specialist |
|---------|-------------|-------|--------------|---------|------------|
| **Dashboard** |
| Ver stats globales | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver stats sucursal | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Leads** |
| Ver todos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver asignados | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar | ✅ | ✅ | ✅ | ❌ | ❌ |
| Eliminar | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Citas** |
| Ver todas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver propias | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar | ✅ | ✅ | ✅ | ⚠️ Solo propias | ⚠️ Solo propias |
| Cancelar | ✅ | ✅ | ✅ | ⚠️ Solo propias | ⚠️ Solo propias |
| **Conversaciones** |
| Ver todas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Responder | ✅ | ✅ | ✅ | ⚠️ Solo escaladas | ⚠️ Solo escaladas |
| Escalar | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Historial Clínico** |
| Ver todos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver pacientes asignados | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Cotizaciones** |
| Ver todas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crear | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aprobar | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Archivos** |
| Ver todos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver pacientes asignados | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subir | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar | ✅ | ✅ | ❌ | ⚠️ Solo propios | ⚠️ Solo propios |
| **Configuración** |
| Cambiar settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver integraciones | ✅ | ✅ | ⚠️ Solo status | ❌ | ❌ |

#### 5.3 Restricciones por Sucursal

**Políticas RLS:**

```sql
-- Ejemplo: Staff solo ve datos de su sucursal
CREATE POLICY "staff_see_own_branch"
ON appointments
FOR SELECT
TO authenticated
USING (
  branch_id IN (
    SELECT branch_id
    FROM staff
    WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM staff
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);
```

**Reglas:**
- Admin/Super Admin: ✅ Ver todas las sucursales
- Receptionist: ✅ Solo su sucursal
- Dentist/Specialist: ✅ Solo su sucursal + solo sus pacientes

---

### 6. FUNCIONALIDADES A IMPLEMENTAR

#### 6.1 Features Core (Prioridad ALTA)

**YA IMPLEMENTADAS:**
- [x] Dashboard Overview con stats
- [x] Gestión de Leads con scoring
- [x] Calendario de Citas
- [x] Inbox de Conversaciones
- [x] Settings básicos
- [x] API Routes CRUD
- [x] Realtime subscriptions
- [x] Autenticación

**POR IMPLEMENTAR:**
- [ ] Sistema de Notificaciones (push, email)
- [ ] Exportar Reportes (PDF, Excel)
- [ ] Gestión de Cotizaciones (crear, enviar, aprobar)
- [ ] Historial Clínico de Pacientes
- [ ] Subir/Ver Archivos (radiografías, documentos)
- [ ] Dark Mode
- [ ] Calendario con drag & drop para citas
- [ ] Roles y permisos (RLS completo)

#### 6.2 Features Automatizadas (Prioridad ALTA)

**Para implementar con n8n:**
- [ ] Cotizaciones automatizadas
- [ ] Facturación automática (futuro)
- [ ] Recordatorios de citas (24h antes, 9am)
- [ ] Follow-ups automáticos a leads fríos
- [ ] Re-engagement campaigns

#### 6.3 Integraciones (Prioridad ALTA)

- [ ] WhatsApp Business API (después de piloto)
- [ ] VAPI (asistente de voz)
- [ ] n8n workflows
- [ ] Meta Business Suite

#### 6.4 Features Nice-to-Have (Prioridad BAJA)

- [ ] Multi-idioma (ES/EN)
- [ ] Portal para pacientes
- [ ] Programa de referidos
- [ ] Búsqueda global avanzada

---

### 7. ARQUITECTURA TÉCNICA FINAL

#### 7.1 Stack Tecnológico

```yaml
Frontend:
  Framework: Next.js 14 (App Router)
  Language: TypeScript
  Styling: Tailwind CSS + TIS TIS Colors
  State: Zustand
  Forms: React Hook Form + Zod
  UI: shadcn/ui + custom components

Backend:
  API: Next.js API Routes (serverless)
  Database: Supabase PostgreSQL
  Auth: Supabase Auth
  Storage: Supabase Storage (para archivos)
  Realtime: Supabase Realtime

Integraciones:
  WhatsApp: Meta Business API
  Voice: VAPI
  Workflows: n8n
  AI: Claude (Anthropic)

Infrastructure:
  Hosting: Vercel
  DB: Supabase (cloud)
  CDN: Vercel Edge
  Domain: [Pendiente o subdominio Vercel]
```

#### 7.2 Estructura de Archivos (Actualizada)

```
tistis-platform/
├── app/
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── page.tsx              # Overview ✅
│   │       ├── leads/                # Leads ✅
│   │       ├── calendario/           # Calendario ✅
│   │       ├── inbox/                # Conversaciones ✅
│   │       ├── patients/             # 🆕 Pacientes
│   │       ├── quotes/               # 🆕 Cotizaciones
│   │       ├── files/                # 🆕 Archivos
│   │       ├── analytics/            # Analytics ✅
│   │       └── settings/             # Settings ✅
│   │
│   └── api/
│       ├── leads/                    # ✅
│       ├── appointments/             # ✅
│       ├── conversations/            # ✅
│       ├── patients/                 # 🆕
│       ├── quotes/                   # 🆕
│       ├── files/                    # 🆕
│       ├── notifications/            # 🆕
│       ├── reports/                  # 🆕
│       └── webhook/                  # ✅
│
├── src/
│   ├── features/
│   │   ├── auth/                     # ✅
│   │   ├── dashboard/                # ✅
│   │   ├── patients/                 # 🆕
│   │   ├── quotes/                   # 🆕
│   │   ├── files/                    # 🆕
│   │   └── notifications/            # 🆕
│   │
│   └── shared/
│       ├── components/ui/            # ✅ + 🆕 más componentes
│       ├── hooks/                    # ✅
│       ├── lib/                      # ✅
│       ├── stores/                   # ✅
│       └── utils/                    # ✅
│
└── supabase/
    └── migrations/
        ├── 003_esva_schema_v2.sql   # ✅
        ├── 004_esva_seed_data.sql   # ✅
        ├── 005_patients_module.sql  # 🆕
        ├── 006_quotes_module.sql    # 🆕
        ├── 007_files_storage.sql    # 🆕
        └── 008_rls_policies.sql     # 🆕
```

---

### 8. HOJA DE RUTA (ROADMAP)

#### FASE 1: FUNDACIÓN (COMPLETADA ✅)
**Tiempo:** YA HECHO
- [x] Schema DB v2
- [x] Seed data ESVA
- [x] Dashboard base
- [x] Módulos principales (Leads, Citas, Inbox)
- [x] API Routes básicas
- [x] Autenticación

#### FASE 2: FEATURES CORE (3-5 días)
**Objetivo:** Sistema completo sin integraciones externas

**Día 1: Pacientes y Cotizaciones**
- [ ] Migración: `005_patients_module.sql`
- [ ] Módulo Pacientes (convertir leads → patients)
- [ ] Historial clínico básico
- [ ] Migración: `006_quotes_module.sql`
- [ ] Módulo Cotizaciones (crear, editar, enviar)
- [ ] Auto-generación de PDFs

**Día 2: Archivos y Notificaciones**
- [ ] Migración: `007_files_storage.sql`
- [ ] Supabase Storage setup
- [ ] Upload de archivos (drag & drop)
- [ ] Viewer de imágenes/PDFs
- [ ] Sistema de notificaciones in-app
- [ ] Badges de notificaciones no leídas

**Día 3: Permisos y Roles**
- [ ] Migración: `008_rls_policies.sql`
- [ ] Implementar RLS completo
- [ ] Roles UI (admin panel)
- [ ] Testing de permisos por rol
- [ ] Restricciones por sucursal

**Día 4: UX y Polish**
- [ ] Dark mode
- [ ] Calendario drag & drop
- [ ] Búsqueda global
- [ ] Exportar reportes (PDF/Excel)
- [ ] Loading states
- [ ] Error handling mejorado

**Día 5: Testing y Fixes**
- [ ] Testing exhaustivo
- [ ] Fix de bugs encontrados
- [ ] Performance optimization
- [ ] Mobile responsive polish

#### FASE 3: INTEGRACIONES IA (COMPLETADA)
**Objetivo:** Automatizacion con WhatsApp y voz

**Completado:**
- [x] Sistema nativo de IA (sin n8n)
- [x] Claude AI prompts optimizados
- [x] Lead scoring automatizado
- [x] Webhook handling completo multi-canal
- [x] Testing de flujos IA
- [x] Edge cases handling

#### FASE 4: LANGGRAPH MULTI-AGENTE (COMPLETADA - 21 Dic 2025)
**Objetivo:** Sistema de agentes especializados

**Completado:**
- [x] Arquitectura LangGraph con 11 agentes
- [x] Supervisor Agent (orquestador)
- [x] Vertical Router (dental, restaurant, medical, etc.)
- [x] Agentes especialistas (greeting, pricing, location, hours, faq, booking, general, escalation, urgent-care)
- [x] Variantes de booking por vertical
- [x] Feature flag en base de datos
- [x] Servicio de integracion

**Archivos creados:**
```
src/features/ai/
├── state/agent-state.ts
├── agents/supervisor/supervisor.agent.ts
├── agents/routing/vertical-router.agent.ts
├── agents/specialists/*.agent.ts
├── graph/tistis-graph.ts
└── services/langgraph-ai.service.ts
```

**Migracion:** `064_LANGGRAPH_FEATURE_FLAG.sql`

#### FASE 5: PILOTO CON ESVA (1 semana)
**Objetivo:** Testing real con tu supervision

**Semana 1:**
- [ ] Deploy a produccion
- [ ] Onboarding de 1-2 usuarios ESVA
- [ ] Testing con conversaciones reales (simuladas)
- [ ] Ajustes segun feedback
- [ ] Iteraciones rapidas

#### FASE 6: GO LIVE (Despues de aprobacion)
**Objetivo:** Conexion real a Meta API

**Post-aprobacion:**
- [ ] Obtener credenciales Meta Business
- [ ] Configurar WhatsApp real
- [ ] Activar LangGraph para tenant ESVA
- [ ] Monitoreo 24/7 primera semana
- [ ] Ajustes finales

---

### 9. PREGUNTAS ESPECÍFICAS PARA ROLES Y PERMISOS

**Para afinar la configuración, necesito que respondas:**

#### 9.1 Administración Central

1. **¿Quién es "Administración Central"?**
   - [ ] Dueño(s) de ESVA
   - [ ] Gerente general
   - [ ] ¿Cuántas personas?

2. **¿Pueden ver datos de TODAS las sucursales?**
   - [ ] Sí, todo
   - [ ] Solo reportes consolidados
   - [ ] Solo su sucursal asignada

3. **¿Pueden eliminar registros?**
   - [ ] Sí, cualquier registro
   - [ ] Solo soft-delete (marcar como eliminado)
   - [ ] No pueden eliminar nada

#### 9.2 Recepcionistas

4. **¿Cada sucursal tiene su propia recepcionista?**
   - [ ] Sí, una por sucursal
   - [ ] No, rotan entre sucursales
   - [ ] Una central para todas

5. **¿Pueden ver datos de otras sucursales?**
   - [ ] No, solo su sucursal
   - [ ] Sí, todas
   - [ ] Solo para consulta, no editar

6. **¿Pueden modificar información de pacientes?**
   - [ ] Sí, libremente
   - [ ] Solo datos básicos (nombre, teléfono)
   - [ ] No, solo dentistas

#### 9.3 Dentistas y Especialistas

7. **¿Los dentistas pueden ver pacientes de otros dentistas?**
   - [ ] No, solo sus asignados
   - [ ] Sí, todos de su sucursal
   - [ ] Sí, de todas las sucursales

8. **¿Pueden crear cotizaciones?**
   - [ ] Sí, pero requieren aprobación de admin
   - [ ] Sí, directamente
   - [ ] No, solo recepcionista/admin

9. **¿Pueden acceder al historial de conversaciones?**
   - [ ] No, solo recepción
   - [ ] Sí, todos
   - [ ] Solo conversaciones escaladas a ellos

#### 9.4 Datos Sensibles

10. **¿El historial clínico es visible para recepción?**
    - [ ] No, solo dentistas
    - [ ] Sí, pero sin editar
    - [ ] Sí, con permisos completos

11. **¿Las cotizaciones/precios son visibles para todos?**
    - [ ] Sí
    - [ ] No, solo admin y dentistas
    - [ ] Solo después de aprobadas

12. **¿Los reportes de analytics son visibles para todos?**
    - [ ] Sí, todos los roles
    - [ ] Solo admin
    - [ ] Admin + recepcionistas

---

### 10. DECISIONES PENDIENTES (NECESITO TU INPUT)

#### 10.1 Logo TIS TIS
**NECESITO:**
- [ ] Archivo del logo (SVG preferible, o PNG alta resolución)
- [ ] Logo en blanco (para dark mode si aplica)
- [ ] Favicon

**UBICACIÓN ESPERADA:**
```
/public/
├── logo-tistis.svg
├── logo-tistis-white.svg
└── favicon.ico
```

#### 10.2 FAQs e Información
**NECESITO:**
- [ ] Imagen que mencionaste con FAQs
- [ ] Imagen con precios de servicios
- [ ] ¿Algún documento PDF con info de ESVA?

#### 10.3 Acceso a n8n
**CONFIRMAR:**
- [ ] ¿Tienes MCP de n8n configurado?
- [ ] ¿Puedo acceder vía MCP desde aquí?
- [ ] Si no, ¿me das acceso web a tu instancia?

#### 10.4 Testing
**CONFIRMAR:**
- [ ] ¿Quieres que haga testing yo solo primero?
- [ ] ¿O vamos directo a testing juntos?
- [ ] ¿Timeline? (¿Cuándo quieres tener el piloto listo?)

---

### 11. PRÓXIMOS PASOS INMEDIATOS

**Lo que haré AHORA (sin esperar respuestas):**

#### Paso 1: Actualizar Branding (30 min)
- [ ] Cambiar colores a paleta TIS TIS
- [ ] Actualizar componentes UI
- [ ] Text-based logo (mientras envías el real)

#### Paso 2: Crear Módulo de Pacientes (2-3 horas)
- [ ] Migración SQL
- [ ] API Routes
- [ ] UI de gestión
- [ ] Conversión lead → patient

#### Paso 3: Crear Módulo de Cotizaciones (2-3 horas)
- [ ] Migración SQL
- [ ] API Routes
- [ ] UI de creación
- [ ] Generación de PDF

#### Paso 4: Files/Storage (2 horas)
- [ ] Setup Supabase Storage
- [ ] Upload component
- [ ] Viewer de archivos

#### Paso 5: Notificaciones (2 horas)
- [ ] Sistema in-app
- [ ] Badges en sidebar
- [ ] Panel de notificaciones

**Tiempo total estimado: 8-10 horas de trabajo**

**Una vez que me respondas las preguntas de roles, haré:**

#### Paso 6: RLS Policies (3-4 horas)
- [ ] Políticas según tus respuestas
- [ ] Testing exhaustivo
- [ ] Documentación

---

### 12. CRITERIOS DE ÉXITO

**Para considerar el proyecto COMPLETO y listo para cliente:**

#### 12.1 Técnico
- [ ] ✅ Todos los módulos funcionando
- [ ] ✅ RLS implementado correctamente
- [ ] ✅ 0 errores críticos
- [ ] ✅ Performance <2s carga inicial
- [ ] ✅ Mobile responsive 100%
- [ ] ✅ Dark mode funcional
- [ ] ✅ Exportar reportes funcional
- [ ] ✅ Upload de archivos funcional

#### 12.2 UX
- [ ] ✅ Navegación intuitiva
- [ ] ✅ Loading states everywhere
- [ ] ✅ Error messages claros
- [ ] ✅ Confirmaciones en acciones destructivas
- [ ] ✅ Tooltips donde necesario
- [ ] ✅ Empty states bonitos

#### 12.3 Testing
- [ ] ✅ Testing manual completo por ti
- [ ] ✅ 0 bugs bloqueantes
- [ ] ✅ Edge cases manejados
- [ ] ✅ Flujos críticos validados

#### 12.4 Documentación
- [ ] ✅ README actualizado
- [ ] ✅ ENTREGA_CLIENTE.md completo
- [ ] ✅ Guías de usuario
- [ ] ✅ Docs de deployment

#### 12.5 Deploy
- [ ] ✅ Producción en Vercel
- [ ] ✅ Supabase en plan adecuado
- [ ] ✅ Environment vars configuradas
- [ ] ✅ Monitoreo básico activo

---

### 13. ENTREGABLES FINALES

**Lo que recibirás al final:**

1. **Código Fuente**
   - Repositorio GitHub completo
   - Documentación inline
   - README detallado

2. **Base de Datos**
   - Schema SQL completo
   - Seed data
   - Migraciones versionadas

3. **Documentación**
   - Guía de usuario (PDF)
   - Guía de admin (PDF)
   - Documentación técnica (MD)
   - Video walkthrough (opcional)

4. **Deploy**
   - App en producción (Vercel)
   - Dashboard de monitoreo
   - Credenciales organizadas

5. **Capacitación**
   - Sesión de onboarding (1-2 horas)
   - Q&A session
   - Soporte post-lanzamiento

---

## RESUMEN EJECUTIVO

### Lo que tenemos (Actualizado 29 Dic 2025):
- Base solida implementada (Dashboard, APIs, DB)
- Arquitectura clara (todo-en-uno tipo Barti)
- Decisiones tecnicas tomadas (Supabase, Next.js)
- **Sistema de IA multi-agente con LangGraph (11 agentes)**
- **Feature flag para activar/desactivar LangGraph por tenant**
- Webhooks multi-canal funcionando (WhatsApp, Instagram, Facebook, TikTok)
- Lead scoring automatico
- Recordatorios de citas automaticos
- Validacion de comprobantes con AI Vision
- **Sistema de Terminología Dinámica Multi-Vertical (dental/restaurant)**
- **Integration Hub con 20+ conectores**
- **Voice Agent System con VAPI**

### Lo que falta:
- Prueba piloto con ESVA (testing real)
- Conexion a Meta Business API (produccion)
- Ajustes basados en feedback

### Timeline Actualizado:
- **Fase 1-3 (Core + IA):** COMPLETADO
- **Fase 4 (LangGraph):** COMPLETADO (21 Dic 2025)
- **Fase 5 (Integration Hub):** COMPLETADO (27 Dic 2025)
- **Fase 6 (Multi-Vertical Terminology):** COMPLETADO (29 Dic 2025)
- **Fase 7 (Piloto):** 1 semana
- **Fase 8 (Go Live):** Despues de aprobacion

### Proximos pasos:
1. Deploy a produccion
2. Activar LangGraph para tenant ESVA
3. Testing con conversaciones reales
4. Go Live con Meta Business API

---

## Activar LangGraph para un Tenant

```sql
-- Ver estado actual
SELECT tenant_id, tenant_name, use_langgraph
FROM ai_tenant_config
JOIN tenants USING (tenant_id);

-- Activar para ESVA
UPDATE ai_tenant_config
SET use_langgraph = true
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- Verificar
SELECT * FROM ai_tenant_config WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
```

---

**Sistema listo para produccion con arquitectura LangGraph multi-agente.**
