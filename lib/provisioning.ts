/**
 * TIS TIS - Auto-Provisioning de Tenants
 *
 * Este módulo maneja la creación automática de:
 * - Tenant (micro-app del cliente)
 * - Branch principal
 * - Usuario admin en auth.users
 * - Staff record
 * - User role para permisos
 * - Configuración inicial según vertical
 *
 * Se ejecuta automáticamente después de que un cliente paga su suscripción.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================
// TYPES
// ============================================

export interface ProvisionTenantParams {
  client_id: string;
  customer_email: string;
  customer_name: string;
  vertical: 'dental' | 'restaurant' | 'pharmacy' | 'retail' | 'medical' | 'services' | 'other';
  plan: 'starter' | 'essentials' | 'growth' | 'scale';
  branches_count?: number;
  subscription_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionResult {
  success: boolean;
  tenant_id?: string;
  tenant_slug?: string;
  branch_id?: string;
  user_id?: string;
  staff_id?: string;
  temp_password?: string;
  error?: string;
  details?: Record<string, unknown>;
}

interface VerticalConfig {
  display_name: string;
  default_services: string[];
  sidebar_config: Record<string, unknown>[];
  default_faqs: { question: string; answer: string; category: string }[];
}

// ============================================
// SUPABASE ADMIN CLIENT
// ============================================

function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Genera un slug URL-friendly único
 */
function generateSlug(businessName: string): string {
  const baseSlug = businessName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres especiales con -
    .replace(/^-+|-+$/g, '') // Remover - al inicio y final
    .substring(0, 50); // Limitar longitud

  return baseSlug || 'tenant';
}

/**
 * Genera una contraseña temporal segura
 */
