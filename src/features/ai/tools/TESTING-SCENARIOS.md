# Tool Calling System - Test Scenarios

Este documento contiene escenarios hipotéticos para probar el sistema de Tool Calling en ambas verticales.

---

## VERTICAL: DENTAL

### Escenario D1: Consulta de precio simple
**Input del cliente:**
```
"Hola, cuánto cuesta una limpieza dental?"
```

**Expected Tool Calls:**
1. `get_service_info({ service_name: "limpieza" })`

**Expected Response:**
- Precio exacto del servicio
- Duración estimada
- Mención de promoción si existe

---

### Escenario D2: Consulta múltiple
**Input del cliente:**
```
"Quiero saber los precios de brackets y blanqueamiento"
```

**Expected Tool Calls:**
1. `get_service_info({ service_name: "brackets" })`
2. `get_service_info({ service_name: "blanqueamiento" })`

**Expected Response:**
- Precios de ambos servicios
- Comparación si aplica
- Sugerencia de agendar cita

---

### Escenario D3: Agendar cita
**Input del cliente:**
```
"Quiero una cita para el viernes a las 10am para una limpieza"
```

**Expected Tool Calls:**
1. `get_available_slots({ date: "YYYY-MM-DD" })` (próximo viernes)
2. `get_service_info({ service_name: "limpieza" })`
3. `create_appointment({ date: "...", time: "10:00", service_id: "..." })`

**Expected Response:**
- Confirmación de la cita
- Dirección de la sucursal
- Recordatorio de llegar 15 min antes

---

### Escenario D4: Urgencia dental
**Input del cliente:**
```
"Me duele mucho una muela, necesito que me atiendan hoy"
```

**Expected Tool Calls:**
1. `get_available_slots({ date: "HOY" })`
2. `get_branch_info({})` (para teléfono de emergencia)

**Expected Response:**
- Empatía por el dolor
- Opciones de horario disponibles HOY
- Número de teléfono para emergencias

---

### Escenario D5: Pregunta de política
**Input del cliente:**
```
"Puedo pagar con tarjeta de crédito? A meses sin intereses?"
```

**Expected Tool Calls:**
1. `get_business_policy({ policy_type: "payment" })`

**Expected Response:**
- Formas de pago aceptadas
- Opciones de financiamiento
- Meses sin intereses si aplica

---

### Escenario D6: Información de doctor específico
**Input del cliente:**
```
"Quién es el Dr. García? En qué está especializado?"
```

**Expected Tool Calls:**
1. `get_staff_info({ staff_name: "García" })`

**Expected Response:**
- Nombre completo del doctor
- Especialidad
- Sucursales donde atiende

---

## VERTICAL: RESTAURANT

### Escenario R1: Consulta de menú
**Input del cliente:**
```
"Qué tienen de cenar? Cuáles son sus platillos principales?"
```

**Expected Tool Calls:**
1. `get_menu_categories({})`
2. `get_menu_items({ category_id: "platos_fuertes" })`

**Expected Response:**
- Categorías disponibles
- Platillos principales con precios
- Sugerencias del chef si existen

---

### Escenario R2: Disponibilidad de platillo
**Input del cliente:**
```
"Todavía tienen disponible el ribeye?"
```

**Expected Tool Calls:**
1. `get_menu_items({ search_term: "ribeye" })`
2. `check_item_availability({ menu_item_id: "..." })`

**Expected Response:**
- Confirmación de disponibilidad
- Precio del platillo
- Sugerencias similares si no hay

---

### Escenario R3: Pedido para llevar
**Input del cliente:**
```
"Quiero ordenar para pickup: 2 hamburguesas clásicas y unas papas"
```

**Expected Flow (ordering.agent.ts):**
- Parsing del mensaje para detectar items
- Matching con menú
- Confirmación del pedido
- Creación de orden en BD

**Expected Response:**
- Confirmación de items
- Total del pedido
- Número de orden
- Tiempo estimado

---

### Escenario R4: Reservación
**Input del cliente:**
```
"Quiero reservar mesa para 6 personas el sábado a las 8pm"
```

**Expected Tool Calls:**
1. `get_available_slots({ date: "próximo sábado" })`
2. `get_branch_info({})` (para confirmar capacidad)
3. `create_appointment({ date: "...", time: "20:00", notes: "6 personas" })`

**Expected Response:**
- Confirmación de reservación
- Detalles de la mesa
- Dirección del restaurante

---

### Escenario R5: Promociones
**Input del cliente:**
```
"Tienen alguna promoción o descuento?"
```

**Expected Tool Calls:**
1. `get_active_promotions({ vertical: "restaurant" })`

**Expected Response:**
- Promociones activas
- Condiciones de cada promoción
- Cómo aplicarlas

---

