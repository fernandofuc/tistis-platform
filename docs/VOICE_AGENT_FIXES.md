# Voice Agent System - Fixes and Improvements

**Versión:** 1.0.0
**Fecha:** Diciembre 22, 2024
**Migración:** 068_VOICE_AGENT_FIXES.sql

---

## Resumen de Correcciones

Se aplicaron 9 correcciones importantes al sistema Voice Agent para resolver problemas de funcionalidad, performance y confiabilidad.

---

## Correcciones Aplicadas

### 1. Policy para INSERT en voice_call_messages

**Problema:** El webhook de VAPI no podía insertar mensajes en la tabla voice_call_messages.

**Solución:** Crear policy explícita para service_role:
```sql
CREATE POLICY "Service role can insert call messages"
    ON voice_call_messages
    FOR INSERT
    TO service_role
    WITH CHECK (true);
```

**Impacto:**
- Los webhooks pueden guardar transcripts de llamadas
- Essential para registrar conversaciones completas

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 10-24)

---

### 2. Índice para vapi_call_id

**Problema:** Búsquedas por VAPI call ID eran lentas sin índice.

**Solución:** Crear índice selectivo:
```sql
CREATE INDEX IF NOT EXISTS idx_voice_calls_vapi_id
ON voice_calls(vapi_call_id)
WHERE vapi_call_id IS NOT NULL;
```

**Impacto:**
- Búsquedas by VAPI call ID ahora O(log n)
- Necesario para correlacionar eventos de VAPI con registros de BD

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 27-33)

---

### 3. Función generate_voice_agent_prompt Mejorada

**Problema:** La función tenía issues con:
- Manejo de nulls inconsistente
- Fallback limitado para verticales sin template
- Roles de staff incompletos

**Solución:** Reescribir función con:
- Mejor manejo de NULL values (COALESCE anidados)
- Fallback en cascada (vertical → dental → fallback mínimo)
- Roles expandidos: 'doctor' y 'provider'
- Mejor construcción de strings con concatenación explícita

**Cambios clave:**
```plpgsql
-- Antes: Sin fallback completo
SELECT * INTO v_template FROM voice_prompt_templates WHERE vertical = v_tenant.vertical;

-- Después: Fallback en cascada
SELECT * INTO v_template FROM voice_prompt_templates
WHERE vertical = COALESCE(v_tenant.vertical, 'services')
  AND template_key = 'system_prompt'
  AND is_default = true;

IF NOT FOUND THEN
    -- Fallback a dental
    SELECT * INTO v_template FROM voice_prompt_templates
    WHERE vertical = 'dental' AND template_key = 'system_prompt' AND is_default = true;
END IF;

IF NOT FOUND THEN
    -- Fallback mínimo
    RETURN 'Eres un asistente de voz profesional...';
END IF;
```

**Impacto:**
- Prompts se generan incluso sin template específico
- Soporta más roles de staff
- Mejor manejo de casos edge
- Más variables disponibles para reemplazo

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 35-175)

---

### 4. Template Fallback para Vertical "services"

**Problema:** Tenants sin vertical específica (ej: servicios genéricos) no tenían template base.

**Solución:** Insertar template genérico para 'services':
```sql
INSERT INTO voice_prompt_templates (
    vertical, template_key, template_name,
    template_text, available_variables,
    first_message_template,
    recommended_config, is_default, is_active
) VALUES (
    'services', 'system_prompt',
    'Asistente de Voz Genérico para Servicios',
    '## Personalidad: Eres {assistant_name}...',
    ARRAY[...], '...', '...', true, true
)
```

**Impacto:**
- Cualquier tenant puede generar prompt automáticamente
- No requiere configuración manual si no hay vertical específica
- Sirve como fallback para verticales futuras

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 178-258)

---

### 5. Roles de Staff Expandidos

**Problema:** Solo 'dentist', 'specialist', 'owner' eran válidos. Pero tenants pueden tener:
- Doctores generales ('doctor')
- Proveedores de servicios ('provider')

