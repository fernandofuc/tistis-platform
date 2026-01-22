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

---

## 📞 SOPORTE

¿Necesitas ayuda con la migración?

- **Email:** soporte@tistis.com
- **Chat:** Botón en la esquina inferior derecha
- **Docs:** https://docs.tistis.com/api/branch-filtering
- **Video Tutorial:** https://youtube.com/tistis-branch-api

---

**Última actualización:** 2026-01-22
**Versión del API:** v1.2.0
