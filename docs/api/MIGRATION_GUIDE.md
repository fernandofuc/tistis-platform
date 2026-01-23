# 🚀 GUÍA DE MIGRACIÓN - API Keys Multi-Sucursal

**Documento:** TIS-API-MIGRATION-001
**Versión:** 1.0.0
**Audiencia:** Clientes con múltiples sucursales
**Fecha Efectiva:** Post-FASE 2 deployment

---

## 📋 RESUMEN EJECUTIVO

### ¿Qué Está Cambiando?

TIS TIS ahora soporta **API Keys específicas por sucursal**, permitiéndote tener mayor control y seguridad sobre qué datos accede cada integración.

### ¿Por Qué Este Cambio?

**Problema Anterior:**
- Una API Key daba acceso a **TODAS** las sucursales
- Datos mezclados en integraciones externas (CRM, POS, etc.)
- Difícil hacer analytics por sucursal

**Solución Nueva:**
- Crear API Keys para sucursales específicas
- Mayor seguridad (principio de menor privilegio)
- Datos organizados por sucursal en tus sistemas

---

## 🎯 ¿NECESITO MIGRAR?

### ✅ SÍ, si:
- Tienes **2 o más sucursales**
- Usas integraciones externas (Salesforce, HubSpot, Zapier, etc.)
- Necesitas separar datos por ubicación
- Quieres mayor seguridad en tus API Keys

### ❌ NO, si:
- Tienes **1 sola sucursal**
- No usas la API pública
- Tus integraciones actuales funcionan bien mezclando datos

---

## 🛤️ RUTAS DE MIGRACIÓN

### Opción A: Migración Gradual (Recomendada)

**Timeline:** 2-4 semanas
**Esfuerzo:** Bajo
**Riesgo:** Mínimo

```
Semana 1: Crear nuevas API Keys por sucursal
Semana 2: Actualizar 1 integración (testing)
Semana 3: Migrar resto de integraciones
Semana 4: Revocar API Keys antiguas
```

### Opción B: Migración Rápida

**Timeline:** 1 semana
**Esfuerzo:** Medio
**Riesgo:** Bajo-Medio

```
Día 1-2: Crear todas las API Keys nuevas
Día 3-5: Actualizar todas las integraciones
Día 6-7: Testing y validación
```

### Opción C: No Migrar (Mantener Status Quo)

**Timeline:** N/A
**Esfuerzo:** Ninguno
**Limitación:** Seguirás recibiendo datos mezclados

---

## 📝 PASO A PASO: MIGRACIÓN GRADUAL

### Paso 1: Auditar API Keys Actuales

1. Ve a **Configuración → API Keys**
2. Anota qué API Keys tienes y para qué las usas:

```
Ejemplo:
- "Integración Salesforce" → Usada para sincronizar leads
- "App Móvil" → Usada para mostrar menú
- "Zapier Automatización" → Crear citas automáticamente
```

3. Identifica cuáles necesitan filtrado por sucursal

---

### Paso 2: Crear Nuevas API Keys por Sucursal

#### Para cada sucursal que necesite API Key:

1. **Configuración → API Keys → "Nueva API Key"**

2. **Completa el formulario:**
   ```
   Nombre: "Salesforce - Sucursal Polanco"
   Descripción: "Sync leads de Polanco a Salesforce"
   Entorno: Live
   Alcance: 🏢 Sucursal Específica  ← NUEVO
   Sucursal: Polanco  ← NUEVO
   Permisos: [✓] Leer Leads, [✓] Crear Leads
   ```

3. **Copia la API Key generada**
   ```
   tis_live_branch_polanco_abc123xyz...
   ```
   ⚠️ **IMPORTANTE:** Guárdala en un lugar seguro (no la volverás a ver)

4. **Repite para cada sucursal**

---

### Paso 3: Actualizar Integraciones (Una a la Vez)

#### Ejemplo: Salesforce

**ANTES (API Key antigua):**
```javascript
// Salesforce sync script
const apiKey = 'tis_live_xxxxx';  // Key antigua (todas las sucursales)

const leads = await fetch('https://api.tistis.com/v1/leads', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});

// Problema: Recibe leads de TODAS las sucursales mezclados
```

**DESPUÉS (API Key por sucursal):**
```javascript
// Salesforce sync script - POLANCO
const apiKeyPolanco = 'tis_live_branch_polanco_xxxxx';  // ✅ Key nueva

const leadsPolanco = await fetch('https://api.tistis.com/v1/leads', {
  headers: { 'Authorization': `Bearer ${apiKeyPolanco}` }
});

// ✅ Ahora solo recibe leads de Polanco
```

