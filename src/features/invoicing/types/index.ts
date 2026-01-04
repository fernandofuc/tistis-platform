// =====================================================
// TIS TIS PLATFORM - Invoicing Types
// Type definitions for the restaurant invoicing system
// =====================================================

// ======================
// CFDI TYPES (Mexico)
// ======================

export type CFDIVersion = '4.0';
export type TipoComprobante = 'I' | 'E' | 'T' | 'N' | 'P'; // Ingreso, Egreso, Traslado, Nómina, Pago
export type MetodoPago = 'PUE' | 'PPD'; // Pago en Una Exhibición, Pago en Parcialidades Diferido

// Catálogo c_FormaPago SAT
export type FormaPago =
  | '01' // Efectivo
  | '02' // Cheque nominativo
  | '03' // Transferencia electrónica
  | '04' // Tarjeta de crédito
  | '28' // Tarjeta de débito
  | '99'; // Por definir

// Catálogo c_UsoCFDI SAT
export type UsoCFDI =
  | 'G01' // Adquisición de mercancías
  | 'G02' // Devoluciones, descuentos o bonificaciones
  | 'G03' // Gastos en general
  | 'I01' // Construcciones
  | 'I02' // Mobiliario y equipo de oficina
  | 'I03' // Equipo de transporte
  | 'I04' // Equipo de cómputo
  | 'I08' // Otra maquinaria y equipo
  | 'D01' // Honorarios médicos
  | 'D02' // Gastos médicos por incapacidad
  | 'D03' // Gastos funerales
  | 'D04' // Donativos
  | 'D05' // Intereses por créditos hipotecarios
  | 'D06' // Aportaciones voluntarias al SAR
  | 'D07' // Primas por seguros de gastos médicos
  | 'D08' // Gastos de transportación escolar
  | 'D09' // Depósitos en cuentas para el ahorro
  | 'D10' // Pagos por servicios educativos
  | 'P01' // Por definir
  | 'S01' // Sin efectos fiscales
  | 'CP01' // Pagos
  | 'CN01'; // Nómina

// Catálogo c_RegimenFiscal SAT
export type RegimenFiscal =
  | '601' // General de Ley Personas Morales
  | '603' // Personas Morales con Fines no Lucrativos
  | '605' // Sueldos y Salarios
  | '606' // Arrendamiento
  | '607' // Régimen de Enajenación o Adquisición de Bienes
  | '608' // Demás ingresos
  | '610' // Residentes en el Extranjero sin Establecimiento Permanente
  | '611' // Ingresos por Dividendos
  | '612' // Personas Físicas con Actividades Empresariales y Profesionales
  | '614' // Ingresos por intereses
  | '615' // Régimen de los ingresos por obtención de premios
  | '616' // Sin obligaciones fiscales
  | '620' // Sociedades Cooperativas de Producción
  | '621' // Incorporación Fiscal
  | '622' // Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras
  | '623' // Opcional para Grupos de Sociedades
  | '624' // Coordinados
  | '625' // Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas
  | '626' // Régimen Simplificado de Confianza (RESICO)
  | '628' // Hidrocarburos
  | '629' // De los Regímenes Fiscales Preferentes
  | '630'; // Enajenación de acciones en bolsa de valores

// Clave de producto o servicio SAT para restaurantes
export const CLAVE_PROD_SERV_RESTAURANT = '90101500'; // Servicios de restaurantes y catering

// ======================
// INVOICE STATUS
// ======================

export type InvoiceStatus =
  | 'draft' // Borrador
  | 'pending' // Pendiente de timbrado
  | 'timbrada' // Timbrada por el PAC
  | 'enviada' // Enviada al cliente
  | 'cancelada' // Cancelada
  | 'error'; // Error en el proceso

export type TicketExtractionStatus =
  | 'pending' // Esperando procesamiento
  | 'processing' // En proceso de extracción
  | 'completed' // Extracción completada
  | 'failed' // Falló la extracción
  | 'reviewed'; // Revisado/corregido manualmente

// ======================
// INVOICE CONFIG
// ======================

export interface InvoiceConfig {
  id: string;
  tenant_id: string;
  branch_id?: string | null;

  // Fiscal data
  rfc: string;
  razon_social: string;
  regimen_fiscal: RegimenFiscal;
  codigo_postal: string;

