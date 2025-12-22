// =====================================================
// TIS TIS PLATFORM - Ensure Staff Record Exists
// Creates staff record if missing (uses service role to bypass RLS)
// =====================================================

export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service role client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Regular client for auth
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const email = user.email;
    const tenantId = user.user_metadata?.tenant_id;

    if (!email) {
      return NextResponse.json({ error: 'No email in user data' }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant_id in user metadata' }, { status: 400 });
    }

    // Check if staff record already exists (using admin client)
    const { data: existingStaff, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select('id, display_name')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .single();

    if (existingStaff) {
      // Staff already exists, return it
      return NextResponse.json({
        success: true,
        message: 'Staff record already exists',
        staff: existingStaff,
        created: false,
      });
    }

    // Staff doesn't exist, create one
    const meta = user.user_metadata || {};

    // Extract name from various sources with proper fallbacks
    const nameFromEmail = email.split('@')[0].replace(/[._-]/g, ' ');
    const nameParts = nameFromEmail.split(' ');

    const firstName = meta.first_name ||
                      (meta.name ? meta.name.split(' ')[0] : null) ||
                      (nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Usuario');
    const lastName = meta.last_name ||
                     (meta.name ? meta.name.split(' ').slice(1).join(' ') : null) ||
                     (nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : '');
    const displayName = meta.name || `${firstName} ${lastName}`.trim() || 'Usuario';

    const newStaffData = {
      tenant_id: tenantId,
      user_id: user.id,
      email: email,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      phone: meta.phone || null,
      whatsapp_number: meta.phone || null,
      role: 'owner',
      role_title: 'Propietario',
      is_active: true,
    };

    const { data: newStaff, error: createError } = await supabaseAdmin
      .from('staff')
      .insert(newStaffData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating staff:', createError);
      return NextResponse.json({
        error: 'Failed to create staff record',
        details: createError.message,
      }, { status: 500 });
    }

    // Also create user_role entry if it doesn't exist
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existingRole) {
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          role: 'owner',
          is_active: true,
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Staff record created successfully',
      staff: newStaff,
      created: true,
    });

  } catch (error) {
    console.error('Ensure staff error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
