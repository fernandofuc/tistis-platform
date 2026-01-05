// =====================================================
// TIS TIS PLATFORM - Debug Inventory API
// Temporary endpoint to diagnose inventory errors
// DELETE THIS FILE AFTER DEBUGGING
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
      supabaseServiceKey: supabaseServiceKey ? 'SET (hidden)' : 'MISSING',
    },
    tests: {},
  };

  try {
    // Test 1: Auth
    const authHeader = request.headers.get('Authorization');
    results.auth = {
      hasAuthHeader: !!authHeader,
      headerStart: authHeader?.substring(0, 20) + '...',
    };

    if (!authHeader?.startsWith('Bearer ')) {
      results.tests.auth = { error: 'No auth header', status: 'FAIL' };
      return NextResponse.json(results);
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Test 2: Get user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    results.tests.getUser = {
      success: !userError,
      userId: userData?.user?.id,
      email: userData?.user?.email,
      error: userError?.message,
    };

    if (userError || !userData?.user) {
      return NextResponse.json(results);
    }

    // Test 3: Get user role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .single();

    results.tests.getUserRole = {
      success: !roleError,
      tenantId: userRole?.tenant_id,
      role: userRole?.role,
      error: roleError?.message,
      errorCode: roleError?.code,
    };

    if (roleError || !userRole) {
      return NextResponse.json(results);
    }

    // Test 4: Check if inventory_categories table exists
    const { data: catData, error: catError } = await supabase
      .from('inventory_categories')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .limit(1);

    results.tests.inventoryCategories = {
      success: !catError,
      rowCount: catData?.length ?? 0,
      error: catError?.message,
      errorCode: catError?.code,
      errorHint: catError?.hint,
      errorDetails: catError?.details,
    };

    // Test 5: Check if inventory_items table exists
    const { data: itemData, error: itemError } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .limit(1);

    results.tests.inventoryItems = {
      success: !itemError,
      rowCount: itemData?.length ?? 0,
      error: itemError?.message,
      errorCode: itemError?.code,
      errorHint: itemError?.hint,
      errorDetails: itemError?.details,
    };

    // Test 6: Check if inventory_suppliers table exists
    const { data: supData, error: supError } = await supabase
      .from('inventory_suppliers')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .limit(1);

    results.tests.inventorySuppliers = {
      success: !supError,
      rowCount: supData?.length ?? 0,
      error: supError?.message,
      errorCode: supError?.code,
      errorHint: supError?.hint,
      errorDetails: supError?.details,
    };

    // Test 7: Get branches
    const { data: branchData, error: branchError } = await supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_active', true);

    results.tests.branches = {
      success: !branchError,
      count: branchData?.length ?? 0,
      branches: branchData?.map(b => ({ id: b.id, name: b.name })),
      error: branchError?.message,
    };

    // Test 8: Try to create a test category (then delete it)
    const testSlug = `test-debug-${Date.now()}`;
    const { data: createData, error: createError } = await supabase
      .from('inventory_categories')
      .insert({
        tenant_id: userRole.tenant_id,
        name: 'TEST DEBUG',
        slug: testSlug,
      })
      .select()
      .single();

    results.tests.createCategory = {
      success: !createError,
      createdId: createData?.id,
      error: createError?.message,
      errorCode: createError?.code,
      errorHint: createError?.hint,
      errorDetails: createError?.details,
    };

    // Delete test category if created
    if (createData?.id) {
      const { error: deleteError } = await supabase
        .from('inventory_categories')
        .delete()
        .eq('id', createData.id);

      results.tests.deleteTestCategory = {
        success: !deleteError,
        error: deleteError?.message,
      };
    }

    results.summary = {
      tablesExist: !catError && !itemError && !supError,
      canCreateRecords: !createError,
      overallStatus: !catError && !itemError && !supError && !createError ? 'OK' : 'PROBLEMS FOUND',
    };

  } catch (error: any) {
    results.fatalError = {
      message: error?.message,
      stack: error?.stack,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
