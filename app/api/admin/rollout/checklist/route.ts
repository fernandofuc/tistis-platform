/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Checklist API Endpoint
 *
 * API for managing pre-rollout checklist:
 * - GET: Get current checklist
 * - POST: Update checklist items
 *
 * @module app/api/admin/rollout/checklist
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getChecklistService,
  getOrCreateChecklist,
  completeChecklistItem,
  approveChecklist,
  runAutomaticChecks,
} from '@/lib/voice-agent/rollout';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Create Supabase client with service role
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verify admin access from JWT
 */
async function verifyAdminAccess(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  const supabase = createServiceClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { valid: false, error: 'Invalid token' };
  }

  // Check if user is platform admin
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['platform_admin', 'super_admin', 'admin', 'owner'])
    .single();

  if (!role) {
    return { valid: false, error: 'Admin access required' };
  }

  return {
    valid: true,
    userId: user.id,
    email: user.email,
  };
}

// =====================================================
// GET - Get checklist
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const includeHistory = url.searchParams.get('includeHistory') === 'true';

    const checklist = await getOrCreateChecklist();

    const response: Record<string, unknown> = {
      checklist,
      timestamp: new Date().toISOString(),
    };

    if (includeHistory) {
      const checklistService = getChecklistService();
      response.history = await checklistService.getChecklistHistory(5);
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Checklist API] Failed to get checklist:', error);
    return NextResponse.json(
      { error: 'Failed to get checklist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Update checklist
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { action, checklistId, itemId, notes } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const completedBy = auth.email ?? auth.userId ?? 'admin';

    switch (action) {
      // =====================================================
      // COMPLETE ITEM
      // =====================================================
      case 'completeItem': {
        if (!checklistId || !itemId) {
          return NextResponse.json(
            { error: 'Missing checklistId or itemId' },
            { status: 400 }
          );
        }

        const updatedChecklist = await completeChecklistItem(
          checklistId,
          itemId,
          completedBy,
          notes
        );

        return NextResponse.json({
          success: true,
          action: 'completeItem',
          checklist: updatedChecklist,
        });
      }

      // =====================================================
      // UNCOMPLETE ITEM
      // =====================================================
      case 'uncompleteItem': {
        if (!checklistId || !itemId) {
          return NextResponse.json(
            { error: 'Missing checklistId or itemId' },
            { status: 400 }
          );
        }

        const checklistService = getChecklistService();
        const updatedChecklist = await checklistService.uncompleteItem(checklistId, itemId);

        return NextResponse.json({
          success: true,
          action: 'uncompleteItem',
          checklist: updatedChecklist,
        });
      }

      // =====================================================
      // ADD NOTES
      // =====================================================
      case 'addNotes': {
        if (!checklistId || !itemId || !notes) {
          return NextResponse.json(
            { error: 'Missing checklistId, itemId, or notes' },
            { status: 400 }
          );
        }

        const checklistService = getChecklistService();
        const updatedChecklist = await checklistService.addItemNotes(checklistId, itemId, notes);

        return NextResponse.json({
          success: true,
          action: 'addNotes',
          checklist: updatedChecklist,
        });
      }

      // =====================================================
      // APPROVE
      // =====================================================
      case 'approve': {
        if (!checklistId) {
          return NextResponse.json(
            { error: 'Missing checklistId' },
            { status: 400 }
          );
        }

        const approvedChecklist = await approveChecklist(checklistId, completedBy);

        return NextResponse.json({
          success: true,
          action: 'approve',
          checklist: approvedChecklist,
        });
      }

      // =====================================================
      // REVOKE APPROVAL
      // =====================================================
      case 'revokeApproval': {
        if (!checklistId) {
          return NextResponse.json(
            { error: 'Missing checklistId' },
            { status: 400 }
          );
        }

        const checklistService = getChecklistService();
        const updatedChecklist = await checklistService.revokeApproval(checklistId);

        return NextResponse.json({
          success: true,
          action: 'revokeApproval',
          checklist: updatedChecklist,
        });
      }

      // =====================================================
      // RUN AUTO CHECKS
      // =====================================================
      case 'runAutoChecks': {
        if (!checklistId) {
          return NextResponse.json(
            { error: 'Missing checklistId' },
            { status: 400 }
          );
        }

        const { checklist: updatedChecklist, results } = await runAutomaticChecks(checklistId);

        return NextResponse.json({
          success: true,
          action: 'runAutoChecks',
          checklist: updatedChecklist,
          autoCheckResults: results,
        });
      }

      // =====================================================
      // CREATE NEW
      // =====================================================
      case 'createNew': {
        const checklistService = getChecklistService();
        const newChecklist = await checklistService.createChecklist();

        return NextResponse.json({
          success: true,
          action: 'createNew',
          checklist: newChecklist,
        });
      }

      // =====================================================
      // ARCHIVE
      // =====================================================
      case 'archive': {
        if (!checklistId) {
          return NextResponse.json(
            { error: 'Missing checklistId' },
            { status: 400 }
          );
        }

        const checklistService = getChecklistService();
        await checklistService.archiveChecklist(checklistId);

        return NextResponse.json({
          success: true,
          action: 'archive',
          checklistId,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Checklist API] Failed to update checklist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update checklist' },
      { status: 500 }
    );
  }
}
