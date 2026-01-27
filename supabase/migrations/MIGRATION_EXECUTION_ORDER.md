# TIS TIS Platform - Guía de Ejecución de Migraciones 153-177

## Resumen

Este documento describe el orden correcto de ejecución para las migraciones pendientes (153-177).

**Estado actual:** Las migraciones han sido consolidadas y los archivos originales eliminados. Solo quedan **21 archivos** que deben ejecutarse en orden.

## Migraciones Consolidadas

| Archivo | Consolida | Descripción |
|---------|-----------|-------------|
| `160_SETUP_ASSISTANT_COMPLETE.sql` | 160 + 161 + 164 | Sistema completo de Setup Assistant |
| `162_VOICE_MINUTE_SYSTEM_COMPLETE.sql` | 162 + 163 + 166 | Sistema de límites de minutos de voz |
| `177_ADMIN_CHANNEL_COMPLETE.sql` | 177 + 178 | Sistema Admin Channel B2B |

---

## Orden de Ejecución

```bash
# Ejecutar en este orden exacto:

# 1. AI Learning (ya consolidado en original)
psql -f migrations/153_AI_LEARNING_2_0_CONSOLIDATED.sql

# 2. Fix de response style
psql -f migrations/154_REMOVE_CASUAL_RESPONSE_STYLE.sql

# 3. Unified Assistant Types
psql -f migrations/155_UNIFIED_ASSISTANT_TYPES.sql

# 4. Delivery System
psql -f migrations/156_DELIVERY_SYSTEM.sql

# 5. Email constraint
psql -f migrations/157_ADD_CLIENT_EMAIL_UNIQUE_CONSTRAINT.sql

# 6. Sprint2 indexes
psql -f migrations/158_SPRINT2_INDEXES_AND_RLS_SCOPES.sql

# 7. Audit Trail
psql -f migrations/159_AUDIT_TRAIL_SYSTEM.sql

# 8. Setup Assistant (CONSOLIDADO)
psql -f migrations/160_SETUP_ASSISTANT_COMPLETE.sql

# 9. Voice Minute System (CONSOLIDADO)
psql -f migrations/162_VOICE_MINUTE_SYSTEM_COMPLETE.sql

# 10. Vision Analysis Cache
psql -f migrations/165_VISION_ANALYSIS_CACHE.sql

# 11. Secure Booking System
psql -f migrations/167_SECURE_BOOKING_SYSTEM.sql

# 12. Fix prompt cache hash
psql -f migrations/168_FIX_PROMPT_CACHE_HASH_VOICE_CONFIG.sql

# 13. Voice Agent V2 Feature Flags
psql -f migrations/169_VOICE_AGENT_V2_FEATURE_FLAGS.sql

# 14. RAG Embeddings (requiere pgvector)
psql -f migrations/170_RAG_EMBEDDINGS_SYSTEM.sql

# 15. Lead Cross Channel Identity
psql -f migrations/171_LEAD_CROSS_CHANNEL_IDENTITY.sql

# 16. Personal Assistant Types
psql -f migrations/172_PERSONAL_ASSISTANT_TYPES.sql

# 17. API Key Usage
psql -f migrations/173_API_KEY_USAGE_INCREMENT.sql

# 18. Branch filtering indexes
psql -f migrations/174_OPTIMIZE_BRANCH_FILTERING_INDEXES.sql

# 19. Low Stock RPC
psql -f migrations/175_ADD_LOW_STOCK_RPC_FUNCTION.sql

# 20. Job Queue System
psql -f migrations/176_JOB_QUEUE_SYSTEM.sql

# 21. Admin Channel (CONSOLIDADO)
psql -f migrations/177_ADMIN_CHANNEL_COMPLETE.sql
```

---

## Script Automatizado

Puedes usar el script `run_migrations.sh` incluido:

```bash
chmod +x migrations/run_migrations.sh
./migrations/run_migrations.sh
```

---

## Notas Importantes

### Dependencias

- **170_RAG_EMBEDDINGS_SYSTEM.sql**: Requiere la extensión `pgvector`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

