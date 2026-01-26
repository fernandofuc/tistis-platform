-- =====================================================
-- TIS TIS PLATFORM - Admin Channel Notification Triggers
-- Migration: 178
-- Date: 2026-01-25
--
-- Triggers para generar notificaciones automáticas:
-- - Hot leads (score >= 80)
-- - Escalaciones de conversaciones
-- - Inventario bajo
-- =====================================================

-- =====================================================
-- FUNCIÓN: Trigger para leads calientes
-- Se dispara cuando un lead alcanza score >= 80
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_hot_lead_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_name VARCHAR(200);
BEGIN
  -- Solo notificar si el score es >= 80 (hot) y cambió a ese estado
  IF NEW.score >= 80 AND (OLD IS NULL OR OLD.score < 80) THEN
    -- Obtener nombre del tenant para referencia
    SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;

    -- Insertar notificación para todos los usuarios admin del tenant
    INSERT INTO admin_channel_notifications (
      tenant_id,
      user_id,
      notification_type,
      title,
      content,
      priority,
      channel,
      trigger_data,
      status,
      created_at,
      updated_at
    )
    SELECT
      NEW.tenant_id,
      acu.id,
      'hot_lead',
      'Lead Caliente',
      format(
        E'🔥 *Nuevo Lead Caliente*\n\nNombre: %s\nTeléfono: %s\nFuente: %s\nScore: %s%%\n\n¡Contacta pronto!',
        COALESCE(NEW.name, 'Sin nombre'),
        COALESCE(NEW.phone, 'N/A'),
        COALESCE(NEW.source, 'Directo'),
        NEW.score
      ),
      'urgent',
      'both',
      jsonb_build_object(
        'lead_id', NEW.id,
        'name', NEW.name,
        'phone', NEW.phone,
        'source', NEW.source,
        'score', NEW.score,
        'tenant_name', v_tenant_name
      ),
      'pending',
      NOW(),
      NOW()
    FROM admin_channel_users acu
    WHERE acu.tenant_id = NEW.tenant_id
      AND acu.status = 'active'
      AND acu.can_receive_notifications = true;

    -- Log para auditoría
    RAISE NOTICE 'Hot lead notification created for tenant %', NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (solo si existe tabla leads)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    DROP TRIGGER IF EXISTS lead_hot_notification_trigger ON leads;
    CREATE TRIGGER lead_hot_notification_trigger
      AFTER INSERT OR UPDATE OF score ON leads
      FOR EACH ROW
      EXECUTE FUNCTION trigger_hot_lead_notification();

    RAISE NOTICE 'Trigger lead_hot_notification_trigger created';
  ELSE
    RAISE NOTICE 'Table leads does not exist, skipping trigger creation';
  END IF;
END $$;

-- =====================================================
-- FUNCIÓN: Trigger para escalaciones
-- Se dispara cuando una conversación cambia a status 'escalated'
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_escalation_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo notificar si cambia a escalated
  IF NEW.status = 'escalated' AND (OLD IS NULL OR OLD.status != 'escalated') THEN
    INSERT INTO admin_channel_notifications (
      tenant_id,
      user_id,
      notification_type,
      title,
      content,
      priority,
      channel,
      trigger_data,
      status,
      created_at,
      updated_at
    )
    SELECT
      NEW.tenant_id,
      acu.id,
      'escalation',
      'Conversación Escalada',
      format(
        E'🙋 *Conversación Escalada*\n\nCliente: %s\nCanal: %s\nRazón: %s\n\nRevisa el inbox para atender.',
        COALESCE(NEW.customer_name, 'Cliente'),
        COALESCE(NEW.channel, 'WhatsApp'),
        COALESCE(NEW.escalation_reason, 'Solicitud de humano')
      ),
      'urgent',
      'both',
      jsonb_build_object(
        'conversation_id', NEW.id,
        'customer_name', NEW.customer_name,
        'channel', NEW.channel,
        'escalation_reason', NEW.escalation_reason
      ),
      'pending',
      NOW(),
      NOW()
    FROM admin_channel_users acu
    WHERE acu.tenant_id = NEW.tenant_id
      AND acu.status = 'active'
      AND acu.can_receive_notifications = true;

    RAISE NOTICE 'Escalation notification created for conversation %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (solo si existe tabla conversations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    DROP TRIGGER IF EXISTS conversation_escalation_trigger ON conversations;
    CREATE TRIGGER conversation_escalation_trigger
      AFTER UPDATE OF status ON conversations
      FOR EACH ROW
      EXECUTE FUNCTION trigger_escalation_notification();

    RAISE NOTICE 'Trigger conversation_escalation_trigger created';
  ELSE
    RAISE NOTICE 'Table conversations does not exist, skipping trigger creation';
  END IF;
