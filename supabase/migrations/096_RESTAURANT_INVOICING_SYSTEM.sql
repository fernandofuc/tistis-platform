-- =====================================================
-- TIS TIS PLATFORM - Restaurant Invoicing System
-- Migration: 096_RESTAURANT_INVOICING_SYSTEM.sql
-- Purpose: AI-powered invoice generation from ticket photos
-- Target: Mexico (CFDI), expandable to USA
-- =====================================================

-- ======================
-- INVOICE CONFIGURATION (per tenant/branch)
-- ======================
CREATE TABLE IF NOT EXISTS restaurant_invoice_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

    -- Business fiscal data (Mexico)
    rfc VARCHAR(13) NOT NULL,                           -- RFC del emisor (restaurante)
    razon_social VARCHAR(255) NOT NULL,                 -- Nombre legal
    regimen_fiscal VARCHAR(3) NOT NULL DEFAULT '601',   -- Código SAT régimen fiscal
    codigo_postal VARCHAR(10) NOT NULL,                 -- CP del domicilio fiscal

    -- Invoice numbering
    serie VARCHAR(10) DEFAULT 'FAC',                    -- Serie de facturación
    folio_actual INTEGER DEFAULT 0,                     -- Último folio usado

    -- Default values
    uso_cfdi_default VARCHAR(4) DEFAULT 'G03',          -- Gastos en general
    forma_pago_default VARCHAR(2) DEFAULT '01',         -- Efectivo
    metodo_pago_default VARCHAR(3) DEFAULT 'PUE',       -- Pago en una sola exhibición
    moneda_default VARCHAR(3) DEFAULT 'MXN',

    -- Tax rates (Mexico)
    tasa_iva DECIMAL(5,4) DEFAULT 0.16,                 -- 16% IVA
    tasa_ieps DECIMAL(5,4) DEFAULT 0.00,                -- IEPS si aplica (bebidas alcohólicas)

    -- PAC Configuration (Proveedor Autorizado de Certificación)
    pac_provider VARCHAR(50),                           -- 'facturapi', 'finkok', 'sat_directo'
    pac_api_key_encrypted TEXT,                         -- API key encriptada
    pac_environment VARCHAR(10) DEFAULT 'sandbox',      -- 'sandbox' | 'production'

    -- PDF Template
    pdf_template VARCHAR(50) DEFAULT 'default',         -- Template de PDF
    logo_url TEXT,                                      -- Logo para la factura

    -- Email settings
    email_from_name VARCHAR(100),
    email_reply_to VARCHAR(255),
    email_bcc VARCHAR(255),                             -- Copia oculta para el restaurante

    -- Storage
    storage_bucket VARCHAR(100) DEFAULT 'invoices',

    -- Feature flags
    auto_send_email BOOLEAN DEFAULT true,
    require_rfc_validation BOOLEAN DEFAULT true,
    allow_generic_rfc BOOLEAN DEFAULT true,             -- XAXX010101000 para público general

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_invoice_config_per_branch UNIQUE (tenant_id, branch_id)
);

-- ======================
-- CUSTOMER FISCAL DATA (RFC del cliente)
-- ======================
CREATE TABLE IF NOT EXISTS restaurant_customer_fiscal_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

    -- Identificación
    rfc VARCHAR(13) NOT NULL,                           -- RFC del cliente
    nombre_razon_social VARCHAR(255) NOT NULL,          -- Nombre o razón social

    -- Domicilio fiscal
    codigo_postal VARCHAR(10) NOT NULL,                 -- CP fiscal (requerido por SAT)
    calle VARCHAR(255),
    numero_exterior VARCHAR(20),
    numero_interior VARCHAR(20),
    colonia VARCHAR(100),
    municipio VARCHAR(100),
    estado VARCHAR(100),

    -- Contacto
    email VARCHAR(255) NOT NULL,                        -- Email para enviar factura
    telefono VARCHAR(20),

    -- Preferencias fiscales
    regimen_fiscal VARCHAR(3) DEFAULT '616',            -- Sin obligaciones fiscales (persona física)
    uso_cfdi_preferido VARCHAR(4) DEFAULT 'G03',        -- Gastos en general

    -- Metadata
    rfc_validated BOOLEAN DEFAULT false,
    rfc_validated_at TIMESTAMPTZ,

    -- Tracking
    invoices_count INTEGER DEFAULT 0,
    total_invoiced DECIMAL(12,2) DEFAULT 0,
    last_invoice_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_rfc_per_tenant UNIQUE (tenant_id, rfc)
);

