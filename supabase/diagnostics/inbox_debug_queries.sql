-- =====================================================
-- TIS TIS PLATFORM - Inbox Debugging Queries
-- Run these queries to diagnose why conversations
-- may not be appearing in the Inbox
-- =====================================================

-- =====================================================
-- STEP 1: Find tenant by name
-- Replace 'Caracol Nogales' with your tenant name
-- =====================================================

-- Find tenant
SELECT
    id as tenant_id,
    name,
    slug,
    vertical,
    status,
    created_at
FROM tenants
WHERE name ILIKE '%Caracol%'
   OR slug ILIKE '%caracol%';

-- =====================================================
-- STEP 2: Check channel_connections for tenant
-- Webhooks won't work without active connections
-- =====================================================

-- NOTE: Replace 'YOUR_TENANT_ID' with the actual tenant_id from Step 1

SELECT
    cc.id,
    cc.tenant_id,
    cc.channel,
    cc.is_active,
    cc.phone_number_id,
    cc.phone_number,
    cc.business_account_id,
    cc.created_at,
    cc.updated_at
FROM channel_connections cc
WHERE cc.tenant_id = 'YOUR_TENANT_ID'  -- Replace with actual tenant_id
ORDER BY cc.created_at DESC;

-- If no results, the tenant has no connected channels!

-- =====================================================
-- STEP 3: Check conversations for tenant
-- Look for conversations in valid statuses
-- =====================================================

SELECT
    c.id as conversation_id,
    c.tenant_id,
    c.lead_id,
    c.channel,
    c.status,
    c.ai_handling,
    c.message_count,
    c.created_at,
    c.last_message_at,
    l.phone_normalized as lead_phone,
    l.first_name as lead_name
FROM conversations c
LEFT JOIN leads l ON c.lead_id = l.id
WHERE c.tenant_id = 'YOUR_TENANT_ID'  -- Replace with actual tenant_id
  AND c.status IN ('active', 'waiting_response', 'escalated')
ORDER BY c.last_message_at DESC
LIMIT 20;

-- =====================================================
-- STEP 4: Check messages with role/sender_type analysis
-- Diagnose role vs sender_type discrepancies
-- =====================================================

SELECT
    m.id,
    m.conversation_id,
    m.role,
    m.sender_type,
    LEFT(m.content, 50) as content_preview,
    m.channel,
    m.status,
    m.created_at,
    -- Analysis flags
    CASE
        WHEN m.role = 'user' AND m.sender_type = 'lead' THEN 'OK'
        WHEN m.role = 'assistant' AND m.sender_type = 'ai' THEN 'OK'
        WHEN m.role = 'staff' AND m.sender_type = 'staff' THEN 'OK'
        WHEN m.role = 'system' AND m.sender_type = 'system' THEN 'OK'
        ELSE 'MISMATCH!'
    END as sync_status
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.tenant_id = 'YOUR_TENANT_ID'  -- Replace with actual tenant_id
ORDER BY m.created_at DESC
LIMIT 50;

-- =====================================================
-- STEP 5: Count messages by role/sender_type
-- See distribution and find issues
-- =====================================================

SELECT
    role,
    sender_type,
    COUNT(*) as message_count,
    CASE
        WHEN role = 'user' AND sender_type = 'lead' THEN 'OK'
        WHEN role = 'assistant' AND sender_type = 'ai' THEN 'OK'
        WHEN role = 'staff' AND sender_type = 'staff' THEN 'OK'
        WHEN role = 'system' AND sender_type = 'system' THEN 'OK'
        WHEN role IS NULL THEN 'MISSING ROLE!'
        WHEN sender_type IS NULL THEN 'MISSING SENDER_TYPE!'
        ELSE 'MISMATCH!'
    END as analysis
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.tenant_id = 'YOUR_TENANT_ID'  -- Replace with actual tenant_id
GROUP BY role, sender_type
ORDER BY message_count DESC;

-- =====================================================
-- STEP 6: Check for orphaned conversations
-- Conversations without messages
-- =====================================================

