# FASE 01: Base de Datos Voice Agent v2.0

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 01 |
| **Nombre** | Base de Datos |
| **Sprint** | 1 - Fundamentos |
| **Duracion Estimada** | 1-2 dias |
| **Dependencias** | Ninguna |
| **Documento Referencia** | `05-MODELO-DATOS.md` |

---

## Objetivo

Crear la nueva estructura de base de datos para Voice Agent v2.0, incluyendo todas las tablas, funciones SQL, politicas RLS y seed data necesarios.

---

## Microfases

### MICROFASE 1.1: Crear Tabla voice_assistant_types

**Archivo a crear:** `supabase/migrations/[timestamp]_voice_assistant_types.sql`

**Que hacer:**
1. Crear tabla `voice_assistant_types` con campos:
   - id, name, display_name, description, vertical
   - enabled_capabilities (JSONB)
   - available_tools (JSONB)
   - default_voice_id, default_personality
   - prompt_template_name, template_version
   - max_call_duration_seconds
   - is_active, created_at, updated_at

2. Crear indice por vertical
3. Agregar RLS policy

**Verificacion:**
- [ ] Tabla creada sin errores
- [ ] Indice creado
- [ ] RLS habilitado

---

### MICROFASE 1.2: Crear Tabla voice_catalog

**Archivo a crear:** `supabase/migrations/[timestamp]_voice_catalog.sql`

**Que hacer:**
1. Crear tabla `voice_catalog` con campos:
   - id, provider, voice_id, name, display_name
   - gender, accent, language
   - personality_tags (JSONB)
   - preview_url
   - cost_per_minute
   - is_active, created_at

2. Crear indices por provider y language

**Verificacion:**
- [ ] Tabla creada sin errores
- [ ] Indices creados

---

### MICROFASE 1.3: Crear Tabla voice_assistant_configs

**Archivo a crear:** `supabase/migrations/[timestamp]_voice_assistant_configs.sql`

**Que hacer:**
1. Crear tabla `voice_assistant_configs` con campos:
   - id, business_id (FK), assistant_type_id (FK)
   - vapi_assistant_id, phone_number_id, phone_number
   - voice_id (FK to voice_catalog)
   - voice_speed, personality_type
   - special_instructions
   - enabled_capabilities (JSONB override)
   - template_version
   - is_active, created_at, updated_at

2. Crear indices por business_id y phone_number
3. Agregar RLS policies (tenant isolation)
4. Crear constraint UNIQUE en phone_number

**Verificacion:**
- [ ] Tabla creada sin errores
- [ ] Foreign keys funcionan
- [ ] RLS policies aplicadas
- [ ] Constraint UNIQUE funciona

---

### MICROFASE 1.4: Crear Tabla voice_assistant_metrics

**Archivo a crear:** `supabase/migrations/[timestamp]_voice_assistant_metrics.sql`

**Que hacer:**
1. Crear tabla `voice_assistant_metrics` con campos:
   - id, business_id (FK), config_id (FK)
   - period_start, period_end
   - total_calls, successful_calls, failed_calls
   - avg_duration_seconds
   - avg_latency_ms, p50_latency_ms, p95_latency_ms
   - reservations_created, appointments_created, orders_created
   - human_transfers
   - created_at

2. Crear indice por business_id y periodo
3. Agregar RLS policies

**Verificacion:**
- [ ] Tabla creada sin errores
- [ ] Indices creados
- [ ] RLS policies aplicadas

---

### MICROFASE 1.5: Crear Tabla voice_circuit_breaker_state

**Archivo a crear:** `supabase/migrations/[timestamp]_voice_circuit_breaker_state.sql`

**Que hacer:**
1. Crear tabla `voice_circuit_breaker_state` con campos:
   - id, business_id (FK)
   - state (ENUM: 'CLOSED', 'OPEN', 'HALF_OPEN')
   - failure_count
   - last_failure_time, last_success_time
   - updated_at

2. Crear indice por business_id
3. Crear constraint CHECK para state values

**Verificacion:**
- [ ] Tabla creada sin errores
- [ ] Constraint CHECK funciona
- [ ] Default state es 'CLOSED'

