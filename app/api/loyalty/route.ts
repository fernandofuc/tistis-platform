// =====================================================
// TIS TIS PLATFORM - Loyalty Program API
// Main API for loyalty program configuration
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ======================
// HELPERS
// ======================

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

function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// ======================
// GET - Get loyalty program for tenant
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

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (!userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Get or create loyalty program
    let { data: program } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    // If no program exists, create a default one
    if (!program) {
      const { data: newProgram, error: createError } = await supabase
        .from('loyalty_programs')
        .insert({
          tenant_id: userRole.tenant_id,
          program_name: 'Programa de Lealtad',
          tokens_name: 'Puntos',
          tokens_name_plural: 'Puntos',
        })
        .select()
        .single();

      if (createError) {
        console.error('[Loyalty API] Error creating program:', createError);
        return NextResponse.json(
          { error: 'Error al crear programa de lealtad' },
          { status: 500 }
        );
      }

      program = newProgram;

      // Create default message templates
      await supabase.rpc('create_default_loyalty_templates', { p_program_id: program.id });
    }

    // Get related data
    const [
      tokenRulesResult,
      rewardsResult,
      membershipPlansResult,
      templatesResult
    ] = await Promise.all([
      supabase
        .from('loyalty_token_rules')
        .select('*')
        .eq('program_id', program.id)
        .order('sort_order'),
      supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('program_id', program.id)
        .order('sort_order'),
      supabase
        .from('loyalty_membership_plans')
        .select('*')
        .eq('program_id', program.id)
        .order('sort_order'),
      supabase
        .from('loyalty_message_templates')
        .select('*')
        .eq('program_id', program.id)
    ]);

    // Get stats
    const [balancesCount, membershipsCount, redemptionsCount] = await Promise.all([
      supabase
        .from('loyalty_balances')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', userRole.tenant_id),
      supabase
        .from('loyalty_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', userRole.tenant_id)
        .eq('status', 'active'),
      supabase
        .from('loyalty_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', userRole.tenant_id)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        program,
        tokenRules: tokenRulesResult.data || [],
        rewards: rewardsResult.data || [],
        membershipPlans: membershipPlansResult.data || [],
        messageTemplates: templatesResult.data || [],
        stats: {
          totalMembers: balancesCount.count || 0,
          activeMemberships: membershipsCount.count || 0,
          totalRedemptions: redemptionsCount.count || 0,
        }
      }
    });
  } catch (error) {
    console.error('[Loyalty API] GET error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ======================
// PUT - Update loyalty program configuration
// ======================
export async function PUT(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Get user's tenant and check permissions
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (!userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar el programa' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      program_name,
      program_description,
      is_active,
      tokens_enabled,
      membership_enabled,
      tokens_name,
      tokens_name_plural,
      tokens_icon,
      tokens_per_currency,
      tokens_currency_threshold,
      tokens_expiry_days,
      reactivation_enabled,
      reactivation_days_inactive,
      reactivation_message_template,
      reactivation_offer_type,
      reactivation_offer_value,
      reactivation_max_attempts,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (program_name !== undefined) updateData.program_name = program_name;
    if (program_description !== undefined) updateData.program_description = program_description;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (tokens_enabled !== undefined) updateData.tokens_enabled = tokens_enabled;
    if (membership_enabled !== undefined) updateData.membership_enabled = membership_enabled;
    if (tokens_name !== undefined) updateData.tokens_name = tokens_name;
    if (tokens_name_plural !== undefined) updateData.tokens_name_plural = tokens_name_plural;
    if (tokens_icon !== undefined) updateData.tokens_icon = tokens_icon;
    if (tokens_per_currency !== undefined) updateData.tokens_per_currency = tokens_per_currency;
    if (tokens_currency_threshold !== undefined) updateData.tokens_currency_threshold = tokens_currency_threshold;
    if (tokens_expiry_days !== undefined) updateData.tokens_expiry_days = tokens_expiry_days;
    if (reactivation_enabled !== undefined) updateData.reactivation_enabled = reactivation_enabled;
    if (reactivation_days_inactive !== undefined) updateData.reactivation_days_inactive = reactivation_days_inactive;
    if (reactivation_message_template !== undefined) updateData.reactivation_message_template = reactivation_message_template;
    if (reactivation_offer_type !== undefined) updateData.reactivation_offer_type = reactivation_offer_type;
    if (reactivation_offer_value !== undefined) updateData.reactivation_offer_value = reactivation_offer_value;
    if (reactivation_max_attempts !== undefined) updateData.reactivation_max_attempts = reactivation_max_attempts;

    const { data: program, error } = await supabase
      .from('loyalty_programs')
      .update(updateData)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[Loyalty API] PUT error:', error);
      return NextResponse.json(
        { error: 'Error al actualizar programa' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: program
    });
  } catch (error) {
    console.error('[Loyalty API] PUT error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
