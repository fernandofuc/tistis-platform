# 🚀 Guía de Setup - Supabase Database

## 📋 Resumen

Esta guía te llevará paso a paso para configurar completamente la base de datos de TIS TIS Platform en Supabase, incluyendo todas las migraciones, storage buckets y configuraciones necesarias.

**Tiempo estimado:** 20-30 minutos

---

## ✅ Pre-requisitos

- [ ] Cuenta en [Supabase](https://supabase.com)
- [ ] Proyecto creado en Supabase
- [ ] Credenciales copiadas a `.env.local`

---

## 📝 Paso 1: Verificar Credenciales (5 min)

### 1.1 Obtener Credenciales de Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Click en **Settings** → **API**
3. Copia las siguientes credenciales:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (secret)
```

### 1.2 Actualizar .env.local

```bash
# Edita el archivo .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

---

## 🗄️ Paso 2: Ejecutar Migraciones de Base de Datos (15 min)

### Orden de Ejecución:

1. ✅ `003_esva_schema_v2.sql` (Ya ejecutado)
2. ✅ `004_esva_seed_data.sql` (Ya ejecutado)
3. ⚠️ `005_patients_module.sql` (Nuevo)
4. ⚠️ `006_quotes_module.sql` (Nuevo)
5. ⚠️ `007_files_storage_setup.sql` (Nuevo)
6. ⚠️ `008_notifications_module.sql` (Nuevo)

### 2.1 Ejecutar Migración 005 (Pacientes)

1. Ve a **SQL Editor** en Supabase Dashboard
2. Click en **New Query**
3. Copia el contenido completo de:
   ```
   supabase/migrations/005_patients_module.sql
   ```
4. Pega en el editor
5. Click en **Run** (botón verde)
6. ✅ Verifica que dice "Success. No rows returned"

**Tablas creadas:**
- ✅ `patients`
- ✅ `clinical_history`
- ✅ `patient_files`

**Funciones creadas:**
- ✅ `generate_patient_number()`
- ✅ `update_updated_at_column()`

**Views creadas:**
- ✅ `patients_full`
- ✅ `clinical_history_summary`

### 2.2 Ejecutar Migración 006 (Cotizaciones)

1. **SQL Editor** → **New Query**
2. Copia el contenido de:
   ```
   supabase/migrations/006_quotes_module.sql
   ```
3. Pega en el editor
4. Click en **Run**
5. ✅ Verifica "Success"

**Tablas creadas:**
- ✅ `quotes`
- ✅ `quote_items`
- ✅ `quote_payment_plans`

**Funciones creadas:**
- ✅ `generate_quote_number()`
- ✅ `calculate_quote_totals()`

**Views creadas:**
- ✅ `quotes_full`

### 2.3 Ejecutar Migración 007 (Storage Setup)

⚠️ **IMPORTANTE:** Esta migración configura buckets de storage. Algunos comandos pueden fallar si los buckets ya existen - esto es normal.

1. **SQL Editor** → **New Query**
2. Copia el contenido de:
   ```
   supabase/migrations/007_files_storage_setup.sql
   ```
3. Pega en el editor
4. Click en **Run**
5. ⚠️ Ignora errores de "bucket already exists"

**Buckets creados:**
- ✅ `patient-files` (50MB max)
- ✅ `quotes-pdf` (10MB max)
- ✅ `temp-uploads` (20MB max)

**Funciones creadas:**
- ✅ `cleanup_temp_uploads()`

### 2.4 Ejecutar Migración 008 (Notificaciones)

1. **SQL Editor** → **New Query**
2. Copia el contenido de:
   ```
   supabase/migrations/008_notifications_module.sql
   ```
3. Pega en el editor
4. Click en **Run**
5. ✅ Verifica "Success"

**Tablas creadas:**
- ✅ `notifications`
- ✅ `notification_preferences`

**Funciones creadas:**
- ✅ `create_notification()`
- ✅ `mark_notification_read()`
- ✅ `mark_all_notifications_read()`
- ✅ `cleanup_old_notifications()`
- ✅ `broadcast_notification()`

**Views creadas:**
- ✅ `unread_notifications_count`

---

## 📦 Paso 3: Verificar Tablas Creadas (2 min)

### 3.1 Verificar en Table Editor

1. Ve a **Table Editor** en Supabase Dashboard
2. Deberías ver las siguientes tablas nuevas:

```
✅ patients
✅ clinical_history
✅ patient_files
✅ quotes
✅ quote_items
✅ quote_payment_plans
✅ notifications
✅ notification_preferences
```

**Total de tablas:** 18 tablas

### 3.2 Verificar RLS Policies

1. Click en cualquier tabla nueva (ej: `patients`)
2. Ve a la pestaña **Policies**
3. Deberías ver políticas como:
   ```
   ✅ Super Admin can manage all patients
   ✅ Admin can manage tenant patients
   ✅ Receptionist can manage tenant patients
   ```

---

## 🗂️ Paso 4: Configurar Storage Buckets (3 min)

### 4.1 Verificar Buckets Creados

1. Ve a **Storage** en Supabase Dashboard
2. Deberías ver 3 buckets:

```
✅ patient-files (Private)
✅ quotes-pdf (Private)
✅ temp-uploads (Private)
```

### 4.2 Verificar Configuración de Buckets

**patient-files:**
- Public: ❌ No (Private)
- File size limit: 52,428,800 bytes (50MB)
- Allowed MIME types:
  - image/jpeg
  - image/png
  - image/gif
  - image/webp
  - application/pdf
  - application/msword
  - application/vnd.openxmlformats-officedocument.wordprocessingml.document
  - application/vnd.ms-excel
  - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

**quotes-pdf:**
- Public: ❌ No (Private)
- File size limit: 10,485,760 bytes (10MB)
- Allowed MIME types:
  - application/pdf

**temp-uploads:**
- Public: ❌ No (Private)
- File size limit: 20,971,520 bytes (20MB)
- Allowed MIME types: Todos

### 4.3 Verificar Políticas de Storage

1. Click en cualquier bucket (ej: `patient-files`)
2. Ve a la pestaña **Policies**
3. Deberías ver:

```
✅ Staff can upload patient files (INSERT)
✅ Staff can read patient files (SELECT)
✅ Staff can delete patient files (DELETE)
```

---

## 🔒 Paso 5: Habilitar Realtime (2 min)

### 5.1 Habilitar Realtime en Tablas

1. Ve a **Database** → **Replication** en Supabase Dashboard
2. Habilita Realtime para las siguientes tablas:

```
✅ leads
✅ appointments
✅ conversations
✅ messages
✅ patients
✅ clinical_history
✅ quotes
✅ notifications
```

3. Click en **Save** después de cada tabla

### 5.2 Verificar Realtime Activo

1. Ve a **Table Editor**
2. Click en una tabla (ej: `notifications`)
3. Deberías ver un ícono de "realtime" activo (⚡)

---

## 👥 Paso 6: Crear Usuarios de Prueba (5 min)

### 6.1 Verificar Seed Data

1. Ve a **Table Editor** → **staff_members**
2. Deberías ver 3 staff members ya creados:
   ```
   ✅ Alberto Estrella (Super Admin)
   ✅ María González (Receptionist)
   ✅ Dr. Carlos Ramírez (Dentist)
   ```

### 6.2 Crear Usuarios de Auth

⚠️ **Importante:** Los staff members ya existen en la tabla, pero necesitas crear sus cuentas de Auth en Supabase.

1. Ve a **Authentication** → **Users**
2. Click en **Invite User**
3. Crea los siguientes usuarios:

**Usuario 1 - Super Admin:**
```
Email: alberto.estrella@esva.mx
Password: [elige una contraseña segura]
```

**Usuario 2 - Receptionist:**
```
Email: maria.gonzalez@esva.mx
Password: [elige una contraseña segura]
```

**Usuario 3 - Dentist:**
```
Email: carlos.ramirez@esva.mx
Password: [elige una contraseña segura]
```

### 6.3 Asignar Roles

⚠️ **Importante:** Los roles ya están asignados en la tabla `user_roles` de la migración seed data. Solo necesitas verificar:

1. Ve a **Table Editor** → **user_roles**
2. Verifica que existen 3 registros con:
   - ESVA tenant_id
   - user_id correspondiente a cada staff member
   - role correcto (super_admin, receptionist, dentist)

---

## ✅ Paso 7: Verificación Final (3 min)

### Checklist de Verificación:

- [ ] ✅ 18 tablas creadas correctamente
- [ ] ✅ 3 storage buckets configurados
- [ ] ✅ RLS policies activas en todas las tablas nuevas
- [ ] ✅ Realtime habilitado en tablas requeridas
- [ ] ✅ Funciones de PostgreSQL creadas
- [ ] ✅ Views creadas
- [ ] ✅ Usuarios de prueba creados
- [ ] ✅ Roles asignados correctamente

### Probar Conexión:

1. Reinicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Abre el navegador en `http://localhost:3000`

3. Navega a `/dashboard/patients`

4. Deberías ver la página de pacientes (vacía, pero sin errores)

---

## 🐛 Troubleshooting

### Error: "relation does not exist"

**Causa:** Alguna migración no se ejecutó correctamente.

**Solución:**
1. Ve a **SQL Editor**
2. Ejecuta:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
   ```
3. Verifica que todas las tablas existan
4. Re-ejecuta la migración faltante

### Error: "duplicate key value violates unique constraint"

**Causa:** Estás intentando ejecutar una migración que ya fue ejecutada.

**Solución:**
- Esto es normal, simplemente continúa con la siguiente migración

### Error: "permission denied for table"

**Causa:** RLS policies no están configuradas correctamente.

**Solución:**
1. Verifica que las policies se crearon:
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```
2. Re-ejecuta la parte de RLS de la migración

### Error: "bucket already exists"

**Causa:** Los buckets ya fueron creados anteriormente.

**Solución:**
- Esto es normal, ignora este error y continúa

### Storage Policies no funcionan

**Causa:** Las políticas no se aplicaron correctamente.

**Solución:**
1. Ve a **Storage** → [bucket] → **Policies**
2. Elimina todas las políticas existentes
3. Re-ejecuta la sección de storage policies de la migración 007

---

## 📞 Soporte

Si encuentras algún error no cubierto aquí:

1. **Revisa los logs:**
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```

2. **Verifica la versión de PostgreSQL:**
   ```sql
   SELECT version();
   ```
   Debe ser: PostgreSQL 15.x o superior

3. **Consulta la documentación:**
   - [Supabase Docs](https://supabase.com/docs)
   - [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 🎉 ¡Setup Completo!

Si completaste todos los pasos, tu base de datos de TIS TIS Platform está lista para ser usada.

**Próximos pasos:**
1. ✅ Probar la creación de pacientes
2. ✅ Probar sistema de notificaciones
3. ✅ Subir archivos de prueba
4. ✅ Crear cotizaciones de ejemplo

---

**Última actualización:** 8 de Diciembre, 2024
**Versión:** 2.0.0
