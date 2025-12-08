-- =====================================================
-- 005_patients_module.sql
-- =====================================================
-- Módulo de Pacientes para TIS TIS Platform
-- Convierte leads exitosos en pacientes con historial clínico

-- =====================================================
-- TABLE: patients
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Información básica (heredada de lead)
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),

  -- Dirección
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(100) DEFAULT 'México',

  -- Información médica básica
  blood_type VARCHAR(10),
  allergies TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relationship VARCHAR(100),

  -- Información dental
  preferred_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  assigned_dentist_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  insurance_provider VARCHAR(200),
  insurance_policy_number VARCHAR(100),

  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  patient_number VARCHAR(50) UNIQUE, -- Auto-generated patient number

  -- Metadata
  notes TEXT,
  tags TEXT[], -- ['vip', 'high_value', 'special_needs', etc.]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_patients_tenant ON public.patients(tenant_id);
CREATE INDEX idx_patients_lead ON public.patients(lead_id);
CREATE INDEX idx_patients_phone ON public.patients(phone);
CREATE INDEX idx_patients_email ON public.patients(email);
CREATE INDEX idx_patients_branch ON public.patients(preferred_branch_id);
CREATE INDEX idx_patients_dentist ON public.patients(assigned_dentist_id);
CREATE INDEX idx_patients_status ON public.patients(status);
CREATE INDEX idx_patients_patient_number ON public.patients(patient_number);
CREATE INDEX idx_patients_created_at ON public.patients(created_at DESC);

-- =====================================================
-- TABLE: clinical_history
-- =====================================================
CREATE TABLE IF NOT EXISTS public.clinical_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

  -- Visit information
  visit_date TIMESTAMPTZ NOT NULL,
  dentist_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

  -- Clinical data
  chief_complaint TEXT, -- Motivo de consulta
  diagnosis TEXT, -- Diagnóstico
  treatment_provided TEXT, -- Tratamiento realizado
  treatment_plan TEXT, -- Plan de tratamiento futuro
  prescriptions TEXT, -- Recetas médicas

  -- Dental chart (odontograma)
  dental_chart JSONB, -- { "tooth_18": { "status": "missing", "notes": "" }, ... }

  -- Vitals
  blood_pressure VARCHAR(20),
  heart_rate INTEGER,
  temperature DECIMAL(4,1),

  -- Files references
  files UUID[], -- Referencias a archivos (radiografías, fotos, documentos)

  -- Metadata
  notes TEXT,
  next_appointment_recommended DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_clinical_history_tenant ON public.clinical_history(tenant_id);
CREATE INDEX idx_clinical_history_patient ON public.clinical_history(patient_id);
CREATE INDEX idx_clinical_history_appointment ON public.clinical_history(appointment_id);
CREATE INDEX idx_clinical_history_dentist ON public.clinical_history(dentist_id);
CREATE INDEX idx_clinical_history_visit_date ON public.clinical_history(visit_date DESC);
CREATE INDEX idx_clinical_history_created_at ON public.clinical_history(created_at DESC);

-- =====================================================
-- TABLE: patient_files
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinical_history_id UUID REFERENCES public.clinical_history(id) ON DELETE SET NULL,

  -- File information
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100), -- 'radiography', 'photo', 'document', 'prescription', 'consent_form'
  file_category VARCHAR(100), -- 'clinical', 'administrative', 'legal'
  mime_type VARCHAR(100),
  file_size_bytes BIGINT,

  -- Storage
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  storage_bucket VARCHAR(100) DEFAULT 'patient-files',

  -- Metadata
  description TEXT,
  tags TEXT[],
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_patient_files_tenant ON public.patient_files(tenant_id);
CREATE INDEX idx_patient_files_patient ON public.patient_files(patient_id);
CREATE INDEX idx_patient_files_clinical_history ON public.patient_files(clinical_history_id);
CREATE INDEX idx_patient_files_type ON public.patient_files(file_type);
CREATE INDEX idx_patient_files_category ON public.patient_files(file_category);
CREATE INDEX idx_patient_files_created_at ON public.patient_files(created_at DESC);

-- =====================================================
-- FUNCTION: Generate Patient Number
-- =====================================================
CREATE OR REPLACE FUNCTION generate_patient_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_prefix VARCHAR(10);
  next_number INTEGER;
  new_patient_number VARCHAR(50);
