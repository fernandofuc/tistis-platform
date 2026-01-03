-- =====================================================
-- TIS TIS PLATFORM - INVENTORY FOREIGN KEYS FIX
-- Migration 091: Add missing foreign key constraints
-- =====================================================
-- Esta migración agrega las FK faltantes para suppliers
-- =====================================================

-- Add FK for preferred_supplier_id in inventory_items
ALTER TABLE public.inventory_items
    ADD CONSTRAINT fk_inventory_items_preferred_supplier
    FOREIGN KEY (preferred_supplier_id)
    REFERENCES public.inventory_suppliers(id)
    ON DELETE SET NULL;

-- Add FK for supplier_id in inventory_batches
ALTER TABLE public.inventory_batches
    ADD CONSTRAINT fk_inventory_batches_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES public.inventory_suppliers(id)
    ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier
    ON public.inventory_items(preferred_supplier_id)
    WHERE preferred_supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_batches_supplier
    ON public.inventory_batches(supplier_id)
    WHERE supplier_id IS NOT NULL;

-- Enable realtime for inventory tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_suppliers;

SELECT 'Migration 091: Inventory FK Fix - COMPLETADA' as status;