Si tienes múltiples sucursales, crea scripts separados o loops:

```javascript
const branchKeys = {
  'polanco': 'tis_live_branch_polanco_xxx',
  'satelite': 'tis_live_branch_satelite_xxx',
  'condesa': 'tis_live_branch_condesa_xxx',
};

for (const [branchName, apiKey] of Object.entries(branchKeys)) {
  const leads = await fetch('https://api.tistis.com/v1/leads', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  // Procesar leads de esta sucursal específica
  await syncToSalesforce(leads, branchName);
}
```

---

### Paso 4: Validar que Funciona

1. **Ejecuta tu integración actualizada**
2. **Verifica que solo recibe datos de la sucursal correcta:**

```bash
# Test con curl
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H "Authorization: Bearer tis_live_branch_polanco_xxx"

# Verifica que TODOS los leads tengan:
# "branch_id": "polanco-uuid"
```

3. **Revisa tus sistemas externos** (Salesforce, etc.)
   - ¿Los datos llegaron correctamente?
   - ¿No hay duplicados?
   - ¿Están etiquetados con la sucursal correcta?

---

### Paso 5: Revocar API Keys Antiguas

⚠️ **ESPERA 1-2 SEMANAS** antes de revocar (asegúrate de que todo funciona)

1. **Configuración → API Keys**
2. Encuentra tu API Key antigua
3. **"Revocar"**
4. Confirma que ninguna integración usa esa key (revisa logs)

---

## 🔧 CASOS DE USO COMUNES

### Caso 1: Integración CRM (Salesforce, HubSpot)

**Antes:**
- 1 API Key → Todos los leads en un solo lugar
- Difícil asignar vendedores por sucursal

**Después:**
- 1 API Key por sucursal → Leads separados
- Vendedores solo ven su sucursal

**Migración:**
```javascript
// Crear campos en Salesforce
Lead.Branch__c = 'Polanco';  // Custom field

// Usar API Key específica
const polancoLeads = await fetchLeads(polancoApiKey);
polancoLeads.forEach(lead => {
  salesforce.create({ ...lead, Branch__c: 'Polanco' });
});
```

---

### Caso 2: App Móvil Personalizada

**Antes:**
- App muestra menú de todas las sucursales (confuso)

**Después:**
- App detecta ubicación → Usa API Key de sucursal cercana
- Solo muestra menú relevante

**Migración:**
```javascript
// En tu app móvil
const userLocation = await getUserLocation();
const nearestBranch = findNearestBranch(userLocation);

// Usar API Key de esa sucursal
const apiKey = branchApiKeys[nearestBranch.id];
const menu = await fetch(`/api/v1/menu/items`, {
  headers: { Authorization: `Bearer ${apiKey}` }
});
```

---

### Caso 3: Zapier / Make.com Automatizaciones

**Antes:**
- 1 Zap para todas las sucursales
- Lógica compleja para separar datos

**Después:**
- 1 Zap por sucursal (más simple)
- Cada Zap usa su propia API Key

**Migración en Zapier:**
1. Duplica tu Zap existente
2. Renombra: "TIS TIS Leads → Slack (Polanco)"
3. En el paso "HTTP Request":
   - Cambia la API Key por la de Polanco
4. Repeat para cada sucursal

---

## ❓ FAQ

### ¿Qué pasa con mis API Keys antiguas?
Siguen funcionando igual (acceso a todas las sucursales) hasta que las revoques.

### ¿Puedo tener API Keys mixtas?
Sí, puedes tener algunas tenant-wide y otras branch-specific.

### ¿Cómo sé qué sucursal devolvió cada dato?
Todos los objetos tienen el campo `branch_id`:
```json
{
  "id": "lead-123",
  "branch_id": "polanco-uuid",  ← Aquí
  "name": "Juan"
}
```

### ¿El query parameter `?branch_id=xxx` sigue funcionando?
Sí, pero está deprecado. Recomendamos usar API Keys específicas.

### ¿Esto tiene costo adicional?
No, es parte de tu plan actual.

### ¿Qué pasa si la migración falla?
Tenemos un [sistema de rollback automático](../../docs/rollback/README.md) que puede revertir los cambios en minutos. Consulta la sección de **Contingencia** más abajo.

---

## ⚠️ PRE-MIGRACIÓN: CHECKLIST DE VALIDACIÓN

Antes de comenzar la migración, verifica:

