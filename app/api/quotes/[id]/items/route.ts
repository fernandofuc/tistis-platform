export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// =====================================================
// Helper: Get authenticated user and validate tenant
// =====================================================
async function getAuthenticatedContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return {
      client: createClient(supabaseUrl, supabaseServiceKey),
      user: null,
      tenantId: null,
      role: null,
      isServiceCall: true,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: userRole, error: roleError } = await serviceClient
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (roleError || !userRole) {
    return { error: 'User has no assigned role', status: 403 };
  }

  return {
    client: serviceClient,
    user,
    tenantId: userRole.tenant_id,
    role: userRole.role,
    isServiceCall: false,
  };
}

// =====================================================
// GET /api/quotes/[id]/items - Get quote items
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid quote ID format' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, isServiceCall } = authContext;

    // Check quote exists and belongs to tenant
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, tenant_id')
      .eq('id', id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const quoteData = quote as { id: string; tenant_id: string };

    if (!isServiceCall && quoteData.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const { data: items, error } = await supabase
      .from('quote_items')
      .select(`
        *,
        service:services!service_id(id, name, description, price, category)
      `)
      .eq('quote_id', id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching quote items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quote items', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in GET /api/quotes/[id]/items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/quotes/[id]/items - Add item to quote
// =====================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid quote ID format' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, isServiceCall } = authContext;

    // Verify quote access (inline)
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, tenant_id, status')
      .eq('id', id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const quoteData = quote as { id: string; tenant_id: string; status: string };

    if (!isServiceCall && quoteData.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied to this quote' },
        { status: 403 }
      );
    }

    // Cannot modify items for non-draft quotes
    const lockedStatuses = ['sent', 'accepted', 'rejected', 'expired', 'cancelled'];
    if (lockedStatuses.includes(quoteData.status)) {
      return NextResponse.json(
        { error: `Cannot modify items for ${quoteData.status} quote` },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.service_name?.trim()) {
      return NextResponse.json(
        { error: 'service_name is required' },
        { status: 400 }
      );
    }

    if (!body.quantity || body.quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be greater than 0' },
        { status: 400 }
      );
    }

    if (body.unit_price === undefined || body.unit_price < 0) {
      return NextResponse.json(
        { error: 'unit_price is required and must be >= 0' },
        { status: 400 }
      );
    }

    // Get max sort_order for this quote
    const { data: maxOrder } = await supabase
      .from('quote_items')
      .select('sort_order')
      .eq('quote_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (maxOrder?.sort_order || 0) + 1;

    const newItem = {
      quote_id: id,
      service_id: body.service_id || null,
      service_name: body.service_name.trim(),
      description: body.description?.trim() || null,
      quantity: body.quantity,
      unit_price: body.unit_price,
      discount_percentage: body.discount_percentage || 0,
      discount_amount: body.discount_amount || 0,
      sort_order: body.sort_order || nextSortOrder,
    };

    const { data, error } = await supabase
      .from('quote_items')
      .insert(newItem)
      .select()
      .single();

    if (error) {
      console.error('Error creating quote item:', error);
      return NextResponse.json(
        { error: 'Failed to create quote item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/quotes/[id]/items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/quotes/[id]/items - Delete item from quote
// =====================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json(
        { error: 'item_id query parameter is required' },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(itemId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId: userTenantId, isServiceCall } = authContext;

    // Verify quote access (inline)
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, tenant_id, status')
      .eq('id', id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    const quoteData = quote as { id: string; tenant_id: string; status: string };

    if (!isServiceCall && quoteData.tenant_id !== userTenantId) {
      return NextResponse.json(
        { error: 'Access denied to this quote' },
        { status: 403 }
      );
    }

    // Cannot modify items for non-draft quotes
    const lockedStatuses = ['sent', 'accepted', 'rejected', 'expired', 'cancelled'];
    if (lockedStatuses.includes(quoteData.status)) {
      return NextResponse.json(
        { error: `Cannot modify items for ${quoteData.status} quote` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('quote_items')
      .delete()
      .eq('id', itemId)
      .eq('quote_id', id);

    if (error) {
      console.error('Error deleting quote item:', error);
      return NextResponse.json(
        { error: 'Failed to delete quote item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/quotes/[id]/items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