### Escenario R6: Horario de operación
**Input del cliente:**
```
"A qué hora cierran los domingos?"
```

**Expected Tool Calls:**
1. `get_operating_hours({ day: "domingo" })`

**Expected Response:**
- Horario del domingo
- Última orden de cocina
- Horarios de toda la semana si es relevante

---

### Escenario R7: Consulta de alérgenos (safety)
**Input del cliente:**
```
"Soy alérgico a los mariscos, qué opciones tengo?"
```

**Expected Tool Calls:**
1. `get_menu_items({ available_only: true })`

**Expected Behavior:**
- SafetyResilienceService detecta alergia
- Filtrar platillos sin mariscos
- Mostrar disclaimer de seguridad
- Recomendar informar al mesero

---

## EDGE CASES

### E1: Sin datos configurados
**Context:** Tenant nuevo sin servicios configurados

**Expected Behavior:**
- Handler retorna error descriptivo
- Agente responde indicando que no hay información disponible
- Sugiere contactar directamente al negocio

---

### E2: Múltiples tool calls fallidos
**Context:** Todas las tools retornan errores

**Expected Behavior:**
- maxIterations previene loop infinito
- Respuesta de fallback amable
- Log de errores para debugging

---

### E3: Tool call con parámetros inválidos
**Context:** LLM genera parámetros incorrectos

**Expected Behavior:**
- Zod schema valida y rechaza
- Error se envía como ToolMessage
- LLM puede reintentar con parámetros correctos

---

## MÉTRICAS DE ÉXITO

1. **Reducción de tokens:** El Tool Calling debe reducir ~70% de tokens vs context stuffing
2. **Latencia:** Primera respuesta < 2 segundos
3. **Accuracy:** Tools correctas seleccionadas > 95% del tiempo
4. **Error recovery:** Manejo graceful de errores en 100% de casos

---

## CÓMO EJECUTAR TESTS

### Test Manual:
1. Usar el simulador de conversación en el dashboard
2. Seleccionar vertical (dental o restaurant)
3. Enviar mensajes de los escenarios
4. Verificar logs de tool calls en consola

### Test Automatizado:
```bash
# TODO: Implementar tests automatizados
npm run test:tools
```

---

## NOTAS DE IMPLEMENTACIÓN

- Los handlers de restaurant usan campos de BusinessContext:
  - `menu_items[].base_price` (no `price`)
  - `menu_items[].is_available` (no `available`)
  - `menu_categories[].is_active` (no `active`)

- El `ordering.agent.ts` NO usa tool calling actualmente, usa su propia lógica de parsing

- El `pricing.agent.ts` YA está migrado a tool calling

---

Last updated: 2026-01-15

---

## RESUMEN DE MIGRACIÓN v6.0

### Agentes Migrados a Tool Calling:
| Agente | Arquitectura | Tools |
|--------|--------------|-------|
| faq.agent.ts | Tool Calling completo | 4 tools |
| general.agent.ts | Tool Calling completo | 7 tools |
| location.agent.ts | Tool Calling completo | 2 tools |
| hours.agent.ts | Tool Calling completo | 2 tools |
| pricing.agent.ts | Tool Calling completo | 4 tools |
| booking.agent.ts | **Híbrido** (consultas via tools, booking directo) | 7 tools (sin CREATE_APPOINTMENT) |

### Agentes que NO usan Tool Calling (por diseño):
- `ordering.agent.ts`: Usa lógica local parseOrderFromMessage() con fuzzy matching
- `invoicing.agent.ts`: Usa Gemini 2.0 Flash para extracción de tickets CFDI
- `escalation.agent.ts`: Solo escala a humano, sin consultas
- `greeting.agent.ts`: Solo saludos, sin consultas de datos

### Arquitectura RAG Implementada:
- Migración SQL: `112_RAG_EMBEDDINGS_SYSTEM.sql`
- Servicio: `embedding.service.ts`
- Handler actualizado: `handleSearchKnowledgeBase` con fallback a keywords

### Verificación de Build:
```bash
npm run build  # ✓ Compila sin errores
```

---

## CHANGE LOG

### 2026-01-15 - FASE 4.1 y 5 Completadas
- Migrados 6 agentes a Tool Calling
- Implementado sistema RAG con embeddings (text-embedding-3-small)
- Creado servicio de embeddings para búsqueda semántica
- Handler search_knowledge_base ahora usa RAG con fallback
- Arquitectura híbrida para booking.agent.ts (seguridad)

### Pendientes para producción:
1. Ejecutar migración SQL `112_RAG_EMBEDDINGS_SYSTEM.sql` en Supabase
2. Generar embeddings iniciales para knowledge_articles, faqs, policies, services
3. Configurar cron job para actualizar embeddings cuando cambie el contenido