SELECT
    c.id as conversation_id,
    c.status,
    c.channel,
    c.created_at,
    COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.tenant_id = 'YOUR_TENANT_ID'  -- Replace with actual tenant_id
GROUP BY c.id, c.status, c.channel, c.created_at
HAVING COUNT(m.id) = 0
ORDER BY c.created_at DESC;

-- =====================================================
-- STEP 7: Check job_queue for pending/failed AI jobs
-- Messages may be stuck in processing
-- =====================================================

SELECT
    jq.id,
    jq.job_type,
    jq.status,
    jq.payload->>'conversation_id' as conversation_id,
    jq.payload->>'lead_id' as lead_id,
    jq.attempts,
    jq.error_message,
    jq.created_at,
    jq.processed_at
FROM job_queue jq
WHERE jq.payload->>'tenant_id' = 'YOUR_TENANT_ID'  -- Replace with actual tenant_id
  AND jq.job_type IN ('ai_response', 'send_whatsapp', 'send_message')
ORDER BY jq.created_at DESC
LIMIT 20;

-- =====================================================
-- STEP 8: Check webhook events (if table exists)
-- Verify webhooks are being received
-- =====================================================

-- SELECT
--     id,
--     event_type,
--     phone_number_id,
--     processed,
--     created_at
-- FROM stripe_webhook_events  -- Or your webhook log table
-- ORDER BY created_at DESC
-- LIMIT 20;

-- =====================================================
-- STEP 9: Fix mismatched role/sender_type (one-time)
-- Only run if Step 5 shows issues
-- =====================================================

-- Uncomment to run fix:

-- UPDATE messages m
-- SET role = CASE sender_type
--     WHEN 'lead' THEN 'user'
--     WHEN 'ai' THEN 'assistant'
--     WHEN 'staff' THEN 'staff'
--     WHEN 'system' THEN 'system'
--     ELSE 'user'
-- END
-- FROM conversations c
-- WHERE m.conversation_id = c.id
--   AND c.tenant_id = 'YOUR_TENANT_ID'  -- Replace with actual tenant_id
--   AND (
--     (m.sender_type = 'ai' AND m.role != 'assistant')
--     OR (m.sender_type = 'lead' AND m.role != 'user')
--     OR m.role IS NULL
--   );

-- =====================================================
-- SUMMARY QUERY: Overall tenant health check
-- =====================================================

WITH tenant_stats AS (
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        t.status as tenant_status,
        (SELECT COUNT(*) FROM channel_connections WHERE tenant_id = t.id AND is_active = true) as active_channels,
        (SELECT COUNT(*) FROM conversations WHERE tenant_id = t.id) as total_conversations,
        (SELECT COUNT(*) FROM conversations WHERE tenant_id = t.id AND status IN ('active', 'waiting_response', 'escalated')) as active_conversations,
        (SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.tenant_id = t.id) as total_messages,
        (SELECT COUNT(*) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.tenant_id = t.id AND m.role IS NULL) as messages_missing_role,
        (SELECT COUNT(*) FROM leads WHERE tenant_id = t.id) as total_leads
    FROM tenants t
    WHERE t.name ILIKE '%Caracol%'  -- Replace with your tenant name
       OR t.id = 'YOUR_TENANT_ID'   -- Or use direct ID
)
SELECT
    tenant_id,
    tenant_name,
    tenant_status,
    active_channels,
    total_conversations,
    active_conversations,
    total_messages,
    messages_missing_role,
    total_leads,
    CASE
        WHEN active_channels = 0 THEN '❌ No active channels - webhooks won''t work!'
        WHEN total_conversations = 0 THEN '⚠️ No conversations yet'
        WHEN active_conversations = 0 THEN '⚠️ No active conversations (check status filter)'
        WHEN messages_missing_role > 0 THEN '⚠️ Some messages have missing role field'
        ELSE '✅ Configuration looks healthy'
    END as health_status
FROM tenant_stats;
