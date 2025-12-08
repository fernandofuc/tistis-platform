-- =====================================================
-- 007_files_storage_setup.sql
-- =====================================================
-- Configuración de Supabase Storage para archivos de pacientes
-- Includes: Buckets, RLS policies, and helper functions

-- =====================================================
-- STORAGE BUCKETS (Execute in Supabase Dashboard)
-- =====================================================
-- Ejecutar estos comandos en la UI de Supabase Storage:
--
-- 1. patient-files (archivos de pacientes)
--    - Public: false
--    - Allowed MIME types: image/*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.*
--    - Max file size: 50MB
--
-- 2. quotes-pdf (PDFs de cotizaciones)
--    - Public: false
--    - Allowed MIME types: application/pdf
--    - Max file size: 10MB
--
-- 3. temp-uploads (archivos temporales)
--    - Public: false
--    - Max file size: 20MB
--    - Auto-delete after 24 hours

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Patient Files Bucket Policies
-- Authenticated users can upload to patient-files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-files',
  'patient-files',
  false,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[];

-- Quotes PDF Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotes-pdf',
  'quotes-pdf',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Temp Uploads Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'temp-uploads',
  'temp-uploads',
  false,
  20971520 -- 20MB
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- RLS POLICIES FOR STORAGE
-- =====================================================

-- Patient Files: Staff can upload/download/delete
CREATE POLICY "Staff can upload patient files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
  )
);

CREATE POLICY "Staff can read patient files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
  )
);

CREATE POLICY "Staff can delete patient files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
  )
);

-- Quotes PDF: Staff can upload/download
CREATE POLICY "Staff can upload quotes PDF"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotes-pdf'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
  )
);

CREATE POLICY "Staff can read quotes PDF"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quotes-pdf'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
  )
);

-- Temp Uploads: Anyone authenticated can upload
CREATE POLICY "Authenticated users can upload temp files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'temp-uploads');

CREATE POLICY "Users can read own temp files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'temp-uploads'
  AND owner = auth.uid()
);

CREATE POLICY "Users can delete own temp files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp-uploads'
  AND owner = auth.uid()
);

-- =====================================================
-- FUNCTION: Clean up old temp files (scheduled task)
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_temp_uploads()
RETURNS void AS $$
BEGIN
  -- Delete files older than 24 hours from temp-uploads bucket
  DELETE FROM storage.objects
  WHERE bucket_id = 'temp-uploads'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule this function to run daily (set up in Supabase Dashboard > Database > Functions > pg_cron)
-- SELECT cron.schedule('cleanup-temp-uploads', '0 2 * * *', 'SELECT cleanup_temp_uploads()');

-- =====================================================
-- FUNCTION: Get file URL with signed token
-- =====================================================
CREATE OR REPLACE FUNCTION get_signed_file_url(
  bucket_name TEXT,
  file_path TEXT,
  expires_in INTEGER DEFAULT 3600
)
RETURNS TEXT AS $$
DECLARE
  signed_url TEXT;
BEGIN
  -- Generate signed URL for private files
  -- This is a placeholder - actual implementation requires Supabase Storage API
  -- Use from client: supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION cleanup_temp_uploads() IS 'Limpia archivos temporales mayores a 24 horas';
COMMENT ON FUNCTION get_signed_file_url(TEXT, TEXT, INTEGER) IS 'Genera URL firmada para acceso temporal a archivos privados';