-- ======================
-- INVOICES TABLE
-- ======================
CREATE TABLE IF NOT EXISTS restaurant_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    -- Invoice identification
    serie VARCHAR(10) NOT NULL,
    folio INTEGER NOT NULL,
    folio_fiscal UUID,                                  -- UUID del CFDI (lo asigna el SAT)

    -- Source (ticket procesado)
    ticket_image_url TEXT,                              -- URL de la imagen del ticket
    ticket_extraction_id UUID,                          -- Referencia a la extracción AI

    -- Customer data (snapshot at invoice time)
    customer_fiscal_data_id UUID REFERENCES restaurant_customer_fiscal_data(id),
    receptor_rfc VARCHAR(13) NOT NULL,
    receptor_nombre VARCHAR(255) NOT NULL,
    receptor_codigo_postal VARCHAR(10) NOT NULL,
    receptor_regimen_fiscal VARCHAR(3) NOT NULL,
    receptor_uso_cfdi VARCHAR(4) NOT NULL,
    receptor_email VARCHAR(255) NOT NULL,

    -- Invoice details
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_timbrado TIMESTAMPTZ,                         -- Cuando el PAC timbró

    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL,
    descuento DECIMAL(12,2) DEFAULT 0,
    total_impuestos DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,

    -- Tax breakdown
    iva_trasladado DECIMAL(12,2) DEFAULT 0,
    ieps_trasladado DECIMAL(12,2) DEFAULT 0,

    -- Payment info
    forma_pago VARCHAR(2) NOT NULL DEFAULT '01',        -- 01=Efectivo, 03=Transferencia, 04=Tarjeta
    metodo_pago VARCHAR(3) NOT NULL DEFAULT 'PUE',      -- PUE=Una exhibición, PPD=Diferido
    moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
    tipo_cambio DECIMAL(10,4) DEFAULT 1.0000,

    -- CFDI data
    version_cfdi VARCHAR(5) DEFAULT '4.0',
    tipo_comprobante VARCHAR(1) DEFAULT 'I',            -- I=Ingreso, E=Egreso, T=Traslado
    exportacion VARCHAR(2) DEFAULT '01',                -- 01=No aplica

    -- PAC response
    cadena_original TEXT,
    sello_sat TEXT,
    sello_emisor TEXT,
    certificado_sat TEXT,
    numero_certificado_sat VARCHAR(20),

    -- Generated files
    xml_url TEXT,                                       -- URL del XML timbrado
    pdf_url TEXT,                                       -- URL del PDF generado

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'draft',        -- draft, pending, timbrada, enviada, cancelada, error
    error_message TEXT,

    -- Cancellation (if applicable)
    cancelada_at TIMESTAMPTZ,
    cancelada_motivo VARCHAR(2),                        -- 01=Con relación, 02=Sin relación, 03=No se llevó, 04=Error
    cancelada_folio_sustitucion UUID,

    -- Email tracking
    email_sent_at TIMESTAMPTZ,
    email_opened_at TIMESTAMPTZ,
    email_bounced BOOLEAN DEFAULT false,

    -- Metadata
    notas_internas TEXT,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    CONSTRAINT unique_invoice_folio UNIQUE (tenant_id, serie, folio)
);

