-- =====================================================
-- TIS TIS PLATFORM - Migration 100
-- Restock Orders & Auto-Restock System
-- =====================================================
-- Purpose: Enable automatic restock notifications and order management
-- for low stock items. Integrates with suppliers WhatsApp notifications.
-- =====================================================

-- ======================
-- RESTOCK ORDER STATUS ENUM
-- ======================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'restock_order_status') THEN
    CREATE TYPE restock_order_status AS ENUM (
      'draft',         -- Initial state, not yet submitted
      'pending',       -- Awaiting authorization
      'authorized',    -- Manager approved, ready to send to supplier
      'placed',        -- Order sent to supplier
      'partial',       -- Partially received
      'received',      -- Fully received
      'cancelled'      -- Order cancelled
    );
  END IF;
END$$;

-- ======================
-- ALERT TYPE ENUM
-- ======================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'low_stock_alert_type') THEN
    CREATE TYPE low_stock_alert_type AS ENUM (
      'warning',       -- Below minimum stock threshold
      'critical'       -- Severely low or out of stock
    );
  END IF;
END$$;

-- ======================
-- ALERT STATUS ENUM
-- ======================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'low_stock_alert_status') THEN
    CREATE TYPE low_stock_alert_status AS ENUM (
      'open',          -- Active alert
      'acknowledged',  -- Manager saw it
      'ordered',       -- Order created from alert
      'resolved'       -- Stock replenished
    );
  END IF;
END$$;

-- ======================
-- RESTOCK ORDERS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS restock_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES inventory_suppliers(id) ON DELETE RESTRICT,

  -- Order identification
  order_number VARCHAR(50) NOT NULL,
  status restock_order_status NOT NULL DEFAULT 'draft',

  -- Trigger information
  trigger_source VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'auto', 'manual', 'alert'
  triggered_by_alert_ids UUID[] DEFAULT '{}',

  -- Authorization
  created_by UUID REFERENCES auth.users(id),
  authorized_by UUID REFERENCES auth.users(id),
  authorized_at TIMESTAMPTZ,

  -- Supplier communication
  whatsapp_sent BOOLEAN DEFAULT false,
  whatsapp_sent_at TIMESTAMPTZ,
  whatsapp_message_id VARCHAR(100),
  supplier_confirmation VARCHAR(100),

  -- Delivery
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  received_by UUID REFERENCES auth.users(id),
  received_at TIMESTAMPTZ,

  -- Financial
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'MXN',

  -- Notes
  internal_notes TEXT,
  supplier_notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ======================
-- RESTOCK ORDER ITEMS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS restock_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  restock_order_id UUID NOT NULL REFERENCES restock_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,

  -- Quantities
  quantity_requested DECIMAL(12, 3) NOT NULL,
  quantity_received DECIMAL(12, 3) DEFAULT 0,
  unit VARCHAR(20) NOT NULL,

  -- Pricing
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (quantity_requested * unit_cost) STORED,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, partial, received, cancelled

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- LOW STOCK ALERTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Alert info
  alert_type low_stock_alert_type NOT NULL DEFAULT 'warning',
  status low_stock_alert_status NOT NULL DEFAULT 'open',

  -- Stock levels at alert time
  current_stock DECIMAL(12, 3) NOT NULL,
  minimum_stock DECIMAL(12, 3) NOT NULL,
  deficit_quantity DECIMAL(12, 3) GENERATED ALWAYS AS (GREATEST(minimum_stock - current_stock, 0)) STORED,

  -- Supplier info (if available)
  suggested_supplier_id UUID REFERENCES inventory_suppliers(id),
  suggested_quantity DECIMAL(12, 3),

  -- Resolution
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  associated_order_id UUID REFERENCES restock_orders(id),

  -- Auto-resolve tracking
  auto_created_order BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- RESTOCK NOTIFICATION PREFERENCES TABLE
-- ======================
CREATE TABLE IF NOT EXISTS restock_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL = tenant-wide defaults

  -- Alert thresholds
  warning_threshold_percent INTEGER DEFAULT 50,   -- Alert when stock drops to X% of minimum
  critical_threshold_percent INTEGER DEFAULT 25,  -- Critical when drops to X% of minimum

  -- Notification channels
  notify_via_app BOOLEAN DEFAULT true,
  notify_via_email BOOLEAN DEFAULT true,
  notify_via_whatsapp BOOLEAN DEFAULT false,

  -- Email recipients
  manager_emails TEXT[] DEFAULT '{}',

  -- Automation settings
  auto_create_alerts BOOLEAN DEFAULT true,
  auto_create_orders BOOLEAN DEFAULT false,
  auto_send_to_supplier BOOLEAN DEFAULT false,

  -- Timing
  check_frequency_hours INTEGER DEFAULT 4, -- How often to check stock levels
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one preference per branch (or tenant-wide)
  UNIQUE (tenant_id, branch_id)
);

