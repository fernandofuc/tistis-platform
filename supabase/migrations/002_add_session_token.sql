-- ============================================
-- TIS TIS - Add session_token to discovery_sessions
-- Version: 1.1
-- Run this in Supabase SQL Editor
-- ============================================

-- Add session_token column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'discovery_sessions'
        AND column_name = 'session_token'
    ) THEN
        ALTER TABLE public.discovery_sessions
        ADD COLUMN session_token VARCHAR(100) UNIQUE;
    END IF;
END $$;

-- Add conversation_history column if it doesn't exist (renamed from chat_messages)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'discovery_sessions'
        AND column_name = 'conversation_history'
    ) THEN
        ALTER TABLE public.discovery_sessions
        ADD COLUMN conversation_history JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Add business_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'discovery_sessions'
        AND column_name = 'business_type'
    ) THEN
        ALTER TABLE public.discovery_sessions
        ADD COLUMN business_type VARCHAR(100);
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'discovery_sessions'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.discovery_sessions
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create index on session_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_session_token
ON public.discovery_sessions(session_token);

-- Add RLS policy for anonymous session creation (for users not logged in)
DROP POLICY IF EXISTS "Allow anonymous session creation" ON public.discovery_sessions;
CREATE POLICY "Allow anonymous session creation" ON public.discovery_sessions
    FOR INSERT WITH CHECK (client_id IS NULL);

DROP POLICY IF EXISTS "Allow anonymous session updates" ON public.discovery_sessions;
CREATE POLICY "Allow anonymous session updates" ON public.discovery_sessions
    FOR UPDATE USING (client_id IS NULL);

DROP POLICY IF EXISTS "Allow anonymous session reads" ON public.discovery_sessions;
CREATE POLICY "Allow anonymous session reads" ON public.discovery_sessions
    FOR SELECT USING (client_id IS NULL OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Update proposals table to use session_id instead of discovery_session_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'proposals'
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE public.proposals
        ADD COLUMN session_id UUID REFERENCES public.discovery_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add financial_analysis and pricing_snapshot columns to proposals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'proposals'
        AND column_name = 'financial_analysis'
    ) THEN
        ALTER TABLE public.proposals
        ADD COLUMN financial_analysis JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'proposals'
        AND column_name = 'pricing_snapshot'
    ) THEN
        ALTER TABLE public.proposals
        ADD COLUMN pricing_snapshot JSONB;
    END IF;
END $$;

-- Make base_price and total_monthly_price nullable for flexibility
ALTER TABLE public.proposals
ALTER COLUMN base_price DROP NOT NULL,
ALTER COLUMN total_monthly_price DROP NOT NULL;

-- ============================================
-- DONE! Run this SQL in Supabase SQL Editor
-- ============================================