  // Numbering
  serie: string;
  folio_actual: number;

  // Defaults
  uso_cfdi_default: UsoCFDI;
  forma_pago_default: FormaPago;
  metodo_pago_default: MetodoPago;
  moneda_default: string;

  // Tax rates
  tasa_iva: number;
  tasa_ieps: number;

  // PAC config
  pac_provider?: string | null;
  pac_api_key_encrypted?: string | null;
  pac_environment: 'sandbox' | 'production';

  // PDF
  pdf_template: string;
  logo_url?: string | null;

  // Email
  email_from_name?: string | null;
  email_reply_to?: string | null;
  email_bcc?: string | null;

  // Features
  auto_send_email: boolean;
  require_rfc_validation: boolean;
  allow_generic_rfc: boolean;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ======================
// CUSTOMER FISCAL DATA
// ======================

export interface CustomerFiscalData {
  id: string;
  tenant_id: string;
  lead_id?: string | null;

  // Identification
  rfc: string;
  nombre_razon_social: string;

  // Address
  codigo_postal: string;
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  colonia?: string | null;
  municipio?: string | null;
  estado?: string | null;

  // Contact
  email: string;
  telefono?: string | null;

  // Fiscal preferences
  regimen_fiscal: RegimenFiscal;
  uso_cfdi_preferido: UsoCFDI;

  // Validation
  rfc_validated: boolean;
  rfc_validated_at?: string | null;

  // Stats
  invoices_count: number;
  total_invoiced: number;
  last_invoice_at?: string | null;

  created_at: string;
  updated_at: string;
}

// ======================
// INVOICE
// ======================

export interface Invoice {
  id: string;
  tenant_id: string;
  branch_id: string;

  // Identification
  serie: string;
  folio: number;
  folio_fiscal?: string | null; // UUID del CFDI

  // Source
  ticket_image_url?: string | null;
  ticket_extraction_id?: string | null;

  // Customer data (snapshot)
  customer_fiscal_data_id?: string | null;
  receptor_rfc: string;
  receptor_nombre: string;
  receptor_codigo_postal: string;
  receptor_regimen_fiscal: RegimenFiscal;
  receptor_uso_cfdi: UsoCFDI;
  receptor_email: string;

  // Dates
  fecha_emision: string;
  fecha_timbrado?: string | null;

  // Amounts
  subtotal: number;
  descuento: number;
  total_impuestos: number;
  total: number;

  // Taxes
  iva_trasladado: number;
  ieps_trasladado: number;

  // Payment
  forma_pago: FormaPago;
  metodo_pago: MetodoPago;
  moneda: string;
  tipo_cambio: number;

  // CFDI
  version_cfdi: CFDIVersion;
  tipo_comprobante: TipoComprobante;
  exportacion: string;

  // PAC response
  cadena_original?: string | null;
  sello_sat?: string | null;
  sello_emisor?: string | null;
  certificado_sat?: string | null;
  numero_certificado_sat?: string | null;

  // Files
  xml_url?: string | null;
  pdf_url?: string | null;

  // Status
  status: InvoiceStatus;
  error_message?: string | null;

  // Cancellation
  cancelada_at?: string | null;
  cancelada_motivo?: '01' | '02' | '03' | '04' | null;
  cancelada_folio_sustitucion?: string | null;

  // Email
  email_sent_at?: string | null;
  email_opened_at?: string | null;
  email_bounced: boolean;

  // Metadata
  notas_internas?: string | null;
  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
  created_by?: string | null;

  // Relations (optional, for joined queries)
  items?: InvoiceItem[];
  customer?: CustomerFiscalData;
}

// ======================
// INVOICE ITEM
// ======================

export interface InvoiceItem {
  id: string;
  invoice_id: string;

  // SAT codes
  clave_prod_serv: string;
  no_identificacion?: string | null;

  // Description
  descripcion: string;

  // Quantities
  cantidad: number;
  clave_unidad: string;
  unidad: string;

  // Pricing
  valor_unitario: number;
  importe: number;
  descuento: number;

  // Taxes
  objeto_imp: '01' | '02' | '03'; // 01=No objeto, 02=Sí objeto, 03=Sí objeto no obligado
  iva_tasa: number;
  iva_importe: number;
  ieps_tasa: number;
  ieps_importe: number;