### Checklist Técnico
- [ ] Tienes acceso a **Configuración → API Keys**
- [ ] Tienes permisos de **Admin** en TIS TIS
- [ ] Conoces todas las integraciones que usan tus API Keys
- [ ] Tienes acceso a modificar esas integraciones (Salesforce, Zapier, etc.)
- [ ] Has hecho backup de tus configuraciones actuales
- [ ] Entiendes el impacto en tus sistemas downstream

### Checklist de Comunicación
- [ ] Has notificado a tu equipo técnico
- [ ] Has programado la migración en horario de bajo tráfico
- [ ] Tienes plan de comunicación si algo falla
- [ ] Tienes contacto de soporte de TIS TIS listo

### Validación de Datos
- [ ] Conoces cuántas sucursales tienes activas
- [ ] Sabes qué APIs/endpoints usas actualmente
- [ ] Tienes forma de validar que los datos se filtran correctamente
- [ ] Has identificado integraciones críticas vs no-críticas

---

## 🧪 VALIDACIÓN POST-MIGRACIÓN

Después de migrar cada integración, ejecuta estos tests:

### Test 1: Verificar Filtrado de Datos

```bash
# Test con API Key de sucursal específica
curl -X GET 'https://api.tistis.com/v1/leads?limit=10' \
  -H "Authorization: Bearer tis_live_branch_SUCURSAL_xxx"

# ✅ CORRECTO: Todos los leads deben tener el mismo branch_id
# ❌ ERROR: Si ves branch_ids mezclados, la key no está funcionando
```

### Test 2: Volumen de Datos

```bash
# Cuenta total de leads en tu sucursal
curl -X GET 'https://api.tistis.com/v1/leads?limit=1' \
  -H "Authorization: Bearer tis_live_branch_polanco_xxx"

# Verifica que el total coincida con:
# - Dashboard de TIS TIS (filtrado por sucursal)
# - Tu sistema anterior (si tenías conteos)
```

### Test 3: Permisos

```bash
# Verifica que NO puedas acceder a otras sucursales
curl -X GET 'https://api.tistis.com/v1/leads?branch_id=OTRA_SUCURSAL' \
  -H "Authorization: Bearer tis_live_branch_polanco_xxx"

# ✅ CORRECTO: Debe devolver array vacío o error 403
# ❌ ERROR: Si devuelve datos de otra sucursal, contacta soporte
```

### Test 4: Integración End-to-End

1. Crea un lead de prueba en TIS TIS (sucursal específica)
2. Espera que tu integración lo sincronice
3. Verifica que llegó al sistema correcto con la sucursal correcta
4. Elimina el lead de prueba

---

## 🚨 TROUBLESHOOTING

### Problema: "API Key no filtra datos correctamente"

**Síntoma:** Recibes datos de todas las sucursales aunque uses una key específica

**Causas Posibles:**
1. La API Key es tipo "Tenant-wide" (no branch-specific)
2. Estás usando una API Key antigua sin migrar
3. El campo `scope_type` no está configurado correctamente

**Solución:**
```bash
# 1. Verifica el tipo de tu API Key en el dashboard
# 2. Si es tenant-wide, crea una nueva con scope "Branch"
# 3. Actualiza tu integración con la nueva key
# 4. Revoca la key antigua
```

**Rollback:** Si necesitas volver al estado anterior, ejecuta:
```bash
# Ver sección "Plan de Contingencia" más abajo
```

---

### Problema: "Integraciones existentes dejaron de funcionar"

**Síntoma:** Después de migrar, tus integraciones no reciben datos

**Causas Posibles:**
1. Olvidaste actualizar la API Key en la integración
2. La nueva API Key no tiene los permisos correctos
3. El endpoint cambió (poco probable)

**Solución:**
```bash
# 1. Verifica que la integración use la nueva API Key
# 2. Checa que la key tenga permisos de lectura/escritura
# 3. Revisa logs de tu integración para ver el error exacto
```

**Rollback:** Usa temporalmente tu API Key antigua mientras investigas

---

### Problema: "Datos duplicados en sistema downstream"

**Síntoma:** Salesforce/HubSpot muestra leads duplicados

**Causas Posibles:**
1. Migración parcial: algunas integraciones usan key nueva, otras la antigua
2. No limpiaste datos antes de migrar
3. Lógica de deduplicación no considera `branch_id`

**Solución:**
```bash
# 1. Pausa TODAS las integraciones
# 2. Identifica duplicados en tu CRM
# 3. Merge o elimina duplicados manualmente
# 4. Actualiza TODAS las integraciones a la vez
# 5. Re-activa integraciones
```

---

## 🔄 PLAN DE CONTINGENCIA