function generateTempPassword(): string {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  const randomBytes = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

/**
 * Obtiene la configuración por defecto para un vertical
 */
function getVerticalDefaults(vertical: string): VerticalConfig {
  const configs: Record<string, VerticalConfig> = {
    dental: {
      display_name: 'Clínica Dental',
      default_services: [
        'Limpieza Dental',
        'Consulta General',
        'Blanqueamiento',
        'Ortodoncia',
        'Implantes',
        'Endodoncia',
        'Extracción',
      ],
      sidebar_config: [
        { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard' },
        { id: 'leads', label: 'Leads', icon: 'Users', href: '/dashboard/leads' },
        { id: 'calendario', label: 'Calendario', icon: 'Calendar', href: '/dashboard/calendario' },
        { id: 'patients', label: 'Pacientes', icon: 'UserCheck', href: '/dashboard/patients' },
        { id: 'inbox', label: 'Inbox', icon: 'MessageSquare', href: '/dashboard/inbox' },
        { id: 'quotes', label: 'Cotizaciones', icon: 'FileText', href: '/dashboard/quotes' },
        { id: 'analytics', label: 'Analytics', icon: 'BarChart3', href: '/dashboard/analytics' },
        { id: 'settings', label: 'Configuración', icon: 'Settings', href: '/dashboard/settings' },
      ],
      default_faqs: [
        {
          question: '¿Cuánto cuesta una limpieza dental?',
          answer:
            'El costo de una limpieza dental varía según el tipo de limpieza necesaria. Te invitamos a agendar una valoración gratuita para darte un presupuesto exacto.',
          category: 'precios',
        },
        {
          question: '¿Aceptan seguros dentales?',
          answer:
            'Sí, trabajamos con la mayoría de los seguros dentales. Contáctanos con los datos de tu seguro para verificar la cobertura.',
          category: 'pagos',
        },
        {
          question: '¿Cuál es el horario de atención?',
          answer:
            'Nuestro horario es de Lunes a Viernes de 9:00 AM a 7:00 PM y Sábados de 9:00 AM a 2:00 PM.',
          category: 'general',
        },
      ],
    },
    restaurant: {
      display_name: 'Restaurante',
      default_services: ['Servicio en Mesa', 'Para Llevar', 'Delivery', 'Reservaciones', 'Eventos'],
      sidebar_config: [
        { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard' },
        { id: 'orders', label: 'Órdenes', icon: 'ShoppingBag', href: '/dashboard/orders' },
        { id: 'menu', label: 'Menú', icon: 'BookOpen', href: '/dashboard/menu' },
        { id: 'inventory', label: 'Inventario', icon: 'Package', href: '/dashboard/inventory' },
        { id: 'reservations', label: 'Reservaciones', icon: 'Calendar', href: '/dashboard/reservations' },
        { id: 'inbox', label: 'Mensajes', icon: 'MessageSquare', href: '/dashboard/inbox' },
        { id: 'analytics', label: 'Analytics', icon: 'BarChart3', href: '/dashboard/analytics' },
        { id: 'settings', label: 'Configuración', icon: 'Settings', href: '/dashboard/settings' },
      ],
      default_faqs: [
        {
          question: '¿Tienen servicio a domicilio?',
          answer: 'Sí, contamos con servicio de delivery. Puedes ordenar por WhatsApp o nuestra página web.',
          category: 'delivery',
        },
        {
          question: '¿Se puede hacer reservación?',
          answer:
            'Por supuesto, puedes hacer tu reservación por WhatsApp indicando fecha, hora y número de personas.',
          category: 'reservaciones',
        },
      ],
    },
    medical: {
      display_name: 'Clínica Médica',
      default_services: ['Consulta General', 'Especialidades', 'Laboratorio', 'Rayos X', 'Urgencias'],
      sidebar_config: [
        { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard' },
        { id: 'patients', label: 'Pacientes', icon: 'Users', href: '/dashboard/patients' },
        { id: 'calendario', label: 'Citas', icon: 'Calendar', href: '/dashboard/calendario' },
        { id: 'inbox', label: 'Mensajes', icon: 'MessageSquare', href: '/dashboard/inbox' },
        { id: 'analytics', label: 'Analytics', icon: 'BarChart3', href: '/dashboard/analytics' },
        { id: 'settings', label: 'Configuración', icon: 'Settings', href: '/dashboard/settings' },
      ],
      default_faqs: [
        {
          question: '¿Necesito cita previa?',
          answer:
            'Para consultas generales se recomienda agendar cita. Para urgencias, atendemos sin cita previa.',
          category: 'general',
        },
      ],
    },
    services: {
      display_name: 'Servicios Generales',
      default_services: ['Consultoría', 'Asesoría', 'Servicio a Domicilio', 'Cotizaciones'],
      sidebar_config: [
        { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/dashboard' },
        { id: 'leads', label: 'Leads', icon: 'Users', href: '/dashboard/leads' },
        { id: 'calendario', label: 'Citas', icon: 'Calendar', href: '/dashboard/calendario' },
        { id: 'inbox', label: 'Inbox', icon: 'MessageSquare', href: '/dashboard/inbox' },
        { id: 'quotes', label: 'Cotizaciones', icon: 'FileText', href: '/dashboard/quotes' },
        { id: 'analytics', label: 'Analytics', icon: 'BarChart3', href: '/dashboard/analytics' },
        { id: 'settings', label: 'Configuración', icon: 'Settings', href: '/dashboard/settings' },
      ],
      default_faqs: [
        {
          question: '¿Cómo puedo solicitar una cotización?',
          answer: 'Puedes solicitar una cotización por WhatsApp describiendo lo que necesitas y te responderemos a la brevedad.',
          category: 'cotizaciones',
        },
      ],
    },
  };

  return configs[vertical] || configs.services;
}

// ============================================
// MAIN PROVISIONING FUNCTION
// ============================================

/**
 * Provisiona un tenant completo para un nuevo cliente de TIS TIS
 *
 * Este proceso se ejecuta después de que el cliente paga su suscripción.
 * Crea todo lo necesario para que el cliente pueda usar su micro-app.
 */
export async function provisionTenant(params: ProvisionTenantParams): Promise<ProvisionResult> {
  const supabase = getSupabaseAdmin();
  const startTime = Date.now();

  console.log('🚀 [Provisioning] Starting tenant provisioning...');
  console.log('📋 [Provisioning] Params:', {
    client_id: params.client_id,
    email: params.customer_email,
    vertical: params.vertical,
    plan: params.plan,
    branches: params.branches_count,
  });

  try {
    // ============================================
    // STEP 1: Verificar que el client existe
    // ============================================
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', params.client_id)
      .single();

    if (clientError || !client) {
      console.error('❌ [Provisioning] Client not found:', clientError);
      return {
        success: false,
        error: 'Client not found',
        details: { client_id: params.client_id, error: clientError?.message },
      };
    }

    // Verificar si ya tiene tenant
    if (client.tenant_id) {
      console.log('⚠️ [Provisioning] Client already has tenant:', client.tenant_id);
      return {
        success: true,
        tenant_id: client.tenant_id,
        error: 'Client already provisioned',
      };
    }

    console.log('✅ [Provisioning] Client found:', client.id);

    // ============================================
    // STEP 2: Generar slug único
    // ============================================
    let slug = generateSlug(params.customer_name || client.business_name || 'tenant');
    let slugAttempt = 0;
    const maxAttempts = 10;

    while (slugAttempt < maxAttempts) {
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!existingTenant) break;

      slugAttempt++;
      slug = `${generateSlug(params.customer_name || 'tenant')}-${crypto.randomBytes(2).toString('hex')}`;
    }

    console.log('✅ [Provisioning] Generated slug:', slug);

    // ============================================
    // STEP 3: Crear Tenant
    // ============================================
    const verticalConfig = getVerticalDefaults(params.vertical);

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        client_id: params.client_id,
        name: params.customer_name || client.business_name || 'Mi Negocio',
        slug: slug,
        vertical: params.vertical,
        plan: params.plan,
        primary_contact_name: params.customer_name || client.contact_name,
        primary_contact_email: params.customer_email,
        primary_contact_phone: client.contact_phone,
        status: 'active',
        plan_started_at: new Date().toISOString(),
        settings: {
          timezone: 'America/Mexico_City',
          language: 'es',
          currency: 'MXN',
          sidebar_config: verticalConfig.sidebar_config,
        },
        features_enabled: [],
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      console.error('❌ [Provisioning] Failed to create tenant:', tenantError);
      return {
        success: false,
        error: 'Failed to create tenant',
        details: { error: tenantError?.message },
      };
    }

    console.log('✅ [Provisioning] Tenant created:', tenant.id);

    // ============================================
    // STEP 4: Crear Branch Principal
    // ============================================
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        tenant_id: tenant.id,
        name: 'Sucursal Principal',
        slug: 'principal',
        city: client.address_city || 'Ciudad',
        state: client.address_state || 'Estado',
        country: client.address_country || 'Mexico',
        address: client.address_street,
        phone: client.contact_phone,
        whatsapp_number: client.contact_phone,
        is_headquarters: true,
        is_active: true,
        timezone: 'America/Mexico_City',
        operating_hours: {
          monday: { open: '09:00', close: '18:00', enabled: true },
          tuesday: { open: '09:00', close: '18:00', enabled: true },
          wednesday: { open: '09:00', close: '18:00', enabled: true },
          thursday: { open: '09:00', close: '18:00', enabled: true },
          friday: { open: '09:00', close: '18:00', enabled: true },
          saturday: { open: '09:00', close: '14:00', enabled: true },
          sunday: { enabled: false },
        },
      })
      .select()
      .single();

    if (branchError || !branch) {
      console.error('❌ [Provisioning] Failed to create branch:', branchError);
      // Intentar rollback del tenant
      await supabase.from('tenants').delete().eq('id', tenant.id);
      return {
        success: false,
        error: 'Failed to create branch',
        details: { error: branchError?.message },
      };
    }

    console.log('✅ [Provisioning] Branch created:', branch.id);

    // ============================================
    // STEP 5: Crear Usuario en auth.users
    // ============================================
    const tempPassword = generateTempPassword();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: params.customer_email,
      password: tempPassword,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        name: params.customer_name,
        tenant_id: tenant.id,
        role: 'admin',
        vertical: params.vertical,
      },
    });

    if (authError || !authData.user) {
      console.error('❌ [Provisioning] Failed to create auth user:', authError);

      // Si el usuario ya existe, intentar obtenerlo
      if (authError?.message?.includes('already been registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u) => u.email === params.customer_email);

        if (existingUser) {
          console.log('⚠️ [Provisioning] User already exists, linking to tenant');

          // Continuar con el usuario existente
          await createStaffAndRole(supabase, {
            tenant_id: tenant.id,
            branch_id: branch.id,
            user_id: existingUser.id,
            email: params.customer_email,
            name: params.customer_name,
          });

          // Actualizar client
          await supabase
            .from('clients')
            .update({
              tenant_id: tenant.id,
              user_id: existingUser.id,
              status: 'active',
            })
            .eq('id', params.client_id);

          return {
            success: true,
            tenant_id: tenant.id,
            tenant_slug: slug,
            branch_id: branch.id,
            user_id: existingUser.id,
            temp_password: undefined, // No tenemos la contraseña del usuario existente
          };
        }
      }

      // Rollback
      await supabase.from('branches').delete().eq('id', branch.id);
      await supabase.from('tenants').delete().eq('id', tenant.id);

      return {
        success: false,
        error: 'Failed to create auth user',
        details: { error: authError?.message },
      };
    }

    console.log('✅ [Provisioning] Auth user created:', authData.user.id);

    // ============================================
    // STEP 6: Crear Staff y User Role
    // ============================================
    const staffResult = await createStaffAndRole(supabase, {
      tenant_id: tenant.id,
      branch_id: branch.id,
      user_id: authData.user.id,
      email: params.customer_email,
      name: params.customer_name,
    });

    if (!staffResult.success) {
      console.error('❌ [Provisioning] Failed to create staff/role');
      // No hacer rollback completo, el usuario ya existe
    }

    console.log('✅ [Provisioning] Staff and role created');

    // ============================================
    // STEP 7: Actualizar Client con tenant_id
    // ============================================
    await supabase
      .from('clients')
      .update({
        tenant_id: tenant.id,
        user_id: authData.user.id,
        status: 'active',
        onboarding_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.client_id);

    console.log('✅ [Provisioning] Client updated with tenant_id');

    // ============================================
    // STEP 8: Crear servicios por defecto
    // ============================================
    if (verticalConfig.default_services.length > 0) {
      const services = verticalConfig.default_services.map((name, index) => ({
        tenant_id: tenant.id,
        name: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: 'General',
        is_active: true,
        display_order: index,
      }));

      await supabase.from('services').insert(services);
      console.log('✅ [Provisioning] Default services created:', services.length);
    }

    // ============================================
    // STEP 9: Crear FAQs por defecto
    // ============================================
    if (verticalConfig.default_faqs.length > 0) {
      const faqs = verticalConfig.default_faqs.map((faq, index) => ({
        tenant_id: tenant.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        is_active: true,
        display_order: index,
        language: 'es',
      }));

      await supabase.from('faqs').insert(faqs);
      console.log('✅ [Provisioning] Default FAQs created:', faqs.length);
    }

    // ============================================
    // STEP 10: Log de auditoría
    // ============================================
    await supabase.from('audit_logs').insert({
      client_id: params.client_id,
      tenant_id: tenant.id,
      user_id: authData.user.id,
      action: 'tenant_provisioned',
      entity_type: 'tenant',
      entity_id: tenant.id,
      new_data: {
        tenant_id: tenant.id,
        branch_id: branch.id,
        vertical: params.vertical,
        plan: params.plan,
        duration_ms: Date.now() - startTime,
      },
    });

    // ============================================
    // RESULTADO EXITOSO
    // ============================================
    const totalDuration = Date.now() - startTime;
    console.log(`🎉 [Provisioning] Completed successfully in ${totalDuration}ms`);

    return {
      success: true,
      tenant_id: tenant.id,
      tenant_slug: slug,
      branch_id: branch.id,
      user_id: authData.user.id,
      staff_id: staffResult.staff_id,
      temp_password: tempPassword,
      details: {
        duration_ms: totalDuration,
        vertical: params.vertical,
        plan: params.plan,
        services_created: verticalConfig.default_services.length,
        faqs_created: verticalConfig.default_faqs.length,
      },
    };
  } catch (error) {
    console.error('💥 [Provisioning] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error during provisioning',
    };
  }
}

