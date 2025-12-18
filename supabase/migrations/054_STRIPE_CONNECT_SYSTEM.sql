-- =====================================================
-- TIS TIS PLATFORM - STRIPE CONNECT SYSTEM
-- Migration: 054_STRIPE_CONNECT_SYSTEM.sql
-- Description: Stripe Connect integration for tenant payments
--              Allows tenants to receive payments from memberships
-- =====================================================

-- =====================================================
-- 1. STRIPE CONNECT ACCOUNTS (Cuenta Stripe por tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Stripe Account Info
    stripe_account_id TEXT, -- acct_XXXXX (null until connected)
    stripe_account_type TEXT DEFAULT 'standard', -- 'standard', 'express', 'custom'

    -- Connection Status
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'connected', 'restricted', 'disabled'
    is_charges_enabled BOOLEAN NOT NULL DEFAULT false,
    is_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
    is_details_submitted BOOLEAN NOT NULL DEFAULT false,

    -- Business Info (cached from Stripe)
    business_name TEXT,
    business_type TEXT, -- 'individual', 'company'
    country TEXT DEFAULT 'MX',
    default_currency TEXT DEFAULT 'mxn',

    -- Payout Settings
    payout_schedule_interval TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'manual'
    payout_schedule_delay_days INTEGER DEFAULT 2,

    -- Bank Account Info (masked)
    bank_name TEXT,
    bank_last_four TEXT, -- Last 4 digits of account

    -- OAuth State (for secure connection flow)
    oauth_state TEXT, -- Temporary state for OAuth verification
    oauth_state_expires_at TIMESTAMPTZ,

    -- Connection timestamps
    connected_at TIMESTAMPTZ, -- When first connected
    last_sync_at TIMESTAMPTZ, -- Last time we synced from Stripe

    -- Metadatos
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id),
    UNIQUE(stripe_account_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_stripe_connect_tenant ON stripe_connect_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_status ON stripe_connect_accounts(status);

-- =====================================================
-- 2. STRIPE PAYMENT INTENTS (Pagos de membresías)
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Stripe IDs
    stripe_payment_intent_id TEXT NOT NULL UNIQUE, -- pi_XXXXX
    stripe_customer_id TEXT, -- cus_XXXXX
    stripe_connected_account_id TEXT, -- acct_XXXXX (destination)

    -- Payment Details
    amount INTEGER NOT NULL, -- Amount in cents
    currency TEXT NOT NULL DEFAULT 'mxn',
    status TEXT NOT NULL, -- 'requires_payment_method', 'requires_confirmation', 'succeeded', 'canceled', 'failed'

    -- Application Fee (our commission)
    application_fee_amount INTEGER DEFAULT 0,

    -- Related entities
    membership_id UUID REFERENCES loyalty_memberships(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

    -- Metadata
    description TEXT,
    receipt_email TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_pi_tenant ON stripe_payment_intents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_pi_status ON stripe_payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_stripe_pi_membership ON stripe_payment_intents(membership_id);

-- =====================================================
-- 3. STRIPE SUBSCRIPTIONS (Para membresías recurrentes)
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Stripe IDs
    stripe_subscription_id TEXT NOT NULL UNIQUE, -- sub_XXXXX
    stripe_customer_id TEXT NOT NULL, -- cus_XXXXX
    stripe_connected_account_id TEXT NOT NULL, -- acct_XXXXX
    stripe_price_id TEXT NOT NULL, -- price_XXXXX

    -- Subscription Details
    status TEXT NOT NULL, -- 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,

    -- Billing Details
    billing_cycle_anchor TIMESTAMPTZ,
    collection_method TEXT DEFAULT 'charge_automatically', -- or 'send_invoice'

    -- Related entities
    membership_id UUID REFERENCES loyalty_memberships(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES loyalty_membership_plans(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_sub_tenant ON stripe_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sub_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_sub_membership ON stripe_subscriptions(membership_id);

-- =====================================================
-- 4. STRIPE WEBHOOK EVENTS (Para idempotencia)
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT NOT NULL UNIQUE, -- evt_XXXXX
    event_type TEXT NOT NULL, -- 'payment_intent.succeeded', etc.

    -- Processing Status
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed', 'skipped'
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Event Data (stored for debugging)
    payload JSONB,

    -- Related entities (if applicable)
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    connected_account_id TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_status ON stripe_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_type ON stripe_webhook_events(event_type);

-- =====================================================
-- 5. STRIPE PAYOUTS (Historial de pagos al tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Stripe IDs
    stripe_payout_id TEXT NOT NULL UNIQUE, -- po_XXXXX
    stripe_connected_account_id TEXT NOT NULL,

    -- Payout Details
    amount INTEGER NOT NULL, -- Amount in cents
    currency TEXT NOT NULL DEFAULT 'mxn',
    status TEXT NOT NULL, -- 'pending', 'in_transit', 'paid', 'failed', 'canceled'

    -- Destination
    destination_type TEXT, -- 'bank_account', 'card'
    destination_last_four TEXT,
    bank_name TEXT,

    -- Timing
    arrival_date TIMESTAMPTZ,

    -- Failure Details
    failure_code TEXT,
    failure_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_payout_tenant ON stripe_payouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payout_status ON stripe_payouts(status);

-- =====================================================
-- 6. HELPER FUNCTION FOR ROLE CHECK
-- =====================================================

-- Function to check if user has admin/owner role (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM user_roles
    WHERE user_id = auth.uid()
    LIMIT 1;

    RETURN v_role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payouts ENABLE ROW LEVEL SECURITY;

-- NOTE: Using get_user_tenant_id() function from migration 011 for consistency
-- and is_tenant_admin() for role checks to avoid RLS recursion issues

-- Stripe Connect Accounts - Only owner/admin can manage
CREATE POLICY "stripe_connect_accounts_select" ON stripe_connect_accounts
    FOR SELECT USING (
        tenant_id = get_user_tenant_id() AND is_tenant_admin()
    );

CREATE POLICY "stripe_connect_accounts_insert" ON stripe_connect_accounts
    FOR INSERT WITH CHECK (
        tenant_id = get_user_tenant_id() AND is_tenant_admin()
    );

CREATE POLICY "stripe_connect_accounts_update" ON stripe_connect_accounts
    FOR UPDATE USING (
        tenant_id = get_user_tenant_id() AND is_tenant_admin()
    );

-- Payment Intents - Viewable by all tenant staff
CREATE POLICY "stripe_payment_intents_select" ON stripe_payment_intents
    FOR SELECT USING (
        tenant_id = get_user_tenant_id()
    );

-- Subscriptions - Viewable by all tenant staff
CREATE POLICY "stripe_subscriptions_select" ON stripe_subscriptions
    FOR SELECT USING (
        tenant_id = get_user_tenant_id()
    );

-- Payouts - Only owner/admin can view
CREATE POLICY "stripe_payouts_select" ON stripe_payouts
    FOR SELECT USING (
        tenant_id = get_user_tenant_id() AND is_tenant_admin()
    );

-- Webhook Events - Service role only (no direct user access)
-- No policies needed - handled by API with service role key

-- =====================================================
-- 8. UPDATE TRIGGER FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_stripe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stripe_connect_accounts_updated_at
    BEFORE UPDATE ON stripe_connect_accounts
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();

CREATE TRIGGER stripe_payment_intents_updated_at
    BEFORE UPDATE ON stripe_payment_intents
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();

CREATE TRIGGER stripe_subscriptions_updated_at
    BEFORE UPDATE ON stripe_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();

CREATE TRIGGER stripe_payouts_updated_at
    BEFORE UPDATE ON stripe_payouts
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Function to check if a tenant has connected Stripe
CREATE OR REPLACE FUNCTION is_stripe_connected(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stripe_connect_accounts
        WHERE tenant_id = p_tenant_id
        AND status = 'connected'
        AND is_charges_enabled = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get Stripe account status for a tenant
CREATE OR REPLACE FUNCTION get_stripe_account_status(p_tenant_id UUID)
RETURNS TABLE (
    is_connected BOOLEAN,
    status TEXT,
    charges_enabled BOOLEAN,
    payouts_enabled BOOLEAN,
    business_name TEXT,
    bank_last_four TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sca.status = 'connected' AS is_connected,
        sca.status,
        sca.is_charges_enabled,
        sca.is_payouts_enabled,
        sca.business_name,
        sca.bank_last_four
    FROM stripe_connect_accounts sca
    WHERE sca.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
