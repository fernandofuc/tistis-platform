-- =====================================================
-- TIS TIS PLATFORM - FIX INTEGRATION TYPES
-- Migration: 120_FIX_INTEGRATION_TYPES.sql
-- Date: January 9, 2025
-- Version: 1.0
--
-- PURPOSE: Fix inconsistency between frontend and database
-- for integration_type values. Add 'softrestaurant' and
-- 'dentalink' to the CHECK constraint.
--
-- ISSUE: IntegrationHub sends 'softrestaurant' but database
-- only accepts 'softrestaurant_import', causing 400 errors.
-- =====================================================

-- =====================================================
-- STEP 1: Drop and recreate CHECK constraint with new values
-- =====================================================

-- Drop the existing constraint
ALTER TABLE public.integration_connections
DROP CONSTRAINT IF EXISTS integration_connections_integration_type_check;

-- Create new constraint with all valid types
ALTER TABLE public.integration_connections
ADD CONSTRAINT integration_connections_integration_type_check
CHECK (integration_type IN (
    -- CRMs
    'hubspot', 'salesforce', 'zoho_crm', 'pipedrive', 'freshsales',
    -- Dental Software
    'dentrix', 'open_dental', 'eaglesoft', 'curve_dental', 'dentalink',
    -- POS Systems (Restaurant)
    'square', 'toast', 'clover', 'lightspeed',
    'softrestaurant',        -- NEW: Main SoftRestaurant integration
    'softrestaurant_import', -- Legacy: Keep for backwards compatibility
    -- Calendar
    'google_calendar', 'calendly', 'acuity',
    -- Medical/Healthcare
    'epic', 'cerner', 'athenahealth',
    -- Generic
    'webhook_incoming', 'csv_import', 'api_custom'
));

-- =====================================================
-- STEP 2: Add comment documenting the types
-- =====================================================

COMMENT ON COLUMN public.integration_connections.integration_type IS
'Type of external system integration:
- CRM: hubspot, salesforce, zoho_crm, pipedrive, freshsales
- Dental: dentrix, open_dental, eaglesoft, curve_dental, dentalink
- POS: square, toast, clover, lightspeed, softrestaurant, softrestaurant_import
- Calendar: google_calendar, calendly, acuity
- Medical: epic, cerner, athenahealth
- Generic: webhook_incoming, csv_import, api_custom

Note: softrestaurant is the main type, softrestaurant_import is legacy.
Note: dentalink added for Latin America dental market.';

-- =====================================================
-- DONE
-- =====================================================
