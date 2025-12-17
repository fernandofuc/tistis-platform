// =====================================================
// TIS TIS PLATFORM - Staff API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';

const ESVA_TENANT_ID = process.env.NEXT_PUBLIC_ESVA_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

// ======================
// GET - Fetch staff members
// ======================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const role = searchParams.get('role');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('staff')
      .select(`
        *,
        branch:branches(id, name, city)
      `)
      .eq('tenant_id', ESVA_TENANT_ID);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (role) {
      query = query.eq('role', role);
    }
    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    query = query.order('first_name');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching staff:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Staff API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