-- ======================
-- INDEXES
-- ======================

-- Restock orders indexes
CREATE INDEX IF NOT EXISTS idx_restock_orders_tenant ON restock_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restock_orders_branch ON restock_orders(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restock_orders_supplier ON restock_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restock_orders_status ON restock_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restock_orders_created ON restock_orders(created_at DESC) WHERE deleted_at IS NULL;

-- Restock order items indexes
CREATE INDEX IF NOT EXISTS idx_restock_order_items_order ON restock_order_items(restock_order_id);
CREATE INDEX IF NOT EXISTS idx_restock_order_items_item ON restock_order_items(inventory_item_id);

-- Low stock alerts indexes
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_tenant ON low_stock_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_branch ON low_stock_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_item ON low_stock_alerts(item_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_status ON low_stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_created ON low_stock_alerts(created_at DESC);

-- Notification preferences indexes
CREATE INDEX IF NOT EXISTS idx_restock_prefs_tenant ON restock_notification_preferences(tenant_id);

-- ======================
-- TRIGGERS
-- ======================

-- Auto-generate order number (uses advisory lock to prevent race conditions)
CREATE OR REPLACE FUNCTION generate_restock_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_date_part TEXT;
BEGIN
  -- Use advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('order_number_' || NEW.tenant_id::text));

  v_date_part := TO_CHAR(NOW(), 'YYMMDD');

  SELECT COUNT(*) + 1 INTO v_count
  FROM restock_orders
  WHERE tenant_id = NEW.tenant_id
    AND order_number LIKE 'ORD-' || v_date_part || '-%';

  NEW.order_number := 'ORD-' || v_date_part || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_order_number ON restock_orders;
CREATE TRIGGER trigger_generate_order_number
BEFORE INSERT ON restock_orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
EXECUTE FUNCTION generate_restock_order_number();

-- Update order totals when items change
CREATE OR REPLACE FUNCTION update_restock_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE restock_orders
  SET
    subtotal = (
      SELECT COALESCE(SUM(quantity_requested * unit_cost), 0)
      FROM restock_order_items
      WHERE restock_order_id = COALESCE(NEW.restock_order_id, OLD.restock_order_id)
    ),
    total_amount = (
      SELECT COALESCE(SUM(quantity_requested * unit_cost), 0)
      FROM restock_order_items
      WHERE restock_order_id = COALESCE(NEW.restock_order_id, OLD.restock_order_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.restock_order_id, OLD.restock_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_order_totals ON restock_order_items;
CREATE TRIGGER trigger_update_order_totals
AFTER INSERT OR UPDATE OR DELETE ON restock_order_items
FOR EACH ROW
EXECUTE FUNCTION update_restock_order_totals();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_restock_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_restock_orders_updated ON restock_orders;
CREATE TRIGGER trigger_restock_orders_updated
BEFORE UPDATE ON restock_orders
FOR EACH ROW
EXECUTE FUNCTION update_restock_timestamp();

DROP TRIGGER IF EXISTS trigger_restock_items_updated ON restock_order_items;
CREATE TRIGGER trigger_restock_items_updated
BEFORE UPDATE ON restock_order_items
FOR EACH ROW
EXECUTE FUNCTION update_restock_timestamp();

DROP TRIGGER IF EXISTS trigger_low_stock_alerts_updated ON low_stock_alerts;
CREATE TRIGGER trigger_low_stock_alerts_updated
BEFORE UPDATE ON low_stock_alerts
FOR EACH ROW
EXECUTE FUNCTION update_restock_timestamp();

-- ======================
-- ROW LEVEL SECURITY
-- ======================

ALTER TABLE restock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE low_stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Restock Orders RLS
CREATE POLICY "Users can view their tenant's restock orders"
ON restock_orders FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can create restock orders for their tenant"
ON restock_orders FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can update their tenant's restock orders"
ON restock_orders FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Restock Order Items RLS
CREATE POLICY "Users can view their tenant's order items"
ON restock_order_items FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can manage their tenant's order items"
ON restock_order_items FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Low Stock Alerts RLS
CREATE POLICY "Users can view their tenant's alerts"
ON low_stock_alerts FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can manage their tenant's alerts"
ON low_stock_alerts FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Notification Preferences RLS
CREATE POLICY "Users can view their tenant's preferences"
ON restock_notification_preferences FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can manage their tenant's preferences"
ON restock_notification_preferences FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ======================
-- HELPER FUNCTIONS
-- ======================

-- Get pending alerts count for dashboard
CREATE OR REPLACE FUNCTION get_open_alerts_count(p_tenant_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM low_stock_alerts
  WHERE tenant_id = p_tenant_id
    AND status IN ('open', 'acknowledged')
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
$$;

-- Get pending orders count for dashboard
CREATE OR REPLACE FUNCTION get_pending_orders_count(p_tenant_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM restock_orders
  WHERE tenant_id = p_tenant_id
    AND status IN ('pending', 'authorized', 'placed')
    AND deleted_at IS NULL
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
$$;

-- Create alert from low stock item
CREATE OR REPLACE FUNCTION create_low_stock_alert(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_item_id UUID,
  p_current_stock DECIMAL,
  p_minimum_stock DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert_id UUID;
  v_alert_type low_stock_alert_type;
  v_supplier_id UUID;
  v_reorder_qty DECIMAL;
BEGIN
  -- Determine alert type based on stock level
  IF p_current_stock <= (p_minimum_stock * 0.25) THEN
    v_alert_type := 'critical';
  ELSE
    v_alert_type := 'warning';
  END IF;

  -- Get preferred supplier and reorder quantity
  SELECT preferred_supplier_id, reorder_quantity
  INTO v_supplier_id, v_reorder_qty
  FROM inventory_items
  WHERE id = p_item_id;

  -- Create alert
  INSERT INTO low_stock_alerts (
    tenant_id,
    branch_id,
    item_id,
    alert_type,
    current_stock,
    minimum_stock,
    suggested_supplier_id,
    suggested_quantity
  ) VALUES (
    p_tenant_id,
    p_branch_id,
    p_item_id,
    v_alert_type,
    p_current_stock,
    p_minimum_stock,
    v_supplier_id,
    COALESCE(v_reorder_qty, p_minimum_stock - p_current_stock + (p_minimum_stock * 0.5))
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_open_alerts_count(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_orders_count(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_low_stock_alert(UUID, UUID, UUID, DECIMAL, DECIMAL) TO authenticated;

-- ======================
-- CRITICAL FUNCTIONS
-- ======================

-- Update inventory stock (used when receiving orders)
CREATE OR REPLACE FUNCTION update_inventory_stock(
  p_item_id UUID,
  p_quantity_change DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE inventory_items
  SET
    current_stock = current_stock + p_quantity_change,
    updated_at = NOW()
  WHERE id = p_item_id;
END;
$$;

-- Process restock order receipt transactionally
-- This function handles all receipt operations atomically
CREATE OR REPLACE FUNCTION process_restock_order_receipt(
  p_order_id UUID,
  p_tenant_id UUID,
  p_branch_id UUID,
  p_user_id UUID,
  p_alert_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Process each item in the order
  FOR v_item IN
    SELECT inventory_item_id, quantity_requested, unit_cost
    FROM restock_order_items
    WHERE restock_order_id = p_order_id
  LOOP
    -- Create inventory movement
    INSERT INTO inventory_movements (
      tenant_id,
      branch_id,
      item_id,
      movement_type,
      quantity,
      unit_cost,
      reference_type,
      reference_id,
      performed_by
    ) VALUES (
      p_tenant_id,
      p_branch_id,
      v_item.inventory_item_id,
      'purchase',
      v_item.quantity_requested,
      v_item.unit_cost,
      'restock_order',
      p_order_id,
      p_user_id
    );

    -- Update stock
    UPDATE inventory_items
    SET
      current_stock = current_stock + v_item.quantity_requested,
      updated_at = NOW()
    WHERE id = v_item.inventory_item_id;
  END LOOP;

  -- Resolve associated alerts
  IF array_length(p_alert_ids, 1) > 0 THEN
    UPDATE low_stock_alerts
    SET
      status = 'resolved',
      resolved_by = p_user_id,
      resolved_at = NOW()
    WHERE id = ANY(p_alert_ids);
  END IF;
END;
$$;

-- Get next order number atomically (fixes race condition)
CREATE OR REPLACE FUNCTION get_next_order_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_date_part TEXT;
BEGIN
  -- Lock to prevent concurrent access
  PERFORM pg_advisory_xact_lock(hashtext('order_number_' || p_tenant_id::text));

  v_date_part := TO_CHAR(NOW(), 'YYMMDD');

  SELECT COUNT(*) + 1 INTO v_count
  FROM restock_orders
  WHERE tenant_id = p_tenant_id
    AND order_number LIKE 'ORD-' || v_date_part || '-%';

  RETURN 'ORD-' || v_date_part || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION update_inventory_stock(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION process_restock_order_receipt(UUID, UUID, UUID, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_order_number(UUID) TO authenticated;

-- ======================
-- SUCCESS: Migration 100 completed
-- Tables: restock_orders, restock_order_items, low_stock_alerts, restock_notification_preferences
-- Functions: get_open_alerts_count, get_pending_orders_count, create_low_stock_alert,
--            update_inventory_stock, process_restock_order_receipt, get_next_order_number
-- =====================================================