// ============================================
// HELPER: Create Staff and User Role
// ============================================

interface CreateStaffParams {
  tenant_id: string;
  branch_id: string;
  user_id: string;
  email: string;
  name: string;
}

async function createStaffAndRole(
  supabase: SupabaseClient,
  params: CreateStaffParams
): Promise<{ success: boolean; staff_id?: string; role_id?: string }> {
  try {
    // Parsear nombre
    const nameParts = (params.name || 'Admin').split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Crear Staff
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .insert({
        tenant_id: params.tenant_id,
        user_id: params.user_id,
        first_name: firstName,
        last_name: lastName,
        display_name: params.name,
        email: params.email,
        role: 'admin',
        role_title: 'Administrador',
        is_active: true,
        notification_preferences: {
          email: true,
          whatsapp: true,
          sms: false,
        },
      })
      .select()
      .single();

    if (staffError) {
      console.error('❌ [Provisioning] Staff creation error:', staffError);
      return { success: false };
    }

    // Asignar staff a branch
    await supabase.from('staff_branches').insert({
      staff_id: staff.id,
      branch_id: params.branch_id,
      is_primary: true,
    });

    // Crear User Role
    const { data: role, error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: params.user_id,
        tenant_id: params.tenant_id,
        role: 'admin',
        staff_id: staff.id,
        is_active: true,
        permissions: {
          all: true,
        },
      })
      .select()
      .single();

    if (roleError) {
      console.error('❌ [Provisioning] User role creation error:', roleError);
      return { success: false, staff_id: staff.id };
    }

    return {
      success: true,
      staff_id: staff.id,
      role_id: role.id,
    };
  } catch (error) {
    console.error('❌ [Provisioning] createStaffAndRole error:', error);
    return { success: false };
  }
}

// ============================================
// EXPORTS
// ============================================

export { generateSlug, generateTempPassword, getVerticalDefaults };
