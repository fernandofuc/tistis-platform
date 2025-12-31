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
 *
 * CRITICAL: This module includes rollback logic to clean up partial
 * provisioning in case of failures. If provisioning fails, Stripe
 * will retry the webhook and this module will attempt again.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================
// ROLLBACK TRACKING
// ============================================

interface RollbackTracker {
  tenant_id?: string;
  branch_ids: string[];
  user_id?: string;
  staff_id?: string;
  user_role_id?: string;
  services_created: boolean;
  faqs_created: boolean;
}

async function performRollback(supabase: SupabaseClient, tracker: RollbackTracker): Promise<void> {
  console.log('🔄 [Provisioning] Starting rollback...');

  try {
    // Rollback in reverse order of creation
    if (tracker.faqs_created && tracker.tenant_id) {
      await supabase.from('faqs').delete().eq('tenant_id', tracker.tenant_id);
      console.log('  ✓ FAQs deleted');
    }

    if (tracker.services_created && tracker.tenant_id) {
      await supabase.from('services').delete().eq('tenant_id', tracker.tenant_id);
      console.log('  ✓ Services deleted');
    }

    if (tracker.user_role_id) {
      await supabase.from('user_roles').delete().eq('id', tracker.user_role_id);
      console.log('  ✓ User role deleted');
    }

    if (tracker.staff_id) {
      await supabase.from('staff_branches').delete().eq('staff_id', tracker.staff_id);
      await supabase.from('staff').delete().eq('id', tracker.staff_id);
      console.log('  ✓ Staff deleted');
    }

    // Delete all branches
    for (const branchId of tracker.branch_ids) {
      await supabase.from('branches').delete().eq('id', branchId);
    }
    if (tracker.branch_ids.length > 0) {
      console.log(`  ✓ ${tracker.branch_ids.length} branches deleted`);
    }

    if (tracker.tenant_id) {
      await supabase.from('tenants').delete().eq('id', tracker.tenant_id);
      console.log('  ✓ Tenant deleted');
    }

    // NOTE: We don't delete auth.users because the user might already exist
    // from a previous OAuth login. Only delete if we created a NEW user.

    console.log('✅ [Provisioning] Rollback completed');
  } catch (rollbackError) {
    console.error('🚨 [Provisioning] Rollback failed:', rollbackError);
    // Log for manual cleanup
  }
}

// ============================================
// TYPES
// ============================================

