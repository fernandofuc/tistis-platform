export const dynamic = 'force-dynamic';

// =====================================================
// TIS TIS - Assembly Complete Endpoint
// Called when micro-app deployment is finished
// Sends "Brain Ready" email to customer
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emailService } from '@/src/lib/email';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface CompleteDeploymentRequest {
  deployment_id: string;
  whatsapp_number?: string;
  additional_features?: string[];
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body: CompleteDeploymentRequest = await request.json();

    if (!body.deployment_id) {
      return NextResponse.json(
        { error: 'deployment_id is required' },
        { status: 400 }
      );
    }

    console.log('[AssemblyComplete] 🎉 Processing deployment completion:', body.deployment_id);

    // 1. Get deployment info
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployment_log')
      .select(`
        *,
        clients (
          id,
          business_name,
          contact_name,
          contact_email,
          vertical
        ),
        subscriptions (
          plan
        )
      `)
      .eq('id', body.deployment_id)
      .single();

    if (deploymentError || !deployment) {
      console.error('[AssemblyComplete] Deployment not found:', deploymentError);
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // 2. Update deployment status
    const { error: updateError } = await supabase
      .from('deployment_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...deployment.metadata,
          completion_time: new Date().toISOString(),
          whatsapp_number: body.whatsapp_number,
        }
      })
      .eq('id', body.deployment_id);

    if (updateError) {
      console.error('[AssemblyComplete] Error updating deployment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update deployment status' },
        { status: 500 }
      );
    }

    // 3. Update client status to active
    if (deployment.client_id) {
      await supabase
        .from('clients')
        .update({
          status: 'active',
          onboarding_status: 'brain_ready',
        })
        .eq('id', deployment.client_id);
    }

    // 4. Get features enabled from deployment plan
    const deploymentPlan = deployment.deployment_plan;
    const featuresEnabled: string[] = [];

    if (deploymentPlan?.feature_flags_setup?.flags) {
      deploymentPlan.feature_flags_setup.flags
        .filter((flag: { enabled: boolean }) => flag.enabled)
        .forEach((flag: { key: string; label?: string }) => {
          featuresEnabled.push(flag.label || flag.key);
        });
    }

    // Add any additional features
    if (body.additional_features) {
      featuresEnabled.push(...body.additional_features);
    }

    // If no features found, add default ones based on plan
    if (featuresEnabled.length === 0) {
      const plan = deployment.subscriptions?.plan || 'essentials';
      const defaultFeatures: Record<string, string[]> = {
        starter: [
          'Dashboard personalizado',
          'Gestión de leads',
          'Calendario de citas',
        ],
        essentials: [
          'Dashboard personalizado',
          'Gestión de leads',
          'Calendario inteligente',
          'WhatsApp Bot 24/7',
          'Reportes básicos',
        ],
        growth: [
          'Dashboard personalizado',
          'Gestión de leads avanzada',
          'Calendario inteligente',
          'WhatsApp Bot 24/7',
          'Automatizaciones',
          'Reportes avanzados',
          'Multi-sucursal',
        ],
        scale: [
          'Dashboard personalizado',
          'CRM completo',
          'Calendario inteligente',
          'WhatsApp Bot 24/7',
          'Automatizaciones avanzadas',
          'Reportes en tiempo real',
          'Multi-sucursal',
          'API Access',
          'Soporte prioritario',
        ],
      };
      featuresEnabled.push(...(defaultFeatures[plan] || defaultFeatures.essentials));
    }

    // 5. Send "Brain Ready" email
    const client = deployment.clients;
    if (client?.contact_email && client?.contact_name) {
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com';
      const plan = deployment.subscriptions?.plan || 'essentials';

      try {
        const emailResult = await emailService.sendBrainReady(client.contact_email, {
          customerName: client.contact_name,
          businessName: client.business_name || client.contact_name,
          planName: getPlanDisplayName(plan),
          dashboardUrl: `${baseUrl}/dashboard`,
          featuresEnabled: featuresEnabled,
          whatsappNumber: body.whatsapp_number,
          setupCallUrl: `${baseUrl}/setup-call`,
        });

        if (emailResult.success) {
          console.log('[AssemblyComplete] 📧 Brain Ready email sent to:', client.contact_email);
        } else {
          console.error('[AssemblyComplete] 📧 Failed to send email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('[AssemblyComplete] 📧 Error sending email:', emailError);
      }
    }

    // 6. Create notification for client
    await supabase
      .from('notification_queue')
      .insert({
        type: 'brain_ready',
        recipient_type: 'client',
        recipient_id: deployment.client_id,
        payload: {
          deployment_id: body.deployment_id,
          features_enabled: featuresEnabled,
          whatsapp_number: body.whatsapp_number,
        },
        priority: 'high'
      });

    // 7. Log to audit
    await supabase
      .from('audit_logs')
      .insert({
        client_id: deployment.client_id,
        action: 'deployment_completed',
        entity_type: 'deployment',
        entity_id: body.deployment_id,
        new_data: {
          features_enabled: featuresEnabled,
          whatsapp_number: body.whatsapp_number,
        }
      });

    console.log('[AssemblyComplete] ✅ Deployment marked as complete:', body.deployment_id);

    return NextResponse.json({
      success: true,
      data: {
        deployment_id: body.deployment_id,
        status: 'completed',
        email_sent: true,
        features_enabled: featuresEnabled,
      }
    });

  } catch (error) {
    console.error('[AssemblyComplete] 💥 Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getPlanDisplayName(plan: string): string {
  const planNames: Record<string, string> = {
    starter: 'Starter',
    essentials: 'Essentials',
    growth: 'Growth',
    scale: 'Scale',
  };
  return planNames[plan] || plan;
}