-- ======================
-- INVOICE ITEMS (conceptos)
-- ======================
CREATE TABLE IF NOT EXISTS restaurant_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES restaurant_invoices(id) ON DELETE CASCADE,

    -- Product/service identification
    clave_prod_serv VARCHAR(10) NOT NULL DEFAULT '90101500', -- Restaurantes
    no_identificacion VARCHAR(100),                     -- SKU o código interno

    -- Description
    descripcion VARCHAR(1000) NOT NULL,

    -- Quantities
    cantidad DECIMAL(12,4) NOT NULL DEFAULT 1,
    clave_unidad VARCHAR(5) NOT NULL DEFAULT 'ACT',     -- ACT=Actividad
    unidad VARCHAR(50) DEFAULT 'Servicio',

    -- Pricing
    valor_unitario DECIMAL(12,4) NOT NULL,
    importe DECIMAL(12,2) NOT NULL,                     -- cantidad * valor_unitario
    descuento DECIMAL(12,2) DEFAULT 0,

    -- Taxes for this item
    objeto_imp VARCHAR(2) NOT NULL DEFAULT '02',        -- 02=Sí objeto de impuesto

    -- Tax breakdown
    iva_tasa DECIMAL(5,4) DEFAULT 0.16,
    iva_importe DECIMAL(12,2) DEFAULT 0,
    ieps_tasa DECIMAL(5,4) DEFAULT 0,
    ieps_importe DECIMAL(12,2) DEFAULT 0,

    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- TICKET EXTRACTIONS (AI processing)
-- ======================
CREATE TABLE IF NOT EXISTS restaurant_ticket_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,

    -- Source image
    image_url TEXT NOT NULL,
    image_storage_path TEXT,                            -- Path in Supabase storage

    -- Extraction status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',      -- pending, processing, completed, failed, reviewed

    -- AI extraction results
    extracted_data JSONB,                               -- Raw extraction from Gemini
    confidence_score DECIMAL(5,4),                      -- 0-1 confidence

    -- Parsed ticket data
    ticket_number VARCHAR(50),
    ticket_date DATE,
    ticket_time TIME,

    -- Amounts extracted
    subtotal_extracted DECIMAL(12,2),
    tax_extracted DECIMAL(12,2),
    total_extracted DECIMAL(12,2),
    tip_extracted DECIMAL(12,2),

    -- Items extracted
    items_extracted JSONB,                              -- Array of {description, quantity, price}

    -- Customer data (if visible on ticket)
    mesa_extracted VARCHAR(20),
    mesero_extracted VARCHAR(100),

    -- Validation
    validation_errors JSONB,                            -- Array of validation issues
    manually_corrected BOOLEAN DEFAULT false,
    corrected_by UUID REFERENCES auth.users(id),
    corrected_at TIMESTAMPTZ,

    -- AI metadata
    model_used VARCHAR(50),                             -- gemini-2.0-flash-exp
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    -- Resulting invoice (if created)
    invoice_id UUID REFERENCES restaurant_invoices(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ======================
-- INVOICE TEMPLATES (customizable PDF templates)
-- ======================
CREATE TABLE IF NOT EXISTS restaurant_invoice_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = system template

    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Template content
    html_template TEXT NOT NULL,                        -- Handlebars template
    css_styles TEXT,

    -- Template type
    template_type VARCHAR(20) DEFAULT 'invoice',        -- invoice, credit_note, receipt

    -- Settings
    paper_size VARCHAR(10) DEFAULT 'letter',            -- letter, a4, ticket
    orientation VARCHAR(10) DEFAULT 'portrait',

    -- Status
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- AUDIT LOG FOR INVOICES
-- ======================
CREATE TABLE IF NOT EXISTS restaurant_invoice_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES restaurant_invoices(id) ON DELETE CASCADE,

    action VARCHAR(50) NOT NULL,                        -- created, timbrada, sent, cancelled, viewed
    actor_id UUID REFERENCES auth.users(id),
    actor_type VARCHAR(20) DEFAULT 'user',              -- user, system, customer

    old_values JSONB,
    new_values JSONB,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- INDEXES
-- ======================

-- Invoice config
CREATE INDEX IF NOT EXISTS idx_invoice_config_tenant ON restaurant_invoice_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_config_branch ON restaurant_invoice_config(branch_id);

-- Customer fiscal data
CREATE INDEX IF NOT EXISTS idx_customer_fiscal_tenant ON restaurant_customer_fiscal_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_fiscal_rfc ON restaurant_customer_fiscal_data(rfc);
CREATE INDEX IF NOT EXISTS idx_customer_fiscal_lead ON restaurant_customer_fiscal_data(lead_id);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON restaurant_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON restaurant_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON restaurant_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_fecha ON restaurant_invoices(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_folio_fiscal ON restaurant_invoices(folio_fiscal);
CREATE INDEX IF NOT EXISTS idx_invoices_receptor_rfc ON restaurant_invoices(receptor_rfc);

-- Invoice items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON restaurant_invoice_items(invoice_id);

-- Ticket extractions
CREATE INDEX IF NOT EXISTS idx_extractions_tenant ON restaurant_ticket_extractions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extractions_status ON restaurant_ticket_extractions(status);
CREATE INDEX IF NOT EXISTS idx_extractions_created ON restaurant_ticket_extractions(created_at DESC);

-- Audit log
CREATE INDEX IF NOT EXISTS idx_audit_invoice ON restaurant_invoice_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON restaurant_invoice_audit_log(created_at DESC);

-- ======================
-- ROW LEVEL SECURITY
-- ======================

ALTER TABLE restaurant_invoice_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_customer_fiscal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_ticket_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_invoice_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_all_invoice_config" ON restaurant_invoice_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_customer_fiscal" ON restaurant_customer_fiscal_data FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_invoices" ON restaurant_invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_invoice_items" ON restaurant_invoice_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_extractions" ON restaurant_ticket_extractions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_templates" ON restaurant_invoice_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_audit" ON restaurant_invoice_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tenant isolation for authenticated users
CREATE POLICY "tenant_select_invoice_config" ON restaurant_invoice_config FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_select_customer_fiscal" ON restaurant_customer_fiscal_data FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_select_invoices" ON restaurant_invoices FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_select_invoice_items" ON restaurant_invoice_items FOR SELECT TO authenticated
    USING (invoice_id IN (
        SELECT id FROM restaurant_invoices
        WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
    ));

CREATE POLICY "tenant_select_extractions" ON restaurant_ticket_extractions FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_select_templates" ON restaurant_invoice_templates FOR SELECT TO authenticated
    USING (tenant_id IS NULL OR tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_select_audit" ON restaurant_invoice_audit_log FOR SELECT TO authenticated
    USING (invoice_id IN (
        SELECT id FROM restaurant_invoices
        WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
    ));

-- Admin/owner can manage
CREATE POLICY "admin_manage_invoice_config" ON restaurant_invoice_config FOR ALL TO authenticated
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = true
    ));

CREATE POLICY "admin_manage_customer_fiscal" ON restaurant_customer_fiscal_data FOR ALL TO authenticated
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff') AND is_active = true
    ));