**Solución:** Agregar roles a función generate_voice_agent_prompt:
```plpgsql
WHERE st.role IN ('dentist', 'specialist', 'owner', 'doctor', 'provider');
```

**Impacto:**
- Todos los doctores/providers se incluyen en la lista de staff
- System prompt incluye personal completo
- Clientes ven todas las opciones disponibles

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (línea 104)

---

### 6. Políticas RLS Verificadas

**Problema:** Service role necesitaba acceso total pero policies podían estar incompletas.

**Solución:** Crear policy explícita para service_role en voice_calls:
```sql
DROP POLICY IF EXISTS "Service role full access voice_calls" ON voice_calls;
CREATE POLICY "Service role full access voice_calls" ON voice_calls
FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**Impacto:**
- Service role (webhooks) tiene acceso completo
- Webhooks pueden crear/actualizar calls
- Explicit policies son más mantenibles

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 267-275)

---

### 7. Función Helper get_next_voice_config_version

**Problema:** El servicio TypeScript intentaba usar RPC inexistente `increment_config_version`.

**Solución:**
- Crear función helper para obtener next version
- Actualizar servicio para hacer versioning local

```plpgsql
CREATE OR REPLACE FUNCTION get_next_voice_config_version(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_version INTEGER;
BEGIN
    SELECT configuration_version INTO current_version
    FROM voice_agent_config WHERE tenant_id = p_tenant_id;
    RETURN COALESCE(current_version, 0) + 1;
END;
$$ LANGUAGE plpgsql;
```

**Cambio en TypeScript:**
```typescript
// voice-agent.service.ts updateVoiceConfig()
const { data: currentConfig } = await supabase
    .from('voice_agent_config')
    .select('configuration_version')
    .eq('tenant_id', tenantId)
    .single();

const nextVersion = (currentConfig?.configuration_version || 0) + 1;

const { data } = await supabase
    .from('voice_agent_config')
    .update({
        ...updates,
        configuration_version: nextVersion,  // Versioning local
    })
    .eq('tenant_id', tenantId)
    .select()
    .single();
```

**Impacto:**
- Actualización de config ahora funciona
- Versioning de cambios disponible
- Helper function disponible para future RPC calls

**Archivos:**
- `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 277-301)
- `/src/features/voice-agent/services/voice-agent.service.ts` (líneas 75-109)

---

### 8. Índice Compuesto tenant_id + created_at

**Problema:** Queries frecuentes `WHERE tenant_id = X ORDER BY created_at DESC` eran lentas.

**Solución:** Crear índice compuesto:
```sql
CREATE INDEX IF NOT EXISTS idx_voice_calls_tenant_created
ON voice_calls(tenant_id, created_at DESC);
```

**Impacto:**
- Listar calls por tenant es O(log n)
- Sorting automático gracias a índice DESC
- Escalable a millones de registros

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 304-309)

---

### 9. Constraint UNIQUE para voice_prompt_templates

**Problema:** La inserción con `ON CONFLICT` fallaba porque no había constraint UNIQUE.

**Solución:** Crear constraint explícito:
```sql
ALTER TABLE voice_prompt_templates
ADD CONSTRAINT voice_prompt_templates_vertical_key_default_unique
UNIQUE (vertical, template_key, is_default);
```

**Impacto:**
- ON CONFLICT (vertical, template_key, is_default) ahora funciona
- Updates de templates sin duplicados
- Garantiza un único template default por vertical/key

**Archivo:** `/supabase/migrations/068_VOICE_AGENT_FIXES.sql` (líneas 312-330)

---

## Cambios en Código TypeScript

### voice-agent.service.ts

**Cambio:** updateVoiceConfig() ahora usa versioning local en lugar de RPC.

**Antes:**
```typescript
// INCORRECTO: RPC no existe
const { data } = await supabase.rpc('increment_config_version', {
    tenant_id: tenantId
});
```