  display_order: number;
  created_at: string;
}

// ======================
// TICKET EXTRACTION
// ======================

export interface TicketExtraction {
  id: string;
  tenant_id: string;
  branch_id?: string | null;

  // Source
  image_url: string;
  image_storage_path?: string | null;

  // Status
  status: TicketExtractionStatus;

  // AI results
  extracted_data?: TicketExtractedData | null;
  confidence_score?: number | null;

  // Parsed data
  ticket_number?: string | null;
  ticket_date?: string | null;
  ticket_time?: string | null;

  // Amounts
  subtotal_extracted?: number | null;
  tax_extracted?: number | null;
  total_extracted?: number | null;
  tip_extracted?: number | null;

  // Items
  items_extracted?: ExtractedItem[] | null;

  // Restaurant info
  mesa_extracted?: string | null;
  mesero_extracted?: string | null;

  // Validation
  validation_errors?: ValidationError[] | null;
  manually_corrected: boolean;
  corrected_by?: string | null;
  corrected_at?: string | null;

  // AI metadata
  model_used?: string | null;
  tokens_used?: number | null;
  processing_time_ms?: number | null;

  // Result
  invoice_id?: string | null;

  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface TicketExtractedData {
  raw_text?: string;
  restaurant_name?: string;
  restaurant_address?: string;
  ticket_number?: string;
  date?: string;
  time?: string;
  items: ExtractedItem[];
  subtotal?: number;
  tax?: number;
  tip?: number;
  total?: number;
  payment_method?: string;
  table_number?: string;
  server_name?: string;
  additional_info?: Record<string, string>;
}

export interface ExtractedItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// ======================
// API TYPES
// ======================

export interface CreateInvoiceRequest {
  branch_id: string;

  // Customer
  customer_rfc: string;
  customer_nombre: string;
  customer_codigo_postal: string;
  customer_email: string;
  customer_regimen_fiscal?: RegimenFiscal;
  customer_uso_cfdi?: UsoCFDI;

  // Items
  items: CreateInvoiceItemRequest[];

  // Payment
  forma_pago?: FormaPago;
  metodo_pago?: MetodoPago;

  // Optional
  descuento?: number;
  notas_internas?: string;

  // Source
  ticket_extraction_id?: string;
}

export interface CreateInvoiceItemRequest {
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  descuento?: number;
  clave_prod_serv?: string;
  no_identificacion?: string;
}

export interface ProcessTicketRequest {
  branch_id?: string;
  image_url?: string;
  image_base64?: string;
}

export interface ProcessTicketResponse {
  extraction_id: string;
  status: TicketExtractionStatus;
  extracted_data?: TicketExtractedData;
  confidence_score?: number;
  validation_errors?: ValidationError[];
}

export interface InvoiceStatistics {
  total_invoices: number;
  total_amount: number;
  invoices_timbradas: number;
  invoices_canceladas: number;
  invoices_pendientes: number;
  avg_invoice_amount: number;
  invoices_by_day: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
  top_customers: Array<{
    rfc: string;
    nombre: string;
    count: number;
    amount: number;
  }>;
}

// ======================
// FORM TYPES
// ======================

export interface InvoiceFormData {
  // Customer selection
  customer_type: 'existing' | 'new' | 'generic';
  customer_id?: string;

  // New customer data
  new_customer?: {
    rfc: string;
    nombre: string;
    codigo_postal: string;
    email: string;
    regimen_fiscal: RegimenFiscal;
    uso_cfdi: UsoCFDI;
  };

  // Invoice data
  items: InvoiceFormItem[];
  descuento: number;
  forma_pago: FormaPago;
  metodo_pago: MetodoPago;
  notas: string;
}

export interface InvoiceFormItem {
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  descuento: number;
}

// ======================
// RFC VALIDATION
// ======================

export interface RFCValidationResult {
  valid: boolean;
  type: 'persona_fisica' | 'persona_moral' | 'generic' | 'invalid';
  formatted_rfc?: string;
  errors?: string[];
}

// Generic RFC for public (without fiscal requirements)
export const RFC_GENERICO_NACIONAL = 'XAXX010101000';
export const RFC_GENERICO_EXTRANJERO = 'XEXX010101000';
