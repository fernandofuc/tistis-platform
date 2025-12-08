-- =====================================================
-- 006_quotes_module.sql
-- =====================================================
-- Módulo de Cotizaciones para TIS TIS Platform
-- Genera cotizaciones profesionales con PDF para pacientes/leads

-- =====================================================
-- TABLE: quotes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Quote identification
  quote_number VARCHAR(50) UNIQUE, -- Auto-generated: QUO-000001
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Related entities
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by_staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,

  -- Financial information
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  tax_percentage DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'MXN',

  -- Status and workflow
  status VARCHAR(50) DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')
  ),
  valid_until DATE, -- Fecha de expiración de la cotización

  -- Communication
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- PDF generation
  pdf_url TEXT, -- URL del PDF generado en Supabase Storage
  pdf_generated_at TIMESTAMPTZ,

  -- Notes
  terms_and_conditions TEXT,
  internal_notes TEXT,
  patient_notes TEXT, -- Notas visibles para el paciente

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_quotes_tenant ON public.quotes(tenant_id);
CREATE INDEX idx_quotes_patient ON public.quotes(patient_id);
CREATE INDEX idx_quotes_lead ON public.quotes(lead_id);
CREATE INDEX idx_quotes_branch ON public.quotes(branch_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_quote_number ON public.quotes(quote_number);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at DESC);
CREATE INDEX idx_quotes_valid_until ON public.quotes(valid_until);

-- =====================================================
-- TABLE: quote_items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,

  -- Item details
  item_type VARCHAR(50) DEFAULT 'service' CHECK (item_type IN ('service', 'product', 'custom')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  subtotal DECIMAL(12, 2) NOT NULL, -- quantity * unit_price - discount

  -- Ordering
  display_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX idx_quote_items_service ON public.quote_items(service_id);
CREATE INDEX idx_quote_items_display_order ON public.quote_items(quote_id, display_order);

-- =====================================================
-- TABLE: quote_payment_plans
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quote_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,

  -- Plan details
  plan_name VARCHAR(255) NOT NULL, -- "Plan A: Pago completo", "Plan B: 3 meses sin intereses"
  description TEXT,
  total_amount DECIMAL(12, 2) NOT NULL,
  number_of_payments INTEGER NOT NULL CHECK (number_of_payments > 0),
  payment_amount DECIMAL(12, 2) NOT NULL, -- Monto por pago
  payment_frequency VARCHAR(50) DEFAULT 'monthly' CHECK (
    payment_frequency IN ('weekly', 'biweekly', 'monthly', 'custom')
  ),

  -- Discounts for upfront payment
  upfront_discount_percentage DECIMAL(5, 2) DEFAULT 0,
  upfront_discount_amount DECIMAL(12, 2) DEFAULT 0,

  -- Interest (if applicable)
  interest_rate DECIMAL(5, 2) DEFAULT 0,

  -- Ordering
  display_order INTEGER DEFAULT 0,
  is_recommended BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quote_payment_plans_quote ON public.quote_payment_plans(quote_id);
CREATE INDEX idx_quote_payment_plans_display_order ON public.quote_payment_plans(quote_id, display_order);

-- =====================================================
-- FUNCTION: Generate Quote Number
-- =====================================================
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_prefix VARCHAR(10);
  next_number INTEGER;
  new_quote_number VARCHAR(50);
BEGIN
  -- Get tenant prefix
  SELECT UPPER(LEFT(name, 3)) INTO tenant_prefix
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Get next quote number for this tenant
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE tenant_id = NEW.tenant_id
    AND quote_number LIKE 'QUO-' || tenant_prefix || '%';

  -- Generate new quote number: QUO-PREFIX-000001
  new_quote_number := 'QUO-' || tenant_prefix || '-' || LPAD(next_number::TEXT, 6, '0');

  NEW.quote_number := new_quote_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate quote number
CREATE TRIGGER trg_generate_quote_number
BEFORE INSERT ON public.quotes
FOR EACH ROW
WHEN (NEW.quote_number IS NULL)
EXECUTE FUNCTION generate_quote_number();

-- =====================================================
-- FUNCTION: Calculate Quote Totals
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  quote_subtotal DECIMAL(12, 2);
  quote_discount DECIMAL(12, 2);
  quote_tax DECIMAL(12, 2);
  quote_total DECIMAL(12, 2);
BEGIN
  -- Calculate subtotal from items
  SELECT COALESCE(SUM(subtotal), 0)
  INTO quote_subtotal
  FROM public.quote_items
  WHERE quote_id = NEW.id;

  -- Calculate discount
  IF NEW.discount_percentage > 0 THEN
    quote_discount := quote_subtotal * (NEW.discount_percentage / 100);
  ELSE
    quote_discount := NEW.discount_amount;
  END IF;

  -- Calculate tax (after discount)
  quote_tax := (quote_subtotal - quote_discount) * (NEW.tax_percentage / 100);

  -- Calculate total
  quote_total := quote_subtotal - quote_discount + quote_tax;

  -- Update quote
  UPDATE public.quotes
  SET
    subtotal = quote_subtotal,
    discount_amount = quote_discount,
    tax_amount = quote_tax,
    total = quote_total
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals when items change
CREATE TRIGGER trg_recalculate_quote_totals_insert
AFTER INSERT ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION calculate_quote_totals();

CREATE TRIGGER trg_recalculate_quote_totals_update
AFTER UPDATE ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION calculate_quote_totals();

CREATE TRIGGER trg_recalculate_quote_totals_delete
AFTER DELETE ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION calculate_quote_totals();

-- =====================================================
-- FUNCTION: Update updated_at timestamp
-- =====================================================
CREATE TRIGGER trg_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES: quotes
-- =====================================================
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super Admin can manage all quotes"
ON public.quotes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

-- Admin: Full access to their tenant
CREATE POLICY "Admin can manage tenant quotes"
ON public.quotes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = quotes.tenant_id
      AND ur.role = 'admin'
  )
);