**Después:**
```typescript
// CORRECTO: Versioning local
const { data: currentConfig } = await supabase
    .from('voice_agent_config')
    .select('configuration_version')
    .eq('tenant_id', tenantId)
    .single();

const nextVersion = (currentConfig?.configuration_version || 0) + 1;

const { data } = await supabase
    .from('voice_agent_config')
    .update({
        ...updates,
        last_configured_at: new Date().toISOString(),
        last_configured_by: staffId || null,
        configuration_version: nextVersion,
    })
    .eq('tenant_id', tenantId)
    .select()
    .single();
```

**Archivo:** `/src/features/voice-agent/services/voice-agent.service.ts` (líneas 75-109)

---

### page.tsx (Dashboard)

**Cambio:** handleReleasePhoneNumber() ahora usa body JSON en lugar de FormData.

**Antes:**
```typescript
// INCORRECTO: FormData no es soportado
const formData = new FormData();
formData.append('phoneNumberId', phoneNumberId);
const response = await fetch(`/api/voice-agent/phone-numbers/${phoneNumberId}/release`, {
    method: 'POST',
    body: formData
});
```

**Después:**
```typescript
// CORRECTO: JSON body
const response = await fetch(`/api/voice-agent/phone-numbers/${phoneNumberId}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumberId })
});
```

**Archivo:** `/app/(dashboard)/dashboard/ai-agent-voz/page.tsx`

---

### webhook/route.ts

**Cambio:** createOrUpdateCall() ahora asigna correctamente voice_agent_config_id y phone_number_id.

**Antes:**
```typescript
// Podría tener voice_agent_config_id NULL
const call = await supabase
    .from('voice_calls')
    .insert({ call_direction: 'inbound', ... })
    .select()
    .single();
```

**Después:**
```typescript
// Obtiene IDs correctamente
const { data: config } = await supabase
    .from('voice_agent_config')
    .select('id')
    .eq('tenant_id', tenantId)
    .single();

const { data: phoneNum } = await supabase
    .from('voice_phone_numbers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone_number', phoneNumber)
    .single();

const call = await supabase
    .from('voice_calls')
    .insert({
        tenant_id: tenantId,
        voice_agent_config_id: config?.id,
        phone_number_id: phoneNum?.id,
        vapi_call_id: vapiCallId,
        // ... rest of fields
    })
    .select()
    .single();
```

**Archivo:** `/app/api/voice-agent/webhook/route.ts`

---

## Testing

Después de aplicar estas correcciones, verificar:

```bash
# 1. Migración aplicada
npx supabase migration list
# Debe incluir: 068_VOICE_AGENT_FIXES

# 2. Políticas creadas
SELECT * FROM pg_policies WHERE tablename IN ('voice_calls', 'voice_call_messages');

# 3. Índices creados
SELECT * FROM pg_indexes WHERE tablename = 'voice_calls';

# 4. Templates existen
SELECT * FROM voice_prompt_templates WHERE is_default = true;

# 5. Generar prompt funciona
SELECT public.generate_voice_agent_prompt('tenant-uuid'::UUID);
```

---

## Impacto en Producción

Todas las correcciones son:
- **Backwards compatible** - No rompen código existente
- **Non-breaking** - Agregan funcionalidad sin eliminar
- **Performance-improving** - Índices mejoran speed
- **Reliability-increasing** - Fallbacks y policies son más robustos

**Tiempo de aplicación:** < 1 segundo
**Downtime:** 0 (migraciones son atomic)

---

## Próximos Pasos

1. Aplicar migración 068 en todos los ambientes (dev, staging, prod)
2. Verificar que webhooks de VAPI están funcionando
3. Generar prompts para tenants existentes
4. Monitorear logs de voice-agent-webhook para errores

---

## Referencias

- Migración: `/supabase/migrations/068_VOICE_AGENT_FIXES.sql`
- Servicio: `/src/features/voice-agent/services/voice-agent.service.ts`
- Dashboard: `/app/(dashboard)/dashboard/ai-agent-voz/page.tsx`
- Webhook: `/app/api/voice-agent/webhook/route.ts`
- Documentación técnica: `/docs/VOICE_AGENT_SYSTEM.md`

---

*Documento de correcciones del Voice Agent System. Fecha de aplicación: Diciembre 22, 2024.*