CREATE POLICY "admin_manage_invoices" ON restaurant_invoices FOR ALL TO authenticated
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff') AND is_active = true
    ));

CREATE POLICY "admin_manage_extractions" ON restaurant_ticket_extractions FOR ALL TO authenticated
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff') AND is_active = true
    ));

-- ======================
-- TRIGGERS
-- ======================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_invoice_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_config_timestamp
    BEFORE UPDATE ON restaurant_invoice_config
    FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

CREATE TRIGGER trigger_update_customer_fiscal_timestamp
    BEFORE UPDATE ON restaurant_customer_fiscal_data
    FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

CREATE TRIGGER trigger_update_invoices_timestamp
    BEFORE UPDATE ON restaurant_invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

CREATE TRIGGER trigger_update_extractions_timestamp
    BEFORE UPDATE ON restaurant_ticket_extractions
    FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

-- Auto-increment folio
CREATE OR REPLACE FUNCTION increment_invoice_folio()
RETURNS TRIGGER AS $$
DECLARE
    next_folio INTEGER;
BEGIN
    -- Get and increment folio atomically
    UPDATE restaurant_invoice_config
    SET folio_actual = folio_actual + 1
    WHERE tenant_id = NEW.tenant_id
    AND (branch_id = NEW.branch_id OR (branch_id IS NULL AND NEW.branch_id IS NOT NULL))
    RETURNING folio_actual INTO next_folio;

    -- If no config found, create one (shouldn't happen in production)
    IF next_folio IS NULL THEN
        next_folio := 1;
    END IF;

    NEW.folio := next_folio;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_invoice_folio
    BEFORE INSERT ON restaurant_invoices
    FOR EACH ROW
    WHEN (NEW.folio IS NULL OR NEW.folio = 0)
    EXECUTE FUNCTION increment_invoice_folio();

-- Update customer stats on invoice creation
CREATE OR REPLACE FUNCTION update_customer_fiscal_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'timbrada' AND (OLD IS NULL OR OLD.status != 'timbrada') THEN
        UPDATE restaurant_customer_fiscal_data
        SET
            invoices_count = invoices_count + 1,
            total_invoiced = total_invoiced + NEW.total,
            last_invoice_at = NOW()
        WHERE id = NEW.customer_fiscal_data_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_fiscal_stats
    AFTER INSERT OR UPDATE ON restaurant_invoices
    FOR EACH ROW EXECUTE FUNCTION update_customer_fiscal_stats();

-- Audit log trigger
CREATE OR REPLACE FUNCTION log_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO restaurant_invoice_audit_log (invoice_id, action, actor_id, new_values)
        VALUES (NEW.id, 'created', NEW.created_by, row_to_json(NEW)::jsonb);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO restaurant_invoice_audit_log (invoice_id, action, actor_id, old_values, new_values)
        VALUES (
            NEW.id,
            CASE
                WHEN NEW.status != OLD.status THEN 'status_' || NEW.status
                ELSE 'updated'
            END,
            auth.uid(),
            row_to_json(OLD)::jsonb,
            row_to_json(NEW)::jsonb
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_invoice_changes
    AFTER INSERT OR UPDATE ON restaurant_invoices
    FOR EACH ROW EXECUTE FUNCTION log_invoice_changes();

-- ======================
-- STORAGE BUCKET
-- ======================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'invoices',
    'invoices',
    false,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/xml', 'text/xml']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
CREATE POLICY "Staff can upload to invoices bucket" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'invoices'
        AND (storage.foldername(name))[1] IN (
            SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Staff can view invoices files" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'invoices'
        AND (storage.foldername(name))[1] IN (
            SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can delete invoices files" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'invoices'
        AND (storage.foldername(name))[1] IN (
            SELECT tenant_id::text FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )
    );

-- ======================
-- DEFAULT INVOICE TEMPLATE
-- ======================
INSERT INTO restaurant_invoice_templates (name, description, html_template, css_styles, template_type, is_default)
VALUES (
    'Default CFDI Template',
    'Plantilla estándar para facturas CFDI 4.0 en México',
    '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura {{serie}}-{{folio}}</title>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            {{#if logo_url}}
            <img src="{{logo_url}}" alt="Logo" class="logo" />
            {{/if}}
            <div class="company-info">
                <h1>{{emisor_nombre}}</h1>
                <p>RFC: {{emisor_rfc}}</p>
                <p>{{emisor_direccion}}</p>
            </div>
        </div>

        <!-- Invoice Info -->
        <div class="invoice-info">
            <h2>FACTURA</h2>
            <table>
                <tr><td>Serie:</td><td>{{serie}}</td></tr>
                <tr><td>Folio:</td><td>{{folio}}</td></tr>
                <tr><td>Fecha:</td><td>{{fecha_emision}}</td></tr>
                {{#if folio_fiscal}}
                <tr><td>UUID:</td><td class="uuid">{{folio_fiscal}}</td></tr>
                {{/if}}
            </table>
        </div>

        <!-- Customer Info -->
        <div class="customer-info">
            <h3>DATOS DEL RECEPTOR</h3>
            <p><strong>{{receptor_nombre}}</strong></p>
            <p>RFC: {{receptor_rfc}}</p>
            <p>C.P.: {{receptor_codigo_postal}}</p>
            <p>Régimen Fiscal: {{receptor_regimen_fiscal}}</p>
            <p>Uso CFDI: {{receptor_uso_cfdi}}</p>
        </div>

        <!-- Items -->
        <div class="items">
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Cantidad</th>
                        <th>Descripción</th>
                        <th>Precio Unitario</th>
                        <th>Importe</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each items}}
                    <tr>
                        <td>{{cantidad}}</td>
                        <td>{{descripcion}}</td>
                        <td>${{valor_unitario}}</td>
                        <td>${{importe}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>

        <!-- Totals -->
        <div class="totals">
            <table>
                <tr><td>Subtotal:</td><td>${{subtotal}}</td></tr>
                <tr><td>IVA (16%):</td><td>${{iva_trasladado}}</td></tr>
                {{#if descuento}}
                <tr><td>Descuento:</td><td>-${{descuento}}</td></tr>
                {{/if}}
                <tr class="total"><td>TOTAL:</td><td>${{total}} {{moneda}}</td></tr>
            </table>
        </div>

        <!-- Payment Info -->
        <div class="payment-info">
            <p><strong>Forma de Pago:</strong> {{forma_pago_desc}}</p>
            <p><strong>Método de Pago:</strong> {{metodo_pago_desc}}</p>
        </div>

        <!-- QR Code placeholder -->
        {{#if qr_code}}
        <div class="qr-section">
            <img src="{{qr_code}}" alt="QR Code" class="qr-code" />
            <p class="small">Verifique este CFDI en: https://verificacfdi.facturaelectronica.sat.gob.mx</p>
        </div>
        {{/if}}

        <!-- Sellos -->
        {{#if sello_emisor}}
        <div class="sellos">
            <p class="small"><strong>Sello del Emisor:</strong></p>
            <p class="sello-text">{{sello_emisor}}</p>
            <p class="small"><strong>Sello del SAT:</strong></p>
            <p class="sello-text">{{sello_sat}}</p>
        </div>
        {{/if}}

        <!-- Footer -->
        <div class="footer">
            <p>Este documento es una representación impresa de un CFDI</p>
        </div>
    </div>
</body>
</html>',
    '.invoice-container { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 20px; }
.logo { max-height: 80px; }
.company-info h1 { margin: 0; font-size: 24px; color: #333; }
.invoice-info { text-align: right; margin-bottom: 20px; }
.invoice-info h2 { color: #e74c3c; margin: 0; }
.uuid { font-family: monospace; font-size: 10px; word-break: break-all; }
.customer-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
.customer-info h3 { margin-top: 0; color: #333; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
.items-table th { background: #333; color: white; }
.items-table tbody tr:nth-child(even) { background: #f9f9f9; }
.totals { text-align: right; margin-bottom: 20px; }
.totals table { margin-left: auto; }
.totals td { padding: 5px 15px; }
.totals .total { font-weight: bold; font-size: 18px; background: #333; color: white; }
.qr-section { text-align: center; margin: 20px 0; }
.qr-code { max-width: 150px; }
.sellos { font-size: 8px; word-break: break-all; margin-top: 20px; }
.sello-text { font-family: monospace; background: #f5f5f5; padding: 5px; overflow-wrap: break-word; }
.footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
.small { font-size: 10px; color: #666; }',
    'invoice',
    true
)
ON CONFLICT DO NOTHING;

-- ======================
-- RPC FUNCTIONS
-- ======================

-- Get invoice configuration for a tenant
CREATE OR REPLACE FUNCTION get_invoice_config(p_tenant_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    rfc VARCHAR,
    razon_social VARCHAR,
    regimen_fiscal VARCHAR,
    codigo_postal VARCHAR,
    serie VARCHAR,
    folio_actual INTEGER,
    uso_cfdi_default VARCHAR,
    forma_pago_default VARCHAR,
    metodo_pago_default VARCHAR,
    moneda_default VARCHAR,
    tasa_iva DECIMAL,
    tasa_ieps DECIMAL,
    pac_provider VARCHAR,
    pac_environment VARCHAR,
    pdf_template VARCHAR,
    logo_url TEXT,
    auto_send_email BOOLEAN,
    require_rfc_validation BOOLEAN,
    allow_generic_rfc BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.rfc,
        c.razon_social,
        c.regimen_fiscal,
        c.codigo_postal,
        c.serie,
        c.folio_actual,
        c.uso_cfdi_default,
        c.forma_pago_default,
        c.metodo_pago_default,
        c.moneda_default,
        c.tasa_iva,
        c.tasa_ieps,
        c.pac_provider,
        c.pac_environment,
        c.pdf_template,
        c.logo_url,
        c.auto_send_email,
        c.require_rfc_validation,
        c.allow_generic_rfc
    FROM restaurant_invoice_config c
    WHERE c.tenant_id = p_tenant_id
    AND (c.branch_id = p_branch_id OR (c.branch_id IS NULL AND p_branch_id IS NOT NULL))
    AND c.is_active = true
    ORDER BY c.branch_id NULLS LAST
    LIMIT 1;
END;
$$;

-- Get invoice statistics for a tenant
CREATE OR REPLACE FUNCTION get_invoice_statistics(
    p_tenant_id UUID,
    p_branch_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_invoices BIGINT,
    total_amount DECIMAL,
    invoices_timbradas BIGINT,
    invoices_canceladas BIGINT,
    invoices_pendientes BIGINT,
    avg_invoice_amount DECIMAL,
    invoices_by_day JSONB,
    top_customers JSONB
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH invoice_data AS (
        SELECT
            i.id,
            i.total,
            i.status,
            i.fecha_emision::date as fecha,
            i.receptor_rfc,
            i.receptor_nombre
        FROM restaurant_invoices i
        WHERE i.tenant_id = p_tenant_id
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        AND (p_start_date IS NULL OR i.fecha_emision::date >= p_start_date)
        AND (p_end_date IS NULL OR i.fecha_emision::date <= p_end_date)
    ),
    by_day AS (
        SELECT fecha, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
        FROM invoice_data
        GROUP BY fecha
        ORDER BY fecha
    ),
    top_cust AS (
        SELECT receptor_rfc, receptor_nombre, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
        FROM invoice_data
        GROUP BY receptor_rfc, receptor_nombre
        ORDER BY amount DESC
        LIMIT 10
    )
    SELECT
        COUNT(*)::BIGINT as total_invoices,
        COALESCE(SUM(total), 0)::DECIMAL as total_amount,
        COUNT(*) FILTER (WHERE status = 'timbrada')::BIGINT as invoices_timbradas,
        COUNT(*) FILTER (WHERE status = 'cancelada')::BIGINT as invoices_canceladas,
        COUNT(*) FILTER (WHERE status IN ('draft', 'pending'))::BIGINT as invoices_pendientes,
        COALESCE(AVG(total), 0)::DECIMAL as avg_invoice_amount,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', fecha, 'count', count, 'amount', amount)), '[]'::jsonb) FROM by_day),
        (SELECT COALESCE(jsonb_agg(jsonb_build_object('rfc', receptor_rfc, 'nombre', receptor_nombre, 'count', count, 'amount', amount)), '[]'::jsonb) FROM top_cust)
    FROM invoice_data;
END;
$$;

-- ======================
-- COMMENTS
-- ======================
COMMENT ON TABLE restaurant_invoice_config IS 'Configuration for invoice generation per tenant/branch';
COMMENT ON TABLE restaurant_customer_fiscal_data IS 'Customer RFC and fiscal data for invoicing';
COMMENT ON TABLE restaurant_invoices IS 'Generated CFDI invoices';
COMMENT ON TABLE restaurant_invoice_items IS 'Line items (conceptos) for each invoice';
COMMENT ON TABLE restaurant_ticket_extractions IS 'AI-processed ticket images and extraction results';
COMMENT ON TABLE restaurant_invoice_templates IS 'Customizable PDF templates for invoices';
COMMENT ON TABLE restaurant_invoice_audit_log IS 'Audit trail for all invoice operations';