BEGIN
  -- Get tenant prefix (first 3 letters of tenant name, uppercase)
  SELECT UPPER(LEFT(name, 3)) INTO tenant_prefix
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Get next patient number for this tenant
  SELECT COALESCE(MAX(CAST(SUBSTRING(patient_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.patients
  WHERE tenant_id = NEW.tenant_id
    AND patient_number LIKE tenant_prefix || '%';

  -- Generate new patient number: PREFIX-000001
  new_patient_number := tenant_prefix || '-' || LPAD(next_number::TEXT, 6, '0');

  NEW.patient_number := new_patient_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate patient number
CREATE TRIGGER trg_generate_patient_number
BEFORE INSERT ON public.patients
FOR EACH ROW
WHEN (NEW.patient_number IS NULL)
EXECUTE FUNCTION generate_patient_number();

-- =====================================================
-- FUNCTION: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_clinical_history_updated_at
BEFORE UPDATE ON public.clinical_history
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_patient_files_updated_at
BEFORE UPDATE ON public.patient_files
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES: patients
-- =====================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super Admin can manage all patients"
ON public.patients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

-- Admin: Full access to their tenant
CREATE POLICY "Admin can manage tenant patients"
ON public.patients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = patients.tenant_id
      AND ur.role = 'admin'
  )
);

-- Receptionist: Read/Create/Update patients in their tenant
CREATE POLICY "Receptionist can manage tenant patients"
ON public.patients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = patients.tenant_id
      AND ur.role IN ('receptionist', 'dentist', 'specialist')
  )
);

-- =====================================================
-- RLS POLICIES: clinical_history
-- =====================================================
ALTER TABLE public.clinical_history ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super Admin can manage all clinical history"
ON public.clinical_history FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

-- Admin: Full access to their tenant
CREATE POLICY "Admin can manage tenant clinical history"
ON public.clinical_history FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = clinical_history.tenant_id
      AND ur.role = 'admin'
  )
);

-- Dentist/Specialist: Read all, create/update own records
CREATE POLICY "Dentist can read all tenant clinical history"
ON public.clinical_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = clinical_history.tenant_id
      AND ur.role IN ('dentist', 'specialist')
  )
);

CREATE POLICY "Dentist can create clinical history"
ON public.clinical_history FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = clinical_history.tenant_id
      AND ur.role IN ('dentist', 'specialist')
  )
);

CREATE POLICY "Dentist can update own clinical history"
ON public.clinical_history FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = clinical_history.tenant_id
      AND ur.role IN ('admin', 'super_admin')
  )
);

-- Receptionist: Read only
CREATE POLICY "Receptionist can read tenant clinical history"
ON public.clinical_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = clinical_history.tenant_id
      AND ur.role = 'receptionist'
  )
);

-- =====================================================
-- RLS POLICIES: patient_files
-- =====================================================
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super Admin can manage all patient files"
ON public.patient_files FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
);

-- Admin: Full access to their tenant
CREATE POLICY "Admin can manage tenant patient files"
ON public.patient_files FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = patient_files.tenant_id
      AND ur.role = 'admin'
  )
);

-- Dentist/Specialist/Receptionist: Full access to tenant files
CREATE POLICY "Staff can manage tenant patient files"
ON public.patient_files FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = patient_files.tenant_id
      AND ur.role IN ('dentist', 'specialist', 'receptionist')
  )
);

-- =====================================================
-- VIEWS: Useful patient views
-- =====================================================

-- View: Patients with full information
CREATE OR REPLACE VIEW public.patients_full AS
SELECT
  p.*,
  b.name as branch_name,
  b.address as branch_address,
  sm.first_name || ' ' || sm.last_name as dentist_name,
  COUNT(DISTINCT a.id) as total_appointments,
  COUNT(DISTINCT ch.id) as total_clinical_records,
  MAX(ch.visit_date) as last_visit_date
FROM public.patients p
LEFT JOIN public.branches b ON p.preferred_branch_id = b.id
LEFT JOIN public.staff_members sm ON p.assigned_dentist_id = sm.id
LEFT JOIN public.appointments a ON a.lead_id = p.lead_id
LEFT JOIN public.clinical_history ch ON ch.patient_id = p.id
GROUP BY p.id, b.name, b.address, sm.first_name, sm.last_name;

-- View: Clinical history summary
CREATE OR REPLACE VIEW public.clinical_history_summary AS
SELECT
  ch.*,
  p.first_name || ' ' || p.last_name as patient_name,
  p.patient_number,
  sm.first_name || ' ' || sm.last_name as dentist_name,
  b.name as branch_name
FROM public.clinical_history ch
JOIN public.patients p ON ch.patient_id = p.id
LEFT JOIN public.staff_members sm ON ch.dentist_id = sm.id
LEFT JOIN public.branches b ON ch.branch_id = b.id;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.patients IS 'Pacientes registrados en el sistema (convertidos desde leads)';
COMMENT ON TABLE public.clinical_history IS 'Historial clínico dental de cada paciente';
COMMENT ON TABLE public.patient_files IS 'Archivos asociados a pacientes (radiografías, documentos, fotos)';
COMMENT ON COLUMN public.patients.patient_number IS 'Número único de paciente auto-generado (ej: ESV-000001)';
COMMENT ON COLUMN public.clinical_history.dental_chart IS 'Odontograma en formato JSON';
COMMENT ON COLUMN public.patient_files.storage_path IS 'Ruta del archivo en Supabase Storage';
