-- =====================================================
-- TIS TIS PLATFORM - Migration 099
-- Add WhatsApp, Supplied Items, and Delivery Branches to Suppliers
-- =====================================================
-- Purpose: Enable suppliers to be notified via WhatsApp about
-- low stock items, with ability to track which items they supply
-- and to which branches they deliver.
-- =====================================================

-- Add new columns to inventory_suppliers table
ALTER TABLE inventory_suppliers
ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
ADD COLUMN IF NOT EXISTS supplied_item_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS delivery_branch_ids UUID[] DEFAULT '{}';

-- Add comment descriptions
COMMENT ON COLUMN inventory_suppliers.whatsapp IS 'WhatsApp number for automated notifications (format: +521234567890)';
COMMENT ON COLUMN inventory_suppliers.supplied_item_ids IS 'Array of inventory_items IDs that this supplier provides';
COMMENT ON COLUMN inventory_suppliers.delivery_branch_ids IS 'Array of branches IDs where this supplier delivers';

-- Create index for efficient queries on suppliers by items they supply
CREATE INDEX IF NOT EXISTS idx_inventory_suppliers_supplied_items
ON inventory_suppliers USING GIN (supplied_item_ids)
WHERE deleted_at IS NULL;

-- Create index for efficient queries on suppliers by delivery branches
CREATE INDEX IF NOT EXISTS idx_inventory_suppliers_delivery_branches
ON inventory_suppliers USING GIN (delivery_branch_ids)
WHERE deleted_at IS NULL;

-- Function to get suppliers for a specific item
CREATE OR REPLACE FUNCTION get_suppliers_for_item(p_item_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  supplier_name VARCHAR,
  contact_name VARCHAR,
  whatsapp VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id AS supplier_id,
    name AS supplier_name,
    contact_name,
    whatsapp
  FROM inventory_suppliers
  WHERE p_item_id = ANY(supplied_item_ids)
    AND deleted_at IS NULL
    AND is_active = true
  ORDER BY name;
$$;

-- Function to get suppliers for a specific branch
CREATE OR REPLACE FUNCTION get_suppliers_for_branch(p_branch_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  supplier_name VARCHAR,
  contact_name VARCHAR,
  whatsapp VARCHAR,
  supplied_items_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id AS supplier_id,
    name AS supplier_name,
    contact_name,
    whatsapp,
    array_length(supplied_item_ids, 1) AS supplied_items_count
  FROM inventory_suppliers
  WHERE p_branch_id = ANY(delivery_branch_ids)
    AND deleted_at IS NULL
    AND is_active = true
  ORDER BY name;
$$;

-- Function to get low stock items with their suppliers for WhatsApp notification
CREATE OR REPLACE FUNCTION get_low_stock_alerts_with_suppliers(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  item_id UUID,
  item_name VARCHAR,
  current_stock DECIMAL,
  minimum_stock DECIMAL,
  unit VARCHAR,
  supplier_id UUID,
  supplier_name VARCHAR,
  supplier_whatsapp VARCHAR,
  branch_id UUID,
  branch_name VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    i.id AS item_id,
    i.name AS item_name,
    i.current_stock,
    i.minimum_stock,
    i.unit,
    s.id AS supplier_id,
    s.name AS supplier_name,
    s.whatsapp AS supplier_whatsapp,
    b.id AS branch_id,
    b.name AS branch_name
  FROM inventory_items i
  LEFT JOIN inventory_suppliers s ON i.id = ANY(s.supplied_item_ids) AND s.deleted_at IS NULL AND s.is_active = true
  LEFT JOIN branches b ON b.id = i.branch_id OR (i.branch_id IS NULL AND b.tenant_id = i.tenant_id)
  WHERE i.tenant_id = p_tenant_id
    AND i.deleted_at IS NULL
    AND i.is_active = true
    AND i.current_stock <= i.minimum_stock
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR i.branch_id IS NULL)
    AND (s.id IS NULL OR p_branch_id IS NULL OR p_branch_id = ANY(s.delivery_branch_ids))
  ORDER BY i.name;
$$;

-- Auto-generate supplier code function
CREATE OR REPLACE FUNCTION generate_supplier_code(p_tenant_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_code VARCHAR;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM inventory_suppliers
  WHERE tenant_id = p_tenant_id;

  v_code := 'PROV-' || LPAD(v_count::TEXT, 3, '0');

  RETURN v_code;
END;
$$;

-- Trigger to auto-generate supplier code if not provided
CREATE OR REPLACE FUNCTION auto_generate_supplier_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_supplier_code(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_supplier_code ON inventory_suppliers;
CREATE TRIGGER trigger_auto_supplier_code
BEFORE INSERT ON inventory_suppliers
FOR EACH ROW
EXECUTE FUNCTION auto_generate_supplier_code();

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_suppliers_for_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_suppliers_for_branch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_alerts_with_suppliers(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_supplier_code(UUID) TO authenticated;

-- =====================================================
-- SUCCESS: Migration 099 completed
-- New columns: whatsapp, supplied_item_ids, delivery_branch_ids
-- New functions: get_suppliers_for_item, get_suppliers_for_branch,
--                get_low_stock_alerts_with_suppliers, generate_supplier_code
-- =====================================================
