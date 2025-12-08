// =====================================================
// TIS TIS PLATFORM - Services API Route
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';

const ESVA_TENANT_ID = process.env.NEXT_PUBLIC_ESVA_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

// ======================
// GET - Fetch services
// ======================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('services')
      .select('*')
      .eq('tenant_id', ESVA_TENANT_ID);

    if (category) {
      query = query.eq('category', category);
    }
    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    query = query.order('category').order('name');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching services:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Group by category if requested
    if (searchParams.get('group_by_category') === 'true') {
      const grouped = data?.reduce((acc, service) => {
        const cat = service.category || 'Other';
        if (!acc[cat]) {
          acc[cat] = [];
        }
        acc[cat].push(service);
        return acc;
      }, {} as Record<string, typeof data>);

      return NextResponse.json({ data: grouped });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Services API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
