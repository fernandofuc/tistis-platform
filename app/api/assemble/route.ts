export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  selectComponents,
  resolveDependencies,
  generateDeploymentPlan,
  AssembleRequest,
  ClientConfig
} from '@/lib/assembly';

// Supabase Admin client for privileged operations
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  console.log(`[Assembly ${requestId}] 🚀 Starting assembly process`);

  try {
    // 1. Parse and validate input
    const body: AssembleRequest = await request.json();

    if (!body.client_id) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'client_id is required', requestId },
        { status: 400 }
      );
    }

    if (!body.vertical) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'vertical is required', requestId },
        { status: 400 }
      );
    }

    if (!body.plan) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'plan is required', requestId },
        { status: 400 }
      );
    }

    console.log(`[Assembly ${requestId}] ✅ Input validated:`, {
      client_id: body.client_id,
      vertical: body.vertical,
      plan: body.plan,
      addons: body.addons,
      branches: body.branches
    });

    // 2. Get proposal data if provided
    let proposal = null;
    if (body.proposal_id) {
      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          *,
          clients (
            id,
            business_name,
            vertical,
            legacy_system
          )
        `)
        .eq('id', body.proposal_id)
        .single();

      if (!proposalError && proposalData) {
        proposal = proposalData;
        console.log(`[Assembly ${requestId}] 📋 Proposal found:`, proposal.id);
      }
    }

    // 3. Build client configuration
    const clientConfig: ClientConfig = {
      client_id: body.client_id,
      vertical: body.vertical,
      plan: body.plan,
      addons: body.addons || [],
      legacy_system: body.legacy_system || null,
      custom_requirements: body.custom_requirements || [],
      feature_overrides: body.feature_overrides || {},
      branches: body.branches || 1
    };

    console.log(`[Assembly ${requestId}] 📋 Client config:`, clientConfig);

    // 4. Select components
    const selectedComponents = await selectComponents(supabase, clientConfig);

    if (selectedComponents.length === 0) {
      console.error(`[Assembly ${requestId}] ❌ No components selected`);
      return NextResponse.json(
        {
          success: false,
          error: 'NO_COMPONENTS_SELECTED',
          message: 'No components found for the specified configuration',
          config: clientConfig,
          requestId
        },
        { status: 400 }
      );
    }

    console.log(`[Assembly ${requestId}] ✅ Components selected: ${selectedComponents.length}`);

    // 5. Resolve dependencies
    const resolvedComponents = await resolveDependencies(supabase, selectedComponents);

    console.log(`[Assembly ${requestId}] ✅ Dependencies resolved: ${resolvedComponents.length} components`);

    // 6. Generate deployment plan
    const deploymentPlan = await generateDeploymentPlan({
      requestId,
      clientConfig,
      proposal,
      subscription_id: body.subscription_id,
      components: resolvedComponents
    });

    console.log(`[Assembly ${requestId}] ✅ Deployment plan generated`);

    // 7. Persist to database
    const { data: deploymentLog, error: insertError } = await supabase
      .from('deployment_log')
      .insert({
        client_id: body.client_id,
        proposal_id: body.proposal_id || null,
        subscription_id: body.subscription_id || null,
        deployment_plan: deploymentPlan,
        status: 'pending',
        components_count: resolvedComponents.length,
        estimated_duration_minutes: deploymentPlan.summary.estimated_total_minutes,
        metadata: {
          assembly_request_id: requestId,
          assembly_duration_ms: Date.now() - startTime,
          component_ids: resolvedComponents.map(c => c.id)
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[Assembly ${requestId}] ❌ Error saving deployment log:`, insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Error saving deployment plan',
          details: insertError.message,
          requestId
        },
        { status: 500 }
      );
    }

    // 8. Create feature flags for the client
    const featureFlags = deploymentPlan.feature_flags_setup.flags.map(flag => ({
      client_id: body.client_id,
      feature_key: flag.key,
      is_enabled: flag.enabled,
      source_component: flag.source
    }));

    if (featureFlags.length > 0) {
      const { error: flagsError } = await supabase
        .from('feature_flags')
        .upsert(featureFlags, { onConflict: 'client_id,feature_key' });

      if (flagsError) {
        console.warn(`[Assembly ${requestId}] ⚠️ Error creating feature flags:`, flagsError);
      } else {
        console.log(`[Assembly ${requestId}] ✅ Feature flags created: ${featureFlags.length}`);
      }
    }

    // 9. Create notification for internal team
    await supabase
      .from('notification_queue')
      .insert({
        type: 'deployment_ready',
        recipient_type: 'internal',
        recipient_id: 'team',
        payload: {
          deployment_id: deploymentLog.id,
          client_id: body.client_id,
          client_name: proposal?.clients?.business_name || 'New Client',
          plan: body.plan,
          vertical: body.vertical,
          components_count: resolvedComponents.length
        },
        priority: 'high'
      });

    // 10. Log to audit
    await supabase
      .from('audit_logs')
      .insert({
        client_id: body.client_id,
        action: 'assembly_completed',
        entity_type: 'deployment',
        entity_id: deploymentLog.id,
        new_data: {
          proposal_id: body.proposal_id,
          components_selected: resolvedComponents.length,
          duration_ms: Date.now() - startTime
        }
      });

    const totalDuration = Date.now() - startTime;
    console.log(`[Assembly ${requestId}] 🎉 Assembly completed in ${totalDuration}ms`);

    // 11. Return response
    return NextResponse.json({
      success: true,
      data: {
        deployment_id: deploymentLog.id,
        deployment_plan: deploymentPlan,
        components_count: resolvedComponents.length,
        estimated_duration_minutes: deploymentLog.estimated_duration_minutes,
        status: 'pending'
      },
      meta: {
        request_id: requestId,
        duration_ms: totalDuration
      }
    });

  } catch (error: unknown) {
    const totalDuration = Date.now() - startTime;
    console.error(`[Assembly ${requestId}] 💥 Unhandled error:`, error);

    // Log the error
    try {
      await supabase
        .from('audit_logs')
        .insert({
          action: 'assembly_failed',
          entity_type: 'assembly',
          entity_id: requestId,
          new_data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            duration_ms: totalDuration
          }
        });
    } catch (logError) {
      console.error(`[Assembly ${requestId}] Error logging failure:`, logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
        requestId
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check deployment status
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const deploymentId = searchParams.get('deployment_id');

  if (!deploymentId) {
    return NextResponse.json(
      { error: 'deployment_id is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('deployment_log')
    .select('*')
    .eq('id', deploymentId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Deployment not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data });
}
