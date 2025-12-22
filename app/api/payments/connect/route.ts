// =====================================================
// TIS TIS PLATFORM - Stripe Connect API
// Manage Stripe Connect account linking
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import crypto from 'crypto';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// Create Stripe client lazily (consistent with other Stripe endpoints)
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

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

async function getUserTenant(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  // Only owners and admins can manage payments
  if (!['owner', 'admin'].includes(userRole.role)) {
    return { userRole, hasPermission: false };
  }

  return { userRole, hasPermission: true };
}

// ======================
// GET - Get Stripe Connect status
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenant(supabase);

    if (!context) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!context.hasPermission) {
      return NextResponse.json({ error: 'Sin permisos para gestionar pagos' }, { status: 403 });
    }

    // Get existing Stripe Connect account
    const { data: account, error } = await supabase
      .from('stripe_connect_accounts')
      .select('*')
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[Payments API] Error fetching account:', error);
      return NextResponse.json({ error: 'Error al obtener cuenta' }, { status: 500 });
    }

    // If no account exists, return pending status
    if (!account) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'not_connected',
          is_charges_enabled: false,
          is_payouts_enabled: false,
          is_details_submitted: false,
        }
      });
    }

    // If connected, sync latest status from Stripe
    if (account.stripe_account_id && account.status === 'connected') {
      try {
        const stripeAccount = await getStripeClient().accounts.retrieve(account.stripe_account_id);

        // Update local record if changed
        if (
          stripeAccount.charges_enabled !== account.is_charges_enabled ||
          stripeAccount.payouts_enabled !== account.is_payouts_enabled
        ) {
          await supabase
            .from('stripe_connect_accounts')
            .update({
              is_charges_enabled: stripeAccount.charges_enabled,
              is_payouts_enabled: stripeAccount.payouts_enabled,
              is_details_submitted: stripeAccount.details_submitted,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', account.id);
        }

        return NextResponse.json({
          success: true,
          data: {
            status: account.status,
            is_charges_enabled: stripeAccount.charges_enabled,
            is_payouts_enabled: stripeAccount.payouts_enabled,
            is_details_submitted: stripeAccount.details_submitted,
            business_name: stripeAccount.business_profile?.name || account.business_name,
            bank_last_four: account.bank_last_four,
            bank_name: account.bank_name,
            country: stripeAccount.country,
            default_currency: stripeAccount.default_currency,
          }
        });
      } catch (stripeError) {
        console.error('[Payments API] Stripe error:', stripeError);
        // Return cached data if Stripe call fails
        return NextResponse.json({
          success: true,
          data: {
            status: account.status,
            is_charges_enabled: account.is_charges_enabled,
            is_payouts_enabled: account.is_payouts_enabled,
            is_details_submitted: account.is_details_submitted,
            business_name: account.business_name,
            bank_last_four: account.bank_last_four,
            bank_name: account.bank_name,
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: account.status,
        is_charges_enabled: account.is_charges_enabled,
        is_payouts_enabled: account.is_payouts_enabled,
        is_details_submitted: account.is_details_submitted,
        business_name: account.business_name,
        bank_last_four: account.bank_last_four,
      }
    });
  } catch (error) {
    console.error('[Payments API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Create Stripe Connect onboarding link
// ======================
export async function POST(request: NextRequest) {
  try {
    console.log('[Payments API] POST /connect - Starting');

    // Validate Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[Payments API] STRIPE_SECRET_KEY not configured');
      return NextResponse.json({ error: 'Stripe no configurado en el servidor' }, { status: 500 });
    }
    // STRIPE_SECRET_KEY validated - not logging for security

    const accessToken = getAccessToken(request);
    if (!accessToken) {
      console.error('[Payments API] No access token in request');
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    // Access token validated

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenant(supabase);

    if (!context) {
      console.error('[Payments API] User context not found');
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!context.hasPermission) {
      console.error('[Payments API] User lacks permission');
      return NextResponse.json({ error: 'Sin permisos para gestionar pagos' }, { status: 403 });
    }


    // Get or create Stripe Connect account record
    let { data: account, error: selectError } = await supabase
      .from('stripe_connect_accounts')
      .select('*')
      .eq('tenant_id', context.userRole.tenant_id)
      .single();


    // Handle table not existing (migration not run)
    if (selectError && selectError.code === '42P01') {
      console.error('[Payments API] Table stripe_connect_accounts does not exist. Run migration 054.');
      return NextResponse.json({ error: 'Sistema de pagos no configurado. Contacta soporte.' }, { status: 500 });
    }

    // Generate OAuth state for security
    const oauthState = crypto.randomBytes(32).toString('hex');
    const stateExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    if (!account) {
      console.log('[Payments API] No existing account, creating new Stripe Express account...');

      // Create new Stripe Express account
      let stripeAccount;
      try {
        stripeAccount = await getStripeClient().accounts.create({
          type: 'express',
          country: 'MX',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: {
            tenant_id: context.userRole.tenant_id,
          },
        });
        console.log('[Payments API] Stripe account created:', stripeAccount.id);
      } catch (stripeCreateError) {
        console.error('[Payments API] Failed to create Stripe account:', stripeCreateError);
        throw stripeCreateError;
      }

      // Save to database
      console.log('[Payments API] Saving to database...');
      const { data: newAccount, error: insertError } = await supabase
        .from('stripe_connect_accounts')
        .insert({
          tenant_id: context.userRole.tenant_id,
          stripe_account_id: stripeAccount.id,
          stripe_account_type: 'express',
          status: 'pending',
          country: 'MX',
          oauth_state: oauthState,
          oauth_state_expires_at: stateExpiry.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Payments API] Insert error:', insertError);
        return NextResponse.json({ error: 'Error al crear cuenta: ' + insertError.message }, { status: 500 });
      }
      console.log('[Payments API] Account saved:', newAccount?.id);

      account = newAccount;
    } else {
      // If account exists but stripe_account_id is missing (edge case), create Stripe account
      if (!account.stripe_account_id) {
        const stripeAccount = await getStripeClient().accounts.create({
          type: 'express',
          country: 'MX',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: {
            tenant_id: context.userRole.tenant_id,
          },
        });

        await supabase
          .from('stripe_connect_accounts')
          .update({
            stripe_account_id: stripeAccount.id,
            stripe_account_type: 'express',
            oauth_state: oauthState,
            oauth_state_expires_at: stateExpiry.toISOString(),
          })
          .eq('id', account.id);

        account.stripe_account_id = stripeAccount.id;
      } else {
        // Update OAuth state
        await supabase
          .from('stripe_connect_accounts')
          .update({
            oauth_state: oauthState,
            oauth_state_expires_at: stateExpiry.toISOString(),
          })
          .eq('id', account.id);
      }
    }

    // Create onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log('[Payments API] Creating account link with base URL:', baseUrl);
    console.log('[Payments API] Using Stripe account ID:', account.stripe_account_id);

    let accountLink;
    try {
      accountLink = await getStripeClient().accountLinks.create({
        account: account.stripe_account_id,
        refresh_url: `${baseUrl}/dashboard/settings?tab=payments&refresh=true`,
        return_url: `${baseUrl}/dashboard/settings?tab=payments&success=true`,
        type: 'account_onboarding',
      });
      console.log('[Payments API] Account link created successfully');
    } catch (linkError) {
      console.error('[Payments API] Failed to create account link:', linkError);
      throw linkError;
    }

    return NextResponse.json({
      success: true,
      data: {
        onboarding_url: accountLink.url,
        expires_at: new Date(accountLink.expires_at * 1000).toISOString(),
      }
    });
  } catch (error) {
    console.error('[Payments API] POST error:', error);
    console.error('[Payments API] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      console.error('[Payments API] Stripe error type:', error.type);
      console.error('[Payments API] Stripe error code:', error.code);
      console.error('[Payments API] Stripe error message:', error.message);

      // Common Stripe Connect errors
      if (error.message.includes('Connect') || error.code === 'account_invalid') {
        return NextResponse.json({
          error: 'Stripe Connect no está habilitado en tu cuenta de Stripe. Actívalo en dashboard.stripe.com/settings/connect'
        }, { status: 500 });
      }

      return NextResponse.json({ error: `Error de Stripe: ${error.message}` }, { status: 500 });
    }

    // Handle database errors
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code: string; message?: string };
      if (dbError.code === '42P01') {
        return NextResponse.json({ error: 'Sistema de pagos no configurado. Contacta soporte.' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// DELETE - Disconnect Stripe account (soft disconnect)
// ======================
export async function DELETE(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserTenant(supabase);

    if (!context) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!context.hasPermission) {
      return NextResponse.json({ error: 'Sin permisos para gestionar pagos' }, { status: 403 });
    }

    // Soft disconnect - mark as disabled but keep record
    const { error } = await supabase
      .from('stripe_connect_accounts')
      .update({ status: 'disabled' })
      .eq('tenant_id', context.userRole.tenant_id);

    if (error) {
      console.error('[Payments API] DELETE error:', error);
      return NextResponse.json({ error: 'Error al desconectar' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Payments API] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