-- Staff: Full access to tenant quotes
CREATE POLICY "Staff can manage tenant quotes"
ON public.quotes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = quotes.tenant_id
      AND ur.role IN ('receptionist', 'dentist', 'specialist')
  )
);

-- =====================================================
-- RLS POLICIES: quote_items
-- =====================================================
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super Admin can manage all quote items"
ON public.quote_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

-- Staff: Full access via quote
CREATE POLICY "Staff can manage tenant quote items"
ON public.quote_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.user_roles ur ON ur.tenant_id = q.tenant_id
    WHERE q.id = quote_items.quote_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist')
  )
);

-- =====================================================
-- RLS POLICIES: quote_payment_plans
-- =====================================================
ALTER TABLE public.quote_payment_plans ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super Admin can manage all quote payment plans"
ON public.quote_payment_plans FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

-- Staff: Full access via quote
CREATE POLICY "Staff can manage tenant quote payment plans"
ON public.quote_payment_plans FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.user_roles ur ON ur.tenant_id = q.tenant_id
    WHERE q.id = quote_payment_plans.quote_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist')
  )
);

-- =====================================================
-- VIEWS: Useful quote views
-- =====================================================

-- View: Quotes with full information
CREATE OR REPLACE VIEW public.quotes_full AS
SELECT
  q.*,
  CASE
    WHEN q.patient_id IS NOT NULL THEN p.first_name || ' ' || p.last_name
    WHEN q.lead_id IS NOT NULL THEN l.name
    ELSE 'Sin asignar'
  END as client_name,
  CASE
    WHEN q.patient_id IS NOT NULL THEN p.phone
    WHEN q.lead_id IS NOT NULL THEN l.phone
    ELSE NULL
  END as client_phone,
  b.name as branch_name,
  sm.first_name || ' ' || sm.last_name as created_by_name,
  COUNT(DISTINCT qi.id) as items_count,
  COUNT(DISTINCT qpp.id) as payment_plans_count
FROM public.quotes q
LEFT JOIN public.patients p ON q.patient_id = p.id
LEFT JOIN public.leads l ON q.lead_id = l.id
LEFT JOIN public.branches b ON q.branch_id = b.id
LEFT JOIN public.staff_members sm ON q.created_by_staff_id = sm.id
LEFT JOIN public.quote_items qi ON qi.quote_id = q.id
LEFT JOIN public.quote_payment_plans qpp ON qpp.quote_id = q.id
GROUP BY q.id, p.first_name, p.last_name, p.phone, l.name, l.phone, b.name, sm.first_name, sm.last_name;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.quotes IS 'Cotizaciones generadas para pacientes y leads';
COMMENT ON TABLE public.quote_items IS 'Ítems individuales de cada cotización (servicios, productos)';
COMMENT ON TABLE public.quote_payment_plans IS 'Planes de pago disponibles para cada cotización';
COMMENT ON COLUMN public.quotes.quote_number IS 'Número único de cotización auto-generado (ej: QUO-ESV-000001)';
COMMENT ON COLUMN public.quotes.pdf_url IS 'URL del PDF generado en Supabase Storage';
COMMENT ON COLUMN public.quote_items.subtotal IS 'Subtotal del item: quantity * unit_price - discount';