- **175_ADD_LOW_STOCK_RPC_FUNCTION.sql**: Puede requerir la vista materializada `mv_branch_performance`.

- **177_ADMIN_CHANNEL_COMPLETE.sql**: Requiere tablas `tenants`, `staff`, `user_roles`.

### Verificación Post-Ejecución

```sql
-- Verificar tablas de Setup Assistant
SELECT COUNT(*) FROM setup_assistant_conversations;
SELECT COUNT(*) FROM setup_assistant_checkpoints;

-- Verificar tablas de Voice Minute
SELECT COUNT(*) FROM voice_minute_limits;
SELECT COUNT(*) FROM voice_usage_alerts;

-- Verificar tablas de Admin Channel
SELECT COUNT(*) FROM admin_channel_users;
SELECT COUNT(*) FROM admin_channel_notifications;

-- Verificar funciones RPC
SELECT proname FROM pg_proc WHERE proname LIKE 'generate_admin_link%';
SELECT proname FROM pg_proc WHERE proname LIKE 'check_minute_limit%';
SELECT proname FROM pg_proc WHERE proname LIKE 'increment_setup_usage%';
```

---

## Contenido de las Consolidaciones

### 160_SETUP_ASSISTANT_COMPLETE.sql
- **Tablas**: setup_assistant_conversations, setup_assistant_messages, setup_assistant_usage, setup_assistant_checkpoints
- **RPCs**: increment_setup_usage, get_setup_usage_with_limits (con Enterprise), check_setup_action_allowed, cleanup_old_checkpoints, cleanup_all_old_checkpoints
- **Storage**: setup-assistant-uploads bucket

### 162_VOICE_MINUTE_SYSTEM_COMPLETE.sql
- **Tablas**: voice_minute_limits, voice_minute_usage, voice_minute_transactions, voice_usage_alerts
- **RPCs Core**: check_minute_limit, record_minute_usage, get_minute_usage_summary, update_minute_limit_policy
- **RPCs Billing**: get_tenants_pending_overage_billing, get_current_overage_preview, mark_overage_as_billed, reset_monthly_voice_usage, get_voice_billing_history, update_overage_payment_status
- **RPCs Alerts**: get_unacknowledged_voice_alert_count, acknowledge_all_voice_alerts

### 177_ADMIN_CHANNEL_COMPLETE.sql
- **Tablas**: admin_channel_users, admin_channel_conversations, admin_channel_messages, admin_channel_notifications, admin_channel_audit_log
- **RPCs**: generate_admin_link_code, verify_admin_link_code, get_admin_channel_user, update_admin_rate_limit, get_or_create_admin_conversation, save_admin_message
- **Triggers**: hot_lead, escalation, low_inventory

---

## Rollback

Si necesitas hacer rollback de alguna migración consolidada:

```sql
-- Rollback Admin Channel
DROP TABLE IF EXISTS admin_channel_audit_log CASCADE;
DROP TABLE IF EXISTS admin_channel_notifications CASCADE;
DROP TABLE IF EXISTS admin_channel_messages CASCADE;
DROP TABLE IF EXISTS admin_channel_conversations CASCADE;
DROP TABLE IF EXISTS admin_channel_users CASCADE;

-- Rollback Voice Minute System
DROP TABLE IF EXISTS voice_usage_alerts CASCADE;
DROP TABLE IF EXISTS voice_minute_transactions CASCADE;
DROP TABLE IF EXISTS voice_minute_usage CASCADE;
DROP TABLE IF EXISTS voice_minute_limits CASCADE;

-- Rollback Setup Assistant
DROP TABLE IF EXISTS setup_assistant_checkpoints CASCADE;
DROP TABLE IF EXISTS setup_assistant_usage CASCADE;
DROP TABLE IF EXISTS setup_assistant_messages CASCADE;
DROP TABLE IF EXISTS setup_assistant_conversations CASCADE;
```

---

*Documento actualizado: 2026-01-26*
*Total migraciones a ejecutar: 21*
*Archivos eliminados por consolidación: 8*
