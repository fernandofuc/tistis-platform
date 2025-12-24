// =====================================================
// TIS TIS PLATFORM - Voice Agent Prompt Generation API
// Genera prompts automáticos basados en datos del tenant
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Create Supabase client with user's access token
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Create service client
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Extract Bearer token from Authorization header
function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Get user context (user + tenant)
async function getUserContext(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  return { user, userRole };
}

// ======================
// POST - Generate voice agent prompt
// ======================
export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Verificar que el tenant tiene plan Growth
    const serviceSupabase = createServiceClient();
    const { data: tenant } = await serviceSupabase
      .from('tenants')
      .select('plan, vertical')
      .eq('id', tenantId)
      .single();

    if (!tenant || tenant.plan !== 'growth') {
      return NextResponse.json(
        { error: 'Voice Agent solo está disponible en el plan Growth' },
        { status: 403 }
      );
    }

    // Llamar a la función SQL para generar el prompt
    const { data: generatedPrompt, error: promptError } = await serviceSupabase
      .rpc('generate_voice_agent_prompt', { p_tenant_id: tenantId });

    if (promptError) {
      console.error('[Voice Agent Generate] Error calling RPC:', promptError);
      console.log('[Voice Agent Generate] Using fallback prompt generation');

      // Generar un prompt profesional manualmente cuando RPC falla
      const { data: tenantData } = await serviceSupabase
        .from('tenants')
        .select('name, vertical')
        .eq('id', tenantId)
        .single();

      const { data: branches } = await serviceSupabase
        .from('branches')
        .select('name, address, city, phone, operating_hours')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(5);

      const { data: services } = await serviceSupabase
        .from('services')
        .select('name, short_description, price_min, price_max, duration_minutes, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(30);

      const { data: staff } = await serviceSupabase
        .from('staff')
        .select('first_name, last_name, display_name, specialty, role')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('role', ['dentist', 'specialist', 'owner', 'manager', 'doctor'])
        .limit(10);

      // Obtener configuración del voice agent para nombre del asistente
      const { data: voiceConfig } = await serviceSupabase
        .from('voice_agent_config')
        .select('assistant_name, custom_instructions, escalation_enabled, escalation_phone, goodbye_message')
        .eq('tenant_id', tenantId)
        .single();

      const assistantName = voiceConfig?.assistant_name || 'el asistente';
      const businessName = tenantData?.name || 'nuestro negocio';
      const vertical = tenantData?.vertical || 'general';

      // Configuración por vertical
      const verticalConfig: Record<string, { type: string; roleDesc: string; mainTask: string }> = {
        dental: {
          type: 'consultorio dental',
          roleDesc: 'asistente de voz IA especializado en atención dental',
          mainTask: 'ayudar a los pacientes a agendar citas dentales y responder preguntas sobre tratamientos',
        },
        restaurant: {
          type: 'restaurante',
          roleDesc: 'asistente de voz IA especializado en reservaciones',
          mainTask: 'ayudar a los clientes a hacer reservaciones y responder preguntas sobre el menú',
        },
        medical: {
          type: 'consultorio médico',
          roleDesc: 'asistente de voz IA especializado en atención médica',
          mainTask: 'ayudar a los pacientes a agendar consultas médicas',
        },
        general: {
          type: 'negocio',
          roleDesc: 'asistente de voz IA',
          mainTask: 'ayudar a los clientes a agendar citas y responder preguntas',
        },
      };

      const config = verticalConfig[vertical] || verticalConfig.general;
      const currentDate = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      // Construir prompt profesional
      let prompt = `## PERSONALIDAD

Eres ${assistantName}, un ${config.roleDesc} de ${businessName}. Tienes un acento mexicano amigable y profesional. Te caracterizan tu profesionalismo, actitud positiva y amplia experiencia brindando experiencias de cliente de alta calidad.

No proporciones información de la que no dispongas. Si no sabes algo, admítelo honestamente.

## TAREA

Tu tarea principal es mantener una conversación profesional, positiva y natural con los clientes, responder a sus preguntas y ${config.mainTask}.

## INFORMACIÓN DEL NEGOCIO

**Nombre:** ${businessName}
**Tipo:** ${config.type}
`;

      // Agregar sucursales
      if (branches && branches.length > 0) {
        prompt += `\n**Sucursales:**\n`;
        branches.forEach(b => {
          if (b.name && b.name.trim()) {
            prompt += `- ${b.name}`;
            if (b.address) prompt += `: ${b.address}`;
            if (b.city) prompt += `, ${b.city}`;
            if (b.phone) prompt += ` | Tel: ${b.phone}`;
            prompt += `\n`;
          }
        });
      }

      // Agregar servicios agrupados por categoría
      if (services && services.length > 0) {
        prompt += `\n**Servicios disponibles:**\n`;
        const servicesByCategory: Record<string, typeof services> = {};
        services.forEach(s => {
          const cat = s.category || 'General';
          if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
          servicesByCategory[cat].push(s);
        });

        Object.entries(servicesByCategory).forEach(([category, categoryServices]) => {
          prompt += `\n*${category}:*\n`;
          categoryServices.forEach(s => {
            prompt += `- ${s.name}`;
            if (s.price_min) {
              prompt += s.price_max && s.price_max !== s.price_min
                ? ` ($${s.price_min} - $${s.price_max})`
                : ` ($${s.price_min})`;
            }
            if (s.duration_minutes) prompt += ` - ${s.duration_minutes} min`;
            prompt += `\n`;
          });
        });
      }

      // Agregar personal/especialistas
      if (staff && staff.length > 0) {
        const validStaff = staff.filter(s => s.display_name || s.first_name || s.last_name);
        if (validStaff.length > 0) {
          prompt += `\n**Equipo:**\n`;
          validStaff.forEach(s => {
            const name = s.display_name || `${s.first_name || ''} ${s.last_name || ''}`.trim();
            prompt += `- ${name}`;
            if (s.specialty) prompt += ` (${s.specialty})`;
            prompt += `\n`;
          });
        }
      }

      // Instrucciones para citas/reservaciones
      prompt += `\n## RESERVACIONES / CITAS

**Fecha actual:** ${currentDate}

**Instrucciones para agendar:**

Si el cliente quiere agendar una cita:

1. Primero necesitas saber: el día, la hora${vertical === 'restaurant' ? ', y para cuántas personas' : ', y el servicio o motivo'}.
   Por ejemplo: "Claro, dime por favor el día, la hora${vertical === 'restaurant' ? ' y cuántas personas serían' : ' y qué servicio necesitas'}."

2. Mientras consultas disponibilidad, sé natural: "Un segundo, reviso si tenemos disponibilidad para ese momento..."

3. Si hay disponibilidad, confirma los datos.
   Si no hay disponibilidad, ofrece alternativas cercanas.

4. Pregunta el nombre del cliente si no lo tienes.

5. Confirma la cita: "Perfecto, queda agendado para el [día] a las [hora]. Recibirás un WhatsApp de confirmación."

Al terminar puedes añadir: "Y recuerda, si necesitas cancelar o reagendar, puedes hacerlo también por aquí sin problema."
`;

      // Escalación
      if (voiceConfig?.escalation_enabled) {
        prompt += `\n## ESCALACIÓN

Puedes transferir la llamada a un humano si:
- El cliente lo pide directamente
- El cliente no está satisfecho con tu servicio
- Hay una emergencia o situación que requiere atención humana

Dile: "Voy a intentar conectarte con alguien que pueda ayudarte mejor" y transfiere la llamada.
`;
      }

      // Estilo de comunicación
      prompt += `\n## ESTILO DE COMUNICACIÓN

- Sé informal pero profesional, con frases naturales como: "Mmm...", "Bueno...", "Claro...", "Quiero decir..."
- Mantén las respuestas concisas y naturales (es una llamada telefónica, no un email)
- Usa un tono cálido y empático
- Evita respuestas largas o listas extensas - resume la información
- Si el cliente pregunta por precios, da rangos generales y sugiere confirmar en la cita
`;

      // Agregar instrucciones personalizadas si existen
      if (voiceConfig?.custom_instructions) {
        prompt += `\n## INSTRUCCIONES ADICIONALES

${voiceConfig.custom_instructions}
`;
      }

      // Finalización
      prompt += `\n## FINALIZACIÓN

Cuando la conversación termine naturalmente, despídete amablemente${voiceConfig?.goodbye_message ? `: "${voiceConfig.goodbye_message}"` : ' y finaliza la llamada.'}.
`;

      // Guardar el prompt
      await serviceSupabase
        .from('voice_agent_config')
        .update({
          system_prompt: prompt,
          system_prompt_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      return NextResponse.json({
        success: true,
        prompt: prompt,
        generated_at: new Date().toISOString(),
        fallback: true,
      });
    }

    // Actualizar la configuración de voz con el nuevo prompt
    const { error: updateError } = await serviceSupabase
      .from('voice_agent_config')
      .update({
        system_prompt: generatedPrompt,
        system_prompt_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[Voice Agent Generate] Error updating config:', updateError);
      return NextResponse.json(
        { error: 'Error al guardar prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prompt: generatedPrompt,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Voice Agent Generate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al generar prompt: ' + errorMessage },
      { status: 500 }
    );
  }
}

// ======================
// GET - Get current prompt and preview of what would be generated
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    const serviceSupabase = createServiceClient();

    // Obtener configuración actual de voice_agent_config
    const { data: config } = await serviceSupabase
      .from('voice_agent_config')
      .select('system_prompt, system_prompt_generated_at, custom_instructions')
      .eq('tenant_id', tenantId)
      .single();

    // Obtener tenant info
    const { data: tenant } = await serviceSupabase
      .from('tenants')
      .select('id, name, vertical')
      .eq('id', tenantId)
      .single();

    // Obtener branches directamente (misma query que AI Agent Settings)
    const { data: branches } = await serviceSupabase
      .from('branches')
      .select('id, name, address, city, phone, operating_hours, is_headquarters')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false });

    // Obtener services directamente (misma query que AI Agent Settings)
    const { data: services } = await serviceSupabase
      .from('services')
      .select('id, name, short_description, price_min, price_max, duration_minutes, category')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    // Obtener staff directamente (misma query que AI Agent Settings)
    const { data: staff } = await serviceSupabase
      .from('staff')
      .select('id, first_name, last_name, display_name, role, specialty')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['dentist', 'specialist', 'owner', 'manager']);

    // Filtrar staff vacío (como hace AI Agent Settings)
    const validStaff = (staff || []).filter(s =>
      (s.first_name && s.first_name.trim() !== '') ||
      (s.last_name && s.last_name.trim() !== '') ||
      (s.display_name && s.display_name.trim() !== '')
    );

    // Generar preview del prompt (sin guardar) - intentar RPC, fallback a null
    let previewPrompt = null;
    try {
      const { data: promptData } = await serviceSupabase
        .rpc('generate_voice_agent_prompt', { p_tenant_id: tenantId });
      previewPrompt = promptData;
    } catch {
      console.log('[Voice Agent Generate] RPC not available, skipping prompt preview');
    }

    const branchesCount = branches?.length || 0;
    const servicesCount = services?.length || 0;
    const staffCount = validStaff.length;

    return NextResponse.json({
      success: true,
      current_prompt: config?.system_prompt || null,
      current_prompt_generated_at: config?.system_prompt_generated_at || null,
      custom_instructions: config?.custom_instructions || null,
      preview_prompt: previewPrompt,
      context_summary: {
        has_branches: branchesCount > 0,
        branches_count: branchesCount,
        has_services: servicesCount > 0,
        services_count: servicesCount,
        has_staff: staffCount > 0,
        staff_count: staffCount,
        vertical: tenant?.vertical || 'general',
        tenant_name: tenant?.name || 'Sin nombre',
      },
    });
  } catch (error) {
    console.error('[Voice Agent Generate] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener prompt' },
      { status: 500 }
    );
  }
}