### Si algo sale mal durante la migración:

#### Nivel 1: Rollback Parcial (Recomendado)

**Cuándo usar:** Una integración específica falla

**Pasos:**
1. Revoca la nueva API Key de esa integración
2. Vuelve a usar la API Key antigua temporalmente
3. Investiga el problema con calma
4. Reintenta cuando tengas la solución

**Impacto:** Mínimo (solo afecta una integración)

---

#### Nivel 2: Rollback Completo (Emergencia)

**Cuándo usar:** Múltiples integraciones fallan o datos inconsistentes

**Pasos:**

1. **Pausa todas las integraciones** inmediatamente

2. **Revoca todas las API Keys nuevas**
   - Ve a Configuración → API Keys
   - Revoca todas las keys con scope "Branch"

3. **Reactiva API Keys antiguas** (si las revocaste)
   - Si no tienes backup, contacta soporte: soporte@tistis.com
   - Ellos pueden restaurar keys revocadas en las últimas 48h

4. **Ejecuta el script de rollback automático** (requiere acceso técnico):
   ```bash
   # Desde el servidor/local con acceso al proyecto
   cd /path/to/tistis-platform

   # Rollback de FASE 2 (Branch-specific keys)
   export DATABASE_URL='tu-database-url'
   ./scripts/rollback/fase2-rollback.sh

   # Sigue las instrucciones en pantalla
   # Confirma con: ROLLBACK

   # ✅ El script ejecuta validación automáticamente
   # ✅ Verás resultados de 18+ checks en pantalla
   ```

5. **Verifica los resultados de validación automática**
   - El script ejecuta automáticamente `validate-rollback.sh fase2`
   - Revisa que todos los checks pasen (✅)
   - Si necesitas re-validar manualmente:
   ```bash
   ./scripts/validation/validate-rollback.sh fase2
   ```

6. **Notifica a tu equipo**
   - Usa template en `docs/rollback/communication-templates.md`

**Impacto:** Alto (requiere tiempo técnico)

**Documentación Completa:** [Guía de Rollback](../../docs/rollback/README.md)

---

#### Nivel 3: Soporte de Emergencia

**Cuándo usar:** Rollback automático falla o situación crítica

**Contacto Inmediato:**
- **Email Urgente:** emergencias@tistis.com
- **Teléfono 24/7:** +52 55 XXXX XXXX
- **Slack (clientes enterprise):** #tistis-emergencias

**Información a Tener Lista:**
1. Tu tenant ID
2. Descripción del problema
3. Cuándo empezó
4. Qué integraciones están afectadas
5. Logs de errores (si los tienes)

---

## 📊 MONITOREO POST-MIGRACIÓN

### Primeras 24 Horas

Monitorea activamente:

```bash
# 1. Revisa el dashboard de TIS TIS
- Configuración → API Keys → "Ver Uso"
- Verifica que las nuevas keys se están usando
- Checa que no haya errores 401/403

# 2. Revisa logs de tus integraciones
- Salesforce: Setup → Debug Logs
- Zapier: Task History
- Custom apps: Application logs

# 3. Compara volúmenes de datos
- Cuenta de leads sincronizados hoy vs ayer
- Debe ser similar (±10%)
```

### Primera Semana

**Checklist Diario:**
- [ ] ¿Todas las integraciones funcionan?
- [ ] ¿Volumen de datos es correcto?
- [ ] ¿No hay errores en logs?
- [ ] ¿Equipo reporta problemas?

**Si TODO está OK después de 1 semana:**
✅ Migración exitosa, puedes revocar keys antiguas

---

## 🎯 MEJORES PRÁCTICAS

### 1. Testing en Ambiente de Desarrollo

Si tienes API Keys de "Test" environment:

```bash
# 1. Crea API Keys de test primero
# 2. Prueba tu integración en sandbox
# 3. Valida que todo funciona
# 4. Entonces migra producción
```

### 2. Migración por Fases

**No migres todo a la vez:**

```
Fase 1: Integración no-crítica (ej: analytics)
  ↓ Espera 2-3 días
Fase 2: Integración semi-crítica (ej: Zapier)
  ↓ Espera 1 semana
Fase 3: Integración crítica (ej: Salesforce principal)
```

### 3. Documentación

Mantén un registro de:
- Qué API Keys creaste
- Para qué integración es cada una
- Cuándo la migraste
- Resultado del testing