---

### MICROFASE 1.6: Crear Funciones SQL Helper

**Archivo a crear:** `supabase/migrations/[timestamp]_voice_functions.sql`

**Que hacer:**
1. Crear funcion `get_voice_config_for_call(phone_number TEXT)`
   - Busca config por numero de telefono
   - Hace JOIN con tipos y voces
   - Retorna config completa

2. Crear funcion `update_circuit_breaker_state(business_id UUID, new_state TEXT, failure_count INT)`
   - Actualiza estado del circuit breaker
   - Maneja transiciones de estado

3. Crear funcion `aggregate_voice_metrics(business_id UUID, start_date TIMESTAMP, end_date TIMESTAMP)`
   - Calcula metricas agregadas de voice_calls
   - Retorna estadisticas

**Verificacion:**
- [ ] Funciones creadas sin errores
- [ ] Funciones retornan datos correctos
- [ ] Performance < 50ms

---

### MICROFASE 1.7: Seed Data - Tipos de Asistente

**Archivo a crear:** `supabase/seed.sql` o migration

**Que hacer:**
1. Insertar 6 tipos de asistente:

**Restaurant:**
- `rest_basic` - Solo reservaciones
- `rest_standard` - Reservaciones + Pedidos
- `rest_complete` - Completo con FAQ

**Dental:**
- `dental_basic` - Solo citas
- `dental_standard` - Citas + Servicios
- `dental_complete` - Completo con transferencia

2. Cada tipo debe tener:
   - Capabilities correctas
   - Tools disponibles
   - Template name

**Verificacion:**
- [ ] 6 tipos insertados
- [ ] Capabilities correctas por tipo
- [ ] Tools correctos por tipo

---

### MICROFASE 1.8: Seed Data - Catalogo de Voces

**Archivo a crear:** Mismo archivo de seed o migration separada

**Que hacer:**
1. Insertar voces de ElevenLabs:
   - Maria (female, mexicano, calida)
   - Sofia (female, mexicano, energetica)
   - Carlos (male, mexicano, profesional)

2. Insertar voces de Azure (opcional):
   - Ana (female, neutro, calmada)

3. Cada voz debe tener:
   - Provider correcto
   - Preview URL
   - Personality tags

**Verificacion:**
- [ ] Voces insertadas
- [ ] Provider correcto
- [ ] URLs de preview validas

---

### MICROFASE 1.9: Verificacion Final de Base de Datos

**Que hacer:**
1. Ejecutar todas las migraciones en orden
2. Verificar que todas las tablas existen
3. Verificar foreign keys
4. Verificar RLS policies
5. Probar funciones SQL
6. Verificar seed data

**Verificacion:**
- [ ] Todas las migraciones ejecutan sin error
- [ ] Todas las tablas tienen datos de seed
- [ ] Foreign keys funcionan correctamente
- [ ] RLS bloquea acceso entre tenants
- [ ] Funciones retornan datos correctos

---

## Archivos a Crear/Modificar

```
supabase/
├── migrations/
│   ├── [timestamp]_voice_assistant_types.sql
│   ├── [timestamp]_voice_catalog.sql
│   ├── [timestamp]_voice_assistant_configs.sql
│   ├── [timestamp]_voice_assistant_metrics.sql
│   ├── [timestamp]_voice_circuit_breaker_state.sql
│   └── [timestamp]_voice_functions.sql
└── seed.sql (agregar voice agent seed data)
```

---

## Criterios de Exito

- [ ] Todas las 5 tablas creadas
- [ ] Todas las funciones SQL creadas
- [ ] Seed data insertado (6 tipos + 4 voces)
- [ ] RLS policies funcionando
- [ ] Foreign keys validados
- [ ] Migracion reversible (con rollback)

---

## Notas Importantes

1. **Usar timestamps para migraciones** - Formato: `20240120120000`
2. **No borrar tabla antigua** - `voice_agent_config` se mantiene hasta migracion completa
3. **Probar en local primero** - Antes de aplicar a staging/prod
4. **Crear backup** - Antes de cualquier migracion en prod