export interface ProvisionTenantParams {
  client_id: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  // Currently active verticals (more will be added later)
  vertical: 'dental' | 'restaurant';
  plan: 'starter' | 'essentials' | 'growth';
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
 * Currently active: dental, restaurant (more will be added later)
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
  };

  return configs[vertical] || configs.dental;
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

  // Initialize rollback tracker
  const rollback: RollbackTracker = {
    branch_ids: [],
    services_created: false,
    faqs_created: false,
  };

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
    // STEP 0: Validate required parameters
    // ============================================
    if (!params.client_id) {
      return {
        success: false,
        error: 'client_id is required',
      };
    }

    if (!params.customer_email) {
      return {
        success: false,
        error: 'customer_email is required',
      };
    }

    // Normalize email to lowercase early for consistent storage
    const normalizedEmail = params.customer_email.toLowerCase();

    // Validate vertical - Currently active verticals (more will be added later)
    const VALID_VERTICALS = ['dental', 'restaurant'];
    if (!params.vertical || !VALID_VERTICALS.includes(params.vertical)) {
      console.error('🚨 [Provisioning] Invalid vertical:', params.vertical);
      return {
        success: false,
        error: `Invalid vertical: ${params.vertical}. Must be one of: ${VALID_VERTICALS.join(', ')}`,
      };
    }

    // Validate plan
    const VALID_PLANS = ['starter', 'essentials', 'growth'];
    if (!params.plan || !VALID_PLANS.includes(params.plan)) {
      console.error('🚨 [Provisioning] Invalid plan:', params.plan);
      return {
        success: false,
        error: `Invalid plan: ${params.plan}. Must be one of: ${VALID_PLANS.join(', ')}`,
      };
    }

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
        primary_contact_email: normalizedEmail, // Use normalized email
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

    // Track for rollback
    rollback.tenant_id = tenant.id;
    console.log('✅ [Provisioning] Tenant created:', tenant.id);

    // ============================================
    // STEP 4: Crear Sucursales (todas las contratadas)
    // ============================================
    const branchesCount = params.branches_count || 1;
    const createdBranches: { id: string; name: string; is_headquarters: boolean }[] = [];

    const defaultOperatingHours = {
      monday: { open: '09:00', close: '18:00', enabled: true },
      tuesday: { open: '09:00', close: '18:00', enabled: true },
      wednesday: { open: '09:00', close: '18:00', enabled: true },
      thursday: { open: '09:00', close: '18:00', enabled: true },
      friday: { open: '09:00', close: '18:00', enabled: true },
      saturday: { open: '09:00', close: '14:00', enabled: true },
      sunday: { enabled: false },
    };

    // Crear sucursal principal (HQ)
    const { data: hqBranch, error: hqError } = await supabase
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
        operating_hours: defaultOperatingHours,
      })
      .select()
      .single();

    if (hqError || !hqBranch) {
      console.error('❌ [Provisioning] Failed to create HQ branch:', hqError);
      await performRollback(supabase, rollback);
      return {
        success: false,
        error: 'Failed to create headquarters branch',
        details: { error: hqError?.message },
      };
    }

    // Track for rollback
    rollback.branch_ids.push(hqBranch.id);

    createdBranches.push({
      id: hqBranch.id,
      name: hqBranch.name,
      is_headquarters: true,
    });
    console.log('✅ [Provisioning] HQ Branch created:', hqBranch.id);

    // Crear sucursales adicionales si se contrataron más de 1
    if (branchesCount > 1) {
      console.log(`📍 [Provisioning] Creating ${branchesCount - 1} additional branches...`);

      for (let i = 2; i <= branchesCount; i++) {
        const branchName = `Sucursal ${i}`;
        const branchSlug = `sucursal-${i}`;

        const { data: additionalBranch, error: additionalError } = await supabase
          .from('branches')
          .insert({
            tenant_id: tenant.id,
            name: branchName,
            slug: branchSlug,
            city: 'Por configurar',
            state: 'Por configurar',
            country: client.address_country || 'Mexico',
            is_headquarters: false,
            is_active: true,
            timezone: 'America/Mexico_City',
            operating_hours: defaultOperatingHours,
          })
          .select()
          .single();

        if (additionalError) {
          console.warn(`⚠️ [Provisioning] Failed to create branch ${i}:`, additionalError);
          // Continuamos con las demás, no hacemos rollback completo
        } else if (additionalBranch) {
          // Track for rollback
          rollback.branch_ids.push(additionalBranch.id);

          createdBranches.push({
            id: additionalBranch.id,
            name: additionalBranch.name,
            is_headquarters: false,
          });
          console.log(`✅ [Provisioning] Branch ${i} created:`, additionalBranch.id);
        }
      }
    }

    console.log(`✅ [Provisioning] Total branches created: ${createdBranches.length}/${branchesCount}`);

    // Usar la sucursal HQ como referencia para los siguientes pasos
    const branch = hqBranch;

    // ============================================
    // STEP 5: Buscar o Crear Usuario en auth.users
    // PRIORIDAD: Usar cuenta existente de TIS TIS (no crear contraseña temporal)
    // ============================================

    // Buscar usuario existente por email usando paginación
    // NOTE: Supabase listUsers no soporta filtro por email, debemos buscar manualmente
    let authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | undefined = undefined;
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    // normalizedEmail already defined at top of function

    while (hasMore && !authUser) {
      const { data: usersPage } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (!usersPage?.users || usersPage.users.length === 0) {
        hasMore = false;
      } else {
        // Case-insensitive email comparison
        authUser = usersPage.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
        if (!authUser && usersPage.users.length === perPage) {
          page++;
        } else {
          hasMore = false;
        }
      }
    }

    console.log(`[Provisioning] User search completed: ${authUser ? 'FOUND' : 'NOT FOUND'} (searched ${page} pages)`);

    let tempPassword: string | undefined = undefined;

    if (authUser) {
      // Usuario ya existe - usar su cuenta existente
      console.log('✅ [Provisioning] Using existing user account:', authUser.id);

      // Actualizar metadata del usuario existente con info del tenant
      await supabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...authUser.user_metadata,
          tenant_id: tenant.id,
          role: 'admin',
          vertical: params.vertical,
          name: params.customer_name,
          phone: params.customer_phone || authUser.user_metadata?.phone,
        },
      });
    } else {
      // Usuario no existe - crear uno nuevo (caso raro, pero posible)
      console.log('⚠️ [Provisioning] User not found, creating new account...');
      tempPassword = generateTempPassword();

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail, // Use normalized email for consistency
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: params.customer_name,
          phone: params.customer_phone,
          tenant_id: tenant.id,
          role: 'admin',
          vertical: params.vertical,
        },
      });

      if (authError || !authData.user) {
        console.error('❌ [Provisioning] Failed to create auth user:', authError);
        await performRollback(supabase, rollback);
        return {
          success: false,
          error: 'Failed to create auth user',
          details: { error: authError?.message },
        };
      }

      authUser = {
        id: authData.user.id,
        email: authData.user.email,
        user_metadata: authData.user.user_metadata,
      };
      console.log('✅ [Provisioning] New auth user created:', authUser.id);
    }

    // ============================================
    // STEP 6: Crear Staff y User Role
    // ============================================
    const staffResult = await createStaffAndRole(supabase, {
      tenant_id: tenant.id,
      branch_id: branch.id,
      user_id: authUser!.id,
      email: normalizedEmail, // Use normalized email for consistency
      name: params.customer_name,
      phone: params.customer_phone,
    });

    if (!staffResult.success) {
      console.error('❌ [Provisioning] Failed to create staff/role - doing rollback');
      await performRollback(supabase, rollback);
      return {
        success: false,
        error: 'Failed to create staff and user role',
        details: { step: 'staff_and_role' },
      };
    }

    // Track for rollback
    rollback.staff_id = staffResult.staff_id;
    rollback.user_role_id = staffResult.role_id;

    console.log('✅ [Provisioning] Staff and role created');

    // ============================================
    // STEP 7: Actualizar Client con tenant_id
    // ============================================
    await supabase
      .from('clients')
      .update({
        tenant_id: tenant.id,
        user_id: authUser!.id,
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
        duration_minutes: 30,  // Duración por defecto
        price_min: 0,
        price_max: 0,
        price_unit: 'per_service',
        currency: 'MXN',
      }));

      const { error: servicesError } = await supabase.from('services').insert(services);
      if (servicesError) {
        console.error('⚠️ [Provisioning] Failed to create services:', servicesError);
        // Non-critical, continue
      } else {
        rollback.services_created = true;
        console.log('✅ [Provisioning] Default services created:', services.length);
      }
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

      const { error: faqsError } = await supabase.from('faqs').insert(faqs);
      if (faqsError) {
        console.error('⚠️ [Provisioning] Failed to create FAQs:', faqsError);
        // Non-critical, continue
      } else {
        rollback.faqs_created = true;
        console.log('✅ [Provisioning] Default FAQs created:', faqs.length);
      }
    }

    // ============================================
    // STEP 10: Log de auditoría
    // ============================================
    await supabase.from('audit_logs').insert({
      client_id: params.client_id,
      tenant_id: tenant.id,
      user_id: authUser!.id,
      action: 'tenant_provisioned',
      entity_type: 'tenant',
      entity_id: tenant.id,
      new_data: {
        tenant_id: tenant.id,
        branch_id: branch.id,
        branches_created: createdBranches.length,
        branches_requested: branchesCount,
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
      user_id: authUser!.id,
      staff_id: staffResult.staff_id,
      temp_password: tempPassword, // undefined si usamos cuenta existente
      details: {
        duration_ms: totalDuration,
        vertical: params.vertical,
        plan: params.plan,
        services_created: verticalConfig.default_services.length,
        faqs_created: verticalConfig.default_faqs.length,
        branches_created: createdBranches.length,
        branches_requested: branchesCount,
        branches: createdBranches, // Lista de sucursales creadas
        used_existing_account: !tempPassword, // true si usamos cuenta existente
      },
    };
  } catch (error) {
    console.error('💥 [Provisioning] Unexpected error:', error);

    // Attempt rollback on unexpected errors
    if (rollback.tenant_id || rollback.branch_ids.length > 0) {
      console.log('🔄 [Provisioning] Attempting rollback due to unexpected error...');
      await performRollback(supabase, rollback);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error during provisioning',
      details: {
        rollback_attempted: rollback.tenant_id !== undefined || rollback.branch_ids.length > 0,
      },
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
  phone?: string;
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

    // ============================================
    // STAFF: Check if exists, then insert or update
    // ============================================
    // First check if staff already exists for this tenant+email (case-insensitive)
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id')
      .eq('tenant_id', params.tenant_id)
      .ilike('email', params.email)
      .maybeSingle();

    let staff: { id: string } | null = null;

    if (existingStaff) {
      // Update existing staff
      console.log('📝 [Provisioning] Staff exists, updating:', existingStaff.id);
      const { data: updatedStaff, error: updateError } = await supabase
        .from('staff')
        .update({
          user_id: params.user_id,
          first_name: firstName,
          last_name: lastName,
          display_name: params.name,
          phone: params.phone || null,
          role: 'admin',
          role_title: 'Administrador',
          is_active: true,
        })
        .eq('id', existingStaff.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('❌ [Provisioning] Staff update error:', updateError);
        return { success: false };
      }
      staff = updatedStaff;
    } else {
      // Insert new staff
      const { data: newStaff, error: insertError } = await supabase
        .from('staff')
        .insert({
          tenant_id: params.tenant_id,
          user_id: params.user_id,
          first_name: firstName,
          last_name: lastName,
          display_name: params.name,
          email: params.email,
          phone: params.phone || null,
          role: 'admin',
          role_title: 'Administrador',
          is_active: true,
          notification_preferences: {
            email: true,
            whatsapp: true,
            sms: false,
          },
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ [Provisioning] Staff creation error:', insertError);
        return { success: false };
      }
      staff = newStaff;
    }

    if (!staff) {
      console.error('❌ [Provisioning] Staff is null after insert/update');
      return { success: false };
    }

    // ============================================
    // STAFF_BRANCHES: Check if exists, then insert or update
    // ============================================
    const { data: existingStaffBranch } = await supabase
      .from('staff_branches')
      .select('id')
      .eq('staff_id', staff.id)
      .eq('branch_id', params.branch_id)
      .maybeSingle();

    if (existingStaffBranch) {
      // Update existing
      await supabase
        .from('staff_branches')
        .update({ is_primary: true })
        .eq('id', existingStaffBranch.id);
    } else {
      // Insert new
      await supabase.from('staff_branches').insert({
        staff_id: staff.id,
        branch_id: params.branch_id,
        is_primary: true,
      });
    }

    // ============================================
    // USER_ROLES: Check if exists, then insert or update
    // This table DOES have unique constraint on (user_id, tenant_id)
    // ============================================
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', params.user_id)
      .eq('tenant_id', params.tenant_id)
      .maybeSingle();

    let role: { id: string } | null = null;

    if (existingRole) {
      // Update existing role
      console.log('📝 [Provisioning] User role exists, updating:', existingRole.id);
      const { data: updatedRole, error: updateRoleError } = await supabase
        .from('user_roles')
        .update({
          role: 'admin',
          staff_id: staff.id,
          is_active: true,
          permissions: { all: true },
        })
        .eq('id', existingRole.id)
        .select('id')
        .single();

      if (updateRoleError) {
        console.error('❌ [Provisioning] User role update error:', updateRoleError);
        return { success: false, staff_id: staff.id };
      }
      role = updatedRole;
    } else {
      // Insert new role
      const { data: newRole, error: insertRoleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: params.user_id,
          tenant_id: params.tenant_id,
          role: 'admin',
          staff_id: staff.id,
          is_active: true,
          permissions: { all: true },
        })
        .select('id')
        .single();

      if (insertRoleError) {
        console.error('❌ [Provisioning] User role creation error:', insertRoleError);
        return { success: false, staff_id: staff.id };
      }
      role = newRole;
    }

    if (!role) {
      console.error('❌ [Provisioning] Role is null after insert/update');
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