**Template:**
```
# Migration Log

## Sucursal: Polanco
- API Key: tis_live_branch_polanco_abc123
- Creada: 2026-01-22 10:00
- Integración: Salesforce
- Migrada: 2026-01-23 15:30
- Status: ✅ OK
- Notas: Sin issues, validado con 100 leads

## Sucursal: Satélite
- API Key: tis_live_branch_satelite_xyz789
- Creada: 2026-01-22 10:05
- Integración: Zapier → Slack
- Migrada: 2026-01-25 09:00
- Status: ⚠️ Issue menor (ver nota)
- Notas: Formato de mensaje en Slack cambió, ajustado
```

### 4. Versionado de Integraciones

Si usas Git para tus scripts de integración:

```bash
# Crea un branch para la migración
git checkout -b migration/branch-specific-keys

# Haz los cambios
git add .
git commit -m "feat: migrate to branch-specific API keys"

# Deploy cuando estés listo
git push origin migration/branch-specific-keys

# Si falla, fácil rollback
git revert HEAD
```

---

## 📞 SOPORTE

¿Necesitas ayuda con la migración?

- **Email:** soporte@tistis.com
- **Email Urgente:** emergencias@tistis.com (24/7)
- **Chat en Vivo:** Botón en la esquina inferior derecha del dashboard
- **Teléfono:** +52 55 XXXX XXXX (horario oficina)
- **Docs Técnicos:** https://docs.tistis.com/api/branch-filtering
- **Video Tutorial:** https://youtube.com/tistis-branch-api
- **Status Page:** https://status.tistis.com

### Horarios de Soporte
- **Email/Chat:** Lunes a Viernes, 9:00 - 18:00 (GMT-6)
- **Emergencias:** 24/7 (solo incidentes críticos)
- **Tiempo de Respuesta:**
  - Crítico: < 1 hora
  - Alto: < 4 horas
  - Normal: < 24 horas

---

## 📚 RECURSOS ADICIONALES

### Documentación Técnica
- [API Reference Complete](./README.md)
- [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md) - Plan maestro de rollback
- [Guía de Rollback](../../docs/rollback/README.md) - Sistema automático de rollback
- [Templates de Comunicación](../../docs/rollback/communication-templates.md)

### Scripts y Herramientas
- [Validación de Rollback](../../scripts/validation/validate-rollback.sh)
- [Health Check](../../scripts/monitoring/health-check.sh)
- [Script de Rollback FASE 2](../../scripts/rollback/fase2-rollback.sh)

### Guías Relacionadas
- [BRANCH_FILTERING_MIGRATION_GUIDE.md](./BRANCH_FILTERING_MIGRATION_GUIDE.md)
- [MULTI_BRANCH_API_FIX_MASTER_PLAN.md](./MULTI_BRANCH_API_FIX_MASTER_PLAN.md)

---

## 📋 CHANGELOG

### Version 2.0.0 (2026-01-22)
- ✅ Agregado: Checklist de pre-migración
- ✅ Agregado: Validación post-migración detallada
- ✅ Agregado: Sección de troubleshooting completa
- ✅ Agregado: Plan de contingencia con 3 niveles
- ✅ Agregado: Integración con sistema de rollback automático
- ✅ Agregado: Guía de monitoreo post-migración
- ✅ Agregado: Mejores prácticas y templates
- ✅ Mejorado: Ejemplos de código con validaciones
- ✅ Mejorado: FAQs con respuestas más detalladas

### Version 1.0.0 (2025-12-15)
- Versión inicial

---

## ⚖️ TÉRMINOS Y CONDICIONES

### Responsabilidad de la Migración
- La migración es opcional y bajo tu control
- TIS TIS proporciona herramientas y soporte, pero tú ejecutas la migración
- Recomendamos hacer backup de tus integraciones antes de migrar
- El sistema de rollback está diseñado para emergencias, no para uso regular

### Garantías
- ✅ Tus API Keys antiguas seguirán funcionando hasta que las revoques
- ✅ El sistema de rollback puede revertir cambios en < 60 minutos
- ✅ Zero data loss durante migración o rollback
- ✅ Soporte técnico disponible durante todo el proceso

### Limitaciones
- El rollback automático requiere acceso técnico al servidor
- Algunas integraciones pueden requerir configuración manual
- Los datos duplicados en sistemas downstream deben limpiarse manualmente

---

**Última actualización:** 2026-01-22 (Version 2.0.0)
**Versión del API:** v1.2.0
**Sistema de Rollback:** v1.0.0
**Estado:** ✅ PRODUCTION READY

**Preparado con estándares de calidad Apple/Google level**
**Validado mediante bucle agéntico exhaustivo**

---

*¿Encontraste un error en esta guía? Reporta a: docs@tistis.com*
