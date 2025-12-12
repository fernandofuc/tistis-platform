/**
 * TIS TIS - Admin API: Fix RLS Recursion
 *
 * Este endpoint ejecuta el fix para el error de recursión infinita
 * en las políticas RLS de user_roles.
 *
 * Uso: POST /api/admin/fix-rls
 *
 * IMPORTANTE: Este endpoint solo debe usarse una vez para arreglar el error.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client with service role
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(`Missing env vars: URL=${!!url}, SERVICE_KEY=${!!serviceKey}`);
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: NextRequest) {
  console.log('🔧 [FixRLS] Starting RLS fix...');

  try {
    const supabase = getSupabaseAdmin();

    // SQL para arreglar el error de recursión
    const fixSQL = `
      -- =====================================================
      -- FIX RLS RECURSION IN user_roles
      -- =====================================================

      -- Función que obtiene tenant_id del JWT token (NO consulta user_roles)
      CREATE OR REPLACE FUNCTION public.get_jwt_tenant_id()
      RETURNS UUID AS $$
      BEGIN
          RETURN (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
      EXCEPTION
          WHEN OTHERS THEN
              RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

      -- Función que verifica rol del JWT (NO consulta user_roles)
      CREATE OR REPLACE FUNCTION public.get_jwt_role()
      RETURNS TEXT AS $$
      BEGIN
          RETURN auth.jwt() -> 'user_metadata' ->> 'role';
      EXCEPTION
          WHEN OTHERS THEN
              RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

      -- Función simplificada para verificar si es admin (basada en JWT)
      CREATE OR REPLACE FUNCTION public.is_jwt_admin()
      RETURNS BOOLEAN AS $$
      DECLARE
          v_role TEXT;
      BEGIN
          v_role := public.get_jwt_role();
          RETURN v_role IN ('super_admin', 'admin', 'owner');
      EXCEPTION
          WHEN OTHERS THEN
              RETURN FALSE;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

      -- Eliminar políticas problemáticas
      DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
      DROP POLICY IF EXISTS "Admins can manage tenant user_roles" ON public.user_roles;

      -- Nueva política: Users pueden ver SUS PROPIOS roles (no recursiva)
      CREATE POLICY "Users can view their own roles" ON public.user_roles
          FOR SELECT USING (
              user_id = auth.uid()
          );

      -- Nueva política: Admins pueden gestionar roles de su tenant (usando JWT)
      CREATE POLICY "Admins can manage tenant user_roles" ON public.user_roles
          FOR ALL USING (
              public.get_jwt_role() = 'super_admin'
              OR
              (
                  public.is_jwt_admin()
                  AND tenant_id = public.get_jwt_tenant_id()
              )
          );

      -- Actualizar get_user_tenant_id para priorizar JWT y evitar recursión
      CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID DEFAULT NULL)
      RETURNS UUID AS $$
      DECLARE
          v_tenant_id UUID;
          v_user_id UUID;
      BEGIN
          v_user_id := COALESCE(p_user_id, auth.uid());

          IF v_user_id IS NULL THEN
              RETURN NULL;
          END IF;

          IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
              v_tenant_id := public.get_jwt_tenant_id();
              IF v_tenant_id IS NOT NULL THEN
                  RETURN v_tenant_id;
              END IF;
          END IF;

          SELECT tenant_id INTO v_tenant_id
          FROM public.user_roles
          WHERE user_id = v_user_id
          AND is_active = true
          LIMIT 1;

          RETURN v_tenant_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

      -- Actualizar is_super_admin para priorizar JWT
      CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT NULL)
      RETURNS BOOLEAN AS $$
      DECLARE
          v_user_id UUID;
      BEGIN
          v_user_id := COALESCE(p_user_id, auth.uid());

          IF v_user_id IS NULL THEN
              RETURN FALSE;
          END IF;

          IF (p_user_id IS NULL OR p_user_id = auth.uid())
             AND public.get_jwt_role() = 'super_admin' THEN
              RETURN TRUE;
          END IF;

          RETURN EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = v_user_id
              AND role = 'super_admin'
              AND is_active = true
          );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

      -- Actualizar has_tenant_access para priorizar JWT
      CREATE OR REPLACE FUNCTION public.has_tenant_access(p_tenant_id UUID, p_user_id UUID DEFAULT NULL)
      RETURNS BOOLEAN AS $$
      DECLARE
          v_user_id UUID;
          v_jwt_tenant UUID;
      BEGIN
          v_user_id := COALESCE(p_user_id, auth.uid());

          IF v_user_id IS NULL THEN
              RETURN FALSE;
          END IF;

          IF (p_user_id IS NULL OR p_user_id = auth.uid())
             AND public.get_jwt_role() = 'super_admin' THEN
              RETURN TRUE;
          END IF;

          IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
              v_jwt_tenant := public.get_jwt_tenant_id();
              IF v_jwt_tenant IS NOT NULL AND v_jwt_tenant = p_tenant_id THEN
                  RETURN TRUE;
              END IF;
          END IF;

          RETURN EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = v_user_id
              AND tenant_id = p_tenant_id
              AND is_active = true
          );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
    `;

    // Ejecutar el SQL usando la función rpc (si existe) o raw query
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: fixSQL }).single();

    // Si rpc no existe, intentar con la API de management
    if (sqlError && sqlError.message.includes('function')) {
      console.log('⚠️ [FixRLS] rpc no disponible, ejecutando SQL directamente...');

      // Ejecutar cada statement por separado
      const statements = [
        // Función get_jwt_tenant_id
        `CREATE OR REPLACE FUNCTION public.get_jwt_tenant_id()
        RETURNS UUID AS $$
        BEGIN
            RETURN (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;`,

        // Función get_jwt_role
        `CREATE OR REPLACE FUNCTION public.get_jwt_role()
        RETURNS TEXT AS $$
        BEGIN
            RETURN auth.jwt() -> 'user_metadata' ->> 'role';
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;`,

        // Función is_jwt_admin
        `CREATE OR REPLACE FUNCTION public.is_jwt_admin()
        RETURNS BOOLEAN AS $$
        DECLARE
            v_role TEXT;
        BEGIN
            v_role := public.get_jwt_role();
            RETURN v_role IN ('super_admin', 'admin', 'owner');
        EXCEPTION
            WHEN OTHERS THEN
                RETURN FALSE;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;`,
      ];

      // No podemos ejecutar CREATE FUNCTION desde el cliente JS
      // Necesitamos usar el SQL Editor de Supabase
      return NextResponse.json({
        success: false,
        error: 'Cannot execute DDL from API',
        message: 'Por favor ejecuta el SQL manualmente en Supabase Dashboard',
        instructions: [
          '1. Ve a tu proyecto en https://supabase.com/dashboard',
          '2. Click en "SQL Editor" en el menú lateral',
          '3. Crea un nuevo query',
          '4. Copia y pega el contenido del archivo:',
          '   /supabase/migrations/014_fix_user_roles_rls.sql',
          '5. Ejecuta el SQL',
          '6. Cierra sesión y vuelve a iniciar sesión en TIS TIS',
        ],
        sql_file: '/supabase/migrations/014_fix_user_roles_rls.sql',
      });
    }

    if (sqlError) {
      console.error('❌ [FixRLS] SQL Error:', sqlError);
      return NextResponse.json(
        { error: 'SQL execution failed', details: sqlError },
        { status: 500 }
      );
    }

    console.log('✅ [FixRLS] RLS fix completed successfully');

    return NextResponse.json({
      success: true,
      message: 'RLS recursion fix applied successfully',
      next_steps: [
        '1. Cierra sesión completamente',
        '2. Vuelve a iniciar sesión',
        '3. El dashboard debería cargar correctamente ahora',
      ],
    });
  } catch (error) {
    console.error('💥 [FixRLS] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Unexpected error',
        details: error instanceof Error ? error.message : 'Unknown',
        instructions: [
          'Por favor ejecuta el SQL manualmente en Supabase Dashboard:',
          '1. Ve a tu proyecto en https://supabase.com/dashboard',
          '2. Click en "SQL Editor"',
          '3. Pega el contenido de /supabase/migrations/014_fix_user_roles_rls.sql',
          '4. Ejecuta el SQL',
        ],
      },
      { status: 500 }
    );
  }
}

// GET endpoint para ver el SQL que se debe ejecutar
export async function GET() {
  const sqlContent = `
-- =====================================================
-- FIX RLS RECURSION IN user_roles
-- Ejecuta este SQL en Supabase Dashboard > SQL Editor
-- =====================================================

-- Función que obtiene tenant_id del JWT token (NO consulta user_roles)
CREATE OR REPLACE FUNCTION public.get_jwt_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función que verifica rol del JWT (NO consulta user_roles)
CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS TEXT AS $$
BEGIN
    RETURN auth.jwt() -> 'user_metadata' ->> 'role';
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función simplificada para verificar si es admin (basada en JWT)
CREATE OR REPLACE FUNCTION public.is_jwt_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    v_role := public.get_jwt_role();
    RETURN v_role IN ('super_admin', 'admin', 'owner');
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage tenant user_roles" ON public.user_roles;

-- Nueva política: Users pueden ver SUS PROPIOS roles (no recursiva)
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- Nueva política: Admins pueden gestionar roles de su tenant (usando JWT)
CREATE POLICY "Admins can manage tenant user_roles" ON public.user_roles
    FOR ALL USING (
        public.get_jwt_role() = 'super_admin'
        OR
        (
            public.is_jwt_admin()
            AND tenant_id = public.get_jwt_tenant_id()
        )
    );

-- Actualizar get_user_tenant_id para priorizar JWT y evitar recursión
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
        v_tenant_id := public.get_jwt_tenant_id();
        IF v_tenant_id IS NOT NULL THEN
            RETURN v_tenant_id;
        END IF;
    END IF;

    SELECT tenant_id INTO v_tenant_id
    FROM public.user_roles
    WHERE user_id = v_user_id
    AND is_active = true
    LIMIT 1;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Actualizar is_super_admin para priorizar JWT
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF (p_user_id IS NULL OR p_user_id = auth.uid())
       AND public.get_jwt_role() = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_user_id
        AND role = 'super_admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Actualizar has_tenant_access para priorizar JWT
CREATE OR REPLACE FUNCTION public.has_tenant_access(p_tenant_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_jwt_tenant UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF (p_user_id IS NULL OR p_user_id = auth.uid())
       AND public.get_jwt_role() = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
        v_jwt_tenant := public.get_jwt_tenant_id();
        IF v_jwt_tenant IS NOT NULL AND v_jwt_tenant = p_tenant_id THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_user_id
        AND tenant_id = p_tenant_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Insertar registro en user_roles para usuarios existentes con staff
INSERT INTO public.user_roles (user_id, tenant_id, role, staff_id, is_active)
SELECT
    s.user_id,
    s.tenant_id,
    s.role,
    s.id,
    s.is_active
FROM public.staff s
WHERE s.user_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    staff_id = EXCLUDED.staff_id,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verificar resultado
SELECT 'FIX COMPLETADO' as status,
       (SELECT COUNT(*) FROM public.user_roles) as total_user_roles;
`;

  return new NextResponse(sqlContent, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
