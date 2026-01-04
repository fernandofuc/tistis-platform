# Facturación AI - Sistema de Facturación Inteligente para Restaurantes

> **Versión:** 1.0.0
> **Fecha:** 2026-01-04
> **Autor:** Claude Opus 4.5
> **Vertical:** Restaurant Only

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Flujo de Conversación](#flujo-de-conversación)
4. [Componentes Principales](#componentes-principales)
5. [Base de Datos](#base-de-datos)
6. [API Endpoints](#api-endpoints)
7. [Integración con LangGraph](#integración-con-langgraph)
8. [Configuración](#configuración)
9. [Seguridad y Compliance](#seguridad-y-compliance)
10. [Guía de Uso](#guía-de-uso)

---

## Resumen Ejecutivo

El sistema de **Facturación AI** permite a los clientes de restaurantes generar facturas CFDI directamente desde WhatsApp, enviando una foto de su ticket de consumo. El proceso es 100% automatizado mediante inteligencia artificial.

### Características Principales

- **Extracción automática de tickets** con Gemini 2.0 Flash
- **Validación de RFC** (persona física y moral)
- **Generación de CFDI 4.0** conforme a normativa SAT
- **Envío automático** por WhatsApp y email
- **Conversaciones multi-turno** con estado persistente
- **Aislamiento por vertical** (solo restaurantes)

### Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| AI Vision | Gemini 2.0 Flash (`gemini-2.0-flash-exp`) |
| Orquestación | LangGraph (StateGraph) |
| Base de Datos | Supabase (PostgreSQL + RLS) |
| Frontend | Next.js 14 + React |
| Email | Resend API |
| WhatsApp | Meta Business API |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         WhatsApp                                 │
│                    (Meta Business API)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TIS TIS LangGraph                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Supervisor  │──│ Vertical     │──│ invoicing_restaurant │  │
│  │    Agent     │  │   Router     │  │       Agent          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
┌──────────────────────┐        ┌──────────────────────────┐
│   Gemini 2.0 Flash   │        │     Supabase Database    │
│   (Ticket OCR/AI)    │        │   - invoice_config       │
└──────────────────────┘        │   - invoices             │
                                │   - customer_fiscal_data │
                                │   - conversation_metadata│
                                └──────────────────────────┘
```

### Flujo de Datos

1. **Cliente → WhatsApp**: Envía foto del ticket
2. **WhatsApp → LangGraph**: Webhook recibe mensaje
3. **Supervisor**: Detecta intent `INVOICE_REQUEST`
4. **Vertical Router**: Valida `vertical === 'restaurant'`
5. **Invoicing Agent**: Procesa conversación multi-turno
6. **Gemini**: Extrae datos del ticket
7. **Supabase**: Guarda factura y datos fiscales
8. **WhatsApp + Email**: Envía factura al cliente

---

## Flujo de Conversación

El agente de facturación maneja una conversación de múltiples turnos con estado persistente.

### Estados de la Máquina de Estados

```typescript
type InvoicingStep =
  | 'awaiting_ticket'    // Esperando foto del ticket
  | 'extracting'         // Procesando imagen con Gemini
  | 'awaiting_rfc'       // Pidiendo RFC del cliente
  | 'awaiting_email'     // Pidiendo razón social, CP, régimen, email
  | 'awaiting_uso_cfdi'  // Pidiendo uso de CFDI
  | 'confirming'         // Confirmación de datos
  | 'generating'         // Generando factura
  | 'complete'           // Proceso terminado
  | 'error';             // Error en el proceso
```

### Diagrama de Flujo

```
┌─────────────────┐
│ Cliente dice    │
│ "quiero factura"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ awaiting_ticket │◄────────────────────┐
│ "Envíame foto"  │                     │
└────────┬────────┘                     │
         │ (imagen recibida)            │ (imagen ilegible)
         ▼                              │
┌─────────────────┐                     │
│   extracting    │─────────────────────┘
│ (Gemini 2.0)    │
└────────┬────────┘
         │ (confidence > 0.3)
         ▼
┌─────────────────┐
│  awaiting_rfc   │
│ "Envíame tu RFC"│
└────────┬────────┘
         │ (RFC válido)
         ▼
┌─────────────────┐
│ awaiting_email  │  ← Pide: Razón Social → CP → Régimen Fiscal
│ (multi-datos)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│awaiting_uso_cfdi│
│ "G03, G01, D01?"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   confirming    │
│ "¿Están bien?"  │◄────┐
└────────┬────────┘     │ (corregir)
         │ ("sí")       │
         ▼              │
┌─────────────────┐     │
│   generating    │─────┘
│  (crear CFDI)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    complete     │
│ "Tu factura..."│
└─────────────────┘
```

---

## Componentes Principales

### 1. Invoicing Agent (`invoicing.agent.ts`)

**Ubicación:** `src/features/ai/agents/specialists/invoicing.agent.ts`

Agente especializado que hereda de `BaseAgent` y maneja todo el flujo de facturación.

```typescript
class InvoicingRestaurantAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'invoicing_restaurant',
      description: 'Agente de facturación CFDI para restaurantes vía WhatsApp',
      temperature: 0.3, // Bajo para consistencia
      maxTokens: 400,
      canHandoffTo: ['general', 'escalation'],
      canGenerateResponse: true,
    });
  }
}
```

**Métodos principales:**
- `execute(state)` - Punto de entrada, router por estado
- `handleAwaitingTicket()` - Procesa imagen del ticket
- `handleAwaitingRFC()` - Valida y guarda RFC
- `handleAwaitingEmail()` - Recolecta datos fiscales
- `handleAwaitingUsoCFDI()` - Procesa uso de CFDI
- `handleConfirming()` - Confirma y genera factura

### 2. Gemini Extraction Service

**Ubicación:** `src/features/invoicing/services/gemini-extraction.service.ts`

Servicio que utiliza Gemini 2.0 Flash para extraer datos de tickets.

```typescript
interface TicketData {
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
  tax_amount: number;
  total: number;
  ticket_number?: string;
  date?: string;
  confidence: number; // 0-1
}
```

**Prompt de extracción:**
```
Analiza esta imagen de un ticket/recibo de restaurante y extrae:
- items (descripción, cantidad, precio unitario, total)
- subtotal
- tax_amount (IVA)
- total
- ticket_number (si visible)
- date (formato YYYY-MM-DD)
- confidence (0-1)
```

### 3. Invoice Service

**Ubicación:** `src/features/invoicing/services/invoice.service.ts`

Servicio central para operaciones CRUD de facturas.

**Métodos:**
- `getConfig(tenantId, branchId?)` - Obtener configuración
- `upsertConfig(config)` - Crear/actualizar configuración
- `createInvoice(data)` - Crear factura
- `getInvoice(invoiceId)` - Obtener factura con items
- `getInvoices(tenantId, options)` - Listar facturas
- `updateInvoiceStatus(invoiceId, status)` - Cambiar estado
- `getStatistics(tenantId, options)` - Estadísticas

### 4. PDF Generator Service

**Ubicación:** `src/features/invoicing/services/pdf-generator.service.ts`

Genera PDFs de facturas usando templates HTML + Handlebars.

### 5. Email Service

**Ubicación:** `src/features/invoicing/services/email.service.ts`

Envía facturas por email usando Resend API.

---

## Base de Datos

### Migraciones

- `096_RESTAURANT_INVOICING_SYSTEM.sql` - Tablas principales
- `097_INVOICING_CONVERSATION_STATE.sql` - Estado de conversación

### Esquema de Tablas

#### `restaurant_invoice_config`
Configuración de facturación por tenant/sucursal.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| branch_id | UUID | FK → branches (opcional) |
| rfc | VARCHAR(13) | RFC del emisor |
| razon_social | VARCHAR(255) | Nombre legal |
| regimen_fiscal | VARCHAR(3) | Código SAT (601, 612, etc.) |
| codigo_postal | VARCHAR(10) | CP fiscal |
| serie | VARCHAR(10) | Serie de facturación (FAC) |
| folio_actual | INTEGER | Último folio usado |
| tasa_iva | DECIMAL(5,4) | Tasa IVA (0.16) |
| pac_provider | VARCHAR(50) | Proveedor PAC |
| is_active | BOOLEAN | Activo/inactivo |

#### `restaurant_invoices`
Facturas generadas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| branch_id | UUID | FK → branches |
| serie | VARCHAR(10) | Serie |
| folio | INTEGER | Número de folio |
| folio_fiscal | UUID | UUID del CFDI (SAT) |
| receptor_rfc | VARCHAR(13) | RFC cliente |
| receptor_nombre | VARCHAR(255) | Nombre cliente |
| subtotal | DECIMAL(12,2) | Subtotal |
| total_impuestos | DECIMAL(12,2) | IVA + IEPS |
| total | DECIMAL(12,2) | Total |
| status | VARCHAR(20) | draft/pending/timbrada/enviada/cancelada |
| xml_url | TEXT | URL del XML timbrado |
| pdf_url | TEXT | URL del PDF |

#### `restaurant_invoice_items`
Líneas de detalle (conceptos).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| invoice_id | UUID | FK → restaurant_invoices |
| clave_prod_serv | VARCHAR(10) | Clave SAT (90101500) |
| descripcion | VARCHAR(1000) | Descripción del item |
| cantidad | DECIMAL(12,4) | Cantidad |
| valor_unitario | DECIMAL(12,4) | Precio unitario |
| importe | DECIMAL(12,2) | Total línea |
| iva_tasa | DECIMAL(5,4) | Tasa IVA (0.16) |
| iva_importe | DECIMAL(12,2) | Monto IVA |

#### `restaurant_customer_fiscal_data`
Datos fiscales de clientes.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| lead_id | UUID | FK → leads (opcional) |
| rfc | VARCHAR(13) | RFC del cliente |
| nombre_razon_social | VARCHAR(255) | Nombre |
| codigo_postal | VARCHAR(10) | CP fiscal |
| regimen_fiscal | VARCHAR(3) | Código régimen |
| uso_cfdi_preferido | VARCHAR(4) | Uso CFDI default |
| email | VARCHAR(255) | Email para facturas |
| invoices_count | INTEGER | Contador de facturas |
| total_invoiced | DECIMAL(12,2) | Total facturado |

#### `restaurant_ticket_extractions`
Historial de extracciones AI.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| image_url | TEXT | URL imagen |
| status | VARCHAR(20) | pending/processing/completed/failed |
| extracted_data | JSONB | Datos extraídos |
| confidence_score | DECIMAL(5,4) | Confianza (0-1) |
| model_used | VARCHAR(50) | Modelo AI usado |
| processing_time_ms | INTEGER | Tiempo de proceso |

#### `conversation_metadata`
Estado de conversaciones multi-turno.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| conversation_id | UUID | FK → conversations |
| invoicing_state | JSONB | Estado de facturación |
| context_data | JSONB | Otros datos de contexto |

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado con políticas de aislamiento por tenant:

```sql
-- Ejemplo de política
CREATE POLICY "tenant_select_invoices" ON restaurant_invoices
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Roles con acceso de escritura:**
- `owner` - Acceso completo
- `admin` - Acceso completo
- `manager` - Puede crear facturas
- `staff` - Puede crear facturas

---

## API Endpoints

### GET /api/invoicing/config

Obtiene la configuración de facturación del tenant actual.

**Request:**
```http
GET /api/invoicing/config?branch_id=xxx
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "rfc": "ABC123456XY9",
  "razon_social": "RESTAURANTE EJEMPLO SA DE CV",
  "regimen_fiscal": "601",
  "codigo_postal": "06600",
  "serie": "FAC",
  "folio_actual": 125,
  "tasa_iva": 0.16,
  "is_active": true
}
```

### POST /api/invoicing/config

Crea o actualiza la configuración de facturación.

**Request:**
```json
{
  "rfc": "ABC123456XY9",
  "razon_social": "RESTAURANTE EJEMPLO SA DE CV",
  "regimen_fiscal": "601",
  "codigo_postal": "06600",
  "domicilio_fiscal": "Av. Reforma 123, Col. Juárez",
  "serie": "FAC",
  "tasa_iva": 0.16,
  "auto_send_email": true
}
```

### POST /api/invoicing/process-ticket

Procesa una imagen de ticket con Gemini.

**Request:**
```json
{
  "image_url": "https://storage.../ticket.jpg",
  "branch_id": "uuid"
}
```

**Response:**
```json
{
  "extraction_id": "uuid",
  "status": "completed",
  "data": {
    "items": [...],
    "subtotal": 850.00,
    "tax_amount": 136.00,
    "total": 986.00,
    "confidence": 0.95
  }
}
```

### POST /api/invoicing/invoices

Crea una nueva factura.

### GET /api/invoicing/invoices

Lista facturas con filtros.

### GET /api/invoicing/statistics

Obtiene estadísticas de facturación.

---

## Integración con LangGraph

### Supervisor Agent

El supervisor detecta la intención `INVOICE_REQUEST` y redirige al agente de facturación:

```typescript
// supervisor.agent.ts - línea 62-65
{
  intent: 'INVOICE_REQUEST',
  regex: /\b(factura|facturar|cfdi|rfc|datos fiscales|...)\b/,
}
```

```typescript
// supervisor.agent.ts - línea 223-228
if (intent === 'INVOICE_REQUEST' && vertical === 'restaurant') {
  return 'invoicing_restaurant';
} else if (intent === 'INVOICE_REQUEST') {
  return 'general'; // Otras verticales van a general
}
```

### Vertical Router

El router valida que el agente esté disponible para la vertical:

```typescript
// vertical-router.agent.ts - línea 51-62
restaurant: {
  agents: [
    'greeting',
    'pricing',
    'booking_restaurant',
    'ordering_restaurant',
    'invoicing_restaurant', // ← Agregado
    'faq',
    'location',
    'menu',
    'escalation'
  ],
  intent_prompts: {
    INVOICE_REQUEST: 'Ayuda al cliente a facturar...',
  },
  keywords: [..., 'factura', 'facturar', 'cfdi', 'rfc'],
}
```

### Graph Edges

```typescript
// tistis-graph.ts
.addNode('invoicing_restaurant', invoicingRestaurantNode)

.addConditionalEdges('vertical_router', agentRouter, {
  invoicing_restaurant: 'invoicing_restaurant',
  ...
})

.addConditionalEdges('invoicing_restaurant', postAgentRouter, {
  general: 'general',
  escalation: 'escalation',
  finalize: 'finalize',
})
```

---

## Configuración

### Variables de Entorno

```bash
# Gemini AI
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Email (Resend)
RESEND_API_KEY=re_xxx

# WhatsApp
WHATSAPP_ACCESS_TOKEN=xxx
WHATSAPP_PHONE_NUMBER_ID=xxx
```

### Configuración por Tenant

Cada tenant debe configurar sus datos fiscales en:
**Dashboard → Facturación AI**

Datos requeridos:
- RFC del emisor (12-13 caracteres)
- Razón Social
- Régimen Fiscal (601, 612, 626, etc.)
- Código Postal fiscal
- Serie de facturación (FAC)

---

## Seguridad y Compliance

### Cumplimiento CFDI 4.0

- Estructura conforme a especificaciones SAT
- Campos obligatorios validados
- Catálogos actualizados (régimen fiscal, uso CFDI)

### Validación de RFC

```typescript
function validateRFC(rfc: string): {
  valid: boolean;
  type: 'persona_fisica' | 'persona_moral' | null;
  error?: string;
}
```

- Persona Física: 13 caracteres (`XAXX010101XXX`)
- Persona Moral: 12 caracteres (`ABC123456XX`)
- RFC Genérico: `XAXX010101000`
- RFC Extranjero: `XEXX010101000`

### Aislamiento de Datos

- RLS en todas las tablas
- Filtrado por `tenant_id`
- Validación de `vertical === 'restaurant'`
- Solo roles autorizados pueden configurar

### Sin Almacenamiento de PDFs

Los PDFs se generan on-demand y se envían directamente por WhatsApp/email.
No se almacenan permanentemente (solo URLs temporales si se configuran).

---

## Guía de Uso

### Para el Cliente (WhatsApp)

1. **Iniciar conversación**
   ```
   Cliente: "Quiero factura" / "Necesito mi factura" / envía foto
   ```

2. **Enviar ticket**
   ```
   Bot: "Para facturar, envíame una foto clara de tu ticket"
   Cliente: [envía foto]
   Bot: "He leído tu ticket:
         - 2x Tacos al pastor: $80.00
         - 1x Refresco: $35.00
         Subtotal: $115.00
         IVA: $18.40
         Total: $133.40

         Para generar tu factura, envíame tu RFC:"
   ```

3. **Proporcionar RFC**
   ```
   Cliente: "XAXX010101000"
   Bot: "RFC registrado. Ahora envíame tu nombre completo:"
   ```

4. **Completar datos fiscales**
   ```
   Cliente: "Juan Pérez García"
   Bot: "Ahora tu código postal fiscal (5 dígitos):"
   Cliente: "06600"
   Bot: "¿Cuál es tu régimen fiscal?
         • 612 - Actividades Empresariales
         • 626 - RESICO
         • 616 - Sin obligaciones"
   Cliente: "626"
   Bot: "¿Para qué usarás esta factura?
         • G03 - Gastos en general (más común)
         • G01 - Adquisición de mercancías"
   Cliente: "G03"
   Bot: "Por último, tu email para recibir el CFDI:"
   Cliente: "juan@email.com"
   ```

5. **Confirmar y generar**
   ```
   Bot: "Confirma tus datos:
         • RFC: XAXX010101000
         • Nombre: JUAN PÉREZ GARCÍA
         • C.P.: 06600
         • Régimen: RESICO
         • Uso CFDI: Gastos en general
         • Email: juan@email.com

         ¿Son correctos? Responde 'sí' para generar"
   Cliente: "sí"
   Bot: "¡Tu factura ha sido generada!
         [Resumen de factura]
         📧 El CFDI timbrado será enviado a tu correo"
   ```

### Para el Administrador (Dashboard)

1. Navegar a **Dashboard → Facturación AI**
2. Completar datos del emisor:
   - RFC del restaurante
   - Razón social
   - Régimen fiscal
   - Código postal
3. Configurar opciones de email
4. Activar el servicio

---

## Troubleshooting

### El agente no detecta la intención de facturación

**Verificar:**
1. El tenant tiene `vertical: 'restaurant'`
2. El mensaje contiene keywords: `factura`, `cfdi`, `rfc`
3. El agente está en la lista de agents del vertical router

### Error al extraer datos del ticket

**Posibles causas:**
1. Imagen de baja calidad
2. Ticket muy arrugado o con manchas
3. Formato de ticket no estándar

**Solución:** Pedir al cliente una nueva foto más clara

### RFC rechazado

**Validar:**
1. Longitud correcta (12 o 13 caracteres)
2. Formato: letras + números + homoclave
3. Sin espacios ni caracteres especiales

---

## Roadmap Futuro

- [ ] Integración con PAC real (Facturapi, Finkok)
- [ ] Timbrado automático de CFDI
- [ ] Cancelación de facturas
- [ ] Notas de crédito
- [ ] Complementos de pago
- [ ] Dashboard de estadísticas avanzadas
- [ ] Exportación contable (XML masivo)

---

## Referencias

- [Especificación CFDI 4.0 - SAT](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20_version3-3.htm)
- [Catálogos SAT](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/catCFDI_V_4.zip)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