END $$;

-- =====================================================
-- FUNCIÓN: Trigger para inventario bajo
-- Se dispara cuando el stock baja del mínimo configurado
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_low_inventory_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo notificar si baja del mínimo y antes estaba por encima
  IF NEW.current_stock <= NEW.min_stock
     AND (OLD IS NULL OR OLD.current_stock > OLD.min_stock) THEN
    INSERT INTO admin_channel_notifications (
      tenant_id,
      user_id,
      notification_type,
      title,
      content,
      priority,
      channel,
      trigger_data,
      status,
      created_at,
      updated_at
    )
    SELECT
      NEW.tenant_id,
      acu.id,
      'low_inventory',
      'Inventario Bajo',
      format(
        E'⚠️ *Alerta de Inventario*\n\n%s\nStock actual: %s\nMínimo: %s\n\nReabastece pronto.',
        NEW.name,
        NEW.current_stock,
        NEW.min_stock
      ),
      'high',
      'both',
      jsonb_build_object(
        'item_id', NEW.id,
        'name', NEW.name,
        'current_stock', NEW.current_stock,
        'min_stock', NEW.min_stock
      ),
      'pending',
      NOW(),
      NOW()
    FROM admin_channel_users acu
    WHERE acu.tenant_id = NEW.tenant_id
      AND acu.status = 'active'
      AND acu.can_receive_notifications = true;

    RAISE NOTICE 'Low inventory notification created for item %', NEW.name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (solo si existe tabla inventory_items)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    DROP TRIGGER IF EXISTS inventory_low_notification_trigger ON inventory_items;
    CREATE TRIGGER inventory_low_notification_trigger
      AFTER UPDATE OF current_stock ON inventory_items
      FOR EACH ROW
      EXECUTE FUNCTION trigger_low_inventory_notification();

    RAISE NOTICE 'Trigger inventory_low_notification_trigger created';
  ELSE
    RAISE NOTICE 'Table inventory_items does not exist, skipping trigger creation';
  END IF;
END $$;

-- =====================================================
-- ÍNDICES para optimizar consultas de notificaciones
-- =====================================================

-- Índice para buscar notificaciones pendientes eficientemente
CREATE INDEX IF NOT EXISTS idx_admin_notifications_pending_scheduled
ON admin_channel_notifications (status, scheduled_for)
WHERE status = 'pending';

-- Índice para buscar notificaciones por usuario
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_created
ON admin_channel_notifications (user_id, created_at DESC);

-- Índice para buscar notificaciones por prioridad
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority
ON admin_channel_notifications (priority, created_at)
WHERE status = 'pending';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'Migration 178: Admin Channel Notification Triggers';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers created:';
  RAISE NOTICE '  - trigger_hot_lead_notification (leads)';
  RAISE NOTICE '  - trigger_escalation_notification (conversations)';
  RAISE NOTICE '  - trigger_low_inventory_notification (inventory_items)';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes created:';
  RAISE NOTICE '  - idx_admin_notifications_pending_scheduled';
  RAISE NOTICE '  - idx_admin_notifications_user_created';
  RAISE NOTICE '  - idx_admin_notifications_priority';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '=====================================================';
END $$;
